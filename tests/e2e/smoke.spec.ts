import { expect, test, type Page } from '@playwright/test';
import { manilaNow } from '../../shared/time';
import { BASE, runId, signInAs } from './helpers';

// TRD §11 smoke: login → onboarding → schedule → adviser creates event → AssignAI → approve → attendance → fairness.
// Attendance needs an ended shift and assignments need one that hasn't ended, so the event's only shift ends ~2 min
// from now and the test waits for it in real time (no test-only clock). The AI is the local fake (playwright.config).
test.setTimeout(6 * 60_000);

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** An active term containing today (Manila). Reuses one from an earlier run; other specs re-activate theirs. */
async function activateTodayTerm(page: Page) {
  const today = manilaNow().slice(0, 10);
  const terms = (await (await page.request.get('/api/terms')).json()) as { id: number; startDate: string; endDate: string; isActive: boolean }[];
  let term = terms.find((t) => t.startDate <= today && t.endDate >= today);
  if (!term) {
    const res = await page.request.post('/api/terms', { data: { name: `Smoke ${today}`, startDate: today, endDate: addDays(today, 1) } });
    expect(res.status(), await res.text()).toBe(201);
    term = await res.json();
  }
  if (!term!.isActive) expect((await page.request.post(`/api/terms/${term!.id}/activate`)).status()).toBe(200);
}

async function pick(page: Page, label: string, option: string | RegExp) {
  await page.getByLabel(label).click();
  await page.getByRole('option', { name: option }).click();
}

test('smoke_full_flow', async ({ page, browser }) => {
  const first = `Smoke${runId}`;
  const fullName = `${first} Member`;

  // ── Adviser: a term for today, active.
  await signInAs(page, `e2e.smoke.adviser.x${runId}@umindanao.edu.ph`, 'adviser', 'Adviser');
  await activateTodayTerm(page);

  // ── Member: first sign-in → onboarding → schedule.
  const memberCtx = await browser.newContext({ baseURL: BASE });
  const member = await memberCtx.newPage();
  const login = await member.request.post('/api/test/login', { data: { email: `s.member.x${runId}@umindanao.edu.ph`, role: 'member', onboarded: false } });
  expect(login.status(), await login.text()).toBe(200);
  await member.goto('/');
  await expect(member).toHaveURL(/\/onboarding\/$/);
  await member.getByLabel('First name').fill(first);
  await member.getByLabel('Last name').fill('Member');
  await pick(member, 'Gender', 'Female');
  await member.getByLabel('Batch year (school year you joined)').fill('2025');
  await member.getByLabel('Height (cm)').fill('165');
  await pick(member, 'T-shirt size', 'M');
  await member.getByRole('button', { name: 'Next', exact: true }).click();
  await pick(member, 'College', /^CAE ·/);
  await pick(member, 'Year level', 'Year 3');
  await member.getByRole('button', { name: 'Finish' }).click();
  await expect(member).toHaveURL(/\/me\/schedule\/$/);
  await member.getByRole('button', { name: 'Submit schedule' }).click(); // no classes this term
  await expect(member.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await memberCtx.close();

  // ── Adviser: an event whose only shift ends in ~2 minutes, published.
  const now = manilaNow();
  const end = manilaNow(Date.now() + 2 * 60_000 + 60_000 - (Date.now() % 60_000)); // next minute + 2
  await page.goto('/events/new/');
  await page.getByLabel('Title').fill(`Smoke fair ${runId}`);
  await page.getByLabel('Starts').fill(now);
  await page.getByLabel('Ends').fill(end);
  await page.getByLabel('Volunteers needed').fill('1');
  await page.getByRole('button', { name: 'Create event' }).click();
  await expect(page.getByRole('heading', { name: `Smoke fair ${runId}` })).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
  const eventUrl = page.url();

  // ── AssignAI: pin the new member, ask, approve.
  await page.getByRole('tab', { name: 'AssignAI' }).click();
  await page.getByLabel('Search a member to pin').fill(first);
  await page.getByRole('listitem').filter({ hasText: fullName }).getByRole('button', { name: 'Pin' }).click();
  await page.getByLabel('Message AssignAI').fill('need 1 from CAE');
  await page.getByLabel('Message AssignAI').press('Enter');
  await expect(page.getByLabel('AssignAI is thinking')).toHaveCount(0);
  const picks = page.getByRole('region', { name: 'Recommendations' });
  await expect(picks.getByText(fullName)).toBeVisible();
  await picks.getByRole('button', { name: 'Approve 1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve 1' }).click();
  await expect(page.getByText('1 assignment across 1 shift')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Main' }).getByText(fullName)).toBeVisible();

  // ── Attendance once the shift has ended.
  await page.waitForTimeout(Math.max(0, Date.parse(`${end}:00+08:00`) - Date.now()) + 2_000);
  await page.goto(eventUrl);
  await page.getByRole('tab', { name: 'Attendance' }).click();
  await page.getByRole('button', { name: 'Mark all attended' }).click();
  await page.getByRole('button', { name: 'Save attendance' }).click();
  await expect(page.getByText('Attendance saved. The event is now completed.')).toBeVisible();

  // ── Fairness report for the active term counts the shift.
  await page.goto('/reports/fairness/');
  const row = page.getByRole('row').filter({ hasText: fullName });
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell').nth(3)).toHaveText('1'); // shifts
  await expect(row.getByRole('cell').nth(4)).toHaveText('1'); // attended
});
