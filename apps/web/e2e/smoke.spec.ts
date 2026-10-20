import { expect, type Locator, test } from '@playwright/test';

// One reader's first session: sign up, onboard, read the feed, open an explanation, dismiss a pick,
// then hold a three-turn chat and remove a chip. Against the mock (default) it also checks the mock's
// exact wording; with E2E_MODEL_SERVICE_MODE=http it runs on whatever catalogue and language layer
// the real model service has, so it checks structure only.
const LIVE = process.env.E2E_MODEL_SERVICE_MODE === 'http';

/** Removes the first removable chip in a brief and checks it is gone. */
async function removeFirstChip(tags: Locator) {
  const n = await tags.count();
  if (!n) return;
  await tags.first().locator('.brief__drop').click();
  await expect(tags).toHaveCount(n - 1);
}

test('onboarding -> recommendations -> chat', async ({ page }) => {
  const email = `e2e-${Date.now()}@litsense.test`;
  const picked: string[] = [];

  await test.step('sign up', async () => {
    await page.goto('/register');
    await page.getByLabel('Your name').fill('Riya');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('e2e reader 2026');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  await test.step('onboard with picks and a taste sentence', async () => {
    const grid = page.locator('.onb__grid .onb__pick');
    await expect(grid.nth(2)).toBeVisible();
    for (let i = 0; i < 3; i += 1) {
      picked.push((await grid.nth(i).locator('.onb__title').innerText()).trim());
      await grid.nth(i).click();
    }
    await expect(page.getByText('3 picked')).toBeVisible();
    await page
      .getByLabel('Describe your reading taste')
      .fill('I love fantasy with great characters. Nothing too dark.');
    await page.getByRole('button', { name: 'Build my front page' }).click();
    await expect(page.getByRole('heading', { name: /Here is what we/ })).toBeVisible();
    if (LIVE) {
      await removeFirstChip(
        page.getByRole('list', { name: 'What LitSense understood' }).locator('.brief__tag'),
      );
    } else {
      await expect(page.getByText('Likes: Fantasy')).toBeVisible();
      await page.getByRole('button', { name: 'Remove Prefers: cozy' }).click();
      await expect(page.getByText('Prefers: cozy')).toHaveCount(0);
    }
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
    await expect(first).toBeVisible();
    const title = (await first.locator('.card__title').innerText()).trim();
    for (const book of picked) {
      await expect(page.locator('.card__title', { hasText: book })).toHaveCount(0);
    }

    await first.getByRole('button', { name: 'Explain this pick' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('In plain words')).toBeVisible();
    await expect(dialog.locator('.explain__text')).not.toBeEmpty();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await first.getByRole('button', { name: `Not for me: hide ${title}` }).click();
    await expect(page.getByText('We will not suggest that one again.')).toBeVisible();
    await expect(page.locator('.card--feature .card__title', { hasText: title })).toHaveCount(0);
  });

  await test.step('chat: like X but shorter, more by that author, why the second one', async () => {
    await page.goto('/chat');
    const log = page.getByRole('log', { name: 'Conversation with LitSense' });
    const replies = log.locator('.msg--ai:not(.msg--typing)');
    const brief = page.locator('.chat__aside .brief');
    const composer = page.getByPlaceholder('Describe a mood, a book you loved, or a length');
    const say = async (message: string) => {
      const before = await replies.count();
      await composer.fill(message);
      await composer.press('Enter');
      await expect(replies).toHaveCount(before + 1);
      const reply = replies.last();
      await expect(reply.locator('.msg__text')).not.toBeEmpty();
      return reply;
    };

    if (LIVE) {
      const reply = await say(`Something like ${picked[0]}, but shorter`);
      await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}$/);
      await expect(reply.locator('.chat-card, .clarify').first()).toBeVisible();
      await say('more by that author');
      await say('why the second one?');
      await removeFirstChip(brief.locator('.brief__tag'));
      return;
    }

    await page.getByRole('button', { name: /like Project Hail Mary, but shorter/ }).click();
    await expect(page).toHaveURL(/\/chat\/[a-f0-9]{24}$/);
    await expect(brief.getByText('like Project Hail Mary')).toBeVisible();
    await expect(brief.getByText(/under \d+ pages/)).toBeVisible();
    await expect(log.locator('.chat-card').first()).toBeVisible();

    await say('more by that author');
    await expect(log.getByText('More from Andy Weir.')).toBeVisible();

    await say('why the second one?');
    await expect(log.getByText('Ask about another pick, or refine the list.')).toBeVisible();

    await page.getByRole('button', { name: /^Remove under \d+ pages$/ }).click();
    await expect(brief.getByText(/under \d+ pages/)).toHaveCount(0);
  });
});
