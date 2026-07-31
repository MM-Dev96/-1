import type {
  ApiErrorBody,
  JobKind,
  JobSnapshot,
  StartStandaloneInput,
  StartWorkflowInput,
} from '../shared/contracts.ts';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  apiKeys: string[] = [],
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (apiKeys.length > 0) headers.set('x-gemini-keys', apiKeys.join(','));
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    let body: ApiErrorBody = { error: `فشل الطلب (${response.status}).` };
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Keep the status-based fallback.
    }
    throw new ApiRequestError(
      body.error,
      response.status,
      body.details ?? [],
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  health: () =>
    requestJson<{
      status: string;
      activeJobs: number;
      providerConfigured: boolean;
      uptimeSeconds: number;
    }>('/api/health'),

  startWorkflow: (input: StartWorkflowInput, apiKeys: string[]) =>
    requestJson<JobSnapshot>(
      '/api/jobs/orchestration',
      { method: 'POST', body: JSON.stringify(input) },
      apiKeys,
    ),

  startStandalone: (
    input: StartStandaloneInput,
    apiKeys: string[],
  ) =>
    requestJson<JobSnapshot>(
      `/api/jobs/${input.kind}`,
      { method: 'POST', body: JSON.stringify(input) },
      apiKeys,
    ),

  getJob: (id: string) => requestJson<JobSnapshot>(`/api/jobs/${id}`),

  cancelJob: (id: string) =>
    requestJson<JobSnapshot>(`/api/jobs/${id}/cancel`, { method: 'POST' }),

  retryStage: (jobId: string, stageId: string) =>
    requestJson<JobSnapshot>(
      `/api/jobs/${jobId}/retry/${stageId}`,
      { method: 'POST' },
    ),

  deletePreview: (id: string) =>
    requestJson<void>(`/api/previews/${id}`, { method: 'DELETE' }),

  uploadPreview: (files: File[], signal?: AbortSignal) => {
    const form = new FormData();
    for (const file of files) {
      const relative =
        'webkitRelativePath' in file &&
        typeof file.webkitRelativePath === 'string' &&
        file.webkitRelativePath
          ? file.webkitRelativePath
          : file.name;
      form.append('files', file, relative);
    }
    return requestJson<{
      id?: string;
      url?: string;
      files: string[];
      buildRequired: boolean;
      message?: string;
    }>(
      '/api/previews',
      {
        method: 'POST',
        body: form,
        ...(signal ? { signal } : {}),
      },
    );
  },
};

export async function waitForJob(
  id: string,
  signal?: AbortSignal,
  onSnapshot?: (snapshot: JobSnapshot) => void,
): Promise<JobSnapshot> {
  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const snapshot = await api.getJob(id);
    onSnapshot?.(snapshot);
    if (!['QUEUED', 'RUNNING'].includes(snapshot.status)) return snapshot;
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, 1_200);
      signal?.addEventListener(
        'abort',
        () => {
          window.clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  }
}

export function standaloneInput(
  kind: Exclude<JobKind, 'orchestration'>,
  source: string,
  model: string,
  projectId: string = crypto.randomUUID(),
): StartStandaloneInput {
  return { projectId, kind, source, model };
}
