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
import axios from 'axios';
import {
  ConfigurationException,
  InvalidCallbackException,
  OAuthAuthenticationException,
  InvalidTokenException,
  RefreshTokenException,
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
  METERS_PER_MILE,
  YARDS_PER_METER,
} from '../../../constants';

const truncateToTwoDecimals = (
  value: number | undefined,
): number | undefined => {
  if (typeof value !== 'number') {
    return undefined;
  }
  return Math.trunc(value * 1000) / 1000;
};

const formatDurationHMS = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
};

@Injectable()
export class StravaProvider implements IntegrationProvider {
  public readonly name = IntegrationProviderName.STRAVA;

  constructor(
    private readonly db: PrismaService,
    private readonly persistence: IntegrationPersistence,
    private readonly tokens: TokenStore,
    private readonly configService: ConfigService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  private getClientId(): string {
    return this.configService.get<string>('STRAVA_CLIENT_ID') || '';
  }

  private getClientSecret(): string {
    return this.configService.get<string>('STRAVA_CLIENT_SECRET') || '';
  }

  private getRedirectUri(): string {
    return this.configService.get<string>('STRAVA_REDIRECT_URI') || '';
  }

  private getDefaultDays(): number {
    const days = this.configService.get<string>('STRAVA_DEFAULT_DAYS');
    return days ? Number(days) : 45;
  }

  async createConnection(userId: string): Promise<ConnectResponse> {
    // Validate configuration
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ConfigurationException(
        IntegrationProviderName.STRAVA,
        'Strava integration is not properly configured. Missing CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI.',
      );
    }

    const state = `strava-${userId}-${Date.now()}`;
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'read,activity:read_all',
      state,
      approval_prompt: 'auto',
    });
    const redirectUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
    // Ensure Integration row exists early for consistent status queries
    await this.persistence.ensureIntegration('strava');
    return { provider: this.name, redirectUrl, state };
  }

  async handleCallback(payload: CallbackPayload): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Strava callback received',
      data: {
        service: StravaProvider.name,
        method: MethodNames.handleCallback,
      },
    });
    const { code, state, error } = payload;

    if (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Strava callback error',
        data: {
          service: StravaProvider.name,
          method: MethodNames.handleCallback,
        },
        error: error,
      });
      throw new OAuthAuthenticationException(
        IntegrationProviderName.STRAVA,
        `OAuth error: ${error}`,
      );
    }

    if (!code || !state) {
      throw new InvalidCallbackException(
        IntegrationProviderName.STRAVA,
        'Missing authorization code or state parameter',
      );
    }

    const stateStr = String(state);
    const prefix = `${this.name}-`;
    if (!stateStr.startsWith(prefix)) {
      throw new InvalidCallbackException(
        IntegrationProviderName.STRAVA,
        `Invalid state prefix: expected '${prefix}', got '${stateStr.split('-')[0]}-'`,
      );
    }

    const statePayload = stateStr.slice(prefix.length);
    const lastHyphenIndex = statePayload.lastIndexOf('-');
    if (lastHyphenIndex === -1) {
      throw new InvalidCallbackException(
        IntegrationProviderName.STRAVA,
        'Invalid state format: missing timestamp',
      );
    }

    const userId = statePayload.slice(0, lastHyphenIndex);
    if (!userId) {
      throw new InvalidCallbackException(
        IntegrationProviderName.STRAVA,
        'Missing userId in state parameter',
      );
    }

    try {
      // Exchange code for tokens
      const tokenUrl = 'https://www.strava.com/oauth/token';
      const clientId = this.getClientId();
      const clientSecret = this.getClientSecret();
      const redirectUri = this.getRedirectUri();
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });
      const res = await axios.post(tokenUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const data = res.data as {
        token_type: string;
        access_token: string;
        expires_at: number; // epoch seconds
        expires_in: number;
        refresh_token: string;
        athlete?: { id?: number };
        scope?: string;
      };

      await this.tokens.set(userId, 'strava', {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        scope: data.scope,
        providerUserId: data.athlete?.id ? String(data.athlete.id) : undefined,
      });

      const integration = await this.persistence.ensureIntegration('strava');
      await this.persistence.markConnected(userId, integration.integrationId);

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Strava connected successfully',
        data: {
          service: StravaProvider.name,
          method: MethodNames.handleCallback,
          userId,
        },
      });

      // Automatically sync user data after successful connection
      try {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Starting automatic sync after Strava connection',
          data: {
            service: StravaProvider.name,
            method: MethodNames.handleCallback,
            userId,
          },
        });
        const syncResult = await this.sync(userId);
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Automatic sync completed',
          data: {
            service: StravaProvider.name,
            method: MethodNames.handleCallback,
            userId,
            syncResult: {
              ok: syncResult.ok,
              details: {
                rawActivitiesCount:
                  syncResult.details?.rawStravaData?.length || 0,
                createdCount: syncResult.details?.createdCount || 0,
                syncedAt: syncResult.syncedAt?.toISOString(),
              },
            },
          },
        });
      } catch (syncError) {
        const syncErrorDetails: any = {
          service: StravaProvider.name,
          method: MethodNames.handleCallback,
          userId,
          errorType: syncError?.constructor?.name,
          errorMessage:
            syncError instanceof Error ? syncError.message : String(syncError),
        };

        if (axios.isAxiosError(syncError)) {
          syncErrorDetails.status = syncError.response?.status;
          syncErrorDetails.statusText = syncError.response?.statusText;
          syncErrorDetails.responseData = JSON.stringify(
            syncError.response?.data,
          ).substring(0, 500);
        }

        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Automatic sync failed during callback',
          data: syncErrorDetails,
          error:
            syncError instanceof Error ? syncError.message : String(syncError),
        });
        // Don't throw error here as connection was successful, sync can be retried later
      }
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to handle Strava callback',
        data: {
          service: StravaProvider.name,
          method: MethodNames.handleCallback,
          userId,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // If it's already one of our custom exceptions, re-throw it
      if (
        error instanceof InvalidCallbackException ||
        error instanceof OAuthAuthenticationException
      ) {
        throw error;
      }

      // Handle Axios errors from Strava API
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        if (status === 401 || status === 403) {
          throw new OAuthAuthenticationException(
            IntegrationProviderName.STRAVA,
            `Failed to exchange authorization code: ${message}`,
          );
        } else if (status === 429) {
          throw new RateLimitException(
            IntegrationProviderName.STRAVA,
            error.response?.headers['retry-after'],
          );
        } else {
          throw new ProviderAPIException(
            IntegrationProviderName.STRAVA,
            'Token exchange',
            status ? `HTTP ${status}: ${message}` : message,
          );
        }
      }

      // Generic error
      throw new OAuthAuthenticationException(
        IntegrationProviderName.STRAVA,
        `Unexpected error during callback: ${error.message}`,
      );
    }
  }

  private async ensureValidAccessToken(userId: string): Promise<string> {
    const existing = await this.tokens.get(userId, 'strava');
    if (!existing) {
      throw new InvalidTokenException(IntegrationProviderName.STRAVA);
    }

    const now = Math.floor(Date.now() / 1000);
    if (existing.expiresAt && existing.expiresAt - now > 60) {
      return existing.accessToken; // still valid
    }

    if (!existing.refreshToken) {
      throw new InvalidTokenException(IntegrationProviderName.STRAVA);
    }

    // Refresh
    try {
      const tokenUrl = 'https://www.strava.com/oauth/token';
      const clientId = this.getClientId();
      const clientSecret = this.getClientSecret();
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: existing.refreshToken,
      });
      const res = await axios.post(tokenUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = res.data as {
        access_token: string;
        refresh_token: string;
        expires_at: number;
        scope?: string;
      };

      await this.tokens.set(userId, 'strava', {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        scope: data.scope ?? existing.scope,
      });
      return data.access_token;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to refresh Strava token',
        data: {
          service: StravaProvider.name,
          method: MethodNames.ensureValidAccessToken,
          userId,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        if (status === 400 || status === 401) {
          throw new RefreshTokenException(IntegrationProviderName.STRAVA);
        } else if (status === 429) {
          throw new RateLimitException(
            IntegrationProviderName.STRAVA,
            error.response?.headers['retry-after'],
          );
        } else {
          throw new ProviderAPIException(
            IntegrationProviderName.STRAVA,
            'Token refresh',
            status ? `HTTP ${status}: ${message}` : message,
          );
        }
      }

      throw new RefreshTokenException(IntegrationProviderName.STRAVA);
    }
  }

  async sync(
    userId: string,
  ): Promise<{ ok: boolean; syncedAt?: Date; details?: any }> {
    const integration = await this.persistence.ensureIntegration('strava');
    const defaultDays = this.getDefaultDays();
    const sinceDate = new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);
    const sinceEpoch = Math.floor(sinceDate.getTime() / 1000);

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Starting Strava sync',
      data: {
        service: StravaProvider.name,
        method: MethodNames.sync,
        userId,
        sinceDate: sinceDate.toISOString(),
        sinceEpoch,
        defaultDays,
      },
    });

    try {
      const accessToken = await this.ensureValidAccessToken(userId);

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Fetching activities from Strava API',
        data: {
          service: StravaProvider.name,
          method: MethodNames.sync,
          userId,
          endpoint: 'https://www.strava.com/api/v3/athlete/activities',
          sinceEpoch,
        },
      });

      const rawActivities: any[] = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;
      let lastStatusCode = 0;

      while (hasMore) {
        const activitiesRes = await axios.get(
          'https://www.strava.com/api/v3/athlete/activities',
          {
            params: {
              after: sinceEpoch,
              per_page: perPage,
              page: page,
            },
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        lastStatusCode = activitiesRes.status;
        const pageActivities = activitiesRes.data as any[];
        if (!pageActivities || pageActivities.length === 0) {
          hasMore = false;
        } else {
          rawActivities.push(...pageActivities);
          this.loggerInstance.logger(LogType.INFO, {
            message: `Fetched page ${page} from Strava API`,
            data: {
              service: StravaProvider.name,
              method: MethodNames.sync,
              userId,
              page,
              activitiesInPage: pageActivities.length,
              totalActivitiesFetched: rawActivities.length,
            },
          });

          // Stop if we got fewer items than requested (last page)
          if (pageActivities.length < perPage) {
            hasMore = false;
          }
          page++;
        }
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Strava API response received',
        data: {
          service: StravaProvider.name,
          method: MethodNames.sync,
          userId,
          activitiesCount: rawActivities.length,
          statusCode: lastStatusCode,
          rawResponse: JSON.stringify(rawActivities).substring(0, 500),
        },
      });

      if (rawActivities.length > 0) {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Raw Strava activities data fetched',
          data: {
            service: StravaProvider.name,
            method: MethodNames.sync,
            userId,
            fullRawActivities: JSON.stringify(rawActivities, null, 2),
          },
        });
      } else {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'No activities fetched from Strava API',
          data: {
            service: StravaProvider.name,
            method: MethodNames.sync,
            userId,
            sinceEpoch,
            sinceDate: sinceDate.toISOString(),
          },
        });
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Mapping Strava activities to internal structure',
        data: {
          service: StravaProvider.name,
          method: MethodNames.sync,
          userId,
          totalActivitiesForMapping: rawActivities.length,
        },
      });

      const activities = rawActivities.map((a, index) => {
        // Map Strava activity to our internal structure
        const startTime = new Date(a.start_date_local);
        const movingSeconds = a.moving_time ?? 0;
        const elapsedSeconds = a.elapsed_time ?? 0;
        const endTime = new Date(startTime.getTime() + movingSeconds * 1000);
        const date = startTime.toISOString().split('T')[0];
        const type = (a.sport_type || a.type || 'Other') as string;
        const distanceMeters = a.distance ?? 0;
        const baseMiles =
          type.toLowerCase() !== 'swim' ? distanceMeters / METERS_PER_MILE : 0;
        const baseYards =
          type.toLowerCase() === 'swim' ? distanceMeters * YARDS_PER_METER : 0;
        const miles = truncateToTwoDecimals(baseMiles);
        const yards = truncateToTwoDecimals(baseYards);
        const activityDuration = formatDurationHMS(movingSeconds);
        const elapsedDuration = formatDurationHMS(elapsedSeconds);
        const totalEnergyBurned = a.total_energy_burned ?? null;
        const workoutType = a.workout_type ?? null;
        const metadata = a.metadata ?? {};
        const start = startTime;
        const end = endTime;
        const id = a.id;

        this.loggerInstance.logger(LogType.INFO, {
          message: `Mapping activity ${index + 1}/${rawActivities.length}`,
          data: {
            service: StravaProvider.name,
            method: MethodNames.sync,
            userId,
            activityId: String(a.id),
            type,
            startDate: start.toISOString(),
            durationMin: Math.round(movingSeconds / 60),
            distance: a.distance,
            miles,
          },
        });

        return {
          id: String(a.id),
          type,
          date,
          start,
          end,
          startTime,
          endTime,
          durationMin: Math.round(movingSeconds / 60),
          activityDuration,
          elapsedDuration,
          miles,
          yards,
          images: [],
          route: a.map || null,
          totalEnergyBurned,
          workoutType,
          metadata,
        };
      });

      const createdItems: Array<{
        id: string;
        type: string;
        date: string;
        start: Date;
        end: Date;
        startTime: Date;
        endTime: Date;
        durationMin: number;
        activityDuration: string;
        elapsedDuration: string;
        miles: number | undefined;
        yards: number | undefined;
        images: any[];
        route: any;
        category: string;
        created?: boolean;
        updated?: boolean;
        skipped?: boolean;
        totalEnergyBurned?: number;
        workoutType?: string;
        metadata?: Record<string, any>;
      }> = [];

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Starting to create list items for activities',
        data: {
          service: StravaProvider.name,
          method: MethodNames.sync,
          userId,
          totalActivitiesToCreate: activities.length,
        },
      });

      for (let index = 0; index < activities.length; index++) {
        const a = activities[index];
        try {
          const categoryName = this.mapType(a.type);

          this.loggerInstance.logger(LogType.INFO, {
            message: `Processing activity ${index + 1}/${activities.length}`,
            data: {
              service: StravaProvider.name,
              method: MethodNames.sync,
              userId,
              activityId: a.id,
              type: a.type,
              categoryName,
            },
          });

          const { list, userList, category } =
            await this.persistence.ensureListAndCategoryForUser(
              userId,
              'Activity',
              categoryName,
            );

          const distance = a.miles ?? a.yards;
          if (['Run', 'Bike', 'Swim', 'Hike', 'Walk'].includes(categoryName)) {
            await this.persistence.upsertListItem(
              // await this.persistence.upsertItem(
              list.listId,
              REC_SEQ.DEFAULT_RECORD,
              userList.userListId,
              REC_SEQ.DEFAULT_RECORD,
              category?.itemCategoryId ?? null,
              REC_SEQ.DEFAULT_RECORD,
              `${a.miles || a.yards} ${categoryName === 'Swim' ? 'yards' : 'miles'}`,
              {
                ...(categoryName === 'Swim'
                  ? { yards: distance }
                  : { miles: distance }),
                date: a.date,
                startTime: a.startTime,
                endTime: a.endTime,
                activityDuration: a.activityDuration,
                elapsedDuration: a.elapsedDuration,
                calories: a.totalEnergyBurned ?? null,
                distance: distance,
                workoutType: a.workoutType,
                metadata: a.metadata ?? {},
                external: { provider: 'strava', id: a.id, type: 'activity' },
                id: a.id,
              },
              {
                ...(categoryName === 'Swim'
                  ? { yards: DATA_TYPE.NUMBER }
                  : { miles: DATA_TYPE.NUMBER }),
                date: DATA_TYPE.STRING,
                startTime: DATA_TYPE.STRING,
                endTime: DATA_TYPE.STRING,
                activityDuration: DATA_TYPE.STRING,
                elapsedDuration: DATA_TYPE.STRING,
                address: DATA_TYPE.STRING,
                images: DATA_TYPE.STRING_ARRAY,
                calories: DATA_TYPE.NUMBER,
                distance: DATA_TYPE.NUMBER,
                workoutType: DATA_TYPE.STRING,
                metadata: {},
                external: {
                  provider: DATA_TYPE.STRING,
                  id: DATA_TYPE.STRING,
                  type: DATA_TYPE.STRING,
                },
                id: DATA_TYPE.STRING,
              },
              userId,
            );
          } else {
            await this.persistence.upsertListItem(
              // await this.persistence.upsertItem(
              list.listId,
              REC_SEQ.DEFAULT_RECORD,
              userList.userListId,
              REC_SEQ.DEFAULT_RECORD,
              category?.itemCategoryId ?? null,
              REC_SEQ.DEFAULT_RECORD,
              formatDurationHMS(a.durationMin * 60),
              {
                date: a.date,
                startTime: a.startTime,
                endTime: a.endTime,
                activityDuration: a.activityDuration,
                elapsedDuration: a.elapsedDuration,
                address: '',
                images: [],
                calories: a.totalEnergyBurned ?? null,
                distance: distance,
                workoutType: a.workoutType,
                metadata: a.metadata ?? {},
                external: { provider: 'strava', id: a.id, type: 'activity' },
                id: a.id,
              },
              {
                date: DATA_TYPE.STRING,
                startTime: DATA_TYPE.STRING,
                endTime: DATA_TYPE.STRING,
                activityDuration: DATA_TYPE.STRING,
                elapsedDuration: DATA_TYPE.STRING,
                address: DATA_TYPE.STRING,
                images: DATA_TYPE.STRING_ARRAY,
                calories: DATA_TYPE.NUMBER,
                distance: DATA_TYPE.NUMBER,
                workoutType: DATA_TYPE.STRING,
                metadata: {},
                external: {
                  provider: DATA_TYPE.STRING,
                  id: DATA_TYPE.STRING,
                  type: DATA_TYPE.STRING,
                },
                id: DATA_TYPE.STRING,
              },
              userId,
            );
          }

          this.loggerInstance.logger(LogType.INFO, {
            message: `List item created successfully for activity ${index + 1}/${activities.length}`,
            data: {
              service: StravaProvider.name,
              method: MethodNames.sync,
              userId,
              activityId: a.id,
              listId: list.listId,
            },
          });

          createdItems.push({
            ...a,
            category: categoryName,
            created: true,
          });
        } catch (itemError) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: `Failed to process activity ${index + 1}/${activities.length}`,
            data: {
              service: StravaProvider.name,
              method: MethodNames.sync,
              userId,
              activityId: a.id,
              error:
                itemError instanceof Error
                  ? itemError.message
                  : String(itemError),
            },
          });
          throw itemError;
        }
      }

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

        this.loggerInstance.logger(LogType.INFO, {
          message: 'User integration marked as synced',
          data: {
            service: StravaProvider.name,
            method: MethodNames.sync,
            userId,
            userIntegrationId: link.userIntegrationId,
          },
        });
      }

      const createdCount = createdItems.filter((i) => i.created).length;
      const updatedCount = createdItems.filter((i) => i.updated).length;
      const skippedCount = createdItems.filter((i) => i.skipped).length;

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Strava sync completed successfully',
        data: {
          service: StravaProvider.name,
          method: MethodNames.sync,
          userId,
          rawActivitiesCount: rawActivities.length,
          createdCount,
          updatedCount,
          skippedCount,
          totalProcessed: createdItems.length,
          syncedAt: new Date().toISOString(),
        },
      });

      return {
        ok: true,
        syncedAt: new Date(),
        details: {
          activitiesCount: activities.length,
          createdCount,
          updatedCount,
          skippedCount,
          since: sinceDate,
          activities: createdItems,
          rawStravaData: rawActivities,
        },
      };
    } catch (error) {
      const errorDetails: any = {
        service: StravaProvider.name,
        method: MethodNames.sync,
        userId,
        provider: this.name,
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
      };

      // Add Axios error details
      if (axios.isAxiosError(error)) {
        errorDetails.isAxiosError = true;
        errorDetails.status = error.response?.status;
        errorDetails.statusText = error.response?.statusText;
        errorDetails.responseData = JSON.stringify(
          error.response?.data,
        ).substring(0, 500);
        errorDetails.requestUrl = error.config?.url;
        errorDetails.requestParams = JSON.stringify(error.config?.params);
      }

      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Strava sync failed',
        data: errorDetails,
        error: error instanceof Error ? error.message : String(error),
      });

      // If it's already one of our custom exceptions, re-throw it
      if (
        error instanceof InvalidTokenException ||
        error instanceof RefreshTokenException ||
        error instanceof RateLimitException ||
        error instanceof ProviderAPIException
      ) {
        throw error;
      }

      // Handle Axios errors from Strava API
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        if (status === 429) {
          throw new RateLimitException(
            IntegrationProviderName.STRAVA,
            error.response?.headers['retry-after'],
          );
        } else if (status === 401 || status === 403) {
          throw new InvalidTokenException(IntegrationProviderName.STRAVA);
        } else {
          throw new ProviderAPIException(
            IntegrationProviderName.STRAVA,
            'sync',
            status ? `HTTP ${status}: ${message}` : message,
          );
        }
      }

      // Generic sync error
      throw new DataSyncException(
        IntegrationProviderName.STRAVA,
        `Failed to sync Strava data: ${error.message}`,
      );
    }
  }

  async status(userId: string): Promise<{
    connected: boolean;
    lastSyncedAt?: Date | null;
    details?: any;
  }> {
    const integration = await this.persistence.ensureIntegration('strava');
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

    return {
      connected: !!link && link.status === STATUS.CONNECTED,
      lastSyncedAt: history?.lastSyncedAt ?? null,
      details: {},
    };
  }

  private mapType(t: string): string {
    const sportType = (t || '').toLowerCase().trim();

    switch (sportType) {
      case 'run':
      case 'trail_run':
      case 'trail run':
      case 'trailrun':
        return 'Run';

      case 'walk':
        return 'Walk';

      case 'hike':
        return 'Hike';

      case 'swim':
        return 'Swim';

      case 'ride':
      case 'bike':
      case 'mountain_bike_ride':
      case 'mountain bike ride':
      case 'mountainbikeride':
      case 'road_bike_ride':
      case 'road bike ride':
      case 'roadbikeride':
      case 'gravel_ride':
      case 'gravel ride':
      case 'gravelride':
      case 'e_bike_ride':
      case 'e-bike ride':
      case 'ebikeride':
      case 'e_mountain_bike_ride':
      case 'e-mountain bike ride':
      case 'emountainbikeride':
      case 'handcycle':
      case 'velomobile':
      case 'cycling':
      case 'indoor_cycle':
      case 'indoor cycle':
      case 'indoorcycle':
        return 'Bike';

      case 'workout':
      case 'weight_training':
      case 'weight training':
      case 'weighttraining':
      case 'strength_training':
      case 'strength training':
      case 'strengthtraining':
        return 'Strength';

      case 'tennis':
        return 'Tennis';

      case 'yoga':
        return 'Yoga';

      case 'badminton':
      case 'basketball':
      case 'football':
      case 'soccer':
      case 'volleyball':
      case 'hockey':
      case 'american_football':
      case 'american football':
      case 'americanfootball':
      case 'golf':
      case 'paddling':
      case 'rowing':
      case 'rugby':
      case 'squash':
      case 'cricket':
      case 'lacrosse':
      case 'baseball':
      case 'martial_arts':
      case 'martial arts':
      case 'martialarts':
      case 'kickboxing':
      case 'boxing':
      case 'racquetball':
      case 'table_tennis':
      case 'table tennis':
      case 'tabletennis':
      case 'netball':
      case 'trapski':
      case 'skateboarding':
      case 'skating':
      case 'crossfit':
      case 'crossfit_wod':
      case 'crossfitwod':
      case 'gymnastics':
      case 'crossfit wod':
      case 'pickleball':
        return 'Group Sport';

      default:
        return 'Other';
    }
  }

  async disconnect(userId: string): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Disconnecting Strava',
      data: {
        service: StravaProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });

    try {
      // Get the access token before deletion
      const tokens = await this.tokens.get(userId, 'strava');

      if (tokens?.accessToken) {
        // Revoke the token with Strava
        // Strava provides a deauthorization endpoint
        try {
          await axios.post('https://www.strava.com/oauth/deauthorize', null, {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
            },
          });
          this.loggerInstance.logger(LogType.INFO, {
            message: 'Successfully revoked Strava token',
            data: {
              service: StravaProvider.name,
              method: MethodNames.disconnect,
              userId,
              provider: this.name,
            },
          });
        } catch (error) {
          // Log but don't throw - token might already be invalid
          this.loggerInstance.logger(LogType.INFO, {
            message: 'Failed to revoke Strava token (continuing disconnect)',
            data: {
              service: StravaProvider.name,
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
        message: 'Error during Strava disconnect',
        data: {
          service: StravaProvider.name,
          method: MethodNames.disconnect,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow disconnect to continue even if revocation fails
    }

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Strava disconnect completed',
      data: {
        service: StravaProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });
  }
}
