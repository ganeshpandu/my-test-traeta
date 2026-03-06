import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';
import { RESPONSE_STATUS, REC_STATUS, REC_SEQ } from '../../constants';
import { UpdateUserDto } from './dto/users.dto';
import { FirebaseService } from '../firebase/firebase.config';

describe('UsersService', () => {
  let service: UsersService;

  const prismaMock = {
    users: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const utilityMock = {
    updateEntity: jest.fn(),
  } as unknown as UtilityService;

  const loggerMock = {
    logger: jest.fn(),
  } as unknown as TechvLogger;

  const firebaseMock = {
    auth: {
      getUserByEmail: jest.fn(),
      deleteUser: jest.fn(),
    },
  } as unknown as FirebaseService;

  beforeAll(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FirebaseService, useValue: firebaseMock },
        { provide: UtilityService, useValue: utilityMock },
        { provide: TechvLogger, useValue: loggerMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    const userId = 'user-1';
    const dto: Partial<UpdateUserDto> = { firstName: 'John', lastName: 'Doe' };

    it('should return NOT_FOUND when user does not exist', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const res = await service.update(userId, dto);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.data).toBe(
        RESPONSE_STATUS.USER + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('should update and return OK when user exists', async () => {
      const existingUser = { userId, recSeq: REC_SEQ.DEFAULT_RECORD };
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce(
        existingUser,
      );
      const updateResult = { updated: true };
      (utilityMock.updateEntity as jest.Mock).mockResolvedValueOnce(
        updateResult,
      );

      const res = await service.update(userId, dto);

      expect(res.status).toBe(HttpStatus.OK);
    });

    it('should handle errors and return INTERNAL_SERVER_ERROR', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockRejectedValueOnce(
        new Error('db error'),
      );

      const res = await service.update(userId, dto);

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('findUnique', () => {
    const userId = 'user-2';

    it('should return NOT_FOUND when user does not exist', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const res = await service.findUnique(userId);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.data).toBe(
        RESPONSE_STATUS.USER + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('should return OK with user data when user exists', async () => {
      const userRecord = { userId, avatar: { keyCode: 'IMG', value: 'url' } };
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce(
        userRecord,
      );

      const res = await service.findUnique(userId);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.data).toHaveProperty('userId', userId);
    });

    it('should handle errors and return INTERNAL_SERVER_ERROR', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockRejectedValueOnce(
        new Error('db error'),
      );

      const res = await service.findUnique(userId);

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('delete', () => {
    const userId = 'user-3';

    it('should return NOT_FOUND when user does not exist', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const res = await service.delete(userId);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.data).toBe(
        RESPONSE_STATUS.USER + RESPONSE_STATUS.ERROR.NOT_FOUND,
      );
    });

    it('should soft-delete and return OK when user exists', async () => {
      const existingUser = { userId, recSeq: REC_SEQ.DEFAULT_RECORD };
      (prismaMock.users.findUnique as jest.Mock).mockResolvedValueOnce(
        existingUser,
      );
      const deleted = { userId, recStatus: REC_STATUS.DELETED };
      (prismaMock.users.update as jest.Mock).mockResolvedValueOnce(deleted);

      const res = await service.delete(userId);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.data).toEqual(
        RESPONSE_STATUS.USER + RESPONSE_STATUS.SUCCESS.DELETE,
      );
    });

    it('should handle errors and return INTERNAL_SERVER_ERROR', async () => {
      (prismaMock.users.findUnique as jest.Mock).mockRejectedValueOnce(
        new Error('db error'),
      );

      const res = await service.delete(userId);

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });
});
