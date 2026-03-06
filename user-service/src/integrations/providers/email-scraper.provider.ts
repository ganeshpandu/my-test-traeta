import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TechvLogger } from 'techvedika-logger';
import {
  IntegrationProvider,
  IntegrationProviderName,
  ConnectResponse,
  CallbackPayload,
} from '../types';
import { URLSearchParams } from 'url';
import { IntegrationPersistence } from '../persistence';
import { PrismaService } from '@traeta/prisma';
import { TokenStore } from '../token-store';
import { google } from 'googleapis';
import axios from 'axios';
import {
  ConfigurationException,
  InvalidCallbackException,
  InvalidTokenException,
  DataSyncException,
  ProviderAPIException,
  RateLimitException,
  OAuthAuthenticationException,
} from '../exceptions/integration.exceptions';
import {
  REC_SEQ,
  LogType,
  MethodNames,
  KNOWN_SENDERS,
  PROMOTIONAL_KEYWORDS,
  PROMOTIONAL_SENDER_PATTERNS,
  ListNames,
} from '../../../constants';
import { convert } from 'html-to-text';
import { EmailParserService } from './email-parser';
import { LlmService } from './llm-service';

@Injectable()
export class EmailScraperProvider implements IntegrationProvider {
  public readonly name = IntegrationProviderName.GMAIL_SCRAPER;

  constructor(
    private readonly db: PrismaService,
    private readonly persistence: IntegrationPersistence,
    private readonly tokens: TokenStore,
    private readonly configService: ConfigService,
    private readonly loggerInstance: TechvLogger,
    private readonly emailParser: EmailParserService,
    private readonly llmService: LlmService,
  ) { }

  private readonly METADATA_SCOPE =
    'https://www.googleapis.com/auth/gmail.metadata';

  private getGoogleClientId(): string {
    return (
      this.configService.get<string>('GMAIL_CLIENT_ID') ||
      this.configService.get<string>('GOOGLE_CLIENT_ID') ||
      ''
    );
  }

  private getGoogleClientSecret(): string {
    return (
      this.configService.get<string>('GMAIL_CLIENT_SECRET') ||
      this.configService.get<string>('GOOGLE_CLIENT_SECRET') ||
      ''
    );
  }

  private getGoogleRedirectUri(): string {
    return (
      this.configService.get<string>('GMAIL_REDIRECT_URI') ||
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      ''
    );
  }

  private getDefaultDays(): number {
    const days = this.configService.get<string>('GMAIL_DEFAULT_DAYS');
    return days ? Number(days) : 45;
  }

  private extractPlainText(html: string): string {
    if (!html) return '';
    try {
      return convert(html, {
        wordwrap: false,
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'a', options: { ignoreHref: true } },
        ],
      }).trim();
    } catch (e) {
      return html; // fallback if conversion fails
    }
  }

  async createConnection(userId: string): Promise<ConnectResponse> {
    // Validate configuration
    const clientId = this.getGoogleClientId();
    const clientSecret = this.getGoogleClientSecret();
    const redirectUri = this.getGoogleRedirectUri();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ConfigurationException(
        IntegrationProviderName.GMAIL_SCRAPER,
        'Missing required Gmail OAuth configuration (CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI)',
      );
    }

    try {
      const state = `email-${userId}-${Date.now()}`;
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: `${this.METADATA_SCOPE} openid email profile`,
        access_type: 'offline',
        prompt: 'consent',
        state,
      });
      const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      await this.persistence.ensureIntegration(this.name);
      return { provider: this.name, redirectUrl, state };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to create Gmail connection',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.createConnection,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ConfigurationException) {
        throw error;
      }

      throw new ConfigurationException(
        IntegrationProviderName.GMAIL_SCRAPER,
        `Failed to initialize Gmail connection: ${error.message}`,
      );
    }
  }

  async handleCallback(payload: CallbackPayload): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Email scraper callback received',
      data: {
        service: EmailScraperProvider.name,
        method: MethodNames.handleCallback,
        provider: this.name,
      },
    });
    const { code, state, error } = payload;

    if (error) {
      throw new OAuthAuthenticationException(
        IntegrationProviderName.GMAIL_SCRAPER,
        `Gmail OAuth error: ${error}`,
      );
    }

    if (!code || !state) {
      throw new InvalidCallbackException(
        IntegrationProviderName.GMAIL_SCRAPER,
        'Missing required callback parameters: code or state',
      );
    }

    // Extract userId from state format: "email-<userId>-<ts>"
    // Remove "email-" prefix and "-<timestamp>" suffix
    const stateStr = String(state);
    const stateWithoutPrefix = stateStr.replace(/^email-/, '');
    const lastDashIndex = stateWithoutPrefix.lastIndexOf('-');
    const userId =
      lastDashIndex > 0
        ? stateWithoutPrefix.substring(0, lastDashIndex)
        : stateWithoutPrefix;
    if (!userId) {
      throw new InvalidCallbackException(
        IntegrationProviderName.GMAIL_SCRAPER,
        'Invalid state format: unable to extract userId',
      );
    }

    try {
      // Exchange authorization code for tokens
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const clientId = this.getGoogleClientId();
      const clientSecret = this.getGoogleClientSecret();
      const redirectUri = this.getGoogleRedirectUri();

      const tokenResponse = await axios.post(
        tokenUrl,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokenData = tokenResponse.data;
      const grantedScopes = tokenData.scope || '';

      if (!grantedScopes.includes(this.METADATA_SCOPE)) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Required Gmail permission missing in token response',
          data: {
            service: EmailScraperProvider.name,
            method: MethodNames.handleCallback,
            userId,
            grantedScopes,
          },
        });
        throw new OAuthAuthenticationException(
          IntegrationProviderName.GMAIL_SCRAPER,
          'Gmail is not connected. Required Gmail permission was not granted.',
        );
      }

      if (
        grantedScopes.includes('https://www.googleapis.com/auth/gmail.readonly')
      ) {
        this.loggerInstance.logger(LogType.WARN, {
          message: 'Gmail readonly scope detected',
          data: {
            service: EmailScraperProvider.name,
            method: MethodNames.handleCallback,
            userId,
            grantedScopes,
          },
        });

        await this.tokens.delete(userId, this.name);
        await this.persistence.markDisconnected(userId, this.name);

        throw new OAuthAuthenticationException(
          this.name,
          'Permissions mismatched. Clear your browser cache and try again.',
        );
      }
      const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      // Get user profile
      const userProfile = await this.fetchUserProfile(tokenData.access_token);

      // Store tokens
      await this.tokens.set(userId, this.name, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        scope: tokenData.scope,
        providerUserId: userProfile.email,
      });

      // Mark as connected
      const integration =
        await this.persistence.ensureIntegration(this.name);
      await this.persistence.markConnected(userId, integration.integrationId);

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Gmail connected successfully',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.handleCallback,
          userId,
          provider: this.name,
        },
      });

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Queuing automatic sync after Gmail connection',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.handleCallback,
          userId,
          provider: this.name,
        },
      });

      this.syncInBackground(userId);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to handle Gmail callback',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.handleCallback,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw custom exceptions
      if (
        error instanceof InvalidCallbackException ||
        error instanceof OAuthAuthenticationException
      ) {
        throw error;
      }

      // Handle Axios errors
      if (error.response) {
        const status = error.response.status;
        const errorMessage =
          error.response.data?.error_description ||
          error.response.data?.error ||
          error.message;

        if (status === 400 || status === 401) {
          throw new OAuthAuthenticationException(
            IntegrationProviderName.GMAIL_SCRAPER,
            `Gmail authentication failed: ${errorMessage}`,
          );
        }
      }

      throw new InvalidCallbackException(
        IntegrationProviderName.GMAIL_SCRAPER,
        `Failed to process Gmail callback: ${error.message}`,
      );
    }
  }

  private async ensureValidAccessToken(userId: string): Promise<string> {
    const existing = await this.tokens.get(userId, this.name);
    if (!existing) {
      throw new InvalidTokenException(IntegrationProviderName.GMAIL_SCRAPER);
    }
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Found existing Gmail tokens',
      data: {
        service: EmailScraperProvider.name,
        method: 'ensureValidAccessToken',
        userId,
        hasRefreshToken: !!existing.refreshToken,
        existing: existing,
      },
    });

    // STEP 2: Force re-consent for existing users with restricted scopes
    if (existing.scope && !existing.scope.includes(this.METADATA_SCOPE)) {
      this.loggerInstance.logger(LogType.WARN, {
        message:
          'Restricted Gmail scope detected. Deleting token and forcing re-consent.',
        data: {
          service: EmailScraperProvider.name,
          method: 'ensureValidAccessToken',
          userId,
          existingScope: existing.scope,
        },
      });

      // PROACTIVE: Delete the token so we no longer store restricted scopes
      await this.tokens.delete(userId, this.name);
      await this.persistence.markDisconnected(userId, this.name);

      throw new InvalidTokenException(
        IntegrationProviderName.GMAIL_SCRAPER,
        'Your connection uses outdated permissions. Please reconnect your Gmail account for security compliance.',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (existing.expiresAt && existing.expiresAt - now > 60) {
      return existing.accessToken; // Still valid
    }

    if (!existing.refreshToken) {
      throw new InvalidTokenException(IntegrationProviderName.GMAIL_SCRAPER);
    }

    try {
      // Refresh the token
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const clientId = this.getGoogleClientId();
      const clientSecret = this.getGoogleClientSecret();

      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: existing.refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokenData = response.data;
      const newExpiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      // Update stored tokens
      await this.tokens.set(userId, this.name, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || existing.refreshToken,
        expiresAt: newExpiresAt,
        scope: existing.scope,
        providerUserId: existing.providerUserId,
      });

      return tokenData.access_token;
    } catch (error) {
      if (error.response?.status === 400 || error.response?.status === 401) {
        throw new InvalidTokenException(IntegrationProviderName.GMAIL_SCRAPER);
      }
      throw error;
    }
  }

  async sync(
    userId: string,
  ): Promise<{ ok: boolean; syncedAt?: Date; details?: any }> {
    const integration =
      await this.persistence.ensureIntegration(this.name);

    // Debug: Check what lastSyncedAt returns
    const lastSyncedAt = await this.persistence.getLastSyncedAt(
      userId,
      integration.integrationId,
    );
    const defaultDays = this.getDefaultDays();
    const defaultDate = new Date(
      Date.now() - defaultDays * 24 * 60 * 60 * 1000,
    );

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Email scraper sync initialization',
      data: {
        service: EmailScraperProvider.name,
        method: MethodNames.sync,
        userId,
        provider: this.name,
        lastSyncedAt: lastSyncedAt?.toString() || 'null',
        defaultDate: defaultDate.toString(),
        defaultDays,
        isIncremental: !!lastSyncedAt,
      },
    });

    // Use lastSyncedAt from DB if available, otherwise use default (45 days ago)
    // const sinceDate = lastSyncedAt || defaultDate;

    // Add a 10-minute overlap to ensure we don't miss emails that arrived
    // exactly at the time of the last sync.
    const sinceDate = lastSyncedAt
      ? new Date(lastSyncedAt.getTime() - 10 * 60 * 1000)
      : defaultDate;

    try {
      const accessToken = await this.ensureValidAccessToken(userId);

      // Initialize Gmail API
      const gmail = google.gmail({ version: 'v1' });
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      // Fetch ALL emails and categorize them intelligently
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Fetching and processing emails one by one',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
          since: sinceDate.toString(),
        },
      });

      const syncResult = await this.fetchEmailsByQuery(
        gmail,
        auth,
        'in:inbox category:primary',
        sinceDate,
        userId,
      );

      const {
        totalFetched,
        promotionalFiltered,
        nonPromotional,
        processed,
        skipped,
        mostRecentDate,
      } = syncResult;

      // Mark as synced with the most recent email date
      const mostRecentEmailDate =
        mostRecentDate.getTime() > 0 ? mostRecentDate : new Date();

      const link = await this.db.userIntegrations.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId: integration.integrationId,
          integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        },
      });

      if (link) {
        await this.persistence.markSynced(
          link.userIntegrationId,
          mostRecentEmailDate,
        );
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Email scraper sync completed',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
          totalProcessed: processed,
          totalSkipped: skipped,
          totalEmailsFetched: totalFetched,
          totalPromotionalFiltered: promotionalFiltered,
          totalNonPromotionalEmails: nonPromotional,
        },
      });

      return {
        ok: true,
        syncedAt: mostRecentEmailDate,
        details: {
          totalProcessed: processed,
          totalSkipped: skipped,
          totalEmailsFetched: totalFetched,
          totalPromotionalFiltered: promotionalFiltered,
          totalNonPromotionalEmails: nonPromotional,
          since: sinceDate,
          nextSyncFrom: mostRecentEmailDate,
        },
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Email scraper sync failed',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw custom exceptions
      if (
        error instanceof InvalidTokenException ||
        error instanceof DataSyncException ||
        error instanceof ProviderAPIException ||
        error instanceof RateLimitException
      ) {
        throw error;
      }

      // Handle Gmail API errors
      if (error.response) {
        const status = error.response.status;
        const errorMessage =
          error.response.data?.error?.message || error.message;

        if (status === 401 || status === 403) {
          throw new InvalidTokenException(
            IntegrationProviderName.GMAIL_SCRAPER,
          );
        } else if (status === 429) {
          throw new RateLimitException(IntegrationProviderName.GMAIL_SCRAPER);
        } else if (status >= 500) {
          throw new ProviderAPIException(
            IntegrationProviderName.GMAIL_SCRAPER,
            `Gmail API error: ${errorMessage}`,
          );
        }
      }

      // Generic fallback
      throw new DataSyncException(
        IntegrationProviderName.GMAIL_SCRAPER,
        `Failed to sync Gmail data: ${error.message}`,
      );
    }
  }

  async status(userId: string): Promise<{
    connected: boolean;
    lastSyncedAt?: Date | null;
    details?: any;
  }> {
    const integration =
      await this.persistence.ensureIntegration(this.name);
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

    // Check if tokens are still valid
    const tokens = await this.tokens.get(userId, this.name);

    return {
      connected:
        !!link && (link.status === 'CONNECTED' || link.status === 'SYNCING'),
      lastSyncedAt: history?.lastSyncedAt ?? null,
      details: {},
    };
  }

  private async fetchUserProfile(
    accessToken: string,
  ): Promise<{ email: string; name: string }> {
    const response = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return {
      email: response.data.email,
      name: response.data.name,
    };
  }

  private async fetchEmailsByQuery(
    gmail: any,
    auth: any,
    query: string,
    since: Date,
    userId: string,
  ): Promise<{
    totalFetched: number;
    promotionalFiltered: number;
    nonPromotional: number;
    processed: number;
    skipped: number;
    mostRecentDate: Date;
  }> {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Executing Gmail sync with metadata scope',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.sync,
          sinceDate: since.toISOString(),
          provider: this.name,
        },
      });

      let nextPageToken: string | undefined = undefined;
      let totalFetched = 0;
      let promotionalFiltered = 0;
      let nonPromotional = 0;
      let processed = 0;
      let skipped = 0;
      let mostRecentDate = new Date(0);
      let stopPagination = false;

      // ---- PAGINATION LOOP ----
      do {
        this.loggerInstance.logger(LogType.INFO, {
          message: `[EmailScraper] Querying Gmail with labels: INBOX, pageToken: ${nextPageToken || 'none'}`,
          data: {
            service: EmailScraperProvider.name,
            method: MethodNames.sync,
            pageToken: nextPageToken || 'none',
            provider: this.name,
          },
        });

        // Metadata scope doesn't support 'q' parameter in list() effectively for date filtering
        const searchResponse = await gmail.users.messages.list({
          auth,
          userId: 'me',
          labelIds: ['INBOX'],
          maxResults: 100, // Process in chunks
          pageToken: nextPageToken,
        });

        const messages = searchResponse.data.messages || [];
        totalFetched += messages.length;

        for (const message of messages) {
          try {
            const messageResponse = await gmail.users.messages.get({
              auth,
              userId: 'me',
              id: message.id,
              format: 'metadata',
            });

            const internalDate = new Date(
              Number(messageResponse.data.internalDate),
            );

            // 🔥 EARLY EXIT POINT (Scalability fix)
            if (internalDate < since) {
              this.loggerInstance.logger(LogType.INFO, {
                message: `[EmailScraper] Reached emails older than ${since.toISOString()}, stopping pagination`,
                data: {
                  service: EmailScraperProvider.name,
                  method: MethodNames.sync,
                  userId,
                  emailDate: internalDate.toISOString(),
                },
              });
              stopPagination = true;
              break;
            }

            const labelIds =
              messageResponse.data.labelIds || message.labelIds || [];

            this.loggerInstance.logger(LogType.INFO, {
              message: `[EmailScraper] Found labels for email ${message.id}`,
              data: {
                service: EmailScraperProvider.name,
                method: MethodNames.sync,
                userId,
                emailId: message.id,
                labelIds,
              },
            });

            const emailInfo = this.emailParser.parseEmailMessage(
              messageResponse.data,
              labelIds,
            );

            if (!emailInfo) {
              continue;
            }

            if (emailInfo.date && emailInfo.date > mostRecentDate) {
              mostRecentDate = emailInfo.date;
            }

            // ---- FILTER PRIMARY (PERSONAL, UPDATES, or no category) ----
            const labels = emailInfo.labels;

            const hasOtherCategory = labels.some((l) =>
              [
                'CATEGORY_SOCIAL',
                'CATEGORY_PROMOTIONS',
                'CATEGORY_FORUMS',
              ].includes(l),
            );

            const isPrimary =
              labels.includes('CATEGORY_PERSONAL') ||
              labels.includes('CATEGORY_UPDATES') ||
              !hasOtherCategory;

            if (!isPrimary) {
              continue;
            }

            // ---- PROMOTIONAL FILTER ----
            if (
              this.isPromotionalEmail(
                emailInfo.from,
                emailInfo.subject,
                emailInfo.originalBody || emailInfo.body || emailInfo.snippet,
              )
            ) {
              promotionalFiltered++;
              continue;
            }

            nonPromotional++;

            // ---- CLASSIFY AND PROCESS IMMEDIATELY ----
            try {
              const llmReturnedData = await this.llmService.classifyEmails(
                [emailInfo],
                userId,
              );

              if (llmReturnedData && llmReturnedData.length > 0) {
                const result = await this.processLlmExtractedEmails(
                  userId,
                  llmReturnedData,
                );
                processed += result.processed;
                skipped += result.skipped;
              }
            } catch (llmError) {
              this.loggerInstance.logger(LogType.ERROR, {
                message: 'LLM classification failed for single email',
                data: {
                  service: EmailScraperProvider.name,
                  method: MethodNames.sync,
                  userId,
                  emailId: emailInfo.id,
                },
                error:
                  llmError instanceof Error
                    ? llmError.message
                    : String(llmError),
              });
            }
          } catch (error) {
            this.loggerInstance.logger(LogType.ERROR, {
              message: 'Failed to process email',
              data: {
                service: EmailScraperProvider.name,
                method: MethodNames.sync,
                messageId: message.id,
                provider: this.name,
              },
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (stopPagination) {
          nextPageToken = undefined;
        } else {
          nextPageToken = searchResponse.data.nextPageToken;
        }
      } while (nextPageToken);

      return {
        totalFetched,
        promotionalFiltered,
        nonPromotional,
        processed,
        skipped,
        mostRecentDate,
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to fetch emails with query',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.sync,
          provider: this.name,
          query,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        totalFetched: 0,
        promotionalFiltered: 0,
        nonPromotional: 0,
        processed: 0,
        skipped: 0,
        mostRecentDate: new Date(0),
      };
    }
  }

  private async processLlmExtractedEmails(
    userId: string,
    emails: any[],
  ): Promise<{ processed: number; skipped: number }> {
    let processed = 0;
    let skipped = 0;

    for (const email of emails) {
      try {
        let emailExtractedData = email.classification;

        if (emailExtractedData.classification) {
          emailExtractedData = emailExtractedData.classification;
        } else if (emailExtractedData.classification_engine) {
          emailExtractedData = emailExtractedData.classification_engine;
        }

        if (emailExtractedData.skip) {
          this.loggerInstance.logger(LogType.INFO, {
            message: 'Skipping email based on LLM extraction',
            data: {
              service: EmailScraperProvider.name,
              method: MethodNames.sync,
              emailId: email.id,
              provider: this.name,
              reason: email.reason || 'Marked as skip by LLM',
            },
          });
          skipped++;
          continue;
        }

        // Ensure list & category exist
        const { list, userList, category } =
          await this.persistence.ensureListAndCategoryForUser(
            userId,
            emailExtractedData.category,
            emailExtractedData.subcategory,
          );

        if (!list || !userList) {
          this.loggerInstance.logger(LogType.WARN, {
            message: 'Could not find list or user list for email category',
            data: {
              service: EmailScraperProvider.name,
              method: MethodNames.sync,
              category: emailExtractedData.category,
              userId,
              hasList: !!list,
              hasUserList: !!userList,
            },
          });
          skipped++;
          continue;
        }

        // Skip if email already exists
        const exists = await this.persistence.emailExists(
          list.listId,
          list.recSeq,
          userList.userListId,
          email.messageId,
        );
        if (exists) {
          this.loggerInstance.logger(LogType.INFO, {
            message: 'Skipping duplicate email',
            data: {
              service: EmailScraperProvider.name,
              method: MethodNames.sync,
              emailId: email.id,
              provider: this.name,
            },
          });
          skipped++;
          continue;
        }

        // ---------- Build payload depending on list type ----------
        let title = '';
        let attributes: Record<string, any> = {};
        let attributeDataType: Record<string, any> = {};
        let isHandled = true;

        switch (emailExtractedData.category) {
          case 'Travel':
            title =
              emailExtractedData.extracted_entities?.address ||
              emailExtractedData.extracted_entities?.city ||
              emailExtractedData.subcategory ||
              'Travel';
            attributes = {
              state: emailExtractedData.extracted_entities?.state || '',
              city: emailExtractedData.extracted_entities?.city || '',
              country: emailExtractedData.extracted_entities?.country || '',
              startDate:
                emailExtractedData.extracted_entities?.start_date || '',
              endDate: emailExtractedData.extracted_entities?.end_date || '',
              startTime:
                emailExtractedData.extracted_entities?.start_time || '',
              endTime: emailExtractedData.extracted_entities?.end_time || '',
              duration: emailExtractedData.extracted_entities?.duration || '',
              address: emailExtractedData.extracted_entities?.address || '',
              description:
                emailExtractedData.extracted_entities?.description || '',
              nameOfTrip:
                emailExtractedData.extracted_entities?.name_of_trip || '',
              withWho: '',
              image: [],
            };
            attributeDataType = {
              state: 'string',
              city: 'string',
              country: 'string',
              startDate: 'string',
              endDate: 'string',
              startTime: 'string',
              endTime: 'string',
              duration: 'string',
              address: 'string',
              description: 'string',
              nameOfTrip: 'string',
              withWho: 'string',
              image: 'string[]',
            };
            break;

          case 'Transport':
            title =
              emailExtractedData.extracted_entities?.company_name ||
              emailExtractedData.subcategory ||
              'Transport';
            attributes = {
              transportType: emailExtractedData.subcategory || '',
              transportCompany:
                emailExtractedData.extracted_entities?.company_name || '',
              startDate:
                emailExtractedData.extracted_entities?.start_date || '',
              startTime:
                emailExtractedData.extracted_entities?.start_time || '',
              startAddress:
                emailExtractedData.extracted_entities?.start_location || '',
              endDate: emailExtractedData.extracted_entities?.end_date || '',
              endTime: emailExtractedData.extracted_entities?.end_time || '',
              endAddress:
                emailExtractedData.extracted_entities?.end_location || '',
              duration: emailExtractedData.extracted_entities?.duration || '',
              price: emailExtractedData.extracted_entities?.price || '',
              description:
                emailExtractedData.extracted_entities?.description || '',
              image: [],
            };
            attributeDataType = {
              transportType: 'string',
              transportCompany: 'string',
              startDate: 'string',
              startTime: 'string',
              startAddress: 'string',
              endDate: 'string',
              endTime: 'string',
              endAddress: 'string',
              duration: 'string',
              price: 'string',
              description: 'string',
              image: 'string[]',
            };
            break;

          case 'Food':
            title =
              [
                emailExtractedData.extracted_entities?.name_of_place,
                emailExtractedData.extracted_entities?.address,
              ]
                .filter(Boolean)
                .join(', ')
                .trim() ||
              emailExtractedData.subcategory ||
              'Food';
            attributes = {
              restaurantName:
                emailExtractedData.extracted_entities?.name_of_place || '',
              mealType: emailExtractedData.subcategory || '',
              date: emailExtractedData.extracted_entities?.ordered_date || '',
              time: emailExtractedData.extracted_entities?.ordered_time || '',
              address:
                `${emailExtractedData.extracted_entities?.name_of_place || ''}, ${emailExtractedData.extracted_entities?.address || ''}`.trim() ||
                '',
              cuisine:
                emailExtractedData.extracted_entities?.cuisine_type || '',
              items: emailExtractedData.extracted_entities?.item || '',
              orderId: emailExtractedData.extracted_entities?.order_id || '',
              description:
                emailExtractedData.extracted_entities?.description || '',
              withWho: '',
              rating: '',
              image: [],
            };
            attributeDataType = {
              restaurantName: 'string',
              mealType: 'string',
              date: 'string',
              time: 'string',
              address: 'string',
              cuisine: 'string',
              items: 'string',
              description: 'string',
              withWho: 'string',
              rating: 'string',
              provider: 'string',
              image: 'string[]',
            };
            break;

          case 'Places Visited':
            title =
              [
                emailExtractedData.extracted_entities?.name_of_grocery_store ||
                emailExtractedData.extracted_entities?.name_of_online_store ||
                emailExtractedData.extracted_entities?.name_of_retail_store ||
                emailExtractedData.extracted_entities?.name_of_park ||
                emailExtractedData.extracted_entities?.name_of_place,
                emailExtractedData.extracted_entities?.address,
              ]
                .filter(Boolean)
                .join(', ')
                .trim() || 'Places Visited';
            attributes = {
              date:
                emailExtractedData.extracted_entities?.date ||
                emailExtractedData.extracted_entities?.ordered_date ||
                '',
              time:
                emailExtractedData.extracted_entities?.time ||
                emailExtractedData.extracted_entities?.ordered_time ||
                '',
              address: title,
              orderId: emailExtractedData.extracted_entities?.order_id || '',
              description:
                emailExtractedData.extracted_entities?.description || '',
              image: [],
            };
            attributeDataType = {
              date: 'string',
              time: 'string',
              address: 'string',
              description: 'string',
              image: 'string[]',
            };
            break;
          default:
            isHandled = false;
            break;
        }

        if (!isHandled || !title) {
          this.loggerInstance.logger(LogType.INFO, {
            message: 'Skipping email due to unhandled category or empty title',
            data: {
              service: EmailScraperProvider.name,
              method: MethodNames.sync,
              category: emailExtractedData.category,
              subcategory: emailExtractedData.subcategory,
              title,
              isHandled,
              emailId: email.messageId,
            },
          });
          skipped++;
          continue;
        }

        // Skip if order_id already exists (cross-email deduplication)
        if (attributes.orderId) {
          const orderExists = await this.persistence.orderIdExists(
            list.listId,
            list.recSeq,
            userList.userListId,
            attributes.orderId,
          );
          if (orderExists) {
            this.loggerInstance.logger(LogType.INFO, {
              message: 'Skipping duplicate order',
              data: {
                service: EmailScraperProvider.name,
                method: MethodNames.sync,
                emailId: email.id,
                orderId: attributes.orderId,
              },
            });
            skipped++;
            continue;
          }
        }

        // Add external ID for duplicate tracking
        attributes.external = {
          provider: 'gmail',
          id: email.messageId,
        };

        // ---------- Insert record ----------
        await this.persistence.upsertListItem(
          list.listId,
          REC_SEQ.DEFAULT_RECORD,
          userList.userListId,
          REC_SEQ.DEFAULT_RECORD,
          category?.itemCategoryId ?? null,
          REC_SEQ.DEFAULT_RECORD,
          title,
          attributes,
          attributeDataType,
          userId,
          attributes.description || '',
        );

        // Special case: If Transport and Airplane, also add to Travel
        if (
          emailExtractedData.category === 'Transport' &&
          emailExtractedData.subcategory === 'Airplane'
        ) {
          try {
            const {
              list: travelList,
              userList: travelUserList,
              category: travelCategory,
            } = await this.persistence.ensureListAndCategoryForUser(
              userId,
              ListNames.TRAVEL,
              emailExtractedData.extracted_entities
                ?.domestic_or_international || 'Domestic',
            );

            if (travelList && travelUserList) {
              const travelTitle =
                emailExtractedData.extracted_entities?.end_location ||
                emailExtractedData.extracted_entities?.city ||
                emailExtractedData.extracted_entities?.state ||
                emailExtractedData.extracted_entities?.country ||
                ListNames.TRAVEL;

              const travelAttributes = {
                state: emailExtractedData.extracted_entities?.state || '',
                city: emailExtractedData.extracted_entities?.city || '',
                country: emailExtractedData.extracted_entities?.country || '',
                startDate:
                  emailExtractedData.extracted_entities?.start_date || '',
                endDate: emailExtractedData.extracted_entities?.end_date || '',
                startTime:
                  emailExtractedData.extracted_entities?.start_time || '',
                endTime: emailExtractedData.extracted_entities?.end_time || '',
                duration: emailExtractedData.extracted_entities?.duration || '',
                address:
                  emailExtractedData.extracted_entities?.end_location || '',
                description:
                  emailExtractedData.extracted_entities?.description || '',
                nameOfTrip:
                  emailExtractedData.extracted_entities?.end_location || '',
                withWho: '',
                image: [],
                external: {
                  provider: 'gmail',
                  id: email.messageId,
                },
              };

              const travelAttributeDataType = {
                state: 'string',
                city: 'string',
                country: 'string',
                startDate: 'string',
                endDate: 'string',
                startTime: 'string',
                endTime: 'string',
                duration: 'string',
                address: 'string',
                description: 'string',
                nameOfTrip: 'string',
                withWho: 'string',
                image: 'string[]',
              };

              await this.persistence.upsertListItem(
                travelList.listId,
                REC_SEQ.DEFAULT_RECORD,
                travelUserList.userListId,
                REC_SEQ.DEFAULT_RECORD,
                travelCategory?.itemCategoryId ?? null,
                REC_SEQ.DEFAULT_RECORD,
                travelTitle,
                travelAttributes,
                travelAttributeDataType,
                userId,
                travelAttributes.description || '',
              );
            }
          } catch (error) {
            this.loggerInstance.logger(LogType.ERROR, {
              message: 'Failed to add Airplane record to Travel category',
              data: {
                service: EmailScraperProvider.name,
                method: MethodNames.sync,
                userId,
                emailId: email.id,
              },
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        processed++;
      } catch (error) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Failed to process single extracted email',
          data: {
            service: EmailScraperProvider.name,
            method: MethodNames.sync,
            userId,
            emailId: email.messageId,
          },
          error: error instanceof Error ? error.message : String(error),
        });
        skipped++;
      }
    }

    return { processed, skipped };
  }

  private extractSenderInfo(from: string): {
    email: string;
    displayName: string;
  } {
    const match = from.match(/^([^<]*)<([^>]+)>$/) || from.match(/^([^<]+)$/);
    if (match) {
      const displayName = match[1]?.trim() || '';
      const email = match[2]?.trim() || match[1]?.trim() || '';
      return {
        email: email.toLowerCase(),
        displayName: displayName.toLowerCase(),
      };
    }
    return { email: from.toLowerCase(), displayName: '' };
  }

  private getSenderDomain(email: string): string {
    const match = email.match(/@([^.]+\.[^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some((keyword) =>
      lowerText.includes(keyword.toLowerCase()),
    );
  }

  private isSenderPromotional(from: string, displayName: string): boolean {
    const lowerFrom = from.toLowerCase();
    const lowerDisplayName = displayName.toLowerCase();
    return PROMOTIONAL_SENDER_PATTERNS.some(
      (pattern) =>
        lowerFrom.includes(pattern.toLowerCase()) ||
        lowerDisplayName.includes(
          pattern
            .toLowerCase()
            .replace('@', '')
            .replace('marketing', '')
            .trim(),
        ),
    );
  }

  private isMainEmailForDomain(
    from: string,
    displayName: string,
    subject: string,
    body: string,
    domain: string,
  ): boolean {
    const config = KNOWN_SENDERS[domain];
    if (!config) return true;

    const lowerFrom = from.toLowerCase();
    const lowerDisplayName = displayName.toLowerCase();
    const lowerSubject = subject.toLowerCase();
    const lowerBody = body.toLowerCase();

    if (config.mainEmailIndicators.senderNames) {
      const matchesSenderName = config.mainEmailIndicators.senderNames.some(
        (name) =>
          lowerFrom.includes(name.toLowerCase()) ||
          lowerDisplayName.includes(name.toLowerCase()),
      );
      if (matchesSenderName) return true;
    }

    if (config.mainEmailIndicators.subjectKeywords) {
      const matchesSubject = this.matchesKeywords(
        lowerSubject,
        config.mainEmailIndicators.subjectKeywords,
      );
      if (matchesSubject) return true;
    }

    if (config.mainEmailIndicators.bodyKeywords) {
      const matchesBody = this.matchesKeywords(
        lowerBody,
        config.mainEmailIndicators.bodyKeywords,
      );
      if (matchesBody) return true;
    }

    return false;
  }

  private isPromotionalForDomain(
    from: string,
    displayName: string,
    subject: string,
    body: string,
    domain: string,
  ): boolean {
    const config = KNOWN_SENDERS[domain];
    if (!config?.promotionalIndicators) {
      return this.matchesKeywords(subject + ' ' + body, PROMOTIONAL_KEYWORDS);
    }

    if (config.promotionalIndicators.senderNames) {
      const matchesSenderName = config.promotionalIndicators.senderNames.some(
        (name) =>
          from.toLowerCase().includes(name.toLowerCase()) ||
          displayName.toLowerCase().includes(name.toLowerCase()),
      );
      if (matchesSenderName) return true;
    }

    if (config.promotionalIndicators.subjectKeywords) {
      const matchesSubject = this.matchesKeywords(
        subject,
        config.promotionalIndicators.subjectKeywords,
      );
      if (matchesSubject) return true;
    }

    if (config.promotionalIndicators.bodyKeywords) {
      const matchesBody = this.matchesKeywords(
        body,
        config.promotionalIndicators.bodyKeywords,
      );
      if (matchesBody) return true;
    }

    return false;
  }

  private isPromotionalEmail(
    from: string,
    subject: string,
    body: string,
  ): boolean {
    const { email, displayName } = this.extractSenderInfo(from);
    const text = (subject + ' ' + body).toLowerCase();
    const isSnippetOnly = body.length < 300; // snippets are usually ~200 chars

    // -----------------------------------
    // 0. Transactional-only indicators (STOP EARLY - WHITELIST)
    // -----------------------------------
    const TRANSACTIONAL_KEYWORDS = [
      'receipt',
      'invoice',
      'order confirmed',
      'order delivered',
      'your order',
      'ordered',
      'order summary',
      'order confirmation',
      'purchase confirmation',
      'thank you for your order',
      'order #',
      'confirmed:',
      'receipt:',
      'invoice:',
      'shipment:',
      'delivery:',
      'booking confirmed',
      'reservation confirmed',
      'trip details',
      'flight details',
      'boarding pass',
      'ticket',
      'itinerary',
      'your subscription',
      'password reset',
      'otp',
      'verification code',
      'security alert',
      'new sign-in',
      'account activity',
      'finish setting up',
      'finish set-up',
      'verify your',
      'verification',
      'payment failed',
      'payment completed',
      'transaction',
      'refund',
      'confirmed',
      'confirmation',
      'your account',
      'amazon',
      'zomato',
      'swiggy',
      'uber',
      'ola',
      'flipkart',
      'myntra',
    ];

    if (this.matchesKeywords(text, TRANSACTIONAL_KEYWORDS)) {
      return false;
    }

    // If we only have a snippet, we should be much more lenient
    // to avoid false positives since we can't see the full context
    if (isSnippetOnly) {
      // For snippets, only block if it's VERY obviously promotional
      const VERY_STRONG_PROMO = [
        'unmissable deals',
        'flash sale',
        'flat 50% off',
        'subscribe to our newsletter',
      ];
      return this.matchesKeywords(text, VERY_STRONG_PROMO);
    }

    // -----------------------------------
    // 1. Strong promotional indicators (BLOCK EARLY)
    // -----------------------------------
    const STRONG_PROMO_KEYWORDS = [
      'stay updated',
      'get exclusive',
      'special offers',
      'limited time',
      'exclusive deals',
      'save now',
      'subscribe',
      'newsletter',
      'promotional',
      'marketing',
      'flash sale',
      'trending on',
      'popular now',
      'trending this week',
      'explore restaurants',
      'discover new',
      'best of',
      'top rated',
      'off your next',
      'buy 1 get 1',
      'discount code',
      'promo code',
      'claim your',
      'reward points',
    ];

    if (this.matchesKeywords(text, STRONG_PROMO_KEYWORDS)) {
      return true;
    }

    // -----------------------------------
    // 2. Sender-level promotional check
    // -----------------------------------
    if (this.isSenderPromotional(email, displayName)) {
      return true;
    }

    // -----------------------------------
    // 3. Domain-level checks
    // -----------------------------------
    const domain = this.getSenderDomain(email);

    if (domain) {
      const knownDomain = Object.keys(KNOWN_SENDERS).find(
        (key) => KNOWN_SENDERS[key].domains.some((d) => email.endsWith(d)), // FIXED
      );

      if (knownDomain) {
        // Transactional email?
        if (
          this.isMainEmailForDomain(
            email,
            displayName,
            subject,
            body,
            knownDomain,
          )
        ) {
          return false;
        }

        // Promotional email?
        if (
          this.isPromotionalForDomain(
            email,
            displayName,
            subject,
            body,
            knownDomain,
          )
        ) {
          return true;
        }
      }
    }

    // -----------------------------------
    // 4. Generic promotional keyword fallback
    // -----------------------------------
    return this.matchesKeywords(text, PROMOTIONAL_KEYWORDS);
  }

  async disconnect(userId: string): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Disconnecting Email Scraper (Gmail)',
      data: {
        service: EmailScraperProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });

    try {
      // Get the access token before deletion
      const tokens = await this.tokens.get(userId, this.name);

      if (tokens?.accessToken) {
        // Revoke the token with Google
        try {
          await axios.post('https://oauth2.googleapis.com/revoke', null, {
            params: {
              token: tokens.accessToken,
            },
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });
          this.loggerInstance.logger(LogType.INFO, {
            message: 'Successfully revoked Gmail token',
            data: {
              service: EmailScraperProvider.name,
              method: MethodNames.disconnect,
              userId,
              provider: this.name,
            },
          });
        } catch (error) {
          // Log but don't throw - token might already be invalid
          this.loggerInstance.logger(LogType.ERROR, {
            message: 'Failed to revoke Gmail token',
            data: {
              service: EmailScraperProvider.name,
              method: MethodNames.disconnect,
              userId,
              provider: this.name,
            },
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Error during Email Scraper disconnect',
        data: {
          service: EmailScraperProvider.name,
          method: MethodNames.disconnect,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow disconnect to continue even if revocation fails
    }

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Email Scraper disconnect completed',
      data: {
        service: EmailScraperProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });
  }

  private syncInBackground(userId: string): void {
    this.persistence
      .markSyncInProgress(userId, this.name)
      .then(() => {
        return this.sync(userId);
      })
      .then((syncResult) => {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Background sync completed',
          data: {
            service: EmailScraperProvider.name,
            method: MethodNames.sync,
            userId,
            provider: this.name,
            syncResult,
          },
        });
        return this.persistence.markSyncCompleted(userId, this.name);
      })
      .catch((syncError) => {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Background sync failed',
          data: {
            service: EmailScraperProvider.name,
            method: MethodNames.sync,
            userId,
            provider: this.name,
          },
          error:
            syncError instanceof Error ? syncError.message : String(syncError),
        });
        return this.persistence
          .markSyncCompleted(userId, this.name)
          .catch(() => { });
      });
  }
}
