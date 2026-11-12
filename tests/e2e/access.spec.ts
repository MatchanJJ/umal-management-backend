import { expect, test } from '@playwright/test';
import { email, ensureTerm, signInAs, userPage } from './helpers';

// App Flow §1–§2: new sign-ins wait in the access queue; advisers approve, reject or bulk pre-approve.
test.beforeEach(async ({ page }) => {
  await signInAs(page, email('e2e.access.adviser'), 'adviser', 'Adviser');
  await ensureTerm(page);
});

test('pending_user_is_approved_and_lands_on_onboarding', async ({ page, browser }) => {
  const who = email('e2e.waiting.one');
  const waiting = await userPage(browser, who, { access: 'pending' });
  await waiting.goto('/');
  await expect(waiting).toHaveURL(/\/access\/pending\/$/);
  await expect(waiting.getByRole('heading', { name: 'Your request was sent to UMAL advisers' })).toBeVisible();

  // Adviser: badge on the nav, then approve from the Pending tab.
  await page.goto('/access/');
  const row = page.getByRole('row').filter({ hasText: who });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Approve as member' }).click();
  await expect(page.getByText(`Approved ${who} as member`)).toBeVisible();
  await page.getByRole('tab', { name: 'Approved' }).click();
  await expect(page.getByRole('row').filter({ hasText: who })).toBeVisible();

  // The waiting user moves on to onboarding without signing in again.
  await waiting.goto('/');
  await expect(waiting).toHaveURL(/\/onboarding\/$/);
});

test('rejected_user_sees_the_rejected_screen', async ({ page, browser }) => {
  const who = email('e2e.waiting.two');
  const waiting = await userPage(browser, who, { access: 'pending' });
  await page.goto('/access/');
  await page.getByRole('row').filter({ hasText: who }).getByRole('button', { name: 'Reject' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reject access request' });
  await dialog.getByLabel('Note (optional, advisers only)').fill('Not a UMAL member');
  await dialog.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText(`Rejected ${who}`)).toBeVisible();
  await page.getByRole('tab', { name: 'Rejected' }).click();
  await expect(page.getByRole('row').filter({ hasText: who })).toBeVisible();

  await waiting.goto('/');
  await expect(waiting).toHaveURL(/\/access\/rejected\/$/);
  await expect(waiting.getByRole('heading', { name: "Your access request wasn't approved" })).toBeVisible();
  // A rejected user can't reach member pages either.
  await waiting.goto('/me/');
  await expect(waiting).toHaveURL(/\/access\/rejected\/$/);
});

test('bulk_preapprove_counts_valid_and_invalid_then_skips_the_queue', async ({ page, browser }) => {
  const [a, b] = [email('e2e.bulk.one'), email('e2e.bulk.two')];
  await page.goto('/access/');
  await page.getByRole('tab', { name: 'Bulk pre-approve' }).click();
  await page.getByLabel('Emails').fill(`${a}\n${b}, not-an-email\n${a}`);
  await expect(page.getByRole('definition').filter({ hasText: /^2$/ })).toBeVisible(); // valid (deduped)
  await expect(page.getByRole('definition').filter({ hasText: /^1$/ })).toBeVisible(); // invalid
  await page.getByRole('button', { name: 'Pre-approve' }).click();
  await expect(page.getByText(/Pre-approved 2/)).toBeVisible();

  // A pre-approved person signing in goes straight to onboarding.
  const newcomer = await userPage(browser, a, { access: 'pending', onboarded: false });
  await newcomer.goto('/');
  await expect(newcomer).toHaveURL(/\/onboarding\/$/);
});

test('member_cannot_open_adviser_pages', async ({ browser }) => {
  const member = await userPage(browser, email('e2e.nosy.member'));
  for (const path of ['/dashboard/', '/members/', '/access/', '/audit/', '/reports/fairness/', '/settings/', '/events/new/']) {
    await member.goto(path);
    await expect(member.getByRole('heading', { name: "You don't have access to this page" }), path).toBeVisible();
  }
  // The API refuses too, not just the UI.
  expect((await member.request.get('/api/members')).status()).toBe(403);
  expect((await member.request.get('/api/audit')).status()).toBe(403);
});
