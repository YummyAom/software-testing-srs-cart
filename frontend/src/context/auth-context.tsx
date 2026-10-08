import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { loginApi, LoginSession, UserProfile } from '../lib/api-client';

interface AuthContextType {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => sessionStorage.getItem('access_token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => sessionStorage.getItem('refresh_token'));
  
  const [user, setUser] = useState<UserProfile | null>(() => {
    const role = sessionStorage.getItem('user_role') as UserProfile['role'];
    const username = sessionStorage.getItem('username');
    const userId = sessionStorage.getItem('user_id');
    const memberTier = sessionStorage.getItem('member_tier') as UserProfile['memberTier'];
    
    if (role && username && userId) {
      return {
        role,
        username,
        userId,
        memberTier: memberTier || 'free',
        email: ''
      };
    }
    return null;
  });

  const login = async (email: string, password: string) => {
    const session = await loginApi(email, password);
    
    setAccessToken(session.access_token);
    setRefreshToken(session.refresh_token);
    setUser(session.user);
    
    sessionStorage.setItem('access_token', session.access_token);
    if (session.refresh_token) {
      sessionStorage.setItem('refresh_token', session.refresh_token);
    }
    sessionStorage.setItem('user_role', session.user.role);
    sessionStorage.setItem('username', session.user.username);
    sessionStorage.setItem('user_id', session.user.userId || session.user.id || '');
    sessionStorage.setItem('member_tier', session.user.memberTier);
  };

  const logout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user_role');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('member_tier');
  };

  return (
    <AuthContext.Provider value={{ accessToken, refreshToken, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
