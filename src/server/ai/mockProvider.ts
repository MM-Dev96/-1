import type { AIChunk, AIProvider, AIRequest } from './provider.ts';

export interface MockProviderOptions {
  latencyMs?: number;
  failTasks?: string[];
}

function abortableDelay(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, delay);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';
  private readonly latencyMs: number;
  private readonly failTasks: Set<string>;

  constructor(options: MockProviderOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.failTasks = new Set(options.failTasks ?? []);
  }

  async *stream(request: AIRequest): AsyncIterable<AIChunk> {
    if (this.failTasks.has(request.taskId)) {
      throw new Error(`Mock failure for ${request.taskId}`);
    }
    const output =
      request.taskId === 'mockup'
        ? '<!doctype html><html lang="ar" dir="rtl"><body><main><h1>نموذج تجريبي</h1><button>ابدأ</button></main></body></html>'
        : `# ${request.taskId}\n\nمخرج تجريبي موثوق للمهمة.\n\n${request.prompt.slice(0, 120)}`;
    const midpoint = Math.ceil(output.length / 2);
    for (const text of [output.slice(0, midpoint), output.slice(midpoint)]) {
      await abortableDelay(this.latencyMs, request.signal);
      yield {
        text,
        usage: {
          inputTokens: Math.ceil(request.prompt.length / 4),
          outputTokens: Math.ceil(output.length / 4),
        },
      };
    }
  }
}
