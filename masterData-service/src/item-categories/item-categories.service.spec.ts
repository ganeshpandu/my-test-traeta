import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';
import { ItemCategoriesService } from './item-categories.service';
import { HttpStatus } from '@nestjs/common';
import {
  RESPONSE_STATUS,
  REC_SEQ,
  REC_STATUS,
  DATA_STATUS,
} from '../../constants';
import { ItemCategoryListEntity } from './entity/item-category.entity';
import {
  CreateItemCategoryDto,
  UpdateItemCategoryDto,
} from './dto/item-category.dto';
import { ListFilterDto } from 'src/lists/dto/list.dto';

const mockItemCategory = {
  listCategoryId: 'lc1',
  recSeq: REC_SEQ.DEFAULT_RECORD,
  recStatus: REC_STATUS.ACTIVE,
  listId: 'l1',
  listRecSeq: REC_SEQ.DEFAULT_RECORD,
  name: 'Groceries',
  dataStatus: DATA_STATUS.ACTIVE,
  createdBy: 'system',
  createdOn: new Date(),
  modifiedOn: new Date(),
  modifiedBy: null,
};

const mockUpdatedItemCategory = {
  ...mockItemCategory,
  name: 'Updated Category',
  modifiedOn: new Date(),
};

describe('ItemCategoriesService', () => {
  let service: ItemCategoriesService;

  const prismaMock = {
    itemCategories: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const loggerMock = { logger: jest.fn() };
  const utilityMock = { buildFilter: jest.fn(), updateEntity: jest.fn() };

  beforeAll(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemCategoriesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UtilityService, useValue: utilityMock },
        { provide: TechvLogger, useValue: loggerMock },
      ],
    }).compile();

    service = module.get<ItemCategoriesService>(ItemCategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new item category when not duplicate', async () => {
      (prismaMock.itemCategories.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prismaMock.itemCategories.create as jest.Mock).mockResolvedValueOnce(
        mockItemCategory,
      );

      const result = await service.create({
        name: mockItemCategory.name,
        listId: mockItemCategory.listId,
      } as CreateItemCategoryDto);

      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toEqual(mockItemCategory);
    });

    it('should reject duplicate name within same list', async () => {
      (prismaMock.itemCategories.findFirst as jest.Mock).mockResolvedValueOnce({
        ...mockItemCategory,
        listCategoryId: 'dup',
      });

      const result = await service.create({
        name: mockItemCategory.name,
        listId: mockItemCategory.listId,
      } as CreateItemCategoryDto);

      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.ALREADY_EXISTS);
    });
  });

  describe('findAll', () => {
    it('should return all active item categories with metadata', async () => {
      utilityMock.buildFilter.mockReturnValueOnce({});
      (prismaMock.itemCategories.findMany as jest.Mock).mockResolvedValueOnce([
        mockItemCategory,
      ]);
      (prismaMock.itemCategories.count as jest.Mock).mockResolvedValueOnce(1);

      const result = await service.findAll({
        pageNumber: 1,
        limit: 10,
      } as ListFilterDto);
      expect(result.status).toBe(HttpStatus.OK);
      expect((result.data as ItemCategoryListEntity).data).toEqual([
        mockItemCategory,
      ]);
      expect((result.data as ItemCategoryListEntity).metadata.totalCount).toBe(
        1,
      );
    });
  });

  describe('findUnique', () => {
    it('should return a single item category by ID', async () => {
      (prismaMock.itemCategories.findUnique as jest.Mock).mockResolvedValueOnce(
        mockItemCategory,
      );

      const result = await service.findUnique(mockItemCategory.listCategoryId);
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockItemCategory);
    });
  });

  describe('update', () => {
    it('should return NOT_FOUND when item category is missing', async () => {
      (prismaMock.itemCategories.findUnique as jest.Mock).mockResolvedValueOnce(
        null,
      );

      const result = await service.update('missing', {
        name: 'New',
      } as UpdateItemCategoryDto);
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should update successfully', async () => {
      (prismaMock.itemCategories.findUnique as jest.Mock).mockResolvedValueOnce(
        mockItemCategory,
      );
      utilityMock.updateEntity.mockResolvedValueOnce({
        status: HttpStatus.OK,
        data: mockUpdatedItemCategory,
      });

      const result = await service.update(mockItemCategory.listCategoryId, {
        name: mockUpdatedItemCategory.name,
      } as UpdateItemCategoryDto);
      expect(result.status).toBe(HttpStatus.OK);
      expect(
        (result.data as { data: typeof mockUpdatedItemCategory }).data,
      ).toEqual(mockUpdatedItemCategory);
    });
  });

  describe('delete', () => {
    it('should return NOT_FOUND when item category does not exist', async () => {
      (prismaMock.itemCategories.findUnique as jest.Mock).mockResolvedValueOnce(
        null,
      );

      const result = await service.delete('missing');
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should soft delete successfully', async () => {
      (prismaMock.itemCategories.findUnique as jest.Mock).mockResolvedValueOnce(
        mockItemCategory,
      );
      (prismaMock.itemCategories.update as jest.Mock).mockResolvedValueOnce({
        ...mockItemCategory,
        recStatus: REC_STATUS.INACTIVE,
      });

      const result = await service.delete(mockItemCategory.listCategoryId);
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toBe(RESPONSE_STATUS.SUCCESS.DELETE);
    });
  });
});
