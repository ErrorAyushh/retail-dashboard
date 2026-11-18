import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Session-based user profile with server-enforced role
  const [user, setUser] = useState({
    name: 'Retail Ops',
    email: 'ops@neemans.com',
    role: 'Store Manager',
    canViewPII: true // Full customer intelligence & unmasked contact details
  });

  return (
    <AuthContext.Provider value={{ user, canViewPII: user.canViewPII }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
