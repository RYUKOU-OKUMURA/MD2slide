/**
 * Token Manager for Google OAuth 2.0
 *
 * Manages access tokens in sessionStorage (not localStorage for security).
 * Provides auto-refresh logic with 5-minute buffer before expiry.
 */

/** Token data returned from Google OAuth token endpoint */
export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/** Stored token data with calculated expiry */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // Unix timestamp in milliseconds
  tokenType: string;
}

/** Callback type for token expiry events */
export type TokenExpiredCallback = () => void;

/** Callback type for auth state change events */
export type AuthStateChangeCallback = (isAuthenticated: boolean) => void;

/** Storage key for tokens in sessionStorage */
const TOKEN_STORAGE_KEY = 'md2slide_oauth_tokens';

/** Buffer time before token expiry (5 minutes in milliseconds) */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * TokenStorage interface for session storage operations
 */
interface TokenStorage {
  get(): StoredTokens | null;
  set(tokens: StoredTokens): void;
  remove(): void;
}

/**
 * SessionStorage implementation of TokenStorage
 * Uses sessionStorage for security (cleared when browser session ends)
 */
const sessionStorageAdapter: TokenStorage = {
  get(): StoredTokens | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const data = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (!data) {
        return null;
      }
      return JSON.parse(data) as StoredTokens;
    } catch (error) {
      console.error('[TokenManager] Failed to read tokens from sessionStorage:', error);
      return null;
    }
  },

  set(tokens: StoredTokens): void {
    if (typeof window === 'undefined') {
      console.warn('[TokenManager] sessionStorage is not available (SSR)');
      return;
    }

    try {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('[TokenManager] sessionStorage quota exceeded');
        throw new Error('Storage quota exceeded. Please clear some data.');
      }
      console.error('[TokenManager] Failed to save tokens to sessionStorage:', error);
      throw error;
    }
  },

  remove(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('[TokenManager] Failed to remove tokens from sessionStorage:', error);
    }
  },
};

/**
 * TokenManager class
 *
 * Manages OAuth tokens with automatic refresh capability.
 * All tokens are stored in sessionStorage for security.
 */
export class TokenManager {
  private storage: TokenStorage;
  private expiredCallbacks: Set<TokenExpiredCallback> = new Set();
  private authStateCallbacks: Set<AuthStateChangeCallback> = new Set();
  private refreshPromise: Promise<string | null> | null = null;
  private refreshThresholdMs: number;

  constructor(
    storage: TokenStorage = sessionStorageAdapter,
    refreshThresholdMs: number = EXPIRY_BUFFER_MS
  ) {
    this.storage = storage;
    this.refreshThresholdMs = refreshThresholdMs;
  }

  /**
   * Get the current access token
   * Automatically refreshes if token is expired and refresh_token is available
   * @returns Access token or null if not authenticated
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = this.storage.get();

    if (!tokens) {
      return null;
    }

    // Check if token needs refresh
    if (this.isTokenExpired(tokens)) {
      // Try to refresh using refresh_token
      const refreshedToken = await this.refreshAccessToken();
      return refreshedToken;
    }

    return tokens.accessToken;
  }

  /**
   * Get access token synchronously (without auto-refresh)
   * Use this when you need immediate access without async
   * @returns Access token or null if not authenticated or expired
   */
  getAccessTokenSync(): string | null {
    const tokens = this.storage.get();

    if (!tokens || this.isTokenExpired(tokens)) {
      return null;
    }

    return tokens.accessToken;
  }

  /**
   * Store tokens after OAuth login
   * Calculates expiry time from expires_in
   * @param oauthTokens - Tokens from OAuth endpoint
   */
  setTokens(oauthTokens: OAuthTokens): void {
    const now = Date.now();
    const expiresAt = now + oauthTokens.expires_in * 1000;

    const storedTokens: StoredTokens = {
      accessToken: oauthTokens.access_token,
      refreshToken: oauthTokens.refresh_token ?? null,
      expiresAt,
      tokenType: oauthTokens.token_type,
    };

    this.storage.set(storedTokens);
    this.notifyAuthStateChange(true);

    // Schedule proactive refresh before expiry
    this.scheduleProactiveRefresh(expiresAt);
  }

  /**
   * Clear all stored tokens
   * Called on logout or when tokens are invalid
   */
  clearTokens(): void {
    this.storage.remove();
    this.refreshPromise = null;
    this.notifyAuthStateChange(false);
  }

  /**
   * Check if the current token is expired or about to expire
   * Uses a buffer to refresh before actual expiry
   * @param tokens - Token data to check (uses stored tokens if not provided)
   * @returns true if token is expired or needs refresh
   */
  isTokenExpired(tokens?: StoredTokens | null): boolean {
    const tokenData = tokens ?? this.storage.get();

    if (!tokenData) {
      return true;
    }

    const now = Date.now();
    return now >= tokenData.expiresAt - this.refreshThresholdMs;
  }

  /**
   * Check if user is currently authenticated
   * @returns true if tokens exist and are not expired
   */
  isAuthenticated(): boolean {
    const tokens = this.storage.get();
    return tokens !== null && !this.isTokenExpired(tokens);
  }

  /**
   * Get time until token expires (in milliseconds)
   * @returns Milliseconds until expiry, or 0 if expired/no token
   */
  getTimeUntilExpiry(): number {
    const tokens = this.storage.get();

    if (!tokens) {
      return 0;
    }

    const now = Date.now();
    const timeUntilExpiry = tokens.expiresAt - now;
    return Math.max(0, timeUntilExpiry);
  }

  /**
   * Refresh the access token using refresh_token
   * Implements singleton pattern to prevent multiple concurrent refresh requests
   * @returns New access token or null if refresh failed
   */
  async refreshAccessToken(): Promise<string | null> {
    // Return existing refresh promise if one is in progress
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const tokens = this.storage.get();

    // Cannot refresh without refresh_token
    if (!tokens || !tokens.refreshToken) {
      this.notifyTokenExpired();
      this.clearTokens();
      return null;
    }

    // Create new refresh promise
    this.refreshPromise = this.performRefresh(tokens.refreshToken);

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Get the OAuth client ID from environment
   * Can be overridden for testing
   */
  protected getClientId(): string | undefined {
    return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  }

  /**
   * Get the OAuth client secret from environment (optional, for confidential clients)
   */
  protected getClientSecret(): string | undefined {
    return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
  }

  /**
   * Perform the actual token refresh API call
   * This method should be called through refreshAccessToken() to prevent duplicates
   */
  private async performRefresh(refreshToken: string): Promise<string | null> {
    try {
      // Get OAuth configuration
      const clientId = this.getClientId();
      const clientSecret = this.getClientSecret();

      if (!clientId) {
        console.error('[TokenManager] Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID');
        this.clearTokens();
        return null;
      }

      const tokenEndpoint = 'https://oauth2.googleapis.com/token';

      const params = new URLSearchParams({
        client_id: clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      // Include client_secret if available (for confidential clients)
      // For public clients (PKCE), client_secret is not required
      if (clientSecret) {
        params.append('client_secret', clientSecret);
      }

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[TokenManager] Token refresh failed:', {
          status: response.status,
          error: errorData,
        });

        // If refresh token is invalid, clear all tokens
        if (response.status === 400 || response.status === 401) {
          this.clearTokens();
          this.notifyTokenExpired();
        }

        return null;
      }

      const tokenData = await response.json();

      // Store new tokens (refresh_token may not be returned, keep existing)
      const newTokens: OAuthTokens = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? refreshToken, // Keep existing refresh_token
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
      };

      this.setTokens(newTokens);

      return newTokens.access_token;
    } catch (error) {
      console.error('[TokenManager] Token refresh error:', error);
      return null;
    }
  }

  /**
   * Register a callback for token expiry events
   * @param callback - Function to call when token expires
   * @returns Unsubscribe function
   */
  onTokenExpired(callback: TokenExpiredCallback): () => void {
    this.expiredCallbacks.add(callback);
    return () => {
      this.expiredCallbacks.delete(callback);
    };
  }

  /**
   * Register a callback for auth state change events
   * @param callback - Function to call when auth state changes
   * @returns Unsubscribe function
   */
  onAuthStateChange(callback: AuthStateChangeCallback): () => void {
    this.authStateCallbacks.add(callback);
    return () => {
      this.authStateCallbacks.delete(callback);
    };
  }

  /**
   * Notify all registered callbacks about token expiry
   */
  private notifyTokenExpired(): void {
    this.expiredCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('[TokenManager] Error in token expired callback:', error);
      }
    });
  }

  /**
   * Notify all registered callbacks about auth state change
   */
  private notifyAuthStateChange(isAuthenticated: boolean): void {
    this.authStateCallbacks.forEach((callback) => {
      try {
        callback(isAuthenticated);
      } catch (error) {
        console.error('[TokenManager] Error in auth state callback:', error);
      }
    });
  }

  /**
   * Schedule a proactive token refresh before expiry
   * @param expiresAt - Token expiry timestamp
   */
  private scheduleProactiveRefresh(expiresAt: number): void {
    if (typeof window === 'undefined') {
      return;
    }

    const now = Date.now();
    const timeUntilRefresh = expiresAt - now - this.refreshThresholdMs;

    if (timeUntilRefresh <= 0) {
      // Token already needs refresh
      return;
    }

    // Set timeout to refresh token before it expires
    // Use setTimeout with a maximum delay to avoid overflow
    const maxDelay = 2147483647; // ~24.8 days (max signed 32-bit integer)
    const delay = Math.min(timeUntilRefresh, maxDelay);

    setTimeout(() => {
      const tokens = this.storage.get();
      if (tokens && this.isTokenExpired(tokens)) {
        this.refreshAccessToken().catch((error) => {
          console.error('[TokenManager] Proactive refresh failed:', error);
        });
      }
    }, delay);
  }

  /**
   * Get the refresh token (for internal use only)
   * @returns Refresh token or null
   */
  getRefreshToken(): string | null {
    const tokens = this.storage.get();
    return tokens?.refreshToken ?? null;
  }

  /**
   * Check if refresh token is available
   * @returns true if refresh token exists
   */
  hasRefreshToken(): boolean {
    const tokens = this.storage.get();
    return tokens?.refreshToken != null;
  }
}

// ============================================
// Singleton instance
// ============================================

/**
 * Singleton instance of TokenManager
 * Use this instance throughout the application
 */
export const tokenManager = new TokenManager();

// Export default for convenience
export default tokenManager;
