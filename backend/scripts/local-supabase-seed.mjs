// Seeds the SRS §7 accounts (cus_normal, cus_prime, admin01) into a LOCAL Supabase stack.
// Products, coupons and customer_state are not seeded here: call POST /test/reset afterwards.
// Run from the repo root with `npm run db:local:seed`; values come from backend/.env.test.
import pg from 'pg';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const ACCOUNTS = [
  { username: 'cus_normal', role: 'Customer', tier: 'normal', passwordEnv: 'SEED_PASSWORD_CUSTOMER_NORMAL' },
  { username: 'cus_prime', role: 'Customer', tier: 'prime', passwordEnv: 'SEED_PASSWORD_CUSTOMER_PRIME' },
  { username: 'admin01', role: 'Admin', tier: null, passwordEnv: 'SEED_PASSWORD_ADMIN' },
];

function fail(message) {
  console.error(`db:local:seed: ${message}`);
  process.exit(1);
}

function parseUrl(name) {
  try {
    return new URL(process.env[name] ?? '');
  } catch {
    return fail(`${name} is missing or not a valid URL (fill backend/.env.test)`);
  }
}

// Hard guard: refuse before any network or database access unless both targets are local.
// Hosts are never echoed, so a shared project's address cannot leak into logs.
const apiUrl = parseUrl('NEXT_PUBLIC_SUPABASE_URL');
const dbUrl = parseUrl('SUPABASE_DB_URL');
if (!LOCAL_HOSTS.has(apiUrl.hostname)) {
  fail('refusing to run: NEXT_PUBLIC_SUPABASE_URL host must be 127.0.0.1 or localhost');
}
if (!LOCAL_HOSTS.has(dbUrl.hostname)) {
  fail('refusing to run: SUPABASE_DB_URL host must be 127.0.0.1 or localhost');
}

const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) fail('LOCAL_SUPABASE_SERVICE_ROLE_KEY is missing (copy it from `supabase status`)');
for (const account of ACCOUNTS) {
  if (!process.env[account.passwordEnv]) fail(`${account.passwordEnv} is missing`);
}

async function adminRequest(method, path, body) {
  const response = await fetch(new URL(path, apiUrl.origin), {
    method,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = payload.msg ?? payload.message ?? payload.error_description ?? 'unknown error';
    fail(`Auth admin ${method} ${path.replace(/[0-9a-f-]{36}/, '<id>')} failed (HTTP ${response.status}): ${reason}`);
  }
  return payload;
}

// Connect with explicit fields so the host checked above is the host pg uses.
const client = new pg.Client({
  host: dbUrl.hostname,
  port: dbUrl.port ? Number(dbUrl.port) : 5432,
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: decodeURIComponent(dbUrl.pathname.slice(1)) || 'postgres',
  connectionTimeoutMillis: 10_000,
});

try {
  await client.connect();
  for (const account of ACCOUNTS) {
    const email = `${account.username}@local.test`;
    const password = process.env[account.passwordEnv];
    const existing = await client.query('select id from auth.users where email = $1', [email]);
    let id = existing.rows[0]?.id;
    if (id) {
      await adminRequest('PUT', `/auth/v1/admin/users/${id}`, { password, email_confirm: true });
    } else {
      id = (await adminRequest('POST', '/auth/v1/admin/users', { email, password, email_confirm: true })).id;
    }
    await client.query(
      `insert into public.app_users(id, username, auth_email, role, member_tier)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set username = excluded.username, auth_email = excluded.auth_email,
         role = excluded.role, member_tier = excluded.member_tier`,
      [id, account.username, email, account.role, account.tier],
    );
    console.log(`${existing.rows[0] ? 'updated' : 'created'} ${account.username} <${email}>`);
  }
  console.log('Done. Seed products, coupons and customer_state next with POST /test/reset.');
} catch (error) {
  fail(`failed: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await client.end().catch(() => undefined);
}
