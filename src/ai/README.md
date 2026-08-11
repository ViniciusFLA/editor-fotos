# src/ai/

AI Provider Architecture — vendor-agnostic abstraction layer for the Creative Editor.

## Structure

```
ai/
  index.ts                     # Barrel exports
  types/
    common.ts                  # BoundingBox, ImageInput, GeneratedImage, Confidence, AIMetadata
    ocr.ts                     # DetectedText, OCRInput, OCRResult
    segmentation.ts            # AIMask, SegmentedObject, SegmentationInput, SegmentationResult
    inpainting.ts              # InpaintingInput, InpaintingResult
    background-removal.ts      # BackgroundRemovalInput, BackgroundRemovalResult
    vision-analysis.ts         # DetectedRegion, CreativeComposition, VisionAnalysisInput, VisionAnalysisResult
  providers/
    ocr-provider.ts            # OCRProvider interface
    segmentation-provider.ts   # SegmentationProvider interface
    inpainting-provider.ts     # InpaintingProvider interface
    background-removal-provider.ts  # BackgroundRemovalProvider interface
    vision-analysis-provider.ts    # VisionAnalysisProvider interface
    registry.ts                # AIProviders collection + createAIProviders()
  errors/
    ai-error.ts                # AIProviderError + AIErrorCode
```

## Principles

### Vendor Agnostic
No AI provider interfaces reference any vendor SDK (Google, OpenAI, etc.).
Implementations are created outside this module and injected via `AIProviders`.

### Fabric.js Decoupled
No AI types or interfaces reference Fabric.js (`FabricImage`, `FabricObject`, `Canvas`).
Coordinates are in PIXELS relative to the original image.
Conversion to canvas/viewport coordinates belongs to a later application layer.

### Coordinate System
All `BoundingBox` values are in **pixels relative to the original image**.
Example: for a 1080x1080 source image, `{ x: 100, y: 200, width: 400, height: 80 }`
means a rectangle starting at pixel (100, 200).

### Confidence
Always a `number` between `0` and `1` (inclusive). Formatting for display
belongs to the UI layer.

### Error Handling
`AIProviderError` provides a consistent error model across all providers
with machine-readable `code`, human-readable `message`, and optional metadata.
Never exposes secrets or raw vendor responses.

### Cancellation
All async operations accept an optional `AbortSignal` via the `signal` option.

### Ownership
Provider results (images, masks) are plain data — the AI module does NOT
persist, cache, or create editor assets. That belongs to the application layer.

## Usage Example

```typescript
import { createAIProviders, type AIProviders } from '@/ai';

// Future: create providers with real vendor implementations
const ai: AIProviders = createAIProviders({
  ocr: new GoogleOCRProvider(config),
  segmentation: new HuggingFaceSegmentationProvider(config),
});

// Check availability before use
if (ai.ocr) {
  const result = await ai.ocr.detectText(input, { signal: controller.signal });
}
```

## Next Steps

- ~~ETAPA 32: First real OCR provider integration~~ **CONCLUDED** — Google Cloud Vision + FakeOCRProvider
- ETAPA 33: Convert DetectedText to TextElement
- ETAPA 35: First real Inpainting integration
- ETAPA 37: First real Segmentation integration
- ETAPA 43: First real Background Removal integration
- ETAPA 44: Logo detection via Vision Analysis
- ETAPA 45: Full Desmontar Criativo pipeline
