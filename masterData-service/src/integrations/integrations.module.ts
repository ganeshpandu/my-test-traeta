import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { PrismaModule } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, TechvLogger, UtilityService],
})
export class IntegrationsModule {}
