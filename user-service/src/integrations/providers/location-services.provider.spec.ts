import { Test, TestingModule } from '@nestjs/testing';
import { LocationServicesProvider } from './location-services.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from '../persistence';
import { LocationDataStore } from '../location-data-store';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import {
  ConfigurationException,
  InvalidCallbackException,
  DataSyncException,
  ProviderAPIException,
  RateLimitException,
  OAuthAuthenticationException,
} from '../exceptions/integration.exceptions';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LocationServicesProvider', () => {
  let provider: LocationServicesProvider;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockPersistence: jest.Mocked<IntegrationPersistence>;
  let mockLocationDataStore: jest.Mocked<LocationDataStore>;

  const mockUserId = 'user123';
  const mockIntegration = {
    integrationId: 'location_services_integration_id',
    recSeq: 0,
    recStatus: 'ACTIVE',
    name: 'location_services',
    popularity: null,
    dataStatus: 'ACTIVE',
    createdBy: 'system',
    createdOn: new Date(),
    modifiedOn: new Date(),
    modifiedBy: null,
  };

  const mockLocationData = [
    {
      latitude: 37.7749,
      longitude: -122.4194,
      timestamp: new Date(),
      accuracy: 10,
      altitude: 50,
      speed: 0,
      bearing: 0,
    },
  ];

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

    mockLocationDataStore = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      markProcessed: jest.fn(),
      deleteProcessed: jest.fn(),
      storeLocationData: jest.fn(),
      clearLocationData: jest.fn(),
    } as any;

    // Set environment variables
    process.env.GOOGLE_MAPS_API_KEY = 'test_api_key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationServicesProvider,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationPersistence, useValue: mockPersistence },
        { provide: LocationDataStore, useValue: mockLocationDataStore },
      ],
    }).compile();

    provider = module.get<LocationServicesProvider>(LocationServicesProvider);

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
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  describe('createConnection', () => {
    it('should create connection successfully with valid configuration', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.redirectUrl).toBeUndefined();
      expect(result.linkToken).toBeUndefined();
      expect(result.state).toContain(`location-${mockUserId}`);
      expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith(
        'location_services',
      );
    });

    it('should throw ConfigurationException when GOOGLE_MAPS_API_KEY is missing', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      const newProvider = new LocationServicesProvider(
        mockPrismaService,
        mockPersistence,
        mockLocationDataStore,
      );

      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        'Google Maps API key is not configured. Please set GOOGLE_MAPS_API_KEY environment variable.',
      );
    });

    it('should create state with timestamp', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.state).toMatch(new RegExp(`^location-${mockUserId}-\\d+$`));
    });

    it('should handle persistence errors during integration creation', async () => {
      mockPersistence.ensureIntegration.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        'Failed to initialize location services connection: DB error',
      );
    });

    it('should log connection creation', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await provider.createConnection(mockUserId);

      expect(logSpy).toHaveBeenCalledWith(
        `Creating location services connection for user ${mockUserId}`,
      );
    });
  });

  describe('handleCallback', () => {
    const mockState = `location-${mockUserId}-${Date.now()}`;

    describe('Happy Path', () => {
      it('should handle callback successfully with valid state', async () => {
        await provider.handleCallback({ state: mockState });

        expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith(
          'location_services',
        );
        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          mockUserId,
          mockIntegration.integrationId,
        );
      });

      it('should handle callback with state without timestamp', async () => {
        const stateWithoutTimestamp = `location-${mockUserId}`;

        await provider.handleCallback({ state: stateWithoutTimestamp });

        expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith(
          'location_services',
        );
        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          mockUserId,
          mockIntegration.integrationId,
        );
      });
    });

    describe('Input Validation', () => {
      it('should throw InvalidCallbackException when state is missing', async () => {
        await expect(provider.handleCallback({})).rejects.toThrow(
          InvalidCallbackException,
        );
        await expect(provider.handleCallback({})).rejects.toThrow(
          'Missing state parameter in callback. Please try connecting again.',
        );
      });

      it('should handle state without location prefix', async () => {
        // State "user-user123" -> remove "location-" (nothing) -> "user-user123"
        // lastDashIndex = 4, so userId = "user"
        await provider.handleCallback({ state: `user-${mockUserId}` });

        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          'user', // This is what the parsing logic returns
          mockIntegration.integrationId,
        );
      });

      it('should handle empty userId after location prefix removal', async () => {
        // State "location-" -> remove "location-" -> "" -> userId = "" -> throws error
        await expect(
          provider.handleCallback({ state: 'location-' }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({ state: 'location-' }),
        ).rejects.toThrow(
          'Invalid state format in callback. Please try connecting again.',
        );
      });

      it('should handle complex state formats gracefully', async () => {
        // State "location-user123-abc-123" -> remove "location-" -> "user123-abc-123"
        // lastDashIndex = 11 (position of last dash), so userId = "user123-abc"
        await provider.handleCallback({
          state: `location-${mockUserId}-abc-123`,
        });

        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          `${mockUserId}-abc`, // Everything before the last dash
          mockIntegration.integrationId,
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle processing errors gracefully', async () => {
        mockPersistence.markConnected.mockRejectedValue(new Error('DB error'));

        await expect(
          provider.handleCallback({ state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({ state: mockState }),
        ).rejects.toThrow(
          'Failed to complete location services authorization: DB error',
        );
      });

      it('should re-throw InvalidCallbackException as-is', async () => {
        const customError = new InvalidCallbackException(
          'LOCATION_SERVICES',
          'Custom callback error',
        );
        mockPersistence.ensureIntegration.mockRejectedValue(customError);

        await expect(
          provider.handleCallback({ state: mockState }),
        ).rejects.toThrow(customError);
      });
    });
  });

  describe('sync', () => {
    const mockUserIntegration = {
      userIntegrationId: 'ui_123',
      recSeq: 0,
    };

    const mockGoogleMapsResponse = {
      data: {
        status: 'OK',
        results: [
          {
            formatted_address: '123 Test St, San Francisco, CA 94111, USA',
            address_components: [
              { long_name: 'San Francisco', types: ['locality'] },
              {
                long_name: 'California',
                types: ['administrative_area_level_1'],
              },
              { long_name: 'United States', types: ['country'] },
            ],
            place_id: 'test_place_id',
            types: ['establishment'],
          },
        ],
      },
    };

    beforeAll(() => {
      mockPersistence.ensureUserIntegration.mockResolvedValue(
        mockUserIntegration as any,
      );
      mockedAxios.get.mockResolvedValue(mockGoogleMapsResponse);
    });

    describe('Happy Path', () => {
      it('should sync location data successfully', async () => {
        mockLocationDataStore.get.mockResolvedValue({
          locations: mockLocationData,
        } as any);

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.syncedAt).toBeDefined();
        expect(result.details.locationsProcessed).toBe(1);
        expect(result.details.placesIdentified).toBe(1);
        expect(mockLocationDataStore.markProcessed).toHaveBeenCalledWith(
          mockUserId,
          'location_services',
        );
        expect(mockLocationDataStore.deleteProcessed).toHaveBeenCalledWith(
          mockUserId,
          'location_services',
        );
        expect(mockPersistence.markSynced).toHaveBeenCalledWith(
          mockUserIntegration.userIntegrationId,
          mockUserIntegration.recSeq,
          expect.any(Date),
        );
      });

      it('should handle empty location data', async () => {
        mockLocationDataStore.get.mockResolvedValue({
          locations: [],
        } as any);

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.message).toBe('No locations to process');
        expect(result.details.locationsProcessed).toBe(0);
      });

      it('should handle no location data', async () => {
        mockLocationDataStore.get.mockResolvedValue(null);

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.message).toBe(
          'No location data available to sync',
        );
        expect(result.details.locationsProcessed).toBe(0);
      });

      it('should handle partial geocoding success', async () => {
        const locationDataWithInvalid = [
          ...mockLocationData,
          {
            latitude: null,
            longitude: null,
            timestamp: new Date().toISOString(),
          }, // Invalid location
        ];

        mockLocationDataStore.get.mockResolvedValue({
          locations: locationDataWithInvalid,
        } as any);

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.locationsProcessed).toBe(2);
        expect(result.details.placesIdentified).toBe(1); // Only 1 valid location processed
      });
    });

    describe('Error Handling', () => {
      it('should handle reverse geocoding errors', async () => {
        mockLocationDataStore.get.mockResolvedValue({
          locations: mockLocationData,
        } as any);
        mockedAxios.get.mockRejectedValue(new Error('Network error'));

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.placesIdentified).toBe(0); // No places processed due to error
      });

      it('should handle Google Maps API errors at overall method level', async () => {
        // Mock an error that occurs at the method level, not individual location level
        mockLocationDataStore.get.mockRejectedValue({
          response: {
            status: 429,
            data: { error_message: 'Quota exceeded' },
          },
        });

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          RateLimitException,
        );
      });

      it('should handle main sync process API errors (403)', async () => {
        // Mock an error that occurs at the main sync level
        mockLocationDataStore.markProcessed.mockRejectedValue({
          response: {
            status: 403,
            data: { error_message: 'Access denied' },
          },
        });

        mockLocationDataStore.get.mockResolvedValue({
          locations: mockLocationData,
        } as any);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          ProviderAPIException,
        );
      });

      it('should handle main sync process server errors (500+)', async () => {
        // Mock an error that occurs at the main sync level
        mockLocationDataStore.deleteProcessed.mockRejectedValue({
          response: {
            status: 500,
            data: { message: 'Internal server error' },
          },
        });

        mockLocationDataStore.get.mockResolvedValue({
          locations: mockLocationData,
        } as any);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          ProviderAPIException,
        );
      });

      it('should continue processing locations despite individual geocoding failures', async () => {
        mockLocationDataStore.get.mockResolvedValue({
          locations: mockLocationData,
        } as any);

        // Individual location geocoding failure should not stop the whole process
        mockedAxios.get.mockRejectedValue(new Error('Network error'));

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.placesIdentified).toBe(0); // No places processed due to error
        expect(result.details.locationsProcessed).toBe(1); // But location was attempted
      });

      it('should re-throw specific exceptions as-is', async () => {
        const customError = new DataSyncException(
          'LOCATION_SERVICES',
          'Custom sync error',
        );
        mockLocationDataStore.get.mockRejectedValue(customError);

        await expect(provider.sync(mockUserId)).rejects.toThrow(customError);
      });

      it('should handle large location datasets efficiently', async () => {
        const largeLocationData = Array(100).fill(mockLocationData[0]);
        mockLocationDataStore.get.mockResolvedValue({
          locations: largeLocationData,
        } as any);

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.locationsProcessed).toBe(100);
        expect(mockedAxios.get).toHaveBeenCalledTimes(100); // Each location should be geocoded
      });
    });
  });

  describe('submitLocations', () => {
    it('should submit location data successfully', async () => {
      const result = await provider.submitLocations(
        mockUserId,
        mockLocationData,
      );

      expect(result.ok).toBe(true);
      expect(result.details.locationsStored).toBe(1);
      expect(mockLocationDataStore.set).toHaveBeenCalledWith(
        mockUserId,
        'location_services',
        {
          locations: mockLocationData,
          submittedAt: expect.any(Date),
        },
      );
    });

    it('should handle empty location data', async () => {
      const result = await provider.submitLocations(mockUserId, []);

      expect(result.ok).toBe(true);
      expect(result.details.locationsStored).toBe(0);
      expect(result.details.message).toBe('No locations to store');
    });

    it('should validate location data format', async () => {
      await expect(
        provider.submitLocations(mockUserId, null as any),
      ).rejects.toThrow(DataSyncException);
      await expect(
        provider.submitLocations(mockUserId, null as any),
      ).rejects.toThrow(
        'Invalid location data format. Expected an array of locations.',
      );
    });

    it('should validate individual location coordinates', async () => {
      const invalidLocationData = [{ latitude: null, longitude: -122.4194 }];

      await expect(
        provider.submitLocations(mockUserId, invalidLocationData as any),
      ).rejects.toThrow(DataSyncException);
      await expect(
        provider.submitLocations(mockUserId, invalidLocationData as any),
      ).rejects.toThrow(
        'Invalid location data: each location must have latitude and longitude.',
      );
    });

    it('should handle location data store errors', async () => {
      mockLocationDataStore.set.mockRejectedValue(new Error('Store error'));

      await expect(
        provider.submitLocations(mockUserId, mockLocationData),
      ).rejects.toThrow(DataSyncException);
      await expect(
        provider.submitLocations(mockUserId, mockLocationData),
      ).rejects.toThrow('Failed to submit location data: Store error');
    });

    it('should re-throw DataSyncException as-is', async () => {
      const customError = new DataSyncException(
        'LOCATION_SERVICES',
        'Custom store error',
      );
      mockLocationDataStore.set.mockRejectedValue(customError);

      await expect(
        provider.submitLocations(mockUserId, mockLocationData),
      ).rejects.toThrow(customError);
    });
  });

  describe('status', () => {
    const mockUserIntegration = {
      userIntegrationId: 'ui_123',
      userId: mockUserId,
      integrationId: mockIntegration.integrationId,
      status: 'CONNECTED',
      recSeq: 0,
    };

    const mockHistory = {
      lastSyncedAt: new Date('2023-06-01'),
    };

    it('should return connected status', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(mockUserIntegration as any);
      (
        mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
      ).mockResolvedValue(mockHistory as any);

      const result = await provider.status(mockUserId);

      expect(result).toEqual({
        connected: true,
        lastSyncedAt: mockHistory.lastSyncedAt,
        details: {
          integrationId: mockIntegration.integrationId,
          status: 'CONNECTED',
          message:
            'Location services integration is a stub - implementation pending',
        },
      });
    });

    it('should return not connected when no user integration exists', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result).toEqual({
        connected: false,
        lastSyncedAt: null,
        details: {
          integrationId: mockIntegration.integrationId,
          status: 'NOT_CONNECTED',
          message:
            'Location services integration is a stub - implementation pending',
        },
      });
    });

    it('should return disconnected when user integration status is not CONNECTED', async () => {
      const disconnectedIntegration = {
        ...mockUserIntegration,
        status: 'DISCONNECTED',
      };
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(disconnectedIntegration as any);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(false);
      expect(result.details.status).toBe('DISCONNECTED');
    });

    it('should handle no history record', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(mockUserIntegration as any);
      (
        mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(true);
      expect(result.lastSyncedAt).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockRejectedValue(new Error('DB error'));

      // The method doesn't handle errors, so it should throw
      await expect(provider.status(mockUserId)).rejects.toThrow('DB error');
    });
  });
});
