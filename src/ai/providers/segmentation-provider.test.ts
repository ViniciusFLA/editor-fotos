import { describe, it, expect } from 'vitest';
import type { SegmentationProvider } from './segmentation-provider';
import type { SegmentationInput, SegmentationResult } from '@/ai/types/segmentation';
import { AIProviderError, AIErrorCode } from '@/ai/errors/ai-error';
import { FakeSegmentationProvider } from './fake-segmentation-provider';

/**
 * ETAPA 37 — Segmentation Provider contract tests.
 *
 * Verifies the vendor-agnostic `SegmentationProvider` interface, using a fake
 * provider. These tests document the contract that any real provider (SAM,
 * MobileSAM, hosted API, etc.) must satisfy without the editor depending on a
 * specific vendor.
 */

function validInput(): SegmentationInput {
  return {
    image: { base64: 'aGVsbG8=' },
  };
}

class FailingSegmentationProvider implements SegmentationProvider {
  readonly id = 'failing-segmentation';
  readonly name = 'Failing Segmentation';

  async segment(_input: SegmentationInput): Promise<SegmentationResult> {
    void _input;
    throw new AIProviderError(AIErrorCode.PROVIDER_ERROR, 'Model failed', {
      provider: this.id,
      retryable: true,
    });
  }
}

describe('SegmentationProvider contract (ETAPA 37)', () => {
  it('returns segmented objects with masks, bounding boxes and confidence', async () => {
    const provider = new FakeSegmentationProvider();
    const result = await provider.segment(validInput());

    expect(result.objects.length).toBeGreaterThan(0);
    for (const obj of result.objects) {
      expect(obj.id).toBeTruthy();
      expect(obj.boundingBox.width).toBeGreaterThan(0);
      expect(obj.boundingBox.height).toBeGreaterThan(0);
      expect(Number.isFinite(obj.boundingBox.x)).toBe(true);
      expect(Number.isFinite(obj.boundingBox.y)).toBe(true);
      expect(obj.confidence).toBeGreaterThanOrEqual(0);
      expect(obj.confidence).toBeLessThanOrEqual(1);
      expect(obj.mask.kind === 'blob' || obj.mask.kind === 'dataUrl').toBe(true);
    }
  });

  it('supports both mask formats (blob and dataUrl)', async () => {
    const provider = new FakeSegmentationProvider();
    const result = await provider.segment(validInput());

    const kinds = result.objects.map((o) => o.mask.kind);
    expect(kinds).toContain('dataUrl');
    expect(kinds).toContain('blob');
  });

  it('accepts clickPoint and targetLabels without coupling to a vendor', async () => {
    const provider = new FakeSegmentationProvider();
    const result = await provider.segment({
      image: { base64: 'aGVsbG8=' },
      clickPoint: { x: 100, y: 200 },
      targetLabels: ['product', 'logo'],
    });
    expect(result.objects.length).toBeGreaterThan(0);
  });

  it('propagates provider failures as AIProviderError', async () => {
    const provider = new FailingSegmentationProvider();
    await expect(provider.segment(validInput())).rejects.toMatchObject({
      name: 'AIProviderError',
      code: AIErrorCode.PROVIDER_ERROR,
      retryable: true,
      provider: 'failing-segmentation',
    });
  });

  it('reports cancellation via AbortSignal', async () => {
    const provider = new FakeSegmentationProvider();
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.segment(validInput(), { signal: controller.signal }),
    ).rejects.toMatchObject({ code: AIErrorCode.CANCELLED });
  });
});
