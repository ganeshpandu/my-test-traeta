import { Module } from '@nestjs/common';
import { PrismaModule } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VisualizationsController } from './visualizations.controller';
import { VisualizationsService } from './visualizations.service';
import { UtilityService } from '../utility/utility.service';
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
  controllers: [VisualizationsController],
  providers: [VisualizationsService, TechvLogger, UtilityService, JwtAuthGuard],
})
export class VisualizationsModule {}
