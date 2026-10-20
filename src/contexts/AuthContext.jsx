import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { ApiError } from '@/lib/api';
import { authApi } from '@/services/adminApi';

const AuthContext = createContext(null);

/** Admin session state. The server is the source of truth; this mirrors /auth/me. */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60 * 1000,
    retry: false,
  });

  const login = useCallback(
    async (credentials) => {
      const loggedIn = await authApi.login(credentials);
      queryClient.setQueryData(['auth', 'me'], loggedIn);
      return loggedIn;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.removeQueries({ queryKey: ['admin'] });
    }
  }, [queryClient]);

  const value = useMemo(() => {
    const permissions = new Set(user?.permissions ?? []);
    const isSuperAdmin = user?.role?.slug === 'super_admin';
    return {
      user: user ?? null,
      isLoading,
      refresh: refetch,
      login,
      logout,
      can: (permission) => Boolean(user && (isSuperAdmin || permissions.has(permission))),
      canAny: (...list) => Boolean(user && (isSuperAdmin || list.some((p) => permissions.has(p)))),
    };
  }, [user, isLoading, refetch, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
