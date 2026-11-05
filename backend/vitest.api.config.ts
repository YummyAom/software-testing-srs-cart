import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const envTest = fileURLToPath(new URL('./.env.test', import.meta.url));
const envDefault = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envTest)) {
  process.loadEnvFile(envTest);
} else if (existsSync(envDefault)) {
  process.loadEnvFile(envDefault);
}

export default defineConfig({
  test: {
    include: ['tests/api/**/*.test.ts'],
    // Every file resets the same local database, so files must not run at the same time.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
