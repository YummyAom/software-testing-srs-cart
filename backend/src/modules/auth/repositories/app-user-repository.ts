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

  async findEmailByIdentifier(identifier: string): Promise<{ kind: 'found'; email: string } | { kind: 'not_found' } | { kind: 'unavailable' }> {
    try {
      const result = await this.database.query<{ email: string }>(
        `select u.email from public.app_users a
         join auth.users u on u.id = a.id
         where a.username = $1 or u.email = $1 limit 1`,
        [identifier]
      );
      if (result.rowCount && result.rows[0]?.email) {
        return { kind: 'found', email: result.rows[0].email };
      }
      if (identifier.includes('@')) {
        return { kind: 'found', email: identifier };
      }
      return { kind: 'not_found' };
    } catch {
      if (identifier.includes('@')) {
        return { kind: 'found', email: identifier };
      }
      return { kind: 'unavailable' };
    }
  }
}
