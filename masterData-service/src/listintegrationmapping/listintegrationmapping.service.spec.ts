import { Test, TestingModule } from '@nestjs/testing';
import { ListIntegrationMappingService } from './listintegrationmapping.service';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';
import { HttpStatus } from '@nestjs/common';
import {
  REC_SEQ,
  REC_STATUS,
  DATA_STATUS,
  RESPONSE_STATUS,
} from '../../constants';
import { ListIntegrationMappingListEntity } from './entity/list-integration-mapping.entity';

const mockMapping = {
  listIntegrationMappingId: 'map-1',
  recSeq: REC_SEQ.DEFAULT_RECORD,
  recStatus: REC_STATUS.ACTIVE,
  listId: 'list-1',
  listRecSeq: REC_SEQ.DEFAULT_RECORD,
  integrationId: 'int-1',
  integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
  dataStatus: DATA_STATUS.ACTIVE,
  createdBy: 'system',
  createdOn: new Date(),
  modifiedOn: new Date(),
  modifiedBy: null,
};

describe('ListIntegrationMappingService', () => {
  let service: ListIntegrationMappingService;
  let prisma: PrismaService;
  let utility: UtilityService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListIntegrationMappingService,
        {
          provide: UtilityService,
          useValue: { buildFilter: jest.fn(), updateEntity: jest.fn() },
        },
        { provide: TechvLogger, useValue: { logger: jest.fn() } },
        {
          provide: PrismaService,
          useValue: {
            listIntegrationMapping: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(mockMapping),
              findMany: jest.fn().mockResolvedValue([mockMapping]),
              count: jest.fn().mockResolvedValue(1),
              findUnique: jest.fn().mockResolvedValue(mockMapping),
              update: jest.fn().mockResolvedValue({
                ...mockMapping,
                recStatus: REC_STATUS.INACTIVE,
              }),
            },
            $queryRawUnsafe: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<ListIntegrationMappingService>(
      ListIntegrationMappingService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    utility = module.get<UtilityService>(UtilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new mapping', async () => {
      const result = await service.create({
        listId: 'list-1',
        integrationId: 'int-1',
      });
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toEqual(mockMapping);
    });
  });

  describe('findAll', () => {
    it('should return list with metadata', async () => {
      const result = await service.findAll({ pageNumber: 1, limit: 10 });
      expect(result.status).toBe(HttpStatus.OK);
      const listData = result.data as ListIntegrationMappingListEntity;
      expect(listData.data).toBeDefined();
      expect(listData.metadata).toBeDefined();
    });
  });

  describe('findUnique', () => {
    it('should return a single mapping by ID', async () => {
      const result = await service.findUnique('map-1');
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockMapping);
    });
  });

  describe('update', () => {
    it('should return NOT_FOUND when mapping does not exist', async () => {
      jest
        .spyOn(prisma.listIntegrationMapping, 'findUnique')
        .mockResolvedValueOnce(null);
      jest
        .spyOn(utility, 'updateEntity')
        .mockResolvedValue({ status: HttpStatus.OK, data: 'OK' });
      const result = await service.update('missing', { listId: 'list-x' });
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should update successfully when mapping exists', async () => {
      jest
        .spyOn(prisma.listIntegrationMapping, 'findUnique')
        .mockResolvedValueOnce(mockMapping);
      (utility.updateEntity as jest.Mock).mockResolvedValue({
        status: HttpStatus.OK,
        data: 'OK',
      });
      const result = await service.update('map-1', { listId: 'list-2' });
      expect(result.status).toBe(HttpStatus.OK);
      expect((result.data as { data: string }).data).toBe('OK');
    });
  });

  describe('delete', () => {
    it('should return NOT_FOUND when mapping does not exist', async () => {
      jest
        .spyOn(prisma.listIntegrationMapping, 'findUnique')
        .mockResolvedValueOnce(null);
      const result = await service.delete('missing');
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should soft delete successfully', async () => {
      jest
        .spyOn(prisma.listIntegrationMapping, 'findUnique')
        .mockResolvedValueOnce(mockMapping);
      const result = await service.delete('map-1');
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toBe(RESPONSE_STATUS.SUCCESS.DELETE);
    });
  });
});
