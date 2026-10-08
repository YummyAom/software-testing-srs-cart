import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export interface SeedPasswords { customerNormal: string; customerPrime: string; admin: string }
export interface IdentityAdapter {
  verifyCredential(userId: string | undefined, password: string): Promise<boolean>;
  issueSession(userId: string): { accessToken: string; tokenType: 'Bearer'; expiresIn: number };
  resolveSession(authorization: string | undefined): string | undefined;
}

/** Local-only mock identity. Opaque volatile sessions, not JWT, Supabase Auth or production auth.
 * Passwords are caller-configured; salted scrypt digests never enter the domain store or responses.
 */
export function createMockIdentity(passwords: SeedPasswords, clock: () => number): IdentityAdapter {
  const credentials = new Map<string, { salt: Buffer; digest: Buffer }>();
  for (const [id, password] of [
    ['00000000-0000-4000-8000-000000000001', passwords.customerNormal],
    ['00000000-0000-4000-8000-000000000002', passwords.customerPrime],
    ['00000000-0000-4000-8000-000000000003', passwords.admin],
  ] as const) {
    if (!password) throw new Error('Configure all local mock seed passwords');
    const salt = randomBytes(16);
    credentials.set(id, { salt, digest: scryptSync(password, salt, 32) });
  }
  const dummySalt = randomBytes(16);
  const dummy = { salt: dummySalt, digest: scryptSync(randomBytes(32), dummySalt, 32) };
  const sessions = new Map<string, { userId: string; expiresAt: number }>();
  return {
    async verifyCredential(userId, password) {
      const credential = userId ? credentials.get(userId) : undefined;
      const candidate = credential ?? dummy;
      const matches = timingSafeEqual(scryptSync(password, candidate.salt, 32), candidate.digest);
      return credential !== undefined && matches;
    },
    issueSession(userId) {
      const now = clock();
      for (const [token, session] of sessions) if (now >= session.expiresAt) sessions.delete(token);
      const accessToken = randomBytes(32).toString('base64url');
      sessions.set(accessToken, { userId, expiresAt: now + 3600_000 });
      return { accessToken, tokenType: 'Bearer', expiresIn: 3600 };
    },
    resolveSession(authorization) {
      const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization ?? '');
      const token = match?.[1];
      if (!token) return undefined;
      const session = sessions.get(token);
      if (!session) return undefined;
      if (clock() >= session.expiresAt) { sessions.delete(token); return undefined; }
      return session.userId;
    },
  };
}
