import { useState, useCallback, useEffect } from 'react';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: 'us-east-1',
});

const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;

const AUTH_STORAGE_KEY = 'admin-auth';

interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const tokens: AuthTokens = JSON.parse(stored);
        if (tokens.expiresAt > Date.now()) {
          setState({ isAuthenticated: true, isLoading: false, error: null });
          return;
        }
      } catch {
        // Invalid stored data, clear it
      }
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    }
    setState({ isAuthenticated: false, isLoading: false, error: null });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await cognitoClient.send(command);
      const result = response.AuthenticationResult;

      if (!result?.AccessToken || !result?.IdToken) {
        throw new Error('Authentication failed');
      }

      const tokens: AuthTokens = {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        refreshToken: result.RefreshToken || '',
        expiresAt: Date.now() + (result.ExpiresIn || 3600) * 1000,
      };

      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
      setState({ isAuthenticated: true, isLoading: false, error: null });
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'NotAuthorizedException'
          ? 'Invalid email or password'
          : 'Authentication failed. Please try again.';
      setState({ isAuthenticated: false, isLoading: false, error: message });
    }
  }, []);

  const logout = useCallback(async () => {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const tokens: AuthTokens = JSON.parse(stored);
        await cognitoClient.send(
          new GlobalSignOutCommand({ AccessToken: tokens.accessToken })
        );
      } catch {
        // Sign out locally even if remote sign out fails
      }
    }
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setState({ isAuthenticated: false, isLoading: false, error: null });
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    try {
      const tokens: AuthTokens = JSON.parse(stored);
      if (!tokens.refreshToken) return null;

      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: tokens.refreshToken,
        },
      });

      const response = await cognitoClient.send(command);
      const result = response.AuthenticationResult;

      if (!result?.AccessToken || !result?.IdToken) return null;

      const newTokens: AuthTokens = {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + (result.ExpiresIn || 3600) * 1000,
      };

      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newTokens));
      setState({ isAuthenticated: true, isLoading: false, error: null });
      return newTokens.accessToken;
    } catch {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      setState({ isAuthenticated: false, isLoading: false, error: null });
      return null;
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const stored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    try {
      const tokens: AuthTokens = JSON.parse(stored);
      // Proactively refresh if within 5 minutes of expiry
      if (tokens.expiresAt <= Date.now() + 5 * 60 * 1000) {
        return await refreshSession();
      }
      return tokens.accessToken;
    } catch {
      return null;
    }
  }, [refreshSession]);

  return {
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    login,
    logout,
    getAccessToken,
  };
}
