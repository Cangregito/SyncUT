import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Start the app with its normal environment before running this script.
// Only sign-in, navigation and client UI interactions are exercised.
const base = process.env.SYNCUT_QA_BASE_URL || 'http://127.0.0.1:3101';
const output = path.resolve('test-results/ui-accessibility');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const checks = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function check(name, run) {
  await run();
  checks.push(name);
  console.log(`OK: ${name}`);
}

try {
  await page.goto(`${base}/reset-password`, { waitUntil: 'networkidle' });
  await check('An invalid recovery link never claims verification or exposes the password form', async () => {
    await expect(page.getByRole('link', { name: 'Solicitar nuevo enlace' })).toBeVisible();
    await expect(page.getByText('Sesión de recuperación verificada')).toHaveCount(0);
    await expect(page.locator('input[autocomplete="new-password"]')).toHaveCount(0);
  });
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await check('Demo access is identified and password visibility has an accessible toggle', async () => {
    await expect(page.getByRole('heading', { name: 'Explorar la demostración' })).toBeVisible();
    await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });
  await check('Public forms fit small screens and expose visible keyboard focus', async () => {
    for (const route of ['login', 'signup', 'forgot-password', 'reset-password']) {
      await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} at ${width}px`).toBeLessThanOrEqual(width);
        const control = page.locator('main').locator('input:not([type="hidden"]),button,a').first();
        await control.focus();
        await expect(control).toBeFocused();
        const outline = await control.evaluate(el => getComputedStyle(el).outlineStyle);
        expect(outline).not.toBe('none');
        await page.screenshot({ path: path.join(output, `${route}-${width}.png`) });
      }
    }
  });
  if (!process.argv.includes('--public-only')) {
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Estudiante/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 45000 });
  await page.goto(`${base}/notificaciones`, { waitUntil: 'networkidle' });
  await check('Drawer traps keyboard focus, closes with Escape and restores its trigger', async () => {
    const trigger = page.getByRole('button', { name: 'Abrir menú', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Navegación principal' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar menú', exact: true })).toBeFocused();
    const buttons = dialog.locator('a[href],button:not([disabled])');
    await buttons.last().focus();
    await page.keyboard.press('Tab');
    await expect(buttons.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(buttons.last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
  await check('Profile popover fits a 320px viewport', async () => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole('button', { name: /Abrir men[uú] de perfil/ }).click();
    const panel = page.getByText('Mis notificaciones', { exact: true }).locator('../..');
    const box = await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    await page.keyboard.press('Escape');
  });
  await check('Preferences stay collapsed until requested and their direct link opens them', async () => {
    await expect(page.locator('#preferencias')).not.toHaveAttribute('open', '');
    await page.getByRole('link', { name: 'Configurar mis avisos' }).click();
    await expect(page.locator('#preferencias')).toHaveAttribute('open', '');
    await expect(page.locator('#preferencias summary')).toBeInViewport();
    await page.locator('#preferencias summary').click();
    await expect(page.locator('#preferencias')).not.toHaveAttribute('open', '');
  });
  await check('Inactive pagination links are excluded from the keyboard sequence', async () => {
    for (const link of await page.locator('nav[aria-label="Paginación de notificaciones"] [aria-disabled="true"]').all()) {
      await expect(link).toHaveAttribute('tabindex', '-1');
    }
  });
  await page.goto(`${base}/justificaciones`, { waitUntil: 'networkidle' });
  await check('New justification fields have persistent labels and mobile text stays readable', async () => {
    await expect(page.getByLabel('Título de la solicitud', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Tipo de justificación', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Motivo de la ausencia', { exact: false })).toBeVisible();
    const size = await page.locator('#justification-title').evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
    expect(await page.locator('#justification-title').evaluate(el => el.checkValidity())).toBe(false);
  });
  await page.goto(`${base}/citas`, { waitUntil: 'networkidle' });
  await check('Calendar exposes full dates, named month buttons and selected state', async () => {
    const tutor = page.locator('select[name="tutor_id"]').first();
    const value = await tutor.locator('option').nth(1).getAttribute('value');
    expect(value).toBeTruthy();
    await tutor.selectOption(value);
    await expect(page.getByRole('button', { name: 'Mes anterior', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mes siguiente', exact: true })).toBeVisible();
    const day = page.locator('[data-calendar-day]:not([disabled])').first();
    await expect(day).toHaveAttribute('aria-label', /\d.*de.*\d{4}/);
    await day.click();
    await expect(day).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('3. Elige el horario')).toBeVisible();
  });
  await page.goto(`${base}/chatbot`, { waitUntil: 'networkidle' });
  await check('FAQ search and disclosure work without creating a conversation or sending a message', async () => {
    const search = page.getByRole('searchbox', { name: 'Buscar una pregunta' });
    await search.fill('citas');
    const section = page.getByRole('heading', { name: 'Preguntas frecuentes', exact: true }).locator('..');
    const first = section.locator('details').first();
    await first.locator('summary').click();
    await expect(first.locator('p')).toBeVisible();
    await search.fill('zzzz-sin-coincidencias-zzzz');
    await expect(section.getByText(/No encontramos esa pregunta/)).toBeVisible();
    await search.fill('');
  });
  await check('Academic pages fit 320px and 390px in both themes', async () => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['citas', 'justificaciones', 'notificaciones', 'chatbot']) {
        await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
        for (const theme of ['light', 'dark']) {
          const toggle = page.getByRole('button', { name: theme === 'light' ? 'Activar tema claro' : 'Activar tema oscuro', exact: true });
          if (await toggle.count()) await toggle.click();
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route}, ${width}px, ${theme}`).toBeLessThanOrEqual(width);
          await page.screenshot({ path: path.join(output, `${route}-${width}-${theme}.png`) });
        }
      }
    }
  });
  await check('Skip link moves keyboard focus directly to page content', async () => {
    const skip = page.getByRole('link', { name: 'Saltar al contenido' });
    await skip.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido-principal')).toBeFocused();
  });
  }
  expect(errors).toEqual([]);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ base, checks, errors }, null, 2));
  console.log(`${checks.length} UI checks passed.`);
} finally {
  await browser.close();
}
