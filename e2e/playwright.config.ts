import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Reset token and seed passwords live in backend/.env.test (git-ignored), shared with the API tests.
const envTestFile = fileURLToPath(new URL('../backend/.env.test', import.meta.url));
if (existsSync(envTestFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envTestFile);
}
const envBackendFile = fileURLToPath(new URL('../backend/.env', import.meta.url));
if (existsSync(envBackendFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envBackendFile);
}

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
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
