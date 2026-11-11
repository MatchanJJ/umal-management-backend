import { env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { signIn } from './helpers/auth';

type Row = { capability: string; method: string; path: string; body?: unknown; member: number; adviser: number };

// TRD §5 permission matrix: one representative endpoint per capability.
const MATRIX: Row[] = [
  { capability: 'own assignments', method: 'GET', path: '/api/me/assignments', member: 200, adviser: 200 },
  // Real validation now runs: an empty body reaching 400 proves the adviser passed the role guard.
  { capability: 'events CRUD', method: 'POST', path: '/api/events', body: {}, member: 403, adviser: 400 },
  { capability: 'attendance', method: 'PUT', path: '/api/events/1/attendance', body: {}, member: 403, adviser: 400 },
  { capability: 'access requests', method: 'GET', path: '/api/access-requests', member: 403, adviser: 200 },
  { capability: 'role changes', method: 'PATCH', path: '/api/members/1', body: { role: 'adviser' }, member: 403, adviser: 200 },
  { capability: 'settings', method: 'PUT', path: '/api/settings', body: {}, member: 403, adviser: 200 },
  { capability: 'fairness report', method: 'GET', path: '/api/reports/fairness', member: 403, adviser: 200 },
];

function call(row: Pick<Row, 'method' | 'path' | 'body'>, headers?: Headers) {
  const h = new Headers(headers);
  if (row.body !== undefined) h.set('content-type', 'application/json');
  return SELF.fetch(`http://x${row.path}`, {
    method: row.method,
    headers: h,
    body: row.body === undefined ? undefined : JSON.stringify(row.body),
  });
}

describe('authz_matrix', () => {
  let member: Headers;
  let adviser: Headers;
  beforeAll(async () => {
    member = (await signIn(env, { role: 'member' })).headers;
    adviser = (await signIn(env, { role: 'adviser' })).headers;
  });

  for (const row of MATRIX) {
    it(`${row.capability}: member ${row.member}, adviser ${row.adviser}`, async () => {
      const m = await call(row, member);
      expect(m.status).toBe(row.member);
      if (row.member === 403) expect(await m.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
      const a = await call(row, adviser);
      expect(a.status).toBe(row.adviser);
    });
  }
});

describe('middleware chain', () => {
  const row = MATRIX[0]; // GET /api/me/assignments: any approved, onboarded member

  it('no session → 401 UNAUTHENTICATED', async () => {
    const res = await call(row);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('pending access → 403 ACCESS_PENDING', async () => {
    const { headers } = await signIn(env, { access: 'pending' });
    const res = await call(row, headers);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'ACCESS_PENDING' } });
  });

  it('rejected access → 403 ACCESS_REJECTED', async () => {
    const { headers } = await signIn(env, { access: 'rejected' });
    const res = await call(row, headers);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'ACCESS_REJECTED' } });
  });

  it('inactive member → 403 FORBIDDEN', async () => {
    const { headers } = await signIn(env, { status: 'inactive' });
    const res = await call(row, headers);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('not onboarded → 403 ONBOARDING_REQUIRED', async () => {
    const { headers } = await signIn(env, { onboarded: false });
    const res = await call(row, headers);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'ONBOARDING_REQUIRED' } });
  });

  it('GET /api/me stays reachable while pending (onboarding/access screens need it)', async () => {
    const { headers } = await signIn(env, { access: 'pending' });
    const res = await SELF.fetch('http://x/api/me', { headers });
    expect(res.status).toBe(200);
  });
});
