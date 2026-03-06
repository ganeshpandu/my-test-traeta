import { Module } from '@nestjs/common';
import { PrismaModule } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UserListsController } from './user-lists.controller';
import { UserListsService } from './user-lists.service';
import { UtilityService } from '../utility/utility.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../guards/guards';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UserListsController],
  providers: [UserListsService, TechvLogger, UtilityService, JwtAuthGuard],
  exports: [UserListsService],
})
export class UserListsModule {}
