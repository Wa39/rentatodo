import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { setAccessToken } from '@/data/api/http';
import { authService } from '@/data/auth/auth-service';
import { clearStoredToken, getStoredToken, storeToken } from '@/data/auth/token-store';
import type { User } from '@/data/types';

/**
 * Session state for the whole app. On startup it restores the stored token
 * and fetches the profile; the (tabs) layout redirects to /login while
 * signed out. Token lifetime is 24h with no refresh (contract), so an
 * invalid/expired token simply signs the user out.
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
      } catch {
        setAccessToken(null);
        await clearStoredToken();
        setStatus('signed_out');
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
