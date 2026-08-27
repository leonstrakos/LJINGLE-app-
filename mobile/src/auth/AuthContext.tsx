import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { authApi } from '../services/authApi';
import {
  claimInstallOwner,
  restoreAuthCache,
  setAuthToken,
} from './sessionStore';
import type {
  LjingleRegistration,
  LjingleUser,
} from './types';

type AuthContextValue = {
  user: LjingleUser | null;
  loading: boolean;
  login: (
    login: string,
    password: string,
  ) => Promise<void>;
  register: (
    input: LjingleRegistration,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  );

export function AuthProvider({
  children,
}: PropsWithChildren) {
  const [user, setUser] =
    useState<LjingleUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const stored =
          await restoreAuthCache();

        if (!stored.token) {
          return;
        }

        const current =
          await authApi.me();

        await claimInstallOwner(
          current.id,
        );

        if (!cancelled) {
          setUser(current);
        }
      } catch {
        await setAuthToken(null);

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  const acceptSession =
    useCallback(
      async (
        session: {
          token: string;
          user: LjingleUser;
        },
      ) => {
        try {
          await claimInstallOwner(
            session.user.id,
          );

          await setAuthToken(
            session.token,
          );

          setUser(session.user);
        } catch (error) {
          await authApi
            .logoutToken(session.token)
            .catch(() => undefined);

          throw error;
        }
      },
      [],
    );

  const login =
    useCallback(
      async (
        loginValue: string,
        password: string,
      ) => {
        const session =
          await authApi.login(
            loginValue,
            password,
          );

        await acceptSession(session);
      },
      [acceptSession],
    );

  const register =
    useCallback(
      async (
        input: LjingleRegistration,
      ) => {
        const session =
          await authApi.register(input);

        await acceptSession(session);
      },
      [acceptSession],
    );

  const logout =
    useCallback(async () => {
      try {
        await authApi.logout();
      } catch {
        // Local logout still wins if VPS is unavailable.
      }

      await setAuthToken(null);
      setUser(null);
    }, []);

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        loading,
        login,
        register,
        logout,
      }),
      [
        user,
        loading,
        login,
        register,
        logout,
      ],
    );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error(
      'useAuth must be used inside AuthProvider.',
    );
  }

  return value;
}
