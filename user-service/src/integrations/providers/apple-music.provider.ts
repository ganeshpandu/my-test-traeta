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
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
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
  ACTIVE_CONDITION,
} from '../../../constants';

interface AppleMusicPlayHistory {
  id: string;
  type: string;
  href: string;
  attributes: {
    playedDate: string;
    playDurationMillis?: number;
    endReasonType?: string;
    albumName: string;
    artistName: string;
    composerName?: string;
    discNumber?: number;
    durationInMillis: number;
    genreNames?: string[];
    hasLyrics?: boolean;
    isAppleDigitalMaster?: boolean;
    isrc?: string;
    name: string;
    releaseDate?: string;
    trackNumber?: number;
    url: string;
  };
}

@Injectable()
export class AppleMusicProvider implements IntegrationProvider {
  public readonly name = IntegrationProviderName.APPLE_MUSIC;

  constructor(
    private readonly db: PrismaService,
    private readonly persistence: IntegrationPersistence,
    private readonly tokens: TokenStore,
    private readonly configService: ConfigService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  private getTeamId(): string {
    return this.configService.get<string>('APPLE_MUSIC_TEAM_ID') || '';
  }

  private getKeyId(): string {
    return this.configService.get<string>('APPLE_MUSIC_KEY_ID') || '';
  }

  private getPrivateKey(): string {
    const key = this.configService.get<string>('APPLE_MUSIC_PRIVATE_KEY') || '';
    return key.replace(/\\n/g, '\n');
  }

  private getDefaultDays(): number {
    const days = this.configService.get<string>('APPLE_MUSIC_DEFAULT_DAYS');
    return days ? Number(days) : 30;
  }

  private getCallbackUrl(): string {
    const callbackUrl =
      this.configService.get<string>('APPLE_MUSIC_CALLBACK_URL') || '';
    return callbackUrl;
  }

  async disconnect(userId: string): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Disconnecting Apple Music',
      data: {
        service: AppleMusicProvider.name,
        method: MethodNames.disconnect,
        userId,
      },
    });

    try {
      // Note: Apple Music doesn't provide a token revocation endpoint
      // Music User Tokens are managed by the user's Apple ID and can only be revoked
      // by the user through their Apple ID settings or by revoking app permissions
      // We delete the token from our token store
      await this.tokens.delete(userId, 'apple_music');
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Apple Music disconnect completed',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.disconnect,
          userId,
        },
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to delete Apple Music token',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.disconnect,
          userId,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async createConnection(userId: string): Promise<ConnectResponse> {
    try {
      // Validate configuration
      const teamId = this.getTeamId();
      const keyId = this.getKeyId();
      const privateKey = this.getPrivateKey();

      if (!teamId || !keyId || !privateKey) {
        throw new ConfigurationException(
          IntegrationProviderName.APPLE_MUSIC,
          'Apple Music credentials are not configured. Please set APPLE_MUSIC_TEAM_ID, APPLE_MUSIC_KEY_ID, and APPLE_MUSIC_PRIVATE_KEY.',
        );
      }

      // Apple Music uses native MusicKit framework on mobile apps
      // For iOS: Uses MusicKit.requestUserToken()
      // For Android: Uses native MusicKit API
      const state = `apple-music-${userId}-${Date.now()}`;

      // Generate developer token for Apple Music API
      const developerToken = this.generateDeveloperToken();

      await this.persistence.ensureIntegration('apple_music');

      // Get callback URL for reference
      const callbackUrl = this.getCallbackUrl();

      // For mobile apps: Return developer token and state for native authorization
      // The mobile app will use native MusicKit to authorize and get music_user_token
      // Then it sends the music_user_token back to the callback endpoint
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Apple Music connection initiated',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.createConnection,
          userId,
        },
      });
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Developer token generated',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.createConnection,
          userId,
          state,
          callbackUrl,
        },
      });

      return {
        provider: this.name,
        // For mobile apps, no redirect URL - they use native MusicKit authorization
        redirectUrl: null,
        state,
        // Developer token for the mobile app to use with Apple Music API
        linkToken: developerToken,
        // Additional info for mobile clients
        details: {
          authorizationMethod: 'native',
          platform: 'iOS/Android',
          instructions:
            'Use native MusicKit.requestUserToken() to get music_user_token, then call the callback endpoint with it',
          callbackUrl: callbackUrl,
          developerToken: developerToken,
        },
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to create Apple Music connection',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.createConnection,
          userId,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw custom exceptions
      if (error instanceof ConfigurationException) {
        throw error;
      }

      throw new ConfigurationException(
        IntegrationProviderName.APPLE_MUSIC,
        `Failed to create connection: ${error.message}`,
      );
    }
  }

  async handleCallback(payload: CallbackPayload): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Apple Music callback received',
      data: {
        service: AppleMusicProvider.name,
        method: MethodNames.handleCallback,
      },
      input: payload,
    });

    const { code, state, music_user_token, error } = payload;

    // Check for OAuth errors first
    if (error) {
      throw new OAuthAuthenticationException(
        IntegrationProviderName.APPLE_MUSIC,
        `Apple Music OAuth error: ${error}`,
      );
    }

    if (!state) {
      throw new InvalidCallbackException(
        IntegrationProviderName.APPLE_MUSIC,
        'Missing required callback parameter: state',
      );
    }

    // Check if state has valid prefix
    if (!state.startsWith('apple-music-')) {
      throw new InvalidCallbackException(
        IntegrationProviderName.APPLE_MUSIC,
        'Invalid state prefix',
      );
    }

    // Extract userId from state format: "apple-music-<userId>-<ts>" or "apple-music-<userId>"
    // Remove "apple-music-" prefix and "-<timestamp>" suffix if present
    const stateWithoutPrefix = state.replace(/^apple-music-/, '');
    const lastDashIndex = stateWithoutPrefix.lastIndexOf('-');
    const userId =
      lastDashIndex > 0
        ? stateWithoutPrefix.substring(0, lastDashIndex)
        : stateWithoutPrefix;

    // Check if userId is empty or invalid (starts with dash, which means missing userId)
    if (!userId || userId.startsWith('-')) {
      throw new InvalidCallbackException(
        IntegrationProviderName.APPLE_MUSIC,
        'Invalid state format: unable to extract userId',
      );
    }

    // Apple Music requires music_user_token, not traditional OAuth code exchange
    if (!music_user_token) {
      throw new InvalidCallbackException(
        IntegrationProviderName.APPLE_MUSIC,
        'Missing required callback parameter: music_user_token must be provided',
      );
    }

    // Store the music user token
    await this.tokens.set(userId, 'apple_music', {
      accessToken: music_user_token,
      // Music user tokens don't expire but can be revoked
      expiresAt: Math.floor(Date.now() / 1000) + 31536000, // 1 year
    });

    // Mark as connected
    const integration = await this.persistence.ensureIntegration('apple_music');
    await this.persistence.markConnected(userId, integration.integrationId);

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Apple Music connected successfully',
      data: {
        service: AppleMusicProvider.name,
        method: MethodNames.handleCallback,
        userId,
      },
    });

    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Starting automatic sync after Apple Music connection',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
        },
      });
      const syncResult = await this.sync(userId);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Automatic sync completed',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
        },
      });
    } catch (syncError) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Automatic sync failed',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
        },
        error:
          syncError instanceof Error ? syncError.message : String(syncError),
      });
      // Don't throw error here as connection was successful, sync can be retried later
    }
  }

  async sync(
    userId: string,
    overrideCurrentDate?: Date,
  ): Promise<{ ok: boolean; syncedAt?: Date; details?: any }> {
    const currentFetchDate = overrideCurrentDate ?? new Date();
    const integration = await this.persistence.ensureIntegration('apple_music');
    const defaultDays = this.getDefaultDays();
    const sinceDate =
      (await this.persistence.getLastSyncedAt(
        userId,
        integration.integrationId,
      )) ??
      new Date(currentFetchDate.getTime() - defaultDays * 24 * 60 * 60 * 1000);

    try {
      const userToken = await this.tokens.get(userId, 'apple_music');

      if (!userToken) {
        throw new InvalidTokenException(IntegrationProviderName.APPLE_MUSIC);
      }

      // Generate developer token on-demand (it's the same for all users)
      const developerToken = this.generateDeveloperToken();

      let totalItems = 0;

      // Sync recently played tracks
      const recentlyPlayed = await this.fetchRecentlyPlayed(
        userToken.accessToken,
        developerToken,
        sinceDate,
      );
      if (recentlyPlayed.length > 0) {
        const newItemsCount = await this.processRecentlyPlayed(
          userId,
          recentlyPlayed,
          currentFetchDate,
        );
        totalItems += newItemsCount;
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
        syncedAt: currentFetchDate,
        details: {
          totalItems,
          recentlyPlayed: recentlyPlayed.length,
          since: sinceDate,
        },
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Apple Music sync failed',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.sync,
          userId,
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

      // Handle Axios errors from Apple Music API
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message =
          error.response?.data?.errors?.[0]?.detail || error.message;

        if (status === 429) {
          throw new RateLimitException(
            IntegrationProviderName.APPLE_MUSIC,
            error.response?.headers['retry-after'],
          );
        }

        if (status === 401 || status === 403) {
          throw new InvalidTokenException(IntegrationProviderName.APPLE_MUSIC);
        }

        throw new ProviderAPIException(
          IntegrationProviderName.APPLE_MUSIC,
          `Apple Music API error: ${message}`,
          status ? `Status code: ${status}` : undefined,
        );
      }

      // Generic sync error
      throw new DataSyncException(
        IntegrationProviderName.APPLE_MUSIC,
        `Failed to sync Apple Music data: ${error.message}`,
      );
    }
  }

  async status(userId: string): Promise<{
    connected: boolean;
    lastSyncedAt?: Date | null;
    details?: any;
  }> {
    const integration = await this.persistence.ensureIntegration('apple_music');
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
    const userToken = await this.tokens.get(userId, 'apple_music');

    // Check if developer token can be generated (credentials are configured)
    const teamId = this.getTeamId();
    const keyId = this.getKeyId();
    const privateKey = this.getPrivateKey();
    const hasDeveloperToken = !!(teamId && keyId && privateKey);

    return {
      connected: !!link && link.status === STATUS.CONNECTED,
      lastSyncedAt: history?.lastSyncedAt ?? null,
      details: {},
    };
  }

  private generateDeveloperToken(): string {
    const teamId = this.getTeamId();
    const keyId = this.getKeyId();
    const privateKey = this.getPrivateKey();

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: teamId,
      iat: now - 60,
      exp: now + 15777000, // 6 months
    };

    return jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: keyId,
        typ: 'JWT',
      },
    });
  }

  private async fetchRecentlyPlayed(
    userToken: string,
    developerToken: string,
    since: Date,
  ): Promise<AppleMusicPlayHistory[]> {
    try {
      const response = await axios.get(
        'https://api.music.apple.com/v1/me/recent/played/tracks',
        {
          headers: {
            Authorization: `Bearer ${developerToken.trim()}`,
            'Music-User-Token': userToken.trim(),
          },
        },
      );

      const items = response.data.data || [];
      return items;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Apple Music API fetch error',
        data: {
          service: AppleMusicProvider.name,
          method: MethodNames.fetchRecentlyPlayed,
          status: error.response?.status,
          statusText: error.response?.statusText,
          errorData: error.response?.data,
          headers: error.response?.headers,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw new ProviderAPIException(
        IntegrationProviderName.APPLE_MUSIC,
        `Failed to fetch recently played: ${error.message}`,
      );
    }
  }

  private getTrimmedSongs(fetchedSongs: any[], latestSongs: any[]): any[] {
    if (!Array.isArray(latestSongs) || latestSongs.length === 0) {
      return fetchedSongs;
    }

    const newSongs: any[] = [];
    const latestSongsCopy = [...latestSongs];

    for (const fetchedSong of fetchedSongs) {
      // If we find the song that was previously at the top (after accounting for reorders),
      // we've reached the end of the new plays.
      if (
        latestSongsCopy.length > 0 &&
        this.isSameSong(fetchedSong, latestSongsCopy[0])
      ) {
        break;
      }

      newSongs.push(fetchedSong);

      // If this song existed elsewhere in the previous list, remove it from the copy
      // to maintain the relative order of remaining items for the next iteration's check.
      const existingIndex = latestSongsCopy.findIndex((ls) =>
        this.isSameSong(fetchedSong, ls),
      );
      if (existingIndex !== -1) {
        latestSongsCopy.splice(existingIndex, 1);
      }
    }

    return newSongs;
  }

  private isSameSong(song1: any, song2: any): boolean {
    return (
      song1?.trackId === song2?.trackId &&
      song1?.song === song2?.song &&
      song1?.artist === song2?.artist &&
      song1?.album === song2?.album &&
      song1?.genre === song2?.genre
    );
  }

  private mergeAndDeduplicateSongs(
    fetchedSongs: any[],
    existingSongs: any[],
  ): any[] {
    if (
      !Array.isArray(fetchedSongs) ||
      !Array.isArray(existingSongs) ||
      existingSongs.length === 0
    ) {
      return fetchedSongs;
    }

    if (fetchedSongs.length === 0) {
      return existingSongs;
    }

    const deduplicatedSongs = [...fetchedSongs];

    for (const existingSong of existingSongs) {
      const isDuplicate = deduplicatedSongs.some((song) =>
        this.isSameSong(song, existingSong),
      );

      if (!isDuplicate) {
        deduplicatedSongs.push(existingSong);
      }
    }

    return deduplicatedSongs;
  }

  private async processRecentlyPlayed(
    userId: string,
    playHistory: AppleMusicPlayHistory[],
    overrideCurrentDate?: Date,
  ): Promise<number> {
    const { list, userList, category } =
      await this.persistence.ensureListAndCategoryForUser(userId, 'Music');

    const playsByDate = new Map<string, AppleMusicPlayHistory[]>();
    const currentFetchDate = overrideCurrentDate ?? new Date();
    let playedAt: string | Date = currentFetchDate;

    for (const play of playHistory) {
      playedAt = play.attributes.playedDate
        ? new Date(play.attributes.playedDate)
        : currentFetchDate;

      const date = playedAt.toISOString().split('T')[0];

      if (!playsByDate.has(date)) {
        playsByDate.set(date, []);
      }
      playsByDate.get(date).push(play);
    }

    const todayStr = currentFetchDate.toISOString().split('T')[0];
    if (!playsByDate.has(todayStr)) {
      playsByDate.set(todayStr, []);
    }

    let totalNewSongsSaved = 0;

    for (const [date, plays] of playsByDate) {
      const attributesArray = plays.map((play) => {
        const track = play.attributes;

        return {
          trackId: play.id,
          song: track.name,
          artist: track.artistName,
          genre: Array.isArray(track.genreNames)
            ? track.genreNames.join(', ')
            : (track.genreNames ?? ''),
          album: track.albumName,
        };
      });

      const attributeDataType = {
        trackId: DATA_TYPE.STRING,
        song: DATA_TYPE.STRING,
        artist: DATA_TYPE.STRING,
        genre: DATA_TYPE.STRING,
        album: DATA_TYPE.STRING,
      };

      const externalId = `apple_music_${playedAt}`;

      const existingItem = await this.db.listItems.findFirst({
        where: {
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          userListId: userList.userListId,
          userListRecSeq: REC_SEQ.DEFAULT_RECORD,
          attributes: {
            path: ['external', 'id'],
            equals: externalId,
          },
          ...ACTIVE_CONDITION,
        },
      });

      const latestItem = await this.db.listItems.findFirst({
        where: {
          listId: list.listId,
          listRecSeq: REC_SEQ.DEFAULT_RECORD,
          userListId: userList.userListId,
          userListRecSeq: REC_SEQ.DEFAULT_RECORD,
          attributes: {
            path: ['external', 'provider'],
            equals: 'apple_music',
          },
          // Ensure we don't compare against an empty record which would break trimming
          NOT: {
            attributes: {
              path: ['rawData'],
              equals: [],
            },
          },
          ...ACTIVE_CONDITION,
        },
        orderBy: {
          createdOn: 'desc',
        },
      });

      const latestSongs = Array.isArray(
        (latestItem?.attributes as any)?.rawData,
      )
        ? (latestItem.attributes as any).rawData
        : Array.isArray((latestItem?.attributes as any)?.songs)
          ? (latestItem.attributes as any).songs
          : [];

      // Identify only truly new songs relative to the latest record
      const trimmedAttributesArray = this.getTrimmedSongs(
        attributesArray,
        latestSongs,
      );

      if (trimmedAttributesArray.length === 0) {
        if (date === todayStr && !existingItem) {
          // Allow creation of empty record for today
        } else {
          continue;
        }
      }

      if (existingItem) {
        const existingAttributes = existingItem.attributes as any;
        const existingSongs = Array.isArray(existingAttributes?.songs)
          ? existingAttributes.songs
          : [];

        const mergedSongs = this.mergeAndDeduplicateSongs(
          trimmedAttributesArray,
          existingSongs,
        );

        const totalMergedSongs = mergedSongs.length;
        const updatedTitle = `${totalMergedSongs} song${totalMergedSongs !== 1 ? 's' : ''}`;

        await this.db.listItems.update({
          where: {
            listItemId_recSeq: {
              listItemId: existingItem.listItemId,
              recSeq: REC_SEQ.DEFAULT_RECORD,
            },
            ...ACTIVE_CONDITION,
          },
          data: {
            title: updatedTitle,
            attributes: {
              date: (existingAttributes?.date as string) || date,
              syncedAt: currentFetchDate.toISOString(),
              rawData: attributesArray,
              songs: mergedSongs,
              external: {
                provider: 'apple_music',
                id: externalId,
                type: 'play_history',
              },
            },
            attributeDataType,
            modifiedBy: userId,
            ...ACTIVE_CONDITION,
          },
        });
        totalNewSongsSaved += trimmedAttributesArray.length;
      } else {
        const totalSongs = trimmedAttributesArray.length;
        const title = `${totalSongs} song${totalSongs !== 1 ? 's' : ''}`;

        await this.db.listItems.create({
          data: {
            listId: list.listId,
            listRecSeq: REC_SEQ.DEFAULT_RECORD,
            userListId: userList.userListId,
            userListRecSeq: REC_SEQ.DEFAULT_RECORD,
            categoryId: category?.itemCategoryId ?? null,
            categoryRecSeq: REC_SEQ.DEFAULT_RECORD,
            title: title,
            notes: '',
            attributes: {
              date: date,
              syncedAt: currentFetchDate.toISOString(),
              rawData: attributesArray,
              songs: trimmedAttributesArray,
              external: {
                provider: 'apple_music',
                id: externalId,
                type: 'play_history',
              },
            },
            attributeDataType,
            isCustom: false,
            createdBy: userId,
            ...ACTIVE_CONDITION,
          },
        });
        totalNewSongsSaved += totalSongs;
      }
    }

    return totalNewSongsSaved;
  }
}
