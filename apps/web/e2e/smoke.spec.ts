import { expect, test } from '@playwright/test';

// One reader's first session against the mock model service: sign up, onboard, read the feed,
// open an explanation, dismiss a pick, then hold the three-turn chat and remove a chip.
test('onboarding -> recommendations -> chat', async ({ page }) => {
  const email = `e2e-${Date.now()}@litsense.test`;

  await test.step('sign up', async () => {
    await page.goto('/register');
    await page.getByLabel('Your name').fill('Riya');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('e2e reader 2026');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  await test.step('onboard with picks and a taste sentence', async () => {
    await page.getByRole('button', { name: /^Project Hail Mary by/ }).click();
    await page.getByRole('button', { name: /^The Song of Achilles by/ }).click();
    await page.getByRole('button', { name: /^Circe by/ }).click();
    await expect(page.getByText('3 picked')).toBeVisible();
    await page
      .getByLabel('Describe your reading taste')
      .fill('I love fantasy with great characters. Nothing too dark.');
    await page.getByRole('button', { name: 'Build my front page' }).click();
    await expect(page.getByRole('heading', { name: /Here is what we/ })).toBeVisible();
    await expect(page.getByText('Likes: Fantasy')).toBeVisible();
    await page.getByRole('button', { name: 'Remove Prefers: cozy' }).click();
    await expect(page.getByText('Prefers: cozy')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show my front page' }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await expect(page.getByRole('heading', { name: /Top picks/ })).toBeVisible();
  });

  await test.step('recommendations: explain and dismiss', async () => {
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Recommendations' })
      .click();
    await expect(page.getByRole('heading', { name: 'Top picks', exact: true })).toBeVisible();
    const first = page.locator('.card--feature').first();
    const title = (await first.locator('.card__title').innerText()).trim();
    for (const picked of ['Project Hail Mary', 'The Song of Achilles', 'Circe']) {
      await expect(page.locator('.card__title', { hasText: picked })).toHaveCount(0);
    }

    await first.getByRole('button', { name: 'Explain this pick' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('In plain words')).toBeVisible();
    await expect(dialog.locator('.explain__text')).not.toBeEmpty();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await first.getByRole('button', { name: new RegExp(`Not for me: hide ${title}`) }).click();
    await expect(page.getByText('We will not suggest that one again.')).toBeVisible();
    await expect(page.locator('.card--feature .card__title', { hasText: title })).toHaveCount(0);
  });

  await test.step('chat: like X but shorter, more by that author, why the second one', async () => {
    await page.goto('/chat');
    await page.getByRole('button', { name: /like Project Hail Mary, but shorter/ }).click();
    await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}$/);
    const brief = page.locator('.chat__aside .brief');
    await expect(brief.getByText('like Project Hail Mary')).toBeVisible();
    await expect(brief.getByText(/under \d+ pages/)).toBeVisible();

    const log = page.getByRole('log', { name: 'Conversation with LitSense' });
    const composer = page.getByPlaceholder('Describe a mood, a book you loved, or a length');
    await composer.fill('more by that author');
    await composer.press('Enter');
    await expect(log.getByText('More from Andy Weir.')).toBeVisible();

    await composer.fill('why the second one?');
    await composer.press('Enter');
    await expect(log.getByText('Ask about another pick, or refine the list.')).toBeVisible();

    await page.getByRole('button', { name: /^Remove under \d+ pages$/ }).click();
    await expect(brief.getByText(/under \d+ pages/)).toHaveCount(0);
  });
});
