import { expect, request, type APIRequestContext, type Page } from '@playwright/test';

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
