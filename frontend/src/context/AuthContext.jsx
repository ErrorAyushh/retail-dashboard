import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setStoredToken, getStoredToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('kadam_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => getStoredToken());
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setStoredToken(null);
    try {
      localStorage.removeItem('kadam_user');
    } catch {}
    setToken(null);
    setUser(null);
  }, []);

  const loginWithSession = useCallback((authToken, userProfile) => {
    setStoredToken(authToken);
    try {
      localStorage.setItem('kadam_user', JSON.stringify(userProfile));
    } catch {}
    setToken(authToken);
    setUser(userProfile);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      const currentToken = getStoredToken();
      if (!currentToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const response = await api.getMe();
        if (isMounted && response?.user) {
          setUser(response.user);
          try {
            localStorage.setItem('kadam_user', JSON.stringify(response.user));
          } catch {}
        }
      } catch (err) {
        console.warn('Authentication token verification failed:', err);
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [logout]);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    loading,
    loginWithSession,
    logout,
    canViewPII: true
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
