import type { AuthRepository, AuthSession } from '../repositories/supabase-auth-repository.js';

export class AuthServiceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async login(email: string, password: string): Promise<AuthSession> {
    const result = await this.repository.signIn(email, password);
    switch (result.kind) {
      case 'success': return result.session;
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
