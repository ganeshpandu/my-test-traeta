import { HttpStatus, Injectable } from '@nestjs/common';
import { TechvLogger } from 'techvedika-logger';
import {
  IntegrationProvider,
  IntegrationProviderName,
  ConnectResponse,
  CallbackPayload,
} from './types';
import { PlaidProvider } from './providers/plaid.provider';
import { StravaProvider } from './providers/strava.provider';
import { AppleHealthProvider } from './providers/apple-health.provider';
import { AppleMusicProvider } from './providers/apple-music.provider';
import { SpotifyProvider } from './providers/spotify.provider';
import { EmailScraperProvider } from './providers/email-scraper.provider';
import { LocationServicesProvider } from './providers/location-services.provider';
import { ContactListProvider } from './providers/contact-list.provider';
import { GoodreadsProvider } from './providers/goodreads.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from './persistence';
import { TokenStore } from './token-store';
import {
  ProviderNotFoundException,
  InvalidCallbackException,
  DataSyncException,
  UserDataNotFoundException,
  DataValidationException,
} from './exceptions';
import {
  Response,
  DATA_STATUS,
  REC_SEQ,
  REC_STATUS,
  LogType,
  MethodNames,
  PROVIDER_ORDER,
  ACTIVE_CONDITION,
  COOLDOWN_MS,
  STATUS,
  RESPONSE_STATUS,
  PROVIDER_NAMINGS,
} from '../../constants';
import { UtilityService } from '../utility/utility.service';

@Injectable()
export class IntegrationsService {
  private readonly providers: Map<IntegrationProviderName, IntegrationProvider>;

  constructor(
    private readonly plaid: PlaidProvider,
    private readonly strava: StravaProvider,
    private readonly appleHealth: AppleHealthProvider,
    private readonly appleMusic: AppleMusicProvider,
    private readonly spotify: SpotifyProvider,
    private readonly emailScraper: EmailScraperProvider,
    private readonly locationServices: LocationServicesProvider,
    private readonly contactList: ContactListProvider,
    private readonly goodreads: GoodreadsProvider,
    private readonly prisma: PrismaService,
    private readonly persistence: IntegrationPersistence,
    private readonly tokenStore: TokenStore,
    private readonly loggerInstance: TechvLogger,
    private readonly utilityService: UtilityService,
  ) {
    this.providers = new Map<IntegrationProviderName, IntegrationProvider>([
      [plaid.name, plaid],
      [strava.name, strava],
      [appleHealth.name, appleHealth],
      [appleMusic.name, appleMusic],
      [emailScraper.name, emailScraper],
      [spotify.name, spotify],
      [locationServices.name, locationServices],
      [contactList.name, contactList],
      [goodreads.name, goodreads],
    ]);
  }

  private getProviderOrThrow(
    name: IntegrationProviderName,
  ): IntegrationProvider {
    const p = this.providers.get(name);
    if (!p) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Provider not found',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.getProviderOrThrow,
          provider: name,
        },
      });
      throw new ProviderNotFoundException(name);
    }
    return p;
  }

  async createConnection(
    provider: IntegrationProviderName,
    userId: string,
  ): Promise<ConnectResponse> {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Creating connection for provider',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.createConnection,
          provider,
          userId,
        },
      });
      const response =
        await this.getProviderOrThrow(provider).createConnection(userId);
      // Ensure provider is included in the response
      return {
        ...response,
        provider: provider,
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to create connection',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.createConnection,
          provider,
          userId,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async handleCallback(
    provider: IntegrationProviderName,
    payload: CallbackPayload,
  ): Promise<void> {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Handling callback for provider',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.handleCallback,
          provider,
        },
      });

      // Validate callback payload
      if (payload.error) {
        throw new InvalidCallbackException(
          provider,
          `OAuth error: ${payload.error}${payload.error_description ? ` - ${payload.error_description}` : ''}`,
        );
      }

      if (
        provider !== IntegrationProviderName.PLAID &&
        !payload.code &&
        !payload.music_user_token
      ) {
        throw new InvalidCallbackException(
          provider,
          'Missing authorization code or token',
        );
      } else if (
        provider === IntegrationProviderName.PLAID &&
        !payload.public_token
      ) {
        throw new InvalidCallbackException(provider, 'Missing public token');
      }

      return await this.getProviderOrThrow(provider).handleCallback(payload);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to handle callback',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.handleCallback,
          provider,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async handleCallbackWithUserData(
    provider: IntegrationProviderName,
    payload: CallbackPayload,
  ): Promise<any> {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Handling callback with user data for provider',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.handleCallbackWithUserData,
          provider,
        },
      });

      // Handle the callback first
      await this.handleCallback(provider, payload);

      // Extract userId from state for Strava, Plaid, and Apple Music (not Email Scraper - it does background sync)
      if (
        (provider === IntegrationProviderName.STRAVA ||
          provider === IntegrationProviderName.PLAID ||
          provider === IntegrationProviderName.APPLE_MUSIC) &&
        payload.state
      ) {
        const stateStr = String(payload.state);
        let prefix = `${provider}-`;

        // Handle email scraper special case (state format: "email-<userId>-<timestamp>")
        // if (provider === IntegrationProviderName.GMAIL_SCRAPER) {
        //     prefix = 'email-';
        // }

        // Handle apple music special case (state format: "apple-music-<userId>-<timestamp>")
        if (provider === IntegrationProviderName.APPLE_MUSIC) {
          prefix = 'apple-music-';
        }

        if (stateStr.startsWith(prefix)) {
          const statePayload = stateStr.slice(prefix.length);
          const lastHyphenIndex = statePayload.lastIndexOf('-');
          if (lastHyphenIndex !== -1) {
            const userId = statePayload.slice(0, lastHyphenIndex);
            if (userId) {
              // Get user data with integration details and synced content
              return await this.getUserDataWithSyncedContent(userId, provider);
            }
          }
        }
      }

      return { ok: true, message: 'Integration connected successfully' };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to handle callback with user data',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.handleCallbackWithUserData,
          provider,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async getUserDataWithSyncedContent(
    userId: string,
    provider: IntegrationProviderName,
  ): Promise<any> {
    try {
      // Get user information
      const user = await this.prisma.users.findFirst({
        where: {
          userId: userId,
          recSeq: REC_SEQ.DEFAULT_RECORD,
          recStatus: REC_STATUS.ACTIVE,
          dataStatus: DATA_STATUS.ACTIVE,
        },
        include: {
          avatar: {
            select: {
              masterDataId: true,
              keyCode: true,
              value: true,
            },
          },
        },
      });

      if (!user) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'User not found',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.getUserDataWithSyncedContent,
            userId,
            provider,
          },
        });
        throw new UserDataNotFoundException(provider, 'user profile');
      }

      // Get integration status
      const integrationStatus = await this.status(provider, userId);

      // Get synced data based on provider
      let syncedData = null;
      if (
        provider === IntegrationProviderName.STRAVA &&
        integrationStatus.connected
      ) {
        syncedData = await this.getStravaActivityData(userId);
      } else if (
        provider === IntegrationProviderName.PLAID &&
        integrationStatus.connected
      ) {
        syncedData = await this.getPlaidFinancialData(userId);
      } else if (
        provider === IntegrationProviderName.APPLE_MUSIC &&
        integrationStatus.connected
      ) {
        syncedData = await this.getAppleMusicData(userId);
      } else if (
        provider === IntegrationProviderName.GMAIL_SCRAPER &&
        integrationStatus.connected
      ) {
        syncedData = await this.getEmailScraperData(userId);
      }

      return {
        ok: true,
        isConnected: true,
        message: 'Integration connected and data synced successfully',
        data: {
          user: {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            dateOfBirth: user.dateOfBirth,
            gender: user.gender,
            avatar: user.avatar,
            isProfileComplete: user.isProfileComplete,
            createdAt: user.createdOn,
            updatedAt: user.modifiedOn,
          },
          integration: {
            provider: provider,
            connected: integrationStatus.connected,
            lastSyncedAt: integrationStatus.lastSyncedAt,
            details: integrationStatus.details,
          },
          syncedData: syncedData,
        },
      };
    } finally {
      await this.prisma.$disconnect();
    }
  }

  private async getSpotifyMusicData(userId: string): Promise<any> {
    try {
      // Get user's music lists
      const musicLists = await this.prisma.userLists.findMany({
        where: {
          userId: userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          recStatus: REC_STATUS.ACTIVE,
          dataStatus: DATA_STATUS.ACTIVE,
          list: {
            name: 'Music',
            recStatus: REC_STATUS.ACTIVE,
            dataStatus: DATA_STATUS.ACTIVE,
          },
        },
        include: {
          list: {
            include: {
              categories: {
                where: {
                  recStatus: REC_STATUS.ACTIVE,
                  dataStatus: DATA_STATUS.ACTIVE,
                },
                include: {
                  items: {
                    where: {
                      recStatus: REC_STATUS.ACTIVE,
                      dataStatus: DATA_STATUS.ACTIVE,
                    },
                    orderBy: {
                      createdOn: 'desc',
                    },
                    take: 10, // Limit to recent items
                  },
                },
              },
            },
          },
        },
      });

      const musicData: {
        recentlyPlayed: any[];
        likedSongs: any[];
        playlists: any[];
        topTracks: any[];
      } = {
        recentlyPlayed: [],
        likedSongs: [],
        playlists: [],
        topTracks: [],
      };

      for (const userList of musicLists) {
        for (const category of userList.list.categories) {
          const categoryName = category.name.toLowerCase();
          const items = category.items.map((item) => ({
            id: item.listItemId,
            title: item.title,
            attributes: item.attributes,
            createdAt: item.createdOn,
            updatedAt: item.modifiedOn,
          }));

          if (categoryName.includes('recently played')) {
            musicData.recentlyPlayed = items;
          } else if (
            categoryName.includes('liked') ||
            categoryName.includes('saved')
          ) {
            musicData.likedSongs = items;
          } else if (categoryName.includes('playlist')) {
            musicData.playlists = items;
          } else if (categoryName.includes('top')) {
            musicData.topTracks = items;
          }
        }
      }

      return musicData;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Error fetching Spotify music data',
        error: error,
      });
      return {
        recentlyPlayed: [],
        likedSongs: [],
        playlists: [],
        topTracks: [],
        error: 'Failed to fetch synced music data',
      };
    }
  }

  private async getStravaActivityData(userId: string): Promise<any> {
    try {
      // Get user's activity lists
      const activityLists = await this.prisma.userLists.findMany({
        where: {
          userId: userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          recStatus: REC_STATUS.ACTIVE,
          dataStatus: DATA_STATUS.ACTIVE,
          list: {
            name: 'Activity',
            recStatus: REC_STATUS.ACTIVE,
            dataStatus: DATA_STATUS.ACTIVE,
          },
        },
        include: {
          list: {
            include: {
              categories: {
                where: {
                  recStatus: REC_STATUS.ACTIVE,
                  dataStatus: DATA_STATUS.ACTIVE,
                },
                include: {
                  items: {
                    where: {
                      recStatus: REC_STATUS.ACTIVE,
                      dataStatus: DATA_STATUS.ACTIVE,
                    },
                    orderBy: {
                      createdOn: 'desc',
                    },
                    take: 50, // Limit to recent items
                  },
                },
              },
            },
          },
        },
      });

      const activityData: {
        runs: any[];
        bikes: any[];
        swims: any[];
        walks: any[];
        hikes: any[];
        strength: any[];
        other: any[];
        totalActivities: number;
      } = {
        runs: [],
        bikes: [],
        swims: [],
        walks: [],
        hikes: [],
        strength: [],
        other: [],
        totalActivities: 0,
      };

      for (const userList of activityLists) {
        for (const category of userList.list.categories) {
          const categoryName = category.name.toLowerCase();
          const items = category.items.map((item) => ({
            id: item.listItemId,
            title: item.title,
            attributes: item.attributes,
            createdAt: item.createdOn,
            updatedAt: item.modifiedOn,
          }));

          activityData.totalActivities += items.length;

          if (categoryName.includes('run')) {
            activityData.runs = items;
          } else if (
            categoryName.includes('bike') ||
            categoryName.includes('ride')
          ) {
            activityData.bikes = items;
          } else if (categoryName.includes('swim')) {
            activityData.swims = items;
          } else if (categoryName.includes('walk')) {
            activityData.walks = items;
          } else if (categoryName.includes('hike')) {
            activityData.hikes = items;
          } else if (
            categoryName.includes('strength') ||
            categoryName.includes('workout')
          ) {
            activityData.strength = items;
          } else {
            activityData.other = items;
          }
        }
      }

      return activityData;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Error fetching Strava activity data',
        error: error,
      });
      return {
        runs: [],
        bikes: [],
        swims: [],
        walks: [],
        hikes: [],
        strength: [],
        other: [],
        totalActivities: 0,
        error: 'Failed to fetch synced activity data',
      };
    }
  }

  private async getPlaidFinancialData(userId: string): Promise<any> {
    try {
      const financialData: {
        transactions: any[];
        accounts: any[];
        totalTransactions: number;
        totalAccounts: number;
      } = {
        transactions: [],
        accounts: [],
        totalTransactions: 0,
        totalAccounts: 0,
      };

      // Get accounts from Financial list
      const financialLists = await this.prisma.userLists.findMany({
        where: {
          userId: userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          recStatus: REC_STATUS.ACTIVE,
          dataStatus: DATA_STATUS.ACTIVE,
          list: {
            name: 'Financial',
            recStatus: REC_STATUS.ACTIVE,
            dataStatus: DATA_STATUS.ACTIVE,
          },
        },
        include: {
          list: {
            include: {
              categories: {
                where: {
                  recStatus: REC_STATUS.ACTIVE,
                  dataStatus: DATA_STATUS.ACTIVE,
                },
                include: {
                  items: {
                    where: {
                      recStatus: REC_STATUS.ACTIVE,
                      dataStatus: DATA_STATUS.ACTIVE,
                    },
                    orderBy: {
                      createdOn: 'desc',
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Process accounts from Financial list
      for (const userList of financialLists) {
        for (const category of userList.list.categories) {
          const categoryName = category.name.toLowerCase();
          const items = category.items.map((item) => ({
            id: item.listItemId,
            title: item.title,
            attributes: item.attributes,
            createdAt: item.createdOn,
            updatedAt: item.modifiedOn,
          }));

          if (categoryName.includes('account')) {
            financialData.accounts.push(...items);
            financialData.totalAccounts += items.length;
          }
        }
      }

      // Get transactions from categorized lists (Travel, Transport, Food, Places)
      const transactionLists = await this.prisma.userLists.findMany({
        where: {
          userId: userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          recStatus: REC_STATUS.ACTIVE,
          dataStatus: DATA_STATUS.ACTIVE,
          list: {
            name: {
              in: ['Travel', 'Transport', 'Food', 'Places'],
            },
            recStatus: REC_STATUS.ACTIVE,
            dataStatus: DATA_STATUS.ACTIVE,
          },
        },
        include: {
          list: {
            include: {
              categories: {
                where: {
                  recStatus: REC_STATUS.ACTIVE,
                  dataStatus: DATA_STATUS.ACTIVE,
                },
                include: {
                  items: {
                    where: {
                      recStatus: REC_STATUS.ACTIVE,
                      dataStatus: DATA_STATUS.ACTIVE,
                      // Only get items from Plaid (check external.provider in attributes)
                    },
                    orderBy: {
                      createdOn: 'desc',
                    },
                    take: 100, // Limit to recent transactions
                  },
                },
              },
            },
          },
        },
      });

      // Process transactions from categorized lists
      for (const userList of transactionLists) {
        for (const category of userList.list.categories) {
          const items = category.items
            .filter((item) => {
              // Only include items from Plaid provider
              const attributes = item.attributes as any;
              return (
                attributes?.external?.provider === 'plaid' &&
                attributes?.external?.type === 'transaction'
              );
            })
            .map((item) => ({
              id: item.listItemId,
              title: item.title,
              attributes: item.attributes,
              createdAt: item.createdOn,
              updatedAt: item.modifiedOn,
            }));

          financialData.transactions.push(...items);
          financialData.totalTransactions += items.length;
        }
      }

      return financialData;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Error fetching Plaid financial data',
        error: error,
      });
      return {
        transactions: [],
        accounts: [],
        totalTransactions: 0,
        totalAccounts: 0,
        error: 'Failed to fetch synced financial data',
      };
    }
  }

  private async getEmailScraperData(userId: string): Promise<any> {
    try {
      const emailData: {
        travel: any[];
        food: any[];
        places_visited: any[];
        transport: any[];
        totalEmails: number;
      } = {
        travel: [],
        food: [],
        places_visited: [],
        transport: [],
        totalEmails: 0,
      };

      // Get user's email lists - these are created as category-specific lists
      // Email scraper creates lists named: 'Food', 'Travel', 'Places', 'Transport'
      const emailListNames = ['Food', 'Travel', 'Places', 'Transport'];

      const emailLists = await this.prisma.userLists.findMany({
        where: {
          userId: userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          recStatus: REC_STATUS.ACTIVE,
          dataStatus: DATA_STATUS.ACTIVE,
          list: {
            name: {
              in: emailListNames,
            },
            recStatus: REC_STATUS.ACTIVE,
            dataStatus: DATA_STATUS.ACTIVE,
          },
        },
        include: {
          list: {
            include: {
              categories: {
                where: {
                  recStatus: REC_STATUS.ACTIVE,
                  dataStatus: DATA_STATUS.ACTIVE,
                },
                include: {
                  items: {
                    where: {
                      userList: {
                        userId: userId,
                      },
                      recStatus: REC_STATUS.ACTIVE,
                      dataStatus: DATA_STATUS.ACTIVE,
                    },
                    orderBy: {
                      createdOn: 'desc',
                    },
                    take: 100, // Limit to recent items per category
                  },
                },
              },
            },
          },
        },
      });

      this.loggerInstance.logger(LogType.INFO, {
        message: '[GET EMAIL DATA] Found email lists',
        data: { emailLists },
      });
      this.loggerInstance.logger(LogType.INFO, {
        message: '[GET EMAIL DATA] user ID',
        data: { userId },
      });
      this.loggerInstance.logger(LogType.INFO, {
        message: '[GET EMAIL DATA] Email list names queried:',
        data: { emailListNames },
      });

      for (const userList of emailLists) {
        const listName = userList.list.name.toLowerCase();
        this.loggerInstance.logger(LogType.INFO, {
          message: '[GET EMAIL DATA] Processing list',
          data: { listName: userList.list.name },
        });

        this.loggerInstance.logger(LogType.INFO, {
          message: '[GET EMAIL DATA] Categories count:',
          data: { categoriesCount: userList.list.categories.length },
        });

        for (const category of userList.list.categories) {
          const categoryName = category.name.toLowerCase();
          this.loggerInstance.logger(LogType.INFO, {
            message: '[GET EMAIL DATA] Category items count:',
            data: { categoryName, itemsCount: category.items.length },
          });
          const items = category.items.map((item) => ({
            id: item.listItemId,
            title: item.title,
            attributes: item.attributes,
            createdAt: item.createdOn,
            updatedAt: item.modifiedOn,
          }));

          emailData.totalEmails += items.length;

          // Map list names to the correct data categories
          // Food list → emailData.food
          // Travel list → emailData.travel
          // Places list → emailData.places_visited
          // Transport list → emailData.transport
          if (listName === 'food') {
            emailData.food.push(...items);
          } else if (listName === 'travel') {
            emailData.travel.push(...items);
          } else if (listName === 'places') {
            emailData.places_visited.push(...items);
          } else if (listName === 'transport') {
            emailData.transport.push(...items);
          }

          // Also map by category name for backward compatibility
          if (
            !listName ||
            categoryName.includes('travel') ||
            categoryName.includes('booking')
          ) {
            if (!emailData.travel.some((e) => e.id === items[0]?.id)) {
              emailData.travel.push(...items);
            }
          } else if (
            categoryName.includes('food') ||
            categoryName.includes('dining')
          ) {
            if (!emailData.food.some((e) => e.id === items[0]?.id)) {
              emailData.food.push(...items);
            }
          } else if (
            categoryName.includes('places') ||
            categoryName.includes('location')
          ) {
            if (!emailData.places_visited.some((e) => e.id === items[0]?.id)) {
              emailData.places_visited.push(...items);
            }
          } else if (categoryName.includes('transport')) {
            if (!emailData.transport.some((e) => e.id === items[0]?.id)) {
              emailData.transport.push(...items);
            }
          }
        }
      }

      // Also fetch uncategorized emails for backward compatibility
      // These are emails with categoryId = null that were synced before the fix
      // Query by userList relationship to ensure we get all email list items
      const uncategorizedEmails = await this.prisma.listItems.findMany({
        where: {
          userList: {
            userId: userId,
            userRecSeq: REC_SEQ.DEFAULT_RECORD,
            list: {
              name: {
                in: emailListNames,
              },
              recStatus: REC_STATUS.ACTIVE,
              dataStatus: DATA_STATUS.ACTIVE,
            },
            recStatus: REC_STATUS.ACTIVE,
            dataStatus: DATA_STATUS.ACTIVE,
          },
          categoryId: null,
          recStatus: REC_STATUS.ACTIVE,
          dataStatus: DATA_STATUS.ACTIVE,
        },
        orderBy: {
          createdOn: 'desc',
        },
        take: 100,
      });

      this.loggerInstance.logger(LogType.INFO, {
        message: '[GET EMAIL DATA] Found uncategorized emails',
        data: { uncategorizedEmailsCount: uncategorizedEmails.length },
      });

      for (const item of uncategorizedEmails) {
        const mappedItem = {
          id: item.listItemId,
          title: item.title,
          attributes: item.attributes,
          createdAt: item.createdOn,
          updatedAt: item.modifiedOn,
        };

        emailData.totalEmails += 1;

        // Try to determine category from email attributes
        const attributes = item.attributes as any;
        if (attributes?.external?.type === 'email') {
          const subject = (attributes.subject || '').toLowerCase();
          const from = (attributes.from || '').toLowerCase();
          const body = (attributes.body || '').toLowerCase();
          const fullText = `${subject} ${from} ${body}`;

          // Simple heuristics to categorize uncategorized emails
          if (
            fullText.includes('flight') ||
            fullText.includes('hotel') ||
            fullText.includes('booking') ||
            fullText.includes('trip')
          ) {
            emailData.travel.push(mappedItem);
          } else if (
            fullText.includes('restaurant') ||
            fullText.includes('food') ||
            fullText.includes('delivery') ||
            fullText.includes('dining')
          ) {
            emailData.food.push(mappedItem);
          } else if (
            fullText.includes('location') ||
            fullText.includes('place') ||
            fullText.includes('address') ||
            fullText.includes('venue')
          ) {
            emailData.places_visited.push(mappedItem);
          } else if (
            fullText.includes('uber') ||
            fullText.includes('lyft') ||
            fullText.includes('taxi') ||
            fullText.includes('transit')
          ) {
            emailData.transport.push(mappedItem);
          }
        }
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: '[GET EMAIL DATA] Final totalEmails:',
        data: { totalEmails: emailData.totalEmails },
      });

      this.loggerInstance.logger(LogType.INFO, {
        message: '[GET EMAIL DATA] Category breakdown:',
        data: {
          travel: emailData.travel.length,
          food: emailData.food.length,
          places_visited: emailData.places_visited.length,
          transport: emailData.transport.length,
        },
      });

      return emailData;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Error fetching Email Scraper data',
        error: error,
      });
      return {
        travel: [],
        food: [],
        places_visited: [],
        transport: [],
        totalEmails: 0,
        error: 'Failed to fetch synced email data',
      };
    }
  }

  private async getAppleMusicData(userId: string): Promise<any> {
    try {
      // Get user's music lists
      const musicLists = await this.prisma.userLists.findMany({
        where: {
          userId: userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          recStatus: REC_STATUS.ACTIVE,
          dataStatus: DATA_STATUS.ACTIVE,
          list: {
            name: 'Music',
            recStatus: REC_STATUS.ACTIVE,
            dataStatus: DATA_STATUS.ACTIVE,
          },
        },
        include: {
          list: {
            include: {
              categories: {
                where: {
                  recStatus: REC_STATUS.ACTIVE,
                  dataStatus: DATA_STATUS.ACTIVE,
                },
                include: {
                  items: {
                    where: {
                      recStatus: REC_STATUS.ACTIVE,
                      dataStatus: DATA_STATUS.ACTIVE,
                    },
                    orderBy: {
                      createdOn: 'desc',
                    },
                    take: 50, // Limit to recent items
                  },
                },
              },
            },
          },
        },
      });

      const musicData: {
        recentlyPlayed: any[];
        librarySongs: any[];
        playlists: any[];
        totalItems: number;
      } = {
        recentlyPlayed: [],
        librarySongs: [],
        playlists: [],
        totalItems: 0,
      };

      for (const userList of musicLists) {
        for (const category of userList.list.categories) {
          const categoryName = category.name.toLowerCase();
          const items = category.items
            .filter((item) => {
              // Only include items from Apple Music provider
              const attributes = item.attributes as any;
              return attributes?.external?.provider === 'apple_music';
            })
            .map((item) => ({
              id: item.listItemId,
              title: item.title,
              attributes: item.attributes,
              createdAt: item.createdOn,
              updatedAt: item.modifiedOn,
            }));

          musicData.totalItems += items.length;

          if (
            categoryName.includes('recently played') ||
            categoryName.includes('recent')
          ) {
            musicData.recentlyPlayed.push(...items);
          } else if (
            categoryName.includes('library') ||
            categoryName.includes('saved')
          ) {
            musicData.librarySongs.push(...items);
          } else if (categoryName.includes('playlist')) {
            musicData.playlists.push(...items);
          }
        }
      }

      return musicData;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Error fetching Apple Music data',
        error: error,
      });
      return {
        recentlyPlayed: [],
        librarySongs: [],
        playlists: [],
        totalItems: 0,
        error: 'Failed to fetch synced Apple Music data',
      };
    }
  }

  async sync(
    provider: IntegrationProviderName,
    userId: string,
    overrideCurrentDate?: Date,
  ) {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Syncing data for provider',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.sync,
          provider,
          userId,
          overrideCurrentDate: overrideCurrentDate?.toISOString(),
        },
      });

      const isSyncing = await this.persistence.isSyncing(userId, provider);
      if (isSyncing) {
        this.loggerInstance.logger(LogType.WARN, {
          message: `Sync is already in progress for ${provider}. Please wait for the current sync to complete.`,
          data: {
            service: IntegrationsService.name,
            method: MethodNames.sync,
            provider,
            userId,
          },
        });
        throw new DataSyncException(
          provider,
          `Sync is already in progress for ${provider}. Please wait for the current sync to complete.`,
        );
      }

      await this.persistence.markSyncInProgress(userId, provider);

      const result = await this.getProviderOrThrow(provider).sync(
        userId,
        overrideCurrentDate,
      );

      if (!result.ok) {
        await this.persistence.markSyncCompleted(userId, provider, false);
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Sync failed for provider',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.sync,
            provider,
            userId,
            error: result.details?.error || 'Sync failed',
          },
        });
        throw new DataSyncException(
          provider,
          result.details?.error || 'Sync failed',
        );
      }

      await this.persistence.markSyncCompleted(userId, provider, true);
      return result;
    } catch (error) {
      await this.persistence
        .markSyncCompleted(userId, provider, false)
        .catch(() => { });
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to sync data',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.sync,
          provider,
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      if (error instanceof DataSyncException) {
        throw error;
      }
      throw new DataSyncException(provider, error.message);
    }
  }

  async status(provider: IntegrationProviderName, userId: string) {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Getting status for provider',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.status,
          provider,
          userId,
        },
      });
      return await this.getProviderOrThrow(provider).status(userId);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to get status',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.status,
          provider,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Formats provider name to readable format by capitalizing and removing underscores
   * Example: 'apple_health' -> 'Apple Health', 'spotify' -> 'Spotify'
   */
  private formatProviderName(provider: string): string {
    return provider
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private mapProviderToLists(provider: IntegrationProviderName): string[] {
    switch (provider) {
      // Music
      case IntegrationProviderName.APPLE_MUSIC:
        return ['Music'];

      // Activity
      case IntegrationProviderName.STRAVA:
        return ['Activity'];
      case IntegrationProviderName.APPLE_HEALTH:
        return ['Health', 'Activity'];

      // Financial/categorized via Plaid across multiple lists
      case IntegrationProviderName.PLAID:
        return ['Travel', 'Transport', 'Places Visited', 'Food'];

      // Email Scraping contributes to multiple lists
      case IntegrationProviderName.GMAIL_SCRAPER:
        return ['Travel', 'Transport', 'Places Visited', 'Food'];

      // // Contacts
      // case IntegrationProviderName.CONTACT_LIST:
      //     return ['Friends', 'Events'];

      // // Books via web scraping (Goodreads)
      // case IntegrationProviderName.GOODREADS:
      //     return ['Books'];

      default:
        return [this.formatProviderName(provider)];
    }
  }

  async getAllStatuses(userId: string, listId?: string) {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Getting all integration statuses',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.getAllIntegrationStatuses,
          userId,
        },
      });

      const statuses: Array<{
        provider: IntegrationProviderName;
        provider_name: string;
        connected: boolean;
        lastSyncedAt: Date | null | undefined;
        popularity?: number;
        details?: any;
        error?: string;
      }> = [];

      // Get all active integrations from the database
      const activeIntegrations = await this.prisma.integrations.findMany({
        where: {
          ...ACTIVE_CONDITION,
        },
        select: {
          name: true,
        },
      });
      const activeIntegrationNames = new Set(
        activeIntegrations.map((i) => i.name),
      );

      // Get status for all providers
      for (const [providerName, provider] of this.providers.entries()) {
        if (!activeIntegrationNames.has(providerName)) {
          continue;
        }
        try {
          const status = await provider.status(userId);
          const isSyncing = await this.persistence.isSyncing(
            userId,
            providerName,
          );
          statuses.push({
            provider: providerName,
            provider_name: this.formatProviderName(providerName),
            connected: status.connected || isSyncing,
            lastSyncedAt: status.lastSyncedAt,
            // popularity: status.details?.popularity,
            details: status.details,
          });
        } catch (error) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: 'Failed to get status for provider',
            data: {
              service: IntegrationsService.name,
              method: MethodNames.getAllIntegrationStatuses,
              provider: providerName,
              userId,
              error: error instanceof Error ? error.message : String(error),
            },
          });
          statuses.push({
            provider: providerName,
            provider_name: this.formatProviderName(providerName),
            connected: false,
            lastSyncedAt: null,
            error: error?.message || 'Failed to retrieve status',
          });
        }
      }

      // Sort by popularity
      const sortedStatuses = [...statuses].sort((a, b) => {
        // Normalize provider names by converting to lowercase and replacing underscores with hyphens
        const normalize = (provider) =>
          provider.toLowerCase().replace(/_/g, '-');

        const aProvider = normalize(a.provider);
        const bProvider = normalize(b.provider);

        const aIndex = PROVIDER_ORDER.findIndex(
          (p) => normalize(p) === aProvider,
        );
        const bIndex = PROVIDER_ORDER.findIndex(
          (p) => normalize(p) === bProvider,
        );

        // If both providers are in the list, sort by the defined order
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        // If only one provider is in the list, it comes first
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;

        // If neither is in the list, maintain their relative order
        return 0;
      });

      // If listId is provided, return filtered integrations for that list
      if (listId) {
        let targetList: { name: string; listIcon?: string } | null = null;
        try {
          targetList = await this.prisma.lists.findUnique({
            where: {
              listId_recSeq: { listId, recSeq: REC_SEQ.DEFAULT_RECORD },
              recStatus: REC_STATUS.ACTIVE,
              dataStatus: DATA_STATUS.ACTIVE,
            },
            select: {
              name: true,
            },
          });
        } catch (e) {
          targetList = await this.prisma.lists.findFirst({
            where: {
              listId,
              recSeq: REC_SEQ.DEFAULT_RECORD,
              recStatus: REC_STATUS.ACTIVE,
              dataStatus: DATA_STATUS.ACTIVE,
            },
            select: {
              name: true,
            },
          });
        }

        if (targetList?.name) {
          const filtered = sortedStatuses.filter((s) =>
            this.mapProviderToLists(s.provider).includes(targetList.name),
          );

          return {
            userId,
            listId,
            listName: targetList.name,

            integrations: filtered,
            totalIntegrations: filtered.length,
            connectedIntegrations: filtered.filter((s) => s.connected).length,
          };
        }
      }

      // Get top 6 integrations
      const topIntegrations = sortedStatuses.slice(0, 6).map((integration) => ({
        ...integration,
      }));

      // Group remaining integrations by list
      const remaining = sortedStatuses.slice(6);
      const integrationsByList = remaining.reduce<
        Record<string, typeof remaining>
      >((acc, item) => {
        const listNames = this.mapProviderToLists(item.provider);
        for (const listName of listNames) {
          if (!acc[listName]) acc[listName] = [];
          acc[listName].push({
            ...(item as any),
          });
        }
        return acc;
      }, {});

      return {
        userId,
        topIntegrations,
        integrationsByList,
        totalIntegrations: sortedStatuses.length,
        connectedIntegrations: sortedStatuses.filter((s) => s.connected).length,
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to get all statuses',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.getAllIntegrationStatuses,
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  // Apple Health specific methods
  async handleAppleHealthUpload(
    userId: string,
    uploadToken: string,
    healthData: any,
  ) {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Handling Apple Health upload',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.handleAppleHealthUpload,
          userId,
        },
      });
      const provider = this.getProviderOrThrow(
        IntegrationProviderName.APPLE_HEALTH,
      );

      if (
        !('handleDataUpload' in provider) ||
        typeof provider.handleDataUpload !== 'function'
      ) {
        throw new DataValidationException(
          IntegrationProviderName.APPLE_HEALTH,
          'Apple Health provider does not support data upload',
        );
      }

      return await (provider as any).handleDataUpload(
        userId,
        uploadToken,
        healthData,
      );
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to handle Apple Health upload',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.handleAppleHealthUpload,
          userId,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Apple Music specific methods
  async handleAppleMusicAuthorization(
    userId: string,
    musicUserToken: string,
    state?: string,
  ) {
    const provider = this.getProviderOrThrow(
      IntegrationProviderName.APPLE_MUSIC,
    );
    await provider.handleCallback({
      music_user_token: musicUserToken,
      state: state || `apple-music-${userId}-${Date.now()}`,
    });
    return { ok: true, message: 'Apple Music authorized successfully' };
  }

  // Get integration configuration for mobile apps
  async getIntegrationConfig(
    provider: IntegrationProviderName,
    userId: string,
  ) {
    const providerInstance = this.getProviderOrThrow(provider);

    switch (provider) {
      case IntegrationProviderName.APPLE_HEALTH:
        const appleHealthStatus = await providerInstance.status(userId);
        return {
          provider: 'apple_health',
          uploadEndpoint:
            process.env.APPLE_HEALTH_UPLOAD_ENDPOINT ||
            '/integrations/apple_health/upload',
          connected: appleHealthStatus.connected,
          lastSyncedAt: appleHealthStatus.lastSyncedAt,
          uploadToken: appleHealthStatus.details?.uploadToken, // Include upload token for connected users
          supportedDataTypes: [
            'workouts',
            'healthMetrics',
            'steps',
            'heartRate',
            'sleep',
          ],
        };

      case IntegrationProviderName.APPLE_MUSIC:
        const appleMusicStatus = await providerInstance.status(userId);
        return {
          provider: 'apple_music',
          connected: appleMusicStatus.connected,
          lastSyncedAt: appleMusicStatus.lastSyncedAt,
          authorizationUrl: 'https://authorize.music.apple.com/woa',
          supportedDataTypes: ['recentlyPlayed', 'librarySongs', 'playlists'],
          details: appleMusicStatus.details,
        };

      case IntegrationProviderName.STRAVA:
        const stravaStatus = await providerInstance.status(userId);
        return {
          provider: 'strava',
          connected: stravaStatus.connected,
          lastSyncedAt: stravaStatus.lastSyncedAt,
          authorizationUrl: 'https://www.strava.com/oauth/authorize',
          supportedDataTypes: ['activities'],
        };

      default:
        const status = await providerInstance.status(userId);
        return {
          provider,
          connected: status.connected,
          lastSyncedAt: status.lastSyncedAt,
          details: status.details,
        };
    }
  }

  /**
   * Get user data for already connected integrations
   * This method checks if the user is connected, optionally syncs fresh data,
   * and returns user information along with synced integration data
   *
   * @param provider - The integration provider name
   * @param userId - The user ID
   * @param forceSync - Whether to force a fresh sync (default: true)
   * @returns User data with integration status and synced content
   */
  async getConnectedUserData(
    provider: IntegrationProviderName,
    userId: string,
    forceSync: boolean = true,
  ): Promise<any> {
    try {
      // Step 1: Check connection status
      const integrationStatus = await this.status(provider, userId);

      if (!integrationStatus.connected) {
        return {
          ok: false,
          connected: false,
          message: `User is not connected to ${PROVIDER_NAMINGS[provider]}. Please connect first.`,
          data: null,
        };
      }

      // Step 2: Optionally trigger a fresh sync to get latest data
      if (forceSync) {
        try {
          await this.sync(provider, userId);
          // Refresh status after sync
          const updatedStatus = await this.status(provider, userId);
          integrationStatus.lastSyncedAt = updatedStatus.lastSyncedAt;
        } catch (syncError) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: `Error syncing data for provider ${PROVIDER_NAMINGS[provider]} data for user ${userId}:`,
            data: {
              service: IntegrationsService.name,
              method: 'getConnectedUserData',
              provider,
              userId,
              error:
                syncError instanceof Error
                  ? syncError.message
                  : String(syncError),
            },
          });
          // Continue to return existing data even if sync fails
        }
      }

      // Step 3: Get user data with synced content
      return await this.getUserDataWithSyncedContent(userId, provider);
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: `Error getting connected user data for provider ${PROVIDER_NAMINGS[provider]}:`,
        data: {
          service: IntegrationsService.name,
          method: 'getConnectedUserData',
          provider,
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return {
        ok: false,
        connected: false,
        message: `Failed to fetch data for ${PROVIDER_NAMINGS[provider]}: ${error.message}`,
        error: error.message,
        data: null,
      };
    }
  }

  private lastSyncTimes = new Map<string, Map<string, number>>(); // userId -> provider -> timestamp

  async resync(listId: string, userId: string, overrideCurrentDate?: Date) {
    try {
      const list = await this.prisma.lists.findFirst({
        where: {
          listId,
          ...ACTIVE_CONDITION,
        },
        select: {
          name: true,
          listId: true,
        },
      });

      if (!list) {
        return {
          status: HttpStatus.NOT_FOUND,
          message: `List with ID ${listId} not found`,
          data: null,
        };
      }

      // Get all active integrations from the database
      const activeIntegrations = await this.prisma.integrations.findMany({
        where: {
          ...ACTIVE_CONDITION,
        },
        select: {
          name: true,
        },
      });
      const activeIntegrationNames = new Set(
        activeIntegrations.map((i) => i.name),
      );

      const allProviders = Array.from(this.providers.keys()).filter(
        (providerName) => activeIntegrationNames.has(providerName),
      );
      const currentTime = overrideCurrentDate
        ? overrideCurrentDate.getTime()
        : Date.now();

      const providerListsMap = new Map<IntegrationProviderName, string[]>();
      for (const provider of allProviders) {
        const lists = this.mapProviderToLists(provider);
        providerListsMap.set(provider, lists);
      }

      // Helper: build provider evaluation item
      const evaluateProvider = async (provider: IntegrationProviderName) => {
        try {
          const status = await this.status(provider, userId);
          const isSyncing = await this.persistence.isSyncing(userId, provider);
          const providerLists = this.mapProviderToLists(provider);
          const lastSyncTime =
            this.lastSyncTimes.get(userId)?.get(provider) || 0;

          const timeSinceLastSync = currentTime - lastSyncTime;
          const isInCooldown = timeSinceLastSync < COOLDOWN_MS;
          const isForList = providerLists.includes(list.name);

          return {
            provider,
            connected: status.connected,
            isSyncing,
            isForList,
            isInCooldown: status.connected ? isInCooldown : false,
            lastSyncTime: status.connected ? lastSyncTime : 0,
            timeSinceLastSync: status.connected ? timeSinceLastSync : 0,
          };
        } catch (error) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: `Error checking status for provider ${PROVIDER_NAMINGS[provider]}`,
            data: {
              service: IntegrationsService.name,
              method: 'resync',
              provider,
              userId,
              listId,
              error: error instanceof Error ? error.message : String(error),
            },
          });

          return {
            provider,
            connected: false,
            isForList: false,
            isInCooldown: false,
            lastSyncTime: 0,
            timeSinceLastSync: 0,
            error: `Error checking status for ${PROVIDER_NAMINGS[provider]}`,
          };
        }
      };

      // ---- Evaluate all providers ----
      const providersForList = await Promise.all(
        allProviders.map((p) => evaluateProvider(p)),
      );

      // Providers not connected
      const notConnectedProviders = providersForList
        .filter((p) => !p.connected && !p.isSyncing && p.isForList)
        .map((p) => ({
          provider: p.provider,
          listId,
          listName: list.name,
          status: 'not_connected',
          message: `${PROVIDER_NAMINGS[p.provider]} is not connected for list ${list.name}`,
        }));

      // Providers skipped because cooldown
      const skippedDueToCooldown = providersForList
        .filter((p) => p.connected && p.isForList && p.isInCooldown)
        .map((p) => ({
          provider: p.provider,
          listId,
          listName: list.name,
          status: 'in_cooldown',
          lastSynced: new Date(currentTime - p.timeSinceLastSync).toISOString(),
          nextAvailableIn: `${Math.ceil((COOLDOWN_MS - p.timeSinceLastSync) / 1000)} seconds`,
        }));

      // Providers that will be synced now
      const providersToSync = providersForList
        .filter(
          (p) => p.connected && p.isForList && !p.isInCooldown && !p.isSyncing,
        )
        .map((p) => ({
          provider: p.provider,
          waitTime: Math.ceil((COOLDOWN_MS - p.timeSinceLastSync) / 60000),
        }));

      // ---- Sync integrations in background ----
      const syncingSet = new Set(providersToSync.map((p) => p.provider));
      providersToSync.forEach(({ provider }) => {
        if (!this.lastSyncTimes.has(userId)) {
          this.lastSyncTimes.set(userId, new Map());
        }
        this.lastSyncTimes.get(userId).set(provider, currentTime);

        // Initiate sync in background
        this.sync(provider, userId, overrideCurrentDate).catch((error) => {
          this.loggerInstance.logger(LogType.ERROR, {
            message: `Background sync failed for ${PROVIDER_NAMINGS[provider]}`,
            data: {
              service: IntegrationsService.name,
              method: 'resync-background',
              provider,
              userId,
              listId,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        });
      });

      const successfulSyncs: string[] = [];
      const failedSyncs: Array<{
        provider: string;
        error: string;
        listId: string;
        listName: string;
      }> = [];

      // After sync initiation...

      // ---- Build per-provider statuses and combined message for all scenarios ----
      const providersConsidered = providersForList.filter((p) => p.isForList);

      const failedSet = new Set(failedSyncs.map((f) => f.provider));
      const successSet = new Set(successfulSyncs);
      const notConnectedSet = new Set(
        notConnectedProviders.map((n) => n.provider),
      );

      const providerStatuses = providersConsidered.map((p) => {
        const name = this.formatProviderName(p.provider);

        // Syncing in background
        if (syncingSet.has(p.provider)) {
          return {
            provider: p.provider,
            name,
            status: 'syncing',
            message: `Sync started for ${PROVIDER_NAMINGS[p.provider]}`,
          };
        }

        // Already syncing from a previous request
        if (p.isSyncing) {
          return {
            provider: p.provider,
            name,
            status: 'syncing',
            // message: `${PROVIDER_NAMINGS[p.provider]} is already syncing`,
            message: `Sync is already in progress for ${PROVIDER_NAMINGS[p.provider]}. Please wait for the current sync to complete.`,
          };
        }

        // Failed during this run
        if (failedSet.has(p.provider)) {
          return {
            provider: p.provider,
            name,
            status: 'failed',
            message: `${PROVIDER_NAMINGS[p.provider]} failed to sync`,
          };
        }

        // Synced now (entering cooldown)
        if (successSet.has(p.provider)) {
          const cooldownSeconds = Math.ceil(COOLDOWN_MS / 1000);
          return {
            provider: p.provider,
            name,
            status: 'synced',
            cooldownSeconds,
            message: `${PROVIDER_NAMINGS[p.provider]} synced successfully`,
          };
        }

        // Not connected
        if (notConnectedSet.has(p.provider) || !p.connected) {
          return {
            provider: p.provider,
            name,
            status: 'not_connected',
            message: `${PROVIDER_NAMINGS[p.provider]} is not connected`,
          };
        }

        // Currently in cooldown (skipped)
        if (p.isInCooldown) {
          const secs = Math.max(
            0,
            Math.ceil((COOLDOWN_MS - p.timeSinceLastSync) / 1000),
          );
          const lastSynced = new Date(
            currentTime - p.timeSinceLastSync,
          ).toISOString();
          this.loggerInstance.logger(LogType.INFO, {
            message: `${PROVIDER_NAMINGS[p.provider]} is in cooldown. Last synced at ${lastSynced}, next available in ${secs} seconds.`,
            data: {
              service: IntegrationsService.name,
              method: 'resync',
              provider: p.provider,
              userId,
              listId,
            },
          });
          return {
            provider: p.provider,
            name,
            status: 'in_cooldown',
            cooldownSeconds: secs,
            lastSynced,
            message: `${PROVIDER_NAMINGS[p.provider]} was recently synced`,
          };
        }

        this.loggerInstance.logger(LogType.WARN, {
          message: `Unhandled status case for provider ${PROVIDER_NAMINGS[p.provider]}`,
          data: {
            service: IntegrationsService.name,
            method: 'resync',
            provider: p.provider,
            userId,
            listId,
            providerData: p,
          },
        });

        // Fallback
        return {
          provider: p.provider,
          name,
          status: 'unknown',
          message: `${PROVIDER_NAMINGS[p.provider]} status unknown`,
        };
      });

      const allSynced =
        providerStatuses.length > 0 &&
        providerStatuses.every(
          (s) => s.status === 'synced' || s.status === 'syncing',
        );
      const hasFailures = providerStatuses.some((s) => s.status === 'failed');

      // Compose human-readable combined message
      const combinedMessage = allSynced
        ? providerStatuses.some((s) => s.status === 'syncing')
          ? 'Sync started for integrations'
          : 'Synced successfully'
        : providerStatuses.map((s) => s.message).join(', ');

      const statusCode = hasFailures ? HttpStatus.NOT_FOUND : HttpStatus.OK;
      const topLevelMessage = hasFailures
        ? combinedMessage + ' ' + RESPONSE_STATUS.PLEASE_TRY_AGAIN
        : combinedMessage;

      return {
        status: statusCode,
        message: topLevelMessage,
        data: {
          success: !hasFailures,
          listId,
          listName: list.name,
          providerStatuses,
          syncingProviders: Array.from(syncingSet),
          syncedProviders: successfulSyncs,
          failedSyncs,
          notConnectedProviders,
          skippedDueToCooldown,
          totalProviders: allProviders.length,
          providersToSyncCount: providersToSync.length,
          successfulSyncs: successfulSyncs.length,
          failedSyncsCount: failedSyncs.length,
          skippedCount: skippedDueToCooldown.length,
          notConnectedCount: notConnectedProviders.length,
        },
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to sync all providers',
        data: {
          service: IntegrationsService.name,
          method: 'resync',
          listId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  async token(userId: string): Promise<Response<any>> {
    const response: Response<any> = { status: HttpStatus.OK, data: '' };
    const provider = IntegrationProviderName.APPLE_HEALTH;
    const getToken = await this.tokenStore.get(userId, provider);
    const userIntegrationStatus = await this.prisma.userIntegrations.findFirst({
      where: {
        userId: userId,
        integration: {
          name: IntegrationProviderName.APPLE_HEALTH,
          ...ACTIVE_CONDITION,
        },
        ...ACTIVE_CONDITION,
      },
      include: {
        history: {
          where: {
            ...ACTIVE_CONDITION,
          },
        },
      },
    });
    if (!userIntegrationStatus || !getToken) {
      response.status = HttpStatus.BAD_REQUEST;
      response.data = {
        statusCode: HttpStatus.BAD_REQUEST,
        connectionStatus: STATUS.DISCONNECTED,
        message: `Not connected to ${PROVIDER_NAMINGS[provider]}`,
      };
      return response;
    }
    response.data = {
      statusCode: HttpStatus.OK,
      token: getToken?.accessToken,
      status: userIntegrationStatus.status,
      lastSyncedAt: userIntegrationStatus.history[0].lastSyncedAt,
    };
    return response;
  }
  /**
   * Disconnect a user from a third-party integration provider
   * This method:
   * 1. Deletes OAuth tokens from the token store
   * 2. Updates the UserIntegrations status to 'DISCONNECTED'
   * 3. Optionally calls provider-specific revocation if supported
   *
   * @param provider - The integration provider name
   * @param userId - The user ID
   * @returns Success status and message
   */
  async disconnect(
    provider: IntegrationProviderName,
    userId: string,
  ): Promise<{
    statusCode: number;
    connectionStatus: string;
    message: string;
  }> {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Disconnecting provider',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.disconnect,
          provider,
          userId,
        },
      });

      // Step 1: Check if the integration exists
      const integrationStatus = await this.status(provider, userId);
      const isSyncing = await this.persistence.isSyncing(userId, provider);

      if (isSyncing) {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Sync is in progress for provider',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.disconnect,
            provider,
            userId,
          },
        });
        return {
          statusCode: 409,
          connectionStatus: 'syncing',
          message: `Sync is currently in progress for ${PROVIDER_NAMINGS[provider]}. Please wait for the sync to complete before disconnecting.`,
        };
      }

      if (!integrationStatus.connected) {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'User is not connected to provider',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.disconnect,
            provider,
            userId,
          },
        });
        return {
          statusCode: 400,
          connectionStatus: 'not_connected',
          message: `Not connected to ${PROVIDER_NAMINGS[provider]}`,
        };
      }

      // Step 2: Call provider-specific disconnect method (if available)
      // This handles token revocation with the third-party service
      const providerInstance = this.providers.get(provider);
      if (
        providerInstance &&
        typeof providerInstance.disconnect === 'function'
      ) {
        try {
          await providerInstance.disconnect(userId);
          this.loggerInstance.logger(LogType.INFO, {
            message: 'Provider-specific disconnect completed',
            data: {
              service: IntegrationsService.name,
              method: MethodNames.disconnect,
              provider,
              userId,
            },
          });
        } catch (error) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: 'Provider-specific disconnect failed',
            data: {
              service: IntegrationsService.name,
              method: MethodNames.disconnect,
              provider,
              userId,
            },
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with disconnection even if provider revocation fails
        }
      } else {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'No provider-specific disconnect method',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.disconnect,
            provider,
            userId,
          },
        });
      }

      // Step 3: Delete OAuth tokens from token store
      try {
        await this.tokenStore.delete(userId, provider);
        this.loggerInstance.logger(LogType.INFO, {
          message: 'OAuth tokens deleted',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.disconnect,
            provider,
            userId,
          },
        });
      } catch (error) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Failed to delete OAuth tokens',
          data: {
            service: IntegrationsService.name,
            method: MethodNames.disconnect,
            provider,
            userId,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        // Continue with disconnection even if token deletion fails
      }

      // Step 4: Mark integration as disconnected in database
      await this.persistence.markDisconnected(userId, provider);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Integration marked as disconnected',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.disconnect,
          provider,
          userId,
        },
      });

      return {
        statusCode: 200,
        connectionStatus: 'disconnected',
        message: `Successfully disconnected from ${PROVIDER_NAMINGS[provider]}`,
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Disconnect failed',
        data: {
          service: IntegrationsService.name,
          method: MethodNames.disconnect,
          provider,
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
}
