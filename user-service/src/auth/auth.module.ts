import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseService } from '../firebase/firebase.config';
import { TechvLogger } from 'techvedika-logger';
import { PrismaModule } from '@traeta/prisma';
import { UtilityService } from '../utility/utility.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
  controllers: [AuthController],
  providers: [AuthService, FirebaseService, TechvLogger, UtilityService],
  exports: [AuthService],
})
export class AuthModule {}
