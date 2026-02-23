'use client';

import { useCallback, useEffect, useState } from 'react';
import { tokenManager } from '@/lib/auth/tokenManager';
import { initiateOAuthFlow, OAuthConfig } from '@/lib/auth/googleAuth';

/**
 * User information from Google
 */
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Authentication state and actions
 */
export interface UseAuthReturn {
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;
  /** Whether initial auth check is in progress */
  isLoading: boolean;
  /** Current user info (null if not authenticated) */
  user: User | null;
  /** Initiate Google OAuth login flow */
  login: () => Promise<void>;
  /** Clear tokens and log out */
  logout: () => void;
  /** Current error message (null if no error) */
  error: string | null;
  /** Clear current error */
  clearError: () => void;
  /** Get the current access token (auto-refreshes if expired) */
  getAccessToken: () => Promise<string | null>;
}

/** Storage key for user info */
const USER_INFO_KEY = 'md2slide_user_info';

/** Storage keys for PKCE flow */
const PKCE_VERIFIER_KEY = 'md2slide_pkce_verifier';
const OAUTH_STATE_KEY = 'md2slide_oauth_state';

/**
 * Get OAuth configuration from environment
 */
function getOAuthConfig(): OAuthConfig {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri =
    typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';

  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured');
  }

  return {
    clientId,
    redirectUri,
  };
}

/**
 * Fetch user info from Google API
 */
async function fetchUserInfo(accessToken: string): Promise<User> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  const data = await response.json();
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

/**
 * Get stored user info from sessionStorage
 */
function getStoredUser(): User | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const data = sessionStorage.getItem(USER_INFO_KEY);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as User;
  } catch {
    return null;
  }
}

/**
 * Store user info in sessionStorage
 */
function storeUser(user: User): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
}

/**
 * Clear stored user info
 */
function clearStoredUser(): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(USER_INFO_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
}

/**
 * Custom hook for authentication management
 *
 * Provides:
 * - Authentication state (isAuthenticated, isLoading, user)
 * - Login/logout actions
 * - Error handling
 * - Auto token refresh
 *
 * @example
 * ```tsx
 * const { isAuthenticated, user, login, logout, error } = useAuth();
 *
 * if (isAuthenticated) {
 *   return <div>Hello, {user?.name}</div>;
 * }
 *
 * return <button onClick={login}>Sign in with Google</button>;
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check authentication state on mount and sync with tokenManager
   */
  useEffect(() => {
    const checkAuth = () => {
      const authenticated = tokenManager.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        } else {
          // Fetch user info if not stored
          tokenManager.getAccessToken().then(async (token) => {
            if (token) {
              try {
                const userInfo = await fetchUserInfo(token);
                setUser(userInfo);
                storeUser(userInfo);
              } catch (err) {
                console.error('[useAuth] Failed to fetch user info:', err);
              }
            }
          });
        }
      } else {
        setUser(null);
      }

      setIsLoading(false);
    };

    // Initial check
    checkAuth();

    // Subscribe to auth state changes
    const unsubscribe = tokenManager.onAuthStateChange((authenticated) => {
      setIsAuthenticated(authenticated);
      if (!authenticated) {
        setUser(null);
        clearStoredUser();
      }
    });

    return unsubscribe;
  }, []);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Initiate Google OAuth login flow
   */
  const login = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const config = getOAuthConfig();
      const { authorizationUrl, codeVerifier, state } = await initiateOAuthFlow({
        config,
      });

      // Store PKCE verifier and state for callback
      sessionStorage.setItem(PKCE_VERIFIER_KEY, codeVerifier);
      sessionStorage.setItem(OAUTH_STATE_KEY, state);

      // Redirect to Google OAuth
      window.location.href = authorizationUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setIsLoading(false);
    }
  }, []);

  /**
   * Log out and clear all auth data
   */
  const logout = useCallback(() => {
    tokenManager.clearTokens();
    clearStoredUser();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  }, []);

  /**
   * Get current access token (with auto-refresh)
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return tokenManager.getAccessToken();
  }, []);

  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    error,
    clearError,
    getAccessToken,
  };
}

export default useAuth;
