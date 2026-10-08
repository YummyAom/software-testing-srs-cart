import type { AppConfig } from './app.js';

/** No implicit mock mode or passwords. CLI startup is loopback-only. */
export function readConfig(env: NodeJS.ProcessEnv = process.env): { app: AppConfig; port: number } {
  if (env.NODE_ENV === 'production' || (env.APP_ENV !== 'development' && env.APP_ENV !== 'test')) {
    throw new Error('Explicit development/test APP_ENV required; production mock backend is unsupported');
  }
  function required(name: string): string {
    const value = env[name];
    if (!value) throw new Error(`Configure ${name} for local mock mode`);
    return value;
  }
  const portText = env.API_PORT ?? '3000';
  if (!/^\d+$/.test(portText)) throw new Error('Invalid API_PORT');
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API_PORT');
  const app: AppConfig = {
    appEnv: env.APP_ENV,
    uiOrigin: required('UI_ORIGIN'),
    seedPasswords: {
      customerNormal: required('SEED_PASSWORD_CUSTOMER_NORMAL'),
      customerPrime: required('SEED_PASSWORD_CUSTOMER_PRIME'),
      admin: required('SEED_PASSWORD_ADMIN'),
    },
    ...(env.APP_ENV === 'test' ? { testResetToken: required('TEST_RESET_TOKEN') } : {}),
  };
  return { app, port };
}
