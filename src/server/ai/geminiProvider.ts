import { GoogleGenAI } from '@google/genai';
import {
  AIProviderError,
  isAbortError,
  userFacingProviderError,
  type AIChunk,
  type AIProvider,
  type AIRequest,
} from './provider.ts';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  constructor(private readonly apiKeys: string[]) {
    if (apiKeys.length === 0) {
      throw new AIProviderError('أضف مفتاح Gemini من الإعدادات أولًا.', false);
    }
  }

  async *stream(request: AIRequest): AsyncIterable<AIChunk> {
    let lastError: AIProviderError | null = null;
    for (const apiKey of this.apiKeys) {
      let emitted = false;
      try {
        const client = new GoogleGenAI({ apiKey });
        const response = await client.models.generateContentStream({
          model: request.model,
          contents: request.prompt,
          config: {
            abortSignal: request.signal,
            systemInstruction: request.systemInstruction,
            temperature: request.temperature,
            maxOutputTokens: request.maxOutputTokens,
          },
        });
        for await (const chunk of response) {
          if (request.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
          const text = chunk.text ?? '';
          const usage = chunk.usageMetadata;
          emitted ||= text.length > 0;
          yield {
            text,
            ...(usage
              ? {
                  usage: {
                    inputTokens: usage.promptTokenCount ?? 0,
                    outputTokens: usage.candidatesTokenCount ?? 0,
                  },
                }
              : {}),
          };
        }
        return;
      } catch (error) {
        if (isAbortError(error)) throw error;
        lastError = userFacingProviderError(error);
        if (emitted || !lastError.retryable) throw lastError;
      }
    }
    throw lastError ?? new AIProviderError('فشل استدعاء Gemini.', true);
  }
}
