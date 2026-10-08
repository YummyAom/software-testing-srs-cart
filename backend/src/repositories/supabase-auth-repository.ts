export interface SupabaseAuthConfig {
  url: string;
  publishableKey: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: { userId: string; email: string };
}

export type LoginOutcome =
  | { kind: 'success'; session: AuthSession }
  | { kind: 'invalid_credentials' }
  | { kind: 'email_not_confirmed' }
  | { kind: 'rate_limited' }
  | { kind: 'unavailable' };

export interface AuthRepository {
  signIn(email: string, password: string): Promise<LoginOutcome>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Uses Supabase Auth's password grant; no shared mutable session or password storage. */
export class SupabaseAuthRepository implements AuthRepository {
  constructor(private readonly config: SupabaseAuthConfig) {}

  async signIn(email: string, password: string): Promise<LoginOutcome> {
    try {
      const response = await fetch(new URL('/auth/v1/token?grant_type=password', this.config.url), {
        method: 'POST',
        headers: { apikey: this.config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
      if (response.status === 429) return { kind: 'rate_limited' };
      const body: unknown = await response.json();
      if (!response.ok) {
        if (isObject(body) && body.error_code === 'invalid_credentials') return { kind: 'invalid_credentials' };
        if (isObject(body) && body.error_code === 'email_not_confirmed') return { kind: 'email_not_confirmed' };
        return { kind: 'unavailable' };
      }
      if (!isObject(body) || typeof body.access_token !== 'string' || !body.access_token
        || typeof body.refresh_token !== 'string' || !body.refresh_token
        || typeof body.token_type !== 'string' || body.token_type.toLowerCase() !== 'bearer'
        || typeof body.expires_in !== 'number' || !Number.isFinite(body.expires_in) || body.expires_in <= 0
        || !isObject(body.user) || typeof body.user.id !== 'string' || !body.user.id
        || typeof body.user.email !== 'string') return { kind: 'unavailable' };

      return { kind: 'success', session: {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        tokenType: 'Bearer',
        expiresIn: body.expires_in,
        user: { userId: body.user.id, email: body.user.email },
      } };
    } catch {
      // Network, timeout and malformed provider responses must not expose credentials or upstream details.
      return { kind: 'unavailable' };
    }
  }
}
