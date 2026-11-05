import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const frontendDir = fileURLToPath(new URL('../frontend', import.meta.url));

// Reset token and seed passwords live in backend/.env.test (git-ignored), shared with the API tests.
// Never fall back to backend/.env: it points at the shared team database.
const envFile = fileURLToPath(new URL('../backend/.env.test', import.meta.url));
if (!existsSync(envFile)) throw new Error('backend/.env.test not found. Run `npm run e2e:setup` from the repo root.');
process.loadEnvFile(envFile);

if (process.env.APP_ENV !== 'test') throw new Error('E2E needs APP_ENV=test');
for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_DB_URL']) {
  const { hostname } = new URL(process.env[name] ?? 'http://missing.invalid');
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') throw new Error(`${name} must point at this machine`);
}

// `npm run e2e` picks free ports, starts both servers itself and passes the ports here,
// so the frontend always calls the API of this run.
const apiPort = process.env.API_PORT ?? '3001';
const frontendPort = process.env.E2E_PORT ?? '5173';
const frontendUrl = `http://localhost:${frontendPort}`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // reuseExistingServer stays false: a server already on these ports could be connected to the shared database.
  webServer: process.env.E2E_SERVERS_RUNNING ? undefined : [
    {
      name: 'API',
      command: 'npm exec --workspace @cart/api -- tsx --env-file=.env.test src/index.ts',
      cwd: repoRoot,
      url: `http://127.0.0.1:${apiPort}/products`,
      env: { API_PORT: apiPort, UI_ORIGIN: frontendUrl },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: 'frontend',
      command: `npm run dev -- --port ${frontendPort} --strictPort`,
      cwd: frontendDir,
      url: `http://127.0.0.1:${frontendPort}/login`,
      env: { VITE_API_URL: `http://localhost:${apiPort}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
