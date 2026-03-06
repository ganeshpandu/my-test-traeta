import { Module } from '@nestjs/common';
import { PrismaModule } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import { ListIntegrationMappingController } from './listintegrationmapping.controller';
import { ListIntegrationMappingService } from './listintegrationmapping.service';

@Module({
  imports: [PrismaModule],
  controllers: [ListIntegrationMappingController],
  providers: [ListIntegrationMappingService, TechvLogger, UtilityService],
})
export class ListIntegrationMappingModule {}
