import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuthStore, type AuthUser } from '@/stores/auth.store';

export interface UserContextValue {
  user: AuthUser | null;
  userId: string | null;
  token: string | null;
  refreshToken: string | null;
  cookieSession: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  logout: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const cookieSession = useAuthStore((state) => state.cookieSession);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const logout = useAuthStore((state) => state.logout);

  const value = useMemo<UserContextValue>(
    () => ({
      user,
      userId: user?.id ?? null,
      token,
      refreshToken,
      cookieSession,
      isAuthenticated: Boolean(user && (token || cookieSession)),
      hasPermission,
      logout,
    }),
    [cookieSession, hasPermission, logout, refreshToken, token, user],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser phải được sử dụng bên trong UserProvider.');
  }
  return context;
}
