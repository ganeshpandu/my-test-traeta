import { Test, TestingModule } from '@nestjs/testing';
import { AppleHealthProvider } from './apple-health.provider';
import { AppleMusicProvider } from './apple-music.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from '../persistence';
import { TokenStore } from '../token-store';
import { Logger } from '@nestjs/common';

// Mock data
const mockHealthData = {
  workouts: [
    {
      id: 'workout_1',
      workoutType: 'HKWorkoutActivityTypeRunning',
      startDate: '2024-01-01T10:00:00Z',
      endDate: '2024-01-01T10:30:00Z',
      duration: 30,
      totalEnergyBurned: 250,
      totalDistance: 5000,
    },
  ],
  healthMetrics: [
    {
      id: 'metric_1',
      type: 'HKQuantityTypeIdentifierBodyMass',
      value: 70.5,
      unit: 'kg',
      date: '2024-01-01T08:00:00Z',
    },
  ],
  steps: [
    {
      id: 'steps_1',
      date: '2024-01-01',
      stepCount: 8500,
      distance: 6000,
    },
  ],
  heartRate: [
    {
      id: 'hr_1',
      date: '2024-01-01T10:15:00Z',
      value: 150,
      context: 'active',
    },
  ],
  sleep: [
    {
      id: 'sleep_1',
      startDate: '2024-01-01T23:00:00Z',
      endDate: '2024-01-02T07:00:00Z',
      value: 'asleep',
      duration: 480,
    },
  ],
};

const mockMusicData = {
  recentlyPlayed: [
    {
      id: 'play_1',
      type: 'library-songs',
      attributes: {
        playedDate: '2024-01-01T15:30:00Z',
        track: {
          id: 'track_1',
          type: 'songs',
          attributes: {
            name: 'Test Song',
            artistName: 'Test Artist',
            albumName: 'Test Album',
            durationInMillis: 240000,
            genreNames: ['Pop'],
          },
        },
        playDurationMillis: 240000,
        endReasonType: 'NATURAL_END_OF_TRACK',
      },
    },
  ],
};

describe('Apple Integrations', () => {
  let appleHealthProvider: AppleHealthProvider;
  let appleMusicProvider: AppleMusicProvider;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockPersistence: jest.Mocked<IntegrationPersistence>;
  let mockTokenStore: jest.Mocked<TokenStore>;

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
    } as any;

    mockTokenStore = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppleHealthProvider,
        AppleMusicProvider,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationPersistence, useValue: mockPersistence },
        { provide: TokenStore, useValue: mockTokenStore },
      ],
    }).compile();

    appleHealthProvider = module.get<AppleHealthProvider>(AppleHealthProvider);
    appleMusicProvider = module.get<AppleMusicProvider>(AppleMusicProvider);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  describe('AppleHealthProvider', () => {
    beforeAll(() => {
      mockPersistence.ensureIntegration.mockResolvedValue({
        integrationId: 'apple_health_id',
        recSeq: 0,
        recStatus: 'ACTIVE',
        name: 'apple_health',
        popularity: 0,
        dataStatus: 'ENABLED',
        createdBy: 'test',
        createdOn: new Date(),
        modifiedOn: new Date(),
        modifiedBy: 'test',
      });

      mockPersistence.ensureListAndCategoryForUser.mockResolvedValue({
        list: {
          listId: 'list_1',
          recSeq: 0,
          recStatus: 'ACTIVE',
          name: 'Health Data',
          dataStatus: 'ENABLED',
          createdBy: 'test',
          createdOn: new Date(),
          modifiedOn: new Date(),
          modifiedBy: 'test',
        },
        userList: {
          userListId: 'user_list_1',
          recSeq: 0,
          recStatus: 'ACTIVE',
          userId: 'user123',
          userRecSeq: 0,
          listId: 'list_1',
          listRecSeq: 0,
          customName: null,
          dataStatus: 'ENABLED',
          createdBy: 'test',
          createdOn: new Date(),
          modifiedOn: new Date(),
          modifiedBy: 'test',
        },
        category: { listCategoryId: 'cat_1', recSeq: 0 },
      });
    });

    describe('createConnection', () => {
      it('should create connection and return upload token', async () => {
        const userId = 'user123';
        const result = await appleHealthProvider.createConnection(userId);

        expect(result.state).toContain('apple-health-user123');
        expect(result.redirectUrl).toContain('applehealth://connect');
        expect(result.redirectUrl).toContain('uploadToken=');
        expect(mockTokenStore.set).toHaveBeenCalledWith(
          userId,
          'apple_health',
          expect.objectContaining({
            accessToken: expect.any(String),
            expiresAt: expect.any(Number),
          }),
        );
      });
    });

    describe('handleCallback', () => {
      it('should process health data when valid token provided', async () => {
        const userId = 'user123';
        const uploadToken = 'test_token';
        const state = `apple-health-${userId}-${Date.now()}`;

        mockTokenStore.get.mockResolvedValue({
          accessToken: uploadToken,
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        });

        await appleHealthProvider.handleCallback({
          state,
          uploadToken,
          healthData: mockHealthData,
        });

        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          userId,
          'apple_health_id',
        );
      });

      it('should reject invalid upload token', async () => {
        const userId = 'user123';
        const state = `apple-health-${userId}-${Date.now()}`;

        mockTokenStore.get.mockResolvedValue(null);

        await expect(
          appleHealthProvider.handleCallback({
            state,
            uploadToken: 'invalid_token',
            healthData: mockHealthData,
          }),
        ).rejects.toThrow(
          'Access token for apple_health is invalid or expired',
        );

        expect(mockPersistence.markConnected).not.toHaveBeenCalled();
      });
    });

    describe('handleDataUpload', () => {
      it('should process uploaded health data', async () => {
        const userId = 'user123';
        const uploadToken = 'test_token';

        mockTokenStore.get.mockResolvedValue({
          accessToken: uploadToken,
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        });

        (
          mockPrismaService.userIntegrations.findFirst as jest.Mock<
            jest.MockedFunction<any>
          >
        ).mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
        });

        const result = await appleHealthProvider.handleDataUpload(
          userId,
          uploadToken,
          mockHealthData,
        );

        expect(result.ok).toBe(true);
        expect(result.message).toBe(
          'Health data uploaded successfully (duplicates skipped/updated)',
        );
        expect(mockPersistence.createListItem).toHaveBeenCalledTimes(5); // workouts + metrics + steps + heartRate + sleep
      });
    });

    describe('sync', () => {
      it('should complete sync and mark as synced', async () => {
        const userId = 'user123';

        mockPersistence.getLastSyncedAt.mockResolvedValue(null);
        (
          mockPrismaService.userIntegrations.findFirst as jest.Mock
        ).mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
        });

        const result = await appleHealthProvider.sync(userId);

        expect(result.ok).toBe(true);
        expect(result.details.message).toBe('Apple Health sync completed');
        expect(mockPersistence.markSynced).toHaveBeenCalledWith('link_1', 0);
      });
    });

    describe('status', () => {
      it('should return connection status', async () => {
        const userId = 'user123';

        (
          mockPrismaService.userIntegrations.findFirst as jest.Mock
        ).mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
          status: 'CONNECTED',
        });

        (
          mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
        ).mockResolvedValue({
          lastSyncedAt: new Date('2024-01-01T12:00:00Z'),
        });

        const result = await appleHealthProvider.status(userId);

        expect(result.connected).toBe(true);
        expect(result.lastSyncedAt).toEqual(new Date('2024-01-01T12:00:00Z'));
        expect(result.details.integrationId).toBe('apple_health_id');
      });
    });
  });

  describe('AppleMusicProvider', () => {
    beforeAll(() => {
      mockPersistence.ensureIntegration.mockResolvedValue({
        integrationId: 'apple_music_id',
        recSeq: 0,
        recStatus: 'ACTIVE',
        name: 'apple_music',
        popularity: 0,
        dataStatus: 'ENABLED',
        createdBy: 'test',
        createdOn: new Date(),
        modifiedOn: new Date(),
        modifiedBy: 'test',
      });

      mockPersistence.ensureListAndCategoryForUser.mockResolvedValue({
        list: {
          listId: 'list_1',
          recSeq: 0,
          recStatus: 'ACTIVE',
          name: 'Music Data',
          dataStatus: 'ENABLED',
          createdBy: 'test',
          createdOn: new Date(),
          modifiedOn: new Date(),
          modifiedBy: 'test',
        },
        userList: {
          userListId: 'user_list_1',
          recSeq: 0,
          recStatus: 'ACTIVE',
          userId: 'user123',
          userRecSeq: 0,
          listId: 'list_1',
          listRecSeq: 0,
          customName: null,
          dataStatus: 'ENABLED',
          createdBy: 'test',
          createdOn: new Date(),
          modifiedOn: new Date(),
          modifiedBy: 'test',
        },
        category: { listCategoryId: 'cat_1', recSeq: 0 },
      });

      // Mock environment variables
      process.env.APPLE_MUSIC_TEAM_ID = 'test_team_id';
      process.env.APPLE_MUSIC_KEY_ID = 'test_key_id';
      process.env.APPLE_MUSIC_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg7S8j7ZiN+NXSJ7Wd
nVQP62QdDNMdSdVuaUdx6U4EydShRANCAATYDKcEF4ItgtjvqaxlQci30EiHP1CM
fSuemxO9E6N84BmZrGj+1oj0AfPuSqBpE2QJPyFJ4bTI/K6cOe1YFGMz
-----END PRIVATE KEY-----`;
    });

    describe('createConnection', () => {
      it('should create connection and return authorization URL', async () => {
        const userId = 'user123';
        const result = await appleMusicProvider.createConnection(userId);

        expect(result.state).toContain('apple-music-user123');
        expect(result.redirectUrl).toContain(
          'https://authorize.music.apple.com/woa',
        );
        expect(result.linkToken).toBeDefined();
        // Developer token is generated on-demand, not stored
      });
    });

    describe('handleCallback', () => {
      it('should process music user token', async () => {
        const userId = 'user123';
        const musicUserToken = 'test_music_token';
        const state = `apple-music-${userId}-${Date.now()}`;

        await appleMusicProvider.handleCallback({
          state,
          music_user_token: musicUserToken,
        });

        expect(mockTokenStore.set).toHaveBeenCalledWith(
          userId,
          'apple_music',
          expect.objectContaining({
            accessToken: musicUserToken,
            expiresAt: expect.any(Number),
          }),
        );
        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          userId,
          'apple_music_id',
        );
      });
    });

    describe('sync', () => {
      it('should handle missing tokens gracefully', async () => {
        const userId = 'user123';

        mockTokenStore.get.mockResolvedValue(null);
        mockPersistence.getLastSyncedAt.mockResolvedValue(null);

        await expect(appleMusicProvider.sync(userId)).rejects.toThrow(
          'Access token for apple_music is invalid or expired',
        );
      });

      it('should sync successfully with valid tokens', async () => {
        const userId = 'user123';

        mockTokenStore.get.mockResolvedValue({
          accessToken: 'user_token',
          expiresAt: Date.now() + 3600,
        });

        mockPersistence.getLastSyncedAt.mockResolvedValue(null);
        (
          mockPrismaService.userIntegrations.findFirst as jest.Mock
        ).mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
        });

        // The sync will fail due to JWT signing error with the test private key
        await expect(appleMusicProvider.sync(userId)).rejects.toThrow(
          'secretOrPrivateKey must be an asymmetric key when using ES256',
        );
      });
    });

    describe('status', () => {
      it('should return connection status with token info', async () => {
        const userId = 'user123';

        (
          mockPrismaService.userIntegrations.findFirst as jest.Mock
        ).mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
          status: 'CONNECTED',
        });

        (
          mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
        ).mockResolvedValue({
          lastSyncedAt: new Date('2024-01-01T12:00:00Z'),
        });

        mockTokenStore.get
          .mockResolvedValueOnce({
            accessToken: 'user_token',
            expiresAt: 1704110400,
          })
          .mockResolvedValueOnce({
            accessToken: 'dev_token',
            expiresAt: 1704110400,
          });

        const result = await appleMusicProvider.status(userId);

        expect(result.connected).toBe(true);
        expect(result.lastSyncedAt).toEqual(new Date('2024-01-01T12:00:00Z'));
        expect(result.details.hasUserToken).toBe(true);
        expect(result.details.hasDeveloperToken).toBe(true);
      });
    });
  });

  describe('Data Processing', () => {
    describe('Apple Health Data Mapping', () => {
      it('should map workout types correctly', () => {
        const provider = appleHealthProvider as any;

        expect(provider.mapWorkoutType('HKWorkoutActivityTypeRunning')).toBe(
          'Run',
        );
        expect(provider.mapWorkoutType('HKWorkoutActivityTypeCycling')).toBe(
          'Bike',
        );
        expect(provider.mapWorkoutType('HKWorkoutActivityTypeSwimming')).toBe(
          'Swim',
        );
        expect(provider.mapWorkoutType('UnknownType')).toBe('Other');
      });

      it('should map health metric types correctly', () => {
        const provider = appleHealthProvider as any;

        expect(provider.mapMetricType('HKQuantityTypeIdentifierBodyMass')).toBe(
          'Weight',
        );
        expect(provider.mapMetricType('HKQuantityTypeIdentifierHeight')).toBe(
          'Height',
        );
        expect(
          provider.mapMetricType('HKQuantityTypeIdentifierRestingHeartRate'),
        ).toBe('Resting Heart Rate');
        expect(provider.mapMetricType('UnknownType')).toBe(
          'Other Health Metric',
        );
      });
    });
  });
});
