import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { readConfig } from './config.js';

export { createApp } from './app.js';
export type * from './interfaces/index.js';
export { readConfig } from './config.js';

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const config = readConfig();
    const app = createApp(config.app);
    await app.listen({ port: config.port, host: '127.0.0.1' });
    console.info(`Local API listening on http://127.0.0.1:${config.port}; Supabase auth`);
    for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
  } catch {
    console.error('Unable to start local API. Check environment/configuration; production is unsupported.');
    process.exitCode = 1;
  }
}
