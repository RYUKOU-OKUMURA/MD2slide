'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tokenManager } from '@/lib/auth/tokenManager';
import { exchangeCodeForToken, validateState, OAuthConfig } from '@/lib/auth/googleAuth';

/** Storage keys for PKCE flow */
const PKCE_VERIFIER_KEY = 'md2slide_pkce_verifier';
const OAUTH_STATE_KEY = 'md2slide_oauth_state';
const USER_INFO_KEY = 'md2slide_user_info';

/**
 * User information from Google
 */
interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * OAuth Callback Page
 *
 * Handles the redirect from Google OAuth:
 * 1. Extracts authorization code and state from URL
 * 2. Validates state for CSRF protection
 * 3. Exchanges code for tokens
 * 4. Fetches user info
 * 5. Redirects to home on success
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Processing OAuth callback...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');

        // Check for OAuth errors
        if (errorParam) {
          throw new Error(`OAuth error: ${errorDescription || errorParam}`);
        }

        // Validate required parameters
        if (!code || !state) {
          throw new Error('Missing authorization code or state');
        }

        setStatus('Validating authentication...');

        // Get stored PKCE data
        const storedVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
        const storedState = sessionStorage.getItem(OAUTH_STATE_KEY);

        if (!storedVerifier || !storedState) {
          throw new Error('OAuth session expired. Please try again.');
        }

        // Validate state for CSRF protection
        if (!validateState(state, storedState)) {
          throw new Error('Invalid state parameter. Possible CSRF attack.');
        }

        setStatus('Exchanging authorization code...');

        // Get OAuth config
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) {
          throw new Error('Google Client ID is not configured');
        }

        const config: OAuthConfig = {
          clientId,
          redirectUri: `${window.location.origin}/auth/callback`,
        };

        // Exchange code for tokens
        const tokenResponse = await exchangeCodeForToken({
          code,
          codeVerifier: storedVerifier,
          config,
        });

        setStatus('Storing authentication data...');

        // Store tokens using tokenManager
        tokenManager.setTokens({
          access_token: tokenResponse.access_token,
          refresh_token: tokenResponse.refresh_token,
          expires_in: tokenResponse.expires_in,
          token_type: tokenResponse.token_type,
          scope: tokenResponse.scope,
        });

        setStatus('Fetching user information...');

        // Fetch user info
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });

        if (!userResponse.ok) {
          throw new Error('Failed to fetch user information');
        }

        const userData = await userResponse.json();

        // Store user info
        const user: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
        };
        sessionStorage.setItem(USER_INFO_KEY, JSON.stringify(user));

        // Clear PKCE data (no longer needed)
        sessionStorage.removeItem(PKCE_VERIFIER_KEY);
        sessionStorage.removeItem(OAUTH_STATE_KEY);

        setStatus('Authentication successful! Redirecting...');

        // Redirect to home page
        setTimeout(() => {
          router.push('/');
        }, 500);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        console.error('[AuthCallback] Error:', message);
        setError(message);

        // Clear any stored OAuth data on error
        sessionStorage.removeItem(PKCE_VERIFIER_KEY);
        sessionStorage.removeItem(OAUTH_STATE_KEY);
      }
    };

    handleCallback();
  }, [router]);

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-md">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-lg font-semibold">Authentication Failed</h2>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin h-10 w-10 border-4 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-4" />
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}
