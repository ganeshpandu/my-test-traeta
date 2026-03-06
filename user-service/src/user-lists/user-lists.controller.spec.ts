import { Test, TestingModule } from '@nestjs/testing';
import { UserListsController } from './user-lists.controller';
import { UserListsService } from './user-lists.service';
import { TechvLogger } from 'techvedika-logger';
import { JwtAuthGuard } from '../guards/guards';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('UserListsController', () => {
  let controller: UserListsController;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [UserListsController],
      providers: [
        { provide: UserListsService, useValue: {} },
        { provide: TechvLogger, useValue: { logger: jest.fn() } },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) });

    const module: TestingModule = await moduleBuilder.compile();
    controller = module.get<UserListsController>(UserListsController);
  });

  afterAll(() => jest.clearAllMocks());
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
