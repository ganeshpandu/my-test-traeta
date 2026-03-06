import { Test, TestingModule } from '@nestjs/testing';
import { PlaidProvider } from './plaid.provider';
import { PrismaService } from '@traeta/prisma';
import { IntegrationPersistence } from '../persistence';
import { TokenStore } from '../token-store';
import { Logger } from '@nestjs/common';
import {
  ConfigurationException,
  InvalidCallbackException,
  OAuthAuthenticationException,
  InvalidTokenException,
  DataSyncException,
  ProviderAPIException,
  RateLimitException,
} from '../exceptions/integration.exceptions';
import { REC_STATUS, DATA_STATUS } from '../../../constants';

// Mock Plaid SDK
const mockPlaidClient = {
  linkTokenCreate: jest.fn(),
  itemPublicTokenExchange: jest.fn(),
  accountsGet: jest.fn(),
  transactionsGet: jest.fn(),
  institutionsGetById: jest.fn(),
};

jest.mock('plaid', () => ({
  PlaidApi: jest.fn().mockImplementation(() => mockPlaidClient),
  Configuration: jest.fn(),
  PlaidEnvironments: {
    sandbox: 'https://sandbox.plaid.com',
    development: 'https://development.plaid.com',
    production: 'https://production.plaid.com',
  },
  Products: {
    Transactions: 'transactions',
  },
  CountryCode: {
    Us: 'US',
  },
}));

describe('PlaidProvider', () => {
  let provider: PlaidProvider;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockPersistence: jest.Mocked<IntegrationPersistence>;
  let mockTokenStore: jest.Mocked<TokenStore>;

  const mockUserId = 'user123';
  const mockIntegration = {
    integrationId: 'plaid_integration_id',
    recSeq: 0,
    name: 'plaid',
    recStatus: REC_STATUS.ACTIVE,
    dataStatus: DATA_STATUS.ACTIVE,
    createdBy: 'system',
    createdOn: new Date(),
    modifiedOn: new Date(),
    modifiedBy: 'system',
    popularity: 0,
  };

  const createMockListAndCategoryResult = () => {
    const createdOn = new Date('2024-01-01T00:00:00Z');
    const modifiedOn = new Date('2024-01-01T00:00:00Z');

    return {
      list: {
        listId: 'list_1',
        recSeq: 0,
        recStatus: 'A',
        name: 'Financial Accounts',
        dataStatus: 'A',
        createdBy: 'system',
        createdOn,
        modifiedOn,
        modifiedBy: 'system',
      },
      userList: {
        userListId: 'user_list_1',
        recSeq: 0,
        recStatus: 'A',
        userId: mockUserId,
        userRecSeq: 0,
        listId: 'list_1',
        listRecSeq: 0,
        customName: null,
        dataStatus: 'A',
        createdBy: 'system',
        createdOn,
        modifiedOn,
        modifiedBy: 'system',
      },
      category: {
        listCategoryId: 'cat_1',
        recSeq: 0,
        recStatus: 'A',
        listId: 'list_1',
        listRecSeq: 0,
        name: 'Bank Account',
        dataStatus: 'A',
        createdBy: 'system',
        createdOn,
        modifiedOn,
        modifiedBy: 'system',
      },
    };
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

    // Set environment variables
    process.env.PLAID_CLIENT_ID = 'test_client_id';
    process.env.PLAID_SECRET = 'test_secret';
    process.env.PLAID_ENV = 'sandbox';
    process.env.PLAID_WEBHOOK_URL = 'http://localhost:3000/webhook';
    process.env.PLAID_REDIRECT_URI = 'http://localhost:3000/callback';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaidProvider,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: IntegrationPersistence, useValue: mockPersistence },
        { provide: TokenStore, useValue: mockTokenStore },
      ],
    }).compile();

    provider = module.get<PlaidProvider>(PlaidProvider);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    // Default mock implementations
    mockPersistence.ensureIntegration.mockResolvedValue(mockIntegration);
    mockPersistence.ensureListAndCategoryForUser.mockResolvedValue(
      createMockListAndCategoryResult(),
    );
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('createConnection', () => {
    const mockLinkTokenResponse = {
      data: {
        link_token: 'link-sandbox-test-token',
        expiration: '2024-01-01T12:00:00Z',
      },
    };

    beforeAll(() => {
      mockPlaidClient.linkTokenCreate.mockResolvedValue(mockLinkTokenResponse);
    });

    it('should create connection successfully with valid configuration', async () => {
      const result = await provider.createConnection(mockUserId);

      expect(result.linkToken).toBe('link-sandbox-test-token');
      expect(result.state).toContain(`plaid-${mockUserId}`);
      expect(result.redirectUrl).toContain('plaid://link?token=');
      expect(mockPersistence.ensureIntegration).toHaveBeenCalledWith('plaid');
      expect(mockPlaidClient.linkTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { client_user_id: mockUserId },
          client_name: 'Traeta',
          products: ['transactions'],
          country_codes: ['US'],
          language: 'en',
        }),
      );
    });

    it('should throw ConfigurationException when CLIENT_ID is missing', async () => {
      process.env.PLAID_CLIENT_ID = '';

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        'Plaid integration is not properly configured',
      );
    });

    it('should throw ConfigurationException when SECRET is missing', async () => {
      process.env.PLAID_SECRET = '';

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
    });

    it('should handle 401 error from Plaid API', async () => {
      mockPlaidClient.linkTokenCreate.mockRejectedValue({
        response: {
          status: 401,
          data: { error_message: 'Invalid credentials' },
        },
      });

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        ConfigurationException,
      );
      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        'Invalid Plaid credentials',
      );
    });

    it('should handle 429 rate limit error', async () => {
      mockPlaidClient.linkTokenCreate.mockRejectedValue({
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
          data: { error_message: 'Rate limit exceeded' },
        },
      });

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        RateLimitException,
      );
    });

    it('should handle generic API error', async () => {
      mockPlaidClient.linkTokenCreate.mockRejectedValue({
        response: {
          status: 500,
          data: { error_message: 'Internal server error' },
        },
      });

      await expect(provider.createConnection(mockUserId)).rejects.toThrow(
        ProviderAPIException,
      );
    });

    it('should use correct Plaid environment based on configuration', async () => {
      process.env.PLAID_ENV = 'production';

      // Recreate provider to pick up new env
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PlaidProvider,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: IntegrationPersistence, useValue: mockPersistence },
          { provide: TokenStore, useValue: mockTokenStore },
        ],
      }).compile();

      const prodProvider = module.get<PlaidProvider>(PlaidProvider);

      expect((prodProvider as any).getPlaidEnvironment()).toBe(
        'https://production.plaid.com',
      );
    });
  });

  describe('handleCallback', () => {
    const mockPublicToken = 'public-sandbox-test-token';
    const mockState = `plaid-${mockUserId}-${Date.now()}`;
    const mockExchangeResponse = {
      data: {
        access_token: 'access-sandbox-test-token',
        item_id: 'item_123',
      },
    };

    beforeAll(() => {
      mockPlaidClient.itemPublicTokenExchange.mockResolvedValue(
        mockExchangeResponse,
      );
      mockPlaidClient.accountsGet.mockResolvedValue({ data: { accounts: [] } });
      mockPlaidClient.transactionsGet.mockResolvedValue({
        data: { transactions: [] },
      });
    });

    it('should handle callback successfully with valid public_token and state', async () => {
      await provider.handleCallback({
        public_token: mockPublicToken,
        state: mockState,
        metadata: { institution: { name: 'Test Bank' } },
      });

      expect(mockPlaidClient.itemPublicTokenExchange).toHaveBeenCalledWith({
        public_token: mockPublicToken,
      });

      expect(mockTokenStore.set).toHaveBeenCalledWith(mockUserId, 'plaid', {
        accessToken: 'access-sandbox-test-token',
        providerUserId: 'item_123',
        expiresAt: expect.any(Number),
      });

      expect(mockPersistence.markConnected).toHaveBeenCalledWith(
        mockUserId,
        mockIntegration.integrationId,
      );
    });

    it('should throw InvalidCallbackException when public_token is missing', async () => {
      await expect(
        provider.handleCallback({ state: mockState }),
      ).rejects.toThrow(InvalidCallbackException);
    });

    it('should throw InvalidCallbackException when state is missing', async () => {
      await expect(
        provider.handleCallback({ public_token: mockPublicToken }),
      ).rejects.toThrow(InvalidCallbackException);
    });

    it('should throw InvalidCallbackException with invalid state format', async () => {
      await expect(
        provider.handleCallback({
          public_token: mockPublicToken,
          state: 'invalid-state',
        }),
      ).rejects.toThrow(InvalidCallbackException);
    });

    it('should extract userId correctly from state', async () => {
      const userId = 'user-with-hyphens-123';
      const state = `plaid-${userId}-${Date.now()}`;

      await provider.handleCallback({
        public_token: mockPublicToken,
        state,
      });

      expect(mockTokenStore.set).toHaveBeenCalledWith(
        userId,
        'plaid',
        expect.any(Object),
      );
    });

    it('should handle 401 error from token exchange', async () => {
      mockPlaidClient.itemPublicTokenExchange.mockRejectedValue({
        response: {
          status: 401,
          data: { error_message: 'Invalid public token' },
        },
      });

      await expect(
        provider.handleCallback({
          public_token: mockPublicToken,
          state: mockState,
        }),
      ).rejects.toThrow(OAuthAuthenticationException);
    });

    it('should handle 429 rate limit error', async () => {
      mockPlaidClient.itemPublicTokenExchange.mockRejectedValue({
        response: {
          status: 429,
          headers: { 'retry-after': '60' },
        },
      });

      await expect(
        provider.handleCallback({
          public_token: mockPublicToken,
          state: mockState,
        }),
      ).rejects.toThrow(RateLimitException);
    });

    it('should handle generic API error', async () => {
      mockPlaidClient.itemPublicTokenExchange.mockRejectedValue({
        response: {
          status: 500,
          data: { error_message: 'Internal server error' },
        },
      });

      await expect(
        provider.handleCallback({
          public_token: mockPublicToken,
          state: mockState,
        }),
      ).rejects.toThrow(ProviderAPIException);
    });

    it('should automatically trigger sync after successful connection', async () => {
      const syncSpy = jest.spyOn(provider, 'sync').mockResolvedValue({
        ok: true,
        syncedAt: new Date(),
        details: { totalItems: 5 },
      });

      await provider.handleCallback({
        public_token: mockPublicToken,
        state: mockState,
      });

      expect(syncSpy).toHaveBeenCalledWith(mockUserId);
    });

    it('should not fail callback if automatic sync fails', async () => {
      jest.spyOn(provider, 'sync').mockRejectedValue(new Error('Sync failed'));

      await expect(
        provider.handleCallback({
          public_token: mockPublicToken,
          state: mockState,
        }),
      ).resolves.not.toThrow();

      expect(mockPersistence.markConnected).toHaveBeenCalled();
    });
  });

  describe('sync', () => {
    const mockAccessToken = 'access-sandbox-test-token';
    const mockAccounts = [
      {
        account_id: 'account_1',
        name: 'Checking Account',
        type: 'depository',
        subtype: 'checking',
        balances: {
          available: 1000,
          current: 1100,
          iso_currency_code: 'USD',
        },
      },
      {
        account_id: 'account_2',
        name: 'Credit Card',
        type: 'credit',
        subtype: 'credit card',
        balances: {
          available: 5000,
          current: 500,
          iso_currency_code: 'USD',
        },
      },
    ];

    const mockTransactions = [
      {
        transaction_id: 'txn_1',
        account_id: 'account_1',
        amount: 50.0,
        date: '2024-01-01',
        name: 'Coffee Shop',
        merchant_name: 'Starbucks',
        category: ['Food and Drink', 'Restaurants'],
        pending: false,
      },
      {
        transaction_id: 'txn_2',
        account_id: 'account_1',
        amount: -1000.0,
        date: '2024-01-02',
        name: 'Paycheck',
        category: ['Income', 'Payroll'],
        pending: false,
      },
    ];

    beforeAll(() => {
      mockTokenStore.get.mockResolvedValue({
        accessToken: mockAccessToken,
        providerUserId: 'item_123',
        expiresAt: Math.floor(Date.now() / 1000) + 31536000,
      });
      mockPersistence.getLastSyncedAt.mockResolvedValue(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      );
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
      } as any);
      mockPlaidClient.accountsGet.mockResolvedValue({
        data: { accounts: mockAccounts },
      });
      mockPlaidClient.transactionsGet.mockResolvedValue({
        data: { transactions: mockTransactions },
      });
    });

    it('should sync accounts and transactions successfully', async () => {
      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(result.syncedAt).toBeInstanceOf(Date);
      expect(result.details.accounts).toBe(2);
      expect(result.details.transactions).toBe(2);
      expect(result.details.totalItems).toBe(4);
      expect(mockPlaidClient.accountsGet).toHaveBeenCalled();
      expect(mockPlaidClient.transactionsGet).toHaveBeenCalled();
      expect(mockPersistence.markSynced).toHaveBeenCalled();
    });

    it('should use default 30 days when no last sync date', async () => {
      mockPersistence.getLastSyncedAt.mockResolvedValue(null);

      await provider.sync(mockUserId);

      expect(mockPlaidClient.transactionsGet).toHaveBeenCalled();
    });

    it('should handle empty accounts and transactions', async () => {
      mockPlaidClient.accountsGet.mockResolvedValue({
        data: { accounts: [] },
      });
      mockPlaidClient.transactionsGet.mockResolvedValue({
        data: { transactions: [] },
      });

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(result.details.totalItems).toBe(0);
      expect(mockPersistence.upsertListItem).not.toHaveBeenCalled();
    });

    it('should throw InvalidTokenException when token is missing', async () => {
      mockTokenStore.get.mockResolvedValue(null);

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('should handle API errors during sync', async () => {
      mockPlaidClient.accountsGet.mockRejectedValue({
        response: {
          status: 500,
          data: { error_message: 'Server error' },
        },
      });

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        ProviderAPIException,
      );
    });

    it('should handle rate limit during sync', async () => {
      mockPlaidClient.accountsGet.mockRejectedValue({
        response: {
          status: 429,
          headers: { 'retry-after': '300' },
        },
      });

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        RateLimitException,
      );
    });

    it('should handle invalid access token during sync', async () => {
      mockPlaidClient.accountsGet.mockRejectedValue({
        response: {
          status: 401,
          data: { error_message: 'Invalid access token' },
        },
      });

      await expect(provider.sync(mockUserId)).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('should process different account types correctly', async () => {
      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      await provider.sync(mockUserId);

      expect(mockPersistence.ensureListAndCategoryForUser).toHaveBeenCalledWith(
        mockUserId,
        'Financial',
        'Accounts',
      );
    });

    it('should categorize transactions correctly', async () => {
      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      await provider.sync(mockUserId);

      // Should be called for Food/Dining (Starbucks transaction)
      expect(mockPersistence.ensureListAndCategoryForUser).toHaveBeenCalledWith(
        mockUserId,
        'Food',
        'Dining',
      );
    });

    it('should handle pending transactions', async () => {
      const pendingTransaction = {
        ...mockTransactions[0],
        pending: true,
        pending_transaction_id: 'pending_txn_1',
      };
      mockPlaidClient.transactionsGet.mockResolvedValue({
        data: { transactions: [pendingTransaction] },
      });
      mockPersistence.upsertListItem.mockResolvedValue({
        listItemId: 'item_1',
        recSeq: 0,
      } as any);

      const result = await provider.sync(mockUserId);

      expect(result.ok).toBe(true);
      expect(mockPersistence.createListItem).toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('should return connected status when user is connected', async () => {
      const lastSyncDate = new Date('2024-01-01T12:00:00Z');
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
        status: 'CONNECTED',
      } as any);
      (
        mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
      ).mockResolvedValue({
        lastSyncedAt: lastSyncDate,
      } as any);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(true);
      expect(result.lastSyncedAt).toEqual(lastSyncDate);
      expect(result.details.integrationId).toBe(mockIntegration.integrationId);
    });

    it('should return not connected when user is not connected', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(false);
      expect(result.lastSyncedAt).toBeNull();
    });

    it('should return null lastSyncedAt when no sync history', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
        status: 'CONNECTED',
      } as any);
      (
        mockPrismaService.userIntegrationHistory.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const result = await provider.status(mockUserId);

      expect(result.connected).toBe(true);
      expect(result.lastSyncedAt).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('should disconnect user successfully', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue({
        userIntegrationId: 'link_1',
        recSeq: 0,
      } as any);

      await provider.disconnect(mockUserId);

      expect(mockTokenStore.delete).toHaveBeenCalledWith(mockUserId, 'plaid');
      expect(mockPrismaService.userIntegrations.update).toHaveBeenCalledWith({
        where: {
          userIntegrationId_recSeq: {
            userIntegrationId: 'link_1',
            recSeq: 0,
          },
        },
        data: { status: 'DISCONNECTED' },
      });
    });

    it('should handle disconnect when user is not connected', async () => {
      (
        mockPrismaService.userIntegrations.findFirst as jest.Mock
      ).mockResolvedValue(null);

      await expect(provider.disconnect(mockUserId)).resolves.not.toThrow();
    });
  });
});
