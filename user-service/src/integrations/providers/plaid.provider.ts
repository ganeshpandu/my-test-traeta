import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TechvLogger } from 'techvedika-logger';
import {
  IntegrationProvider,
  IntegrationProviderName,
  ConnectResponse,
  CallbackPayload,
} from '../types';
import { IntegrationPersistence } from '../persistence';
import { PrismaService } from '@traeta/prisma';
import { TokenStore } from '../token-store';
import {
  PlaidApi,
  Configuration,
  PlaidEnvironments,
  LinkTokenCreateRequest,
  ItemPublicTokenExchangeRequest,
  TransactionsGetRequest,
  Products,
  CountryCode,
  Transaction,
} from 'plaid';
import {
  ConfigurationException,
  InvalidCallbackException,
  OAuthAuthenticationException,
  InvalidTokenException,
  DataSyncException,
  ProviderAPIException,
  RateLimitException,
} from '../exceptions/integration.exceptions';
import {
  DATA_TYPE,
  REC_SEQ,
  STATUS,
  LogType,
  MethodNames,
  FOOD_KEYWORDS,
} from '../../../constants';

const buildAddress = (location: any) => {
  if (!location) return 'Location Not available';

  const parts = [
    location.address,
    location.city,
    location.region,
    location.postal_code,
    location.country,
  ].filter(Boolean); // Remove any null/undefined/empty strings

  return parts.join(', ') || 'Location Not available';
};

@Injectable()
export class PlaidProvider implements IntegrationProvider {
  public readonly name = IntegrationProviderName.PLAID;

  constructor(
    private readonly db: PrismaService,
    private readonly persistence: IntegrationPersistence,
    private readonly tokens: TokenStore,
    private readonly configService: ConfigService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  private getClientId(): string {
    return this.configService.get<string>('PLAID_CLIENT_ID') || '';
  }

  private getSecret(): string {
    return this.configService.get<string>('PLAID_SECRET') || '';
  }

  private getEnvironment(): string {
    return this.configService.get<string>('PLAID_ENV') || 'sandbox';
  }

  private getPlaidClient(): PlaidApi {
    const configuration = new Configuration({
      basePath: this.getPlaidEnvironment(),
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': this.getClientId(),
          'PLAID-SECRET': this.getSecret(),
        },
      },
    });
    return new PlaidApi(configuration);
  }

  private getPlaidEnvironment(): string {
    switch (this.getEnvironment()) {
      case 'sandbox':
        return PlaidEnvironments.sandbox;
      case 'development':
        return PlaidEnvironments.development;
      case 'production':
        return PlaidEnvironments.production;
      default:
        return PlaidEnvironments.sandbox;
    }
  }

  async createConnection(userId: string): Promise<ConnectResponse> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Creating Plaid link token',
      data: {
        service: PlaidProvider.name,
        method: MethodNames.createConnection,
        userId,
      },
    });

    // Validate configuration
    const clientId = this.getClientId();
    const secret = this.getSecret();
    if (!clientId || !secret) {
      throw new ConfigurationException(
        IntegrationProviderName.PLAID,
        'Plaid integration is not properly configured. Missing CLIENT_ID or SECRET.',
      );
    }

    try {
      const state = `plaid-${userId}-${Date.now()}`;

      const request: LinkTokenCreateRequest = {
        user: {
          client_user_id: userId,
        },
        client_name: 'Traeta',
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
        webhook: process.env.PLAID_WEBHOOK_URL,
      };

      const response = await this.getPlaidClient().linkTokenCreate(request);
      const linkToken = response.data.link_token;

      await this.persistence.ensureIntegration('plaid');

      return {
        provider: this.name,
        linkToken,
        state,
        redirectUrl: `plaid://link?token=${linkToken}`, // For mobile deep linking
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to create Plaid link token',
        data: {
          service: PlaidProvider.name,
          method: MethodNames.createConnection,
          userId,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Handle Plaid API errors
      if (error.response) {
        const status = error.response.status;
        const plaidError = error.response.data;
        const message = plaidError?.error_message || error.message;

        if (status === 401) {
          throw new ConfigurationException(
            IntegrationProviderName.PLAID,
            'Invalid Plaid credentials. Please check CLIENT_ID and SECRET.',
          );
        } else if (status === 429) {
          throw new RateLimitException(
            IntegrationProviderName.PLAID,
            error.response.headers['retry-after'],
          );
        } else {
          throw new ProviderAPIException(
            IntegrationProviderName.PLAID,
            `Failed to create link token: ${message}`,
            status,
          );
        }
      }

      throw new ProviderAPIException(
        IntegrationProviderName.PLAID,
        `Unexpected error creating link token: ${error.message}`,
      );
    }
  }

  async handleCallback(payload: CallbackPayload): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Handling Plaid callback',
      data: {
        service: PlaidProvider.name,
        method: MethodNames.handleCallback,
        provider: this.name,
      },
    });

    const { public_token, state, metadata } = payload as any;

    if (!public_token || !state) {
      throw new InvalidCallbackException(
        IntegrationProviderName.PLAID,
        'Missing public_token or state parameter',
      );
    }

    // Extract userId from state format: "plaid-<userId>-<ts>"
    const stateStr = String(state);
    if (!stateStr.startsWith('plaid-')) {
      throw new InvalidCallbackException(
        IntegrationProviderName.PLAID,
        'Invalid state format: must start with plaid-',
      );
    }

    const stateWithoutPrefix = stateStr.replace(/^plaid-/, '');
    const lastDashIndex = stateWithoutPrefix.lastIndexOf('-');
    const userId =
      lastDashIndex > 0
        ? stateWithoutPrefix.substring(0, lastDashIndex)
        : stateWithoutPrefix;
    if (!userId || lastDashIndex <= 0) {
      throw new InvalidCallbackException(
        IntegrationProviderName.PLAID,
        'Invalid state format: unable to extract userId',
      );
    }

    try {
      // Exchange public token for access token
      const request: ItemPublicTokenExchangeRequest = {
        public_token,
      };

      const response =
        await this.getPlaidClient().itemPublicTokenExchange(request);
      const accessToken = response.data.access_token;
      const itemId = response.data.item_id;

      // Store access token
      await this.tokens.set(userId, 'plaid', {
        accessToken,
        providerUserId: itemId,
        // Plaid access tokens don't expire
        expiresAt: Math.floor(Date.now() / 1000) + 31536000, // 1 year for tracking
      });

      // // Store metadata if available
      // if (metadata) {
      //     await this.tokens.set(userId, 'plaid_metadata', {
      //         accessToken: JSON.stringify(metadata),
      //         expiresAt: Math.floor(Date.now() / 1000) + 31536000,
      //     });
      // }

      // Mark as connected
      const integration = await this.persistence.ensureIntegration('plaid');
      await this.persistence.markConnected(userId, integration.integrationId);

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Plaid connected successfully',
        data: {
          service: PlaidProvider.name,
          method: MethodNames.handleCallback,
          userId,
          provider: this.name,
        },
      });

      // Automatically sync user data after successful connection
      try {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Starting automatic sync after Plaid connection',
          data: {
            service: PlaidProvider.name,
            method: MethodNames.sync,
            userId,
            provider: this.name,
          },
        });
        const syncResult = await this.sync(userId);
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Automatic sync completed',
          data: {
            service: PlaidProvider.name,
            method: MethodNames.sync,
            userId,
            provider: this.name,
          },
        });
      } catch (syncError) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Automatic sync failed',
          data: {
            service: PlaidProvider.name,
            method: MethodNames.sync,
            userId,
            provider: this.name,
          },
          error:
            syncError instanceof Error ? syncError.message : String(syncError),
        });
        // Don't throw error here as connection was successful, sync can be retried later
      }
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to handle Plaid callback',
        data: {
          service: PlaidProvider.name,
          method: MethodNames.handleCallback,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // If it's already one of our custom exceptions, re-throw it
      if (error instanceof InvalidCallbackException) {
        throw error;
      }

      // Handle Plaid API errors
      if (error.response) {
        const status = error.response.status;
        const plaidError = error.response.data;
        const message = plaidError?.error_message || error.message;

        if (status === 401 || status === 403) {
          throw new OAuthAuthenticationException(
            IntegrationProviderName.PLAID,
            `Failed to exchange public token: ${message}`,
          );
        } else if (status === 429) {
          throw new RateLimitException(
            IntegrationProviderName.PLAID,
            error.response.headers['retry-after'],
          );
        } else {
          throw new ProviderAPIException(
            IntegrationProviderName.PLAID,
            `Token exchange failed: ${message}`,
            status,
          );
        }
      }

      // Generic error
      throw new OAuthAuthenticationException(
        IntegrationProviderName.PLAID,
        `Unexpected error during callback: ${error.message}`,
      );
    }
  }

  async sync(
    userId: string,
  ): Promise<{ ok: boolean; syncedAt?: Date; details?: any }> {
    const integration = await this.persistence.ensureIntegration('plaid');
    const sinceDate =
      (await this.persistence.getLastSyncedAt(
        userId,
        integration.integrationId,
      )) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days

    try {
      const tokenData = await this.tokens.get(userId, 'plaid');
      if (!tokenData) {
        throw new InvalidTokenException(IntegrationProviderName.PLAID);
      }

      const accessToken = tokenData.accessToken;
      let totalItems = 0;

      // Fetch transactions for each account
      const transactions = await this.fetchTransactions(accessToken, sinceDate);

      if (transactions.length > 0) {
        await this.processTransactions(userId, transactions);
        totalItems += transactions.length;
      }

      // Mark as synced
      const link = await this.db.userIntegrations.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId: integration.integrationId,
          integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        },
      });

      if (link) {
        await this.persistence.markSynced(link.userIntegrationId);
      }

      return {
        ok: true,
        syncedAt: new Date(),
        details: {
          totalItems,
          transactions: transactions.length,
          since: sinceDate,
        },
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Plaid sync failed',
        data: {
          service: PlaidProvider.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // If it's already one of our custom exceptions, re-throw it
      if (
        error instanceof InvalidTokenException ||
        error instanceof RateLimitException ||
        error instanceof ProviderAPIException
      ) {
        throw error;
      }

      // Handle Plaid API errors
      if (error.response) {
        const status = error.response.status;
        const plaidError = error.response.data;
        const message = plaidError?.error_message || error.message;

        if (status === 429) {
          throw new RateLimitException(
            IntegrationProviderName.PLAID,
            error.response.headers['retry-after'],
          );
        } else if (status === 401 || status === 403) {
          throw new InvalidTokenException(IntegrationProviderName.PLAID);
        } else {
          throw new ProviderAPIException(
            IntegrationProviderName.PLAID,
            `Plaid API error during sync: ${message}`,
            status,
          );
        }
      }

      // Generic sync error
      throw new DataSyncException(
        IntegrationProviderName.PLAID,
        `Failed to sync Plaid data: ${error.message}`,
      );
    }
  }

  async status(userId: string): Promise<{
    connected: boolean;
    lastSyncedAt?: Date | null;
    details?: any;
  }> {
    const integration = await this.persistence.ensureIntegration('plaid');
    const link = await this.db.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
      },
    });

    const history = link
      ? await this.db.userIntegrationHistory.findFirst({
          where: {
            userIntegrationId: link.userIntegrationId,
            userIntegrationRecSeq: REC_SEQ.DEFAULT_RECORD,
          },
        })
      : null;

    // Check if tokens exist
    const tokens = await this.tokens.get(userId, 'plaid');

    return {
      connected: !!link && link.status === 'CONNECTED',
      lastSyncedAt: history?.lastSyncedAt ?? null,
      details: {},
    };
  }

  private async fetchTransactions(
    accessToken: string,
    since: Date,
  ): Promise<Transaction[]> {
    const endDate = new Date();
    const startDate = since;

    const baseRequest: TransactionsGetRequest = {
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      options: {
        count: 500,
        offset: 0,
      },
    };

    let allTransactions: Transaction[] = [];
    let offset = 0;

    while (true) {
      const request: TransactionsGetRequest = {
        ...baseRequest,
        options: {
          ...baseRequest.options,
          offset,
        },
      };

      const response = await this.getPlaidClient().transactionsGet(request);

      const transactions = response.data.transactions;

      if (transactions.length === 0) {
        break; // No more transactions to fetch
      }

      allTransactions = allTransactions.concat(transactions);
      offset += transactions.length;
    }

    return allTransactions;
  }

  private async processTransactions(
    userId: string,
    transactions: Transaction[],
  ): Promise<void> {
    for (const transaction of transactions) {
      try {
        const category = this.categorizeTransaction(transaction);

        if (category.listType === 'Uncategorized') {
          continue;
        }

        const ensureResult =
          await this.persistence.ensureListAndCategoryForUser(
            userId,
            category.listType,
            category.categoryName,
          );

        // Defensive check
        if (!ensureResult || !ensureResult.list || !ensureResult.userList) {
          continue;
        }

        const { list, userList, category: listCategory } = ensureResult;

        const transactionDate = new Date(transaction.date);
        const dateStr = transactionDate.toISOString().slice(0, 10); // YYYY-MM-DD

        const startTime = transactionDate.getTime();
        const endTime = transactionDate.getTime();

        // Process merchant/name with default value
        const merchant = (
          transaction.merchant_name ||
          transaction.name ||
          'Unknown Merchant'
        ).trim();

        // Process location/address with default value
        const address =
          buildAddress(transaction.location) ||
          transaction.merchant_name ||
          transaction.name ||
          'Location Not available';

        const timeStr = transactionDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });

        let attributes: any = {};
        let attributeDataType: any = {};
        let title: string = '';

        switch (category.listType) {
          case 'Travel':
            attributes = {
              startDate: dateStr,
              endDate: dateStr,
              address: address,
              image: [],
              state: transaction.location.region || '',
              city: transaction.location.city || '',
              country: transaction.location.country || '',
              startTime: startTime || '',
              endTime: endTime || '',
              duration: '',
              description: '',
              nameOfTrip: '',
              withWho: '',
            };
            attributeDataType = {
              startDate: DATA_TYPE.STRING,
              endDate: DATA_TYPE.STRING,
              address: DATA_TYPE.STRING,
              image: DATA_TYPE.STRING_ARRAY,
              state: DATA_TYPE.STRING,
              city: DATA_TYPE.STRING,
              country: DATA_TYPE.STRING,
              startTime: DATA_TYPE.STRING,
              endTime: DATA_TYPE.STRING,
              duration: DATA_TYPE.STRING,
              description: DATA_TYPE.STRING,
              nameOfTrip: DATA_TYPE.STRING,
              withWho: DATA_TYPE.STRING,
            };
            title = address;
            break;

          case 'Transport':
            attributes = {
              TransportCompany: merchant,
              startDate: dateStr,
              startTime: timeStr,
              startAddress: address,
              endDate: dateStr,
              endTime: timeStr,
              endAddress: address,
              image: [],
              transportType: category,
              price: '',
              description: '',
            };
            attributeDataType = {
              TransportCompany: DATA_TYPE.STRING,
              startDate: DATA_TYPE.STRING,
              startTime: DATA_TYPE.STRING,
              startAddress: DATA_TYPE.STRING,
              endDate: DATA_TYPE.STRING,
              endTime: DATA_TYPE.STRING,
              endAddress: DATA_TYPE.STRING,
              image: DATA_TYPE.STRING_ARRAY,
              transportType: DATA_TYPE.STRING,
              price: DATA_TYPE.STRING,
              description: DATA_TYPE.STRING,
            };
            title = merchant;
            break;

          case 'Food':
            attributes = {
              date: dateStr,
              time: timeStr,
              address: address,
              cuisine: '',
              rating: '',
              image: [],
              restaurantName: address,
              mealType: category,
              items: '',
              description: '',
              withWho: '',
            };
            attributeDataType = {
              date: DATA_TYPE.STRING,
              time: DATA_TYPE.STRING,
              address: DATA_TYPE.STRING,
              cuisine: DATA_TYPE.STRING,
              rating: DATA_TYPE.STRING,
              image: DATA_TYPE.STRING_ARRAY,
              restaurantName: DATA_TYPE.STRING,
              mealType: DATA_TYPE.STRING,
              items: DATA_TYPE.STRING,
              description: DATA_TYPE.STRING,
              withWho: DATA_TYPE.STRING,
            };
            title = merchant || address;
            break;

          case 'Places Visited':
            attributes = {
              date: dateStr,
              time: timeStr,
              address: address,
              image: [],
              description: '',
            };
            attributeDataType = {
              date: DATA_TYPE.STRING,
              time: DATA_TYPE.STRING,
              address: DATA_TYPE.STRING,
              image: DATA_TYPE.STRING_ARRAY,
              description: DATA_TYPE.STRING,
            };
            title = merchant || address;
            break;

          default:
            continue;
        }

        await this.persistence.upsertListItem(
          list.listId,
          REC_SEQ.DEFAULT_RECORD,
          userList.userListId,
          REC_SEQ.DEFAULT_RECORD,
          listCategory?.itemCategoryId ?? null,
          REC_SEQ.DEFAULT_RECORD,
          title,
          attributes,
          attributeDataType,
          userId,
        );
      } catch (err) {
        this.loggerInstance.logger(
          `Error processing transaction: ${JSON.stringify(transaction)}`,
          err,
        );
        continue;
      }
    }
  }

  private categorizeTransaction(transaction: Transaction): {
    listType: string;
    categoryName: string;
  } {
    // Plaid V1 categories — ALWAYS present
    const primaryCategory = (
      transaction.personal_finance_category?.detailed ||
      transaction.personal_finance_category?.primary ||
      ''
    ).toLowerCase();

    const merchantName = (
      transaction.merchant_name ||
      transaction.name ||
      ''
    ).toLowerCase();
    const nameText = (transaction.name || '').toLowerCase();
    const country = (transaction.location?.country || '').toLowerCase();

    // ---------------------------
    // Transport: Airplane
    // ---------------------------
    if (
      primaryCategory.includes('flight') ||
      primaryCategory.includes('airline') ||
      merchantName.includes('airline') ||
      merchantName.includes('airlines') ||
      merchantName.includes('airways') ||
      merchantName.includes('flight') ||
      merchantName.includes('airfare') ||
      merchantName.includes('plane') ||
      nameText.includes('flight') ||
      nameText.includes('airfare') ||
      nameText.includes('airline') ||
      nameText.includes('airlines') ||
      nameText.includes('airways') ||
      merchantName.includes('delta') ||
      merchantName.includes('united') ||
      merchantName.includes('american airlines') ||
      merchantName.includes('jetblue') ||
      merchantName.includes('southwest') ||
      merchantName.includes('alaska airlines') ||
      merchantName.includes('allegiant') ||
      merchantName.includes('frontier') ||
      merchantName.includes('spirit') ||
      merchantName.includes('westjet') ||
      merchantName.includes('porter airlines') ||
      merchantName.includes('air canada') ||
      merchantName.includes('british airways') ||
      merchantName.includes('lufthansa') ||
      merchantName.includes('air france') ||
      merchantName.includes('klm') ||
      merchantName.includes('ryanair') ||
      merchantName.includes('easyjet') ||
      merchantName.includes('vueling') ||
      merchantName.includes('iberia') ||
      merchantName.includes('aer lingus') ||
      merchantName.includes('tap air') ||
      merchantName.includes('emirates') ||
      merchantName.includes('etihad') ||
      merchantName.includes('qatar airways') ||
      merchantName.includes('turkish airlines') ||
      merchantName.includes('qantas') ||
      merchantName.includes('jetstar') ||
      merchantName.includes('virgin australia') ||
      merchantName.includes('air new zealand') ||
      merchantName.includes('air india') ||
      merchantName.includes('indigo') ||
      merchantName.includes('vistara') ||
      merchantName.includes('spicejet') ||
      merchantName.includes('airasia') ||
      merchantName.includes('scoot') ||
      merchantName.includes('japan airlines') ||
      merchantName.includes('ana') ||
      merchantName.includes('singapore airlines') ||
      merchantName.includes('cathay pacific') ||
      merchantName.includes('korean air') ||
      merchantName.includes('thai airways') ||
      merchantName.includes('malaysia airlines') ||
      merchantName.includes('garuda') ||
      merchantName.includes('air china') ||
      merchantName.includes('china eastern') ||
      merchantName.includes('china southern') ||
      merchantName.includes('hainan airlines') ||
      merchantName.includes('aeromexico') ||
      merchantName.includes('latam') ||
      merchantName.includes('avianca') ||
      merchantName.includes('copa airlines') ||
      merchantName.includes('gol') ||
      merchantName.includes('azul') ||
      merchantName.includes('volaris') ||
      merchantName.includes('viva aerobus')
    ) {
      return { listType: 'Transport', categoryName: 'Airplane' };
    }

    // ---------------------------
    // Travel: Domestic vs International
    // ---------------------------
    if (
      primaryCategory.includes('travel') ||
      primaryCategory.includes('lodging') ||
      primaryCategory.includes('hotel') ||
      nameText.includes('travel') ||
      nameText.includes('trip') ||
      nameText.includes('vacation') ||
      nameText.includes('holiday') ||
      merchantName.includes('hotel') ||
      merchantName.includes('resort') ||
      merchantName.includes('motel') ||
      merchantName.includes('lodge') ||
      merchantName.includes('lodging') ||
      merchantName.includes('inn') ||
      merchantName.includes('bnb') ||
      merchantName.includes('b&b') ||
      merchantName.includes('airbnb') ||
      merchantName.includes('vrbo') ||
      merchantName.includes('homeaway') ||
      merchantName.includes('booking') ||
      merchantName.includes('booking.com') ||
      merchantName.includes('expedia') ||
      merchantName.includes('hotels.com') ||
      merchantName.includes('orbitz') ||
      merchantName.includes('priceline') ||
      merchantName.includes('kayak') ||
      merchantName.includes('skyscanner') ||
      merchantName.includes('agoda') ||
      merchantName.includes('trivago') ||
      merchantName.includes('hostelworld') ||
      merchantName.includes('trip.com') ||
      merchantName.includes('ctrip') ||
      merchantName.includes('traveloka') ||
      merchantName.includes('makemytrip') ||
      merchantName.includes('cleartrip') ||
      merchantName.includes('goibibo') ||
      merchantName.includes('yatra') ||
      merchantName.includes('marriott') ||
      merchantName.includes('hilton') ||
      merchantName.includes('hyatt') ||
      merchantName.includes('ihg') ||
      merchantName.includes('holiday inn') ||
      merchantName.includes('sheraton') ||
      merchantName.includes('westin') ||
      merchantName.includes('courtyard') ||
      merchantName.includes('ritz') ||
      merchantName.includes('four seasons') ||
      merchantName.includes('fairmont') ||
      merchantName.includes('accor') ||
      merchantName.includes('novotel') ||
      merchantName.includes('sofitel') ||
      merchantName.includes('mercure') ||
      merchantName.includes('premier inn') ||
      merchantName.includes('travelodge') ||
      merchantName.includes('oyo') ||
      merchantName.includes('treebo') ||
      merchantName.includes('travels') ||
      merchantName.includes('trip')
    ) {
      const isInternational = country && country !== 'us';
      return {
        listType: 'Travel',
        categoryName: isInternational ? 'International' : 'Domestic',
      };
    }

    // ---------------------------
    // Transport: RideShare
    // ---------------------------
    if (
      primaryCategory.includes('taxis') ||
      nameText.includes('taxi') ||
      nameText.includes('cab') ||
      nameText.includes('ride share') ||
      nameText.includes('rideshare') ||
      nameText.includes('ride-hail') ||
      merchantName.includes('uber') ||
      merchantName.includes('lyft') ||
      merchantName.includes('ola') ||
      merchantName.includes('grab') ||
      merchantName.includes('didi') ||
      merchantName.includes('careem') ||
      merchantName.includes('bolt') ||
      merchantName.includes('yandex taxi') ||
      merchantName.includes('yango') ||
      merchantName.includes('gojek') ||
      merchantName.includes('inDriver') ||
      merchantName.includes('indriver') ||
      merchantName.includes('cabify') ||
      merchantName.includes('beat') ||
      merchantName.includes('free now') ||
      merchantName.includes('freenow') ||
      merchantName.includes('gett') ||
      merchantName.includes('gettaxi') ||
      merchantName.includes('little cab') ||
      merchantName.includes('maxim') ||
      merchantName.includes('rapido')
    ) {
      return { listType: 'Transport', categoryName: 'RideShare' };
    }

    // ---------------------------
    // Transport: Public Transport
    // ---------------------------
    if (
      primaryCategory.includes('public') ||
      primaryCategory.includes('bus') ||
      primaryCategory.includes('transit') ||
      merchantName.includes('mta') ||
      merchantName.includes('bart') ||
      merchantName.includes('subway') ||
      merchantName.includes('metro') ||
      merchantName.includes('transit') ||
      merchantName.includes('bus') ||
      merchantName.includes('ferry') ||
      merchantName.includes('tram') ||
      merchantName.includes('light rail') ||
      merchantName.includes('lightrail') ||
      merchantName.includes('monorail') ||
      merchantName.includes('funicular') ||
      merchantName.includes('trolley') ||
      merchantName.includes('amtrak') ||
      merchantName.includes('metra') ||
      merchantName.includes('metrolink') ||
      merchantName.includes('caltrain') ||
      merchantName.includes('septa') ||
      merchantName.includes('nj transit') ||
      merchantName.includes('mbta') ||
      merchantName.includes('clipper') ||
      merchantName.includes('oyster') ||
      merchantName.includes('tfl') ||
      merchantName.includes('presto') ||
      merchantName.includes('opal card') ||
      merchantName.includes('myki') ||
      merchantName.includes('smartrip') ||
      merchantName.includes('sbb') ||
      merchantName.includes('db bahn') ||
      merchantName.includes('sncf') ||
      merchantName.includes('renfe') ||
      merchantName.includes('via rail') ||
      merchantName.includes('mrt') ||
      merchantName.includes('bts') ||
      merchantName.includes('smrt')
    ) {
      return { listType: 'Transport', categoryName: 'Public Transport' };
    }

    // ---------------------------
    // Transport: Car
    // ---------------------------
    if (
      primaryCategory.includes('transportation') ||
      primaryCategory.includes('parking') ||
      primaryCategory.includes('tolls') ||
      merchantName.includes('gas') ||
      merchantName.includes('fuel') ||
      merchantName.includes('parking') ||
      merchantName.includes('toll') ||
      merchantName.includes('shell') ||
      merchantName.includes('exxon') ||
      merchantName.includes('chevron') ||
      merchantName.includes('bp') ||
      merchantName.includes('hertz') ||
      merchantName.includes('avis') ||
      merchantName.includes('enterprise') ||
      merchantName.includes('marathon') ||
      merchantName.includes('sunoco') ||
      merchantName.includes('citgo') ||
      merchantName.includes('conoco') ||
      merchantName.includes('phillips 66') ||
      merchantName.includes('valero') ||
      merchantName.includes('costco gas') ||
      merchantName.includes('petrol') ||
      merchantName.includes('diesel') ||
      merchantName.includes('car wash') ||
      merchantName.includes('valet') ||
      merchantName.includes('garage') ||
      merchantName.includes('jiffy lube') ||
      merchantName.includes('firestone') ||
      merchantName.includes('goodyear') ||
      merchantName.includes('pep boys') ||
      merchantName.includes('midas') ||
      merchantName.includes('ntb') ||
      merchantName.includes('les schwab') ||
      merchantName.includes('budget') ||
      merchantName.includes('national car rental') ||
      merchantName.includes('alamo') ||
      merchantName.includes('thrifty') ||
      merchantName.includes('dollar rent a car') ||
      merchantName.includes('sixt') ||
      merchantName.includes('turo') ||
      merchantName.includes('getaround') ||
      merchantName.includes('zipcar') ||
      merchantName.includes('chargepoint') ||
      merchantName.includes('evgo') ||
      merchantName.includes('electrify america') ||
      merchantName.includes('supercharger') ||
      merchantName.includes('tesla supercharger')
    ) {
      return { listType: 'Transport', categoryName: 'Car' };
    }

    // ---------------------------
    // Transport: Train
    // ---------------------------
    if (
      primaryCategory.includes('train') ||
      primaryCategory.includes('railway') ||
      primaryCategory.includes('railroad') ||
      merchantName.includes('train') ||
      merchantName.includes('rail') ||
      merchantName.includes('railway') ||
      merchantName.includes('railroad') ||
      merchantName.includes('subway') ||
      merchantName.includes('underground') ||
      merchantName.includes('tube') ||
      merchantName.includes('tram') ||
      merchantName.includes('light rail transit') ||
      merchantName.includes('mass rapid transit') ||
      merchantName.includes('metro rail') ||
      merchantName.includes('high speed rail') ||
      merchantName.includes('bullet train') ||
      merchantName.includes('amtrak') ||
      merchantName.includes('metrolink') ||
      merchantName.includes('caltrain') ||
      merchantName.includes('go transit') ||
      merchantName.includes('metro north railroad') ||
      merchantName.includes('long island rail road') ||
      merchantName.includes('chicago transit authority') ||
      merchantName.includes('bay area rapid transit') ||
      merchantName.includes('massachusetts bay transportation authority') ||
      merchantName.includes(
        'southeastern pennsylvania transportation authority',
      ) ||
      merchantName.includes('denver regional transportation district') ||
      merchantName.includes('washington metropolitan area transit authority') ||
      merchantName.includes('national rail') ||
      merchantName.includes('thameslink') ||
      merchantName.includes('southern rail') ||
      merchantName.includes('great western railway') ||
      merchantName.includes('london north eastern railway') ||
      merchantName.includes('avanti west coast') ||
      merchantName.includes('northern rail') ||
      merchantName.includes('scotrail') ||
      merchantName.includes('transpennine express') ||
      merchantName.includes('east midlands railway') ||
      merchantName.includes('west midlands railway') ||
      merchantName.includes('c2c rail') ||
      merchantName.includes('merseyrail') ||
      merchantName.includes('chiltern railways') ||
      merchantName.includes('heathrow express') ||
      merchantName.includes('gatwick express') ||
      merchantName.includes('elizabeth line') ||
      merchantName.includes('london overground') ||
      merchantName.includes('london underground') ||
      merchantName.includes('docklands light railway')
    ) {
      return { listType: 'Transport', categoryName: 'Train' };
    }

    // ---------------------------
    // Places Visited: Grocery Stores
    // ---------------------------
    if (
      primaryCategory.includes('grocery') ||
      merchantName.includes('grocery') ||
      merchantName.includes('grocer') ||
      merchantName.includes('supermarket') ||
      merchantName.includes('market') ||
      merchantName.includes('food market') ||
      merchantName.includes('farmers market') ||
      merchantName.includes('walmart') ||
      merchantName.includes('target') ||
      merchantName.includes('safeway') ||
      merchantName.includes('kroger') ||
      merchantName.includes('whole foods') ||
      merchantName.includes('trader joe') ||
      merchantName.includes("trader joe's") ||
      merchantName.includes('costco') ||
      merchantName.includes('sams club') ||
      merchantName.includes("sam's club") ||
      merchantName.includes('bjs') ||
      merchantName.includes("bj's") ||
      merchantName.includes('aldi') ||
      merchantName.includes('lidl') ||
      merchantName.includes('publix') ||
      merchantName.includes('meijer') ||
      merchantName.includes('heb') ||
      merchantName.includes('h-e-b') ||
      merchantName.includes('winco') ||
      merchantName.includes('food lion') ||
      merchantName.includes('giant') ||
      merchantName.includes('stop & shop') ||
      merchantName.includes('stop and shop') ||
      merchantName.includes('shoprite') ||
      merchantName.includes('ralphs') ||
      merchantName.includes('vons') ||
      merchantName.includes('pavilions') ||
      merchantName.includes('wegmans') ||
      merchantName.includes('sprouts') ||
      merchantName.includes('fresh thyme') ||
      merchantName.includes('shaws') ||
      merchantName.includes('star market') ||
      merchantName.includes('harris teeter') ||
      merchantName.includes('save mart') ||
      merchantName.includes('food4less') ||
      merchantName.includes('food 4 less') ||
      merchantName.includes('99 ranch') ||
      merchantName.includes('hmart') ||
      merchantName.includes('h mart') ||
      merchantName.includes('asian market') ||
      merchantName.includes('indian grocery') ||
      merchantName.includes('desi bazaar')
    ) {
      return { listType: 'Places Visited', categoryName: 'Grocery Stores' };
    }

    // ---------------------------
    // Places Visited: Online Store
    // ---------------------------
    if (
      primaryCategory.includes('online') ||
      primaryCategory.includes('ecommerce') ||
      primaryCategory.includes('marketplace') ||
      merchantName.includes('amazon') ||
      merchantName.includes('prime') ||
      merchantName.includes('amazon marketplace') ||
      merchantName.includes('ebay') ||
      merchantName.includes('etsy') ||
      merchantName.includes('alibaba') ||
      merchantName.includes('aliexpress') ||
      merchantName.includes('rakuten') ||
      merchantName.includes('flipkart') ||
      merchantName.includes('jd.com') ||
      merchantName.includes('shein') ||
      merchantName.includes('temu') ||
      merchantName.includes('wish') ||
      merchantName.includes('wish.com') ||
      merchantName.includes('vinted') ||
      merchantName.includes('poshmark') ||
      merchantName.includes('stockx') ||
      merchantName.includes('goat') ||
      merchantName.includes('wayfair') ||
      merchantName.includes('overstock') ||
      merchantName.includes('newegg') ||
      merchantName.includes('bhphotovideo') ||
      merchantName.includes('b&h photo') ||
      merchantName.includes('zappos') ||
      merchantName.includes('asos') ||
      merchantName.includes('boohoo') ||
      merchantName.includes('zalando') ||
      merchantName.includes('instacart') ||
      merchantName.includes('doordash') ||
      merchantName.includes('uber eats') ||
      merchantName.includes('grubhub') ||
      merchantName.includes('shipt') ||
      merchantName.includes('online store') ||
      merchantName.includes('web store') ||
      merchantName.includes('e-shop') ||
      merchantName.includes('eshop')
    ) {
      return { listType: 'Places Visited', categoryName: 'Online Stores' };
    }

    // ---------------------------
    // Places Visited: Retail Store
    // ---------------------------
    if (
      primaryCategory.includes('retail') ||
      primaryCategory.includes('department store') ||
      merchantName.includes('mall') ||
      merchantName.includes('shopping center') ||
      merchantName.includes('shopping mall') ||
      merchantName.includes('walmart') ||
      merchantName.includes('target') ||
      merchantName.includes('costco') ||
      merchantName.includes('sams club') ||
      merchantName.includes("sam's club") ||
      merchantName.includes('bj') ||
      merchantName.includes("bj's") ||
      merchantName.includes('best buy') ||
      merchantName.includes('micro center') ||
      merchantName.includes("fry's electronics") ||
      merchantName.includes('home depot') ||
      merchantName.includes('lowes') ||
      merchantName.includes("lowe's") ||
      merchantName.includes('ace hardware') ||
      merchantName.includes('menards') ||
      merchantName.includes('macy') ||
      merchantName.includes('nordstrom') ||
      merchantName.includes('bloomingdale') ||
      merchantName.includes('saks fifth') ||
      merchantName.includes('dillards') ||
      merchantName.includes('jcpenny') ||
      merchantName.includes('jc penny') ||
      merchantName.includes('old navy') ||
      merchantName.includes('gap') ||
      merchantName.includes('banana republic') ||
      merchantName.includes('h&m') ||
      merchantName.includes('forever 21') ||
      merchantName.includes('uniqlo') ||
      merchantName.includes('zara') ||
      merchantName.includes('express') ||
      merchantName.includes('urban outfitters') ||
      merchantName.includes('tj maxx') ||
      merchantName.includes('t.j.maxx') ||
      merchantName.includes('marshall') ||
      merchantName.includes('ross dress') ||
      merchantName.includes('burlington') ||
      merchantName.includes('big lots') ||
      merchantName.includes('dollar general') ||
      merchantName.includes('dollar tree') ||
      merchantName.includes('family dollar') ||
      merchantName.includes('five below') ||
      merchantName.includes('sephora') ||
      merchantName.includes('ulta') ||
      merchantName.includes('bath & body works') ||
      merchantName.includes('bed bath & beyond') ||
      merchantName.includes('staples') ||
      merchantName.includes('office depot') ||
      merchantName.includes('office max') ||
      merchantName.includes('ikea') ||
      merchantName.includes('petco') ||
      merchantName.includes('petsmart') ||
      merchantName.includes('game stop') ||
      merchantName.includes('gamestop') ||
      merchantName.includes('party city')
    ) {
      return { listType: 'Places Visited', categoryName: 'Retail Store' };
    }

    // ---------------------------
    // Places Visited: Parks
    // ---------------------------
    if (
      merchantName.includes('park') ||
      nameText.includes('park') ||
      merchantName.includes('zoo') ||
      nameText.includes('zoo') ||
      merchantName.includes('aquarium') ||
      merchantName.includes('botanical') ||
      merchantName.includes('botanic') ||
      merchantName.includes('garden') ||
      merchantName.includes('arboretum') ||
      merchantName.includes('nature reserve') ||
      merchantName.includes('wildlife') ||
      merchantName.includes('sanctuary') ||
      merchantName.includes('safari') ||
      merchantName.includes('trail') ||
      merchantName.includes('hiking') ||
      merchantName.includes('forest') ||
      merchantName.includes('beach park') ||
      nameText.includes('botanical') ||
      nameText.includes('botanic') ||
      nameText.includes('garden') ||
      nameText.includes('arboretum') ||
      nameText.includes('nature reserve') ||
      nameText.includes('wildlife') ||
      nameText.includes('sanctuary') ||
      nameText.includes('safari') ||
      nameText.includes('trail') ||
      nameText.includes('hiking') ||
      nameText.includes('forest') ||
      nameText.includes('beach park')
    ) {
      return { listType: 'Places Visited', categoryName: 'Parks' };
    }

    // ---------------------------
    // Places Visited: Museums
    // ---------------------------
    if (
      merchantName.includes('museum') ||
      nameText.includes('museum') ||
      merchantName.includes('gallery') ||
      nameText.includes('gallery') ||
      merchantName.includes('planetarium') ||
      nameText.includes('planetarium') ||
      merchantName.includes('observatory') ||
      nameText.includes('observatory') ||
      merchantName.includes('science center') ||
      merchantName.includes('science centre') ||
      nameText.includes('science center') ||
      nameText.includes('science centre') ||
      merchantName.includes('history center') ||
      merchantName.includes('history centre') ||
      nameText.includes('history center') ||
      nameText.includes('history centre') ||
      merchantName.includes('heritage') ||
      nameText.includes('heritage') ||
      merchantName.includes('exhibit') ||
      merchantName.includes('exhibition') ||
      nameText.includes('exhibit') ||
      nameText.includes('exhibition')
    ) {
      return { listType: 'Places Visited', categoryName: 'Museums' };
    }

    // ---------------------------
    // Places Visited: Friends Homes
    // ---------------------------
    if (
      merchantName.includes('friend') ||
      nameText.includes('friend') ||
      merchantName.includes('home') ||
      nameText.includes('home') ||
      merchantName.includes('residential') ||
      nameText.includes('residential') ||
      merchantName.includes('apt') ||
      merchantName.includes('apartment') ||
      merchantName.includes('condo') ||
      merchantName.includes('flat') ||
      merchantName.includes('unit') ||
      merchantName.includes('suite') ||
      nameText.includes('apt') ||
      nameText.includes('apartment') ||
      nameText.includes('condo') ||
      nameText.includes('flat') ||
      nameText.includes('unit') ||
      nameText.includes('suite')
    ) {
      return { listType: 'Places Visited', categoryName: 'Friends Homes' };
    }

    // ---------------------------
    // Food: Coffee Shops
    // ---------------------------
    const hour = transaction.datetime
      ? new Date(transaction.datetime).getHours()
      : undefined;

    const foodMatch = FOOD_KEYWORDS.some(
      (keyword) => nameText.includes(keyword) || merchantName.includes(keyword),
    );

    if (
      primaryCategory.includes('coffee') ||
      nameText.includes('coffee') ||
      merchantName.includes('coffee') ||
      merchantName.includes('cafe') ||
      merchantName.includes('cafè') ||
      merchantName.includes('café') ||
      merchantName.includes('espresso') ||
      merchantName.includes('latte') ||
      merchantName.includes('mocha') ||
      merchantName.includes('brew') ||
      merchantName.includes('roast') ||
      merchantName.includes('roastery') ||
      merchantName.includes('barista') ||
      merchantName.includes('bean') ||
      merchantName.includes('coffeehouse') ||
      merchantName.includes('tea house') ||
      merchantName.includes('tea shop') ||
      merchantName.includes('starbucks') ||
      merchantName.includes('dunkin') ||
      merchantName.includes('dunkin donuts') ||
      merchantName.includes('peet') ||
      merchantName.includes('tim hortons') ||
      merchantName.includes('dutch bros') ||
      merchantName.includes('biggby') ||
      merchantName.includes('caribou coffee') ||
      merchantName.includes('nero') ||
      merchantName.includes('pret a manger') ||
      merchantName.includes('gloria jeans') ||
      merchantName.includes('coffee bean') ||
      merchantName.includes('coffee club') ||
      merchantName.includes('illy') ||
      merchantName.includes('lavazza') ||
      merchantName.includes('paul bakery') ||
      merchantName.includes('brewery cafe') ||
      merchantName.includes('coffee bar') ||
      merchantName.includes('coffee spot') ||
      merchantName.includes('java') ||
      merchantName.includes('joe') ||
      merchantName.includes('cup') ||
      merchantName.includes('beanery')
    ) {
      return { listType: 'Food', categoryName: 'Coffee Shops' };
    }

    // ---------------------------
    // Food: Sweet Treat
    // ---------------------------
    if (
      merchantName.includes('ice cream') ||
      merchantName.includes('dessert') ||
      merchantName.includes('bakery') ||
      merchantName.includes('pastry') ||
      merchantName.includes('candy') ||
      merchantName.includes('donut') ||
      merchantName.includes('chocolate') ||
      merchantName.includes('cake') ||
      merchantName.includes('gelato') ||
      merchantName.includes('patisserie') ||
      merchantName.includes('confectionery') ||
      merchantName.includes('sweets') ||
      merchantName.includes('cupcake') ||
      merchantName.includes('cookie') ||
      merchantName.includes('brownie') ||
      merchantName.includes('tart') ||
      merchantName.includes('mousse') ||
      merchantName.includes('macaron') ||
      merchantName.includes('macaroon') ||
      merchantName.includes('doughnut')
    ) {
      return { listType: 'Food', categoryName: 'Sweet Treat' };
    }

    // ---------------------------
    // Food: Drinks
    // ---------------------------
    if (
      merchantName.includes('bar') ||
      merchantName.includes('pub') ||
      merchantName.includes('brew') ||
      merchantName.includes('brewery') ||
      merchantName.includes('brewing') ||
      merchantName.includes('beer') ||
      merchantName.includes('ale') ||
      merchantName.includes('lager') ||
      merchantName.includes('stout') ||
      merchantName.includes('ipa') ||
      merchantName.includes('cocktail') ||
      merchantName.includes('cocktails') ||
      merchantName.includes('speakeasy') ||
      merchantName.includes('tavern') ||
      merchantName.includes('wine') ||
      merchantName.includes('wine bar') ||
      merchantName.includes('winery') ||
      merchantName.includes('liquor') ||
      merchantName.includes('spirits') ||
      merchantName.includes('distillery') ||
      merchantName.includes('taproom') ||
      merchantName.includes('microbrew') ||
      merchantName.includes('microbrewery') ||
      merchantName.includes('draft') ||
      merchantName.includes('draught') ||
      merchantName.includes('bottle shop') ||
      merchantName.includes('sake') ||
      merchantName.includes('soju') ||
      merchantName.includes('mead') ||
      merchantName.includes('cider') ||
      merchantName.includes('cidery') ||
      merchantName.includes('happy hour')
    ) {
      return { listType: 'Food', categoryName: 'Drinks' };
    }

    // ---------------------------
    // Food: Breakfast, Lunch, Dinner
    // ---------------------------
    if (foodMatch) {
      // Breakfast: 4 AM – 12 PM
      if (hour !== undefined && hour >= 4 && hour < 12) {
        return { listType: 'Food', categoryName: 'Breakfast' };
      }

      // Lunch: 12 PM – 4 PM
      if (hour !== undefined && hour >= 12 && hour < 16) {
        return { listType: 'Food', categoryName: 'Lunch' };
      }

      // Dinner: 4 PM – 4 AM
      if (hour !== undefined && hour >= 16 && hour < 4) {
        return { listType: 'Food', categoryName: 'Dinner' };
      }

      // If hour is missing or outside typical ranges
      return { listType: 'Food', categoryName: 'Unknown' };
    }

    // DEFAULT — ensure we ALWAYS return something
    return { listType: 'Uncategorized', categoryName: 'Other' };
  }

  async disconnect(userId: string): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Disconnecting Plaid',
      data: {
        service: PlaidProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });

    try {
      // Get the access token before deletion
      const tokens = await this.tokens.get(userId, 'plaid');

      if (tokens?.accessToken) {
        // Remove the item from Plaid
        // This revokes the access token and removes the item
        try {
          await this.getPlaidClient().itemRemove({
            access_token: tokens.accessToken,
          });
          this.loggerInstance.logger(LogType.INFO, {
            message: 'Successfully removed Plaid item',
            data: {
              service: PlaidProvider.name,
              method: MethodNames.disconnect,
              userId,
              provider: this.name,
            },
          });
        } catch (error) {
          // Log but don't throw - token might already be invalid or item removed
          this.loggerInstance.logger(LogType.ERROR, {
            message: 'Failed to remove Plaid item',
            data: {
              service: PlaidProvider.name,
              method: MethodNames.disconnect,
              userId,
              provider: this.name,
            },
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Delete stored tokens
      await this.tokens.delete(userId, 'plaid');

      // Update user integration status to DISCONNECTED
      const integration = await this.persistence.ensureIntegration('plaid');
      const link = await this.db.userIntegrations.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId: integration.integrationId,
          integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        },
      });

      if (link) {
        await this.db.userIntegrations.update({
          where: {
            userIntegrationId_recSeq: {
              userIntegrationId: link.userIntegrationId,
              recSeq: link.recSeq,
            },
          },
          data: { status: STATUS.DISCONNECTED },
        });
      }
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Error during Plaid disconnect',
        data: {
          service: PlaidProvider.name,
          method: MethodNames.disconnect,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow disconnect to continue even if item removal fails
    }

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Plaid disconnect completed',
      data: {
        service: PlaidProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });
  }
}
