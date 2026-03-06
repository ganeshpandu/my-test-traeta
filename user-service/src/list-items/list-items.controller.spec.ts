import { Test, TestingModule } from '@nestjs/testing';
import { ListItemsController } from './list-items.controller';
import { ListItemsService } from './list-items.service';
import { TechvLogger } from 'techvedika-logger';
import { JwtAuthGuard } from '../guards/guards';

describe('ListItemsController', () => {
  let controller: ListItemsController;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ListItemsController],
      providers: [
        {
          provide: ListItemsService,
          useValue: {},
        },
        {
          provide: TechvLogger,
          useValue: { info: jest.fn(), error: jest.fn() },
        },
      ],
    });

    const module: TestingModule = await moduleBuilder
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ListItemsController>(ListItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
