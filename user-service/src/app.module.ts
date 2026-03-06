import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UtilityModule } from './utility/utility.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from '@traeta/prisma';
import { ListItemsModule } from './list-items/list-items.module';
import { UserListsModule } from './user-lists/user-lists.module';

import { UsersModule } from './users/users.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { VisualizationsModule } from './visualizations/visualizations.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    UtilityModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    IntegrationsModule,
    ListItemsModule,
    VisualizationsModule,
    UserListsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
