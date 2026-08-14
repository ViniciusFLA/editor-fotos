import type {
  SegmentationProvider,
  SegmentationProviderOptions,
} from '@/ai/providers/segmentation-provider';
import type { SegmentationInput, SegmentationResult } from '@/ai/types/segmentation';
import { generateId } from '@/utils';
import { AIProviderError, AIErrorCode } from '@/ai/errors/ai-error';

/**
 * Test fixture: simulated segmentation response for a 1080x1080 ad creative.
 */
const FIXTURE_RESULT: SegmentationResult = {
  objects: [
    {
      id: generateId(),
      boundingBox: { x: 120, y: 90, width: 320, height: 200 },
      mask: {
        kind: 'dataUrl',
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
      confidence: 0.95,
      label: 'product',
      metadata: {},
    },
    {
      id: generateId(),
      boundingBox: { x: 600, y: 400, width: 280, height: 260 },
      mask: {
        kind: 'blob',
        data: new Blob([new Uint8Array([0, 255, 0, 255])], {
          type: 'application/octet-stream',
        }),
        mimeType: 'application/octet-stream',
      },
      confidence: 0.87,
      label: 'logo',
      metadata: {},
    },
  ],
};

/**
 * Fake Segmentation Provider — returns predefined fixtures.
 *
 * Used for development/testing without a real segmentation model.
 * Always succeeds instantly unless cancelled.
 */
export class FakeSegmentationProvider implements SegmentationProvider {
  readonly id = 'fake-segmentation';
  readonly name = 'Fake Segmentation (Development)';

  async segment(
    _input: SegmentationInput,
    options?: SegmentationProviderOptions,
  ): Promise<SegmentationResult> {
    if (options?.signal?.aborted) {
      throw new AIProviderError(AIErrorCode.CANCELLED, 'Operation cancelled', {
        provider: this.id,
      });
    }

    return structuredClone(FIXTURE_RESULT);
  }
}
