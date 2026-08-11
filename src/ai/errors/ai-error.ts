/**
 * AI provider error codes.
 *
 * Provides a consistent error classification across all AI providers.
 * Future provider implementations should map their vendor-specific errors
 * to these standard codes.
 */
export const AIErrorCode = {
  /** Input is invalid or unsupported by the provider */
  INVALID_INPUT: 'INVALID_INPUT',

  /** Input format is not supported */
  UNSUPPORTED_INPUT: 'UNSUPPORTED_INPUT',

  /** Authentication or authorization failure */
  AUTHENTICATION: 'AUTHENTICATION',

  /** Rate limit exceeded */
  RATE_LIMIT: 'RATE_LIMIT',

  /** Operation timed out */
  TIMEOUT: 'TIMEOUT',

  /** Network error (no response, connection refused, etc.) */
  NETWORK: 'NETWORK',

  /** The provider returned an unexpected response */
  PROVIDER_ERROR: 'PROVIDER_ERROR',

  /** The response could not be parsed or validated */
  INVALID_RESPONSE: 'INVALID_RESPONSE',

  /** Operation was cancelled via AbortSignal */
  CANCELLED: 'CANCELLED',

  /** Unknown or unclassified error */
  UNKNOWN: 'UNKNOWN',
} as const;

export type AIErrorCode = (typeof AIErrorCode)[keyof typeof AIErrorCode];

/**
 * Structured error from an AI provider.
 *
 * Never exposes secrets, API keys, or raw vendor responses.
 */
export class AIProviderError extends Error {
  /** Machine-readable error code */
  readonly code: AIErrorCode;

  /** Optional: which provider generated this error */
  readonly provider?: string;

  /** Whether the operation can be retried */
  readonly retryable: boolean;

  /** Optional: underlying cause (another Error) */
  readonly cause?: Error;

  /** Optional: safe metadata (never secrets) */
  readonly metadata: Record<string, unknown>;

  constructor(
    code: AIErrorCode,
    message: string,
    options?: {
      provider?: string;
      retryable?: boolean;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.provider = options?.provider;
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;
    this.metadata = options?.metadata ?? {};
  }

  /** Convenience: was this operation cancelled? */
  get cancelled(): boolean {
    return this.code === AIErrorCode.CANCELLED;
  }
}
