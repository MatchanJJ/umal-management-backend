import { expect, test, type Page } from '@playwright/test';
import { apiAssign, apiEvent, email, ensureTerm, runId, signInAs, userPage } from './helpers';

// Everything a member does for themselves: profile, class schedule (UM day codes), availability, and what they can see.
test.beforeEach(async ({ page }) => {
  await signInAs(page, email('e2e.member.adviser'), 'adviser', 'Adviser');
  await ensureTerm(page);
});

async function choose(page: Page, label: string, option: string | RegExp) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option }).click();
}

test('member_edits_profile', async ({ browser }) => {
  const me = await userPage(browser, email('e2e.profile'), { firstName: `Pia${runId}` });
  await me.goto('/me/profile/');
  await me.getByLabel('Last name').fill('Reyes');
  await me.getByLabel('Height (cm)').fill('171');
  await choose(me, 'Course', /^BSIT ·/);
  await me.getByRole('button', { name: 'Save changes' }).click();
  await expect(me.getByText('Profile saved')).toBeVisible();
  await me.reload();
  await expect(me.getByLabel('Last name')).toHaveValue('Reyes');
  await expect(me.getByLabel('Height (cm)')).toHaveValue('171');
  await expect(me.getByRole('combobox', { name: 'Course' })).toContainText('BSIT');
  // Out-of-range input is refused in the form.
  await me.getByLabel('Height (cm)').fill('20');
  await me.getByRole('button', { name: 'Save changes' }).click();
  await expect(me.getByText('Profile saved')).toHaveCount(0);
});

test('member_enters_schedule_with_um_day_codes', async ({ browser }) => {
  const me = await userPage(browser, email('e2e.schedule'));
  await me.goto('/me/schedule/');
  const add = async (code: RegExp, start: string, end: string, label: string) => {
    await choose(me, 'Day', code);
    await me.getByLabel('Start').fill(start);
    await me.getByLabel('End').fill(end);
    await me.getByLabel('Label (optional)').fill(label);
    await me.getByRole('button', { name: 'Add class' }).click();
  };
  await add(/^M-SA1/, '08:00', '09:30', 'CS 311');
  await add(/^Fri/, '13:00', '14:30', 'PE 2');
  // A clash on one of the M-SA1 days is refused and names the day.
  await add(/^Wed/, '09:00', '10:00', 'Clash');
  await expect(me.getByText('Overlaps your CS 311 on Wednesday 08:00–09:30')).toBeVisible();
  // End before start is refused.
  await add(/^Sa/, '10:00', '09:00', 'Backwards');
  await expect(me.getByText('End time must be after the start time')).toBeVisible();

  await me.getByRole('button', { name: 'Save changes' }).click();
  await expect(me.getByText('Schedule submitted')).toBeVisible();
  await me.reload();
  await me.getByRole('switch', { name: 'List view' }).click();
  await expect(me.getByRole('listitem').filter({ hasText: 'CS 311' })).toHaveCount(3); // Mon, Tue, Wed
  await expect(me.getByRole('listitem').filter({ hasText: 'PE 2' })).toHaveCount(1);
  // Removing is per day.
  await me.getByRole('button', { name: 'Remove CS 311 Tuesday 08:00' }).click();
  await me.getByRole('button', { name: 'Save changes' }).click();
  await expect(me.getByText('Schedule submitted')).toBeVisible();
  await me.reload();
  await me.getByRole('switch', { name: 'List view' }).click();
  await expect(me.getByRole('listitem').filter({ hasText: 'CS 311' })).toHaveCount(2);
});

test('blocked_time_makes_member_unassignable_until_removed', async ({ page, browser }) => {
  const first = `Una${runId}`;
  const me = await userPage(browser, email('e2e.unavailable'), { firstName: first });
  await me.goto('/me/availability/');
  // Weekly block, whole day.
  await choose(me, 'Day', 'Saturday');
  await me.getByRole('switch', { name: 'Whole day' }).click();
  await me.getByLabel('Reason (optional)').fill('Part-time work');
  await me.getByRole('button', { name: 'Add block' }).click();
  await expect(me.getByText('Every Saturday')).toBeVisible();
  // A specific date, afternoon only.
  await me.getByRole('tab', { name: 'Specific date' }).click();
  await me.getByRole('switch', { name: 'Whole day' }).click(); // still on from the weekly block; times are disabled while it is
  await me.getByLabel('Date').fill('2027-08-04');
  await me.getByLabel('From', { exact: true }).fill('13:00');
  await me.getByLabel('To', { exact: true }).fill('17:00');
  await me.getByRole('button', { name: 'Add block' }).click();
  await expect(me.getByRole('button', { name: /^Delete .*13:00–17:00$/ })).toBeVisible();

  // Adviser: the member can't be picked for a shift inside the blocked afternoon.
  const ev = await apiEvent(page, { title: `Blocked ${runId}`, startAt: '2027-08-04T14:00', endAt: '2027-08-04T16:00', requiredVolunteers: 2 });
  await page.goto(`/events/view/?id=${ev.id}`);
  await page.getByRole('button', { name: 'Add volunteers' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Search members').fill(first);
  const row = dialog.locator('label', { hasText: first });
  await expect(row.getByText('Unavailable')).toBeVisible();
  await expect(row.getByRole('checkbox')).toBeDisabled();
  await dialog.getByRole('button', { name: 'Done' }).click();

  // Member removes the date block; now they can be picked.
  await me.getByRole('button', { name: /^Delete .*13:00–17:00$/ }).click();
  await expect(me.getByRole('button', { name: /^Delete .*13:00–17:00$/ })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Add volunteers' }).click();
  await page.getByRole('dialog').getByLabel('Search members').fill(first);
  await expect(page.getByRole('dialog').locator('label', { hasText: first }).getByRole('checkbox')).toBeEnabled();
});

test('member_sees_published_events_and_own_upcoming_shift_only', async ({ page, browser }) => {
  const first = `Vic${runId}`;
  const me = await userPage(browser, email('e2e.viewer'), { firstName: first });
  const memberId = ((await (await me.request.get('/api/me')).json()) as { member: { id: number } }).member.id;
  const draft = await apiEvent(page, { title: `Hidden draft ${runId}`, startAt: '2027-08-05T08:00', endAt: '2027-08-05T10:00', requiredVolunteers: 1 }, false);
  const pub = await apiEvent(page, { title: `Visible ${runId}`, startAt: '2027-08-06T08:00', endAt: '2027-08-06T10:00', requiredVolunteers: 2 });
  await apiAssign(page, pub.id, pub.shifts[0].id, [memberId]);

  await me.goto('/events/');
  await expect(me.getByText(`Visible ${runId}`)).toBeVisible();
  await expect(me.getByText(`Hidden draft ${runId}`)).toHaveCount(0);
  await me.goto(`/events/view/?id=${draft.id}`);
  await expect(me.getByText('Event not found.')).toBeVisible();
  // No adviser controls on the member's event view.
  await me.goto(`/events/view/?id=${pub.id}`);
  await expect(me.getByRole('heading', { name: `Visible ${runId}` })).toBeVisible();
  for (const name of ['Unpublish', 'Cancel event', 'Add volunteers']) await expect(me.getByRole('button', { name })).toHaveCount(0);

  await me.goto('/me/');
  const upcoming = me.getByRole('region', { name: 'Upcoming shifts' });
  await expect(upcoming.getByText(`Visible ${runId}`)).toBeVisible();
  await expect(upcoming.getByText(`Hidden draft ${runId}`)).toHaveCount(0);
});
