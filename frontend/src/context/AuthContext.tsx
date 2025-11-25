import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, AuthUser } from '../types';
import {
  loginUser,
  registerUser,
  setAuthToken,
  setUnauthorizedHandler,
} from '../services/api';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  expiresAt: number | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'pws.auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeExpiry(token: string): number | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) {
      return null;
    }
    const payload = JSON.parse(atob(payloadPart));
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}

function loadInitialState(): AuthState {
  const emptyState: AuthState = { user: null, token: null, expiresAt: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState;
    }
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed.token || !parsed.user) {
      return emptyState;
    }
    if (parsed.expiresAt && parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return emptyState;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return emptyState;
  }
}

function persistState(state: AuthState) {
  if (!state.token || !state.user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => loadInitialState());
  const [loading, setLoading] = useState(false);

  const clearAuth = useCallback(() => {
    setState({ user: null, token: null, expiresAt: null });
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
  }, []);

  useEffect(() => {
    setAuthToken(state.token);
  }, [state.token]);

  useEffect(() => {
    setUnauthorizedHandler(() => clearAuth);
    return () => setUnauthorizedHandler(null);
  }, [clearAuth]);

  useEffect(() => {
    if (!state.token || !state.expiresAt) {
      return;
    }
    const remaining = state.expiresAt - Date.now();
    if (remaining <= 0) {
      clearAuth();
      return;
    }
    const timeout = window.setTimeout(clearAuth, remaining);
    return () => window.clearTimeout(timeout);
  }, [state.token, state.expiresAt, clearAuth]);

  const applyAuthResponse = useCallback((auth: AuthResponse) => {
    const expiresAt = decodeExpiry(auth.token);
    const nextState: AuthState = {
      user: auth.user,
      token: auth.token,
      expiresAt,
    };
    setState(nextState);
    persistState(nextState);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const auth = await loginUser(email, password);
        applyAuthResponse(auth);
      } finally {
        setLoading(false);
      }
    },
    [applyAuthResponse],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setLoading(true);
      try {
        const auth = await registerUser(email, password, displayName);
        applyAuthResponse(auth);
      } finally {
        setLoading(false);
      }
    },
    [applyAuthResponse],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      token: state.token,
      isAuthenticated: Boolean(state.user && state.token),
      loading,
      login,
      register,
      logout: clearAuth,
    }),
    [state.user, state.token, loading, login, register, clearAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  }
  return context;
}
