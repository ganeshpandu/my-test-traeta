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
  ProviderAPIException,
  InvalidTokenException,
  RefreshTokenException,
  DataSyncException,
  RateLimitException,
} from '../exceptions/integration.exceptions';
import {
  ACTIVE_CONDITION,
  DATA_TYPE,
  REC_SEQ,
  STATUS,
  LogType,
  MethodNames,
} from '../../../constants';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
    release_date: string;
  };
  duration_ms: number;
  external_ids: {
    isrc?: string;
  };
  external_urls: {
    spotify: string;
  };
  popularity: number;
  preview_url?: string;
}

interface SpotifyPlayHistoryItem {
  track: SpotifyTrack;
  played_at: string;
  context?: {
    type: string;
    href: string;
    external_urls: {
      spotify: string;
    };
    uri: string;
  };
}

interface SpotifySavedTrack {
  added_at: string;
  track: SpotifyTrack;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  public: boolean;
  collaborative: boolean;
  owner: {
    id: string;
    display_name: string;
  };
  tracks: {
    total: number;
    items: Array<{
      added_at: string;
      track: SpotifyTrack;
    }>;
  };
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  external_urls: {
    spotify: string;
  };
}

interface SpotifyUserProfile {
  id: string;
  display_name: string;
  email: string;
  country: string;
  followers: {
    total: number;
  };
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
}

@Injectable()
export class SpotifyProvider implements IntegrationProvider {
  public readonly name = 'spotify' as IntegrationProviderName;

  constructor(
    private readonly db: PrismaService,
    private readonly persistence: IntegrationPersistence,
    private readonly tokens: TokenStore,
    private readonly configService: ConfigService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  private getClientId(): string {
    return this.configService.get<string>('SPOTIFY_CLIENT_ID') || '';
  }

  private getClientSecret(): string {
    return this.configService.get<string>('SPOTIFY_CLIENT_SECRET') || '';
  }

  private getRedirectUri(): string {
    return this.configService.get<string>('SPOTIFY_REDIRECT_URI') || '';
  }

  private getDefaultDays(): number {
    const days = this.configService.get<string>('SPOTIFY_DEFAULT_DAYS');
    return days ? Number(days) : 45;
  }

  async createConnection(userId: string): Promise<ConnectResponse> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ConfigurationException(
        this.name,
        'Missing required Spotify configuration (CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI)',
      );
    }

    const state = `spotify-${userId}-${Date.now()}`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope:
        'user-read-email user-read-private user-read-recently-played user-read-playback-state user-library-read playlist-read-private playlist-read-collaborative user-top-read',
      redirect_uri: redirectUri,
      state,
      show_dialog: 'true', // Force user to approve app again
    });
    const redirectUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
    await this.persistence.ensureIntegration('spotify');
    return { provider: this.name, redirectUrl, state };
  }

  async handleCallback(payload: CallbackPayload): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Spotify callback received',
      data: {
        service: SpotifyProvider.name,
        method: MethodNames.handleCallback,
      },
    });
    const { code, state, error } = payload;

    if (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Spotify callback error',
        data: {
          service: SpotifyProvider.name,
          method: MethodNames.handleCallback,
        },
        error: error,
      });
      throw new OAuthAuthenticationException(
        this.name,
        `OAuth error: ${error}`,
      );
    }

    if (!code || !state) {
      throw new InvalidCallbackException(
        this.name,
        'Missing authorization code or state parameter',
      );
    }

    const stateStr = String(state);
    const prefix = `${this.name}-`;
    if (!stateStr.startsWith(prefix)) {
      throw new InvalidCallbackException(
        this.name,
        `Invalid state prefix: expected '${prefix}', got '${stateStr.split('-')[0]}-'`,
      );
    }

    const statePayload = stateStr.slice(prefix.length);
    const lastHyphenIndex = statePayload.lastIndexOf('-');
    if (lastHyphenIndex === -1) {
      throw new InvalidCallbackException(
        this.name,
        'Invalid state format: missing timestamp',
      );
    }

    const userId = statePayload.slice(0, lastHyphenIndex);
    if (!userId) {
      throw new InvalidCallbackException(
        this.name,
        'Missing userId in state parameter',
      );
    }

    try {
      // Exchange authorization code for access token
      const tokenUrl = 'https://accounts.spotify.com/api/token';
      const clientId = this.getClientId();
      const clientSecret = this.getClientSecret();
      const redirectUri = this.getRedirectUri();
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString(
        'base64',
      );

      const tokenResponse = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokenData = tokenResponse.data;
      const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      // Get user profile to store user ID
      const userProfile = await this.fetchUserProfile(tokenData.access_token);

      // Store tokens
      await this.tokens.set(userId, 'spotify', {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        scope: tokenData.scope,
        providerUserId: userProfile.id,
      });

      // Mark as connected
      const integration = await this.persistence.ensureIntegration('spotify');
      await this.persistence.markConnected(userId, integration.integrationId);

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Spotify connected successfully',
        data: {
          service: SpotifyProvider.name,
          method: MethodNames.handleCallback,
          userId,
          provider: this.name,
        },
      });

      // Automatically sync user data after successful connection
      try {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Starting automatic sync after Spotify connection',
          data: {
            service: SpotifyProvider.name,
            method: MethodNames.handleCallback,
            userId,
            provider: this.name,
          },
        });
        const syncResult = await this.sync(userId);
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Automatic sync completed after connection',
          data: {
            service: SpotifyProvider.name,
            method: MethodNames.handleCallback,
            userId,
            provider: this.name,
            syncResult: syncResult.ok,
          },
        });
      } catch (syncError) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Automatic sync failed after connection',
          data: {
            service: SpotifyProvider.name,
            method: MethodNames.handleCallback,
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
        message: 'Failed to handle Spotify callback',
        data: {
          service: SpotifyProvider.name,
          method: MethodNames.handleCallback,
          userId,
          provider: this.name,
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

      // Handle Axios errors from Spotify API
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message =
          error.response?.data?.error_description || error.message;

        if (status === 401 || status === 403) {
          throw new OAuthAuthenticationException(
            this.name,
            `Failed to exchange authorization code: ${message}`,
          );
        } else if (status === 429) {
          throw new RateLimitException(
            this.name,
            error.response?.headers['retry-after'],
          );
        } else {
          throw new ProviderAPIException(
            this.name,
            'Token exchange failed',
            status ? `${message} (status: ${status})` : message,
          );
        }
      }

      // Generic error
      throw new OAuthAuthenticationException(
        this.name,
        `Unexpected error during callback: ${error.message}`,
      );
    }
  }

  private async ensureValidAccessToken(userId: string): Promise<string> {
    const existing = await this.tokens.get(userId, 'spotify');
    if (!existing) {
      throw new InvalidTokenException(this.name);
    }

    const now = Math.floor(Date.now() / 1000);
    if (existing.expiresAt && existing.expiresAt - now > 60) {
      return existing.accessToken; // Still valid
    }

    if (!existing.refreshToken) {
      throw new InvalidTokenException(this.name);
    }

    // Refresh the token
    try {
      const tokenUrl = 'https://accounts.spotify.com/api/token';
      const authHeader = Buffer.from(
        `${this.getClientId()}:${this.getClientSecret()}`,
      ).toString('base64');

      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: existing.refreshToken,
        }),
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const tokenData = response.data;
      const newExpiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      // Update stored tokens
      await this.tokens.set(userId, 'spotify', {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || existing.refreshToken, // Spotify may not return new refresh token
        expiresAt: newExpiresAt,
        scope: existing.scope,
        providerUserId: existing.providerUserId,
      });

      return tokenData.access_token;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to refresh Spotify token',
        data: {
          service: SpotifyProvider.name,
          method: 'refreshAccessToken',
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message =
          error.response?.data?.error_description || error.message;

        if (status === 400 || status === 401) {
          throw new RefreshTokenException(this.name);
        } else if (status === 429) {
          throw new RateLimitException(
            this.name,
            error.response?.headers['retry-after'],
          );
        } else {
          throw new ProviderAPIException(
            this.name,
            'Token refresh failed',
            status ? `${message} (status: ${status})` : message,
          );
        }
      }

      throw new RefreshTokenException(this.name);
    }
  }

  async sync(
    userId: string,
  ): Promise<{ ok: boolean; syncedAt?: Date; details?: any }> {
    const integration = await this.persistence.ensureIntegration('spotify');
    const defaultDays = this.getDefaultDays();
    const sinceDate =
      (await this.persistence.getLastSyncedAt(
        userId,
        integration.integrationId,
      )) ?? new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000);

    try {
      const accessToken = await this.ensureValidAccessToken(userId);
      let totalItems = 0;

      // Sync recently played tracks
      const recentlyPlayed = await this.fetchRecentlyPlayed(
        accessToken,
        sinceDate,
      );
      if (recentlyPlayed.length > 0) {
        await this.processRecentlyPlayed(userId, recentlyPlayed);
        totalItems += recentlyPlayed.length;
      }

      // Sync user's saved tracks (liked songs)
      const savedTracks = await this.fetchSavedTracks(accessToken, sinceDate);
      if (savedTracks.length > 0) {
        await this.processSavedTracks(userId, savedTracks);
        totalItems += savedTracks.length;
      }

      // Sync user's playlists
      const playlists = await this.fetchUserPlaylists(accessToken);
      if (playlists.length > 0) {
        await this.processPlaylists(userId, playlists);
        totalItems += playlists.length;
      }

      // Sync top tracks
      const topTracks = await this.fetchTopTracks(accessToken);
      if (topTracks.length > 0) {
        await this.processTopTracks(userId, topTracks);
        totalItems += topTracks.length;
      }

      // Mark as synced
      const link = await this.db.userIntegrations.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId: integration.integrationId,
          integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
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
          recentlyPlayed: recentlyPlayed.length,
          savedTracks: savedTracks.length,
          playlists: playlists.length,
          topTracks: topTracks.length,
          since: sinceDate,
        },
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Spotify sync failed',
        data: {
          service: SpotifyProvider.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
        },
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

      // Handle Axios errors from Spotify API
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;

        if (status === 429) {
          throw new RateLimitException(
            this.name,
            error.response?.headers['retry-after'],
          );
        } else if (status === 401 || status === 403) {
          throw new InvalidTokenException(this.name);
        } else {
          throw new ProviderAPIException(
            this.name,
            'Spotify API error during sync',
            status ? `${message} (status: ${status})` : message,
          );
        }
      }

      // Generic sync error
      throw new DataSyncException(
        this.name,
        `Failed to sync Spotify data: ${error.message}`,
      );
    }
  }

  async status(userId: string): Promise<{
    connected: boolean;
    lastSyncedAt?: Date | null;
    details?: any;
  }> {
    const integration = await this.persistence.ensureIntegration('spotify');
    const link = await this.db.userIntegrations.findFirst({
      where: {
        userId,
        userRecSeq: REC_SEQ.DEFAULT_RECORD,
        integrationId: integration.integrationId,
        integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
        ...ACTIVE_CONDITION,
      },
    });

    const history = link
      ? await this.db.userIntegrationHistory.findFirst({
          where: {
            userIntegrationId: link.userIntegrationId,
            userIntegrationRecSeq: REC_SEQ.DEFAULT_RECORD,
            ...ACTIVE_CONDITION,
          },
        })
      : null;

    // Check if tokens are still valid
    const tokens = await this.tokens.get(userId, 'spotify');

    return {
      connected: !!link && link.status === STATUS.CONNECTED,
      lastSyncedAt: history?.lastSyncedAt ?? null,
      details: {
        integrationId: integration.integrationId,
        popularity: integration.popularity,
        hasTokens: !!tokens,
        tokenExpiry: tokens?.expiresAt
          ? new Date(tokens.expiresAt * 1000)
          : null,
        providerUserId: tokens?.providerUserId,
      },
    };
  }

  private async fetchUserProfile(
    accessToken: string,
  ): Promise<SpotifyUserProfile> {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to fetch Spotify user profile',
        data: {
          service: SpotifyProvider.name,
          method: 'fetchUserProfile',
        },
        error: error instanceof Error ? error.message : String(error),
      });
      console.error('Failed to fetch user profile:', error);
    }
  }

  private async fetchRecentlyPlayed(
    accessToken: string,
    since: Date,
  ): Promise<SpotifyPlayHistoryItem[]> {
    try {
      const response = await axios.get(
        'https://api.spotify.com/v1/me/player/recently-played',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            after: since.getTime(), // Unix timestamp in milliseconds
          },
        },
      );

      return response.data.items || [];
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to fetch recently played tracks',
        data: {
          service: SpotifyProvider.name,
          method: 'fetchRecentlyPlayedTracks',
        },
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchSavedTracks(
    accessToken: string,
    since: Date,
  ): Promise<SpotifySavedTrack[]> {
    try {
      const allTracks: SpotifySavedTrack[] = [];
      let offset = 0;
      const limit = 50;

      while (true) {
        const response = await axios.get(
          'https://api.spotify.com/v1/me/tracks',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        const items = response.data.items || [];
        if (items.length === 0) break;

        // Filter by date
        const filteredItems = items.filter((item) => {
          const addedDate = new Date(item.added_at);
          return addedDate >= since;
        });

        allTracks.push(...filteredItems);

        // If we got fewer items than requested, we've reached the end
        if (items.length < limit) break;

        offset += limit;

        // Limit to prevent infinite loops
        if (offset >= 1000) break;
      }

      return allTracks;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to fetch saved tracks',
        data: {
          service: SpotifyProvider.name,
          method: 'fetchSavedTracks',
        },
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchUserPlaylists(
    accessToken: string,
  ): Promise<SpotifyPlaylist[]> {
    try {
      const allPlaylists: SpotifyPlaylist[] = [];
      let offset = 0;
      const limit = 50;

      while (true) {
        const response = await axios.get(
          'https://api.spotify.com/v1/me/playlists',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        const items = response.data.items || [];
        if (items.length === 0) break;

        // Fetch detailed playlist info including tracks
        for (const playlist of items) {
          try {
            const detailedPlaylist = await this.fetchPlaylistDetails(
              accessToken,
              playlist.id,
            );
            allPlaylists.push(detailedPlaylist);
          } catch (error) {
            this.loggerInstance.logger(LogType.ERROR, {
              message: 'Failed to fetch playlist details',
              data: {
                service: SpotifyProvider.name,
                method: 'fetchUserPlaylists',
                playlistId: playlist.id,
              },
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (items.length < limit) break;
        offset += limit;

        // Limit to prevent infinite loops
        if (offset >= 200) break;
      }

      return allPlaylists;
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to fetch user playlists',
        data: {
          service: SpotifyProvider.name,
          method: 'fetchUserPlaylists',
        },
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async fetchPlaylistDetails(
    accessToken: string,
    playlistId: string,
  ): Promise<SpotifyPlaylist> {
    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields:
            'id,name,description,public,collaborative,owner,tracks.total,tracks.items(added_at,track(id,name,artists,album,duration_ms,external_ids,external_urls,popularity,preview_url)),images,external_urls',
        },
      },
    );
    return response.data;
  }

  private async fetchTopTracks(accessToken: string): Promise<SpotifyTrack[]> {
    try {
      const response = await axios.get(
        'https://api.spotify.com/v1/me/top/tracks',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            time_range: 'medium_term', // Last 6 months
          },
        },
      );

      return response.data.items || [];
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to fetch top tracks',
        data: {
          service: SpotifyProvider.name,
          method: 'fetchTopTracks',
        },
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async processRecentlyPlayed(
    userId: string,
    playHistory: SpotifyPlayHistoryItem[],
  ): Promise<void> {
    for (const item of playHistory) {
      const track = item.track;
      const { list, userList, category } =
        await this.persistence.ensureListAndCategoryForUser(userId, 'Music');

      const playedAt = new Date(item.played_at);
      const artistNames = track.artists.map((artist) => artist.name).join(', ');
      const imageUrl =
        track.album.images.length > 0 ? track.album.images[0].url : null;

      await this.persistence.createListItem(
        list.listId,
        REC_SEQ.DEFAULT_RECORD,
        userList.userListId,
        REC_SEQ.DEFAULT_RECORD,
        category?.itemCategoryId ?? null,
        REC_SEQ.DEFAULT_RECORD,
        `${track.name} | Recently Played`,
        {
          endTime: playedAt.toISOString(),
          playedAt: playedAt.toISOString(),
          trackName: track.name,
          artistName: artistNames,
          albumName: track.album.name,
          durationMs: track.duration_ms,
          releaseDate: track.album.release_date,
          popularity: track.popularity,
          previewUrl: track.preview_url,
          spotifyUrl: track.external_urls.spotify,
          isrc: track.external_ids.isrc,
          artwork: imageUrl,
          context: item.context
            ? {
                type: item.context.type,
                uri: item.context.uri,
                url: item.context.external_urls.spotify,
              }
            : null,
          external: {
            provider: 'spotify',
            id: track.id,
            type: 'recently_played',
          },
        },
        {
          endTime: DATA_TYPE.STRING,
          playedAt: DATA_TYPE.STRING,
          trackName: DATA_TYPE.STRING,
          artistName: DATA_TYPE.STRING,
          albumName: DATA_TYPE.STRING,
          durationMs: DATA_TYPE.NUMBER,
          releaseDate: DATA_TYPE.STRING,
          popularity: DATA_TYPE.NUMBER,
          previewUrl: DATA_TYPE.STRING,
          spotifyUrl: DATA_TYPE.STRING,
          isrc: DATA_TYPE.STRING,
          artwork: DATA_TYPE.STRING,
          context: {
            type: DATA_TYPE.STRING,
            uri: DATA_TYPE.STRING,
            url: DATA_TYPE.STRING,
          },
          external: {
            provider: DATA_TYPE.STRING,
            id: DATA_TYPE.STRING,
            type: DATA_TYPE.STRING,
          },
        },
        userId,
      );
    }
  }

  private async processSavedTracks(
    userId: string,
    savedTracks: Array<{ added_at: string; track: SpotifyTrack }>,
  ): Promise<void> {
    for (const item of savedTracks) {
      const track = item.track;
      const { list, userList, category } =
        await this.persistence.ensureListAndCategoryForUser(userId, 'Music');

      const addedAt = new Date(item.added_at);
      const artistNames = track.artists.map((artist) => artist.name).join(', ');
      const imageUrl =
        track?.album?.images?.length > 0 ? track.album.images[0].url : null;

      await this.persistence.createListItem(
        list.listId,
        REC_SEQ.DEFAULT_RECORD,
        userList.userListId,
        REC_SEQ.DEFAULT_RECORD,
        category?.itemCategoryId ?? null,
        REC_SEQ.DEFAULT_RECORD,
        `${track.name} | Saved Tracks`,
        {
          startTime: addedAt.toISOString(),
          addedAt: addedAt.toISOString(),
          trackName: track.name,
          artistName: artistNames,
          albumName: track.album.name,
          durationMs: track.duration_ms,
          releaseDate: track.album.release_date,
          popularity: track.popularity,
          previewUrl: track.preview_url,
          spotifyUrl: track.external_urls.spotify,
          isrc: track.external_ids.isrc,
          artwork: imageUrl,
          external: {
            provider: 'spotify',
            id: track.id,
            type: 'saved_track',
          },
        },
        {
          startTime: DATA_TYPE.STRING,
          addedAt: DATA_TYPE.STRING,
          trackName: DATA_TYPE.STRING,
          artistName: DATA_TYPE.STRING,
          albumName: DATA_TYPE.STRING,
          durationMs: DATA_TYPE.NUMBER,
          releaseDate: DATA_TYPE.STRING,
          popularity: DATA_TYPE.NUMBER,
          previewUrl: DATA_TYPE.STRING,
          spotifyUrl: DATA_TYPE.STRING,
          isrc: DATA_TYPE.STRING,
          artwork: DATA_TYPE.STRING,
          external: {
            provider: DATA_TYPE.STRING,
            id: DATA_TYPE.STRING,
            type: DATA_TYPE.STRING,
          },
        },
        userId,
      );
    }
  }

  private async processPlaylists(
    userId: string,
    playlists: SpotifyPlaylist[],
  ): Promise<void> {
    for (const playlist of playlists) {
      const { list, userList, category } =
        await this.persistence.ensureListAndCategoryForUser(userId, 'Music');

      const imageUrl =
        playlist?.images?.length > 0 ? playlist.images[0].url : null;
      const trackCount = playlist?.tracks?.total;

      await this.persistence.createListItem(
        list.listId,
        REC_SEQ.DEFAULT_RECORD,
        userList.userListId,
        REC_SEQ.DEFAULT_RECORD,
        category?.itemCategoryId ?? null,
        REC_SEQ.DEFAULT_RECORD,
        `${playlist.name} | Playlists`,
        {
          playlistName: playlist.name,
          description: playlist.description,
          isPublic: playlist.public,
          isCollaborative: playlist.collaborative,
          ownerName: playlist.owner.display_name,
          ownerId: playlist.owner.id,
          trackCount,
          spotifyUrl: playlist.external_urls.spotify,
          artwork: imageUrl,
          tracks: playlist.tracks.items.slice(0, 10).map((item) => ({
            // Store first 10 tracks
            name: item.track.name,
            artist: item.track.artists.map((a) => a.name).join(', '),
            addedAt: item.added_at,
          })),
          external: {
            provider: 'spotify',
            id: playlist.id,
            type: 'playlist',
          },
        },
        {
          playlistName: DATA_TYPE.STRING,
          description: DATA_TYPE.STRING,
          isPublic: DATA_TYPE.BOOLEAN,
          isCollaborative: DATA_TYPE.BOOLEAN,
          ownerName: DATA_TYPE.STRING,
          ownerId: DATA_TYPE.STRING,
          trackCount: DATA_TYPE.NUMBER,
          spotifyUrl: DATA_TYPE.STRING,
          artwork: DATA_TYPE.STRING,
          tracks: DATA_TYPE.STRING_ARRAY,
          external: {
            provider: DATA_TYPE.STRING,
            id: DATA_TYPE.STRING,
            type: DATA_TYPE.STRING,
          },
        },
        userId,
      );
    }
  }

  private async processTopTracks(
    userId: string,
    topTracks: SpotifyTrack[],
  ): Promise<void> {
    for (const track of topTracks) {
      const { list, userList, category } =
        await this.persistence.ensureListAndCategoryForUser(userId, 'Music');

      const artistNames = track.artists.map((artist) => artist.name).join(', ');
      const imageUrl =
        track.album.images.length > 0 ? track.album.images[0].url : null;

      await this.persistence.createListItem(
        list.listId,
        REC_SEQ.DEFAULT_RECORD,
        userList.userListId,
        REC_SEQ.DEFAULT_RECORD,
        category?.itemCategoryId ?? null,
        REC_SEQ.DEFAULT_RECORD,
        `${track.name} | Top Tracks`,
        {
          startTime: track.album.release_date,
          trackName: track.name,
          artistName: artistNames,
          albumName: track.album.name,
          durationMs: track.duration_ms,
          releaseDate: track.album.release_date,
          popularity: track.popularity,
          previewUrl: track.preview_url,
          spotifyUrl: track.external_urls.spotify,
          isrc: track.external_ids.isrc,
          artwork: imageUrl,
          external: {
            provider: 'spotify',
            id: track.id,
            type: 'top_track',
          },
        },
        {
          startTime: DATA_TYPE.STRING,
          trackName: DATA_TYPE.STRING,
          artistName: DATA_TYPE.STRING,
          albumName: DATA_TYPE.STRING,
          durationMs: DATA_TYPE.NUMBER,
          releaseDate: DATA_TYPE.STRING,
          popularity: DATA_TYPE.NUMBER,
          previewUrl: DATA_TYPE.STRING,
          spotifyUrl: DATA_TYPE.STRING,
          isrc: DATA_TYPE.STRING,
          artwork: DATA_TYPE.STRING,
          external: {
            provider: DATA_TYPE.STRING,
            id: DATA_TYPE.STRING,
            type: DATA_TYPE.STRING,
          },
        },
        userId,
      );
    }
  }

  async disconnect(userId: string): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Starting Spotify disconnect',
      data: {
        service: SpotifyProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });

    // Note: Spotify doesn't provide a token revocation endpoint
    // The tokens will be deleted from our token store by the IntegrationsService
    // Users can revoke access manually at: https://www.spotify.com/account/apps/

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Spotify disconnect completed',
      data: {
        service: SpotifyProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });
  }
}
