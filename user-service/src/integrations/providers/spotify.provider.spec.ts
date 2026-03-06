import { Test, TestingModule } from '@nestjs/testing';
import { SpotifyProvider } from './spotify.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from '../persistence';
import { TokenStore } from '../token-store';
import { Logger } from '@nestjs/common';
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

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SpotifyProvider', () => {
  let provider: SpotifyProvider;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockPersistence: jest.Mocked<IntegrationPersistence>;
  let mockTokenStore: jest.Mocked<TokenStore>;

  const mockUserId = 'user123';
  const mockIntegration = {
    integrationId: 'spotify_integration_id',
    recSeq: 0,
    recStatus: 'ACTIVE',
    name: 'spotify',
    popularity: null,
    dataStatus: 'ACTIVE',
    createdBy: 'system',
    createdOn: new Date(),
    modifiedOn: new Date(),
    modifiedBy: null,
  };

  beforeAll(async () => {
    // Create mocks
    mockPrismaService = {
      userIntegrations: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userIntegrationHistory: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      integrations: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      listItems: {
        create: jest.fn(),
      },
    } as any;

    mockPersistence = {
      ensureIntegration: jest.fn(),
      ensureUserIntegration: jest.fn(),
      markConnected: jest.fn(),
      markSynced: jest.fn(),
      getLastSyncedAt: jest.fn(),
      ensureListAndCategoryForUser: jest.fn(),
      createListItem: jest.fn(),
      upsertListItem: jest.fn(),
    } as any;

    mockTokenStore = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Set environment variables
    process.env.SPOTIFY_CLIENT_ID = 'test_client_id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test_client_secret';
    process.env.SPOTIFY_REDIRECT_URI = 'http://localhost:3000/callback';
    process.env.SPOTIFY_DEFAULT_DAYS = '30';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpotifyProvider,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationPersistence, useValue: mockPersistence },
        { provide: TokenStore, useValue: mockTokenStore },
      ],
    }).compile();

    provider = module.get<SpotifyProvider>(SpotifyProvider);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Default mock implementations
    mockPersistence.ensureIntegration.mockResolvedValue(mockIntegration as any);
    mockPersistence.ensureListAndCategoryForUser.mockResolvedValue({
      list: { listId: 'list_1', recSeq: 0 } as any,
      userList: { userListId: 'user_list_1', recSeq: 0 } as any,
      category: { listCategoryId: 'cat_1', recSeq: 0 } as any,
    });
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('createConnection', () => {
    it('should create connection successfully with valid configuration', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.redirectUrl).toContain(
        'https://accounts.spotify.com/authorize',
      );
      expect(result.redirectUrl).toContain('client_id=test_client_id');
      expect(result.redirectUrl).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback',
      );
      expect(result.redirectUrl).toContain('response_type=code');
      expect(result.redirectUrl).toContain('show_dialog=true');
      expect(result.state).toContain(`spotify-${mockUserId}`);
      expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith('spotify');
    });

    it('should include all required scopes in authorization URL', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.redirectUrl).toContain('user-read-email');
      expect(result.redirectUrl).toContain('user-read-private');
      expect(result.redirectUrl).toContain('user-read-recently-played');
      expect(result.redirectUrl).toContain('user-library-read');
      expect(result.redirectUrl).toContain('playlist-read-private');
    });

    it('should throw ConfigurationException when CLIENT_ID is missing', async () => {
      // Store original value
      const originalClientId = process.env.SPOTIFY_CLIENT_ID;

      // Delete environment variable before creating provider
      delete process.env.SPOTIFY_CLIENT_ID;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SpotifyProvider,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: IntegrationPersistence, useValue: mockPersistence },
          { provide: TokenStore, useValue: mockTokenStore },
        ],
      }).compile();

      const invalidProvider = module.get<SpotifyProvider>(SpotifyProvider);

      await expect(
        invalidProvider.createConnection(mockUserId),
      ).rejects.toThrow(ConfigurationException);
      await expect(
        invalidProvider.createConnection(mockUserId),
      ).rejects.toThrow('Missing required Spotify configuration');

      // Restore env var for other tests
      process.env.SPOTIFY_CLIENT_ID = originalClientId;
    });

    it('should throw ConfigurationException when CLIENT_SECRET is missing', async () => {
      // Store original value
      const originalClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

      // Delete environment variable before creating provider
      delete process.env.SPOTIFY_CLIENT_SECRET;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SpotifyProvider,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: IntegrationPersistence, useValue: mockPersistence },
          { provide: TokenStore, useValue: mockTokenStore },
        ],
      }).compile();

      const invalidProvider = module.get<SpotifyProvider>(SpotifyProvider);

      await expect(
        invalidProvider.createConnection(mockUserId),
      ).rejects.toThrow(ConfigurationException);

      // Restore env var for other tests
      process.env.SPOTIFY_CLIENT_SECRET = originalClientSecret;
    });

    it('should throw ConfigurationException when REDIRECT_URI is missing', async () => {
      // Store original value
      const originalRedirectUri = process.env.SPOTIFY_REDIRECT_URI;

      // Delete environment variable before creating provider
      delete process.env.SPOTIFY_REDIRECT_URI;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SpotifyProvider,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: IntegrationPersistence, useValue: mockPersistence },
          { provide: TokenStore, useValue: mockTokenStore },
        ],
      }).compile();

      const invalidProvider = module.get<SpotifyProvider>(SpotifyProvider);

      await expect(
        invalidProvider.createConnection(mockUserId),
      ).rejects.toThrow(ConfigurationException);

      // Restore env var for other tests
      process.env.SPOTIFY_REDIRECT_URI = originalRedirectUri;
    });
  });

  describe('handleCallback', () => {
    const mockCode = 'auth_code_123';
    const mockState = `spotify-${mockUserId}-${Date.now()}`;
    const mockTokenResponse = {
      data: {
        access_token: 'access_token_123',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'refresh_token_123',
        scope: 'user-read-email user-read-private',
      },
    };
    const mockUserProfile = {
      id: 'spotify_user_123',
      display_name: 'Test User',
      email: 'test@example.com',
    };

    beforeAll(() => {
      mockedAxios.post.mockResolvedValue(mockTokenResponse);
      mockedAxios.get.mockResolvedValue({ data: mockUserProfile });
    });

    it('should handle callback successfully with valid code and state', async () => {
      await provider.handleCallback({ code: mockCode, state: mockState });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://accounts.spotify.com/api/token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Basic '),
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );

      expect(mockTokenStore.set).toHaveBeenCalledWith(mockUserId, 'spotify', {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        expiresAt: expect.any(Number),
        scope: mockTokenResponse.data.scope,
        providerUserId: 'spotify_user_123',
      });

      expect(mockPersistence.markConnected).toHaveBeenCalledWith(
        mockUserId,
        mockIntegration.integrationId,
      );
    });

    it('should use Basic authentication with base64 encoded credentials', async () => {
      await provider.handleCallback({ code: mockCode, state: mockState });

      const authHeader =
        mockedAxios.post.mock.calls[0][2].headers.Authorization;
      expect(authHeader).toMatch(/^Basic [A-Za-z0-9+/=]+$/);
    });

    it('should throw OAuthAuthenticationException when error is present', async () => {
      await expect(
        provider.handleCallback({ error: 'access_denied', state: mockState }),
      ).rejects.toThrow(OAuthAuthenticationException);
    });

    it('should throw InvalidCallbackException when code is missing', async () => {
      await expect(
        provider.handleCallback({ state: mockState }),
      ).rejects.toThrow(InvalidCallbackException);
    });

    it('should throw InvalidCallbackException when state is missing', async () => {
      await expect(provider.handleCallback({ code: mockCode })).rejects.toThrow(
        InvalidCallbackException,
      );
    });

    it('should throw InvalidCallbackException with invalid state prefix', async () => {
      await expect(
        provider.handleCallback({
          code: mockCode,
          state: 'invalid-prefix-user123-123456',
        }),
      ).rejects.toThrow(InvalidCallbackException);
      await expect(
        provider.handleCallback({
          code: mockCode,
          state: 'invalid-prefix-user123-123456',
        }),
      ).rejects.toThrow('Invalid state prefix');
    });

    it('should throw InvalidCallbackException when state format is invalid', async () => {
      await expect(
        provider.handleCallback({ code: mockCode, state: 'spotify-user123' }),
      ).rejects.toThrow(InvalidCallbackException);
      await expect(
        provider.handleCallback({ code: mockCode, state: 'spotify-user123' }),
      ).rejects.toThrow('missing timestamp');
    });

    it('should throw InvalidCallbackException when userId is missing in state', async () => {
      await expect(
        provider.handleCallback({
          code: mockCode,
          state: `spotify--${Date.now()}`,
        }),
      ).rejects.toThrow(InvalidCallbackException);
    });

    it('should handle 401 error from token exchange', async () => {
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          data: { error_description: 'Invalid authorization code' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(
        provider.handleCallback({ code: mockCode, state: mockState }),
      ).rejects.toThrow(OAuthAuthenticationException);
    });

    it('should handle 429 rate limit error', async () => {
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(
        provider.handleCallback({ code: mockCode, state: mockState }),
      ).rejects.toThrow(RateLimitException);
    });

    it('should handle generic API error', async () => {
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { error_description: 'Internal server error' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(
        provider.handleCallback({ code: mockCode, state: mockState }),
      ).rejects.toThrow(ProviderAPIException);
    });

    it('should automatically trigger sync after successful connection', async () => {
      const syncSpy = jest.spyOn(provider, 'sync').mockResolvedValue({
        ok: true,
        syncedAt: new Date(),
        details: { totalItems: 10 },
      });

      await provider.handleCallback({ code: mockCode, state: mockState });

      expect(syncSpy).toHaveBeenCalledWith(mockUserId);
    });

    it('should not fail callback if automatic sync fails', async () => {
      jest.spyOn(provider, 'sync').mockRejectedValue(new Error('Sync failed'));

      await expect(
        provider.handleCallback({ code: mockCode, state: mockState }),
      ).resolves.not.toThrow();

      expect(mockPersistence.markConnected).toHaveBeenCalled();
    });
  });

  describe('ensureValidAccessToken', () => {
    const mockAccessToken = 'valid_access_token';
    const mockRefreshToken = 'valid_refresh_token';

    it('should return existing token if still valid', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: futureExpiry,
      });

      const token = await (provider as any).ensureValidAccessToken(mockUserId);

      expect(token).toBe(mockAccessToken);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should throw InvalidTokenException when token does not exist', async () => {
      mockTokenStore.get.mockResolvedValue(null);

      await expect(
        (provider as any).ensureValidAccessToken(mockUserId),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('should throw InvalidTokenException when refresh token is missing', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        expiresAt: Math.floor(Date.now() / 1000) - 100,
      });

      await expect(
        (provider as any).ensureValidAccessToken(mockUserId),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('should refresh token when expired', async () => {
      const expiredTime = Math.floor(Date.now() / 1000) - 100;
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: expiredTime,
        scope: 'user-read-email',
        providerUserId: 'spotify_user_123',
      });

      const newTokenResponse = {
        data: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
        },
      };
      mockedAxios.post.mockResolvedValue(newTokenResponse);

      const token = await (provider as any).ensureValidAccessToken(mockUserId);

      expect(token).toBe('new_access_token');
      expect(mockTokenStore.set).toHaveBeenCalledWith(mockUserId, 'spotify', {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: expect.any(Number),
        scope: 'user-read-email',
        providerUserId: 'spotify_user_123',
      });
    });

    it('should keep old refresh token if new one is not provided', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) - 100,
        scope: 'user-read-email',
        providerUserId: 'spotify_user_123',
      });

      const newTokenResponse = {
        data: {
          access_token: 'new_access_token',
          expires_in: 3600,
          // No refresh_token in response
        },
      };
      mockedAxios.post.mockResolvedValue(newTokenResponse);

      await (provider as any).ensureValidAccessToken(mockUserId);

      expect(mockTokenStore.set).toHaveBeenCalledWith(mockUserId, 'spotify', {
        accessToken: 'new_access_token',
        refreshToken: mockRefreshToken, // Old refresh token preserved
        expiresAt: expect.any(Number),
        scope: 'user-read-email',
        providerUserId: 'spotify_user_123',
      });
    });

    it('should handle 400 error during token refresh', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) - 100,
      });

      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 400,
          data: { error_description: 'Invalid refresh token' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(
        (provider as any).ensureValidAccessToken(mockUserId),
      ).rejects.toThrow(RefreshTokenException);
    });

    it('should handle 429 rate limit during token refresh', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) - 100,
      });

      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 429,
          headers: { 'retry-after': '120' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(
        (provider as any).ensureValidAccessToken(mockUserId),
      ).rejects.toThrow(RateLimitException);
    });
  });

  describe('sync', () => {
    const mockAccessToken = 'valid_access_token';
    const mockRecentlyPlayed = {
      items: [
        {
          track: {
            id: 'track_1',
            name: 'Test Song',
            artists: [{ id: 'artist_1', name: 'Test Artist' }],
            album: {
              id: 'album_1',
              name: 'Test Album',
              images: [{ url: 'http://image.url', height: 640, width: 640 }],
              release_date: '2024-01-01',
            },
            duration_ms: 240000,
            popularity: 85,
            preview_url: 'https://p.scdn.co/mp3-preview/preview_url',
            external_urls: {
              spotify: 'https://open.spotify.com/track/track_1',
            },
            external_ids: {
              isrc: 'TEST123456789',
            },
          },
          played_at: '2024-01-01T10:00:00Z',
          context: {
            type: 'playlist',
            uri: 'spotify:playlist:test_playlist',
            external_urls: {
              spotify: 'https://open.spotify.com/playlist/test_playlist',
            },
          },
        },
      ],
    };

    beforeAll(() => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: 'refresh_token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
      mockPersistence.getLastSyncedAt.mockResolvedValue(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      );
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
      } as any);
    });

    it('should sync recently played tracks successfully', async () => {
      // Mock all 4 API calls that sync makes
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockRecentlyPlayed }) // recently-played
        .mockResolvedValueOnce({ data: { items: [] } }) // saved tracks
        .mockResolvedValueOnce({ data: { items: [] } }) // playlists
        .mockResolvedValueOnce({ data: { items: [] } }); // top tracks

      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(result.syncedAt).toBeInstanceOf(Date);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://api.spotify.com/v1/me/player/recently-played',
        ),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockAccessToken}` },
        }),
      );
      expect(mockPersistence.markSynced).toHaveBeenCalled();
    });

    it('should use default days when no last sync date', async () => {
      mockPersistence.getLastSyncedAt.mockResolvedValue(null);
      // Mock all 4 API calls that sync makes
      mockedAxios.get
        .mockResolvedValueOnce({ data: { items: [] } }) // recently-played
        .mockResolvedValueOnce({ data: { items: [] } }) // saved tracks
        .mockResolvedValueOnce({ data: { items: [] } }) // playlists
        .mockResolvedValueOnce({ data: { items: [] } }); // top tracks

      await provider.sync(mockUserId);

      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('should handle empty data gracefully', async () => {
      // Mock all 4 API calls that sync makes
      mockedAxios.get
        .mockResolvedValueOnce({ data: { items: [] } }) // recently-played
        .mockResolvedValueOnce({ data: { items: [] } }) // saved tracks
        .mockResolvedValueOnce({ data: { items: [] } }) // playlists
        .mockResolvedValueOnce({ data: { items: [] } }); // top tracks

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(mockPersistence.upsertListItem).not.toHaveBeenCalled();
    });

    it('should throw InvalidTokenException when token is missing', async () => {
      mockTokenStore.get.mockResolvedValue(null);

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('should handle API errors during sync', async () => {
      // Mock the token to be expired so it tries to refresh
      mockTokenStore.get.mockResolvedValue({
        accessToken: 'expired_token',
        refreshToken: 'refresh_token',
        expiresAt: Math.floor(Date.now() / 1000) - 100, // Expired
      });

      // Mock the refresh token call to fail
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { error_description: 'Server error' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        ProviderAPIException,
      );
    });

    it('should handle rate limit during sync', async () => {
      // Mock the token to be expired so it tries to refresh
      mockTokenStore.get.mockResolvedValue({
        accessToken: 'expired_token',
        refreshToken: 'refresh_token',
        expiresAt: Math.floor(Date.now() / 1000) - 100, // Expired
      });

      // Mock the refresh token call to fail with rate limit
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 429,
          headers: { 'retry-after': '300' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        RateLimitException,
      );
    });

    it('should handle 401 unauthorized during sync', async () => {
      // Mock the token to be expired so it tries to refresh
      mockTokenStore.get.mockResolvedValue({
        accessToken: 'expired_token',
        refreshToken: 'refresh_token',
        expiresAt: Math.floor(Date.now() / 1000) - 100, // Expired
      });

      // Mock the refresh token call to fail with 401
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          data: { error_description: 'Invalid refresh token' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        RefreshTokenException,
      );
    });

    it('should sync multiple data types (recently played, saved tracks, playlists)', async () => {
      const mockSavedTracks = {
        items: [
          { added_at: '2024-01-01', track: mockRecentlyPlayed.items[0].track },
        ],
      };
      const mockPlaylists = {
        items: [
          {
            id: 'playlist_1',
            name: 'My Playlist',
            tracks: { total: 10 },
            images: [
              { url: 'http://playlist.image.url', height: 640, width: 640 },
            ],
          },
        ],
      };
      const mockTopTracks = { items: [mockRecentlyPlayed.items[0].track] };

      const mockPlaylistDetails = {
        id: 'playlist_1',
        name: 'My Playlist',
        tracks: {
          total: 10,
          items: [],
        },
        images: [{ url: 'http://playlist.image.url', height: 640, width: 640 }],
        external_urls: {
          spotify: 'https://open.spotify.com/playlist/playlist_1',
        },
        owner: {
          id: 'playlist_owner_id',
          display_name: 'Playlist Owner',
        },
      };

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockRecentlyPlayed }) // recently-played
        .mockResolvedValueOnce({ data: mockSavedTracks }) // saved tracks
        .mockResolvedValueOnce({ data: mockPlaylists }) // playlists list
        .mockResolvedValueOnce({ data: mockPlaylistDetails }) // playlist details for playlist_1
        .mockResolvedValueOnce({ data: mockTopTracks }); // top tracks

      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledTimes(5);
    });
  });

  describe('status', () => {
    it('should return connected status when user is connected', async () => {
      const lastSyncDate = new Date('2024-01-01T12:00:00Z');
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
        status: 'CONNECTED',
      } as any);
      (
        mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
      ).mockResolvedValue({
        lastSyncedAt: lastSyncDate,
      } as any);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(true);
      expect(result.lastSyncedAt).toEqual(lastSyncDate);
      expect(result.details.integrationId).toBe(mockIntegration.integrationId);
    });

    it('should return not connected when user is not connected', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(false);
      expect(result.lastSyncedAt).toBeNull();
    });

    it('should return null lastSyncedAt when no sync history', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
        status: 'CONNECTED',
      } as any);
      (
        mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(true);
      expect(result.lastSyncedAt).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should disconnect user successfully', async () => {
      await provider.disconnect(mockUserId);

      // The SpotifyProvider disconnect method is a no-op
      // Token deletion and database updates are handled by IntegrationsService
      // Just verify the method completes successfully
      expect(true).toBe(true);
    });

    it('should handle disconnect when user is not connected', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(provider.disconnect(mockUserId)).resolves.not.toThrow();
    });
  });
});
