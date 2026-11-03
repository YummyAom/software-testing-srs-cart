export interface SupabaseAuthConfig {
  url: string;
  publishableKey: string;
}

export interface AppConfig {
  appEnv: 'development' | 'test';
  supabase: SupabaseAuthConfig;
  dbUrl?: string;
  uiOrigin: string;
  /** DC-3.1 reset secret; only read when appEnv is 'test'. */
  testResetToken?: string;
}

export interface ServerConfig {
  app: AppConfig;
  port: number;
}
