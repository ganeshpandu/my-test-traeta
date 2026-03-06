import { Test, TestingModule } from '@nestjs/testing';
import { ListsService } from './lists.service';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';
import { HttpStatus } from '@nestjs/common';
import {
  RESPONSE_STATUS,
  REC_SEQ,
  REC_STATUS,
  DATA_STATUS,
} from '../../constants';
import { ListListEntity } from './entity/list.entity';
import { CreateListDto, ListFilterDto, UpdateListDto } from './dto/list.dto';

class MockLogger {
  logger = jest.fn();
}

const mockList = {
  listId: 'l1',
  name: 'My List',
  recSeq: REC_SEQ.DEFAULT_RECORD,
  recStatus: REC_STATUS.ACTIVE,
  dataStatus: DATA_STATUS.ACTIVE,
  createdBy: 'system',
  createdOn: new Date(),
  modifiedOn: new Date(),
  modifiedBy: null,
};

const mockUpdatedList = {
  ...mockList,
  name: 'Updated List',
  modifiedOn: new Date(),
};

describe('ListsService', () => {
  let service: ListsService;

  const prismaMock = {
    lists: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  } as unknown as PrismaService;

  const loggerMock = new MockLogger();
  const utilityMock = {
    buildFilter: jest.fn(),
    updateEntity: jest.fn(),
  } as unknown as UtilityService;

  beforeAll(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UtilityService, useValue: utilityMock },
        { provide: TechvLogger, useValue: loggerMock },
      ],
    }).compile();

    service = module.get<ListsService>(ListsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new list when not duplicate', async () => {
      (prismaMock.lists.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prismaMock.lists.create as jest.Mock).mockResolvedValueOnce(mockList);

      const result = await service.create({
        name: mockList.name,
      } as CreateListDto);
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toEqual(mockList);
    });

    it('should reject duplicate list name', async () => {
      (prismaMock.lists.findFirst as jest.Mock).mockResolvedValueOnce({
        ...mockList,
        listId: 'dup',
      });

      const result = await service.create({
        name: mockList.name,
      } as CreateListDto);
      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.ALREADY_EXISTS);
    });
  });

  describe('findAll', () => {
    it('should return all active lists with metadata', async () => {
      (utilityMock.buildFilter as jest.Mock).mockReturnValueOnce({});
      (prismaMock.lists.findMany as jest.Mock).mockResolvedValueOnce([
        mockList,
      ]);
      (prismaMock.lists.count as jest.Mock).mockResolvedValueOnce(1);

      const result = await service.findAll({
        pageNumber: 1,
        limit: 10,
      } as ListFilterDto);
      expect(result.status).toBe(HttpStatus.OK);
      expect((result.data as ListListEntity).data).toEqual([mockList]);
      expect((result.data as ListListEntity).metadata.totalCount).toBe(1);
    });
  });

  describe('findUnique', () => {
    it('should return a single list by ID', async () => {
      (prismaMock.lists.findUnique as jest.Mock).mockResolvedValueOnce(
        mockList,
      );

      const result = await service.findUnique(mockList.listId);
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockList);
    });
  });

  describe('update', () => {
    it('should return NOT_FOUND when list is missing', async () => {
      (prismaMock.lists.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await service.update('missing', {
        name: 'New',
      } as UpdateListDto);
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should update successfully', async () => {
      (prismaMock.lists.findUnique as jest.Mock).mockResolvedValueOnce(
        mockList,
      );
      (utilityMock.updateEntity as jest.Mock).mockResolvedValueOnce({
        status: HttpStatus.OK,
        data: mockUpdatedList,
      });

      const result = await service.update(mockList.listId, {
        name: mockUpdatedList.name,
      } as UpdateListDto);
      expect(result.status).toBe(HttpStatus.OK);
      expect((result.data as { data: typeof mockUpdatedList }).data).toEqual(
        mockUpdatedList,
      );
    });
  });

  describe('delete', () => {
    it('should return NOT_FOUND when list does not exist', async () => {
      (prismaMock.lists.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const result = await service.delete('missing');
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should soft delete successfully', async () => {
      (prismaMock.lists.findUnique as jest.Mock).mockResolvedValueOnce(
        mockList,
      );
      (prismaMock.lists.update as jest.Mock).mockResolvedValueOnce({
        ...mockList,
        recStatus: REC_STATUS.INACTIVE,
      });

      const result = await service.delete(mockList.listId);
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toBe(RESPONSE_STATUS.SUCCESS.DELETE);
    });
  });
});
