import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiRequestError, setAccessToken, setAuthErrorHandler } from '@/data/api/http';
import { authService } from '@/data/auth/auth-service';
import { clearStoredToken, getStoredToken, storeToken } from '@/data/auth/token-store';
import type { User } from '@/data/types';

/**
 * Session state for the whole app. On startup it restores the stored token
 * and fetches the profile; the (tabs) layout redirects to /login while
 * signed out. Token lifetime is 24h with no refresh (contract), so an
 * invalid/expired token signs the user out — on startup and, via the
 * data layer's auth-error handler, if it expires mid-session too.
 */

type SessionStatus = 'loading' | 'signed_out' | 'signed_in';

type SessionContextValue = {
  status: SessionStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getStoredToken();
        if (!token) {
          setStatus('signed_out');
          return;
        }
        setAccessToken(token);
        setUser(await authService.getProfile());
        setStatus('signed_in');
      } catch (e) {
        // Only a genuine auth rejection (401) invalidates the stored token.
        // A network/server error at startup (offline, server down, timeout)
        // must NOT destroy the token — keep the session and trust the token;
        // a later 401 on a real request signs out via the auth-error handler.
        if (e instanceof ApiRequestError && e.status === 401) {
          setAccessToken(null);
          await clearStoredToken();
          setStatus('signed_out');
        } else {
          setStatus('signed_in');
        }
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await authService.login(email, password);
    setAccessToken(access_token);
    await storeToken(access_token);
    setUser(await authService.getProfile());
    setStatus('signed_in');
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      // The contract's register returns the profile but no token: log in right after.
      await authService.register(name, email, password);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    setAccessToken(null);
    await clearStoredToken();
    setUser(null);
    setStatus('signed_out');
  }, []);

  // A 401 on an authenticated request (token expired mid-session) signs out
  // centrally, so no screen has to handle expiry on its own.
  useEffect(() => {
    setAuthErrorHandler(() => {
      void logout();
    });
    return () => setAuthErrorHandler(null);
  }, [logout]);

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
