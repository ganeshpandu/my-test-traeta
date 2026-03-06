import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
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
import { IntegrationListEntity } from './entity/integration.entity';

const mockIntegration = {
  integrationId: 'id1',
  name: 'GDrive',
  recSeq: REC_SEQ.DEFAULT_RECORD,
  recStatus: REC_STATUS.ACTIVE,
  dataStatus: DATA_STATUS.ACTIVE,
  createdBy: 'system',
  createdOn: new Date(),
  modifiedOn: new Date(),
  modifiedBy: null,
  popularity: 0,
};

const mockUpdatedIntegration = {
  ...mockIntegration,
  name: 'Updated Integration',
  modifiedOn: new Date(),
};

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prisma: PrismaService;
  let utility: UtilityService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        {
          provide: UtilityService,
          useValue: { buildFilter: jest.fn(), updateEntity: jest.fn() },
        },
        { provide: TechvLogger, useValue: { logger: jest.fn() } },
        {
          provide: PrismaService,
          useValue: {
            integrations: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue(mockIntegration),
              findMany: jest.fn().mockResolvedValue([mockIntegration]),
              findUnique: jest.fn().mockResolvedValue(mockIntegration),
              update: jest.fn().mockResolvedValue(mockUpdatedIntegration),
              count: jest.fn().mockResolvedValue(1),
            },
            $queryRawUnsafe: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    prisma = module.get<PrismaService>(PrismaService);
    utility = module.get<UtilityService>(UtilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new integration when not duplicate', async () => {
      const result = await service.create(mockIntegration);
      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.data).toEqual(mockIntegration);
    });

    it('should reject duplicate integration name', async () => {
      jest
        .spyOn(prisma.integrations, 'findFirst')
        .mockResolvedValueOnce({ ...mockIntegration, integrationId: 'dup' });

      const result = await service.create(mockIntegration);
      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.ALREADY_EXISTS);
    });
  });

  describe('findAll', () => {
    it('should return all active integrations', async () => {
      const result = await service.findAll({ pageNumber: 1, limit: 10 });
      expect(result.status).toBe(HttpStatus.OK);
      expect((result.data as IntegrationListEntity).data).toEqual([
        mockIntegration,
      ]);
      expect((result.data as IntegrationListEntity).metadata.totalCount).toBe(
        1,
      );
    });
  });

  describe('findUnique', () => {
    it('should return a single integration by ID', async () => {
      const result = await service.findUnique(mockIntegration.integrationId);
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toEqual(mockIntegration);
    });
  });

  describe('update', () => {
    it('should return NOT_FOUND when integration is missing', async () => {
      jest.spyOn(prisma.integrations, 'findUnique').mockResolvedValueOnce(null);

      const result = await service.update('idMissing', { name: 'New' });
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should update successfully', async () => {
      jest.spyOn(utility, 'updateEntity').mockResolvedValueOnce({
        status: HttpStatus.OK,
        data: mockUpdatedIntegration,
      });

      const result = await service.update('id1', {
        name: 'Updated Integration',
      });
      expect(result.status).toBe(HttpStatus.OK);
      expect(
        (result.data as { data: typeof mockUpdatedIntegration }).data,
      ).toEqual(mockUpdatedIntegration);
    });
  });

  describe('delete', () => {
    it('should return NOT_FOUND when integration does not exist', async () => {
      jest.spyOn(prisma.integrations, 'findUnique').mockResolvedValueOnce(null);

      const result = await service.delete('idMissing');
      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.data).toBe(RESPONSE_STATUS.ERROR.NOT_FOUND);
    });

    it('should soft delete successfully', async () => {
      jest.spyOn(prisma.integrations, 'update').mockResolvedValueOnce({
        ...mockIntegration,
        recStatus: REC_STATUS.DELETED,
      });

      const result = await service.delete('id1');
      expect(result.status).toBe(HttpStatus.OK);
      expect(result.data).toBe(RESPONSE_STATUS.SUCCESS.DELETE);
    });
  });
});
