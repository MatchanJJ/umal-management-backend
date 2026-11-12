import { expect, request, type APIRequestContext, type Browser, type Page } from '@playwright/test';

export const BASE = 'http://localhost:3100';
/** Unique per run: the local D1 keeps data between runs. */
export const runId = Date.now().toString().slice(-6);

/** Signs `page` in through the ENV-gated test login (the cookie lands in the page's context). */
export async function signInAs(page: Page, email: string, role: 'member' | 'adviser', firstName?: string) {
  const res = await page.request.post('/api/test/login', { data: { email, role, firstName } });
  expect(res.status(), await res.text()).toBe(200);
}

/** A separate signed-in API context, so creating members never replaces the page's adviser session. */
export async function apiAs(email: string, role: 'member' | 'adviser', firstName?: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL: BASE });
  const res = await ctx.post('/api/test/login', { data: { email, role, firstName } });
  expect(res.status(), await res.text()).toBe(200);
  return ctx;
}

/** Unique test email; the x keeps it from looking like a student-number email (6 digits before @). */
export const email = (tag: string) => `${tag}.x${runId}@umindanao.edu.ph`;

type LoginOpts = { role?: 'member' | 'adviser'; firstName?: string; onboarded?: boolean; access?: 'approved' | 'pending' };
/** A second browser user (own cookies) signed in through the test login; returns its page. */
export async function userPage(browser: Browser, address: string, opts: LoginOpts = {}): Promise<Page> {
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  const res = await page.request.post('/api/test/login', { data: { email: address, role: opts.role ?? 'member', ...opts } });
  expect(res.status(), await res.text()).toBe(200);
  return page;
}

/** Creates an event over the API (as the page's adviser) and optionally publishes it; returns the event with shifts. */
export async function apiEvent(page: Page, body: object, publish = true) {
  const res = await page.request.post('/api/events', { data: body });
  expect(res.status(), await res.text()).toBe(201);
  let ev = (await res.json()) as { id: number; version: number; shifts: { id: number; label: string }[] };
  if (publish) {
    const p = await page.request.patch(`/api/events/${ev.id}`, { data: { status: 'published', expectedVersion: ev.version } });
    expect(p.status(), await p.text()).toBe(200);
    ev = await p.json();
  }
  return ev;
}

/** Assigns members to one shift over the API (manual source). */
export async function apiAssign(page: Page, eventId: number, shiftId: number, memberIds: number[]) {
  const ev = (await (await page.request.get(`/api/events/${eventId}`)).json()) as { version: number };
  const res = await page.request.post(`/api/events/${eventId}/assignments`, { data: { expectedVersion: ev.version, source: 'manual', items: [{ shiftId, memberIds }] } });
  expect(res.status(), await res.text()).toBe(201);
}

/** Ensures an active term covers the e2e dates (2027-08-02 … 2027-08-04). */
export async function ensureTerm(page: Page) {
  const terms = (await (await page.request.get('/api/terms')).json()) as { id: number; startDate: string; endDate: string; isActive: boolean }[];
  let term = terms.find((t) => t.startDate <= '2027-08-02' && t.endDate >= '2027-08-04');
  if (!term) {
    const res = await page.request.post('/api/terms', { data: { name: `E2E term ${runId}`, startDate: '2027-07-01', endDate: '2027-12-15' } });
    expect(res.status(), await res.text()).toBe(201);
    term = await res.json();
  }
  if (!term!.isActive) expect((await page.request.post(`/api/terms/${term!.id}/activate`)).status()).toBe(200);
}
