import 'dotenv/config';

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',

  openaiApiKey: require_env('OPENAI_API_KEY'),

  smtp: {
    host: require_env('SMTP_HOST'),
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: require_env('SMTP_USER'),
    pass: require_env('SMTP_PASS'),
    fromName: process.env.SMTP_FROM_NAME ?? 'Immigration Portal',
    from: require_env('SMTP_FROM'),
  },

  agencyEmail: require_env('AGENCY_EMAIL'),
} as const;
