import { test, expect } from '@playwright/test';

/**
 * CHECKPOINT 36.5G — RESET / RE-DETECT TEXT.
 *
 * Covers:
 *  TEST 1: import → detect → clear → raster unchanged + detect button restored
 *  TEST 2: import → detect → clear → detect again → overlays return
 *  TEST 3: import → detect → select image → detect again → no duplicated overlays
 *  TEST 4: RasterProxy regression (36.5F) — move stays raster, no IText
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

async function overlayCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const c = (window as unknown as {
      __fabricCanvas?: { getObjects: () => Array<{ type?: string }> };
    }).__fabricCanvas;
    if (!c) return 0;
    return c.getObjects().filter((o) => o.type === 'rect').length;
  });
}

interface ProxyState {
  type: string | undefined;
  left: number;
  top: number;
  center: { x: number; y: number };
}

async function proxyState(page: import('@playwright/test').Page): Promise<ProxyState | null> {
  return page.evaluate(() => {
    interface FabricActive {
      type?: string;
      left: number;
      top: number;
      getCenterPoint: () => { x: number; y: number };
    }
    const c = (window as unknown as {
      __fabricCanvas?: { getActiveObject: () => FabricActive | null };
    }).__fabricCanvas;
    const a = c?.getActiveObject?.();
    if (!a) return null;
    const cpt = a.getCenterPoint();
    return {
      type: a.type,
      left: a.left,
      top: a.top,
      center: { x: cpt.x, y: cpt.y },
    };
  });
}

async function routeOcr(page: import('@playwright/test').Page) {
  await page.route('**/api/ai/ocr', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: MOCK_OCR });
    } else {
      await route.continue();
    }
  });
}

async function importAndSelectImage(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('canvas').first().waitFor({ state: 'visible' });
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await page.waitForTimeout(1500);

  const box = await page.locator('canvas').first().boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);
  return box!;
}

async function detect(page: import('@playwright/test').Page) {
  await page.locator('button[title="IA"]').click();
  await page.getByRole('button', { name: 'Detectar texto' }).click();
  await page.getByText(/textos detectados/).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
}

test('TEST 1: import → detect → clear → raster unchanged + detect button restored', async ({ page }) => {
  await routeOcr(page);
  const box = await importAndSelectImage(page);

  const beforeDetect = await canvasPixels(page);

  await detect(page);

  const afterDetect = await canvasPixels(page);
  const total = beforeDetect.length / 4;
  expect(changedPixels(beforeDetect, afterDetect), 'detection overlay only').toBeLessThan(total * 0.05);

  // Clear the detection.
  await page.getByRole('button', { name: 'Limpar detecção' }).click();
  await expect(page.getByRole('button', { name: 'Detectar texto' })).toBeVisible();
  await page.waitForTimeout(400);

  const afterClear = await canvasPixels(page);
  const clearDiff = changedPixels(beforeDetect, afterClear);
  expect(clearDiff, `raster changed after clear by ${clearDiff}/${total}`).toBeLessThan(total * 0.05);

  // No overlays remain.
  expect(await overlayCount(page)).toBe(0);
  void box;
});

test('TEST 2: import → detect → clear → detect again → overlays return', async ({ page }) => {
  await routeOcr(page);
  await importAndSelectImage(page);

  await detect(page);
  expect(await overlayCount(page)).toBe(1);

  await page.getByRole('button', { name: 'Limpar detecção' }).click();
  await expect(page.getByRole('button', { name: 'Detectar texto' })).toBeVisible();
  await page.waitForTimeout(400);
  expect(await overlayCount(page)).toBe(0);

  // Detect again — the overlays must come back.
  await page.getByRole('button', { name: 'Detectar texto' }).click();
  await page.getByText(/textos detectados/).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);

  expect(await overlayCount(page)).toBe(1);
});

test('TEST 3: import → detect → select image → detect again → no duplicated overlays', async ({ page }) => {
  await routeOcr(page);
  const box = await importAndSelectImage(page);

  await detect(page);
  expect(await overlayCount(page)).toBe(1);

  // Re-select the image (click a non-overlay area of it).
  const scale = box.width / 1080;
  const cx = box.x + 540 * scale;
  const cy = box.y + 700 * scale;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(300);

  // The primary button is now "Detectar novamente".
  await page.getByRole('button', { name: 'Detectar novamente' }).click();
  await page.getByText(/textos detectados/).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);

  // Old + new regions must NOT accumulate.
  expect(await overlayCount(page)).toBe(1);
  await expect(page.getByRole('button', { name: 'Limpar detecção' })).toBeVisible();
});

test('TEST 4: RasterProxy regression (36.5F) — move keeps the proxy raster', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await routeOcr(page);
  const box = await importAndSelectImage(page);

  await detect(page);

  // Arm the Raster Proxy by clicking the detected overlay (logical 372,295).
  const scale = box.width / 1080;
  await page.mouse.click(box.x + 372 * scale, box.y + 295 * scale);
  await page.waitForTimeout(700);

  const before = await proxyState(page);
  expect(before, 'armed proxy should be active').not.toBeNull();
  expect(before!.type, 'armed object must be a raster image, not IText').toBe('image');

  // Move the proxy.
  const cx = box.x + before!.center.x * scale;
  const cy = box.y + before!.center.y * scale;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 90, cy + 50, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(3000);

  const after = await proxyState(page);
  expect(after, 'proxy should remain active after move').not.toBeNull();
  expect(after!.type, 'move must not create an IText').toBe('image');
  expect(Math.abs(after!.left - before!.left)).toBeGreaterThan(5);

  // After the first transform the region is 'transformed': the detection
  // pipeline is protected (36.5G) — clear must be hidden, re-detect disabled
  // and the protection hint shown. The AI panel is already open (from detect()).
  await expect(page.getByText(/Há regiões já convertidas/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Limpar detecção' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Detectar novamente' })).toBeDisabled();

  expect(pageErrors, `page crashed: ${pageErrors.join('; ')}`).toEqual([]);
});
