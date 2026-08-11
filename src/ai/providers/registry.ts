import type { OCRProvider } from './ocr-provider';
import type { SegmentationProvider } from './segmentation-provider';
import type { InpaintingProvider } from './inpainting-provider';
import type { BackgroundRemovalProvider } from './background-removal-provider';
import type { VisionAnalysisProvider } from './vision-analysis-provider';

/**
 * Collection of AI providers available to the application.
 *
 * Each provider is optional — the application checks availability
 * before attempting to use a feature.
 *
 * This is a simple value object, not a global service locator.
 * The application creates an AIProviders instance with the desired
 * implementations and passes it down via context or props.
 */
export interface AIProviders {
  ocr?: OCRProvider;
  segmentation?: SegmentationProvider;
  inpainting?: InpaintingProvider;
  backgroundRemoval?: BackgroundRemovalProvider;
  visionAnalysis?: VisionAnalysisProvider;
}

/**
 * Create an AIProviders instance.
 *
 * Usage:
 *   const ai = createAIProviders({ ocr: new GoogleOCRProvider() });
 *   if (ai.ocr) {
 *     const result = await ai.ocr.detectText(input, { signal });
 *   }
 */
export function createAIProviders(providers: Partial<AIProviders>): AIProviders {
  return providers;
}
