import type { AuthUser, LoginUser } from './user.js';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/** Session returned by Supabase Auth, without the application profile. */
export interface AuthSession extends AuthTokens {
  user: AuthUser;
}

export interface LoginSession extends AuthTokens {
  user: LoginUser;
}

export interface LoginResponse {
  data: LoginSession;
  messages: never[];
}
