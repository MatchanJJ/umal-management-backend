import { expect, test, type Page } from '@playwright/test';
import { apiAs, ensureTerm, runId, signInAs } from './helpers';

// The local API runs with AI_PROVIDER=fake (playwright.config.ts), a deterministic parser — no real LLM calls.
test.beforeEach(async ({ page }) => {
  await signInAs(page, `e2e.ai.adviser.x${runId}@umindanao.edu.ph`, 'adviser', 'Adviser');
  await ensureTerm(page);
  // Assignable members (test login: female, CCE, schedule submitted for the active term).
  for (const n of ['one', 'two', 'three']) await apiAs(`ai.${n}.x${runId}@umindanao.edu.ph`, 'member', `Ai${n}${runId}`);
});

async function createEvent(page: Page, body: object): Promise<number> {
  const res = await page.request.post('/api/events', { data: body });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

async function openAssignAI(page: Page, id: number) {
  await page.goto(`/events/view/?id=${id}`);
  await page.getByRole('tab', { name: 'AssignAI' }).click();
  await expect(page.getByLabel('Message AssignAI')).toBeVisible();
}

async function say(page: Page, text: string) {
  await page.getByLabel('Message AssignAI').fill(text);
  await page.getByLabel('Message AssignAI').press('Enter');
  await expect(page.getByLabel('Conversation').getByText(text)).toBeVisible();
  await expect(page.getByLabel('AssignAI is thinking')).toHaveCount(0);
}

const rosterCount = async (page: Page, id: number) =>
  ((await (await page.request.get(`/api/events/${id}/roster`)).json()) as { shifts: { assignments: unknown[] }[] }).shifts.reduce((n, s) => n + s.assignments.length, 0);

test('assignai_happy_path', async ({ page }) => {
  const id = await createEvent(page, { title: `AI fair ${runId}`, startAt: '2027-10-04T08:00', endAt: '2027-10-04T12:00', requiredVolunteers: 3 });
  await openAssignAI(page, id);
  await say(page, 'need 2 girls from CCE');

  const picks = page.getByRole('region', { name: 'Recommendations' });
  await expect(picks.getByText('Group 1 · 2 × Female · CCE')).toBeVisible();
  await expect(picks.getByRole('button', { name: /^Remove .* from the picks$/ })).toHaveCount(2);

  await picks.getByRole('button', { name: 'Approve 2' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve 2' }).click();
  await expect(page.getByText('2 assignments across 1 shift')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Roster' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Main' }).getByText('2 / 3')).toBeVisible();
});

test('confirm_text_does_not_assign', async ({ page }) => {
  const id = await createEvent(page, { title: `AI confirm ${runId}`, startAt: '2027-10-05T08:00', endAt: '2027-10-05T12:00', requiredVolunteers: 2 });
  await openAssignAI(page, id);
  await say(page, 'yes assign them');
  await expect(page.getByLabel('Conversation').getByText(/press Approve/i)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recommendations' }).getByRole('button', { name: /^Approve \d+$/ })).toBeVisible();
  expect(await rosterCount(page, id)).toBe(0);
});

test('same_team_three_days', async ({ page }) => {
  const id = await createEvent(page, {
    title: `AI summit ${runId}`,
    shifts: [
      { label: 'Day 1', startAt: '2027-10-06T08:00', endAt: '2027-10-06T17:00', requiredVolunteers: 2 },
      { label: 'Day 2', startAt: '2027-10-07T08:00', endAt: '2027-10-07T17:00', requiredVolunteers: 2 },
      { label: 'Day 3', startAt: '2027-10-08T08:00', endAt: '2027-10-08T17:00', requiredVolunteers: 2 },
    ],
  });
  await openAssignAI(page, id);
  await expect(page.getByRole('button', { name: 'All shifts' })).toHaveAttribute('aria-pressed', 'true');
  await say(page, 'same 2 people all 3 days');
  await expect(page.getByRole('radio', { name: 'Same team for all' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Assigned to all 3 shifts')).toBeVisible();

  await page.getByRole('region', { name: 'Recommendations' }).getByRole('button', { name: 'Approve 6' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approve 6' }).click();
  await expect(page.getByText('6 assignments across 3 shifts')).toBeVisible();

  const roster = (await (await page.request.get(`/api/events/${id}/roster`)).json()) as { shifts: { assignments: { memberId: number }[] }[] };
  const ids = roster.shifts.flatMap((s) => s.assignments.map((a) => a.memberId));
  expect(ids).toHaveLength(6);
  expect(new Set(ids).size).toBe(2);
});
