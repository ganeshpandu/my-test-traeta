import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '@traeta/prisma';
import { FirebaseService } from '../firebase/firebase.config';
import { TechvLogger } from 'techvedika-logger';
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
  controllers: [UsersController],
  providers: [
    UsersService,
    FirebaseService,
    TechvLogger,
    UtilityService,
    JwtAuthGuard,
  ],
})
export class UsersModule { }
