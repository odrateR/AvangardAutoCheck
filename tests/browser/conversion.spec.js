import { test as consentTest, expect } from '@playwright/test';
import { build } from 'esbuild';

const test = consentTest.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => localStorage.setItem('avangard-tracking-consent-v2', 'denied'));
    await use(page);
  }
});

const openBooking = page => page.locator('.hero-actions .button-primary').click();
async function fillBooking(page) {
  await page.locator('#booking-name').fill('Client Test');
  await page.locator('#booking-phone').fill('+373 (69) 448-878');
}

async function useTrackingConfig(page, settings) {
  const bundle = await build({
    entryPoints: ['src/app.js'],
    bundle: true,
    write: false,
    format: 'iife',
    plugins: [{
      name: 'test-tracking-config',
      setup(builder) {
        builder.onLoad({ filter: /tracking\.json$/ }, () => ({ contents: JSON.stringify(settings), loader: 'json' }));
      }
    }]
  });
  await page.route(/\/app\.[a-f0-9]+\.js$/, route => route.fulfill({ contentType: 'text/javascript', body: bundle.outputFiles[0].text }));
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

consentTest('empty tracking IDs never load advertising scripts or show a consent prompt', async ({ page }) => {
  await useTrackingConfig(page, { metaPixelId: '', googleTagManagerId: '', googleAdsId: '', googleAdsLeadLabel: '', ga4MeasurementId: '' });
  const requests = [];
  page.on('request', request => { if (/googletagmanager|facebook\.net|facebook\.com\/tr/.test(request.url())) requests.push(request.url()); });
  await page.goto('/');
  await openBooking(page);
  await expect(page.locator('#tracking-consent')).toHaveCount(0);
  expect(requests).toEqual([]);
});

consentTest('configured pixels wait for consent and record one lead only after a successful submission', async ({ page }) => {
  const fixture = { metaPixelId: '123456789', googleAdsId: 'AW-123456789', googleAdsLeadLabel: 'test_label', ga4MeasurementId: 'G-TEST123' };
  await useTrackingConfig(page, fixture);
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

consentTest('the cookie dialog dims the screen and keeps focus on the bottom card', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 360 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const prompt = page.getByRole('dialog', { name: 'Folosim cookie-uri' });
    const title = prompt.getByRole('heading', { name: 'Folosim cookie-uri' });
    const decline = prompt.getByRole('button', { name: 'Acceptă doar necesare' });
    const accept = prompt.getByRole('button', { name: 'Acceptă toate' });
    const bounds = await prompt.boundingBox();
    expect(bounds.x).toBeGreaterThan(0);
    expect(bounds.x + bounds.width / 2).toBeCloseTo(viewport.width / 2, 0);
    const bottomGap = viewport.height - bounds.y - bounds.height;
    expect(bottomGap).toBeGreaterThanOrEqual(12);
    expect(bottomGap).toBeLessThanOrEqual(24);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect((await decline.boundingBox()).width).toBeCloseTo((await accept.boundingBox()).width, 0);
    expect(await prompt.evaluate(el => el.matches(':modal'))).toBe(true);
    expect(await prompt.evaluate(el => getComputedStyle(el, '::backdrop').backgroundColor)).toBe('rgba(5, 11, 18, 0.49)');
    await page.locator('.hero-actions .button-primary').evaluate(el => el.focus());
    await expect(title).toBeFocused();
  }
  await page.getByRole('button', { name: 'Acceptă doar necesare' }).click();
  await page.locator('.process').scrollIntoViewIfNeeded();
  const bookingBar = page.locator('.mobile-booking');
  await expect(bookingBar).toBeVisible();
  const settings = page.locator('[data-tracking-settings]');
  await settings.click();
  await expect(page.getByRole('heading', { name: 'Folosim cookie-uri' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(settings).toBeFocused();
});

consentTest('consent loads a single Google container and routes site events to the configured GA4 destination', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('avangard-tracking-consent-v1', 'granted'));
  const containerRequests = [];
  await page.route('https://www.googletagmanager.com/**', route => {
    containerRequests.push(route.request().url());
    return route.fulfill({ contentType: 'text/javascript', body: '/* Google test stub */' });
  });
  await page.route('https://connect.facebook.net/**', route => route.fulfill({ contentType: 'text/javascript', body: '/* Meta test stub */' }));
  await page.goto('/');
  await page.getByRole('dialog').getByRole('link', { name: 'Politica de confidențialitate' }).click();
  await expect(page).toHaveURL(/\/confidentialitate$/);
  await expect(page.locator('#tracking-consent')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('avangard-tracking-consent-v2'))).toBeNull();

  await page.goto('/');
  expect(containerRequests).toEqual([]);
  await page.getByRole('button', { name: 'Acceptă doar necesare' }).click();
  await page.reload();
  await expect(page.locator('#tracking-consent')).toBeHidden();
  expect(containerRequests).toEqual([]);
  await page.locator('[data-tracking-settings]').click();
  await page.getByRole('button', { name: 'Setări cookie-uri' }).click();
  const settingsDialog = page.getByRole('dialog', { name: 'Setări cookie-uri' });
  const optional = settingsDialog.getByRole('checkbox', { name: 'Statistici și publicitate' });
  await expect(optional).not.toBeChecked();
  await optional.check();
  expect(await page.evaluate(() => Boolean(window.fbq))).toBe(false);
  await settingsDialog.getByRole('button', { name: 'Salvează preferințele' }).click();
  await expect(page.locator('#tracking-consent')).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(window.fbq))).toBe(true);
  await expect.poll(() => containerRequests).toEqual(['https://www.googletagmanager.com/gtm.js?id=GTM-PVCPG7RW']);
  expect(await page.evaluate(() => localStorage.getItem('avangard-tracking-consent-v2'))).toBe('granted');
  await openBooking(page);
  const googleCommands = await page.evaluate(() => window.dataLayer.map(args => Array.from(args)));
  expect(googleCommands.some(([command]) => command === 'config')).toBe(false);
  expect(googleCommands.filter(([command, event]) => command === 'event' && event === 'booking_open')).toEqual([
    ['event', 'booking_open', expect.objectContaining({ send_to: 'G-EE6PSBT2HW' })]
  ]);
});

consentTest('GTM records only accepted leads from either form after tracking consent', async ({ page }) => {
  await page.route(/https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net)\//, route =>
    route.fulfill({ contentType: 'text/javascript', body: '/* Tracking test stub */' }));
  let success = true;
  await page.route('**/api/contact', route => route.fulfill({
    status: success ? 200 : 502, json: { success, message: 'Rezultat test' }
  }));
  const leadEvents = () => page.evaluate(() => window.dataLayer?.filter(entry => entry.event === 'lead_form_submit') ?? []);
  const lead = { event: 'lead_form_submit' };

  await page.goto('/');
  await page.getByRole('button', { name: 'Acceptă doar necesare' }).click();
  await openBooking(page);
  await fillBooking(page);
  await page.locator('#booking-form [type=submit]').click();
  await expect(page.locator('#booking-success')).toBeVisible();
  expect(await leadEvents()).toEqual([]);
  await page.keyboard.press('Escape');

  await page.locator('[data-tracking-settings]').click();
  await page.getByRole('button', { name: 'Acceptă toate' }).click();
  await openBooking(page);
  await fillBooking(page);
  success = false;
  await page.locator('#booking-form [type=submit]').click();
  await expect(page.locator('#booking-form [role=status]')).toHaveAttribute('data-state', 'error');
  expect(await leadEvents()).toEqual([]);
  success = true;
  await page.locator('#booking-form [type=submit]').click();
  await expect(page.locator('#booking-success')).toBeVisible();
  expect(await leadEvents()).toEqual([lead]);
  await page.keyboard.press('Escape');

  const contactForm = page.locator('#contact-form');
  await contactForm.locator('[name=name]').fill('Client Test');
  await contactForm.locator('[name=email]').fill('client@example.com');
  await contactForm.locator('[name=phone]').fill('069000000');
  await contactForm.locator('[name=consent]').check();
  await contactForm.locator('[type=submit]').click();
  await expect(contactForm.locator('[role=status]')).toHaveAttribute('data-state', 'success');
  expect(await leadEvents()).toEqual([lead, lead]);
});

consentTest('revoking tracking in one tab stops events in another open tab', async ({ page, context }) => {
  await context.route('https://www.googletagmanager.com/**', route => route.fulfill({ contentType: 'text/javascript', body: '/* Google test stub */' }));
  await context.route('https://connect.facebook.net/**', route => route.fulfill({ contentType: 'text/javascript', body: '/* Meta test stub */' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Acceptă toate' }).click();

  const other = await context.newPage();
  await other.goto('/');
  await expect.poll(() => other.evaluate(() => Boolean(window.fbq))).toBe(true);
  await page.locator('[data-tracking-settings]').click();
  await page.getByRole('button', { name: 'Acceptă doar necesare' }).click();

  await expect.poll(() => other.evaluate(() => window.fbq.queue.at(-1)?.[1])).toBe('revoke');
  await expect.poll(() => other.evaluate(() => Array.from(window.dataLayer.at(-1)))).toEqual(['consent', 'update', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied'
  }]);
  await other.locator('a[href^="tel:"]').first().evaluate(link => {
    link.addEventListener('click', event => event.preventDefault(), { once: true });
    link.click();
  });
  expect(await other.evaluate(() => window.fbq.queue.some(args => args[1] === 'PhoneClick'))).toBe(false);
  await other.reload();
  expect(await other.evaluate(() => Boolean(window.fbq || window.gtag))).toBe(false);
});

consentTest('Romanian is the default and the language switcher navigates directly between Romanian and Russian', async ({ page }) => {
  await page.goto('/?utm_source=language-test#servicii');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  const consent = page.locator('#tracking-consent');
  const consentSwitcher = consent.locator('[data-language-switcher]');
  const russian = consentSwitcher.getByRole('link', { name: 'Русский' });
  await expect(consentSwitcher.locator('[aria-current]')).toHaveText('RO');
  await expect(consentSwitcher.getByRole('link')).toHaveCount(1);
  await expect(russian).toHaveText('RU');
  await russian.press('Enter');
  await expect(page).toHaveURL(/\/ru\/\?utm_source=language-test#servicii$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(consent).toHaveAccessibleName('Мы используем cookie');
  await consent.getByRole('button', { name: 'Только необходимые' }).click();
  await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Автожурнал' }).click();
  await expect(page).toHaveURL(/\/ru\/blog$/);
  await page.locator('.blog-feature').click();
  await expect(page).toHaveURL(/\/ru\/blog-article$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Что проверить перед покупкой автомобиля');
  const headerSwitcher = page.locator('.site-header [data-language-switcher]');
  await expect(headerSwitcher.locator('[aria-current]')).toHaveText('RU');
  await expect(headerSwitcher.getByRole('link')).toHaveCount(1);
  await headerSwitcher.getByRole('link', { name: 'Română' }).click();
  await expect(page).toHaveURL(/\/blog-article$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');

  await page.goto('/en/blog-article');
  await expect(page).toHaveURL(/\/en\/blog-article$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What to check before buying a car');
  await expect(page.locator('head [hreflang="x-default"]')).toHaveAttribute('href', /\/blog-article$/);
  await expect(headerSwitcher.getByRole('link')).toHaveText(['RO', 'RU']);

  await page.goto('/ru/');
  await page.route('**/api/contact', route => {
    expect(route.request().postDataJSON()).toMatchObject({ type: 'callback', service: 'Premium Check' });
    return route.fulfill({ json: { success: true, message: 'Cererea a fost trimisă! Te contactăm pentru a confirma detaliile programării.' } });
  });
  await openBooking(page);
  await expect(page.locator('#booking-title')).toHaveText('Проверим ваш автомобиль.');
  await expect(page.locator('#booking-dialog a[href$="/confidentialitate"]')).toHaveAttribute('href', '/ru/confidentialitate');
  await fillBooking(page);
  await page.getByRole('button', { name: 'Заказать звонок' }).click();
  await expect(page.locator('#booking-title')).toHaveText('Спасибо! Скоро свяжемся с вами.');
});
