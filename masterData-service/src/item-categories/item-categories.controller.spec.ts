import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { TechvLogger } from 'techvedika-logger';
import { ItemCategoriesController } from './item-categories.controller';
import { ItemCategoriesService } from './item-categories.service';

describe('ItemCategoriesController', () => {
  let controller: ItemCategoriesController;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemCategoriesController],
      providers: [
        { provide: ItemCategoriesService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: UtilityService, useValue: {} },
        { provide: TechvLogger, useValue: {} },
      ],
    }).compile();

    controller = module.get<ItemCategoriesController>(ItemCategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
