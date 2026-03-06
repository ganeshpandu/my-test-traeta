import { Test, TestingModule } from '@nestjs/testing';
import { GoodreadsProvider } from './goodreads.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from '../persistence';
import { TokenStore } from '../token-store';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
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
jest.mock('cheerio');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GoodreadsProvider', () => {
  let provider: GoodreadsProvider;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockPersistence: jest.Mocked<IntegrationPersistence>;
  let mockTokenStore: jest.Mocked<TokenStore>;

  const mockUserId = 'user123';
  const mockIntegration = {
    integrationId: 'goodreads_integration_id',
    recSeq: 0,
    recStatus: 'ACTIVE',
    name: 'goodreads',
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodreadsProvider,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationPersistence, useValue: mockPersistence },
        { provide: TokenStore, useValue: mockTokenStore },
      ],
    }).compile();

    provider = module.get<GoodreadsProvider>(GoodreadsProvider);

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
    it('should create connection successfully', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.state).toContain(`goodreads-${mockUserId}`);
      expect(result.redirectUrl).toBeUndefined();
      expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith(
        'goodreads',
      );
    });

    it('should create state with timestamp', async () => {
      const result = await provider.createConnection(mockUserId);

      // State format should be: goodreads-{userId}-{timestamp}
      const stateParts = result.state.split('-');
      expect(stateParts).toHaveLength(3);
      expect(stateParts[0]).toBe('goodreads');
      expect(stateParts[1]).toBe(mockUserId);
      expect(Number(stateParts[2])).toBeGreaterThan(0);
    });

    it('should handle persistence errors gracefully', async () => {
      mockPersistence.ensureIntegration.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('handleCallback', () => {
    const mockState = `goodreads-${mockUserId}-${Date.now()}`;
    const mockCredentials = {
      username: 'testuser',
      password: 'testpass',
    };
    const mockRssFeedCredentials = {
      rssFeedUrl:
        'https://www.goodreads.com/review/list_rss/123456?key=abcd1234',
    };

    describe('Input Validation', () => {
      it('should throw InvalidCallbackException when state is missing', async () => {
        await expect(
          provider.handleCallback({ username: 'test' }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({ username: 'test' }),
        ).rejects.toThrow('Missing required callback parameter: state');
      });

      it('should throw InvalidCallbackException with invalid state format', async () => {
        await expect(
          provider.handleCallback({
            state: 'invalid-state',
            ...mockCredentials,
          }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({
            state: 'invalid-state',
            ...mockCredentials,
          }),
        ).rejects.toThrow('Invalid state format: unable to extract userId');
      });

      it('should throw InvalidCallbackException when neither credentials nor RSS feed URL provided', async () => {
        await expect(
          provider.handleCallback({ state: mockState }),
        ).rejects.toThrow(InvalidCallbackException);
        await expect(
          provider.handleCallback({ state: mockState }),
        ).rejects.toThrow(
          'Invalid credentials: provide either rssFeedUrl or username+password',
        );
      });

      it('should throw InvalidCallbackException when only username provided without password', async () => {
        await expect(
          provider.handleCallback({ state: mockState, username: 'testuser' }),
        ).rejects.toThrow(InvalidCallbackException);
      });

      it('should throw InvalidCallbackException when only password provided without username', async () => {
        await expect(
          provider.handleCallback({ state: mockState, password: 'testpass' }),
        ).rejects.toThrow(InvalidCallbackException);
      });
    });

    describe('RSS Feed Authentication', () => {
      beforeAll(() => {
        // Mock successful RSS feed validation
        jest.spyOn(provider as any, 'validateRssFeed').mockResolvedValue(true);
      });

      it('should handle RSS feed URL authentication successfully', async () => {
        await provider.handleCallback({
          state: mockState,
          ...mockRssFeedCredentials,
        });

        expect(provider['validateRssFeed']).toHaveBeenCalledWith(
          mockRssFeedCredentials.rssFeedUrl,
        );
        expect(mockTokenStore.set).toHaveBeenCalledWith(
          mockUserId,
          'goodreads',
          {
            accessToken: JSON.stringify({
              rssFeedUrl: mockRssFeedCredentials.rssFeedUrl,
            }),
          },
        );
        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          mockUserId,
          mockIntegration.integrationId,
        );
      });

      it('should handle RSS feed validation failure', async () => {
        jest
          .spyOn(provider as any, 'validateRssFeed')
          .mockRejectedValue(new Error('Invalid RSS feed'));

        await expect(
          provider.handleCallback({
            state: mockState,
            ...mockRssFeedCredentials,
          }),
        ).rejects.toThrow(InvalidCallbackException);
      });
    });

    describe('Username/Password Authentication', () => {
      beforeAll(() => {
        // Mock successful authentication
        jest
          .spyOn(provider as any, 'authenticateWithGoodreads')
          .mockResolvedValue('session-cookie-123');
      });

      it('should handle username/password authentication successfully', async () => {
        await provider.handleCallback({ state: mockState, ...mockCredentials });

        expect(provider['authenticateWithGoodreads']).toHaveBeenCalledWith(
          mockCredentials.username,
          mockCredentials.password,
        );
        expect(mockTokenStore.set).toHaveBeenCalledWith(
          mockUserId,
          'goodreads',
          {
            accessToken: JSON.stringify({
              username: mockCredentials.username,
              sessionCookie: 'session-cookie-123',
            }),
          },
        );
        expect(mockPersistence.markConnected).toHaveBeenCalledWith(
          mockUserId,
          mockIntegration.integrationId,
        );
      });

      it('should handle authentication failure', async () => {
        jest
          .spyOn(provider as any, 'authenticateWithGoodreads')
          .mockRejectedValue(new Error('Invalid credentials'));

        await expect(
          provider.handleCallback({ state: mockState, ...mockCredentials }),
        ).rejects.toThrow(OAuthAuthenticationException);
      });

      it('should handle authentication error with authentication keyword', async () => {
        jest
          .spyOn(provider as any, 'authenticateWithGoodreads')
          .mockRejectedValue(new Error('authentication failed'));

        await expect(
          provider.handleCallback({ state: mockState, ...mockCredentials }),
        ).rejects.toThrow(OAuthAuthenticationException);
        await expect(
          provider.handleCallback({ state: mockState, ...mockCredentials }),
        ).rejects.toThrow(
          'Failed to authenticate with Goodreads: authentication failed',
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle token store errors', async () => {
        jest.spyOn(provider as any, 'validateRssFeed').mockResolvedValue(true);
        mockTokenStore.set.mockRejectedValue(new Error('Token store error'));

        await expect(
          provider.handleCallback({
            state: mockState,
            ...mockRssFeedCredentials,
          }),
        ).rejects.toThrow(InvalidCallbackException);
      });

      it('should handle persistence errors during connection marking', async () => {
        jest.spyOn(provider as any, 'validateRssFeed').mockResolvedValue(true);
        mockPersistence.markConnected.mockRejectedValue(
          new Error('Persistence error'),
        );

        await expect(
          provider.handleCallback({
            state: mockState,
            ...mockRssFeedCredentials,
          }),
        ).rejects.toThrow(InvalidCallbackException);
      });

      it('should re-throw InvalidCallbackException as-is', async () => {
        const customError = new InvalidCallbackException(
          'GOODREADS',
          'Custom error',
        );
        jest
          .spyOn(provider as any, 'validateRssFeed')
          .mockRejectedValue(customError);

        await expect(
          provider.handleCallback({
            state: mockState,
            ...mockRssFeedCredentials,
          }),
        ).rejects.toThrow(customError);
      });
    });
  });

  describe('sync', () => {
    const mockTokenData = {
      accessToken: JSON.stringify({
        rssFeedUrl:
          'https://www.goodreads.com/review/list_rss/123456?key=abcd1234',
      }),
    };
    const mockBookData = [
      {
        id: '12345',
        title: 'Test Book',
        authors: ['Test Author'],
        isbn: '1234567890',
        publicationYear: 2023,
        genres: ['Fiction'],
        userRating: 5,
        userReview: 'Great book!',
        readingStatus: 'read' as const,
        dateAdded: new Date('2023-01-01'),
        dateFinished: new Date('2023-01-15'),
        numberOfPages: 300,
        coverImageUrl: 'https://example.com/cover.jpg',
        shelves: ['favorites'],
      },
    ];

    beforeAll(() => {
      mockTokenStore.get.mockResolvedValue(mockTokenData);
      mockPersistence.getLastSyncedAt.mockResolvedValue(null);
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        userIntegrationId: 'ui_123',
        recSeq: 0,
      } as any);
    });

    describe('Happy Path', () => {
      it('should sync books from RSS feed successfully', async () => {
        jest
          .spyOn(provider as any, 'syncFromRssFeed')
          .mockResolvedValue(mockBookData);
        jest.spyOn(provider as any, 'storeBooks').mockResolvedValue(undefined);

        const result = await provider.sync(mockUserId);

        expect(provider['syncFromRssFeed']).toHaveBeenCalledWith(
          'https://www.goodreads.com/review/list_rss/123456?key=abcd1234',
        );
        expect(provider['storeBooks']).toHaveBeenCalledWith(
          mockUserId,
          mockBookData,
        );
        expect(mockPersistence.markSynced).toHaveBeenCalled();
        expect(result).toEqual({
          ok: true,
          syncedAt: expect.any(Date),
          details: {
            booksProcessed: 1,
            booksStored: 1,
          },
        });
      });

      it('should sync books from web scraping successfully', async () => {
        const webScrapingTokenData = {
          accessToken: JSON.stringify({
            username: 'testuser',
            sessionCookie: 'session-123',
          }),
        };
        mockTokenStore.get.mockResolvedValue(webScrapingTokenData);
        jest
          .spyOn(provider as any, 'syncByWebScraping')
          .mockResolvedValue(mockBookData);
        jest.spyOn(provider as any, 'storeBooks').mockResolvedValue(undefined);

        const result = await provider.sync(mockUserId);

        expect(provider['syncByWebScraping']).toHaveBeenCalledWith(
          'testuser',
          'session-123',
        );
        expect(result.ok).toBe(true);
        expect(result.details.booksProcessed).toBe(1);
      });
    });

    describe('Input Validation', () => {
      it('should throw InvalidTokenException when no tokens exist', async () => {
        mockTokenStore.get.mockResolvedValue(null);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });

      it('should throw InvalidTokenException when accessToken is missing', async () => {
        mockTokenStore.get.mockResolvedValue({ accessToken: '' } as any);

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });

      it('should throw InvalidTokenException when accessToken cannot be parsed as JSON', async () => {
        mockTokenStore.get.mockResolvedValue({
          accessToken: 'invalid-json',
        });

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });

      it('should throw InvalidTokenException when credentials object is invalid', async () => {
        mockTokenStore.get.mockResolvedValue({
          accessToken: JSON.stringify({}),
        });

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });
    });

    describe('Exception Handling', () => {
      it('should handle 401 HTTP error and throw InvalidTokenException', async () => {
        jest.spyOn(provider as any, 'syncFromRssFeed').mockRejectedValue({
          response: { status: 401, data: { message: 'Unauthorized' } },
        });

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });

      it('should handle 403 HTTP error and throw InvalidTokenException', async () => {
        jest.spyOn(provider as any, 'syncFromRssFeed').mockRejectedValue({
          response: { status: 403, data: { message: 'Forbidden' } },
        });

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          InvalidTokenException,
        );
      });

      it('should handle 429 HTTP error and throw RateLimitException', async () => {
        jest.spyOn(provider as any, 'syncFromRssFeed').mockRejectedValue({
          response: { status: 429, data: { message: 'Rate limit exceeded' } },
        });

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          RateLimitException,
        );
      });

      it('should handle 500+ HTTP error and throw ProviderAPIException', async () => {
        jest.spyOn(provider as any, 'syncFromRssFeed').mockRejectedValue({
          response: { status: 500, data: { message: 'Internal server error' } },
        });

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          ProviderAPIException,
        );
      });

      it('should handle parsing errors and throw DataSyncException', async () => {
        jest
          .spyOn(provider as any, 'syncFromRssFeed')
          .mockRejectedValue(new Error('Failed to parse RSS data'));

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          DataSyncException,
        );
        await expect(provider.sync(mockUserId)).rejects.toThrow(
          'Failed to parse Goodreads data: Failed to parse RSS data',
        );
      });

      it('should handle scraping errors and throw DataSyncException', async () => {
        jest
          .spyOn(provider as any, 'syncFromRssFeed')
          .mockRejectedValue(new Error('Web scraping failed'));

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          DataSyncException,
        );
        await expect(provider.sync(mockUserId)).rejects.toThrow(
          'Failed to parse Goodreads data: Web scraping failed',
        );
      });

      it('should handle generic errors and throw DataSyncException', async () => {
        jest
          .spyOn(provider as any, 'syncFromRssFeed')
          .mockRejectedValue(new Error('Unknown error'));

        await expect(provider.sync(mockUserId)).rejects.toThrow(
          DataSyncException,
        );
        await expect(provider.sync(mockUserId)).rejects.toThrow(
          'Failed to sync Goodreads data: Unknown error',
        );
      });

      it('should re-throw InvalidTokenException as-is', async () => {
        const customError = new InvalidTokenException('GOODREADS');
        jest
          .spyOn(provider as any, 'syncFromRssFeed')
          .mockRejectedValue(customError);

        await expect(provider.sync(mockUserId)).rejects.toThrow(customError);
      });

      it('should re-throw DataSyncException as-is', async () => {
        const customError = new DataSyncException(
          'GOODREADS',
          'Custom sync error',
        );
        jest
          .spyOn(provider as any, 'syncFromRssFeed')
          .mockRejectedValue(customError);

        await expect(provider.sync(mockUserId)).rejects.toThrow(customError);
      });

      it('should re-throw ProviderAPIException as-is', async () => {
        const customError = new ProviderAPIException('GOODREADS', 'API error');
        jest
          .spyOn(provider as any, 'syncFromRssFeed')
          .mockRejectedValue(customError);

        await expect(provider.sync(mockUserId)).rejects.toThrow(customError);
      });

      it('should re-throw RateLimitException as-is', async () => {
        const customError = new RateLimitException('GOODREADS');
        jest
          .spyOn(provider as any, 'syncFromRssFeed')
          .mockRejectedValue(customError);

        await expect(provider.sync(mockUserId)).rejects.toThrow(customError);
      });
    });

    describe('Data Processing', () => {
      it('should handle empty book results', async () => {
        jest.spyOn(provider as any, 'syncFromRssFeed').mockResolvedValue([]);
        jest.spyOn(provider as any, 'storeBooks').mockResolvedValue(undefined);

        const result = await provider.sync(mockUserId);

        expect(result).toEqual({
          ok: true,
          syncedAt: expect.any(Date),
          details: {
            booksProcessed: 0,
            booksStored: 0,
          },
        });
      });

      it('should handle large book dataset', async () => {
        const largeMockBookData = Array.from({ length: 1000 }, (_, i) => ({
          ...mockBookData[0],
          id: `book_${i}`,
          title: `Test Book ${i}`,
        }));

        jest
          .spyOn(provider as any, 'syncFromRssFeed')
          .mockResolvedValue(largeMockBookData);
        jest.spyOn(provider as any, 'storeBooks').mockResolvedValue(undefined);

        const result = await provider.sync(mockUserId);

        expect(result.ok).toBe(true);
        expect(result.details.booksProcessed).toBe(1000);
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
        accessToken: JSON.stringify({
          rssFeedUrl: 'https://example.com/rss',
        }),
      });

      const result = await provider.status(mockUserId);

      expect(result).toEqual({
        connected: true,
        lastSyncedAt: mockHistory.syncedAt,
        details: {
          hasValidCredentials: true,
          syncMethod: 'rss',
        },
      });
    });

    it('should return connected status for web scraping method', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: JSON.stringify({
          sessionCookie: 'session-123',
        }),
      });

      const result = await provider.status(mockUserId);

      expect(result.details.syncMethod).toBe('web_scraping');
      expect(result.details.hasValidCredentials).toBe(true);
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

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(true);
      expect(result.details.hasValidCredentials).toBe(false);
      expect(result.details.syncMethod).toBe('unknown');
    });

    it('should handle invalid JSON in token store gracefully', async () => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: 'invalid-json',
      });

      const result = await provider.status(mockUserId);

      expect(result.details.hasValidCredentials).toBe(false);
    });

    it('should handle no history record', async () => {
      (
        mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
      ).mockResolvedValue(null);
      mockTokenStore.get.mockResolvedValue({
        accessToken: JSON.stringify({
          rssFeedUrl: 'https://example.com/rss',
        }),
      });

      const result = await provider.status(mockUserId);

      expect(result.lastSyncedAt).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockPersistence.ensureIntegration.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(provider.status(mockUserId)).rejects.toThrow('DB error');
    });
  });
});
