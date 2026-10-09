import type { AppConfig, ServerConfig } from './interfaces/config.js';

/** Supabase credentials are required; there is no mock fallback. */
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const appEnv = env.APP_ENV ?? 'development';
  if (env.NODE_ENV === 'production' || (appEnv !== 'development' && appEnv !== 'test')) {
    throw new Error('Local login API requires development/test APP_ENV; production is unsupported');
  }
  function required(name: string): string {
    const value = env[name];
    if (!value) throw new Error(`Configure ${name}`);
    return value;
  }
  const portText = env.API_PORT ?? '3000';
  if (!/^\d+$/.test(portText)) throw new Error('Invalid API_PORT');
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API_PORT');
  const url = new URL(required('NEXT_PUBLIC_SUPABASE_URL'));
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Configure an HTTPS Supabase project URL');
  }
  const app: AppConfig = {
    appEnv,
    uiOrigin: env.UI_ORIGIN ?? 'http://localhost:5173',
    supabase: {
      url: url.origin,
      publishableKey: required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    },
  };
  return { app, port };
}
