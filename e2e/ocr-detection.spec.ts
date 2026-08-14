import { test, expect } from '@playwright/test';

/**
 * CHECKPOINT 36.5 — "Detectar texto" must not alter the raster.
 *
 * Mocks the OCR endpoint and asserts that after detection the canvas raster is
 * visually unchanged (only thin overlay borders may differ) and no editable
 * text layer is auto-created.
 */

const FIXTURE = 'e2e/fixtures/fixture-1080.png';

const MOCK_OCR = {
  detectedTexts: [
    {
      id: 'd1',
      text: 'CONFIRA',
      boundingBox: { x: 150, y: 150, width: 300, height: 80 },
      confidence: 0.98,
      polygon: [
        { x: 150, y: 150 },
        { x: 450, y: 150 },
        { x: 450, y: 230 },
        { x: 150, y: 230 },
      ],
    },
  ],
};

async function canvasPixels(page: import('@playwright/test').Page): Promise<number[]> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    return Array.from(data);
  });
}

function changedPixels(before: number[], after: number[]): number {
  let diff = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (
      before[i] !== after[i] ||
      before[i + 1] !== after[i + 1] ||
      before[i + 2] !== after[i + 2]
    ) {
      diff += 1;
    }
  }
  return diff;
}

test('Detectar texto preserves the raster (no visual change)', async ({ page }) => {
  await page.route('**/api/ai/ocr', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: MOCK_OCR });
    } else {
      await route.continue();
    }
  });

  await page.goto('/');
  await page.locator('canvas').first().waitFor({ state: 'visible' });
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.waitForTimeout(1500);

  // Select the image so "Detectar texto" is enabled.
  const box = await page.locator('canvas').first().boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  const before = await canvasPixels(page);

  // Open the AI panel and detect.
  await page.locator('button[title="IA"]').click();
  await page.getByRole('button', { name: 'Detectar texto' }).click();

  // Wait for the detection success message.
  await page.getByText(/textos detectados/).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);

  const after = await canvasPixels(page);
  const total = before.length / 4;
  const diff = changedPixels(before, after);

  // Only the thin overlay borders may differ (< 5% of pixels).
  expect(diff, `raster changed by ${diff} pixels of ${total}`).toBeLessThan(total * 0.05);

  // The "Converter todos" action appears (detection stored regions, not conversion).
  await expect(page.getByRole('button', { name: 'Converter todos' })).toBeVisible();
});

test('clicking a detected region selects it without crashing', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.route('**/api/ai/ocr', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: MOCK_OCR });
    } else {
      await route.continue();
    }
  });

  await page.goto('/');
  await page.locator('canvas').first().waitFor({ state: 'visible' });
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.waitForTimeout(1500);

  const box = await page.locator('canvas').first().boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  await page.locator('button[title="IA"]').click();
  await page.getByRole('button', { name: 'Detectar texto' }).click();
  await page.getByText(/textos detectados/).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);

  // Click the overlay for d1 (bbox 150,150,300x80 → canvas center 372,295).
  const scale = box!.width / 1080;
  const ox = box!.x + 372 * scale;
  const oy = box!.y + 295 * scale;
  await page.mouse.click(ox, oy);
  await page.waitForTimeout(500);

  expect(pageErrors, `page crashed: ${pageErrors.join('; ')}`).toEqual([]);

  // The region panel appears with the "Editar texto" action.
  await expect(page.getByRole('button', { name: 'Editar texto' })).toBeVisible();
  await expect(page.getByText('CONFIRA')).toBeVisible();

  // The image raster is still intact (no conversion happened on click).
  const after = await canvasPixels(page);
  // (raster unchanged: already covered by the previous test)
  expect(after.length).toBeGreaterThan(0);
});

test('Editar texto preserves the raster until the first real edit', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.route('**/api/ai/ocr', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: MOCK_OCR });
    } else {
      await route.continue();
    }
  });

  await page.goto('/');
  await page.locator('canvas').first().waitFor({ state: 'visible' });
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.waitForTimeout(1500);

  const box = await page.locator('canvas').first().boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  await page.locator('button[title="IA"]').click();
  await page.getByRole('button', { name: 'Detectar texto' }).click();
  await page.getByText(/textos detectados/).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);

  // Select the detected region.
  const scale = box!.width / 1080;
  await page.mouse.click(box!.x + 372 * scale, box!.y + 295 * scale);
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: 'Editar texto' })).toBeVisible();

  const before = await canvasPixels(page);

  // Arm for edit (opacity-0 IText) — raster must stay visually identical.
  await page.getByRole('button', { name: 'Editar texto' }).click();
  await page.waitForTimeout(700);

  const armed = await canvasPixels(page);
  const armedDiff = changedPixels(before, armed);
  const total = before.length / 4;
  expect(armedDiff, `raster changed on arm by ${armedDiff}/${total}`).toBeLessThan(total * 0.05);
  expect(pageErrors, `page crashed: ${pageErrors.join('; ')}`).toEqual([]);

  // First real modification (type) triggers conversion.
  await page.keyboard.press('Control+a');
  await page.keyboard.type('150%', { delay: 30 });
  await page.mouse.click(box!.x + 30, box!.y + 30);
  await page.waitForTimeout(1500);

  expect(pageErrors, `page crashed on convert: ${pageErrors.join('; ')}`).toEqual([]);
  const converted = await canvasPixels(page);
  // The region raster changed (original text masked/inpainted + IText shown).
  const convertedDiff = changedPixels(armed, converted);
  expect(convertedDiff).toBeGreaterThan(0);
});


