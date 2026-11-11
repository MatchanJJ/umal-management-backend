import { expect, test, type Page } from '@playwright/test';
import { apiAs, ensureTerm, runId, signInAs } from './helpers';

test.beforeEach(async ({ page }) => {
  await signInAs(page, `e2e.adviser.${runId}@umindanao.edu.ph`, 'adviser', 'Adviser');
  await ensureTerm(page);
});

/** Search the add-volunteers dialog and tick one member. */
async function pick(page: Page, name: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Search members').fill(name);
  await dialog.locator('label', { hasText: name }).getByRole('checkbox').first().check();
}

test('adviser_creates_event_and_adds_two_members', async ({ page }) => {
  const [a, b] = [`Ana${runId}`, `Ben${runId}`];
  // Created after the term is active, so the test login submits their (empty) schedule for it.
  await apiAs(`a.one.${runId}1@umindanao.edu.ph`, 'member', a);
  await apiAs(`b.two.${runId}2@umindanao.edu.ph`, 'member', b);

  await page.goto('/events/new/');
  await page.getByLabel('Title').fill(`Open House ${runId}`);
  await page.getByLabel('Starts').fill('2027-08-02T08:00');
  await page.getByLabel('Ends').fill('2027-08-02T12:00');
  await page.getByLabel('Volunteers needed').fill('4');
  await page.getByRole('button', { name: 'Create event' }).click();

  await expect(page.getByRole('heading', { name: `Open House ${runId}` })).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();

  await page.getByRole('button', { name: 'Add volunteers' }).click();
  await pick(page, a);
  await pick(page, b);
  await page.getByRole('dialog').getByRole('button', { name: /^Add 2$/ }).click();
  await expect(page.getByText('Added 2 to Main')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

  const main = page.getByRole('region', { name: 'Main' });
  await expect(main.getByText('2 / 4')).toBeVisible();
  await expect(main.getByText(`${a} Tester`)).toBeVisible();
});

test('daily_event_staffs_two_shifts', async ({ page }) => {
  const c = `Cara${runId}`;
  await apiAs(`c.three.${runId}3@umindanao.edu.ph`, 'member', c);

  await page.goto('/events/new/');
  await page.getByLabel('Title').fill(`Summit ${runId}`);
  await page.getByRole('tab', { name: 'Daily block' }).click();
  await page.getByLabel('From', { exact: true }).fill('2027-08-03');
  await page.getByLabel('To', { exact: true }).fill('2027-08-04');
  await page.getByLabel('Daily start').fill('08:00');
  await page.getByLabel('Daily end').fill('17:00');
  await page.getByLabel('Volunteers per day').fill('3');
  await page.getByRole('button', { name: 'Create event' }).click();
  await expect(page.getByRole('heading', { name: `Summit ${runId}` })).toBeVisible();

  await page.getByRole('region', { name: 'Day 1' }).getByRole('button', { name: 'Add volunteers' }).click();
  await pick(page, c);
  await page.getByRole('dialog').getByRole('button', { name: /^Add 1$/ }).click();
  await expect(page.getByText('Added 1 to Day 1')).toBeVisible();

  // Same member on Day 2 via the dialog's shift switcher.
  await page.getByRole('dialog').getByRole('button', { name: /Day 2/ }).click();
  await pick(page, c);
  await page.getByRole('dialog').getByRole('button', { name: /^Add 1$/ }).click();
  await expect(page.getByText('Added 1 to Day 2')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('region', { name: 'Day 1' }).getByText('1 / 3')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Day 2' }).getByText('1 / 3')).toBeVisible();
});
