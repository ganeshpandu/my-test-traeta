import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ListItemsService } from './list-items.service';
import {
  ACTIVE_CONDITION,
  DB_NAME,
  RESPONSE_STATUS,
  TABLE_NAMES,
  REC_SEQ,
} from '../../constants';
import { PrismaService } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import { HttpStatus } from '@nestjs/common';
import { CreateListItemDto, UpdateListItemDto } from './dto/list-items.dto';

const mockPrisma = {
  listItems: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  lists: {
    findFirst: jest.fn(),
  },
  itemCategories: {
    findFirst: jest.fn(),
  },
};

const mockLogger = {
  logger: jest.fn(),
};

const mockUtility = {
  buildFilter: jest.fn(),
  updateEntity: jest.fn(),
  inferCategory: jest.fn(),
};

const createDto = {
  listItemId: 'id-1',
  listId: 'list-1',
  userListId: 'user-list-1',
  title: 'Item 1',
  description: 'Desc',
  attributes: null,
  attributeDataType: null,
  unit: null,
};

const updateDto = {
  name: 'Updated Name',
  description: 'Updated Desc',
};

describe('ListItemsService', () => {
  let service: ListItemsService;

  beforeAll(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListItemsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TechvLogger, useValue: mockLogger },
        { provide: UtilityService, useValue: mockUtility },
      ],
    }).compile();

    service = module.get<ListItemsService>(ListItemsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a list item and return CREATED', async () => {
      const created = { ...createDto, recSeq: REC_SEQ.DEFAULT_RECORD };
      mockPrisma.listItems.create.mockResolvedValue(created);
      mockPrisma.listItems.findFirst.mockResolvedValue(null);
      mockPrisma.lists.findFirst.mockResolvedValue({ name: 'Test List' });
      mockUtility.inferCategory.mockReturnValue(null);

      const res = await service.create(
        createDto as CreateListItemDto,
        'test-user',
      );

      expect(mockPrisma.listItems.create).toHaveBeenCalledWith({
        data: expect.objectContaining<Record<string, unknown>>({
          listId: createDto.listId,
          userListId: createDto.userListId,
          title: createDto.title,
          attributes: Prisma.JsonNull,
          attributeDataType: Prisma.JsonNull,
          unit: Prisma.JsonNull,
          ...ACTIVE_CONDITION,
          createdBy: 'test-user',
        }) as unknown,
      });
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.data).toEqual(created);
    });

    it('should handle errors and return INTERNAL_SERVER_ERROR', async () => {
      mockPrisma.listItems.create.mockRejectedValue(new Error('db error'));

      const res = await service.create(
        createDto as CreateListItemDto,
        'test-user',
      );

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('findAll', () => {
    it('should return items with pagination metadata', async () => {
      const filterDto = { pageNumber: 2, limit: 5, search: 'abc' };
      const userId = 'test-user-id';
      const items = [{ listItemId: 'id-1' }, { listItemId: 'id-2' }];

      mockUtility.buildFilter.mockReturnValue({});
      mockPrisma.listItems.findMany.mockResolvedValue(items);
      mockPrisma.listItems.count.mockResolvedValue(12);

      const res = await service.findAll(filterDto, userId);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.data).toEqual({
        data: items,
        metadata: { pageNumber: 2, limit: 5, totalCount: 12 },
      });
    });

    it('should handle errors and return INTERNAL_SERVER_ERROR', async () => {
      const filterDto = { pageNumber: 1, limit: 10 };
      const userId = 'test-user-id';
      mockUtility.buildFilter.mockReturnValue({});
      mockPrisma.listItems.findMany.mockRejectedValue(new Error('db error'));

      const res = await service.findAll(filterDto, userId);

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('findUnique', () => {
    it('should return a single item', async () => {
      const item = { listItemId: 'id-1', recSeq: 0 };
      mockPrisma.listItems.findUnique.mockResolvedValue(item);

      const res = await service.findUnique('id-1');

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.data).toEqual(item);
    });

    it('should handle errors and return INTERNAL_SERVER_ERROR', async () => {
      mockPrisma.listItems.findUnique.mockRejectedValue(new Error('db err'));

      const res = await service.findUnique('id-1');

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('update', () => {
    it('should return NOT_FOUND if base record does not exist', async () => {
      mockPrisma.listItems.findUnique.mockResolvedValue(null);

      const res = await service.update(
        'id-1',
        updateDto as UpdateListItemDto,
        'test-user',
      );

      expect(mockPrisma.listItems.findUnique).toHaveBeenCalledWith({
        where: {
          listItemId_recSeq: {
            listItemId: 'id-1',
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should update using utilityService.updateEntity and return OK', async () => {
      mockPrisma.listItems.findUnique.mockResolvedValue({ listItemId: 'id-1' });
      const updated = { listItemId: 'id-1', name: 'Updated Name' };
      mockUtility.updateEntity.mockResolvedValue(updated);

      const res = await service.update(
        'id-1',
        updateDto as UpdateListItemDto,
        'test-user',
      );

      expect(mockUtility.updateEntity).toHaveBeenCalledWith({
        dbname: DB_NAME,
        tablename: TABLE_NAMES.LIST_ITEMS,
        updateData: expect.objectContaining<Record<string, unknown>>({
          name: updateDto.name,
          description: updateDto.description,
          modifiedBy: 'test-user',
        }) as unknown,
        primaryKeyCriteria: { listItemId: 'id-1' },
        requestId: 'test-user',
        username: 'test-user',
      });
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.data).toEqual(updated);
    });

    it('should handle errors and return INTERNAL_SERVER_ERROR', async () => {
      mockPrisma.listItems.findUnique.mockResolvedValue({ listItemId: 'id-1' });
      mockUtility.updateEntity.mockRejectedValue(new Error('upd err'));

      const res = await service.update(
        'id-1',
        updateDto as UpdateListItemDto,
        'test-user',
      );

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('delete', () => {
    it('should return NOT_FOUND if base record does not exist', async () => {
      mockPrisma.listItems.findUnique.mockResolvedValue(null);

      const res = await service.delete('id-404');

      expect(mockPrisma.listItems.findUnique).toHaveBeenCalledWith({
        where: {
          listItemId_recSeq: {
            listItemId: 'id-404',
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
      });
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should soft delete and return OK', async () => {
      mockPrisma.listItems.findUnique.mockResolvedValue({ listItemId: 'id-1' });
      mockPrisma.listItems.update.mockResolvedValue({});

      const res = await service.delete('id-1');

      expect(mockPrisma.listItems.update).toHaveBeenCalledWith({
        where: {
          listItemId_recSeq: {
            listItemId: 'id-1',
            recSeq: REC_SEQ.DEFAULT_RECORD,
          },
          ...ACTIVE_CONDITION,
        },
        data: { recStatus: 'I' },
      });
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.data).toBe(RESPONSE_STATUS.SUCCESS.DELETE);
    });

    it('should handle errors and return INTERNAL_SERVER_ERROR', async () => {
      mockPrisma.listItems.findUnique.mockResolvedValue({ listItemId: 'id-1' });
      mockPrisma.listItems.update.mockRejectedValue(new Error('del err'));

      const res = await service.delete('id-1');

      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });
});
