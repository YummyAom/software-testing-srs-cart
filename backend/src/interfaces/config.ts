export interface SupabaseAuthConfig {
  url: string;
  publishableKey: string;
}

export interface AppConfig {
  appEnv: 'development' | 'test';
  supabase: SupabaseAuthConfig;
  uiOrigin: string;
}

export interface ServerConfig {
  app: AppConfig;
  port: number;
}
