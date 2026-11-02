import { test, expect } from '@playwright/test';

test('partner borders stay equal and aligned on hover, and inspection checks remain readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.locator('#parteneri').scrollIntoViewIfNeeded();
    await page.locator('.partner-tile').first().hover();
    await expect(page.locator('.partner-tile').first()).toHaveCSS('transform', 'none');
    const boxes = await page.locator('.partner-tile').evaluateAll(nodes => nodes.map(el => {
      const { width, height, top } = el.getBoundingClientRect(); return { width, height, top };
    }));
    expect(boxes).toHaveLength(8);
    for (const box of boxes) {
      expect(Math.abs(box.width - boxes[0].width)).toBeLessThan(1);
      expect(box.height).toBe(boxes[0].height);
    }
    const columns = width <= 640 ? 2 : 4;
    for (let index = 0; index < boxes.length; index += columns) {
      expect(boxes.slice(index, index + columns).every(box => box.top === boxes[index].top)).toBe(true);
    }
    await expect(page.locator('#inspection-panel li').first()).toHaveCSS('font-size', '20px');
    await expect(page.locator('#inspection-panel li').first()).toHaveCSS('color', 'rgb(239, 244, 247)');
    await expect(page.locator('link[rel=stylesheet]')).toHaveCount(1);
    expect(await page.locator('link[rel=stylesheet]').getAttribute('href')).toMatch(/^site\.[a-f0-9]{12}\.css$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('landing page is dark and fits desktop, tablet and mobile viewports', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 1280, 1024, 768, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('#vin-title')).toHaveText('Verifică istoricul auto');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
    expect(await page.evaluate(() => [...document.querySelectorAll('.section-light,.price-card,.partner-tile')].every(el => {
      const rgb = getComputedStyle(el).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
      return rgb.every(value => value < 80);
    }))).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('mobile menu opens, closes after navigation and restores focus on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Deschide meniul' });
  await toggle.click();
  await expect(page.locator('#main-nav')).toBeVisible();
  await page.getByRole('link', { name: 'Istoric VIN', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
});

test('inspection diagram supports keyboard selection and service links populate the form', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tab-0').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#inspection-panel')).toContainText('Caroserie');
  await page.locator('.price-card [data-service="Pachet 1 + 1 = 3"]').click();
  await expect(page.locator('#service-select')).toHaveValue('Pachet 1 + 1 = 3');
});

test('VIN submission retains affiliate attribution and normalizes the vehicle code', async ({ page, context }) => {
  await context.route('https://www.carvertical.deal/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Affiliate handoff</title>' }));
  await page.goto('/');
  await page.locator('#vin-affiliate-input').fill('wvgzzz1tzkw000001');
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#vin-affiliate-form [type=submit]').click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  const url = new URL(popup.url());
  expect(url.hostname).toBe('www.carvertical.deal');
  expect(url.searchParams.get('source_id')).toBe('AFF');
  expect(url.searchParams.get('sub1')).toBe('avangard');
  expect(url.searchParams.get('sub3')).toBe('WVGZZZ1TZKW000001');
  expect(await popup.evaluate(() => window.opener)).toBeNull();
});

test('invalid VIN is rejected and can be corrected', async ({ page }) => {
  await page.goto('/');
  await page.locator('#vin-affiliate-input').fill('INVALID!');
  await page.locator('#vin-affiliate-form [type=submit]').click();
  await expect(page.locator('#vin-error')).toBeVisible();
  await page.locator('#vin-affiliate-input').fill('ABC 123');
  await expect(page.locator('#vin-error')).toBeHidden();
});

async function fillContact(page) {
  await page.locator('#contact-form [name=name]').fill('Client Test');
  await page.locator('#contact-form [name=email]').fill('client@example.com');
  await page.locator('#contact-form [name=phone]').fill('069000000');
  await page.locator('#contact-form [name=message]').fill('Test formular');
  await page.locator('#contact-form [name=consent]').check();
}

test('contact success waits for the server then clears the form', async ({ page }) => {
  await page.route('**/api/contact', async route => {
    const data = route.request().postDataJSON();
    expect(data.email).toBe('client@example.com');
    expect(data.consent).toBe('on');
    await route.fulfill({ status: 200, json: { success: true, message: 'Cererea a fost trimisă!' } });
  });
  await page.goto('/'); await fillContact(page);
  await page.locator('#contact-form [type=submit]').click();
  await expect(page.locator('#form-result')).toHaveAttribute('data-state', 'success');
  await expect(page.locator('#contact-form [name=name]')).toHaveValue('');
});

test('contact failure preserves customer input and permits retry', async ({ page }) => {
  await page.route('**/api/contact', route => route.fulfill({ status: 502, json: { success: false, message: 'Cererea nu a putut fi trimisă.' } }));
  await page.goto('/'); await fillContact(page);
  await page.locator('#contact-form [type=submit]').click();
  await expect(page.locator('#form-result')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#contact-form [name=name]')).toHaveValue('Client Test');
  await expect(page.locator('#contact-form [type=submit]')).toBeEnabled();
});

test('phone validation accepts formatted numbers and rejects letters or formatting without digits', async ({ page }) => {
  await page.goto('/');
  const phone = page.locator('#contact-form [name=phone]');
  for (const value of ['069 000 000', '+373 (69) 448-878', '069000000']) {
    await phone.fill(value);
    expect(await phone.evaluate(input => input.checkValidity()), value).toBe(true);
  }
  for (const value of ['ssssss', '------', '12345', 'abc123456']) {
    await phone.fill(value);
    expect(await phone.evaluate(input => input.checkValidity()), value).toBe(false);
  }
});

test('motion controls and reviews still work after script optimization', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const toggle = page.locator('.motion-toggle').first();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/motion-paused/);
  await page.locator('[data-review="1"]').click();
  await expect(page.locator('#review-author')).toContainText('Alexandru M.');
  await expect(page.locator('#review-index')).toHaveText('02 / 03');
});

test('hashed stylesheets are cached and nested 404 pages retain their styles', async ({ page, request }) => {
  await page.goto('/');
  const stylesheet = await page.locator('link[rel=stylesheet]').getAttribute('href');
  const response = await request.get('/' + stylesheet);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('immutable');
  const notFound = await page.goto('/missing/nested/page');
  expect(notFound.status()).toBe(404);
  expect(await page.locator('link[rel=stylesheet]').getAttribute('href')).toBe('/' + stylesheet);
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(13, 21, 30)');
});

test('blog filters and all generated pages work in dark mode', async ({ page }) => {
  await page.goto('/blog.html');
  await page.locator('[data-filter]').nth(1).click();
  const selected = await page.locator('[data-filter]').nth(1).getAttribute('data-filter');
  expect(await page.locator('[data-category]:visible').evaluateAll((cards, category) => cards.length > 0 && cards.every(card => card.dataset.category === category), selected)).toBe(true);
  for (const path of ['article-1-verificare-profesionala.html', 'article-2-kilometri-dati-inapoi.html', 'article-3-accidente-ascunse.html', 'article-4-fum-motor.html', 'article-5-fluide-motor.html', 'blog-article.html', 'confidentialitate.html']) {
    const response = await page.goto('/' + path);
    expect(response.status()).toBe(200);
    await expect(page.locator('h1')).not.toBeEmpty();
    expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(13, 21, 30)');
  }
  const response = await page.goto('/not-a-real-page');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('link', { name: /Înapoi/ })).toBeVisible();
});
