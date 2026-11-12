import { expect, test, type Page } from '@playwright/test';
import { apiAssign, apiEvent, email, ensureTerm, runId, signInAs, userPage } from './helpers';

// Adviser event lifecycle beyond the happy path: edit, unpublish rules, cancel cascade, roster removal,
// class-conflict override, capacity, and the status tabs.
test.beforeEach(async ({ page }) => {
  await signInAs(page, email('e2e.events.adviser'), 'adviser', 'Adviser');
  await ensureTerm(page);
});

const memberId = async (p: Page) => ((await (await p.request.get('/api/me')).json()) as { member: { id: number } }).member.id;

test('edit_event_title_and_add_a_shift', async ({ page }) => {
  const ev = await apiEvent(page, { title: `Draft fair ${runId}`, startAt: '2027-08-09T08:00', endAt: '2027-08-09T12:00', requiredVolunteers: 2 }, false);
  await page.goto(`/events/edit/?id=${ev.id}`);
  await page.getByLabel('Title').fill(`Career fair ${runId}`);
  await page.getByRole('button', { name: 'Add shift' }).click();
  await page.getByLabel('Label').nth(1).fill('Afternoon');
  await page.getByLabel('Starts').nth(1).fill('2027-08-09T13:00');
  await page.getByLabel('Ends').nth(1).fill('2027-08-09T17:00');
  await page.getByLabel('Needed').nth(1).fill('3');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Event saved')).toBeVisible();
  await expect(page.getByRole('heading', { name: `Career fair ${runId}` })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Afternoon' }).getByText('0 / 3')).toBeVisible();
  await page.getByRole('tab', { name: 'Activity' }).click();
  await expect(page.getByRole('cell', { name: 'Event update' }).first()).toBeVisible();
});

test('unpublish_needs_an_empty_roster_and_cancel_cascades_to_members', async ({ page, browser }) => {
  const first = `Cas${runId}`;
  const member = await userPage(browser, email('e2e.cascade'), { firstName: first });
  const ev = await apiEvent(page, { title: `Doomed ${runId}`, startAt: '2027-08-10T08:00', endAt: '2027-08-10T12:00', requiredVolunteers: 2 });
  await apiAssign(page, ev.id, ev.shifts[0].id, [await memberId(member)]);
  await member.goto('/me/');
  await expect(member.getByRole('region', { name: 'Upcoming shifts' }).getByText(`Doomed ${runId}`)).toBeVisible();

  await page.goto(`/events/view/?id=${ev.id}`);
  await expect(page.getByRole('button', { name: 'Unpublish' })).toBeDisabled(); // volunteers first
  await page.getByRole('button', { name: 'Cancel event' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Cancel event' })).toBeDisabled(); // reason required
  await dialog.getByLabel('Reason').fill('Typhoon signal no. 2');
  await dialog.getByRole('button', { name: 'Cancel event' }).click();
  await expect(page.getByText('Event cancelled')).toBeVisible();
  await expect(page.getByText('Cancelled: Typhoon signal no. 2')).toBeVisible();
  // Read-only now.
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add volunteers' })).toHaveCount(0);

  await member.reload();
  await expect(member.getByRole('region', { name: 'Upcoming shifts' }).getByText(`Doomed ${runId}`)).toHaveCount(0);
});

test('remove_a_volunteer_needs_a_reason', async ({ page, browser }) => {
  const [a, b] = [`Rem${runId}`, `Kep${runId}`];
  const ma = await memberId(await userPage(browser, email('e2e.remove.a'), { firstName: a }));
  const mb = await memberId(await userPage(browser, email('e2e.remove.b'), { firstName: b }));
  const ev = await apiEvent(page, { title: `Roster ${runId}`, startAt: '2027-08-11T08:00', endAt: '2027-08-11T12:00', requiredVolunteers: 3 });
  await apiAssign(page, ev.id, ev.shifts[0].id, [ma, mb]);
  await page.goto(`/events/view/?id=${ev.id}`);
  const main = page.getByRole('region', { name: 'Main' });
  await expect(main.getByText('2 / 3')).toBeVisible();

  await main.getByRole('button', { name: `Actions for ${a} Tester` }).click();
  await page.getByRole('menuitem', { name: 'Remove from shift' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Reason').fill('ab');
  await expect(dialog.getByRole('button', { name: 'Remove' })).toBeDisabled(); // at least 3 characters
  await dialog.getByLabel('Reason').fill('Exam schedule');
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText(`Removed ${a} Tester`)).toBeVisible();
  await expect(main.getByText('1 / 3')).toBeVisible();
  await expect(main.getByText(`${b} Tester`)).toBeVisible();

  // The member's record shows the cancelled assignment.
  await page.goto(`/members/view/?id=${ma}`);
  await expect(page.getByRole('region', { name: 'Assignment history' }).getByText('Cancelled')).toBeVisible();
});

test('class_conflict_needs_an_explicit_override', async ({ page, browser }) => {
  const first = `Cls${runId}`;
  const member = await userPage(browser, email('e2e.conflict'), { firstName: first });
  const termId = ((await (await member.request.get('/api/me')).json()) as { activeTerm: { id: number } }).activeTerm.id;
  // Tuesday 08:00–10:00 class; the event below is on Tuesday 2027-08-03.
  const put = await member.request.put('/api/me/schedule', { data: { termId, entries: [{ dayOfWeek: 2, startTime: '08:00', endTime: '10:00', label: 'Math' }] } });
  expect(put.status(), await put.text()).toBe(200);
  const ev = await apiEvent(page, { title: `Conflict ${runId}`, startAt: '2027-08-03T09:00', endAt: '2027-08-03T11:00', requiredVolunteers: 2 });

  await page.goto(`/events/view/?id=${ev.id}`);
  await page.getByRole('button', { name: 'Add volunteers' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Search members').fill(first);
  const row = dialog.locator('li', { hasText: first });
  await expect(row.getByText('Class conflict')).toBeVisible();
  await row.getByRole('checkbox').first().check();
  // Without the override the server refuses.
  await dialog.getByRole('button', { name: /^Add 1$/ }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await row.getByRole('checkbox', { name: 'Override class conflict' }).check();
  await dialog.getByRole('button', { name: /^Add 1$/ }).click();
  await expect(page.getByText('Added 1 to Main')).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('region', { name: 'Main' }).getByText('Class conflict overridden')).toBeVisible();
});

test('a_shift_cannot_be_overfilled', async ({ page, browser }) => {
  const [a, b] = [`Ovr${runId}`, `Ovs${runId}`];
  await userPage(browser, email('e2e.over.a'), { firstName: a });
  await userPage(browser, email('e2e.over.b'), { firstName: b });
  const ev = await apiEvent(page, { title: `Tiny ${runId}`, startAt: '2027-08-12T08:00', endAt: '2027-08-12T09:00', requiredVolunteers: 1 });
  await page.goto(`/events/view/?id=${ev.id}`);
  await page.getByRole('button', { name: 'Add volunteers' }).click();
  const dialog = page.getByRole('dialog');
  for (const n of [a, b]) {
    await dialog.getByLabel('Search members').fill(n);
    await dialog.locator('label', { hasText: n }).getByRole('checkbox').first().check();
  }
  await expect(dialog.getByRole('button', { name: /^Add 2$/ })).toBeDisabled();
});

test('events_list_tabs_filter_by_status', async ({ page }) => {
  await apiEvent(page, { title: `Tab draft ${runId}`, startAt: '2027-08-13T08:00', endAt: '2027-08-13T10:00', requiredVolunteers: 1 }, false);
  await apiEvent(page, { title: `Tab live ${runId}`, startAt: '2027-08-13T08:00', endAt: '2027-08-13T10:00', requiredVolunteers: 1 });
  await page.goto('/events/');
  await page.getByRole('tab', { name: 'Draft' }).click();
  await expect(page.getByText(`Tab draft ${runId}`)).toBeVisible();
  await expect(page.getByText(`Tab live ${runId}`)).toHaveCount(0);
  await page.getByRole('tab', { name: 'Published' }).click();
  await expect(page.getByText(`Tab live ${runId}`)).toBeVisible();
  await expect(page.getByText(`Tab draft ${runId}`)).toHaveCount(0);
});
