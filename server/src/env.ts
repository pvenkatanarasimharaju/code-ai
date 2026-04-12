import path from 'path';
import dotenv from 'dotenv';

/**
 * Resolve server/.env from this file's location so it works regardless of process.cwd()
 * (e.g. starting from repo root, IDE, or Render).
 */
const envPath = path.resolve(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(
    `[env] No file at ${envPath} (${result.error.message}). Using process environment only ` +
      `(normal on Render: set secrets in the service Environment tab).`
  );
} else {
  console.log(`[env] Loaded ${envPath}`);
}

function trimEnv(key: string): void {
  const v = process.env[key];
  if (typeof v === 'string') {
    const t = v.trim();
    if (t !== v) process.env[key] = t;
  }
}

['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'DATABASE_URL', 'JWT_SECRET', 'AI_PROVIDER', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_NAME'].forEach(trimEnv);
