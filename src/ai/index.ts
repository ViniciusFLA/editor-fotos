// Barrel exports for the AI module

// Errors
export { AIProviderError, AIErrorCode } from './errors/ai-error';
export type { AIErrorCode as AIErrorCodeType } from './errors/ai-error';

// Common types
export type {
  BoundingBox,
  Confidence,
  ImageInput,
  ImageMimeType,
  GeneratedImage,
  AIMetadata,
  AIResult,
} from './types/common';
export { BoundingBoxSchema, ImageInputSchema, GeneratedImageSchema } from './types/common';

// OCR types
export type { DetectedText, OCRInput, OCRResult } from './types/ocr';

// Segmentation types
export type { AIMask, BlobMask, DataUrlMask, SegmentedObject, SegmentationInput, SegmentationResult } from './types/segmentation';

// Inpainting types
export type { InpaintingInput, InpaintingResult } from './types/inpainting';

// Background removal types
export type { BackgroundRemovalInput, BackgroundRemovalResult } from './types/background-removal';

// Vision analysis types
export type { DetectedRegion, CreativeComposition, VisionAnalysisInput, VisionAnalysisResult } from './types/vision-analysis';

// Provider interfaces
export type { OCRProvider, OCRProviderOptions } from './providers/ocr-provider';
export type { SegmentationProvider, SegmentationProviderOptions } from './providers/segmentation-provider';
export type { InpaintingProvider, InpaintingProviderOptions } from './providers/inpainting-provider';
export type { BackgroundRemovalProvider, BackgroundRemovalProviderOptions } from './providers/background-removal-provider';
export type { VisionAnalysisProvider, VisionAnalysisProviderOptions } from './providers/vision-analysis-provider';

// Registry
export type { AIProviders } from './providers/registry';
export { createAIProviders } from './providers/registry';

// Concrete OCR providers
export { GoogleOCRProvider } from './providers/google-ocr-provider';
export { FakeOCRProvider } from './providers/fake-ocr-provider';

// OCR normalizers
export { normalizeGoogleOCRResponse } from './normalizers/ocr-normalizer';
