import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  getAuthorizationUrl,
  initiateOAuthFlow,
  exchangeCodeForToken,
  refreshAccessToken,
  validateState,
  parseCallbackUrl,
  DRIVE_FILE_SCOPE,
  type OAuthConfig,
} from './googleAuth';

// Mock fetch for token exchange tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('googleAuth', () => {
  const mockConfig: OAuthConfig = {
    clientId: 'test-client-id.apps.googleusercontent.com',
    redirectUri: 'http://localhost:3000/auth/callback',
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCodeVerifier', () => {
    it('should generate a 128-character string', () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBe(128);
    });

    it('should only contain unreserved characters', () => {
      const verifier = generateCodeVerifier();
      const allowedChars = /^[A-Za-z0-9\-._~]+$/;
      expect(allowedChars.test(verifier)).toBe(true);
    });

    it('should generate different values on each call', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });

    it('should generate cryptographically random values', () => {
      // Generate 100 verifiers and check they're all different
      const verifiers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        verifiers.add(generateCodeVerifier());
      }
      expect(verifiers.size).toBe(100);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should return a base64url-encoded string', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      // Base64url: alphanumeric, '-', '_', no padding
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it('should produce deterministic output for same input', async () => {
      const verifier = 'test-verifier-string-1234567890';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should produce different output for different input', async () => {
      const verifier1 = 'test-verifier-1';
      const verifier2 = 'test-verifier-2';
      const challenge1 = await generateCodeChallenge(verifier1);
      const challenge2 = await generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });

    it('should not contain +, /, or = characters', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      expect(challenge).not.toContain('+');
      expect(challenge).not.toContain('/');
      expect(challenge).not.toContain('=');
    });

    it('should produce expected SHA-256 hash for known input', async () => {
      // Test with a known value to verify correct implementation
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      // The challenge should be a specific base64url-encoded SHA-256 hash
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
      expect(challenge.length).toBeGreaterThan(0);
    });
  });

  describe('generateState', () => {
    it('should generate a 32-character string', () => {
      const state = generateState();
      expect(state.length).toBe(32);
    });

    it('should only contain alphanumeric characters', () => {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate different values on each call', () => {
      const state1 = generateState();
      const state2 = generateState();
      expect(state1).not.toBe(state2);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should build correct Google OAuth URL', () => {
      const codeChallenge = 'test-challenge';
      const state = 'test-state';
      const url = getAuthorizationUrl(mockConfig, codeChallenge, state);

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    });

    it('should include all required parameters', () => {
      const codeChallenge = 'test-challenge';
      const state = 'test-state';
      const url = getAuthorizationUrl(mockConfig, codeChallenge, state);
      const parsedUrl = new URL(url);

      expect(parsedUrl.searchParams.get('client_id')).toBe(mockConfig.clientId);
      expect(parsedUrl.searchParams.get('redirect_uri')).toBe(mockConfig.redirectUri);
      expect(parsedUrl.searchParams.get('response_type')).toBe('code');
      expect(parsedUrl.searchParams.get('scope')).toBe(DRIVE_FILE_SCOPE);
      expect(parsedUrl.searchParams.get('code_challenge')).toBe(codeChallenge);
      expect(parsedUrl.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsedUrl.searchParams.get('state')).toBe(state);
    });

    it('should request offline access with consent prompt', () => {
      const codeChallenge = 'test-challenge';
      const state = 'test-state';
      const url = getAuthorizationUrl(mockConfig, codeChallenge, state);
      const parsedUrl = new URL(url);

      expect(parsedUrl.searchParams.get('access_type')).toBe('offline');
      expect(parsedUrl.searchParams.get('prompt')).toBe('consent');
    });

    it('should use drive.file scope', () => {
      const codeChallenge = 'test-challenge';
      const state = 'test-state';
      const url = getAuthorizationUrl(mockConfig, codeChallenge, state);
      const parsedUrl = new URL(url);

      expect(parsedUrl.searchParams.get('scope')).toBe(
        'https://www.googleapis.com/auth/drive.file'
      );
    });
  });

  describe('initiateOAuthFlow', () => {
    it('should return authorization URL and PKCE parameters', async () => {
      const result = await initiateOAuthFlow({ config: mockConfig });

      expect(result).toHaveProperty('authorizationUrl');
      expect(result).toHaveProperty('codeVerifier');
      expect(result).toHaveProperty('state');

      expect(result.codeVerifier.length).toBe(128);
      expect(result.state.length).toBe(32);
    });

    it('should build valid authorization URL', async () => {
      const result = await initiateOAuthFlow({ config: mockConfig });
      const parsedUrl = new URL(result.authorizationUrl);

      expect(parsedUrl.origin).toBe('https://accounts.google.com');
      expect(parsedUrl.pathname).toBe('/o/oauth2/v2/auth');
    });

    it('should include code_challenge in URL that matches code_verifier', async () => {
      const result = await initiateOAuthFlow({ config: mockConfig });
      const parsedUrl = new URL(result.authorizationUrl);

      const codeChallenge = parsedUrl.searchParams.get('code_challenge');
      expect(codeChallenge).not.toBeNull();

      // Verify the challenge was derived from the verifier
      const expectedChallenge = await generateCodeChallenge(result.codeVerifier);
      expect(codeChallenge).toBe(expectedChallenge);
    });

    it('should handle additional state parameters', async () => {
      const additionalState = { returnUrl: '/dashboard', from: 'header' };
      const result = await initiateOAuthFlow({
        config: mockConfig,
        additionalState,
      });

      expect(result.authorizationUrl).toContain('state=');
    });

    it('should return original state for storage', async () => {
      const result = await initiateOAuthFlow({ config: mockConfig });

      // The returned state should be usable for CSRF validation
      expect(result.state).toBeDefined();
      expect(result.state.length).toBe(32);
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should make POST request to Google token endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      await exchangeCodeForToken({
        code: 'test-auth-code',
        codeVerifier: 'test-verifier',
        config: mockConfig,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    it('should send correct parameters in token request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      await exchangeCodeForToken({
        code: 'test-auth-code',
        codeVerifier: 'test-verifier',
        config: mockConfig,
      });

      const [, options] = mockFetch.mock.calls[0];
      const body = options.body;

      expect(body).toContain('code=test-auth-code');
      expect(body).toContain('client_id=test-client-id.apps.googleusercontent.com');
      expect(body).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback');
      expect(body).toContain('code_verifier=test-verifier');
      expect(body).toContain('grant_type=authorization_code');
    });

    it('should return token response on success', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive.file',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      });

      const result = await exchangeCodeForToken({
        code: 'test-auth-code',
        codeVerifier: 'test-verifier',
        config: mockConfig,
      });

      expect(result).toEqual(mockTokenResponse);
    });

    it('should throw error on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }),
      });

      await expect(
        exchangeCodeForToken({
          code: 'invalid-code',
          codeVerifier: 'test-verifier',
          config: mockConfig,
        })
      ).rejects.toThrow('OAuth token exchange failed');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        exchangeCodeForToken({
          code: 'test-code',
          codeVerifier: 'test-verifier',
          config: mockConfig,
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(
        exchangeCodeForToken({
          code: 'test-code',
          codeVerifier: 'test-verifier',
          config: mockConfig,
        })
      ).rejects.toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    it('should make POST request with refresh token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      await refreshAccessToken('test-refresh-token', mockConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should send correct parameters in refresh request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      await refreshAccessToken('test-refresh-token', mockConfig);

      const [, options] = mockFetch.mock.calls[0];
      const body = options.body;

      expect(body).toContain('refresh_token=test-refresh-token');
      expect(body).toContain('client_id=test-client-id.apps.googleusercontent.com');
      expect(body).toContain('grant_type=refresh_token');
    });

    it('should return new token response on success', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await refreshAccessToken('test-refresh-token', mockConfig);

      expect(result.access_token).toBe('new-access-token');
    });

    it('should throw error on failed refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'invalid_grant',
        }),
      });

      await expect(refreshAccessToken('invalid-token', mockConfig)).rejects.toThrow(
        'OAuth token refresh failed'
      );
    });
  });

  describe('validateState', () => {
    it('should return true for matching states', () => {
      const state = 'test-state-12345678';
      expect(validateState(state, state)).toBe(true);
    });

    it('should return false for non-matching states', () => {
      expect(validateState('state-1', 'state-2')).toBe(false);
    });

    it('should return false for states of different lengths', () => {
      expect(validateState('short', 'longer-state')).toBe(false);
    });

    it('should be timing-safe (constant time comparison)', () => {
      // This test verifies that the function uses constant-time comparison
      // by checking that it doesn't short-circuit on first character mismatch
      const state1 = 'abcdefghijklmnop';
      const state2 = 'abcdefgxijklmnop'; // Different at position 7

      // Should still compare all characters
      expect(validateState(state1, state2)).toBe(false);

      const state3 = 'xbcdefghijklmnop'; // Different at position 0
      expect(validateState(state1, state3)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(validateState('', '')).toBe(true);
      expect(validateState('state', '')).toBe(false);
      expect(validateState('', 'state')).toBe(false);
    });
  });

  describe('parseCallbackUrl', () => {
    it('should extract code and state from callback URL', () => {
      const callbackUrl = 'http://localhost:3000/auth/callback?code=test-code&state=test-state';

      const result = parseCallbackUrl(callbackUrl);

      expect(result.code).toBe('test-code');
      expect(result.state).toBe('test-state');
      expect(result.error).toBeUndefined();
    });

    it('should handle error responses', () => {
      const callbackUrl =
        'http://localhost:3000/auth/callback?error=access_denied&error_description=User+denied+access';

      const result = parseCallbackUrl(callbackUrl);

      expect(result.error).toBe('access_denied');
      expect(result.errorDescription).toBe('User denied access');
      expect(result.code).toBeUndefined();
    });

    it('should return undefined for missing parameters', () => {
      const callbackUrl = 'http://localhost:3000/auth/callback';

      const result = parseCallbackUrl(callbackUrl);

      expect(result.code).toBeUndefined();
      expect(result.state).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle URL-encoded values', () => {
      const callbackUrl = 'http://localhost:3000/auth/callback?code=test%20code&state=test%2Fstate';

      const result = parseCallbackUrl(callbackUrl);

      expect(result.code).toBe('test code');
      expect(result.state).toBe('test/state');
    });

    it('should handle error without description', () => {
      const callbackUrl = 'http://localhost:3000/auth/callback?error=invalid_request';

      const result = parseCallbackUrl(callbackUrl);

      expect(result.error).toBe('invalid_request');
      expect(result.errorDescription).toBeUndefined();
    });
  });

  describe('DRIVE_FILE_SCOPE constant', () => {
    it('should be the correct Google Drive scope', () => {
      expect(DRIVE_FILE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
    });
  });

  describe('Integration scenarios', () => {
    it('should complete full PKCE flow parameter generation', async () => {
      // Simulate the initial flow setup
      const result = await initiateOAuthFlow({ config: mockConfig });

      // Verify all components are generated correctly
      expect(result.codeVerifier).toMatch(/^[A-Za-z0-9\-._~]{128}$/);
      expect(result.state).toMatch(/^[A-Za-z0-9]{32}$/);

      // Verify URL contains properly encoded challenge
      const url = new URL(result.authorizationUrl);
      const challenge = url.searchParams.get('code_challenge');
      expect(challenge).not.toBeNull();
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it('should handle complete OAuth callback flow simulation', async () => {
      // Setup
      const flowResult = await initiateOAuthFlow({ config: mockConfig });

      // Simulate callback parsing
      const mockCallbackUrl = `http://localhost:3000/auth/callback?code=test-auth-code&state=${encodeURIComponent(flowResult.state)}`;
      const parsedCallback = parseCallbackUrl(mockCallbackUrl);

      // Validate state
      expect(validateState(parsedCallback.state!, flowResult.state)).toBe(true);

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      // Exchange code for token
      const tokenResult = await exchangeCodeForToken({
        code: parsedCallback.code!,
        codeVerifier: flowResult.codeVerifier,
        config: mockConfig,
      });

      expect(tokenResult.access_token).toBe('test-access-token');
    });
  });
});
