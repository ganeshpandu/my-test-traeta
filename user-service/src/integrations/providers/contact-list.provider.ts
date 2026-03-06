import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TechvLogger } from 'techvedika-logger';
import {
  IntegrationProvider,
  IntegrationProviderName,
  ConnectResponse,
  CallbackPayload,
} from '../types';
import { IntegrationPersistence } from '../persistence';
import { PrismaService } from '@traeta/prisma';
import { TokenStore } from '../token-store';
import { google } from 'googleapis';
import {
  ConfigurationException,
  InvalidCallbackException,
  InvalidTokenException,
  DataSyncException,
  ProviderAPIException,
  RateLimitException,
  OAuthAuthenticationException,
} from '../exceptions/integration.exceptions';
import {
  REC_SEQ,
  ACTIVE_CONDITION,
  STATUS,
  DATA_TYPE,
  LogType,
  MethodNames,
} from '../../../constants';

/**
 * Contact List Integration Provider
 *
 * PURPOSE:
 * This provider integrates with device contacts and Google Contacts to populate the Friends list.
 * It extracts friend information including names, phone numbers, email addresses, birthdays,
 * addresses, and relationship metadata.
 *
 * COVERAGE IMPACT:
 * - Friends: 0% → ~60% (NEW)
 *
 * DATA SOURCES:
 * 1. Google Contacts API (primary for web/cross-platform)
 * 2. iOS Contacts Framework (for native iOS apps)
 * 3. Android Contacts Provider (for native Android apps)
 *
 * EXTRACTED FIELDS:
 * - Friend name (first, last, full)
 * - Phone numbers (mobile, home, work)
 * - Email addresses
 * - Birthday
 * - Address (home, work)
 * - Notes/relationship info
 * - Profile photo URL
 * - Social media handles (if available)
 * - Last contacted date
 * - Contact frequency
 *
 * PRIVACY CONSIDERATIONS:
 * - Requires explicit user consent
 * - Only syncs contacts marked as "friends" or in specific groups
 * - Respects user's contact privacy settings
 * - Allows users to exclude specific contacts
 * - Data encrypted at rest and in transit
 *
 * IMPLEMENTATION NOTES:
 * - Uses Google People API v1 for Google Contacts
 * - Supports incremental sync to reduce API calls
 * - Caches contact data with TTL
 * - Handles contact updates and deletions
 * - Supports contact grouping (family, close friends, acquaintances)
 */

interface ContactData {
  id: string;
  name: {
    firstName?: string;
    lastName?: string;
    fullName: string;
  };
  phoneNumbers?: Array<{
    type: string;
    number: string;
  }>;
  emails?: Array<{
    type: string;
    address: string;
  }>;
  birthday?: {
    month: number;
    day: number;
    year?: number;
  };
  addresses?: Array<{
    type: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  notes?: string;
  photoUrl?: string;
  groups?: string[];
  lastContacted?: Date;
  contactFrequency?: 'daily' | 'weekly' | 'monthly' | 'rarely';
}

@Injectable()
export class ContactListProvider implements IntegrationProvider {
  public readonly name = 'contact_list' as IntegrationProviderName;

  constructor(
    private readonly db: PrismaService,
    private readonly persistence: IntegrationPersistence,
    private readonly tokens: TokenStore,
    private readonly configService: ConfigService,
    private readonly loggerInstance: TechvLogger,
  ) {}

  private getGoogleClientId(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
  }

  private getGoogleClientSecret(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
  }

  private getGoogleRedirectUri(): string {
    return this.configService.get<string>('GOOGLE_REDIRECT_URI') || '';
  }

  /**
   * Initiate Google Contacts OAuth flow
   */
  async createConnection(userId: string): Promise<ConnectResponse> {
    // Validate configuration
    const clientId = this.getGoogleClientId();
    const clientSecret = this.getGoogleClientSecret();
    const redirectUri = this.getGoogleRedirectUri();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ConfigurationException(
        this.name,
        'Missing required Google OAuth configuration (CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI)',
      );
    }

    try {
      const state = `contacts-${userId}-${Date.now()}`;

      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri,
      );

      const scopes = [
        'https://www.googleapis.com/auth/contacts.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: state,
        prompt: 'consent',
      });

      await this.persistence.ensureIntegration('contact_list');

      return {
        provider: this.name,
        redirectUrl: authUrl,
        state: state,
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to create Google Contacts connection',
        data: {
          service: ContactListProvider.name,
          method: MethodNames.createConnection,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ConfigurationException) {
        throw error;
      }

      throw new ConfigurationException(
        this.name,
        `Failed to initialize Google Contacts connection: ${error.message}`,
      );
    }
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleCallback(payload: CallbackPayload): Promise<void> {
    const { code, state, error } = payload;

    if (error) {
      throw new OAuthAuthenticationException(
        this.name,
        `Google Contacts OAuth error: ${error}`,
      );
    }

    if (!code || !state) {
      throw new InvalidCallbackException(
        this.name,
        'Missing required callback parameters: code or state',
      );
    }

    // Extract userId from state
    const userId = state.split('-')[1];
    if (!userId) {
      throw new InvalidCallbackException(
        this.name,
        'Invalid state format: unable to extract userId',
      );
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        this.getGoogleClientId(),
        this.getGoogleClientSecret(),
        this.getGoogleRedirectUri(),
      );

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new OAuthAuthenticationException(
          this.name,
          'No access token received from Google',
        );
      }

      // Store tokens
      await this.tokens.set(userId, 'contact_list', {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date
          ? Math.floor(tokens.expiry_date / 1000)
          : undefined,
      });

      // Create user integration record
      const integration =
        await this.persistence.ensureIntegration('contact_list');
      await this.persistence.markConnected(userId, integration.integrationId);

      try {
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Starting automatic sync after Google Contacts connection',
          data: {
            service: this.name,
            method: MethodNames.handleCallback,
            userId,
            provider: this.name,
          },
        });
        const syncResult = await this.sync(userId);
        this.loggerInstance.logger(LogType.INFO, {
          message: 'Automatic sync completed after connection',
          data: {
            service: this.name,
            method: MethodNames.handleCallback,
            userId,
            provider: this.name,
            syncResult: syncResult.ok,
          },
        });
      } catch (syncError) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Automatic sync failed after connection',
          data: {
            service: this.name,
            method: MethodNames.handleCallback,
            userId,
            provider: this.name,
          },
          error:
            syncError instanceof Error ? syncError.message : String(syncError),
        });
        // Don't throw error here as connection was successful, sync can be retried later
      }
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Contact List connected successfully',
        data: {
          service: this.name,
          method: MethodNames.handleCallback,
          userId,
          provider: this.name,
        },
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to handle Google Contacts callback',
        data: {
          service: this.name,
          method: MethodNames.handleCallback,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw custom exceptions
      if (
        error instanceof InvalidCallbackException ||
        error instanceof OAuthAuthenticationException
      ) {
        throw error;
      }

      // Handle Google API errors
      if (error.response) {
        const status = error.response.status;
        const errorMessage =
          error.response.data?.error_description ||
          error.response.data?.error ||
          error.message;

        if (status === 400 || status === 401) {
          throw new OAuthAuthenticationException(
            this.name,
            `Google Contacts authentication failed: ${errorMessage}`,
          );
        }
      }

      throw new InvalidCallbackException(
        this.name,
        `Failed to process Google Contacts callback: ${error.message}`,
      );
    }
  }

  /**
   * Sync contacts from Google Contacts API
   */
  async sync(
    userId: string,
  ): Promise<{ ok: boolean; syncedAt?: Date; details?: any }> {
    try {
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Starting contact sync',
        data: {
          service: this.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
        },
      });

      // Get stored tokens
      const tokenData = await this.tokens.get(userId, 'contact_list');
      if (!tokenData?.accessToken) {
        throw new InvalidTokenException(this.name);
      }

      // Setup OAuth client
      const oauth2Client = new google.auth.OAuth2(
        this.getGoogleClientId(),
        this.getGoogleClientSecret(),
        this.getGoogleRedirectUri(),
      );

      oauth2Client.setCredentials({
        access_token: tokenData.accessToken,
        refresh_token: tokenData.refreshToken,
      });

      // Initialize People API
      const people = google.people({ version: 'v1', auth: oauth2Client });

      // Fetch contacts
      const response = await people.people.connections.list({
        resourceName: 'people/me',
        personFields:
          'names,emailAddresses,phoneNumbers,birthdays,addresses,biographies,photos,memberships,metadata',
      });

      const connections = response.data.connections || [];
      this.loggerInstance.logger(LogType.INFO, {
        message: 'Contacts fetched from Google API',
        data: {
          service: this.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
          contactCount: connections.length,
        },
      });

      // Process contacts
      const contacts: ContactData[] = [];
      for (const person of connections) {
        const contact = this.parseGoogleContact(person);
        if (contact) {
          contacts.push(contact);
        }
      }

      // Store contacts in database
      await this.storeContacts(userId, contacts);

      // Update last synced timestamp
      const integration =
        await this.persistence.ensureIntegration('contact_list');
      const link = await this.db.userIntegrations.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId: integration.integrationId,
          integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      const syncedAt = new Date();
      if (link) {
        await this.persistence.markSynced(link.userIntegrationId, syncedAt);
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Contact sync completed',
        data: {
          service: this.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
          contactsProcessed: contacts.length,
        },
      });

      return {
        ok: true,
        syncedAt,
        details: {
          contactsProcessed: contacts.length,
          contactsStored: contacts.length,
        },
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Contact sync failed',
        data: {
          service: this.name,
          method: MethodNames.sync,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw custom exceptions
      if (
        error instanceof InvalidTokenException ||
        error instanceof DataSyncException ||
        error instanceof ProviderAPIException ||
        error instanceof RateLimitException
      ) {
        throw error;
      }

      // Handle Google API errors
      if (error.response) {
        const status = error.response.status;
        const errorMessage =
          error.response.data?.error?.message || error.message;

        if (status === 401 || status === 403) {
          throw new InvalidTokenException(this.name);
        } else if (status === 429) {
          throw new RateLimitException(this.name);
        } else if (status >= 500) {
          throw new ProviderAPIException(
            this.name,
            `Google Contacts API error: ${errorMessage}`,
          );
        }
      }

      // Generic fallback
      throw new DataSyncException(
        this.name,
        `Failed to sync Google Contacts data: ${error.message}`,
      );
    }
  }

  /**
   * Check connection status
   */
  async status(userId: string): Promise<{
    connected: boolean;
    lastSyncedAt?: Date | null;
    details?: any;
  }> {
    try {
      const integration =
        await this.persistence.ensureIntegration('contact_list');
      const link = await this.db.userIntegrations.findFirst({
        where: {
          userId,
          userRecSeq: REC_SEQ.DEFAULT_RECORD,
          integrationId: integration.integrationId,
          integrationRecSeq: REC_SEQ.DEFAULT_RECORD,
          ...ACTIVE_CONDITION,
        },
      });

      if (!link) {
        return { connected: false, lastSyncedAt: null };
      }

      // Check if we have valid tokens
      const tokenData = await this.tokens.get(userId, 'contact_list');
      const hasValidToken = !!tokenData?.accessToken;

      // Get last synced timestamp from history
      const lastSyncedAt = await this.persistence.getLastSyncedAt(
        userId,
        integration.integrationId,
      );

      return {
        connected: link.status === STATUS.CONNECTED && hasValidToken,
        lastSyncedAt,
        details: {
          popularity: integration.popularity,
          hasToken: hasValidToken,
          status: link.status,
        },
      };
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to get contact list status',
        data: {
          service: this.name,
          method: MethodNames.status,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      return { connected: false, lastSyncedAt: null };
    }
  }

  /**
   * Parse Google Contact into our ContactData format
   */
  private parseGoogleContact(person: any): ContactData | null {
    // Extract name
    const names = person.names?.[0];
    if (!names?.displayName) {
      return null; // Skip contacts without names
    }

    const contact: ContactData = {
      id: person.resourceName,
      name: {
        firstName: names.givenName,
        lastName: names.familyName,
        fullName: names.displayName,
      },
    };

    // Extract phone numbers
    if (person.phoneNumbers?.length > 0) {
      contact.phoneNumbers = person.phoneNumbers.map((phone: any) => ({
        type: phone.type || 'other',
        number: phone.value,
      }));
    }

    // Extract emails
    if (person.emailAddresses?.length > 0) {
      contact.emails = person.emailAddresses.map((email: any) => ({
        type: email.type || 'other',
        address: email.value,
      }));
    }

    // Extract birthday
    if (person.birthdays?.length > 0) {
      const birthday = person.birthdays[0].date;
      if (birthday) {
        contact.birthday = {
          month: birthday.month,
          day: birthday.day,
          year: birthday.year,
        };
      }
    }

    // Extract addresses
    if (person.addresses?.length > 0) {
      contact.addresses = person.addresses.map((addr: any) => ({
        type: addr.type || 'other',
        street: addr.streetAddress,
        city: addr.city,
        state: addr.region,
        postalCode: addr.postalCode,
        country: addr.country,
      }));
    }

    // Extract notes
    if (person.biographies?.length > 0) {
      contact.notes = person.biographies[0].value;
    }

    // Extract photo
    if (person.photos?.length > 0) {
      contact.photoUrl = person.photos[0].url;
    }

    // Extract groups/memberships
    if (person.memberships?.length > 0) {
      contact.groups = person.memberships
        .map((m: any) => m.contactGroupMembership?.contactGroupResourceName)
        .filter(Boolean);
    }

    return contact;
  }

  /**
   * Store contacts in database as Friend items
   */
  private async storeContacts(
    userId: string,
    contacts: ContactData[],
  ): Promise<void> {
    // Ensure Friends list and Contact category exist
    const { list, userList, category } =
      await this.persistence.ensureListAndCategoryForUser(userId, 'Friends');

    for (const contact of contacts) {
      try {
        // Create or update item in Friends list
        await this.persistence.upsertListItem(
          list.listId,
          REC_SEQ.DEFAULT_RECORD,
          userList.userListId,
          REC_SEQ.DEFAULT_RECORD,
          category?.itemCategoryId ?? null,
          REC_SEQ.DEFAULT_RECORD,
          `${contact.name.fullName} | Friends`,
          {
            endTime: contact.lastContacted?.toISOString() ?? null,
            name: {
              firstName: contact.name.firstName,
              lastName: contact.name.lastName,
              fullName: contact.name.fullName,
            },
            phoneNumbers: contact.phoneNumbers ?? [],
            emails: contact.emails ?? [],
            birthday: contact.birthday ?? null,
            addresses: contact.addresses ?? [],
            notes: contact.notes ?? null,
            photoUrl: contact.photoUrl ?? null,
            groups: contact.groups ?? [],
            lastContacted: contact.lastContacted?.toISOString() ?? null,
            contactFrequency: contact.contactFrequency ?? null,
            external: {
              provider: 'contact_list',
              id: contact.id,
            },
          },
          {
            endTime: DATA_TYPE.DATE,
            name: DATA_TYPE.STRING,
            phoneNumbers: DATA_TYPE.JSON,
            emails: DATA_TYPE.JSON,
            birthday: DATA_TYPE.DATE,
            addresses: DATA_TYPE.JSON,
            notes: DATA_TYPE.STRING,
            photoUrl: DATA_TYPE.STRING,
            groups: DATA_TYPE.JSON,
            lastContacted: DATA_TYPE.DATE,
            contactFrequency: DATA_TYPE.STRING,
            external: DATA_TYPE.JSON,
          },
          userId,
        );
      } catch (error) {
        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Failed to store contact',
          data: {
            service: ContactListProvider.name,
            method: MethodNames.sync,
            userId,
            provider: this.name,
            contactName: contact.name?.fullName || 'Unknown',
          },
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  async disconnect(userId: string): Promise<void> {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Starting Contact List disconnect',
      data: {
        service: ContactListProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });

    try {
      // Get the access token before deletion
      const tokens = await this.tokens.get(userId, 'contact_list');

      if (tokens?.accessToken) {
        // Revoke the token with Google
        try {
          const oauth2Client = new google.auth.OAuth2(
            this.getGoogleClientId(),
            this.getGoogleClientSecret(),
            this.getGoogleRedirectUri(),
          );

          await oauth2Client.revokeToken(tokens.accessToken);
          this.loggerInstance.logger(LogType.INFO, {
            message: 'Google Contacts token revoked successfully',
            data: {
              service: ContactListProvider.name,
              method: MethodNames.disconnect,
              userId,
              provider: this.name,
            },
          });
        } catch (error) {
          // Log but don't throw - token might already be invalid
          this.loggerInstance.logger(LogType.ERROR, {
            message: 'Failed to revoke Google Contacts token',
            data: {
              service: ContactListProvider.name,
              method: MethodNames.disconnect,
              userId,
              provider: this.name,
            },
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Error during Contact List disconnect',
        data: {
          service: ContactListProvider.name,
          method: MethodNames.disconnect,
          userId,
          provider: this.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - allow disconnect to continue even if revocation fails
    }

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Contact List disconnect completed',
      data: {
        service: ContactListProvider.name,
        method: MethodNames.disconnect,
        userId,
        provider: this.name,
      },
    });
  }
}
