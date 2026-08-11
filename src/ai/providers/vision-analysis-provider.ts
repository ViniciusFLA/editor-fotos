import type { VisionAnalysisInput, VisionAnalysisResult } from '@/ai/types/vision-analysis';

/**
 * Vision Analysis Provider interface.
 *
 * Responsibility: analyze the semantic structure of an image (creative).
 *
 * Identifies components like headlines, CTAs, logos, products, persons,
 * prices, and badges — preparing for creative disassembly.
 *
 * Prepares for ETAPA 44 — Logo Detection and ETAPA 45 — Desmontar Criativo.
 *
 * Does NOT depend on Fabric.js or any specific vendor SDK.
 */
export interface VisionAnalysisProvider {
  /** Stable identifier for this provider */
  readonly id: string;

  /** Human-readable provider name */
  readonly name: string;

  /**
   * Analyze the semantic structure of an image.
   *
   * @param input - Source image and optional category restrictions
   * @param options.signal - AbortSignal for cancellation
   * @returns Detected regions organized by semantic category
   * @throws AIProviderError on failure
   */
  analyze(
    input: VisionAnalysisInput,
    options?: VisionAnalysisProviderOptions,
  ): Promise<VisionAnalysisResult>;
}

export interface VisionAnalysisProviderOptions {
  /** Signal to cancel the operation */
  signal?: AbortSignal;
}
