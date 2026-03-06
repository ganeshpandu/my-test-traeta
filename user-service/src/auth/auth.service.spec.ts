import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseService } from '../firebase/firebase.config';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import {
  RESPONSE_STATUS,
  REC_SEQ,
  ACTIVE_CONDITION,
  ADMIN,
} from '../../constants';
import { RefreshDto, SignDto } from './dto/auth.dto';
import { DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import { SignEntity } from './entity/auth.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  let jwt: JwtService;
  let prisma: PrismaService;

  const signDto: SignDto = { idToken: 'test-id-token' };
  const refreshDto: RefreshDto = { accessToken: 'access-token' };

  const decodedToken: Partial<DecodedIdToken> = { uid: 'uid-123' };
  const userRecord: Partial<UserRecord> = {
    uid: 'uid-123',
    phoneNumber: '+10000000000',
  };

  const mockUser = {
    userId: 'uid-123',
    phoneNumber: '+10000000000',
    recSeq: REC_SEQ.DEFAULT_RECORD,
    recStatus: ACTIVE_CONDITION.recStatus,
    dataStatus: ACTIVE_CONDITION.dataStatus,
    createdBy: ADMIN,
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: FirebaseService,
          useValue: {
            auth: {
              verifyIdToken: jest.fn().mockResolvedValue(decodedToken),
              getUser: jest.fn().mockResolvedValue(userRecord),
              revokeRefreshTokens: jest.fn().mockResolvedValue(true),
              createCustomToken: jest.fn().mockResolvedValue('new-token'),
            },
          },
        },
        {
          provide: PrismaService,
          useValue: {
            users: {
              findUnique: jest.fn().mockResolvedValue(mockUser),
              create: jest.fn().mockResolvedValue(mockUser),
            },
            loginActionHistory: {
              create: jest.fn().mockResolvedValue({}),
              count: jest.fn().mockResolvedValue(1),
            },
          },
        },
        { provide: TechvLogger, useValue: { logger: jest.fn() } },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('new-token'),
            verify: jest.fn().mockReturnValue({
              userId: 'uid-123',
              phoneNumber: '+10000000000',
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'JWT_SECRET') return 'secret';
              if (key === 'JWT_ACCESS_SECRET') return 'access-secret';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwt = module.get<JwtService>(JwtService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('verifyUser', () => {
    it('returns BAD_REQUEST when idToken is undefined', async () => {
      const result = await service.verifyUser({} as SignDto);
      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('returns BAD_REQUEST when idToken is empty', async () => {
      const result = await service.verifyUser({ idToken: '' } as SignDto);
      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('creates a new user when not found', async () => {
      (prisma.users.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const result = await service.verifyUser(signDto);
      expect(result.status).toBe(HttpStatus.OK);
      expect((result.data as SignEntity).user).toEqual(mockUser);
      expect((result.data as SignEntity).token).toBe('new-token');
      expect((result.data as SignEntity).count).toBeUndefined();
    });

    it('returns existing user info and increments count when found', async () => {
      const result = await service.verifyUser(signDto);
      expect(result.status).toBe(HttpStatus.OK);
      expect((result.data as SignEntity).user).toEqual(mockUser);
      expect((result.data as SignEntity).token).toBe('new-token');
      expect((result.data as SignEntity).count).toEqual(expect.any(Number));
    });
  });

  describe('refreshToken', () => {
    it('returns BAD_REQUEST when accessToken is undefined', () => {
      const result = service.refreshToken({} as RefreshDto);
      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('returns BAD_REQUEST when accessToken is empty', () => {
      const result = service.refreshToken({
        accessToken: '',
      } as RefreshDto);
      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.REQUIRED,
      );
    });

    it('returns OK with new access token on success', () => {
      const result = service.refreshToken(refreshDto);
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual({ accessToken: 'new-token' });
    });

    it('returns INTERNAL_SERVER_ERROR on error', () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('boom');
      });
      const result = service.refreshToken(refreshDto);
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('logout', () => {
    it('returns BAD_REQUEST when accessToken missing', () => {
      const result = service.logout({ accessToken: '' } as RefreshDto);
      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBe(
        RESPONSE_STATUS.TOKEN + RESPONSE_STATUS.ERROR.REQUIRED,
      );
    });

    it('returns OK on success', () => {
      const result = service.logout(refreshDto);
      expect(result.status).toBe(HttpStatus.OK);
      expect(typeof result.data).toBe('string');
      expect(result.data.toLowerCase()).toContain('logout');
    });

    it('returns INTERNAL_SERVER_ERROR on error', () => {
      (jwt.verify as jest.Mock).mockImplementationOnce(() => {
        throw new Error('bad');
      });
      const result = service.logout(refreshDto);
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });
});
