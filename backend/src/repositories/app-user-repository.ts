import type { SupabaseAuthConfig } from '../interfaces/config.js';
import type { AppUserOutcome, AppUserRepository } from '../interfaces/repositories.js';

export type { AppUser } from '../interfaces/user.js';
export type { AppUserOutcome, AppUserRepository } from '../interfaces/repositories.js';

/** Profile lookup with the authenticated user's JWT and RLS, never Auth metadata roles. */
export class SupabaseAppUserRepository implements AppUserRepository {
  constructor(private readonly config: SupabaseAuthConfig) {}

  async findByAuthId(userId: string, accessToken: string): Promise<AppUserOutcome> {
    const url = new URL('/rest/v1/app_users', this.config.url);
    url.searchParams.set('select', 'id,username,role,member_tier');
    url.searchParams.set('id', `eq.${userId}`);
    url.searchParams.set('limit', '2');
    const headers = {
      apikey: this.config.publishableKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000), redirect: 'error' });
      if (!response.ok) return { kind: 'unavailable' };
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) return { kind: 'unavailable' };
      if (rows.length === 0) return { kind: 'not_found' };
      if (rows.length !== 1) return { kind: 'unavailable' };
      const row: unknown = rows[0];
      if (!row || typeof row !== 'object' || !('id' in row) || row.id !== userId
        || !('username' in row) || typeof row.username !== 'string' || !row.username
        || !('role' in row) || (row.role !== 'Admin' && row.role !== 'Customer')
        || !('member_tier' in row)
        || (row.member_tier !== null && row.member_tier !== 'normal' && row.member_tier !== 'prime')
        || (row.role === 'Admin' && row.member_tier !== null)
        || (row.role === 'Customer' && row.member_tier !== 'normal' && row.member_tier !== 'prime')) {
        return { kind: 'unavailable' };
      }
      return { kind: 'found', user: {
        id: userId, username: row.username, role: row.role,
        memberTier: row.member_tier,
      } };
    } catch {
      return { kind: 'unavailable' };
    }
  }
}
