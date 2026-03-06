import { Test, TestingModule } from '@nestjs/testing';
import { StravaProvider } from './strava.provider';
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

describe('StravaProvider', () => {
  let provider: StravaProvider;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockPersistence: jest.Mocked<IntegrationPersistence>;
  let mockTokenStore: jest.Mocked<TokenStore>;

  const mockUserId = 'user123';
  const mockIntegration = {
    integrationId: 'strava_integration_id',
    recSeq: 0,
    recStatus: 'ACTIVE',
    name: 'strava',
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
    process.env.STRAVA_CLIENT_ID = 'test_client_id';
    process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
    process.env.STRAVA_REDIRECT_URI = 'http://localhost:3000/callback';
    process.env.STRAVA_DEFAULT_DAYS = '90';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StravaProvider,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationPersistence, useValue: mockPersistence },
        { provide: TokenStore, useValue: mockTokenStore },
      ],
    }).compile();

    provider = module.get<StravaProvider>(StravaProvider);

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
        'https://www.strava.com/oauth/authorize',
      );
      expect(result.redirectUrl).toContain('client_id=test_client_id');
      expect(result.redirectUrl).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback',
      );
      expect(result.redirectUrl).toContain('scope=read%2Cactivity%3Aread_all');
      expect(result.state).toContain(`strava-${mockUserId}`);
      expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith('strava');
    });

    it('should throw ConfigurationException when CLIENT_ID is missing', async () => {
      // Create a new provider instance with missing CLIENT_ID
      process.env.STRAVA_CLIENT_ID = '';
      const newProvider = new StravaProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );

      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        'Strava integration is not properly configured',
      );

      // Restore for other tests
      process.env.STRAVA_CLIENT_ID = 'test_client_id';
    });

    it('should throw ConfigurationException when CLIENT_SECRET is missing', async () => {
      // Create a new provider instance with missing CLIENT_SECRET
      process.env.STRAVA_CLIENT_SECRET = '';
      const newProvider = new StravaProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );

      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );

      // Restore for other tests
      process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
    });

    it('should throw ConfigurationException when REDIRECT_URI is missing', async () => {
      // Create a new provider instance with missing REDIRECT_URI
      process.env.STRAVA_REDIRECT_URI = '';
      const newProvider = new StravaProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );

      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );

      // Restore for other tests
      process.env.STRAVA_REDIRECT_URI = 'http://localhost:3000/callback';
    });

    it('should include correct OAuth parameters in redirect URL', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.redirectUrl).toContain('response_type=code');
      expect(result.redirectUrl).toContain('approval_prompt=auto');
    });
  });

  describe('handleCallback', () => {
    const mockCode = 'auth_code_123';
    const mockState = `strava-${mockUserId}-${Date.now()}`;
    const mockTokenResponse = {
      data: {
        token_type: 'Bearer',
        access_token: 'access_token_123',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        refresh_token: 'refresh_token_123',
        athlete: { id: 12345 },
        scope: 'read,activity:read_all',
      },
    };

    beforeAll(() => {
      mockedAxios.post.mockResolvedValue(mockTokenResponse);
      mockedAxios.get.mockResolvedValue({ data: [] });
    });

    it('should handle callback successfully with valid code and state', async () => {
      await provider.handleCallback({ code: mockCode, state: mockState });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://www.strava.com/oauth/token',
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      expect(mockTokenStore.set).toHaveBeenCalledWith(mockUserId, 'strava', {
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_123',
        expiresAt: mockTokenResponse.data.expires_at,
        scope: 'read,activity:read_all',
        providerUserId: '12345',
      });

      expect(mockPersistence.markConnected).toHaveBeenCalledWith(
        mockUserId,
        mockIntegration.integrationId,
      );
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

    it('should throw InvalidCallbackException when state format is invalid (missing timestamp)', async () => {
      await expect(
        provider.handleCallback({ code: mockCode, state: 'strava-user123' }),
      ).rejects.toThrow(InvalidCallbackException);
      await expect(
        provider.handleCallback({ code: mockCode, state: 'strava-user123' }),
      ).rejects.toThrow('missing timestamp');
    });

    it('should throw InvalidCallbackException when userId is missing in state', async () => {
      await expect(
        provider.handleCallback({
          code: mockCode,
          state: `strava--${Date.now()}`,
        }),
      ).rejects.toThrow(InvalidCallbackException);
      await expect(
        provider.handleCallback({
          code: mockCode,
          state: `strava--${Date.now()}`,
        }),
      ).rejects.toThrow('Missing userId');
    });

    it('should handle 401 error from token exchange', async () => {
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Invalid authorization code' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(
        provider.handleCallback({ code: mockCode, state: mockState }),
      ).rejects.toThrow(OAuthAuthenticationException);
    });

    it('should handle 429 rate limit error from token exchange', async () => {
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { message: 'Rate limit exceeded' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(
        provider.handleCallback({ code: mockCode, state: mockState }),
      ).rejects.toThrow(RateLimitException);
    });

    it('should handle generic API error from token exchange', async () => {
      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(
        provider.handleCallback({ code: mockCode, state: mockState }),
      ).rejects.toThrow(ProviderAPIException);
    });

    it('should handle network error during token exchange', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(false);

      await expect(
        provider.handleCallback({ code: mockCode, state: mockState }),
      ).rejects.toThrow(OAuthAuthenticationException);
    });

    it('should automatically trigger sync after successful connection', async () => {
      const syncSpy = jest.spyOn(provider, 'sync').mockResolvedValue({
        ok: true,
        syncedAt: new Date(),
        details: { totalItems: 5 },
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
        expiresAt: Math.floor(Date.now() / 1000) - 100, // Expired
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
        scope: 'read,activity:read_all',
      });

      const newTokenResponse = {
        data: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          scope: 'read,activity:read_all',
        },
      };
      mockedAxios.post.mockResolvedValue(newTokenResponse);

      const token = await (provider as any).ensureValidAccessToken(mockUserId);

      expect(token).toBe('new_access_token');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://www.strava.com/oauth/token',
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      expect(mockTokenStore.set).toHaveBeenCalledWith(mockUserId, 'strava', {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: newTokenResponse.data.expires_at,
        scope: 'read,activity:read_all',
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
          data: { message: 'Invalid refresh token' },
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

    it('should handle generic API error during token refresh', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: Math.floor(Date.now() / 1000) - 100,
      });

      mockedAxios.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Server error' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(
        (provider as any).ensureValidAccessToken(mockUserId),
      ).rejects.toThrow(ProviderAPIException);
    });
  });

  describe('sync', () => {
    const mockAccessToken = 'valid_access_token';
    const mockActivities = [
      {
        id: 123456,
        type: 'Run',
        sport_type: 'Run',
        start_date: '2024-01-01T10:00:00Z',
        moving_time: 1800, // 30 minutes
        distance: 5000, // 5km in meters
        map: { summary_polyline: 'encoded_polyline' },
      },
      {
        id: 123457,
        type: 'Ride',
        sport_type: 'Ride',
        start_date: '2024-01-02T14:00:00Z',
        moving_time: 3600, // 60 minutes
        distance: 20000, // 20km in meters
      },
    ];

    beforeAll(() => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        refreshToken: 'refresh_token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
      mockPersistence.getLastSyncedAt.mockResolvedValue(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      );
      jest
        .spyOn(mockPrismaService.userIntegrations, 'findFirst')
        .mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
        } as any);
    });

    it('should sync activities successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockActivities });
      mockPersistence.createListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(result.syncedAt).toBeInstanceOf(Date);
      expect(result.details.activitiesCount).toBe(2);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.strava.com/api/v3/athlete/activities',
        expect.objectContaining({
          headers: { Authorization: `Bearer ${mockAccessToken}` },
        }),
      );
      expect(mockPersistence.markSynced).toHaveBeenCalled();
    });

    it('should use default days when no last sync date', async () => {
      mockPersistence.getLastSyncedAt.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({ data: [] });

      await provider.sync(mockUserId);

      const callArgs = mockedAxios.get.mock.calls[0]?.[1];
      if (callArgs) {
        expect(callArgs.params.after).toBeDefined();
        // Should be approximately 90 days ago (default)
        const expectedTime = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
        expect(callArgs.params.after).toBeCloseTo(expectedTime, -2);
      }
    });

    it('should handle empty activities list', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(result.details.activitiesCount).toBe(0);
      expect(mockPersistence.createListItem).not.toHaveBeenCalled();
    });

    it('should map activity types correctly', async () => {
      const swimActivity = {
        id: 123458,
        type: 'Swim',
        sport_type: 'Swim',
        start_date: '2024-01-03T08:00:00Z',
        moving_time: 2400,
        distance: 1000, // meters
      };
      mockedAxios.get.mockResolvedValue({ data: [swimActivity] });

      await provider.sync(mockUserId);

      expect(mockPersistence.ensureListAndCategoryForUser).toHaveBeenCalledWith(
        mockUserId,
        'Activity',
        expect.any(String),
      );
    });

    it('should convert distance to miles for non-swim activities', async () => {
      mockedAxios.get.mockResolvedValue({ data: [mockActivities[0]] });
      mockPersistence.createListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      await provider.sync(mockUserId);

      const createItemCall = mockPersistence.createListItem.mock.calls[0];
      const itemData = createItemCall[4];
      expect(itemData.miles).toBeCloseTo(3.107, 2); // 5000m ≈ 3.107 miles
    });

    it('should convert distance to yards for swim activities', async () => {
      const swimActivity = {
        id: 123458,
        type: 'Swim',
        sport_type: 'Swim',
        start_date: '2024-01-03T08:00:00Z',
        moving_time: 2400,
        distance: 1000,
      };
      mockedAxios.get.mockResolvedValue({ data: [swimActivity] });
      mockPersistence.createListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      await provider.sync(mockUserId);

      const createItemCall = mockPersistence.createListItem.mock.calls[0];
      const itemData = createItemCall[4];
      expect(itemData.yards).toBeCloseTo(1093.61, 2); // 1000m ≈ 1093.61 yards
    });

    it('should throw InvalidTokenException when token is missing', async () => {
      mockTokenStore.get.mockResolvedValue(null);

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('should handle API errors during sync', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Server error' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        ProviderAPIException,
      );
    });

    it('should handle rate limit during sync', async () => {
      mockedAxios.get.mockRejectedValue({
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
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      });
      (mockedAxios.isAxiosError as any) = jest.fn().mockReturnValue(true);

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        InvalidTokenException,
      );
    });
  });

  describe('status', () => {
    it('should return connected status when user is connected', async () => {
      const lastSyncDate = new Date('2024-01-01T12:00:00Z');
      jest
        .spyOn(mockPrismaService.userIntegrations, 'findFirst')
        .mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
          status: 'CONNECTED',
        } as any);
      jest
        .spyOn(mockPrismaService.userIntegrationHistory, 'findFirst')
        .mockResolvedValue({
          lastSyncedAt: lastSyncDate,
        } as any);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(true);
      expect(result.lastSyncedAt).toEqual(lastSyncDate);
    });

    it('should return not connected when user is not connected', async () => {
      jest
        .spyOn(mockPrismaService.userIntegrations, 'findFirst')
        .mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(false);
      expect(result.lastSyncedAt).toBeNull();
    });

    it('should return null lastSyncedAt when no sync history', async () => {
      jest
        .spyOn(mockPrismaService.userIntegrations, 'findFirst')
        .mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
          status: 'CONNECTED',
        } as any);
      jest
        .spyOn(mockPrismaService.userIntegrationHistory, 'findFirst')
        .mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(true);
      expect(result.lastSyncedAt).toBeNull();
    });

    it('should return not connected when status is not CONNECTED', async () => {
      jest
        .spyOn(mockPrismaService.userIntegrations, 'findFirst')
        .mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
          status: 'DISCONNECTED',
        } as any);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(false);
    });
  });
});
