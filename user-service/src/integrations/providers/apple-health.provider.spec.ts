import { Test, TestingModule } from '@nestjs/testing';
import { AppleHealthProvider } from './apple-health.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from '../persistence';
import { TokenStore } from '../token-store';
import { Logger } from '@nestjs/common';
import {
  ConfigurationException,
  InvalidCallbackException,
  InvalidTokenException,
  DataSyncException,
} from '../exceptions/integration.exceptions';

describe('AppleHealthProvider', () => {
  let provider: AppleHealthProvider;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockPersistence: jest.Mocked<IntegrationPersistence>;
  let mockTokenStore: jest.Mocked<TokenStore>;

  const mockUserId = 'user123';
  const mockIntegration = {
    integrationId: 'apple_health_integration_id',
    recSeq: 0,
    name: 'apple_health',
    recStatus: 'A',
    popularity: 0,
    dataStatus: 'ACTIVE',
    createdBy: 'system',
    createdOn: new Date('2024-01-01T00:00:00Z'),
    modifiedBy: 'system',
    modifiedOn: new Date('2024-01-01T00:00:00Z'),
  };

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
        metadata: { source: 'Apple Watch' },
      },
      {
        id: 'workout_2',
        workoutType: 'HKWorkoutActivityTypeCycling',
        startDate: '2024-01-02T14:00:00Z',
        endDate: '2024-01-02T15:00:00Z',
        duration: 60,
        totalEnergyBurned: 400,
        totalDistance: 20000,
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
      {
        id: 'metric_2',
        type: 'HKQuantityTypeIdentifierHeight',
        value: 175,
        unit: 'cm',
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
      {
        id: 'steps_2',
        date: '2024-01-02',
        stepCount: 10000,
        distance: 7500,
      },
    ],
    heartRate: [
      {
        id: 'hr_1',
        date: '2024-01-01T10:15:00Z',
        value: 150,
        context: 'active',
      },
      {
        id: 'hr_2',
        date: '2024-01-01T22:00:00Z',
        value: 60,
        context: 'resting',
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

  type EnsureListCategoryResult = Awaited<
    ReturnType<IntegrationPersistence['ensureListAndCategoryForUser']>
  >;

  const createEnsureListCategoryResult = (
    userId: string,
    listName: string,
    categoryName?: string,
  ): EnsureListCategoryResult => {
    const createdOn = new Date('2024-01-01T00:00:00Z');
    const modifiedOn = new Date('2024-01-01T00:00:00Z');

    return {
      list: {
        listId: 'list_1',
        recSeq: 0,
        recStatus: 'A',
        name: listName,
        dataStatus: 'A',
        createdBy: 'system',
        createdOn,
        modifiedOn,
        modifiedBy: 'system',
      },
      userList: {
        userListId: 'user_list_1',
        recSeq: 0,
        recStatus: 'A',
        userId,
        userRecSeq: 0,
        listId: 'list_1',
        listRecSeq: 0,
        customName: null,
        dataStatus: 'A',
        createdBy: 'system',
        createdOn,
        modifiedOn,
        modifiedBy: 'system',
      },
      category: categoryName
        ? {
            listCategoryId: 'cat_1',
            recSeq: 0,
            recStatus: 'A',
            listId: 'list_1',
            listRecSeq: 0,
            name: categoryName,
            dataStatus: 'A',
            createdBy: 'system',
            createdOn,
            modifiedOn,
            modifiedBy: 'system',
          }
        : null,
    };
  };

  const getUserIntegrationFindFirstMock = () =>
    mockPrismaService.userIntegrations
      .findFirst as unknown as jest.MockedFunction<
      PrismaService['userIntegrations']['findFirst']
    >;

  beforeAll(async () => {
    // Create mocks
    mockPrismaService = {
      userIntegrations: {
        findFirst: jest.fn<
          ReturnType<PrismaService['userIntegrations']['findFirst']>,
          Parameters<PrismaService['userIntegrations']['findFirst']>
        >() as unknown as PrismaService['userIntegrations']['findFirst'],
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

    const findFirstMock = jest
      .fn()
      .mockResolvedValue(null) as jest.MockedFunction<
      PrismaService['userIntegrations']['findFirst']
    >;
    mockPrismaService.userIntegrations.findFirst = findFirstMock;

    // Set environment variables
    process.env.APPLE_HEALTH_DEFAULT_DAYS = '30';
    process.env.APPLE_HEALTH_UPLOAD_ENDPOINT =
      '/integrations/apple_health/upload';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppleHealthProvider,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationPersistence, useValue: mockPersistence },
        { provide: TokenStore, useValue: mockTokenStore },
      ],
    }).compile();

    provider = module.get<AppleHealthProvider>(AppleHealthProvider);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Default mock implementations
    mockPersistence.ensureIntegration.mockResolvedValue(mockIntegration);
    mockPersistence.ensureListAndCategoryForUser.mockImplementation(
      (userId, listName, categoryName) =>
        Promise.resolve(
          createEnsureListCategoryResult(userId, listName, categoryName),
        ),
    );
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('createConnection', () => {
    it('should create connection successfully with valid configuration', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.state).toContain(`apple-health-${mockUserId}`);
      expect(result.redirectUrl).toContain('applehealth://connect');
      expect(result.redirectUrl).toContain('uploadEndpoint=');
      expect(result.redirectUrl).toContain('uploadToken=');
      expect(result.redirectUrl).toContain(`userId=${mockUserId}`);
      expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith(
        'apple_health',
      );
      expect(mockTokenStore.set).toHaveBeenCalledWith(
        mockUserId,
        'apple_health',
        expect.objectContaining({
          accessToken: expect.any(String),
          expiresAt: expect.any(Number),
        }),
      );
    });

    it('should generate unique upload token for each connection', async () => {
      const result1 = await provider.createConnection(mockUserId);
      jest.clearAllMocks();
      mockPersistence.ensureIntegration.mockResolvedValue(mockIntegration);

      const result2 = await provider.createConnection(mockUserId);

      const token1 = new URLSearchParams(
        result1.redirectUrl?.split('?')[1],
      ).get('uploadToken');
      const token2 = new URLSearchParams(
        result2.redirectUrl?.split('?')[1],
      ).get('uploadToken');

      expect(token1).not.toBe(token2);
    });

    it('should set token expiry to 1 hour', async () => {
      const beforeTime = Math.floor(Date.now() / 1000) + 3600;

      await provider.createConnection(mockUserId);

      const afterTime = Math.floor(Date.now() / 1000) + 3600;
      const setCall = mockTokenStore.set.mock.calls[0];
      const tokenData = setCall[2];

      expect(tokenData.expiresAt).toBeGreaterThanOrEqual(beforeTime);
      expect(tokenData.expiresAt).toBeLessThanOrEqual(afterTime);
    });

    it('should throw ConfigurationException when upload endpoint is missing', async () => {
      process.env.APPLE_HEALTH_UPLOAD_ENDPOINT = '';
      const newProvider = new AppleHealthProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );

      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        'Apple Health upload endpoint is not configured',
      );

      // Restore for other tests
      process.env.APPLE_HEALTH_UPLOAD_ENDPOINT =
        '/integrations/apple_health/upload';
    });

    it('should handle errors during connection creation', async () => {
      mockPersistence.ensureIntegration.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
    });
  });

  describe('handleCallback', () => {
    const mockUploadToken = 'ah_user123_1234567890_abc123';
    const mockState = `apple-health-${mockUserId}-${Date.now()}`;

    beforeAll(() => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockUploadToken,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
    });

    it('should handle callback successfully with valid token and health data', async () => {
      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      await provider.handleCallback({
        state: mockState,
        uploadToken: mockUploadToken,
        healthData: mockHealthData,
      });

      expect(mockTokenStore.get).toHaveBeenCalledWith(
        mockUserId,
        'apple_health',
      );
      expect(mockPersistence.markConnected).toHaveBeenCalledWith(
        mockUserId,
        mockIntegration.integrationId,
      );
    });

    it('should throw InvalidCallbackException when state is missing', async () => {
      await expect(
        provider.handleCallback({ uploadToken: mockUploadToken }),
      ).rejects.toThrow(InvalidCallbackException);
    });

    it('should throw InvalidCallbackException when uploadToken is missing', async () => {
      await expect(
        provider.handleCallback({ state: mockState }),
      ).rejects.toThrow(InvalidCallbackException);
    });

    it('should throw InvalidCallbackException with invalid state format', async () => {
      await expect(
        provider.handleCallback({
          state: 'invalid-state',
          uploadToken: mockUploadToken,
        }),
      ).rejects.toThrow(InvalidCallbackException);
      await expect(
        provider.handleCallback({
          state: 'invalid-state',
          uploadToken: mockUploadToken,
        }),
      ).rejects.toThrow('unable to extract userId');
    });

    it('should throw InvalidTokenException when stored token does not match', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: 'different_token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

      await expect(
        provider.handleCallback({
          state: mockState,
          uploadToken: mockUploadToken,
          healthData: mockHealthData,
        }),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('should throw InvalidTokenException when token is expired', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockUploadToken,
        expiresAt: Math.floor(Date.now() / 1000) - 100, // Expired
      });

      await expect(
        provider.handleCallback({
          state: mockState,
          uploadToken: mockUploadToken,
          healthData: mockHealthData,
        }),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('should throw InvalidTokenException when token does not exist', async () => {
      mockTokenStore.get.mockResolvedValue(null);

      await expect(
        provider.handleCallback({
          state: mockState,
          uploadToken: mockUploadToken,
          healthData: mockHealthData,
        }),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('should process health data when provided', async () => {
      mockPersistence.createListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      await provider.handleCallback({
        state: mockState,
        uploadToken: mockUploadToken,
        healthData: mockHealthData,
      });

      // Should process all data types: workouts, metrics, steps, heartRate, sleep
      expect(mockPersistence.createListItem).toHaveBeenCalled();
    });

    it('should handle callback without health data', async () => {
      await provider.handleCallback({
        state: mockState,
        uploadToken: mockUploadToken,
      });

      expect(mockPersistence.markConnected).toHaveBeenCalled();
      expect(mockPersistence.createListItem).not.toHaveBeenCalled();
    });

    it('should extract userId correctly from state with hyphens', async () => {
      const userIdWithHyphens = 'user-with-hyphens-123';
      const state = `apple-health-${userIdWithHyphens}-${Date.now()}`;

      mockTokenStore.get.mockResolvedValue({
        accessToken: mockUploadToken,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

      await provider.handleCallback({
        state,
        uploadToken: mockUploadToken,
      });

      expect(mockTokenStore.get).toHaveBeenCalledWith(
        userIdWithHyphens,
        'apple_health',
      );
    });
  });

  describe('handleDataUpload', () => {
    const mockUploadToken = 'ah_user123_1234567890_abc123';

    beforeAll(() => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockUploadToken,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
      getUserIntegrationFindFirstMock().mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
      } as any);
    });

    it('should upload health data successfully', async () => {
      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      const result = await provider.handleDataUpload(
        mockUserId,
        mockUploadToken,
        mockHealthData,
      );

      expect(result.ok).toBe(true);
      expect(result.message).toContain('successfully');
      expect(mockPersistence.markConnected).toHaveBeenCalled();
      expect(mockPersistence.markSynced).toHaveBeenCalled();
    });

    it('should process all workout types', async () => {
      mockPersistence.createListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      await provider.handleDataUpload(
        mockUserId,
        mockUploadToken,
        mockHealthData,
      );

      expect(mockPersistence.createListItem).toHaveBeenCalledTimes(
        mockHealthData.workouts.length +
          mockHealthData.healthMetrics.length +
          mockHealthData.steps.length +
          mockHealthData.heartRate.length +
          mockHealthData.sleep.length,
      );
    });

    it('should throw InvalidTokenException when token does not match', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: 'different_token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });

      await expect(
        provider.handleDataUpload(mockUserId, mockUploadToken, mockHealthData),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('should throw InvalidTokenException when token is expired', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockUploadToken,
        expiresAt: Math.floor(Date.now() / 1000) - 100,
      });

      await expect(
        provider.handleDataUpload(mockUserId, mockUploadToken, mockHealthData),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('should throw InvalidTokenException when token does not exist', async () => {
      mockTokenStore.get.mockResolvedValue(null);

      await expect(
        provider.handleDataUpload(mockUserId, mockUploadToken, mockHealthData),
      ).rejects.toThrow(InvalidTokenException);
    });

    it('should handle empty health data', async () => {
      const emptyData = {
        workouts: [],
        healthMetrics: [],
        steps: [],
        heartRate: [],
        sleep: [],
      };

      const result = await provider.handleDataUpload(
        mockUserId,
        mockUploadToken,
        emptyData,
      );

      expect(result.ok).toBe(true);
      expect(mockPersistence.createListItem).not.toHaveBeenCalled();
    });

    it('should handle partial health data', async () => {
      const partialData = {
        workouts: mockHealthData.workouts,
        // Other fields missing
      };

      mockPersistence.createListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      const result = await provider.handleDataUpload(
        mockUserId,
        mockUploadToken,
        partialData as any,
      );

      expect(result.ok).toBe(true);
      expect(mockPersistence.createListItem).toHaveBeenCalledTimes(
        mockHealthData.workouts.length,
      );
    });

    it('should throw DataSyncException on processing error', async () => {
      mockPersistence.createListItem.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        provider.handleDataUpload(mockUserId, mockUploadToken, mockHealthData),
      ).rejects.toThrow(DataSyncException);
    });
  });

  describe('sync', () => {
    beforeAll(() => {
      mockPersistence.getLastSyncedAt.mockResolvedValue(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      );
      getUserIntegrationFindFirstMock().mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
      } as any);
    });

    it('should complete sync successfully', async () => {
      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(result.syncedAt).toBeInstanceOf(Date);
      expect(result.details.message).toBe('Apple Health sync completed');
      expect(result.details.note).toContain('iOS app');
      expect(mockPersistence.markSynced).toHaveBeenCalledWith('link_1', 0);
    });

    it('should use default days when no last sync date', async () => {
      mockPersistence.getLastSyncedAt.mockResolvedValue(null);

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(result.details.since).toBeInstanceOf(Date);
    });

    it('should handle sync when user integration does not exist', async () => {
      getUserIntegrationFindFirstMock().mockResolvedValue(null);

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(mockPersistence.markSynced).not.toHaveBeenCalled();
    });

    it('should throw DataSyncException on error', async () => {
      mockPersistence.getLastSyncedAt.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        DataSyncException,
      );
    });
  });

  describe('status', () => {
    it('should return connected status with upload token', async () => {
      const lastSyncDate = new Date('2024-01-01T12:00:00Z');
      getUserIntegrationFindFirstMock().mockResolvedValue({
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
      expect(result.details.uploadToken).toBeDefined();
      expect(result.details.uploadEndpoint).toBe(
        '/integrations/apple_health/upload',
      );
      expect(mockTokenStore.set).toHaveBeenCalled(); // Fresh token generated
    });

    it('should return not connected when user is not connected', async () => {
      getUserIntegrationFindFirstMock().mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(false);
      expect(result.lastSyncedAt).toBeNull();
      expect(result.details.uploadToken).toBeUndefined();
    });

    it('should return null lastSyncedAt when no sync history', async () => {
      getUserIntegrationFindFirstMock().mockResolvedValue({
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

    it('should not generate upload token for disconnected users', async () => {
      getUserIntegrationFindFirstMock().mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
        status: 'DISCONNECTED',
      } as any);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(false);
      expect(result.details.uploadToken).toBeUndefined();
      expect(mockTokenStore.set).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect user successfully', async () => {
      getUserIntegrationFindFirstMock().mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
      } as any);

      await provider.disconnect(mockUserId);

      expect(mockTokenStore.delete).toHaveBeenCalledWith(
        mockUserId,
        'apple_health',
      );
      expect(mockPrismaService.userIntegrations.update).toHaveBeenCalledWith({
        where: {
          userIntegrationId_recSeq: {
            userIntegrationId: 'link_1',
            recSeq: 0,
          },
        },
        data: { status: 'DISCONNECTED' },
      });
    });

    it('should handle disconnect when user is not connected', async () => {
      getUserIntegrationFindFirstMock().mockResolvedValue(null);

      await expect(provider.disconnect(mockUserId)).resolves.not.toThrow();
    });
  });

  describe('workout type mapping', () => {
    it('should map different workout types correctly', async () => {
      const workoutTypes = [
        'HKWorkoutActivityTypeRunning',
        'HKWorkoutActivityTypeCycling',
        'HKWorkoutActivityTypeSwimming',
        'HKWorkoutActivityTypeYoga',
        'HKWorkoutActivityTypeWalking',
      ];

      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      for (const workoutType of workoutTypes) {
        const data = {
          workouts: [
            {
              id: 'workout_test',
              workoutType,
              startDate: '2024-01-01T10:00:00Z',
              endDate: '2024-01-01T10:30:00Z',
              duration: 30,
            },
          ],
        };

        mockTokenStore.get.mockResolvedValue({
          accessToken: 'test_token',
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        });
        getUserIntegrationFindFirstMock().mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
        } as any);

        await provider.handleDataUpload(mockUserId, 'test_token', data as any);

        expect(
          mockPersistence.ensureListAndCategoryForUser,
        ).toHaveBeenCalledWith(mockUserId, 'Activity', expect.any(String));
      }
    });
  });

  describe('health metric type mapping', () => {
    it('should map different health metric types correctly', async () => {
      const metricTypes = [
        'HKQuantityTypeIdentifierBodyMass',
        'HKQuantityTypeIdentifierHeight',
        'HKQuantityTypeIdentifierBodyFatPercentage',
        'HKQuantityTypeIdentifierHeartRate',
      ];

      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      for (const metricType of metricTypes) {
        const data = {
          healthMetrics: [
            {
              id: 'metric_test',
              type: metricType,
              value: 100,
              unit: 'unit',
              date: '2024-01-01T08:00:00Z',
            },
          ],
        };

        mockTokenStore.get.mockResolvedValue({
          accessToken: 'test_token',
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        });
        getUserIntegrationFindFirstMock().mockResolvedValue({
          userIntegrationId: 'link_1',
          recSeq: 0,
        } as any);

        await provider.handleDataUpload(mockUserId, 'test_token', data as any);

        expect(
          mockPersistence.ensureListAndCategoryForUser,
        ).toHaveBeenCalledWith(mockUserId, 'Health Metric', expect.any(String));
      }
    });
  });
});
