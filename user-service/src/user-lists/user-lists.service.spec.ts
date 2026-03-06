import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { UserListsService } from './user-lists.service';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import {
  RESPONSE_STATUS,
  REC_SEQ,
  REC_STATUS,
  DATA_STATUS,
  ADMIN,
} from '../../constants';
import { CreateUserListDto } from './dto/user-lists.dto';
import { UtilityService } from '../utility/utility.service';
import { UserListListEntity } from './entity/user-lists.entity';

type Tx = {
  userLists: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
  };
  userListIntegrations: {
    createMany: jest.Mock;
  };
};

const mockUserList = {
  userListId: 'ul-1',
  userId: 'user-1',
  listId: 'list-1',
  customName: 'My List',
  recSeq: REC_SEQ.DEFAULT_RECORD,
  recStatus: REC_STATUS.ACTIVE,
  dataStatus: DATA_STATUS.ACTIVE,
  createdBy: ADMIN,
  createdOn: new Date(),
  modifiedOn: new Date(),
  modifiedBy: null,
  userRecSeq: REC_SEQ.DEFAULT_RECORD,
  listRecSeq: REC_SEQ.DEFAULT_RECORD,
  integrations: [],
  list: { listId: 'list-1', name: 'Predefined' },
  _count: { ListItems: 0 },
};

const mockUpdatedUserList = {
  ...mockUserList,
  customName: 'Updated Name',
  modifiedOn: new Date(),
};
const userIdwithIntegrations = 'user-1';
const userIdwithoutIntegrations = 'user-2';
const dtoWithIntegrations: CreateUserListDto = {
  listId: 'list-1',
  customName: 'My List',
  integrations: [
    {
      integrationId: 'int-1',
      status: 'CONNECTED',
      connectedAt: '2025-09-29T12:00:00.000Z',
    },
  ],
};

const dtoWithoutIntegrations: CreateUserListDto = {
  listId: 'list-2',
  customName: 'Another List',
};

describe('UserListsService', () => {
  let service: UserListsService;
  let prisma: PrismaService;
  let utilityService: UtilityService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserListsService,
        {
          provide: TechvLogger,
          useValue: { logger: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            userLists: {
              create: jest.fn().mockResolvedValue(mockUserList),
              findMany: jest.fn().mockResolvedValue([mockUserList]),
              findUnique: jest.fn().mockResolvedValue(mockUserList),
              update: jest.fn().mockResolvedValue(mockUpdatedUserList),
              count: jest.fn().mockResolvedValue(1),
            },
            userListIntegrations: {
              createMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            $transaction: jest.fn((cb: (tx: Tx) => unknown) =>
              cb({
                userLists: {
                  create: jest.fn().mockResolvedValue(mockUserList),
                  findFirst: jest.fn().mockResolvedValue(null),
                  findUnique: jest.fn().mockResolvedValue(mockUserList),
                },
                userListIntegrations: {
                  createMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
              }),
            ),
          },
        },
        {
          provide: UtilityService,
          useValue: {
            buildFilter: jest.fn().mockReturnValue({}),
            updateEntity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserListsService>(UserListsService);
    prisma = module.get<PrismaService>(PrismaService);
    utilityService = module.get<UtilityService>(UtilityService);
  });

  afterAll(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create user list with integrations', async () => {
      const result = await service.create(
        dtoWithIntegrations,
        userIdwithIntegrations,
      );
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toBeTruthy();
      expect((prisma.$transaction as jest.Mock).mock.calls.length).toBe(1);
    });

    it('should create user list without integrations', async () => {
      const mockTx = {
        userLists: {
          create: jest.fn().mockResolvedValue(mockUserList),
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(mockUserList),
        },
        userListIntegrations: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };
      (prisma.$transaction as jest.Mock).mockImplementationOnce(
        (cb: (tx: Tx) => unknown) => cb(mockTx),
      );

      const result = await service.create(
        dtoWithoutIntegrations,
        userIdwithoutIntegrations,
      );
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(mockTx.userListIntegrations.createMany).not.toHaveBeenCalled();
    });

    it('should return BAD_REQUEST if user list already exists', async () => {
      (prisma.$transaction as jest.Mock).mockImplementationOnce(
        (cb: (tx: Partial<Tx>) => unknown) =>
          cb({
            userLists: {
              findFirst: jest.fn().mockResolvedValue(mockUserList),
              create: jest.fn(),
              findUnique: jest.fn(),
            },
          }),
      );

      const result = await service.create(
        dtoWithIntegrations,
        userIdwithIntegrations,
      );
      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.ALREADY_EXISTS);
    });

    it('should return INTERNAL_SERVER_ERROR on transaction failure', async () => {
      (prisma.$transaction as jest.Mock).mockImplementationOnce(() => {
        throw new Error('transaction failed');
      });

      const result = await service.create(
        dtoWithIntegrations,
        userIdwithIntegrations,
      );
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBe('transaction failed');
    });
  });

  describe('findAll', () => {
    it('should return all user lists with metadata', async () => {
      const result = await service.findAll(
        { pageNumber: 1, limit: 10, search: '' },
        mockUserList.userId,
      );
      expect(result.status).toBe(HttpStatus.OK);
      expect(Array.isArray((result.data as UserListListEntity).data)).toBe(
        true,
      );
      expect((result.data as UserListListEntity).metadata.totalCount).toBe(1);
    });

    it('should handle internal server error', async () => {
      jest
        .spyOn(prisma.userLists, 'findMany')
        .mockRejectedValueOnce(new Error('db error'));
      const result = await service.findAll(
        { pageNumber: 1, limit: 10 },
        mockUserList.userId,
      );
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('findUnique', () => {
    it('should return a single user list', async () => {
      const result = await service.findUnique(
        mockUserList.userListId,
        mockUserList.userId,
      );
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockUserList);
    });

    it('should handle internal server error', async () => {
      jest
        .spyOn(prisma.userLists, 'findUnique')
        .mockRejectedValueOnce(new Error('error'));
      const result = await service.findUnique('error-id', mockUserList.userId);
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('update', () => {
    it('should return NOT_FOUND when list does not exist', async () => {
      jest.spyOn(prisma.userLists, 'findUnique').mockResolvedValueOnce(null);
      const result = await service.update(
        'not-found',
        { customName: 'X' },
        mockUserList.userId,
      );
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should update successfully', async () => {
      jest
        .spyOn(prisma.userLists, 'findUnique')
        .mockResolvedValueOnce(mockUserList);
      (utilityService.updateEntity as jest.Mock).mockResolvedValue(
        mockUpdatedUserList,
      );
      const result = await service.update(
        'ul-1',
        { customName: 'Updated Name' },
        mockUserList.userId,
      );
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockUpdatedUserList);
    });

    it('should handle internal server error', async () => {
      jest
        .spyOn(prisma.userLists, 'findUnique')
        .mockRejectedValueOnce(new Error('db error'));
      const result = await service.update(
        'ul-1',
        { customName: 'X' },
        mockUserList.userId,
      );
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('delete', () => {
    it('should return NOT_FOUND when missing', async () => {
      jest.spyOn(prisma.userLists, 'findUnique').mockResolvedValueOnce(null);
      const result = await service.delete('missing-id', mockUserList.userId);
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should soft delete successfully', async () => {
      jest
        .spyOn(prisma.userLists, 'findUnique')
        .mockResolvedValueOnce(mockUserList);
      jest.spyOn(prisma.userLists, 'update').mockResolvedValueOnce({
        ...mockUserList,
        recStatus: REC_STATUS.INACTIVE,
      });

      const result = await service.delete('ul-1', mockUserList.userId);
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toBe(RESPONSE_STATUS.SUCCESS.DELETE);
    });

    it('should handle internal server error', async () => {
      jest
        .spyOn(prisma.userLists, 'findUnique')
        .mockRejectedValueOnce(new Error('db error'));
      const result = await service.delete('ul-1', mockUserList.userId);
      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });
});
