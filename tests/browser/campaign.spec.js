import { test, expect } from '@playwright/test';

test('campaign has five focused sections and fits desktop, tablet and small phones', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    const response = await page.goto('/verificare-auto-999');
    expect(response.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('main > section')).toHaveCount(5);
    await expect(page.locator('h1')).toContainText('999.md?');
    await expect(page.locator('.campaign-header nav')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${viewport.width}px`).toBe(true);
    if (viewport.width <= 640) {
      const primary = await page.locator('.campaign-primary').boundingBox();
      expect(primary.y + primary.height, `${viewport.width}px: hero CTA stays on the first screen`).toBeLessThanOrEqual(viewport.height);
      await expect(page.locator('.mobile-booking')).toBeHidden();
    }
    await page.locator('.campaign-primary').click();
    await expect(page.locator('#booking-dialog')).toBeVisible();
    await expect(page.locator('#booking-service')).toHaveText('Premium Check · 69 € / mașină');
    await page.keyboard.press('Escape');
  }
  expect(errors).toEqual([]);
});

test('portfolio photos load and link to the existing inspection posts', async ({ page }) => {
  await page.goto('/verificare-auto-999');
  const hero = page.locator('.campaign-hero-photo');
  await expect(hero).toHaveAttribute('href', 'https://www.instagram.com/p/DTXcNo1DBhf/');
  const proof = page.locator('.campaign-proof-photo');
  await proof.scrollIntoViewIfNeeded();
  await expect(proof).toHaveAttribute('href', 'https://www.instagram.com/p/DTunYIFDDv3/');
  await expect.poll(() => page.locator('.campaign-hero-photo img, .campaign-proof-photo img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  for (const image of await page.locator('main img').all()) await expect(image).toHaveAttribute('alt', /.+/);
});

test('campaign booking succeeds through the shared callback endpoint', async ({ page }) => {
  await page.route('**/api/contact', async route => {
    expect(route.request().postDataJSON()).toMatchObject({ type: 'callback', name: 'Client Test', phone: '069448878', service: 'Premium Check', consent: 'on' });
    await route.fulfill({ status: 200, json: { success: true, message: 'Cererea a fost trimisă!' } });
  });
  await page.goto('/verificare-auto-999');
  await page.locator('.campaign-final-action .button').click();
  await expect(page.locator('#booking-dialog')).toBeVisible();
  await page.locator('#booking-name').fill('Client Test');
  await page.locator('#booking-phone').fill('069448878');
  await page.locator('#booking-form [type=submit]').click();
  await expect(page.locator('#booking-success')).toBeVisible();
});

test('mobile campaign booking bar follows the hero and final CTA and opens the modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/verificare-auto-999');
  await page.locator('.campaign-proof').scrollIntoViewIfNeeded();
  await expect(page.locator('.mobile-booking')).toBeVisible();
  await page.locator('.mobile-booking button').click();
  await expect(page.locator('#booking-dialog')).toBeVisible();
  await expect(page.locator('.mobile-booking')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(page.locator('.mobile-booking')).toBeHidden();
  await expect(page.locator('.campaign-final-action .button')).toBeVisible();
});
