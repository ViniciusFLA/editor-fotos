import { test, expect } from '@playwright/test';

/**
 * ETAPA 36.2D — FabricImage geometry stability across clicks and drags.
 *
 * Root cause: `normalizeFabricObject` baked scaleX/scaleY into width/height for
 * FabricImage, but FabricImage's width/height are SOURCE (crop) dimensions.
 * Any transform (move/resize/rotate) on a freshly imported image (scale < 1)
 * therefore CROPPED the source raster while keeping the same bounding box.
 *
 * These tests assert that clicks anywhere and a simple move drag never change
 * the stored natural width/height or crop (raster preserved).
 */

const FIXTURE = 'e2e/fixtures/fixture-1080.png';

// Right properties panel number inputs: [X, Y, W, H, R, cX, cY].
async function panelValues(page: import('@playwright/test').Page): Promise<string[]> {
  const inputs = page.locator('aside input[type="number"]');
  const count = await inputs.count();
  const values: string[] = [];
  for (let i = 0; i < count; i++) {
    values.push(await inputs.nth(i).inputValue());
  }
  return values;
}

async function canvasBox(page: import('@playwright/test').Page) {
  const b = await page.locator('canvas').first().boundingBox();
  if (!b) throw new Error('canvas not visible');
  return b;
}

async function waitForImageSelected(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelectorAll('aside input[type="number"]').length >= 7,
    { timeout: 10000 },
  );
}

test('image geometry stays stable across multi-position clicks and drags', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('canvas').first().waitFor({ state: 'visible' });

  await page.locator('input[type=file]').setInputFiles(FIXTURE);

  const box = await canvasBox(page);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Select the image by clicking its center (import auto-select may race).
  await page.mouse.click(cx, cy);
  await waitForImageSelected(page);

  const before = await panelValues(page);
  expect(before[2], 'imported width should be natural 1080').toBe('1080');
  expect(before[3], 'imported height should be natural 1080').toBe('1080');
  expect(before[5], 'cropX should be 0').toBe('0');
  expect(before[6], 'cropY should be 0').toBe('0');

  const scale = box.width / 1080;
  const half = 378 * scale; // image is centered at 70% (756 logical)

  // Multi-position clicks inside the image (pure selection, no movement).
  const positions: Array<[string, number, number]> = [
    ['top-left', 0.05, 0.05],
    ['quarter', 0.25, 0.25],
    ['center', 0.5, 0.5],
    ['top-right', 0.75, 0.25],
    ['bottom-left', 0.25, 0.75],
    ['bottom-right', 0.75, 0.75],
    ['right-mid', 0.95, 0.5],
    ['bottom-mid', 0.5, 0.95],
  ];

  for (const [, rx, ry] of positions) {
    await page.mouse.click(cx - half + rx * half * 2, cy - half + ry * half * 2);
    await page.waitForTimeout(120);
  }

  await page.mouse.dblclick(cx, cy);
  await page.waitForTimeout(120);

  const afterClicks = await panelValues(page);
  expect(afterClicks[2], 'width unchanged after clicks').toBe('1080');
  expect(afterClicks[3], 'height unchanged after clicks').toBe('1080');
  expect(afterClicks[5], 'cropX unchanged after clicks').toBe('0');
  expect(afterClicks[6], 'cropY unchanged after clicks').toBe('0');

  // Move drag (body): position changes, but natural width/height/crop must not.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const afterMove = await panelValues(page);
  expect(afterMove[2], 'width unchanged after move (no crop)').toBe('1080');
  expect(afterMove[3], 'height unchanged after move (no crop)').toBe('1080');
  expect(afterMove[5], 'cropX unchanged after move').toBe('0');
  expect(afterMove[6], 'cropY unchanged after move').toBe('0');
});
