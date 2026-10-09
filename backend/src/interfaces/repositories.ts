import type { AuthSession } from './auth.js';
import type { AppUser } from './user.js';

export type LoginOutcome =
  | { kind: 'success'; session: AuthSession }
  | { kind: 'invalid_credentials' }
  | { kind: 'email_not_confirmed' }
  | { kind: 'rate_limited' }
  | { kind: 'unavailable' };

export interface AuthRepository {
  signIn(email: string, password: string): Promise<LoginOutcome>;
}

export type AppUserOutcome =
  | { kind: 'found'; user: AppUser }
  | { kind: 'not_found' }
  | { kind: 'unavailable' };

export interface AppUserRepository {
  findByAuthId(userId: string, accessToken: string): Promise<AppUserOutcome>;
}
