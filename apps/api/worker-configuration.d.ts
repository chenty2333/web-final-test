interface Env {
  DB: D1Database;
  ENVIRONMENT: "development" | "preview" | "production";
  APP_ORIGIN: string;
  SESSION_SECRET?: string;
  SESSION_COOKIE_NAME?: string;
  TURNSTILE_SECRET?: string;
  MONITOR_SAMPLE_RATE?: string;
  SEED_TOKEN?: string;
  ADMIN_SETUP_TOKEN?: string;
  MIMO_API_KEY?: string;
  MIMO_BASE_URL?: string;
  MIMO_MODEL?: string;
}
