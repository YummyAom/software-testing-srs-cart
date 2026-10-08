import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = {
  '@cart/contracts': fileURLToPath(new URL('./packages/contracts/src/index.ts', import.meta.url)),
  '@cart/domain': fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)),
  '@cart/api': fileURLToPath(new URL('./apps/api/src/index.ts', import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['packages/domain/**/*.test.ts'],
          exclude: ['**/dist/**', '**/node_modules/**'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'service',
          environment: 'node',
          include: ['tests/service/**/*.test.ts', 'apps/api/**/*.test.ts'],
          exclude: ['**/dist/**', '**/node_modules/**'],
          fileParallelism: false,
          maxWorkers: 1,
        },
      },
    ],
  },
});
