import { Module } from '@nestjs/common';
import { TechvLogger } from 'techvedika-logger';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { PlaidProvider } from './providers/plaid.provider';
import { StravaProvider } from './providers/strava.provider';
import { AppleHealthProvider } from './providers/apple-health.provider';
import { AppleMusicProvider } from './providers/apple-music.provider';
import { SpotifyProvider } from './providers/spotify.provider';
import { EmailScraperProvider } from './providers/email-scraper.provider';
import { LocationServicesProvider } from './providers/location-services.provider';
import { ContactListProvider } from './providers/contact-list.provider';
import { GoodreadsProvider } from './providers/goodreads.provider';
import { PrismaModule } from '@traeta/prisma';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../guards/guards';
import { IntegrationPersistence } from './persistence';
import { PrismaTokenStore, TokenStore } from './token-store';
import { LocationDataStore } from './location-data-store';
import { UtilityService } from '../utility/utility.service';
import { EmailParserService } from './providers/email-parser';
import { LlmService } from './providers/llm-service';

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
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    PlaidProvider,
    StravaProvider,
    AppleHealthProvider,
    AppleMusicProvider,
    SpotifyProvider,
    EmailScraperProvider,
    LocationServicesProvider,
    ContactListProvider,
    GoodreadsProvider,
    JwtAuthGuard,
    IntegrationPersistence,
    TechvLogger,
    { provide: TokenStore, useClass: PrismaTokenStore },
    LocationDataStore,
    UtilityService,
    EmailParserService,
    LlmService,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
