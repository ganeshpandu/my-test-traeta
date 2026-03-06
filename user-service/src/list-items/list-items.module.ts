import { Module } from '@nestjs/common';
import { PrismaModule } from '@traeta/prisma';
import { TechvLogger } from 'techvedika-logger';
import { ListItemsController } from './list-items.controller';
import { ListItemsService } from './list-items.service';
import { UtilityService } from 'src/utility/utility.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from 'src/guards/guards';
import { IntegrationsModule } from '../integrations/integrations.module';
import { UserListsModule } from 'src/user-lists/user-lists.module';

@Module({
  imports: [
    PrismaModule,
    IntegrationsModule,
    UserListsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ListItemsController],
  providers: [ListItemsService, TechvLogger, UtilityService, JwtAuthGuard],
})
export class ListItemsModule {}
