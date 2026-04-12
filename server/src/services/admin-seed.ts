import bcrypt from 'bcryptjs';
import prisma from '../config/db';

/**
 * If ADMIN_EMAIL + ADMIN_PASSWORD + ADMIN_NAME are set in env,
 * upsert a single admin user on every server start.
 * Password is re-hashed only when it differs.
 */
export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim();

  if (!email || !password || !name) {
    console.log('[admin] No admin env vars (ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME). Admin disabled.');
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      const needsUpdate =
        existing.name !== name ||
        !existing.isAdmin ||
        !(await bcrypt.compare(password, existing.passwordHash));

      if (needsUpdate) {
        const passwordHash = await bcrypt.hash(password, 12);
        await prisma.user.update({
          where: { id: existing.id },
          data: { name, isAdmin: true, passwordHash },
        });
        console.log(`[admin] Updated admin user: ${email}`);
      } else {
        console.log(`[admin] Admin user exists: ${email}`);
      }
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.create({
        data: { email, passwordHash, name, isAdmin: true },
      });
      console.log(`[admin] Created admin user: ${email}`);
    }
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('datasource') || msg.includes('DATABASE_URL')) {
      console.warn('[admin] Skipped admin seed — DATABASE_URL is not configured correctly.');
    } else {
      console.error('[admin] Failed to seed admin:', msg);
    }
  }
}
