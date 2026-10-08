import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { readConfig } from './config.js';

export { createApp } from './app.js';
export type { AppConfig, AppDependencies } from './app.js';
export { readConfig } from './config.js';
export { createMemoryPersistence, createSeedState } from './persistence.js';
export type { PersistenceAdapter, StoreState, StoredUser, StoredOrder, DeepReadonly } from './persistence.js';
export { createMockIdentity } from './mock-identity.js';
export type { IdentityAdapter, SeedPasswords } from './mock-identity.js';

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const config = readConfig();
    const app = createApp(config.app);
    await app.listen({ port: config.port, host: '127.0.0.1' });
    console.info(`Local MOCK backend listening on http://127.0.0.1:${config.port}; volatile data, not production auth/database`);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
  } catch {
    console.error('Unable to start local mock API. Check local environment/configuration; production is unsupported.');
    process.exitCode = 1;
  }
}
