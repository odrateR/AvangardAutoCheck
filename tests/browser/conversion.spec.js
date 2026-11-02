import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

const openBooking = page => page.locator('.hero-actions .button-primary').click();
async function fillBooking(page) {
  await page.locator('#booking-name').fill('Client Test');
  await page.locator('#booking-phone').fill('+373 (69) 448-878');
}

test('CTAs are legible, mobile content is compact, and booking fits all viewport sizes', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const cta = page.locator('.hero-actions .button-primary');
    expect((await cta.boundingBox()).height).toBeGreaterThanOrEqual(58);
    expect(await cta.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(17);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (viewport.width <= 640) {
      await expect(page.locator('.inspection-map')).not.toHaveAttribute('open', '');
      await expect(page.locator('.service-photo')).toBeHidden();
      await expect(page.locator('.journal .journal-card:visible')).toHaveCount(1);
      await expect(page.locator('.mobile-booking')).toBeHidden();
    }
    await openBooking(page);
    const dialog = page.locator('#booking-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#booking-form input:not([type=hidden]):not([name=website])')).toHaveCount(2);
    if (viewport.width <= 640) {
      const bounds = await dialog.boundingBox();
      expect(bounds.width).toBe(viewport.width);
      expect(bounds.height).toBe(viewport.height);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(cta).toBeFocused();
  }
});

test('quick booking keeps the chosen service and confirms only server accepted leads', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/contact', async route => {
    requests++;
    const data = route.request().postDataJSON();
    expect(data).toMatchObject({ type: 'callback', name: 'Client Test', phone: '+373 (69) 448-878', service: 'Pachet 1 + 1 = 3', consent: 'on' });
    expect(data.email).toBeUndefined();
    await route.fulfill({ status: 200, json: { success: true, message: 'Cererea a fost trimisă!' } });
  });
  await page.goto('/');
  await page.locator('.price-card [data-service="Pachet 1 + 1 = 3"]').click();
  await expect(page.locator('#booking-service')).toHaveText('Pachet 1 + 1 = 3');
  await fillBooking(page);
  await page.locator('#booking-form [type=submit]').click();
  await expect(page.locator('#booking-success')).toBeVisible();
  await expect(page.locator('#booking-form')).toBeHidden();
  expect(requests).toBe(1);
  await page.locator('#booking-success [data-booking-close]').click();
  await expect(page.locator('#booking-dialog')).toBeHidden();
});

test('quick booking preserves input on failure and on close, and permits retry', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/contact', route => {
    requests++;
    return route.fulfill({ status: requests === 1 ? 502 : 200, json: { success: requests > 1, message: requests === 1 ? 'Încearcă din nou.' : 'Cererea a fost trimisă!' } });
  });
  await page.goto('/');
  await openBooking(page);
  await fillBooking(page);
  await page.locator('#booking-form [type=submit]').click();
  await expect(page.locator('#booking-form [role=status]')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#booking-name')).toHaveValue('Client Test');
  await page.keyboard.press('Escape');
  await openBooking(page);
  await expect(page.locator('#booking-phone')).toHaveValue('+373 (69) 448-878');
  await page.locator('#booking-form [type=submit]').click();
  await expect(page.locator('#booking-success')).toBeVisible();
  expect(requests).toBe(2);
});

test('the booking form stays above a reduced keyboard viewport and restores the page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#preturi').scrollIntoViewIfNeeded();
  await expect(page.locator('.mobile-booking')).toBeVisible();
  const scroll = await page.evaluate(() => scrollY);
  await page.locator('.mobile-booking button').click();
  await page.locator('#booking-phone').focus();
  await page.setViewportSize({ width: 390, height: 390 });
  await expect(page.locator('#booking-dialog')).toHaveClass(/keyboard-open/);
  await expect(page.locator('.booking-top [data-booking-close]')).toBeVisible();
  const submit = await page.locator('#booking-form [type=submit]').boundingBox();
  expect(submit.y).toBeGreaterThanOrEqual(0);
  expect(submit.y + submit.height).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(Math.abs(await page.evaluate(() => scrollY) - scroll)).toBeLessThan(2);
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(page.locator('.mobile-booking')).toBeHidden();
});

test('the shared booking modal works on journal pages', async ({ page }) => {
  await page.goto('/blog.html');
  await page.locator('.header-cta').click();
  await expect(page.locator('#booking-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('empty tracking IDs never load advertising scripts or show a consent prompt', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (/googletagmanager|facebook\.net|facebook\.com\/tr/.test(request.url())) requests.push(request.url()); });
  await page.goto('/');
  await openBooking(page);
  await expect(page.locator('#tracking-consent')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('configured pixels wait for consent and record one lead only after a successful submission', async ({ page }) => {
  const fixture = { metaPixelId: '123456789', googleAdsId: 'AW-123456789', googleAdsLeadLabel: 'test_label', ga4MeasurementId: 'G-TEST123' };
  const bundle = await build({ entryPoints: ['src/app.js'], bundle: true, write: false, format: 'iife', plugins: [{ name: 'test-tracking-config', setup(builder) { builder.onLoad({ filter: /tracking\.json$/ }, () => ({ contents: JSON.stringify(fixture), loader: 'json' })); } }] });
  await page.route(/\/app\.[a-f0-9]+\.js$/, route => route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text }));
  const scripts = [];
  await page.route(/https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net)\//, route => { scripts.push(route.request().url()); return route.fulfill({ contentType: 'text/javascript', body: '/* Pixel test stub: no external calls. */' }); });
  await page.goto('/');
  expect(scripts).toEqual([]);
  await page.locator('[data-tracking-choice="denied"]').click();
  expect(scripts).toEqual([]);
  await page.locator('[data-tracking-settings]').click();
  await page.locator('[data-tracking-choice="granted"]').click();
  await expect.poll(() => scripts.length).toBe(2);
  let requests = 0;
  await page.route('**/api/contact', route => {
    requests++;
    return route.fulfill({ status: requests === 1 ? 502 : 200, json: { success: requests > 1, message: 'Rezultat test' } });
  });
  await openBooking(page);
  await fillBooking(page);
  await page.locator('#booking-form [type=submit]').click();
  await expect(page.locator('#booking-form [role=status]')).toHaveAttribute('data-state', 'error');
  expect(await page.evaluate(() => window.fbq.queue.filter(args => args[1] === 'Lead').length)).toBe(0);
  await page.locator('#booking-form [type=submit]').click();
  await expect(page.locator('#booking-success')).toBeVisible();
  const events = await page.evaluate(() => ({ meta: window.fbq.queue.map(args => Array.from(args)), google: window.dataLayer.map(args => Array.from(args)) }));
  expect(events.meta.filter(args => args[1] === 'Lead')).toHaveLength(1);
  expect(events.google.filter(args => args[1] === 'conversion')).toHaveLength(1);
  expect(events.google.find(args => args[1] === 'conversion')[2].send_to).toBe('AW-123456789/test_label');
  expect(JSON.stringify(events)).not.toMatch(/Client Test|448-878/);
  await page.keyboard.press('Escape');
  await page.locator('[data-tracking-settings]').click();
  await page.locator('[data-tracking-choice="denied"]').click();
  await openBooking(page);
  const after = await page.evaluate(() => window.fbq.queue.filter(args => args[1] === 'BookingOpen').length);
  expect(after).toBe(events.meta.filter(args => args[1] === 'BookingOpen').length);
});
