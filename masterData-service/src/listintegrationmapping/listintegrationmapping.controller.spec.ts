import { Test, TestingModule } from '@nestjs/testing';
import { ListIntegrationMappingController } from './listintegrationmapping.controller';
import { ListIntegrationMappingService } from './listintegrationmapping.service';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';

describe('ListIntegrationMappingController', () => {
  let controller: ListIntegrationMappingController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListIntegrationMappingController],
      providers: [
        { provide: ListIntegrationMappingService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: UtilityService, useValue: {} },
        { provide: TechvLogger, useValue: { logger: jest.fn() } },
      ],
    }).compile();

    controller = module.get<ListIntegrationMappingController>(
      ListIntegrationMappingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
