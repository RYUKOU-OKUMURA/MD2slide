/**
 * Token Validator
 *
 * Provides utilities for validating and masking OAuth access tokens.
 * Security: Never log full tokens - always use maskToken for logging.
 */

/**
 * Validates the format of an OAuth 2.0 access token
 *
 * Google OAuth 2.0 access tokens are typically JWT-like strings
 * with three base64url-encoded parts separated by dots.
 *
 * @param token - The token to validate
 * @returns True if the token format appears valid
 */
export function validateTokenFormat(token: string): boolean {
  // Basic validation: non-empty string
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Minimum length check (Google tokens are typically 50+ characters)
  if (token.length < 20) {
    return false;
  }

  // Maximum length check (prevent abuse)
  if (token.length > 4096) {
    return false;
  }

  // Check for valid characters (base64url: A-Za-z0-9_- and dots)
  // Google access tokens can be either:
  // 1. JWT format: xxxxx.yyyyy.zzzzz
  // 2. Opaque token: random string
  const validTokenPattern = /^[A-Za-z0-9_.-]+$/;
  if (!validTokenPattern.test(token)) {
    return false;
  }

  return true;
}

/**
 * Masks an access token for safe logging
 *
 * Returns only the first 4 and last 4 characters, with the middle replaced by asterisks.
 * This allows for debugging while preventing token exposure in logs.
 *
 * @param token - The token to mask
 * @returns Masked token safe for logging
 * @example
 * maskToken('ya29.a0AbVbXYZ...1234') // Returns 'ya29...1234'
 */
export function maskToken(token: string): string {
  if (!token || typeof token !== 'string') {
    return '[INVALID_TOKEN]';
  }

  // For very short tokens, just show asterisks
  if (token.length < 12) {
    return '****';
  }

  // Show first 4 and last 4 characters
  const firstPart = token.slice(0, 4);
  const lastPart = token.slice(-4);

  return `${firstPart}...${lastPart}`;
}

/**
 * Validates that a token has not expired
 *
 * Note: This only checks the exp claim if the token is a JWT.
 * For opaque tokens, this returns null (cannot determine expiry).
 *
 * @param token - The token to check
 * @returns True if valid, false if expired, null if cannot determine
 */
export function checkTokenExpiry(token: string): boolean | null {
  try {
    // Check if token looks like a JWT (has 3 parts)
    const parts = token.split('.');
    if (parts.length !== 3) {
      // Not a JWT - cannot determine expiry
      return null;
    }

    // Decode the payload (second part)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));

    // Check expiry
    if (typeof payload.exp !== 'number') {
      return null;
    }

    // exp is in seconds since epoch
    const expiryTime = payload.exp * 1000;
    const now = Date.now();

    return now < expiryTime;
  } catch {
    // Failed to parse - treat as unknown
    return null;
  }
}

/**
 * Extracts scopes from a JWT access token
 *
 * @param token - The token to extract scopes from
 * @returns Array of scopes, or null if cannot determine
 */
export function extractTokenScopes(token: string): string[] | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));

    // Google tokens use 'scope' or 'scp' for scopes
    const scopes = payload.scope ?? payload.scp;

    if (typeof scopes === 'string') {
      return scopes.split(' ').filter((s: string) => s.length > 0);
    }

    if (Array.isArray(scopes)) {
      return scopes;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validates that a token has the required Drive scopes
 *
 * @param token - The token to check
 * @returns True if token has required scopes
 */
export function hasRequiredScopes(token: string): boolean {
  const scopes = extractTokenScopes(token);

  if (!scopes) {
    // Cannot determine scopes - assume valid (API will reject if missing)
    return true;
  }

  // Check for drive.file scope (minimum required for our use case)
  const requiredScopes = [
    'https://www.googleapis.com/auth/drive.file',
    'drive.file', // Short form
  ];

  return scopes.some((scope) => requiredScopes.includes(scope));
}
