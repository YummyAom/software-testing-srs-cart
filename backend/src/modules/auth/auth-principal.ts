import type { SupabaseAuthConfig } from '../../interfaces/config.js';
import type { AppUser } from '../../interfaces/user.js';
import { AuthServiceError } from './auth-service.js';
import { SupabaseAppUserRepository } from './repositories/app-user-repository.js';

export function bearerToken(header: string | undefined): string {
  const token = /^Bearer ([^\s]+)$/i.exec(header ?? '')?.[1];
  if (!token) throw new AuthServiceError(401, 'AUTH_REQUIRED', 'Bearer access token is required');
  return token;
}

/** Verify the JWT with Supabase Auth, then read the authoritative role from app_users. */
export async function authenticatePrincipal(token: string, config: SupabaseAuthConfig): Promise<AppUser> {
  let userId: string;
  try {
    const response = await fetch(new URL('/auth/v1/user', config.url), {
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });
    if (response.status === 401 || response.status === 403) {
      throw new AuthServiceError(401, 'AUTH_INVALID_TOKEN', 'Invalid or expired access token');
    }
    if (!response.ok) throw new Error('Auth provider unavailable');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('id' in body) || typeof body.id !== 'string' || !body.id) {
      throw new Error('Invalid Auth user response');
    }
    userId = body.id;
  } catch (error) {
    if (error instanceof AuthServiceError) throw error;
    throw new AuthServiceError(503, 'AUTH_UNAVAILABLE', 'Authentication service is unavailable');
  }

  const profile = await new SupabaseAppUserRepository(config).findByAuthId(userId, token);
  if (profile.kind === 'not_found') throw new AuthServiceError(403, 'AUTH_PROFILE_NOT_FOUND', 'Account is not configured in app_users');
  if (profile.kind === 'unavailable') throw new AuthServiceError(503, 'AUTH_PROFILE_UNAVAILABLE', 'Unable to load account profile');
  return profile.user;
}
