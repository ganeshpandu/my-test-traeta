import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { PlaidProvider } from './providers/plaid.provider';
import { StravaProvider } from './providers/strava.provider';
import { SpotifyProvider } from './providers/spotify.provider';
import { AppleHealthProvider } from './providers/apple-health.provider';
import { AppleMusicProvider } from './providers/apple-music.provider';
import { EmailScraperProvider } from './providers/email-scraper.provider';
import { LocationServicesProvider } from './providers/location-services.provider';
import { ContactListProvider } from './providers/contact-list.provider';
import { GoodreadsProvider } from './providers/goodreads.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from './persistence';
import { TokenStore } from './token-store';
import { IntegrationProviderName } from './types';
import { Logger } from '@nestjs/common';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let controller: IntegrationsController;
  let mockPlaidProvider: jest.Mocked<PlaidProvider>;
  let mockStravaProvider: jest.Mocked<StravaProvider>;
  let mockSpotifyProvider: jest.Mocked<SpotifyProvider>;
  let mockAppleHealthProvider: jest.Mocked<AppleHealthProvider>;
  let mockAppleMusicProvider: jest.Mocked<AppleMusicProvider>;
  let mockEmailScraperProvider: jest.Mocked<EmailScraperProvider>;
  let mockLocationServicesProvider: jest.Mocked<LocationServicesProvider>;
  let mockContactListProvider: jest.Mocked<ContactListProvider>;
  let mockGoodreadsProvider: jest.Mocked<GoodreadsProvider>;

  beforeAll(async () => {
    // Create mock providers
    mockPlaidProvider = {
      name: IntegrationProviderName.PLAID,
      createConnection: jest.fn(),
      handleCallback: jest.fn(),
      sync: jest.fn(),
      status: jest.fn(),
    } as any;

    mockStravaProvider = {
      name: IntegrationProviderName.STRAVA,
      createConnection: jest.fn(),
      handleCallback: jest.fn(),
      sync: jest.fn(),
      status: jest.fn(),
    } as any;

    mockSpotifyProvider = {
      name: IntegrationProviderName.SPOTIFY,
      createConnection: jest.fn(),
      handleCallback: jest.fn(),
      sync: jest.fn(),
      status: jest.fn(),
    } as any;

    mockAppleHealthProvider = {
      name: IntegrationProviderName.APPLE_HEALTH,
      createConnection: jest.fn(),
      handleCallback: jest.fn(),
      sync: jest.fn(),
      status: jest.fn(),
      handleDataUpload: jest.fn(),
    } as any;

    mockAppleMusicProvider = {
      name: IntegrationProviderName.APPLE_MUSIC,
      createConnection: jest.fn(),
      handleCallback: jest.fn(),
      sync: jest.fn(),
      status: jest.fn(),
    } as any;

    mockEmailScraperProvider = {
      name: IntegrationProviderName.EMAIL_SCRAPER,
      createConnection: jest.fn(),
      handleCallback: jest.fn(),
      sync: jest.fn(),
      status: jest.fn(),
    } as any;

    mockLocationServicesProvider = {
      name: IntegrationProviderName.LOCATION_SERVICES,
      createConnection: jest.fn(),
      handleCallback: jest.fn(),
      sync: jest.fn(),
      status: jest.fn(),
    } as any;

    mockContactListProvider = {
      name: IntegrationProviderName.CONTACT_LIST,
      createConnection: jest.fn(),
      handleCallback: jest.fn(),
      sync: jest.fn(),
      status: jest.fn(),
    } as any;

    mockGoodreadsProvider = {
      name: IntegrationProviderName.GOODREADS,
      createConnection: jest.fn(),
      handleCallback: jest.fn(),
      sync: jest.fn(),
      status: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        IntegrationsService,
        { provide: PlaidProvider, useValue: mockPlaidProvider },
        { provide: StravaProvider, useValue: mockStravaProvider },
        { provide: SpotifyProvider, useValue: mockSpotifyProvider },
        { provide: AppleHealthProvider, useValue: mockAppleHealthProvider },
        { provide: AppleMusicProvider, useValue: mockAppleMusicProvider },
        { provide: EmailScraperProvider, useValue: mockEmailScraperProvider },
        {
          provide: LocationServicesProvider,
          useValue: mockLocationServicesProvider,
        },
        { provide: ContactListProvider, useValue: mockContactListProvider },
        { provide: GoodreadsProvider, useValue: mockGoodreadsProvider },
        { provide: PrismaService, useValue: {} },
        { provide: IntegrationPersistence, useValue: {} },
        { provide: TokenStore, useValue: {} },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    controller = module.get<IntegrationsController>(IntegrationsController);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  describe('Service Tests', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    describe('createConnection', () => {
      it('should create connection for Plaid', async () => {
        const mockResponse = {
          provider: 'plaid',
          linkToken: 'test-token',
          state: 'test-state',
        };
        mockPlaidProvider.createConnection.mockResolvedValue(mockResponse);

        const result = await service.createConnection(
          IntegrationProviderName.PLAID,
          'user123',
        );

        expect(mockPlaidProvider.createConnection).toHaveBeenCalledWith(
          'user123',
        );
        expect(result).toEqual({
          ...mockResponse,
          provider: IntegrationProviderName.PLAID,
        });
      });

      it('should create connection for Strava', async () => {
        const mockResponse = {
          provider: 'strava',
          redirectUrl: 'https://strava.com/oauth',
          state: 'test-state',
        };
        mockStravaProvider.createConnection.mockResolvedValue(mockResponse);

        const result = await service.createConnection(
          IntegrationProviderName.STRAVA,
          'user123',
        );

        expect(mockStravaProvider.createConnection).toHaveBeenCalledWith(
          'user123',
        );
        expect(result).toEqual({
          ...mockResponse,
          provider: IntegrationProviderName.STRAVA,
        });
      });

      it('should create connection for Spotify', async () => {
        const mockResponse = {
          provider: 'spotify',
          redirectUrl: 'https://spotify.com/oauth',
          state: 'test-state',
        };
        mockSpotifyProvider.createConnection.mockResolvedValue(mockResponse);

        const result = await service.createConnection(
          IntegrationProviderName.SPOTIFY,
          'user123',
        );

        expect(mockSpotifyProvider.createConnection).toHaveBeenCalledWith(
          'user123',
        );
        expect(result).toEqual({
          ...mockResponse,
          provider: IntegrationProviderName.SPOTIFY,
        });
      });

      it('should create connection for Apple Health', async () => {
        const mockResponse = {
          provider: 'apple_health',
          redirectUrl: 'applehealth://connect',
          state: 'test-state',
        };
        mockAppleHealthProvider.createConnection.mockResolvedValue(
          mockResponse,
        );

        const result = await service.createConnection(
          IntegrationProviderName.APPLE_HEALTH,
          'user123',
        );

        expect(mockAppleHealthProvider.createConnection).toHaveBeenCalledWith(
          'user123',
        );
        expect(result).toEqual({
          ...mockResponse,
          provider: IntegrationProviderName.APPLE_HEALTH,
        });
      });

      it('should create connection for Apple Music', async () => {
        const mockResponse = {
          provider: 'apple_music',
          redirectUrl: 'https://music.apple.com/oauth',
          state: 'test-state',
        };
        mockAppleMusicProvider.createConnection.mockResolvedValue(mockResponse);

        const result = await service.createConnection(
          IntegrationProviderName.APPLE_MUSIC,
          'user123',
        );

        expect(mockAppleMusicProvider.createConnection).toHaveBeenCalledWith(
          'user123',
        );
        expect(result).toEqual({
          ...mockResponse,
          provider: IntegrationProviderName.APPLE_MUSIC,
        });
      });

      it('should create connection for Email Scraper', async () => {
        const mockResponse = {
          provider: 'email_scraper',
          redirectUrl: 'https://accounts.google.com/oauth',
          state: 'test-state',
        };
        mockEmailScraperProvider.createConnection.mockResolvedValue(
          mockResponse,
        );

        const result = await service.createConnection(
          IntegrationProviderName.EMAIL_SCRAPER,
          'user123',
        );

        expect(mockEmailScraperProvider.createConnection).toHaveBeenCalledWith(
          'user123',
        );
        expect(result).toEqual({
          ...mockResponse,
          provider: IntegrationProviderName.EMAIL_SCRAPER,
        });
      });

      it('should throw error for unknown provider', async () => {
        await expect(
          service.createConnection(
            'unknown' as IntegrationProviderName,
            'user123',
          ),
        ).rejects.toThrow(
          "Integration provider 'unknown' is not supported or not found",
        );
      });
    });

    describe('handleCallback', () => {
      it('should handle callback for each provider', async () => {
        const payload = { code: 'test-code', state: 'test-state' };

        await service.handleCallback(IntegrationProviderName.PLAID, payload);
        expect(mockPlaidProvider.handleCallback).toHaveBeenCalledWith(payload);

        await service.handleCallback(IntegrationProviderName.STRAVA, payload);
        expect(mockStravaProvider.handleCallback).toHaveBeenCalledWith(payload);

        await service.handleCallback(IntegrationProviderName.SPOTIFY, payload);
        expect(mockSpotifyProvider.handleCallback).toHaveBeenCalledWith(
          payload,
        );

        await service.handleCallback(
          IntegrationProviderName.APPLE_HEALTH,
          payload,
        );
        expect(mockAppleHealthProvider.handleCallback).toHaveBeenCalledWith(
          payload,
        );

        await service.handleCallback(
          IntegrationProviderName.APPLE_MUSIC,
          payload,
        );
        expect(mockAppleMusicProvider.handleCallback).toHaveBeenCalledWith(
          payload,
        );

        await service.handleCallback(
          IntegrationProviderName.EMAIL_SCRAPER,
          payload,
        );
        expect(mockEmailScraperProvider.handleCallback).toHaveBeenCalledWith(
          payload,
        );
      });
    });

    describe('sync', () => {
      it('should sync data for each provider', async () => {
        const mockSyncResult = { ok: true, syncedAt: new Date() };

        mockPlaidProvider.sync.mockResolvedValue(mockSyncResult);
        mockStravaProvider.sync.mockResolvedValue(mockSyncResult);
        mockSpotifyProvider.sync.mockResolvedValue(mockSyncResult);
        mockAppleHealthProvider.sync.mockResolvedValue(mockSyncResult);
        mockAppleMusicProvider.sync.mockResolvedValue(mockSyncResult);
        mockEmailScraperProvider.sync.mockResolvedValue(mockSyncResult);

        const providers = [
          IntegrationProviderName.PLAID,
          IntegrationProviderName.STRAVA,
          IntegrationProviderName.SPOTIFY,
          IntegrationProviderName.APPLE_HEALTH,
          IntegrationProviderName.APPLE_MUSIC,
          IntegrationProviderName.EMAIL_SCRAPER,
        ];

        for (const provider of providers) {
          const result = await service.sync(provider, 'user123');
          expect(result).toEqual(mockSyncResult);
        }
      });
    });

    describe('status', () => {
      it('should get status for each provider', async () => {
        const mockStatus = { connected: true, lastSyncedAt: new Date() };

        mockPlaidProvider.status.mockResolvedValue(mockStatus);
        mockStravaProvider.status.mockResolvedValue(mockStatus);
        mockSpotifyProvider.status.mockResolvedValue(mockStatus);
        mockAppleHealthProvider.status.mockResolvedValue(mockStatus);
        mockAppleMusicProvider.status.mockResolvedValue(mockStatus);
        mockEmailScraperProvider.status.mockResolvedValue(mockStatus);

        const providers = [
          IntegrationProviderName.PLAID,
          IntegrationProviderName.STRAVA,
          IntegrationProviderName.SPOTIFY,
          IntegrationProviderName.APPLE_HEALTH,
          IntegrationProviderName.APPLE_MUSIC,
          IntegrationProviderName.EMAIL_SCRAPER,
        ];

        for (const provider of providers) {
          const result = await service.status(provider, 'user123');
          expect(result).toEqual(mockStatus);
        }
      });
    });

    describe('Apple Health specific methods', () => {
      it('should handle Apple Health data upload', async () => {
        const mockResult = { ok: true, message: 'Data uploaded successfully' };
        mockAppleHealthProvider.handleDataUpload.mockResolvedValue(mockResult);

        const result = await service.handleAppleHealthUpload(
          'user123',
          'upload-token',
          { workouts: [] },
        );

        expect(mockAppleHealthProvider.handleDataUpload).toHaveBeenCalledWith(
          'user123',
          'upload-token',
          { workouts: [] },
        );
        expect(result).toEqual(mockResult);
      });
    });

    describe('Apple Music specific methods', () => {
      it('should handle Apple Music authorization', async () => {
        const mockResult = {
          ok: true,
          message: 'Apple Music authorized successfully',
        };
        mockAppleMusicProvider.handleCallback.mockResolvedValue(undefined);

        const result = await service.handleAppleMusicAuthorization(
          'user123',
          'music-user-token',
        );

        expect(mockAppleMusicProvider.handleCallback).toHaveBeenCalledWith({
          music_user_token: 'music-user-token',
          state: expect.stringContaining('apple-music-user123-'),
        });
        expect(result).toEqual(mockResult);
      });
    });

    describe('getIntegrationConfig', () => {
      it('should get Apple Health config', async () => {
        const mockStatus = { connected: true, lastSyncedAt: new Date() };
        mockAppleHealthProvider.status.mockResolvedValue(mockStatus);

        const result = await service.getIntegrationConfig(
          IntegrationProviderName.APPLE_HEALTH,
          'user123',
        );

        expect(result).toEqual({
          provider: 'apple_health',
          uploadEndpoint: expect.any(String),
          connected: true,
          lastSyncedAt: mockStatus.lastSyncedAt,
          supportedDataTypes: [
            'workouts',
            'healthMetrics',
            'steps',
            'heartRate',
            'sleep',
          ],
        });
      });

      it('should get Apple Music config', async () => {
        const mockStatus = {
          connected: true,
          lastSyncedAt: new Date(),
          details: {},
        };
        mockAppleMusicProvider.status.mockResolvedValue(mockStatus);

        const result = await service.getIntegrationConfig(
          IntegrationProviderName.APPLE_MUSIC,
          'user123',
        );

        expect(result).toEqual({
          provider: 'apple_music',
          connected: true,
          lastSyncedAt: mockStatus.lastSyncedAt,
          authorizationUrl: 'https://authorize.music.apple.com/woa',
          supportedDataTypes: ['recentlyPlayed', 'librarySongs', 'playlists'],
          details: mockStatus.details,
        });
      });

      it('should get Strava config', async () => {
        const mockStatus = { connected: true, lastSyncedAt: new Date() };
        mockStravaProvider.status.mockResolvedValue(mockStatus);

        const result = await service.getIntegrationConfig(
          IntegrationProviderName.STRAVA,
          'user123',
        );

        expect(result).toEqual({
          provider: 'strava',
          connected: true,
          lastSyncedAt: mockStatus.lastSyncedAt,
          authorizationUrl: 'https://www.strava.com/oauth/authorize',
          supportedDataTypes: ['activities'],
        });
      });

      it('should get default config for other providers', async () => {
        const mockStatus = {
          connected: true,
          lastSyncedAt: new Date(),
          details: {},
        };
        mockSpotifyProvider.status.mockResolvedValue(mockStatus);

        const result = await service.getIntegrationConfig(
          IntegrationProviderName.SPOTIFY,
          'user123',
        );

        expect(result).toEqual({
          provider: IntegrationProviderName.SPOTIFY,
          connected: true,
          lastSyncedAt: mockStatus.lastSyncedAt,
          details: mockStatus.details,
        });
      });
    });
  });

  describe('Controller Tests', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    describe('connect', () => {
      it('should call service createConnection', async () => {
        const mockResponse = { provider: 'plaid', linkToken: 'test-token' };
        jest.spyOn(service, 'createConnection').mockResolvedValue(mockResponse);

        const mockUser = { uid: 'user123', email: 'test@example.com' };
        const result = await controller.connect(
          'plaid',
          'user123',
          mockUser as any,
        );

        expect(service.createConnection).toHaveBeenCalledWith(
          'plaid',
          'user123',
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('callback', () => {
      // it('should handle GET callback', async () => {
      //     jest.spyOn(service, 'handleCallback').mockResolvedValue(undefined);

      //     const result = await controller.callbackGet('spotify', { code: 'test-code' });

      //     expect(service.handleCallback).toHaveBeenCalledWith('spotify', { code: 'test-code' });
      //     expect(result).toEqual({ ok: true });
      // });

      it('should handle POST callback', async () => {
        jest.spyOn(service, 'handleCallback').mockResolvedValue(undefined);

        const result = await controller.callbackPost('strava', {
          code: 'test-code',
        });

        expect(service.handleCallback).toHaveBeenCalledWith('strava', {
          code: 'test-code',
        });
        expect(result).toEqual({
          ok: true,
          message: 'Integration connected successfully',
        });
      });
    });

    describe('sync', () => {
      it('should call service sync via POST', async () => {
        const mockResponse = { ok: true };
        jest.spyOn(service, 'sync').mockResolvedValue(mockResponse);

        const mockUser = { uid: 'user123', email: 'test@example.com' };
        const result = await controller.sync(
          'plaid',
          'user123',
          mockUser as any,
        );

        expect(service.sync).toHaveBeenCalledWith('plaid', 'user123');
        expect(result).toEqual(mockResponse);
      });

      it('should call service sync for different provider', async () => {
        const mockResponse = { ok: true };
        jest.spyOn(service, 'sync').mockResolvedValue(mockResponse);

        const mockUser = { uid: 'user123', email: 'test@example.com' };
        const result = await controller.sync(
          'spotify',
          'user123',
          mockUser as any,
        );

        expect(service.sync).toHaveBeenCalledWith('spotify', 'user123');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('status', () => {
      it('should call service status', async () => {
        const mockResponse = { connected: true };
        jest.spyOn(service, 'status').mockResolvedValue(mockResponse);

        const mockUser = { uid: 'user123', email: 'test@example.com' };
        const result = await controller.status(
          'strava',
          'user123',
          mockUser as any,
        );

        expect(service.status).toHaveBeenCalledWith('strava', 'user123');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Apple Health upload', () => {
      it('should handle Apple Health data upload', async () => {
        const mockResponse = { ok: true };
        jest
          .spyOn(service, 'handleAppleHealthUpload')
          .mockResolvedValue(mockResponse);

        const payload = {
          userId: 'user123',
          uploadToken: 'token',
          healthData: { workouts: [] },
        };

        const mockUser = { uid: 'user123', email: 'test@example.com' };
        const result = await controller.appleHealthUpload(
          payload,
          mockUser as any,
        );

        expect(service.handleAppleHealthUpload).toHaveBeenCalledWith(
          'user123',
          'token',
          { workouts: [] },
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('Apple Music authorization', () => {
      it('should handle Apple Music authorization via callback', async () => {
        const mockResponse = {
          ok: true,
          user: { id: 'user123' },
          syncedData: {},
        };
        jest
          .spyOn(service, 'handleCallbackWithUserData')
          .mockResolvedValue(mockResponse);

        const payload = {
          music_user_token: 'music-token',
          state: 'test-state',
        };

        const result = await controller.callbackPost('apple_music', payload);

        expect(service.handleCallbackWithUserData).toHaveBeenCalledWith(
          IntegrationProviderName.APPLE_MUSIC,
          payload,
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getConfig', () => {
      it('should get integration config', async () => {
        const mockUser = {
          uid: 'user123',
          email: 'test@example.com',
          phoneNumber: null,
        };
        const mockResponse = {
          provider: 'apple_health',
          uploadEndpoint: '/integrations/apple_health/upload',
          connected: true,
          lastSyncedAt: new Date('2023-01-01'),
          uploadToken: 'test-upload-token',
          supportedDataTypes: [
            'workouts',
            'healthMetrics',
            'steps',
            'heartRate',
            'sleep',
          ],
        };
        jest
          .spyOn(service, 'getIntegrationConfig')
          .mockResolvedValue(mockResponse);

        const result = await controller.getConfig(
          'apple_health',
          'user123',
          mockUser,
        );

        expect(service.getIntegrationConfig).toHaveBeenCalledWith(
          'apple_health',
          'user123',
        );
        expect(result).toEqual(mockResponse);
      });
    });
  });
});
