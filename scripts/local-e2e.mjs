// Runs the E2E suite against a local Supabase stack. Node only, so it works the same on Windows, Linux and macOS.
// Usage from the repo root: npm run e2e:setup | npm run e2e | npm run e2e:stop
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENV_FILE = join(ROOT, 'backend', '.env.test');
const SEED_SCRIPT = join('backend', 'scripts', 'local-supabase-seed.mjs');
// Pinned so every machine runs the same CLI, and nobody has to install it.
const SUPABASE_CLI = 'supabase@2.117.0';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'LOCAL_SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'TEST_RESET_TOKEN',
  'SEED_PASSWORD_CUSTOMER_NORMAL',
  'SEED_PASSWORD_CUSTOMER_PRIME',
  'SEED_PASSWORD_ADMIN',
];
const PORTS = [
  { port: 3001, name: 'API' },
  { port: 5173, name: 'frontend' },
];

function fail(message) {
  console.error(`\ne2e: ${message}`);
  process.exit(1);
}

function step(message) {
  console.log(`\n==> ${message}`);
}

// Windows can only start npm and npx (.cmd files) through a shell.
function spawn(command, args, options = {}) {
  return spawnSync(command, args, { cwd: ROOT, shell: process.platform === 'win32', ...options });
}

function run(command, args, options = {}) {
  const result = spawn(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) fail(`failed: ${command} ${args.join(' ')}`);
}

function supabase(args, options = {}) {
  return ['npx', ['--yes', SUPABASE_CLI, ...args], options];
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) fail(`Node 22 is required, found ${process.version}. Install it from https://nodejs.org`);
  if (major > 22) console.warn(`Warning: this project targets Node 22, found ${process.version}.`);
}

function dockerRunning() {
  return spawn('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

function ensureDocker() {
  if (dockerRunning()) return;
  if (process.platform === 'darwin' && spawn('colima', ['version'], { stdio: 'ignore' }).status === 0) {
    step('Starting colima');
    run('colima', ['start']);
    if (dockerRunning()) return;
  }
  const help = {
    win32: 'Install and open Docker Desktop: https://docs.docker.com/desktop/setup/install/windows-install/',
    darwin: 'Install and open Docker Desktop (https://docs.docker.com/desktop/setup/install/mac-install/), or run `colima start`.',
  }[process.platform]
    ?? 'Install Docker Engine (https://docs.docker.com/engine/install/), start it, and let your user run `docker` without sudo.';
  fail(`Docker is not running. ${help}`);
}

function startSupabase() {
  step('Starting local Supabase (the first run downloads images and takes a few minutes)');
  run(...supabase(['start']));
}

function assertLocal(env) {
  if (env.APP_ENV !== 'test') fail('backend/.env.test must set APP_ENV=test');
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_DB_URL']) {
    let hostname;
    try {
      hostname = new URL(env[name]).hostname;
    } catch {
      fail(`${name} in backend/.env.test is missing or not a URL`);
    }
    if (!LOCAL_HOSTS.has(hostname)) fail(`refusing to run: ${name} in backend/.env.test must point at this machine`);
  }
}

function readEnvFile() {
  return parseEnv(readFileSync(ENV_FILE, 'utf8'));
}

function createEnvFile() {
  const result = spawn(...supabase(['status', '-o', 'env'], { encoding: 'utf8' }));
  if (result.status !== 0) fail('could not read `supabase status`');
  const status = parseEnv(result.stdout);
  const publishableKey = status.ANON_KEY ?? status.PUBLISHABLE_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY;
  if (!status.API_URL || !status.DB_URL || !publishableKey || !serviceRoleKey) {
    fail('`supabase status` did not return the API URL, DB URL and keys');
  }
  const secret = () => randomBytes(16).toString('hex');
  const lines = [
    '# Created by `npm run e2e:setup`. Local Supabase only. Do not commit.',
    'APP_ENV=test',
    'API_PORT=3001',
    'UI_ORIGIN=http://localhost:5173',
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    `LOCAL_SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
    `SUPABASE_DB_URL=${status.DB_URL}`,
    `TEST_RESET_TOKEN=${secret()}`,
    `SEED_PASSWORD_CUSTOMER_NORMAL=${secret()}`,
    `SEED_PASSWORD_CUSTOMER_PRIME=${secret()}`,
    `SEED_PASSWORD_ADMIN=${secret()}`,
  ];
  writeFileSync(ENV_FILE, `${lines.join('\n')}\n`, { mode: 0o600 });
}

function ensureEnvFile() {
  if (existsSync(ENV_FILE)) {
    console.log('Keeping the existing backend/.env.test');
  } else {
    createEnvFile();
    console.log('Created backend/.env.test');
  }
  const env = readEnvFile();
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length > 0) fail(`backend/.env.test is missing: ${missing.join(', ')}`);
  assertLocal(env);
}

function seedAccounts() {
  run(process.execPath, [`--env-file=${join('backend', '.env.test')}`, SEED_SCRIPT], { shell: false });
}

function installDependencies() {
  for (const folder of ['.', 'frontend', 'e2e']) {
    step(`Installing dependencies: ${folder}`);
    run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: join(ROOT, folder) });
  }
  step('Installing the Playwright browser');
  const browser = spawn('npx', ['playwright', 'install', 'chromium'], { cwd: join(ROOT, 'e2e'), stdio: 'inherit' });
  if (browser.status !== 0) fail('could not install Chromium');
  if (process.platform === 'linux') {
    console.log('If Chromium later reports missing libraries, run: cd e2e && sudo npx playwright install-deps chromium');
  }
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: 'localhost' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function assertPortsFree() {
  for (const { port, name } of PORTS) {
    if (await isPortInUse(port)) {
      fail(
        `port ${port} (${name}) is already in use. Stop that program first: the frontend always calls port 3001, `
          + 'so a dev server left running there could send this test run to the shared database.',
      );
    }
  }
}

function setup() {
  checkNode();
  ensureDocker();
  installDependencies();
  startSupabase();
  step('Preparing backend/.env.test');
  ensureEnvFile();
  step('Creating the test accounts');
  seedAccounts();
  console.log('\nSetup complete. Run the tests with: npm run e2e');
}

async function runTests(args) {
  checkNode();
  if (!existsSync(ENV_FILE)) fail('backend/.env.test not found. Run `npm run e2e:setup` first.');
  assertLocal(readEnvFile());
  await assertPortsFree();
  ensureDocker();
  startSupabase();
  seedAccounts();
  step('Running Playwright (it starts and stops the API and frontend)');
  const result = spawn('npx', ['playwright', 'test', ...args], { cwd: join(ROOT, 'e2e'), stdio: 'inherit' });
  process.exit(result.status ?? 1);
}

function stop() {
  run(...supabase(['stop']));
}

const [command, ...args] = process.argv.slice(2);
if (command === 'setup') setup();
else if (command === 'run') await runTests(args);
else if (command === 'stop') stop();
else fail('usage: node scripts/local-e2e.mjs setup | run [playwright args] | stop');
