import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';

describe('IntegrationsController', () => {
  let controller: IntegrationsController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        { provide: IntegrationsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: UtilityService, useValue: {} },
        { provide: TechvLogger, useValue: {} },
      ],
    }).compile();

    controller = module.get<IntegrationsController>(IntegrationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
