/**
 * Tests for TokenManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenManager, type OAuthTokens, type StoredTokens } from './tokenManager.js';

// Mock fetch for refresh token tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * TestableTokenManager extends TokenManager to override environment access
 */
class TestableTokenManager extends TokenManager {
  private testClientId: string | undefined = 'test-client-id';
  private testClientSecret: string | undefined = 'test-client-secret';

  setClientId(id: string | undefined) {
    this.testClientId = id;
  }

  setClientSecret(secret: string | undefined) {
    this.testClientSecret = secret;
  }

  protected override getClientId(): string | undefined {
    return this.testClientId;
  }

  protected override getClientSecret(): string | undefined {
    return this.testClientSecret;
  }
}

describe('TokenManager', () => {
  let tokenManager: TestableTokenManager;
  let mockStorage: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    tokenManager = new TestableTokenManager(mockStorage as any, 5 * 60 * 1000); // 5 min buffer
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('setTokens', () => {
    it('should store tokens with calculated expiry', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const oauthTokens: OAuthTokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600, // 1 hour
        token_type: 'Bearer',
      };

      tokenManager.setTokens(oauthTokens);

      expect(mockStorage.set).toHaveBeenCalledWith({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: now + 3600 * 1000,
        tokenType: 'Bearer',
      });
    });

    it('should handle tokens without refresh_token', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const oauthTokens: OAuthTokens = {
        access_token: 'test-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      tokenManager.setTokens(oauthTokens);

      expect(mockStorage.set).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: null,
        })
      );
    });
  });

  describe('getAccessToken', () => {
    it('should return null when no tokens stored', async () => {
      mockStorage.get.mockReturnValue(null);

      const token = await tokenManager.getAccessToken();

      expect(token).toBeNull();
    });

    it('should return access token when valid', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockStorage.get.mockReturnValue({
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: now + 60 * 60 * 1000, // 1 hour from now
        tokenType: 'Bearer',
      });

      const token = await tokenManager.getAccessToken();

      expect(token).toBe('valid-token');
    });

    it('should trigger refresh when token is expired', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Token expired (within 5 min buffer)
      mockStorage.get.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: now + 4 * 60 * 1000, // 4 min from now (within buffer)
        tokenType: 'Bearer',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      const token = await tokenManager.getAccessToken();

      expect(mockFetch).toHaveBeenCalled();
      // Token should be refreshed
      expect(mockStorage.set).toHaveBeenCalled();
      expect(token).toBe('new-access-token');
    });

    it('should clear tokens when refresh fails with 401', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockStorage.get.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: now - 1000, // Already expired
        tokenType: 'Bearer',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_grant' }),
      });

      const token = await tokenManager.getAccessToken();

      expect(token).toBeNull();
      expect(mockStorage.remove).toHaveBeenCalled();
    });
  });

  describe('getAccessTokenSync', () => {
    it('should return null when no tokens stored', () => {
      mockStorage.get.mockReturnValue(null);

      const token = tokenManager.getAccessTokenSync();

      expect(token).toBeNull();
    });

    it('should return token when valid', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockStorage.get.mockReturnValue({
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: now + 60 * 60 * 1000,
        tokenType: 'Bearer',
      });

      const token = tokenManager.getAccessTokenSync();

      expect(token).toBe('valid-token');
    });

    it('should return null when token is expired', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockStorage.get.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: now - 1000, // Already expired
        tokenType: 'Bearer',
      });

      const token = tokenManager.getAccessTokenSync();

      expect(token).toBeNull();
    });
  });

  describe('clearTokens', () => {
    it('should remove tokens from storage', () => {
      tokenManager.clearTokens();

      expect(mockStorage.remove).toHaveBeenCalled();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true when no tokens', () => {
      mockStorage.get.mockReturnValue(null);

      expect(tokenManager.isTokenExpired()).toBe(true);
    });

    it('should return false when token is valid with buffer', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const tokens: StoredTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: now + 60 * 60 * 1000, // 1 hour from now
        tokenType: 'Bearer',
      };

      expect(tokenManager.isTokenExpired(tokens)).toBe(false);
    });

    it('should return true when within buffer period', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const tokens: StoredTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: now + 3 * 60 * 1000, // 3 min from now (within 5 min buffer)
        tokenType: 'Bearer',
      };

      expect(tokenManager.isTokenExpired(tokens)).toBe(true);
    });

    it('should return true when token is already expired', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const tokens: StoredTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: now - 1000, // Already expired
        tokenType: 'Bearer',
      };

      expect(tokenManager.isTokenExpired(tokens)).toBe(true);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no tokens', () => {
      mockStorage.get.mockReturnValue(null);

      expect(tokenManager.isAuthenticated()).toBe(false);
    });

    it('should return true when valid tokens exist', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockStorage.get.mockReturnValue({
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: now + 60 * 60 * 1000,
        tokenType: 'Bearer',
      });

      expect(tokenManager.isAuthenticated()).toBe(true);
    });

    it('should return false when tokens are expired', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockStorage.get.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: now - 1000,
        tokenType: 'Bearer',
      });

      expect(tokenManager.isAuthenticated()).toBe(false);
    });
  });

  describe('getTimeUntilExpiry', () => {
    it('should return 0 when no tokens', () => {
      mockStorage.get.mockReturnValue(null);

      expect(tokenManager.getTimeUntilExpiry()).toBe(0);
    });

    it('should return correct time until expiry', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockStorage.get.mockReturnValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: now + 30 * 60 * 1000, // 30 min from now
        tokenType: 'Bearer',
      });

      expect(tokenManager.getTimeUntilExpiry()).toBe(30 * 60 * 1000);
    });

    it('should return 0 when token is expired', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      mockStorage.get.mockReturnValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: now - 1000,
        tokenType: 'Bearer',
      });

      expect(tokenManager.getTimeUntilExpiry()).toBe(0);
    });
  });

  describe('onTokenExpired', () => {
    it('should register callback and return unsubscribe function', () => {
      const callback = vi.fn();

      const unsubscribe = tokenManager.onTokenExpired(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback when notifyTokenExpired is triggered', async () => {
      const callback = vi.fn();
      tokenManager.onTokenExpired(callback);

      // Trigger expired scenario
      mockStorage.get.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: null, // No refresh token
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer',
      });

      await tokenManager.getAccessToken();

      expect(callback).toHaveBeenCalled();
    });

    it('should not call callback after unsubscribe', async () => {
      const callback = vi.fn();
      const unsubscribe = tokenManager.onTokenExpired(callback);

      unsubscribe();

      // Trigger expired scenario
      mockStorage.get.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: null,
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer',
      });

      await tokenManager.getAccessToken();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('onAuthStateChange', () => {
    it('should call callback when tokens are set', () => {
      const callback = vi.fn();
      tokenManager.onAuthStateChange(callback);

      const oauthTokens: OAuthTokens = {
        access_token: 'test-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      tokenManager.setTokens(oauthTokens);

      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should call callback when tokens are cleared', () => {
      const callback = vi.fn();
      tokenManager.onAuthStateChange(callback);

      tokenManager.clearTokens();

      expect(callback).toHaveBeenCalledWith(false);
    });
  });

  describe('hasRefreshToken', () => {
    it('should return false when no tokens', () => {
      mockStorage.get.mockReturnValue(null);

      expect(tokenManager.hasRefreshToken()).toBe(false);
    });

    it('should return true when refresh token exists', () => {
      mockStorage.get.mockReturnValue({
        accessToken: 'token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      });

      expect(tokenManager.hasRefreshToken()).toBe(true);
    });

    it('should return false when refresh token is null', () => {
      mockStorage.get.mockReturnValue({
        accessToken: 'token',
        refreshToken: null,
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      });

      expect(tokenManager.hasRefreshToken()).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('should return null when no refresh token available', async () => {
      mockStorage.get.mockReturnValue({
        accessToken: 'token',
        refreshToken: null,
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      });

      const result = await tokenManager.refreshAccessToken();

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should call token endpoint with correct parameters', async () => {
      mockStorage.get.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      await tokenManager.refreshAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('refresh_token=test-refresh-token'),
        })
      );
    });

    it('should prevent concurrent refresh requests', async () => {
      mockStorage.get.mockReturnValue({
        accessToken: 'expired-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer',
      });

      let resolveFirst: (value: any) => void;
      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });

      mockFetch.mockReturnValueOnce(firstPromise);

      // Start two refresh requests concurrently
      const refresh1 = tokenManager.refreshAccessToken();
      const refresh2 = tokenManager.refreshAccessToken();

      // Resolve the fetch
      resolveFirst!({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      await Promise.all([refresh1, refresh2]);

      // Should only call fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
