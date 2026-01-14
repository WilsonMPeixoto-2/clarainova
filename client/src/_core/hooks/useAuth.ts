import { useCallback, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/**
 * Stub authentication hook for public-only application
 * Returns no user and no authentication
 */
export function useAuth(options?: UseAuthOptions) {
  const logout = useCallback(async () => {
    // No-op for public app
  }, []);

  const state = useMemo(() => {
    return {
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
    };
  }, []);

  return {
    ...state,
    refresh: () => Promise.resolve({ data: null }),
    logout,
  };
}
