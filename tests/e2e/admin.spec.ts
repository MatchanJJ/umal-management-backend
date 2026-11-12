import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { apiAssign, apiEvent, email, ensureTerm, runId, signInAs, userPage } from './helpers';

// Adviser admin areas: members (role, deactivate), audit filters, settings tabs, fairness report + CSV, dashboard links.
test.beforeEach(async ({ page }) => {
  await signInAs(page, email('e2e.admin.adviser'), 'adviser', 'Adviser');
  await ensureTerm(page);
});

const memberId = async (p: Page) => ((await (await p.request.get('/api/me')).json()) as { member: { id: number } }).member.id;
async function choose(page: Page, label: string, option: string | RegExp) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option', { name: option }).click();
}

test('members_search_and_role_change_round_trip', async ({ page, browser }) => {
  const first = `Rol${runId}`;
  const id = await memberId(await userPage(browser, email('e2e.role'), { firstName: first }));
  await page.goto('/members/');
  await page.getByRole('searchbox', { name: 'Search' }).fill(first);
  await expect(page.getByRole('link', { name: `${first} Tester` })).toBeVisible();
  await page.getByRole('link', { name: `${first} Tester` }).click();
  await expect(page).toHaveURL(new RegExp(`/members/view/\\?id=${id}$`));

  await page.getByRole('button', { name: 'Make adviser' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Make adviser' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make member' })).toBeVisible();
  await page.goto('/members/');
  await choose(page, 'Role', 'Adviser');
  await page.getByRole('searchbox', { name: 'Search' }).fill(first);
  await expect(page.getByRole('link', { name: `${first} Tester` })).toBeVisible();

  await page.goto(`/members/view/?id=${id}`);
  await page.getByRole('button', { name: 'Make member' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Make member' }).click();
  await expect(page.getByRole('button', { name: 'Make adviser' })).toBeVisible();
});

test('deactivate_cancels_upcoming_shifts_and_locks_out_then_reactivate', async ({ page, browser }) => {
  const first = `Off${runId}`;
  const member = await userPage(browser, email('e2e.deactivate'), { firstName: first });
  const id = await memberId(member);
  const ev = await apiEvent(page, { title: `Future ${runId}`, startAt: '2027-08-16T08:00', endAt: '2027-08-16T12:00', requiredVolunteers: 2 });
  await apiAssign(page, ev.id, ev.shifts[0].id, [id]);

  await page.goto(`/members/view/?id=${id}`);
  await page.getByRole('button', { name: 'Deactivate' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/removed from their 1 upcoming shift/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Deactivate' }).click();
  await expect(page.getByText('Saved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reactivate' })).toBeVisible();

  // Off the roster, and the member's own API calls are refused.
  await page.goto(`/events/view/?id=${ev.id}`);
  await expect(page.getByRole('region', { name: 'Main' }).getByText('0 / 2')).toBeVisible();
  expect((await member.request.get('/api/me/assignments')).status()).toBe(403);

  await page.goto(`/members/view/?id=${id}`);
  await page.getByRole('button', { name: 'Reactivate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivate' }).click();
  await expect(page.getByRole('button', { name: 'Deactivate' })).toBeVisible();
  expect((await member.request.get('/api/me/assignments')).status()).toBe(200);
});

test('audit_log_filters_by_action', async ({ page }) => {
  await apiEvent(page, { title: `Audited ${runId}`, startAt: '2027-08-17T08:00', endAt: '2027-08-17T10:00', requiredVolunteers: 1 });
  await page.goto('/audit/');
  await choose(page, 'Action', 'Event create');
  const rows = page.getByRole('row').filter({ hasNot: page.getByRole('columnheader') });
  await expect(rows.first()).toContainText('Event create');
  await expect(page.getByRole('cell', { name: 'Event publish' })).toHaveCount(0);
  // A date range in the future has nothing.
  await page.getByLabel('From').fill('2099-01-01');
  await expect(page.getByRole('cell', { name: 'Event create' })).toHaveCount(0);
});

test('terms_picker_adds_edits_and_rejects_overlaps_and_duplicates', async ({ page }) => {
  await page.goto('/settings/');
  await page.getByRole('tab', { name: 'Terms' }).click();

  // Overlap with the e2e term (2027-07-01 … 2027-12-15) is refused.
  await choose(page, 'Term', '1st Semester');
  await page.locator('#term-start').fill('2027-08-01');
  await page.locator('#term-end').fill('2027-12-01');
  await page.getByRole('button', { name: 'Add term' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /^Overlaps / })).toBeVisible();

  // Summer 2028 (added on the first run; later runs see the duplicate straight away).
  const exists = ((await (await page.request.get('/api/terms')).json()) as { name: string }[]).some((t) => t.name === 'Summer 2028');
  await choose(page, 'Term', 'Summer');
  await choose(page, 'Year', '2028');
  await expect(page.getByText('Saved as Summer 2028')).toBeVisible();
  await page.locator('#term-start').fill('2028-04-01');
  await page.locator('#term-end').fill('2028-05-31');
  if (!exists) {
    await page.getByRole('button', { name: 'Add term' }).click();
    await expect(page.getByText('Added Summer 2028')).toBeVisible();
  }
  // Same name on free dates (same dates would be reported as an overlap first).
  await page.locator('#term-start').fill('2028-06-10');
  await page.locator('#term-end').fill('2028-07-10');
  await page.getByRole('button', { name: 'Add term' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'A term with this name already exists' })).toBeVisible();

  // Edit an old free-text term into the picker format and extend it (a year unique to this run).
  const y = 2100 + (Number(runId) % 800);
  const old = await page.request.post('/api/terms', { data: { name: `Typed ${runId}`, startDate: `${y}-08-01`, endDate: `${y}-12-01` } });
  expect(old.status(), await old.text()).toBe(201);
  await page.reload();
  await page.getByRole('tab', { name: 'Terms' }).click();
  await page.getByRole('button', { name: `Edit Typed ${runId}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(`(replaces “Typed ${runId}”)`)).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Term' }).click();
  await page.getByRole('option', { name: '2nd Semester' }).click();
  await dialog.locator('#edit-term-end').fill(`${y}-12-20`);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(`Saved 2nd Semester AY ${y}-${y + 1}`)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: `2nd Semester AY ${y}-${y + 1}` })).toContainText(`Dec 20, ${y}`);
});

test('catalog_adds_a_college_and_course_and_deactivates_it', async ({ page }) => {
  const code = `E2E${runId}`;
  await page.goto('/settings/');
  await page.getByRole('tab', { name: 'Colleges & Courses' }).click();
  await page.getByLabel('Code').first().fill(code);
  await page.getByLabel('Name').first().fill(`E2E College ${runId}`);
  await page.getByRole('button', { name: 'Add college' }).click();
  await expect(page.getByText(`Added ${code}`)).toBeVisible();
  const item = page.getByRole('listitem').filter({ has: page.getByRole('switch', { name: `${code} active` }) });
  await item.getByRole('button', { name: new RegExp(`^${code}`) }).click();
  await item.getByLabel('Code').fill(`C${runId}`);
  await item.getByLabel('Name').fill('E2E Course');
  await item.getByRole('button', { name: 'Add course' }).click();
  await expect(page.getByText(`Added C${runId}`)).toBeVisible();

  // Members' catalog lists it while active, not after it's switched off.
  const listed = async () => ((await (await page.request.get('/api/catalog')).json()) as { colleges: { code: string }[] }).colleges.some((c) => c.code === code);
  expect(await listed()).toBe(true);
  await page.getByRole('switch', { name: `${code} active` }).click();
  await expect(page.getByRole('switch', { name: `${code} active` })).not.toBeChecked();
  await expect.poll(listed).toBe(false);
});

test('ai_and_general_settings_validate_then_save', async ({ page }) => {
  await page.goto('/settings/');
  await page.getByRole('tab', { name: 'AI' }).click();
  const turns = page.getByLabel('Chat turns per hour, per adviser');
  await turns.fill('101');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /100/ })).toBeVisible();
  await turns.fill('40');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('AI settings saved')).toBeVisible();

  await page.getByRole('tab', { name: 'General' }).click();
  const domain = page.getByLabel('Allowed sign-in domain');
  await domain.fill('not a domain');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Enter a domain like umindanao.edu.ph')).toBeVisible();
  await domain.fill('umindanao.edu.ph');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Settings saved')).toBeVisible();
});

test('scoring_weights_save_and_preview', async ({ page }) => {
  await page.goto('/settings/');
  await page.getByRole('tab', { name: 'Scoring' }).click();
  await expect(page.getByRole('list', { name: 'Top 10 eligible members' })).toBeVisible();
  const load = page.getByRole('slider', { name: 'Load' });
  await load.focus();
  await page.keyboard.press('ArrowRight');
  await expect(load).toHaveValue('3.5');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Scoring saved')).toBeVisible();
  // Put the default back for the other specs.
  await load.focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Scoring saved').first()).toBeVisible();
  await expect(load).toHaveValue('3');
});

test('fairness_report_filters_and_exports_csv', async ({ page }) => {
  await page.goto('/reports/fairness/');
  await expect(page.getByRole('combobox', { name: 'Term' })).toContainText('(active)');
  await page.getByLabel('Never assigned only').click();
  await expect(page.getByRole('switch', { name: 'Never assigned only' })).toBeChecked();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Export CSV' }).click()]);
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv.split('\r\n')[0]).toBe('member_id,name,college,hours,shifts,attended,no_show,from_ai');
});

test('dashboard_tiles_link_to_their_pages', async ({ page }) => {
  await page.goto('/dashboard/');
  await page.getByRole('link', { name: /^Pending access/ }).click();
  await expect(page).toHaveURL(/\/access\/$/);
  await page.goto('/dashboard/');
  await page.getByRole('link', { name: /^Missing schedules/ }).click();
  await expect(page).toHaveURL(/\/members\/\?schedule=missing$/);
  await expect(page.getByRole('combobox', { name: 'Schedule' })).not.toContainText('All');
});
