import type { Database } from '../../../database.js';
import type { AppUserOutcome, AppUserRepository } from '../auth-types.js';

export type { AppUser } from '../../../interfaces/user.js';

/** Read the authoritative profile from PostgreSQL after Supabase Auth verifies the JWT. */
export class PostgresAppUserRepository implements AppUserRepository {
  constructor(private readonly database: Database) {}

  async findByAuthId(userId: string, _accessToken: string): Promise<AppUserOutcome> {
    try {
      const result = await this.database.query<{
        id: string; username: string; role: 'Customer' | 'Admin'; member_tier: 'normal' | 'prime' | null;
      }>('select id, username, role, member_tier from public.app_users where id = $1', [userId]);
      if (result.rowCount === 0) return { kind: 'not_found' };
      const row = result.rows[0];
      if (!row || !['Customer', 'Admin'].includes(row.role)
        || (row.role === 'Customer' && !['normal', 'prime'].includes(String(row.member_tier)))) {
        return { kind: 'unavailable' };
      }
      return { kind: 'found', user: { id: row.id, username: row.username,
        role: row.role, memberTier: row.member_tier } };
    } catch { return { kind: 'unavailable' }; }
  }
}
