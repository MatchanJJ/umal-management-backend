import { Hono } from 'hono';
import { ZodError } from 'zod';
import type { AppEnv } from './env';
import { apiError } from './errors';

export const app = new Hono<AppEnv>().basePath('/api');

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return apiError(c, 400, 'VALIDATION', 'Invalid input', err.issues);
  }
  console.error(err);
  return apiError(c, 500, 'INTERNAL', 'Internal error');
});

app.notFound((c) => apiError(c, 404, 'NOT_FOUND', 'Not found'));

export const routes = app.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS one').first<{ one: number }>();
  return c.json({ ok: true, db: row?.one === 1 });
});

export type AppType = typeof routes;
