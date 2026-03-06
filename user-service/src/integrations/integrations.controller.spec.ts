import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { FirebaseAuthGuard } from '../firebase/firebase-auth.guard';
import { UserOwnershipGuard } from './guards/user-ownership.guard';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('IntegrationsController Security', () => {
  let controller: IntegrationsController;
  let service: IntegrationsService;
  let firebaseGuard: FirebaseAuthGuard;
  let ownershipGuard: UserOwnershipGuard;

  const mockIntegrationsService = {
    createConnection: jest.fn(),
    handleCallback: jest.fn(),
    handleCallbackWithUserData: jest.fn(),
    sync: jest.fn(),
    status: jest.fn(),
    handleAppleHealthUpload: jest.fn(),
    getIntegrationConfig: jest.fn(),
    getConnectedUserData: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        {
          provide: IntegrationsService,
          useValue: mockIntegrationsService,
        },
        {
          provide: FirebaseAuthGuard,
          useValue: {
            canActivate: jest.fn(),
          },
        },
        {
          provide: UserOwnershipGuard,
          useValue: {
            canActivate: jest.fn(),
          },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<IntegrationsController>(IntegrationsController);
    service = module.get<IntegrationsService>(IntegrationsService);
    firebaseGuard = module.get<FirebaseAuthGuard>(FirebaseAuthGuard);
    ownershipGuard = module.get<UserOwnershipGuard>(UserOwnershipGuard);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Tests', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have FirebaseAuthGuard applied at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', IntegrationsController);
      expect(guards).toBeDefined();
    });

    describe('connect endpoint', () => {
      it('should call createConnection with valid authenticated user', async () => {
        const mockUser = {
          uid: 'user-123',
          email: 'test@example.com',
          phoneNumber: null,
        };
        const provider = 'spotify';
        const userId = 'user-123';

        mockIntegrationsService.createConnection.mockResolvedValue({
          authUrl: 'https://accounts.spotify.com/authorize?...',
        });

        const result = await controller.connect(provider, userId, mockUser);

        expect(mockIntegrationsService.createConnection).toHaveBeenCalledWith(
          provider,
          userId,
        );
        expect(result).toHaveProperty('authUrl');
      });
    });

    describe('sync endpoint', () => {
      it('should call sync with valid authenticated user', async () => {
        const mockUser = {
          uid: 'user-123',
          email: 'test@example.com',
          phoneNumber: null,
        };
        const provider = 'spotify';
        const userId = 'user-123';

        mockIntegrationsService.sync.mockResolvedValue({
          success: true,
          syncedData: {},
        });

        const result = await controller.sync(provider, userId, mockUser);

        expect(mockIntegrationsService.sync).toHaveBeenCalledWith(
          provider,
          userId,
        );
        expect(result).toHaveProperty('success', true);
      });
    });

    describe('status endpoint', () => {
      it('should call status with valid authenticated user', async () => {
        const mockUser = {
          uid: 'user-123',
          email: 'test@example.com',
          phoneNumber: null,
        };
        const provider = 'spotify';
        const userId = 'user-123';

        mockIntegrationsService.status.mockResolvedValue({
          connected: true,
          lastSyncedAt: new Date().toISOString(),
          status: 'active',
        });

        const result = await controller.status(provider, userId, mockUser);

        expect(mockIntegrationsService.status).toHaveBeenCalledWith(
          provider,
          userId,
        );
        expect(result).toHaveProperty('connected', true);
      });
    });

    describe('callback endpoints (public)', () => {
      it('should allow callback without authentication and return user data for supported providers', async () => {
        const provider = 'spotify';
        const payload = { code: 'auth-code', state: 'state-123' };

        mockIntegrationsService.handleCallbackWithUserData.mockResolvedValue({
          ok: true,
          user: {},
          syncedData: {},
        });

        const result = await controller.callbackPost(provider, payload);

        expect(
          mockIntegrationsService.handleCallbackWithUserData,
        ).toHaveBeenCalledWith(provider, payload);
        expect(result).toHaveProperty('ok', true);
      });
    });
  });

  describe('UserOwnershipGuard Tests', () => {
    let guard: UserOwnershipGuard;
    let mockExecutionContext: ExecutionContext;

    beforeAll(() => {
      guard = new UserOwnershipGuard();
      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn(),
        }),
      } as any;
    });

    it('should allow access when userId matches authenticated user', () => {
      const mockRequest = {
        user: { uid: 'user-123', email: 'test@example.com' },
        body: { userId: 'user-123' },
      };

      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue(mockRequest);

      expect(guard.canActivate(mockExecutionContext)).toBe(true);
    });

    it('should deny access when userId does not match authenticated user', () => {
      const mockRequest = {
        user: { uid: 'user-123', email: 'test@example.com' },
        body: { userId: 'user-456' }, // Different user!
      };

      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue(mockRequest);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        ForbiddenException,
      );
    });

    it('should deny access when userId is missing', () => {
      const mockRequest = {
        user: { uid: 'user-123', email: 'test@example.com' },
        body: {}, // No userId
      };

      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue(mockRequest);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow();
    });

    it('should deny access when user is not authenticated', () => {
      const mockRequest = {
        user: null, // No authenticated user
        body: { userId: 'user-123' },
      };

      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue(mockRequest);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        ForbiddenException,
      );
    });

    it('should check query params if userId not in body', () => {
      const mockRequest = {
        user: { uid: 'user-123', email: 'test@example.com' },
        body: {},
        query: { userId: 'user-123' },
      };

      (
        mockExecutionContext.switchToHttp().getRequest as jest.Mock
      ).mockReturnValue(mockRequest);

      expect(guard.canActivate(mockExecutionContext)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    describe('Apple Health Upload', () => {
      it('should upload health data with valid authentication', async () => {
        const mockUser = {
          uid: 'user-123',
          email: 'test@example.com',
          phoneNumber: null,
        };
        const payload = {
          userId: 'user-123',
          uploadToken: 'token-abc-123',
          healthData: { steps: 10000, heartRate: 75 },
        };

        mockIntegrationsService.handleAppleHealthUpload.mockResolvedValue({
          success: true,
          message: 'Health data uploaded successfully',
        });

        const result = await controller.appleHealthUpload(payload, mockUser);

        expect(
          mockIntegrationsService.handleAppleHealthUpload,
        ).toHaveBeenCalledWith(
          payload.userId,
          payload.uploadToken,
          payload.healthData,
        );
        expect(result).toHaveProperty('success', true);
      });
    });

    describe('Get Integration Config', () => {
      it('should return config with valid authentication', async () => {
        const mockUser = {
          uid: 'user-123',
          email: 'test@example.com',
          phoneNumber: null,
        };
        const provider = 'spotify';
        const userId = 'user-123';

        mockIntegrationsService.getIntegrationConfig.mockResolvedValue({
          clientId: 'client-id-123',
          scopes: ['user-read-email', 'user-top-read'],
          redirectUri: 'https://api.example.com/callback',
        });

        const result = await controller.getConfig(provider, userId, mockUser);

        expect(
          mockIntegrationsService.getIntegrationConfig,
        ).toHaveBeenCalledWith(provider, userId);
        expect(result).toHaveProperty('clientId');
        expect(result).toHaveProperty('scopes');
      });
    });

    describe('Get User Data', () => {
      it('should return user data with valid authentication', async () => {
        const mockUser = {
          uid: 'user-123',
          email: 'test@example.com',
          phoneNumber: null,
        };
        const provider = 'spotify';
        const userId = 'user-123';
        const forceSync = true;

        mockIntegrationsService.getConnectedUserData.mockResolvedValue({
          user: mockUser,
          data: { topTracks: [], topArtists: [] },
        });

        const result = await controller.getDataPost(
          provider,
          userId,
          mockUser,
          forceSync,
        );

        expect(
          mockIntegrationsService.getConnectedUserData,
        ).toHaveBeenCalledWith(provider, userId, forceSync);
        expect(result).toHaveProperty('user');
        expect(result).toHaveProperty('data');
      });
    });
  });
});
