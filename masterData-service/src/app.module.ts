import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UtilityModule } from './utility/utility.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@traeta/prisma';
import { IntegrationsModule } from './integrations/integrations.module';
import { MasterDataModule } from './master-data/master-data.module';
import { ListsModule } from './lists/lists.module';
import { ListIntegrationMappingModule } from './listintegrationmapping/listintegrationmapping.module';
import { ItemCategoriesModule } from './item-categories/item-categories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    PrismaModule,
    UtilityModule,
    MasterDataModule,
    IntegrationsModule,
    ListsModule,
    ListIntegrationMappingModule,
    ItemCategoriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
