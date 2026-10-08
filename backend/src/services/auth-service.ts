import type { AuthRepository, AuthSession } from '../repositories/supabase-auth-repository.js';
import type { AppUserRepository } from '../repositories/app-user-repository.js';

export interface LoginSession extends Omit<AuthSession, 'user'> {
  user: AuthSession['user'] & { username: string; role: 'admin' | 'customer'; memberTier: 'free' | 'prime' };
}

export class AuthServiceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export class AuthService {
  constructor(private readonly repository: AuthRepository, private readonly users: AppUserRepository) {}

  async login(email: string, password: string): Promise<LoginSession> {
    const result = await this.repository.signIn(email, password);
    switch (result.kind) {
      case 'success': {
        const profile = await this.users.findByAuthId(result.session.user.userId, result.session.accessToken);
        if (profile.kind === 'not_found') {
          throw new AuthServiceError(403, 'AUTH_PROFILE_NOT_FOUND', 'Account is not configured in app_users');
        }
        if (profile.kind === 'unavailable') {
          throw new AuthServiceError(503, 'AUTH_PROFILE_UNAVAILABLE', 'Unable to load account profile');
        }
        return { ...result.session, user: {
          userId: result.session.user.userId,
          username: profile.user.username,
          email: result.session.user.email,
          role: profile.user.role === 'Admin' ? 'admin' : 'customer',
          memberTier: profile.user.memberTier === 'prime' ? 'prime' : 'free',
        } };
      }
      case 'invalid_credentials':
        throw new AuthServiceError(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect');
      case 'email_not_confirmed':
        throw new AuthServiceError(403, 'AUTH_EMAIL_NOT_CONFIRMED', 'Please confirm your email before logging in');
      case 'rate_limited':
        throw new AuthServiceError(429, 'AUTH_RATE_LIMITED', 'Too many login attempts; please try again later');
      case 'unavailable':
        throw new AuthServiceError(503, 'AUTH_UNAVAILABLE', 'Authentication service is unavailable');
    }
  }
}
