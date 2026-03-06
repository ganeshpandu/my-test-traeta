import { Test, TestingModule } from '@nestjs/testing';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';

describe('ListsController', () => {
  let controller: ListsController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListsController],
      providers: [
        { provide: ListsService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: UtilityService, useValue: {} },
        { provide: TechvLogger, useValue: {} },
      ],
    }).compile();

    controller = module.get<ListsController>(ListsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
