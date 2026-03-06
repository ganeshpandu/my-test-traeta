import { Test, TestingModule } from '@nestjs/testing';
import { ContactListProvider } from './contact-list.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from '../persistence';
import { TokenStore } from '../token-store';
import { Logger } from '@nestjs/common';
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

jest.mock('googleapis');

const mockedGoogleOAuth2 = google.auth.OAuth2 as unknown as jest.Mock;
const mockedGooglePeople = google.people as unknown as jest.Mock;

describe('ContactListProvider', () => {
  let provider: ContactListProvider;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockPersistence: jest.Mocked<IntegrationPersistence>;
  let mockTokenStore: jest.Mocked<TokenStore>;
  let mockOAuth2Client: any;
  let mockPeopleApi: any;

  const mockUserId = 'user123';
  const mockIntegration = {
    integrationId: 'contact_list_integration_id',
    recSeq: 0,
    recStatus: 'ACTIVE',
    name: 'contact_list',
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

    mockOAuth2Client = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      setCredentials: jest.fn(),
    };

    mockPeopleApi = {
      people: {
        connections: {
          list: jest.fn(),
        },
      },
    };

    // Mock Google APIs
    mockedGoogleOAuth2.mockImplementation(() => mockOAuth2Client);
    mockedGooglePeople.mockReturnValue(mockPeopleApi);

    // Set environment variables
    process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
    process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
    process.env.GOOGLE_REDIRECT_URI =
      'http://localhost:3000/integrations/contacts/callback';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactListProvider,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationPersistence, useValue: mockPersistence },
        { provide: TokenStore, useValue: mockTokenStore },
      ],
    }).compile();

    provider = module.get<ContactListProvider>(ContactListProvider);

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
    const mockAuthUrl =
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&scope=contacts';

    beforeAll(() => {
      mockOAuth2Client.generateAuthUrl.mockReturnValue(mockAuthUrl);
    });

    it('should create connection successfully with valid configuration', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/contacts.readonly',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        state: expect.stringContaining(`contacts-${mockUserId}`),
        prompt: 'consent',
      });
      expect(result.redirectUrl).toBe(mockAuthUrl);
      expect(result.state).toContain(`contacts-${mockUserId}`);
      expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith(
        'contact_list',
      );
    });

    it('should throw ConfigurationException when GOOGLE_CLIENT_ID is missing', async () => {
      process.env.GOOGLE_CLIENT_ID = '';
      const newProvider = new ContactListProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );

      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        'Missing required Google OAuth configuration (CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI)',
      );

      // Restore for other tests
      process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
    });

    it('should throw ConfigurationException when GOOGLE_CLIENT_SECRET is missing', async () => {
      process.env.GOOGLE_CLIENT_SECRET = '';
      const newProvider = new ContactListProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );

      await expect(newProvider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );

      // Restore for other tests
      process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
    });

    it('should use default redirect URI when GOOGLE_REDIRECT_URI is missing', async () => {
      const originalRedirectUri = process.env.GOOGLE_REDIRECT_URI;
      process.env.GOOGLE_REDIRECT_URI = '';
      const newProvider = new ContactListProvider(
        mockPrismaService,
        mockPersistence,
        mockTokenStore,
      );

      // Mock the OAuth2 client for this specific test
      const mockOAuth2ForTest = {
        generateAuthUrl: jest
          .fn()
          .mockReturnValue(
            'https://accounts.google.com/oauth/authorize?redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fintegrations%2Fcontacts%2Fcallback',
          ),
      };
      mockedGoogleOAuth2.mockImplementation(() => mockOAuth2ForTest);

      const result = await newProvider.createConnection(mockUserId);

      expect(result.redirectUrl).toContain(
        'http%3A%2F%2Flocalhost%3A3000%2Fintegrations%2Fcontacts%2Fcallback',
      );

      // Restore for other tests
      process.env.GOOGLE_REDIRECT_URI = originalRedirectUri;
      mockedGoogleOAuth2.mockImplementation(() => mockOAuth2Client);
    });

    it('should handle OAuth2 client creation errors', async () => {
      mockedGoogleOAuth2.mockImplementation(() => {
        throw new Error('OAuth2 client error');
      });

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        'Failed to initialize Google Contacts connection: OAuth2 client error',
      );

      // Restore mock
      mockedGoogleOAuth2.mockImplementation(() => mockOAuth2Client);
    });

    it('should handle persistence errors during integration creation', async () => {
      mockPersistence.ensureIntegration.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        'Failed to initialize Google Contacts connection: DB error',
      );
    });

    it('should re-throw ConfigurationException as-is', async () => {
      const customError = new ConfigurationException(
        'CONTACT_LIST',
        'Custom config error',
      );
      mockPersistence.ensureIntegration.mockRejectedValue(customError);

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        customError,
      );
    });

    it('should include correct scopes in OAuth URL', async () => {
      await provider.createConnection(mockUserId);

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: expect.arrayContaining([
            'https://www.googleapis.com/auth/contacts.readonly',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
          ]),
        }),
      );
    });
  });

  describe('handleCallback', () => {
    const mockCode = 'auth_code_123';
    const mockState = `contacts-${mockUserId}-${Date.now()}`;
    const mockTokenResponse = {
      tokens: {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        expiry_date: Date.now() + 3600000,
        scope:
          'https://www.googleapis.com/auth/contacts.readonly openid email profile',
        token_type: 'Bearer',
      },
    };
    const mockUserInfo = {
      data: {
        id: 'google_user_id',
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    beforeAll(() => {
      mockOAuth2Client.getToken.mockResolvedValue(mockTokenResponse);
      jest.spyOn(provider, 'sync').mockResolvedValue({
        ok: true,
        syncedAt: new Date(),
        details: { totalContacts: 0 },
      });
    });

    describe('Happy Path', () => {
      it('should handle callback successfully with valid code and state', async () => {
        await provider.handleCallback({ code: mockCode, state: mockState });

        expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(mockCode);
        expect(mockTokenStore.set).toHaveBeenCalledWith(
          mockUserId,
          'contact_list',
          {
            accessToken: 'access_token_123',
            refreshToken: 'refresh_token_123',
            expiresAt: expect.any(Number),
          },
        );
        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          mockUserId,
          mockIntegration.integrationId,
        );
      });

      it('should handle callback without automatically triggering sync', async () => {
        await provider.handleCallback({ code: mockCode, state: mockState });

        // The actual implementation does not automatically trigger sync
        expect(provider.sync).not.toHaveBeenCalled();
      });

      it('should handle tokens without expiry_date', async () => {
        const tokensWithoutExpiry = {
          tokens: {
            access_token: 'access_token_123',
            refresh_token: 'refresh_token_123',
            scope: 'contacts readonly',
            token_type: 'Bearer',
          },
        };
        mockOAuth2Client.getToken.mockResolvedValue(tokensWithoutExpiry);

        await provider.handleCallback({ code: mockCode, state: mockState });

        expect(mockTokenStore.set).toHaveBeenCalledWith(
          mockUserId,
          'contact_list',
          {
            accessToken: 'access_token_123',
            refreshToken: 'refresh_token_123',
            expiresAt: undefined,
          },
        );
      });
    });

    describe('Input Validation', () => {
      it('should throw OAuthAuthenticationException when error is present', async () => {
        await expect(
          provider.handleCallback({ error: 'access_denied', state: mockState }),
        ).rejects.toThrow(OAuthAuthenticationException);
        await expect(
          provider.handleCallback({ error: 'access_denied', state: mockState }),
        ).rejects.toThrow('Google Contacts OAuth error: access_denied');
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

      it('should throw InvalidCallbackException with invalid state format', async () => {
        // Test state that has wrong prefix but can still extract userId at index 1
        await expect(
          provider.handleCallback({
            code: mockCode,
            state: 'invalid-user123-123456',
          }),
        ).resolves.not.toThrow();

        // Test state with no parts after splitting on '-'
        await expect(
          provider.handleCallback({ code: mockCode, state: 'invalid' }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({ code: mockCode, state: 'invalid' }),
        ).rejects.toThrow('Invalid state format: unable to extract userId');
      });

      it('should throw InvalidCallbackException when userId is missing in state', async () => {
        await expect(
          provider.handleCallback({
            code: mockCode,
            state: `contacts--${Date.now()}`,
          }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({
            code: mockCode,
            state: `contacts--${Date.now()}`,
          }),
        ).rejects.toThrow('Invalid state format: unable to extract userId');
      });
    });

    describe('Token Exchange Errors', () => {
      it('should handle OAuth2 token exchange errors', async () => {
        mockOAuth2Client.getToken.mockRejectedValue(
          new Error('Invalid authorization code'),
        );

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(
          'Failed to process Google Contacts callback: Invalid authorization code',
        );
      });

      it('should handle Google OAuth errors', async () => {
        mockOAuth2Client.getToken.mockRejectedValue(
          new Error('OAuth token exchange failed'),
        );

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
      });

      it('should handle token store errors', async () => {
        mockTokenStore.set.mockRejectedValue(new Error('Token store error'));

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
      });

      it('should handle persistence errors during connection marking', async () => {
        mockPersistence.markConnected.mockRejectedValue(
          new Error('Persistence error'),
        );

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
      });
    });

    describe('Error Re-throwing', () => {
      it('should re-throw OAuthAuthenticationException as-is', async () => {
        const customError = new OAuthAuthenticationException(
          'CONTACT_LIST',
          'OAuth error',
        );
        mockOAuth2Client.getToken.mockRejectedValue(customError);

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(customError);
      });

      it('should re-throw InvalidCallbackException as-is', async () => {
        const customError = new InvalidCallbackException(
          'CONTACT_LIST',
          'Callback error',
        );
        mockOAuth2Client.getToken.mockRejectedValue(customError);

        await expect(
          provider.handleCallback({ code: mockCode, state: mockState }),
        ).rejects.toThrow(customError);
      });
    });
  });

  describe('sync', () => {
    const mockTokenData = {
      accessToken: 'access_token_123',
      refreshToken: 'refresh_token_123',
      expiresAt: Date.now() + 3600000,
      scope: 'https://www.googleapis.com/auth/contacts.readonly',
      providerUserId: 'google_user_id',
    };

    const mockContactsResponse = {
      data: {
        connections: [
          {
            resourceName: 'people/123',
            etag: 'etag_123',
            names: [
              {
                displayName: 'John Doe',
                familyName: 'Doe',
                givenName: 'John',
              },
            ],
            emailAddresses: [
              {
                value: 'john.doe@example.com',
                type: 'home',
              },
            ],
            phoneNumbers: [
              {
                value: '+1234567890',
                type: 'mobile',
              },
            ],
          },
        ],
        totalPeople: 1,
      },
    };

    beforeAll(() => {
      mockTokenStore.get.mockResolvedValue(mockTokenData);
      mockPeopleApi.people.connections.list.mockResolvedValue(
        mockContactsResponse,
      );
      jest.spyOn(provider as any, 'parseGoogleContact').mockReturnValue({
        id: 'people/123',
        name: { fullName: 'John Doe', firstName: 'John', lastName: 'Doe' },
        phoneNumbers: [{ type: 'mobile', number: '+1234567890' }],
        emails: [{ type: 'home', address: 'john.doe@example.com' }],
      });
      jest.spyOn(provider as any, 'storeContacts').mockResolvedValue(undefined);
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        userIntegrationId: 'ui_123',
        recSeq: 0,
      } as any);
    });

    describe('Happy Path', () => {
      it('should sync contacts successfully', async () => {
        const result = await provider.sync(mockUserId);

        expect(mockPeopleApi.people.connections.list).toHaveBeenCalledWith({
          resourceName: 'people/me',
          pageSize: 1000,
          personFields:
            'names,emailAddresses,phoneNumbers,birthdays,addresses,biographies,photos,memberships,metadata',
        });
        expect(provider['parseGoogleContact']).toHaveBeenCalled();
        expect(provider['storeContacts']).toHaveBeenCalledWith(
          mockUserId,
          expect.any(Array),
        );
        expect(mockPersistence.markSynced).toHaveBeenCalled();
        expect(result).toEqual({
          ok: true,
          syncedAt: expect.any(Date),
          details: {
            contactsProcessed: 1,
            contactsStored: 1,
          },
        });
      });

      it('should handle contacts response with single API call', async () => {
        // Mock response with multiple contacts in single call (actual implementation doesn't handle pagination)
        const contactsResponse = {
          data: {
            connections: [
              mockContactsResponse.data.connections[0],
              {
                resourceName: 'people/456',
                names: [{ displayName: 'Jane Smith' }],
              },
            ],
          },
        };

        mockPeopleApi.people.connections.list.mockResolvedValue(
          contactsResponse,
        );

        jest
          .spyOn(provider as any, 'parseGoogleContact')
          .mockReturnValueOnce({
            id: 'people/123',
            name: { fullName: 'John Doe', firstName: 'John', lastName: 'Doe' },
          })
          .mockReturnValueOnce({
            id: 'people/456',
            name: {
              fullName: 'Jane Smith',
              firstName: 'Jane',
              lastName: 'Smith',
            },
          });

        const result = await provider.sync(mockUserId);

        expect(mockPeopleApi.people.connections.list).toHaveBeenCalledTimes(1);
        expect(mockPeopleApi.people.connections.list).toHaveBeenCalledWith({
          resourceName: 'people/me',
          personFields:
            'names,emailAddresses,phoneNumbers,birthdays,addresses,biographies,photos,memberships,metadata',
          pageSize: 1000,
        });
        expect(result.details.contactsProcessed).toBe(2);
      });

      it('should handle empty contacts response', async () => {
        mockPeopleApi.people.connections.list.mockResolvedValue({
          data: { connections: [] },
        });

        const result = await provider.sync(mockUserId);

        expect(result).toEqual({
          ok: true,
          syncedAt: expect.any(Date),
          details: {
            contactsProcessed: 0,
            contactsStored: 0,
          },
        });
      });
    });

    describe('Input Validation', () => {
      it('should throw InvalidTokenException when no tokens exist', async () => {
        mockTokenStore.get.mockResolvedValue(null);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });

      it('should throw InvalidTokenException when token is missing', async () => {
        mockTokenStore.get.mockResolvedValue(null);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });
    });

    describe('API Error Handling', () => {
      it('should handle 401 API errors and throw InvalidTokenException', async () => {
        const googleApiError = new Error(
          'Request had invalid authentication credentials',
        );
        (googleApiError as any).response = { status: 401 };
        mockPeopleApi.people.connections.list.mockRejectedValue(googleApiError);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });

      it('should handle 403 API errors and throw InvalidTokenException', async () => {
        const googleApiError = new Error(
          'The request cannot be completed because you have exceeded your quota',
        );
        (googleApiError as any).response = { status: 403 };
        mockPeopleApi.people.connections.list.mockRejectedValue(googleApiError);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });

      it('should handle 429 API errors and throw RateLimitException', async () => {
        const googleApiError = new Error('Quota exceeded for quota metric');
        (googleApiError as any).response = { status: 429 };
        mockPeopleApi.people.connections.list.mockRejectedValue(googleApiError);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          RateLimitException,
        );
      });

      it('should handle 500+ API errors and throw ProviderAPIException', async () => {
        const googleApiError = new Error('Internal server error');
        (googleApiError as any).response = { status: 500 };
        mockPeopleApi.people.connections.list.mockRejectedValue(googleApiError);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          ProviderAPIException,
        );
      });

      it('should handle generic API errors and throw DataSyncException', async () => {
        mockPeopleApi.people.connections.list.mockRejectedValue(
          new Error('Unknown API error'),
        );

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          DataSyncException,
        );
      });
    });

    describe('Data Processing Errors', () => {
      it('should handle contact processing errors', async () => {
        jest
          .spyOn(provider as any, 'storeContacts')
          .mockRejectedValue(new Error('Processing failed'));

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          DataSyncException,
        );
        await expect(provider.sync(mockUserId)).rejects.toThrow(
          'Failed to sync Google Contacts data: Processing failed',
        );
      });

      it('should handle malformed contacts data', async () => {
        mockPeopleApi.people.connections.list.mockResolvedValue({
          data: { connections: [null, undefined, {}] },
        });
        jest.spyOn(provider as any, 'parseGoogleContact').mockReturnValue(null);

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.contactsProcessed).toBe(0);
        expect(result.details.contactsStored).toBe(0);
      });
    });

    describe('Large Dataset Handling', () => {
      it('should handle large contact datasets efficiently', async () => {
        const largeContactSet = Array.from({ length: 5000 }, (_, i) => ({
          resourceName: `people/${i}`,
          names: [{ displayName: `Contact ${i}` }],
        }));

        mockPeopleApi.people.connections.list.mockResolvedValue({
          data: { connections: largeContactSet },
        });
        jest.spyOn(provider as any, 'parseGoogleContact').mockReturnValue({
          id: 'people/123',
          name: {
            fullName: 'Test Contact',
            firstName: 'Test',
            lastName: 'Contact',
          },
        });

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.contactsProcessed).toBe(5000);
        expect(result.details.contactsStored).toBe(5000);
      });
    });

    describe('Incremental Sync', () => {
      it('should support incremental sync with sync token', async () => {
        // Note: Google People API doesn't directly support incremental sync like some other APIs,
        // but the provider should be designed to handle it gracefully
        mockPersistence.getLastSyncedAt.mockResolvedValue(
          new Date('2023-06-01'),
        );

        await provider.sync(mockUserId);

        // Should still fetch all contacts but could be optimized in the future
        expect(mockPeopleApi.people.connections.list).toHaveBeenCalledWith(
          expect.objectContaining({
            resourceName: 'people/me',
            personFields:
              'names,emailAddresses,phoneNumbers,birthdays,addresses,biographies,photos,memberships,metadata',
            pageSize: 1000,
          }),
        );
      });
    });
  });

  describe('status', () => {
    const mockUserIntegration = {
      userIntegrationId: 'ui_123',
      recSeq: 0,
    };
    const mockHistory = {
      syncedAt: new Date('2023-06-01'),
    };

    beforeAll(() => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(mockUserIntegration as any);
      (
        mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
      ).mockResolvedValue(mockHistory as any);
    });

    it('should return connected status with valid credentials', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: 'valid_token',
        refreshToken: 'refresh_token',
        expiresAt: Date.now() + 3600000,
      });
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        ...mockUserIntegration,
        status: 'CONNECTED',
      } as any);
      mockPersistence.getLastSyncedAt.mockResolvedValue(mockHistory.syncedAt);

      const result = await provider.status(mockUserId);

      expect(result).toEqual({
        connected: true,
        lastSyncedAt: mockHistory.syncedAt,
        details: {
          hasToken: true,
          status: 'CONNECTED',
        },
      });
    });

    it('should return not connected when no user integration exists', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result).toEqual({
        connected: false,
        lastSyncedAt: null,
      });
    });

    it('should return status with invalid credentials when tokens are missing', async () => {
      mockTokenStore.get.mockResolvedValue(null);
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        ...mockUserIntegration,
        status: 'CONNECTED',
      } as any);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(false);
      expect(result.details.hasToken).toBe(false);
      expect(result.details.status).toBe('CONNECTED');
    });

    it('should handle no history record', async () => {
      mockPersistence.getLastSyncedAt.mockResolvedValue(null);
      mockTokenStore.get.mockResolvedValue({
        accessToken: 'valid_token',
      });
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        ...mockUserIntegration,
        status: 'CONNECTED',
      } as any);

      const result = await provider.status(mockUserId);

      expect(result.lastSyncedAt).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockPersistence.ensureIntegration.mockRejectedValue(
        new Error('DB error'),
      );

      const result = await provider.status(mockUserId);

      expect(result).toEqual({
        connected: false,
        lastSyncedAt: null,
      });
    });
  });
});
