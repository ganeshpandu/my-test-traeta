import { Module } from '@nestjs/common';
import { PrismaModule } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { UtilityService } from '../utility/utility.service';
import { ItemCategoriesController } from './item-categories.controller';
import { ItemCategoriesService } from './item-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [ItemCategoriesController],
  providers: [ItemCategoriesService, TechvLogger, UtilityService],
})
export class ItemCategoriesModule {}
