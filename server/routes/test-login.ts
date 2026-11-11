// E2E-only sign-in (Playwright can't do Google OAuth). Answers 404 unless ENV is 'local' or 'test';
// preview and production never set those values, so the route is inert there.
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { Hono } from 'hono';
import { z } from 'zod';
import { ROLES } from '../../shared/enums';
import { studentNumberFromEmail } from '../../shared/profile';
import { authOptions } from '../auth';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { validate } from '../validate';

const TestLoginInput = z.object({ email: z.email(), role: z.enum(ROLES), firstName: z.string().max(60).optional() }).strict();

export const testLogin = new Hono<AppEnv>().post('/login', async (c, next) => {
  if (c.env.ENV !== 'local' && c.env.ENV !== 'test') return apiError(c, 404, 'NOT_FOUND', 'Not found');
  await next();
}, validate('json', TestLoginInput), async (c) => {
  const { email, role, firstName } = c.req.valid('json');
  const D = c.env.DB;
  const now = new Date().toISOString();

  // Pre-approve, then create the user through the real sign-in hooks (user.create.after → member row).
  await D.prepare(
    `INSERT INTO access_requests (email, status, role, source, created_at) VALUES (?1, 'approved', ?2, 'bulk', ?3)
     ON CONFLICT (email) DO UPDATE SET status = 'approved', role = excluded.role`,
  )
    .bind(email, role, now)
    .run();
  const test = (await betterAuth({ ...authOptions(c.env), plugins: [testUtils()] }).$context).test;
  const existing = await D.prepare(`SELECT id FROM user WHERE lower(email) = lower(?1)`).bind(email).first<{ id: string }>();
  const userId = existing?.id ?? (await test.saveUser(test.createUser({ email, name: firstName ?? email.split('@')[0] }))).id;

  // Minimal onboarded profile + an (empty) submitted schedule for the active term, so the member is assignable.
  await D.batch([
    D.prepare(
      `UPDATE members SET first_name = COALESCE(first_name, ?2), last_name = COALESCE(last_name, 'Tester'), gender = COALESCE(gender, 'F'),
         college_id = COALESCE(college_id, (SELECT id FROM colleges WHERE code = 'CCE')), year_level = COALESCE(year_level, 2),
         batch_year = COALESCE(batch_year, 2024), height_cm = COALESCE(height_cm, 160), tshirt_size = COALESCE(tshirt_size, 'M'),
         student_number = COALESCE(student_number, ?3), onboarded_at = COALESCE(onboarded_at, ?4), updated_at = ?4
       WHERE lower(email) = lower(?1)`,
    ).bind(email, firstName ?? 'E2E', studentNumberFromEmail(email), now),
    D.prepare(
      `INSERT OR IGNORE INTO class_schedules (member_id, term_id, submitted_at, updated_at)
       SELECT m.id, t.id, ?2, ?2 FROM members m, terms t WHERE lower(m.email) = lower(?1) AND t.is_active = 1`,
    ).bind(email, now),
  ]);

  const { cookies } = await test.login({ userId });
  for (const k of cookies) {
    c.header('Set-Cookie', `${k.name}=${k.value}; Path=${k.path}; HttpOnly; SameSite=Lax${k.secure ? '; Secure' : ''}`, { append: true });
  }
  const member = await D.prepare(`SELECT id FROM members WHERE lower(email) = lower(?1)`).bind(email).first<{ id: number }>();
  return c.json({ memberId: member?.id ?? null });
});
