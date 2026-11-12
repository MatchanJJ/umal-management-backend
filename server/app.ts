import { Hono } from 'hono';
import { ZodError } from 'zod';
import { createAuth } from './auth';
import type { AppEnv } from './env';
import { apiError } from './errors';
import { accessRequests } from './routes/access';
import { aiSessions } from './routes/ai';
import { assignments } from './routes/assignments';
import { attendance } from './routes/attendance';
import { audit } from './routes/audit';
import { catalog } from './routes/catalog';
import { events } from './routes/events';
import { me } from './routes/me';
import { members } from './routes/members';
import { reports } from './routes/reports';
import { settings } from './routes/settings';
import { terms } from './routes/terms';
import { testLogin } from './routes/test-login';

export const app = new Hono<AppEnv>().basePath('/api');

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return apiError(c, 400, 'VALIDATION', 'Invalid input', err.issues);
  }
  console.error(err);
  return apiError(c, 500, 'INTERNAL', 'Internal error');
});

app.notFound((c) => apiError(c, 404, 'NOT_FOUND', 'Not found'));

app.on(['GET', 'POST'], '/auth/*', (c) => createAuth(c.env).handler(c.req.raw));

export const routes = app
  .get('/health', async (c) => {
    const row = await c.env.DB.prepare('SELECT 1 AS one').first<{ one: number }>();
    return c.json({ ok: true, db: row?.one === 1 });
  })
  .route('/me', me)
  .route('/access-requests', accessRequests)
  .route('/catalog', catalog)
  .route('/members', members)
  .route('/events', events)
  .route('/events', attendance)
  .route('/assignments', assignments)
  .route('/ai-sessions', aiSessions)
  .route('/settings', settings)
  .route('/terms', terms)
  .route('/test', testLogin)
  .route('/reports', reports)
  .route('/audit', audit);

export type AppType = typeof routes;
