import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { app } from '../../server/app';

// Hono freezes its router on the first request, so test-only routes are registered up front.
app.get('/__test/zod', () => {
  z.object({ n: z.number() }).parse({ n: 'x' });
  throw new Error('unreachable');
});
app.get('/__test/boom', () => {
  throw new Error('secret detail');
});

describe('error shape', () => {
  it('maps a thrown ZodError to 400 VALIDATION', async () => {
    const res = await app.request('/api/__test/zod', {}, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details: unknown[] } };
    expect(body.error.code).toBe('VALIDATION');
    expect(body.error.details).toHaveLength(1);
  });

  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const res = await app.request('/api/nope', {}, env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  it('returns 500 INTERNAL without leaking the message', async () => {
    const res = await app.request('/api/__test/boom', {}, env);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: 'INTERNAL', message: 'Internal error' } });
  });
});
