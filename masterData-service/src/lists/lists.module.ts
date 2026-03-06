import { Module } from '@nestjs/common';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { PrismaModule } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';

@Module({
  imports: [PrismaModule],
  controllers: [ListsController],
  providers: [ListsService, TechvLogger, UtilityService],
})
export class ListsModule {}
