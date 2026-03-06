import { Module } from '@nestjs/common';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { PrismaModule } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';

@Module({
  imports: [PrismaModule],
  controllers: [MasterDataController],
  providers: [MasterDataService, TechvLogger, UtilityService],
})
export class MasterDataModule {}
