import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';
import {
  CreateMasterDataDto,
  MasterDataFilterDto,
  UpdateMasterDataDto,
} from './dto/master-data.dto';
import { RESPONSE_STATUS } from '../../constants';

// Centralized Test DTOs
const createDto: CreateMasterDataDto = {
  keyCode: 'COLOR',
  value: 'RED',
  parentId: 'ROOT',
};
const updateDto: UpdateMasterDataDto = { value: 'GREEN' };

// Mocks
const prismaMock = {
  masterData: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const utilityMock = {
  buildFilter: jest.fn(),
  updateEntity: jest.fn(),
};

const loggerMock = {
  logger: jest.fn(),
};

describe('MasterDataService', () => {
  let service: MasterDataService;

  beforeAll(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterDataService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UtilityService, useValue: utilityMock },
        { provide: TechvLogger, useValue: loggerMock },
      ],
    }).compile();

    service = module.get<MasterDataService>(MasterDataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('returns CREATED with created entity when not duplicate', async () => {
      prismaMock.masterData.findFirst.mockResolvedValue(null);
      const created = { id: '1', ...createDto };
      prismaMock.masterData.create.mockResolvedValue(created);

      const res = await service.create(createDto);
      expect(prismaMock.masterData.findFirst).toHaveBeenCalled();
      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.data).toEqual(created);
    });

    it('returns BAD_REQUEST if duplicate exists', async () => {
      prismaMock.masterData.findFirst.mockResolvedValue({
        id: 'existing',
      });

      const res = await service.create(createDto);
      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.ALREADY_EXISTS);
      expect(prismaMock.masterData.create).not.toHaveBeenCalled();
    });

    it('returns INTERNAL_SERVER_ERROR on exception', async () => {
      prismaMock.masterData.findFirst.mockResolvedValue(null);
      prismaMock.masterData.create.mockRejectedValue(new Error('db error'));

      const res = await service.create(createDto);
      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('findAll', () => {
    it('returns OK with list and metadata', async () => {
      prismaMock.masterData.findMany.mockResolvedValue([
        { masterDataId: '1', keyCode: 'COLOR', value: 'RED' },
        { masterDataId: '2', keyCode: 'COLOR', value: 'BLUE' },
      ]);
      prismaMock.masterData.count.mockResolvedValue(10);

      const res = await service.findAll({ pageNumber: 1, limit: 10 });

      expect(prismaMock.masterData.count).toHaveBeenCalled();

      expect(res.status).toBe(HttpStatus.OK);
    });

    it('returns INTERNAL_SERVER_ERROR on exception', async () => {
      utilityMock.buildFilter.mockReturnValue({});
      prismaMock.masterData.findMany.mockRejectedValue(new Error('oops'));

      const emptyFilter: MasterDataFilterDto = {};
      const res = await service.findAll(emptyFilter);
      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('findUnique', () => {
    it('returns OK with entity', async () => {
      prismaMock.masterData.findUnique.mockResolvedValue({
        masterDataId: 'ID-1',
      });

      const res = await service.findUnique('ID-1');
      expect(prismaMock.masterData.findUnique).toHaveBeenCalled();
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.data).toEqual(
        expect.objectContaining({ masterDataId: 'ID-1' }),
      );
    });

    it('returns INTERNAL_SERVER_ERROR on exception', async () => {
      prismaMock.masterData.findUnique.mockRejectedValue(new Error('db error'));

      const res = await service.findUnique('ID-1');
      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('update', () => {
    it('returns NOT_FOUND when entity missing', async () => {
      prismaMock.masterData.findUnique.mockResolvedValue(null);

      const res = await service.update('ID-1', updateDto);
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
      expect(utilityMock.updateEntity).not.toHaveBeenCalled();
    });

    it('returns OK with updateEntity response when entity exists', async () => {
      prismaMock.masterData.findUnique.mockResolvedValue({
        masterDataId: 'ID-1',
      });
      const updateResponse = {
        status: 200,
        data: { masterDataId: 'ID-1', value: 'GREEN' },
      };
      utilityMock.updateEntity.mockResolvedValue(updateResponse);

      const res = await service.update('ID-1', updateDto);

      expect(utilityMock.updateEntity).toHaveBeenCalled();
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.data).toEqual(updateResponse);
    });

    it('returns INTERNAL_SERVER_ERROR on exception', async () => {
      prismaMock.masterData.findUnique.mockRejectedValue(new Error('db error'));

      const res = await service.update('ID-1', updateDto);
      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });

  describe('delete', () => {
    it('returns NOT_FOUND when entity missing', async () => {
      prismaMock.masterData.findUnique.mockResolvedValue(null);

      const res = await service.delete('ID-1');
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('returns OK with soft-deleted entity when present', async () => {
      prismaMock.masterData.findUnique.mockResolvedValue({
        masterDataId: 'ID-1',
      });
      prismaMock.masterData.update.mockResolvedValue({
        masterDataId: 'ID-1',
        recStatus: 'I',
      });

      const res = await service.delete('ID-1');
      expect(prismaMock.masterData.update).toHaveBeenCalled();
      expect(res.status).toBe(HttpStatus.OK);
      expect(res.data).toEqual(RESPONSE_STATUS.SUCCESS.DELETE);
    });

    it('returns INTERNAL_SERVER_ERROR on exception', async () => {
      prismaMock.masterData.findUnique.mockRejectedValue(new Error('db error'));

      const res = await service.delete('ID-1');
      expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.data).toBe(RESPONSE_STATUS.ERROR.INTERNAL_SERVER_ERROR);
    });
  });
});
