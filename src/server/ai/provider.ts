export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIChunk {
  text: string;
  usage?: AIUsage;
}

export interface AIRequest {
  taskId: string;
  prompt: string;
  model: string;
  signal: AbortSignal;
  systemInstruction: string;
  temperature: number;
  maxOutputTokens: number;
}

export interface AIProvider {
  readonly name: string;
  stream(request: AIRequest): AsyncIterable<AIChunk>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error &&
      (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')))
  );
}

export function userFacingProviderError(error: unknown): AIProviderError {
  if (isAbortError(error)) {
    return new AIProviderError('أُلغي الطلب.', false);
  }
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();
  if (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit')
  ) {
    return new AIProviderError(
      'وصلت مفاتيح Gemini إلى حد الطلبات. انتظر قليلًا أو أضف مفتاحًا آخر.',
      true,
    );
  }
  if (lower.includes('api key') || lower.includes('401') || lower.includes('403')) {
    return new AIProviderError(
      'تعذر استخدام مفتاح Gemini. تأكد من المفتاح ثم أعد المحاولة.',
      false,
    );
  }
  return new AIProviderError(
    raw.length > 240 ? `${raw.slice(0, 237)}…` : raw,
    true,
  );
}
