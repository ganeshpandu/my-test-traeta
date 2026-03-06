import { Test, TestingModule } from '@nestjs/testing';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import { PrismaService } from '@traeta/prisma';

describe('MasterDataController', () => {
  let controller: MasterDataController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterDataService,
        { provide: PrismaService, useValue: {} },
        { provide: UtilityService, useValue: {} },
        { provide: TechvLogger, useValue: {} },
      ],
      controllers: [MasterDataController],
    }).compile();

    controller = module.get<MasterDataController>(MasterDataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
