import type { OCRProvider, OCRProviderOptions } from '@/ai/providers/ocr-provider';
import type { OCRInput, OCRResult } from '@/ai/types/ocr';
import { generateId } from '@/utils';

/**
 * Test fixture: simulated OCR response for a 1080x1080 ad creative.
 */
const FIXTURE_TEXT: OCRResult = {
  detectedTexts: [
    {
      id: generateId(),
      text: 'OFERTA ESPECIAL',
      boundingBox: { x: 140, y: 126, width: 700, height: 72 },
      confidence: 0.98,
      language: 'pt',
      approximateFontSize: 56,
      approximateColor: '#FF0000',
      metadata: {},
    },
    {
      id: generateId(),
      text: '50% OFF',
      boundingBox: { x: 300, y: 384, width: 480, height: 96 },
      confidence: 0.97,
      language: 'pt',
      approximateFontSize: 72,
      approximateColor: '#FFFFFF',
      metadata: {},
    },
    {
      id: generateId(),
      text: 'COMPRE AGORA',
      boundingBox: { x: 260, y: 660, width: 560, height: 64 },
      confidence: 0.96,
      language: 'pt',
      approximateFontSize: 48,
      approximateColor: '#FFCC00',
      metadata: {},
    },
  ],
};

/**
 * Fake OCR Provider — returns predefined fixtures.
 *
 * Used for development/testing without a real API key.
 * Always succeeds instantly (no delay, no errors).
 */
export class FakeOCRProvider implements OCRProvider {
  readonly id = 'fake-ocr';
  readonly name = 'Fake OCR (Development)';

  async detectText(
    _input: OCRInput,
    options?: OCRProviderOptions,
  ): Promise<OCRResult> {
    if (options?.signal?.aborted) {
      const { AIProviderError, AIErrorCode } = await import(
        '@/ai/errors/ai-error'
      );
      throw new AIProviderError(AIErrorCode.CANCELLED, 'Operation cancelled', {
        provider: this.id,
      });
    }

    return structuredClone(FIXTURE_TEXT);
  }
}
