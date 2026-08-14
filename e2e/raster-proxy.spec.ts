import { test, expect } from '@playwright/test';

/**
 * CHECKPOINT 36.5F — Raster Proxy selection controls + pixel-perfect spatial
 * transforms.
 *
 * Verifies that clicking a detected region arms a selectable RasterProxy (a
 * FabricImage, not an IText) with a visible selection box, resize handles and
 * rotation control, and that move/resize/rotate keep the raster proxy (no IText
 * is created until a textual edit).
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

interface ProxyState {
  type: string | undefined;
  hasControls: boolean;
  hasBorders: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  center: { x: number; y: number };
  oCoords: {
    tl: { x: number; y: number } | null;
    tr: { x: number; y: number } | null;
    bl: { x: number; y: number } | null;
    br: { x: number; y: number } | null;
    mtr: { x: number; y: number } | null;
  } | null;
}

async function proxyState(page: import('@playwright/test').Page): Promise<ProxyState | null> {
  return page.evaluate(() => {
    interface FabricActive {
      type?: string;
      hasControls?: boolean;
      hasBorders?: boolean;
      left: number;
      top: number;
      width: number;
      height: number;
      scaleX: number;
      scaleY: number;
      angle: number;
      getCenterPoint: () => { x: number; y: number };
      oCoords?: {
        tl?: { x: number; y: number };
        tr?: { x: number; y: number };
        bl?: { x: number; y: number };
        br?: { x: number; y: number };
        mtr?: { x: number; y: number };
      };
    }
    const c = (window as unknown as {
      __fabricCanvas?: { getActiveObject: () => FabricActive | null };
    }).__fabricCanvas;
    const a = c?.getActiveObject?.();
    if (!a) return null;
    const cpt = a.getCenterPoint ? a.getCenterPoint() : null;
    return {
      type: a.type,
      hasControls: !!a.hasControls,
      hasBorders: !!a.hasBorders,
      left: a.left,
      top: a.top,
      width: a.width,
      height: a.height,
      scaleX: a.scaleX,
      scaleY: a.scaleY,
      angle: a.angle,
      center: cpt ? { x: cpt.x, y: cpt.y } : { x: 0, y: 0 },
      oCoords: a.oCoords
        ? {
            tl: a.oCoords.tl ? { x: a.oCoords.tl.x, y: a.oCoords.tl.y } : null,
            tr: a.oCoords.tr ? { x: a.oCoords.tr.x, y: a.oCoords.tr.y } : null,
            bl: a.oCoords.bl ? { x: a.oCoords.bl.x, y: a.oCoords.bl.y } : null,
            br: a.oCoords.br ? { x: a.oCoords.br.x, y: a.oCoords.br.y } : null,
            mtr: a.oCoords.mtr ? { x: a.oCoords.mtr.x, y: a.oCoords.mtr.y } : null,
          }
        : null,
    };
  });
}

async function setupDetected(page: import('@playwright/test').Page) {
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

  // Arm the Raster Proxy by clicking the detected overlay.
  const scale = box!.width / 1080;
  await page.mouse.click(box!.x + 372 * scale, box!.y + 295 * scale);
  await page.waitForTimeout(700);
}

test('arming a detected region selects a RasterProxy with visible controls', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await setupDetected(page);

  const state = await proxyState(page);
  expect(state, 'active object should exist').not.toBeNull();
  expect(state!.type, 'active object should be a raster image (proxy), not IText').toBe('image');
  expect(state!.hasControls).toBe(true);
  expect(state!.hasBorders).toBe(true);

  // Selection bounding box is non-degenerate (visible).
  expect(state!.width).toBeGreaterThan(0);
  expect(state!.height).toBeGreaterThan(0);

  // Corner resize controls are present.
  expect(state!.oCoords?.tl).not.toBeNull();
  expect(state!.oCoords?.tr).not.toBeNull();
  expect(state!.oCoords?.bl).not.toBeNull();
  expect(state!.oCoords?.br).not.toBeNull();

  // Rotation control is present.
  expect(state!.oCoords?.mtr).not.toBeNull();

  expect(pageErrors, `page crashed: ${pageErrors.join('; ')}`).toEqual([]);
});

test('mouse drag moves the RasterProxy and keeps it raster', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await setupDetected(page);
  const box = await page.locator('canvas').first().boundingBox();
  const scale = box!.width / 1080;

  const before = await proxyState(page);
  expect(before!.type).toBe('image');

  const cx = box!.x + before!.center.x * scale;
  const cy = box!.y + before!.center.y * scale;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 90, cy + 50, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(3000);

  const after = await proxyState(page);
  expect(after, 'proxy should remain active after move').not.toBeNull();
  expect(after!.type, 'move must not create an IText').toBe('image');
  expect(Math.abs(after!.left - before!.left)).toBeGreaterThan(5);
  expect(pageErrors, `page crashed on move: ${pageErrors.join('; ')}`).toEqual([]);
});

test('corner resize handle resizes the RasterProxy and keeps it raster', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await setupDetected(page);
  const box = await page.locator('canvas').first().boundingBox();
  const scale = box!.width / 1080;

  const before = await proxyState(page);
  expect(before!.type).toBe('image');
  const br = before!.oCoords!.br!;

  const hx = box!.x + br.x * scale;
  const hy = box!.y + br.y * scale;

  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx + 40, hy + 30, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(3000);

  const after = await proxyState(page);
  expect(after, 'proxy should remain active after resize').not.toBeNull();
  expect(after!.type, 'resize must not create an IText').toBe('image');
  const scaledWBefore = before!.width * before!.scaleX;
  const scaledWAfter = after!.width * after!.scaleX;
  expect(scaledWAfter).toBeGreaterThan(scaledWBefore);
  expect(pageErrors, `page crashed on resize: ${pageErrors.join('; ')}`).toEqual([]);
});

test('rotation handle rotates the RasterProxy and keeps it raster', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await setupDetected(page);
  const box = await page.locator('canvas').first().boundingBox();
  const scale = box!.width / 1080;

  const before = await proxyState(page);
  expect(before!.type).toBe('image');
  const mtr = before!.oCoords!.mtr!;

  const hx = box!.x + mtr.x * scale;
  const hy = box!.y + mtr.y * scale;

  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx + 50, hy + 40, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(3000);

  const after = await proxyState(page);
  expect(after, 'proxy should remain active after rotate').not.toBeNull();
  expect(after!.type, 'rotate must not create an IText').toBe('image');
  expect(Math.abs(after!.angle - before!.angle)).toBeGreaterThan(1);
  expect(pageErrors, `page crashed on rotate: ${pageErrors.join('; ')}`).toEqual([]);
});
