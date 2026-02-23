/**
 * Google OAuth 2.0 PKCE Flow Implementation
 *
 * This module implements the PKCE (Proof Key for Code Exchange) flow for Google OAuth.
 * PKCE provides enhanced security for public clients (like browser-based apps) by
 * preventing authorization code interception attacks.
 *
 * Reference: RFC 7636 - Proof Key for Code Exchange by OAuth Public Clients
 */

// ============================================================================
// Types
// ============================================================================

/**
 * OAuth configuration parameters
 */
export interface OAuthConfig {
  /** Google OAuth client ID */
  clientId: string;
  /** Redirect URI registered in Google Cloud Console */
  redirectUri: string;
}

/**
 * OAuth token response from Google's token endpoint
 */
export interface TokenResponse {
  /** Access token for API calls */
  access_token: string;
  /** Refresh token for obtaining new access tokens (only returned on first authorization) */
  refresh_token?: string;
  /** Time until token expiration in seconds */
  expires_in: number;
  /** Token type (always "Bearer" for Google) */
  token_type: string;
  /** Space-separated list of granted scopes */
  scope?: string;
}

/**
 * Parameters for starting the OAuth flow
 */
export interface OAuthFlowParams {
  config: OAuthConfig;
  /** Additional state to pass through the OAuth flow */
  additionalState?: Record<string, string>;
}

/**
 * Result of OAuth flow initiation
 */
export interface OAuthFlowResult {
  /** Authorization URL to redirect the user to */
  authorizationUrl: string;
  /** PKCE code verifier (store this securely for token exchange) */
  codeVerifier: string;
  /** State parameter for CSRF protection */
  state: string;
}

/**
 * Parameters for token exchange
 */
export interface TokenExchangeParams {
  /** Authorization code received from Google */
  code: string;
  /** PKCE code verifier (same one used to generate the challenge) */
  codeVerifier: string;
  /** OAuth configuration */
  config: OAuthConfig;
}

// ============================================================================
// Constants
// ============================================================================

/** Google OAuth 2.0 authorization endpoint */
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** Google OAuth 2.0 token endpoint */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** OAuth scope for Drive file access (minimal permission) */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** PKCE code verifier length (recommended: 128 characters) */
const CODE_VERIFIER_LENGTH = 128;

/** State parameter length */
const STATE_LENGTH = 32;

// ============================================================================
// PKCE Utilities
// ============================================================================

/**
 * Generates a cryptographically random code verifier string.
 *
 * The code verifier is a random string using the unreserved characters:
 * [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 *
 * Length: 128 characters (recommended for maximum security)
 *
 * @returns A random 128-character code verifier string
 */
export function generateCodeVerifier(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(CODE_VERIFIER_LENGTH);

  // Use Web Crypto API for cryptographically secure random values
  crypto.getRandomValues(randomValues);

  let verifier = '';
  for (let i = 0; i < CODE_VERIFIER_LENGTH; i++) {
    verifier += charset[randomValues[i] % charset.length];
  }

  return verifier;
}

/**
 * Generates a code challenge from a code verifier using SHA-256 and base64url encoding.
 *
 * code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
 *
 * @param verifier - The code verifier string
 * @returns A base64url-encoded SHA-256 hash of the verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  // Encode the verifier as UTF-8
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);

  // Hash with SHA-256 using Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert to base64url encoding (RFC 7636)
  return base64UrlEncode(hashBuffer);
}

/**
 * Generates a random state string for CSRF protection.
 *
 * The state parameter is used to maintain state between the authorization
 * request and callback, and to prevent CSRF attacks.
 *
 * @returns A random 32-character state string
 */
export function generateState(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(STATE_LENGTH);

  crypto.getRandomValues(randomValues);

  let state = '';
  for (let i = 0; i < STATE_LENGTH; i++) {
    state += charset[randomValues[i] % charset.length];
  }

  return state;
}

// ============================================================================
// OAuth Flow Functions
// ============================================================================

/**
 * Builds the Google OAuth authorization URL with PKCE parameters.
 *
 * This URL should be used to redirect the user to Google's consent screen.
 *
 * Required parameters:
 * - client_id: Your Google OAuth client ID
 * - redirect_uri: Must match one registered in Google Cloud Console
 * - response_type: "code" for authorization code flow
 * - scope: "drive.file" for minimal Drive access
 * - code_challenge: SHA-256 hash of code_verifier, base64url-encoded
 * - code_challenge_method: "S256" for SHA-256
 * - state: Random string for CSRF protection
 *
 * @param config - OAuth configuration (clientId and redirectUri)
 * @param codeChallenge - The PKCE code challenge
 * @param state - The state parameter for CSRF protection
 * @returns The complete authorization URL
 */
export function getAuthorizationUrl(
  config: OAuthConfig,
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: DRIVE_FILE_SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state,
    // Request refresh token and consent for offline access
    access_type: 'offline',
    // Force consent screen to ensure refresh token is returned
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Initiates the OAuth flow by generating all required parameters.
 *
 * This function:
 * 1. Generates a code verifier
 * 2. Derives the code challenge from the verifier
 * 3. Generates a state parameter
 * 4. Builds the authorization URL
 *
 * Usage:
 * ```ts
 * const { authorizationUrl, codeVerifier, state } = await initiateOAuthFlow({
 *   config: { clientId: '...', redirectUri: '...' }
 * });
 *
 * // Store codeVerifier and state securely (e.g., sessionStorage)
 * sessionStorage.setItem('pkce_verifier', codeVerifier);
 * sessionStorage.setItem('oauth_state', state);
 *
 * // Redirect user to Google
 * window.location.href = authorizationUrl;
 * ```
 *
 * @param params - OAuth flow parameters
 * @returns Authorization URL and PKCE parameters
 */
export async function initiateOAuthFlow(params: OAuthFlowParams): Promise<OAuthFlowResult> {
  const { config, additionalState } = params;

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Build authorization URL
  let authorizationUrl = getAuthorizationUrl(config, codeChallenge, state);

  // Add additional state as query parameters if provided
  if (additionalState && Object.keys(additionalState).length > 0) {
    // Encode additional state in the state parameter as JSON
    const statePayload = JSON.stringify({
      csrf: state,
      ...additionalState,
    });
    const encodedState = base64UrlEncode(new TextEncoder().encode(statePayload).buffer);

    // Rebuild URL with encoded state
    const url = new URL(authorizationUrl);
    url.searchParams.set('state', encodedState);
    authorizationUrl = url.toString();
  }

  return {
    authorizationUrl,
    codeVerifier,
    state,
  };
}

/**
 * Exchanges an authorization code for access and refresh tokens.
 *
 * This function completes the OAuth flow by exchanging the authorization code
 * received from Google's callback for tokens.
 *
 * Token Request:
 * - code: The authorization code from the callback
 * - client_id: Your Google OAuth client ID
 * - redirect_uri: Must match the one used in authorization
 * - code_verifier: The original PKCE code verifier
 * - grant_type: "authorization_code"
 *
 * @param params - Token exchange parameters
 * @returns Token response containing access_token, refresh_token, etc.
 * @throws Error if the token exchange fails
 */
export async function exchangeCodeForToken(params: TokenExchangeParams): Promise<TokenResponse> {
  const { code, codeVerifier, config } = params;

  const tokenRequest = {
    code,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
  };

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(tokenRequest).toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error_description || errorData.error || 'Token exchange failed';
    throw new Error(`OAuth token exchange failed: ${errorMessage}`);
  }

  return response.json();
}

/**
 * Refreshes an access token using a refresh token.
 *
 * @param refreshToken - The refresh token stored from a previous authorization
 * @param config - OAuth configuration
 * @returns New token response with fresh access_token
 * @throws Error if the refresh fails
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: OAuthConfig
): Promise<TokenResponse> {
  const tokenRequest = {
    refresh_token: refreshToken,
    client_id: config.clientId,
    grant_type: 'refresh_token',
  };

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(tokenRequest).toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error_description || errorData.error || 'Token refresh failed';
    throw new Error(`OAuth token refresh failed: ${errorMessage}`);
  }

  return response.json();
}

/**
 * Validates the OAuth callback state parameter.
 *
 * Compares the state returned from Google with the one stored at flow initiation
 * to prevent CSRF attacks.
 *
 * @param returnedState - State parameter from the OAuth callback
 * @param storedState - State stored when initiating the OAuth flow
 * @returns true if the states match, false otherwise
 */
export function validateState(returnedState: string, storedState: string): boolean {
  // Use timing-safe comparison to prevent timing attacks
  if (returnedState.length !== storedState.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < returnedState.length; i++) {
    result |= returnedState.charCodeAt(i) ^ storedState.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Parses the OAuth callback URL and extracts the authorization code and state.
 *
 * @param callbackUrl - The full callback URL from Google
 * @returns Object containing code and state, or error if present
 */
export function parseCallbackUrl(callbackUrl: string): {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
} {
  const url = new URL(callbackUrl);
  const params = url.searchParams;

  const error = params.get('error');
  if (error) {
    return {
      error,
      errorDescription: params.get('error_description') || undefined,
    };
  }

  return {
    code: params.get('code') || undefined,
    state: params.get('state') || undefined,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Encodes an ArrayBuffer to base64url format (RFC 4648).
 *
 * Base64url is similar to base64 but uses:
 * - '-' instead of '+'
 * - '_' instead of '/'
 * - No padding with '='
 *
 * @param buffer - The ArrayBuffer to encode
 * @returns Base64url-encoded string
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  // Convert to base64, then make it URL-safe
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // Remove padding
}
