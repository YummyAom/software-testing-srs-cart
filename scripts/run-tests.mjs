// Runs the unit, API and E2E tests on free ports against a local Supabase stack, and prints the ports in use.
// Node only, so it works the same on Windows, Linux and macOS. See e2e/README.md for the commands.
import { spawn as spawnAsync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
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
const FIRST_PORT = { api: 3001, frontend: 5173, vitestUi: 51204, playwrightUi: 8080, report: 9323 };
const PORT_ATTEMPTS = 100;
const SERVER_READY_TIMEOUT_MS = 60_000;

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

function canBind(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', (error) => resolve(error.code === 'EADDRNOTAVAIL' || error.code === 'EAFNOSUPPORT'));
    server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

// Check each address: on macOS binding 0.0.0.0 can succeed while another program holds 127.0.0.1 on that port.
async function isPortFree(port) {
  for (const host of ['127.0.0.1', '0.0.0.0', '::1', '::']) {
    if (!(await canBind(port, host))) return false;
  }
  return true;
}

async function findFreePort(firstPort) {
  for (let port = firstPort; port < firstPort + PORT_ATTEMPTS; port += 1) {
    if (await isPortFree(port)) return port;
  }
  return fail(`no free port between ${firstPort} and ${firstPort + PORT_ATTEMPTS - 1}`);
}

function printPorts(entries) {
  step('Ports in use');
  for (const { name, port, firstPort, url } of entries) {
    const note = port === firstPort ? '' : `  (${firstPort} was busy)`;
    console.log(`    ${name.padEnd(13)} ${url ?? `http://localhost:${port}`}${note}`);
  }
}

function hasFlag(args, flag) {
  return args.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

function prepareLocalStack() {
  checkNode();
  if (!existsSync(ENV_FILE)) fail('backend/.env.test not found. Run `npm run e2e:setup` first.');
  assertLocal(readEnvFile());
  ensureDocker();
  startSupabase();
  seedAccounts();
}

const runningChildren = new Set();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    for (const child of runningChildren) stopChild(child);
    process.exit(130);
  });
}

function stopChild(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

function runChild(command, args, options) {
  return new Promise((resolve) => {
    const child = spawnAsync(command, args, {
      cwd: ROOT,
      shell: process.platform === 'win32',
      stdio: 'inherit',
      ...options,
    });
    runningChildren.add(child);
    child.once('error', () => resolve(1));
    child.once('exit', (code) => {
      runningChildren.delete(child);
      resolve(code ?? 1);
    });
  });
}

function stopServer(server) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // already stopped
  }
}

const runningServers = [];
process.on('exit', () => runningServers.forEach(stopServer));

// Runs in its own process group so the whole server, not only the npm wrapper, can be stopped when this script exits.
function startServer(name, args, options) {
  const server = spawnAsync('npm', args, {
    cwd: ROOT,
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'ignore', 'inherit'],
    ...options,
  });
  server.once('exit', () => {
    server.stopped = true;
  });
  server.label = name;
  runningServers.push(server);
  return server;
}

function startApi(port, uiOrigin) {
  return startServer('API', ['exec', '--workspace', '@cart/api', '--', 'tsx', '--env-file=.env.test', 'src/index.ts'], {
    env: { ...process.env, API_PORT: String(port), ...(uiOrigin ? { UI_ORIGIN: uiOrigin } : {}) },
  });
}

async function waitUntilReady(url, server) {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.stopped) fail(`the ${server.label} stopped while starting`);
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  fail(`the ${server.label} did not start within 60 seconds`);
}

async function vitestArgs(args, entries) {
  if (!args.includes('--ui')) return ['run', ...args];
  const uiPort = await findFreePort(FIRST_PORT.vitestUi);
  entries.push({
    name: 'Vitest UI',
    port: uiPort,
    firstPort: FIRST_PORT.vitestUi,
    url: `http://localhost:${uiPort}/__vitest__/`,
  });
  // --watch keeps the page open even when the terminal is not interactive, such as a remote session.
  return [...args, '--watch', `--api.port=${uiPort}`, '--api.strictPort'];
}

async function runUnit(args) {
  checkNode();
  const entries = [];
  const vitest = await vitestArgs(args, entries);
  if (entries.length > 0) printPorts(entries);
  else console.log('\nUnit tests do not use a port.');
  const code = await runChild('npx', ['vitest', ...vitest], { cwd: join(ROOT, 'packages', 'domain') });
  process.exit(code);
}

async function runApi(args) {
  prepareLocalStack();
  const apiPort = await findFreePort(FIRST_PORT.api);
  const entries = [{ name: 'API', port: apiPort, firstPort: FIRST_PORT.api }];
  const vitest = await vitestArgs(args, entries);
  const env = { ...process.env, API_PORT: String(apiPort) };

  await waitUntilReady(`http://127.0.0.1:${apiPort}/products`, startApi(apiPort));
  printPorts(entries);
  const code = await runChild('npx', ['vitest', ...vitest, '--config', 'vitest.api.config.ts'], {
    cwd: join(ROOT, 'backend'),
    env,
  });
  process.exit(code);
}

async function runE2e(args) {
  prepareLocalStack();
  const apiPort = await findFreePort(FIRST_PORT.api);
  const frontendPort = await findFreePort(FIRST_PORT.frontend);
  const entries = [
    { name: 'API', port: apiPort, firstPort: FIRST_PORT.api },
    { name: 'Frontend', port: frontendPort, firstPort: FIRST_PORT.frontend },
  ];
  const playwright = ['playwright', 'test', ...args];
  if (args.includes('--ui') && !hasFlag(args, '--ui-port')) {
    const uiPort = await findFreePort(FIRST_PORT.playwrightUi);
    entries.push({ name: 'Playwright UI', port: uiPort, firstPort: FIRST_PORT.playwrightUi });
    playwright.push(`--ui-port=${uiPort}`);
  }
  const frontendUrl = `http://localhost:${frontendPort}`;
  const api = startApi(apiPort, frontendUrl);
  const frontend = startServer('frontend', ['run', 'dev', '--', '--port', String(frontendPort), '--strictPort'], {
    cwd: join(ROOT, 'frontend'),
    env: { ...process.env, VITE_API_URL: `http://localhost:${apiPort}` },
  });
  await waitUntilReady(`http://127.0.0.1:${apiPort}/products`, api);
  await waitUntilReady(`http://127.0.0.1:${frontendPort}/login`, frontend);
  printPorts(entries);

  step('Running Playwright');
  const code = await runChild('npx', playwright, {
    cwd: join(ROOT, 'e2e'),
    env: {
      ...process.env,
      API_PORT: String(apiPort),
      E2E_PORT: String(frontendPort),
      E2E_SERVERS_RUNNING: '1',
    },
  });
  process.exit(code);
}

async function showReport() {
  const port = await findFreePort(FIRST_PORT.report);
  printPorts([{ name: 'E2E report', port, firstPort: FIRST_PORT.report }]);
  const code = await runChild('npx', ['playwright', 'show-report', '--port', String(port)], { cwd: join(ROOT, 'e2e') });
  process.exit(code);
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

function stop() {
  run(...supabase(['stop']));
}

const [command, ...args] = process.argv.slice(2);
if (command === 'setup') setup();
else if (command === 'unit') await runUnit(args);
else if (command === 'api') await runApi(args);
else if (command === 'e2e') await runE2e(args);
else if (command === 'report') await showReport();
else if (command === 'stop') stop();
else fail('usage: node scripts/run-tests.mjs setup | unit | api | e2e | report | stop');
