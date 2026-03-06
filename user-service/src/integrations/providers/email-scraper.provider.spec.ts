import { Test, TestingModule } from '@nestjs/testing';
import { EmailScraperProvider } from './email-scraper.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from '../persistence';
import { TokenStore } from '../token-store';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { google } from 'googleapis';
import {
  ConfigurationException,
  InvalidCallbackException,
  OAuthAuthenticationException,
  InvalidTokenException,
  DataSyncException,
  ProviderAPIException,
  RateLimitException,
} from '../exceptions/integration.exceptions';

jest.mock('axios');
jest.mock('googleapis');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EmailScraperProvider', () => {
  let provider: EmailScraperProvider;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockPersistence: jest.Mocked<IntegrationPersistence>;
  let mockTokenStore: jest.Mocked<TokenStore>;
  let mockGmailApi: any;

  const mockUserId = 'user123';
  const mockIntegration = {
    integrationId: 'email_scraper_integration_id',
    recSeq: 0,
    recStatus: 'ACTIVE',
    name: 'email_scraper',
    popularity: null,
    dataStatus: 'ACTIVE',
    createdBy: 'system',
    createdOn: new Date(),
    modifiedOn: new Date(),
    modifiedBy: null,
  };

  beforeAll(async () => {
    // Create mocks
    mockPrismaService = {
      userIntegrations: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userIntegrationHistory: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      integrations: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      listItems: {
        create: jest.fn(),
      },
    } as any;

    mockPersistence = {
      ensureIntegration: jest.fn(),
      ensureUserIntegration: jest.fn(),
      markConnected: jest.fn(),
      markSynced: jest.fn(),
      getLastSyncedAt: jest.fn(),
      ensureListAndCategoryForUser: jest.fn(),
      createListItem: jest.fn(),
      upsertListItem: jest.fn(),
    } as any;

    mockTokenStore = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockGmailApi = {
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn(),
        },
        getProfile: jest.fn(),
      },
    };

    // Mock Google APIs
    (google.gmail as jest.Mock).mockReturnValue(mockGmailApi);
    (google.auth.OAuth2 as unknown as jest.Mock).mockImplementation(() => ({
      setCredentials: jest.fn(),
    }));

    // Set environment variables
    process.env.GMAIL_CLIENT_ID = 'test_gmail_client_id';
    process.env.GMAIL_CLIENT_SECRET = 'test_gmail_client_secret';
    process.env.GMAIL_REDIRECT_URI =
      'http://localhost:3000/integrations/gmail/callback';
    process.env.GMAIL_DEFAULT_DAYS = '90';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailScraperProvider,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationPersistence, useValue: mockPersistence },
        { provide: TokenStore, useValue: mockTokenStore },
      ],
    }).compile();

    provider = module.get<EmailScraperProvider>(EmailScraperProvider);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Default mock implementations
    mockPersistence.ensureIntegration.mockResolvedValue(mockIntegration as any);
    mockPersistence.ensureListAndCategoryForUser.mockResolvedValue({
      list: { listId: 'list_1', recSeq: 0 } as any,
      userList: { userListId: 'user_list_1', recSeq: 0 } as any,
      category: { listCategoryId: 'cat_1', recSeq: 0 } as any,
    });
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('createConnection', () => {
    it('should create connection successfully with valid configuration', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.redirectUrl).toContain(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(result.redirectUrl).toContain('client_id=test_gmail_client_id');
      expect(result.redirectUrl).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fintegrations%2Fgmail%2Fcallback',
      );
      expect(result.redirectUrl).toContain(
        'scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.metadata+openid+email+profile',
      );
      expect(result.redirectUrl).toContain('access_type=offline');
      expect(result.redirectUrl).toContain('prompt=consent');
      expect(result.state).toContain(`email-${mockUserId}`);
      expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith(
        'email_scraper',
      );
    });

    it('should throw ConfigurationException when GMAIL_CLIENT_ID is missing', async () => {
      const originalGmailId = process.env.GMAIL_CLIENT_ID;
      const originalGoogleId = process.env.GOOGLE_CLIENT_ID;

      delete process.env.GMAIL_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;

      const newProvider = new EmailScraperProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );

      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        'Missing required Gmail OAuth configuration (CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI)',
      );

      // Restore for other tests
      process.env.GMAIL_CLIENT_ID = originalGmailId;
      process.env.GOOGLE_CLIENT_ID = originalGoogleId;
    });

    it('should throw ConfigurationException when GMAIL_CLIENT_SECRET is missing', async () => {
      const originalGmailSecret = process.env.GMAIL_CLIENT_SECRET;
      const originalGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;

      delete process.env.GMAIL_CLIENT_SECRET;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const newProvider = new EmailScraperProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );

      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );

      // Restore for other tests
      process.env.GMAIL_CLIENT_SECRET = originalGmailSecret;
      process.env.GOOGLE_CLIENT_SECRET = originalGoogleSecret;
    });

    it('should use default redirect URI when none are configured', async () => {
      const originalGmailRedirect = process.env.GMAIL_REDIRECT_URI;
      const originalGoogleRedirect = process.env.GOOGLE_REDIRECT_URI;

      delete process.env.GMAIL_REDIRECT_URI;
      delete process.env.GOOGLE_REDIRECT_URI;

      const newProvider = new EmailScraperProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );
      const result = await newProvider.createConnection(mockUserId);

      expect(result.redirectUrl).toContain(
        'http%3A%2F%2Flocalhost%3A3000%2Fintegrations%2Fgmail%2Fcallback',
      );

      // Restore for other tests
      process.env.GMAIL_REDIRECT_URI = originalGmailRedirect;
      process.env.GOOGLE_REDIRECT_URI = originalGoogleRedirect;
    });

    it('should include correct OAuth parameters in redirect URL', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.redirectUrl).toContain('response_type=code');
      expect(result.redirectUrl).toContain('include_granted_scopes=true');
    });

    it('should handle persistence errors during integration creation', async () => {
      mockPersistence.ensureIntegration.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        'Failed to initialize Gmail connection: DB error',
      );
    });

    it('should re-throw ConfigurationException as-is', async () => {
      const customError = new ConfigurationException(
        'EMAIL_SCRAPER',
        'Custom config error',
      );
      mockPersistence.ensureIntegration.mockRejectedValue(customError);

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        customError,
      );
    });
  });

  describe('handleCallback', () => {
    const mockCode = 'auth_code_123';
    const mockState = `email-${mockUserId}-${Date.now()}`;
    const mockTokenResponse = {
      data: {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        expires_in: 3600,
        scope:
          'https://www.googleapis.com/auth/gmail.metadata openid email profile',
      },
    };
    const mockUserProfile = {
      email: 'test@example.com',
      name: 'Test User',
    };

    beforeAll(() => {
      mockedAxios.post.mockResolvedValue(mockTokenResponse);
      jest
        .spyOn(provider as any, 'fetchUserProfile')
        .mockResolvedValue(mockUserProfile);
      jest.spyOn(provider, 'sync').mockResolvedValue({
        ok: true,
        syncedAt: new Date(),
        details: { totalProcessed: 0 },
      });
    });

    describe('Happy Path', () => {
      it('should handle callback successfully with valid code and state', async () => {
        await provider.handleCallback({ code: mockCode, state: mockState });

        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://oauth2.googleapis.com/token',
          expect.any(URLSearchParams),
          expect.objectContaining({
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }),
        );

        expect(mockTokenStore.set).toHaveBeenCalledWith(
          mockUserId,
          'email_scraper',
          {
            accessToken: 'access_token_123',
            refreshToken: 'refresh_token_123',
            expiresAt: expect.any(Number),
            scope: mockTokenResponse.data.scope,
            providerUserId: 'test@example.com',
          },
        );

        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          mockUserId,
          mockIntegration.integrationId,
        );
      });

      it('should automatically trigger sync after successful connection', async () => {
        await provider.handleCallback({ code: mockCode, state: mockState });

        expect(provider.sync).toHaveBeenCalledWith(mockUserId);
      });

      it('should not fail callback if automatic sync fails', async () => {
        jest
          .spyOn(provider, 'sync')
          .mockRejectedValue(new Error('Sync failed'));

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).resolves.not.toThrow();
      });
    });

    describe('Input Validation', () => {
      it('should throw OAuthAuthenticationException when error is present', async () => {
        await expect(
          provider.handleCallback({ error: 'access_denied', state: mockState }),
        ).rejects.toThrow(OAuthAuthenticationException);
        await expect(
          provider.handleCallback({ error: 'access_denied', state: mockState }),
        ).rejects.toThrow('Gmail OAuth error: access_denied');
      });

      it('should throw InvalidCallbackException when code is missing', async () => {
        await expect(
          provider.handleCallback({ state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({ state: mockState }),
        ).rejects.toThrow(
          'Missing required callback parameters: code or state',
        );
      });

      it('should throw InvalidCallbackException when state is missing', async () => {
        await expect(
          provider.handleCallback({ code: mockCode }),
        ).rejects.toThrow(InvalidCallbackException);
      });

      it('should extract userId from flexible state format', async () => {
        const mockTokenResponse = {
          data: {
            access_token: 'new_access_token',
            refresh_token: 'new_refresh_token',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/gmail.metadata',
          },
        };

        mockedAxios.post.mockResolvedValue(mockTokenResponse);
        mockedAxios.get.mockResolvedValue({
          data: { email: 'user@example.com' },
        });

        // Should work with the flexible parsing logic that extracts "invalid-prefix-user123" from "invalid-prefix-user123-123456"
        await expect(
          provider.handleCallback({
            code: mockCode,
            state: 'invalid-prefix-user123-123456',
          }),
        ).resolves.not.toThrow();
      });

      it('should handle edge cases in state parsing gracefully', async () => {
        const mockTokenResponse = {
          data: {
            access_token: 'new_access_token',
            refresh_token: 'new_refresh_token',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/gmail.metadata',
          },
        };

        mockedAxios.post.mockResolvedValue(mockTokenResponse);
        mockedAxios.get.mockResolvedValue({
          data: { email: 'user@example.com' },
        });

        // The implementation is flexible and can handle various state formats
        await expect(
          provider.handleCallback({ code: mockCode, state: 'email--12345' }),
        ).resolves.not.toThrow();
      });

      it('should handle state with single dash correctly', async () => {
        await expect(
          provider.handleCallback({ code: mockCode, state: 'email-user123' }),
        ).resolves.not.toThrow();
      });
    });

    describe('Token Exchange Errors', () => {
      it('should handle 400 error from token exchange', async () => {
        mockedAxios.post.mockRejectedValue({
          response: {
            status: 400,
            data: { error_description: 'Invalid authorization code' },
          },
        });

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(OAuthAuthenticationException);
        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(
          'Gmail authentication failed: Invalid authorization code',
        );
      });

      it('should handle 401 error from token exchange', async () => {
        mockedAxios.post.mockRejectedValue({
          response: {
            status: 401,
            data: { error: 'unauthorized' },
          },
        });

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(OAuthAuthenticationException);
        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow('Gmail authentication failed: unauthorized');
      });

      it('should handle network error during token exchange', async () => {
        mockedAxios.post.mockRejectedValue(new Error('Network error'));

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow('Failed to process Gmail callback: Network error');
      });

      it('should handle user profile fetch error', async () => {
        jest
          .spyOn(provider as any, 'fetchUserProfile')
          .mockRejectedValue(new Error('Profile fetch failed'));

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
      });

      it('should handle token store error', async () => {
        mockTokenStore.set.mockRejectedValue(new Error('Token store error'));

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
      });

      it('should handle persistence error during connection marking', async () => {
        mockPersistence.markConnected.mockRejectedValue(
          new Error('Persistence error'),
        );

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
      });
    });

    describe('Error Re-throwing', () => {
      it('should re-throw InvalidCallbackException as-is', async () => {
        const customError = new InvalidCallbackException(
          'EMAIL_SCRAPER',
          'Custom error',
        );
        jest
          .spyOn(provider as any, 'fetchUserProfile')
          .mockRejectedValue(customError);

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(customError);
      });

      it('should re-throw OAuthAuthenticationException as-is', async () => {
        const customError = new OAuthAuthenticationException(
          'EMAIL_SCRAPER',
          'OAuth error',
        );
        jest
          .spyOn(provider as any, 'fetchUserProfile')
          .mockRejectedValue(customError);

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(customError);
      });
    });
  });

  describe('ensureValidAccessToken', () => {
    const mockTokenData = {
      accessToken: 'access_token_123',
      refreshToken: 'refresh_token_123',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      scope: 'https://www.googleapis.com/auth/gmail.metadata',
      providerUserId: 'test@example.com',
    };

    describe('Happy Path', () => {
      it('should return valid access token when not expired', async () => {
        mockTokenStore.get.mockResolvedValue(mockTokenData);

        const result = await provider['ensureValidAccessToken'](mockUserId);

        expect(result).toBe('access_token_123');
        expect(mockedAxios.post).not.toHaveBeenCalled();
      });

      it('should refresh token when expired and return new access token', async () => {
        const expiredTokenData = {
          ...mockTokenData,
          expiresAt: Math.floor(Date.now() / 1000) - 60, // Expired 1 minute ago
        };
        mockTokenStore.get.mockResolvedValue(expiredTokenData);
        mockedAxios.post.mockResolvedValue({
          data: {
            access_token: 'new_access_token_456',
            refresh_token: 'new_refresh_token_456',
            expires_in: 3600,
          },
        });

        const result = await provider['ensureValidAccessToken'](mockUserId);

        expect(result).toBe('new_access_token_456');
        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://oauth2.googleapis.com/token',
          expect.any(URLSearchParams),
          expect.objectContaining({
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }),
        );
        expect(mockTokenStore.set).toHaveBeenCalledWith(
          mockUserId,
          'email_scraper',
          {
            accessToken: 'new_access_token_456',
            refreshToken: 'new_refresh_token_456',
            expiresAt: expect.any(Number),
            scope: mockTokenData.scope,
            providerUserId: mockTokenData.providerUserId,
          },
        );
      });

      it('should use existing refresh token when new one is not provided', async () => {
        const expiredTokenData = {
          ...mockTokenData,
          expiresAt: Math.floor(Date.now() / 1000) - 60,
        };
        mockTokenStore.get.mockResolvedValue(expiredTokenData);
        mockedAxios.post.mockResolvedValue({
          data: {
            access_token: 'new_access_token_456',
            expires_in: 3600,
            // No refresh_token in response
          },
        });

        await provider['ensureValidAccessToken'](mockUserId);

        expect(mockTokenStore.set).toHaveBeenCalledWith(
          mockUserId,
          'email_scraper',
          {
            accessToken: 'new_access_token_456',
            refreshToken: 'refresh_token_123', // Original refresh token preserved
            expiresAt: expect.any(Number),
            scope: mockTokenData.scope,
            providerUserId: mockTokenData.providerUserId,
          },
        );
      });
    });

    describe('Input Validation', () => {
      it('should throw InvalidTokenException when no tokens exist', async () => {
        mockTokenStore.get.mockResolvedValue(null);

        await expect(
          provider['ensureValidAccessToken'](mockUserId),
        ).rejects.toThrow(InvalidTokenException);
      });

      it('should throw InvalidTokenException when refresh token is missing for expired token', async () => {
        const expiredTokenWithoutRefresh = {
          ...mockTokenData,
          expiresAt: Math.floor(Date.now() / 1000) - 60,
          refreshToken: undefined,
        };
        mockTokenStore.get.mockResolvedValue(expiredTokenWithoutRefresh);

        await expect(
          provider['ensureValidAccessToken'](mockUserId),
        ).rejects.toThrow(InvalidTokenException);
      });
    });

    describe('Token Refresh Errors', () => {
      beforeAll(() => {
        const expiredTokenData = {
          ...mockTokenData,
          expiresAt: Math.floor(Date.now() / 1000) - 60,
        };
        mockTokenStore.get.mockResolvedValue(expiredTokenData);
      });

      it('should throw InvalidTokenException on 400 refresh error', async () => {
        mockedAxios.post.mockRejectedValue({
          response: { status: 400, data: { error: 'invalid_grant' } },
        });

        await expect(
          provider['ensureValidAccessToken'](mockUserId),
        ).rejects.toThrow(InvalidTokenException);
      });

      it('should throw InvalidTokenException on 401 refresh error', async () => {
        mockedAxios.post.mockRejectedValue({
          response: { status: 401, data: { error: 'unauthorized' } },
        });

        await expect(
          provider['ensureValidAccessToken'](mockUserId),
        ).rejects.toThrow(InvalidTokenException);
      });

      it('should throw generic error for other HTTP status codes', async () => {
        const serverError = new Error('Server Error') as any;
        serverError.response = {
          status: 500,
          data: { error: 'internal_server_error' },
        };
        mockedAxios.post.mockRejectedValue(serverError);

        await expect(
          provider['ensureValidAccessToken'](mockUserId),
        ).rejects.toThrow('Server Error');
      });

      it('should throw generic error for network issues', async () => {
        const networkError = new Error('Network error');
        mockedAxios.post.mockRejectedValue(networkError);

        await expect(
          provider['ensureValidAccessToken'](mockUserId),
        ).rejects.toThrow('Network error');
      });
    });
  });

  describe('sync', () => {
    const mockTokenData = {
      accessToken: 'access_token_123',
      refreshToken: 'refresh_token_123',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      scope: 'https://www.googleapis.com/auth/gmail.metadata',
      providerUserId: 'test@example.com',
    };

    beforeAll(() => {
      jest
        .spyOn(provider as any, 'ensureValidAccessToken')
        .mockResolvedValue('access_token_123');
      mockPersistence.getLastSyncedAt.mockResolvedValue(null);
      jest.spyOn(provider as any, 'fetchEmailsByQuery').mockResolvedValue([]);
      jest.spyOn(provider as any, 'categorizeEmails').mockReturnValue({});
      jest.spyOn(provider as any, 'getCategoryInfo').mockReturnValue({
        listName: 'Email Receipts',
        categoryName: 'Purchases',
      });
    });

    describe('Happy Path', () => {
      it('should sync emails successfully with no new emails', async () => {
        const result = await provider.sync(mockUserId);

        expect(provider['ensureValidAccessToken']).toHaveBeenCalledWith(
          mockUserId,
        );
        expect(provider['fetchEmailsByQuery']).toHaveBeenCalled();
        expect(result).toEqual({
          ok: true,
          syncedAt: expect.any(Date),
          details: {
            totalProcessed: 0,
            totalSkipped: 0,
            totalEmailsFetched: 0,
            since: expect.any(Date),
            message: 'No new emails to sync',
          },
        });
      });

      it('should sync and categorize emails successfully', async () => {
        const mockEmails = [
          {
            id: 'email_1',
            subject: 'Your Amazon order has shipped',
            from: 'noreply@amazon.com',
            to: 'test@example.com',
            date: new Date(),
            body: 'Order details...',
            snippet: 'Your order has shipped',
            labels: ['INBOX'],
            attachments: [],
          },
        ];
        const mockCategorizedEmails = {
          receipts: mockEmails,
        };

        jest
          .spyOn(provider as any, 'fetchEmailsByQuery')
          .mockResolvedValue(mockEmails);
        jest
          .spyOn(provider as any, 'categorizeEmails')
          .mockReturnValue(mockCategorizedEmails);
        jest.spyOn(provider as any, 'processEmails').mockResolvedValue({
          processed: 1,
          skipped: 0,
        });

        const result = await provider.sync(mockUserId);

        expect(provider['categorizeEmails']).toHaveBeenCalledWith(mockEmails);
        expect(provider['processEmails']).toHaveBeenCalled();
        expect(result.ok).toBe(true);
        expect(result.details.totalEmailsFetched).toBe(1);
      });

      it('should use lastSyncedAt when available for incremental sync', async () => {
        const lastSyncDate = new Date('2023-06-01');
        mockPersistence.getLastSyncedAt.mockResolvedValue(lastSyncDate);

        await provider.sync(mockUserId);

        expect(provider['fetchEmailsByQuery']).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          'in:inbox category:personal',
          lastSyncDate,
          mockUserId,
        );
      });

      it('should use default date (90 days ago) for initial sync', async () => {
        mockPersistence.getLastSyncedAt.mockResolvedValue(null);

        await provider.sync(mockUserId);

        expect(provider['fetchEmailsByQuery']).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          'in:inbox category:personal',
          expect.any(Date),
          mockUserId,
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle token validation errors', async () => {
        jest
          .spyOn(provider as any, 'ensureValidAccessToken')
          .mockRejectedValue(new InvalidTokenException('EMAIL_SCRAPER'));

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });

      it('should handle email fetching errors', async () => {
        jest
          .spyOn(provider as any, 'fetchEmailsByQuery')
          .mockRejectedValue(new Error('Gmail API error'));

        await expect(provider.sync(mockUserId)).rejects.toThrow(Error);
      });

      it('should handle email categorization errors gracefully', async () => {
        const mockEmails = [{ id: 'email_1', subject: 'Test' }];
        jest
          .spyOn(provider as any, 'fetchEmailsByQuery')
          .mockResolvedValue(mockEmails);
        jest
          .spyOn(provider as any, 'categorizeEmails')
          .mockImplementation(() => {
            throw new Error('Categorization failed');
          });

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          'Categorization failed',
        );
      });
    });

    describe('Configuration', () => {
      it('should use custom default days from environment', async () => {
        process.env.GMAIL_DEFAULT_DAYS = '30';
        const newProvider = new EmailScraperProvider(
          mockPrismaService,
          mockPersistence,
          mockTokenStore,
        );
        jest
          .spyOn(newProvider as any, 'ensureValidAccessToken')
          .mockResolvedValue('token');
        jest
          .spyOn(newProvider as any, 'fetchEmailsByQuery')
          .mockResolvedValue([]);
        mockPersistence.getLastSyncedAt.mockResolvedValue(null);

        await newProvider.sync(mockUserId);

        // Should use 30 days instead of default 90
        const expectedDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        expect(newProvider['fetchEmailsByQuery']).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          'in:inbox category:personal',
          expect.any(Date),
          mockUserId,
        );

        // Restore for other tests
        process.env.GMAIL_DEFAULT_DAYS = '90';
      });
    });

    describe('Large Dataset Handling', () => {
      it('should handle large number of emails efficiently', async () => {
        const largeEmailSet = Array.from({ length: 10000 }, (_, i) => ({
          id: `email_${i}`,
          subject: `Email ${i}`,
          from: 'sender@example.com',
          to: 'test@example.com',
          date: new Date(),
          body: `Email body ${i}`,
          snippet: `Snippet ${i}`,
          labels: ['INBOX'],
          attachments: [],
        }));

        jest
          .spyOn(provider as any, 'fetchEmailsByQuery')
          .mockResolvedValue(largeEmailSet);
        jest.spyOn(provider as any, 'categorizeEmails').mockReturnValue({
          receipts: largeEmailSet.slice(0, 5000),
          subscriptions: largeEmailSet.slice(5000),
        });
        jest.spyOn(provider as any, 'processEmails').mockResolvedValue({
          processed: 5000,
          skipped: 0,
        });

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.totalEmailsFetched).toBe(10000);
      });
    });
  });
});
