import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
} from 'express';
import multer from 'multer';
import type {
  JobSnapshot,
  StartStandaloneInput,
  StartWorkflowInput,
  WorkflowEdge,
  WorkflowNodeDefinition,
  WorkflowProfile,
} from '../shared/contracts.ts';
import {
  DEFAULT_WORKFLOW_EDGES,
  DEFAULT_WORKFLOW_NODES,
  PROFILE_META,
} from '../shared/defaultWorkflow.ts';
import { AIProviderError, type AIProvider } from './ai/provider.ts';
import { GeminiProvider } from './ai/geminiProvider.ts';
import { MockAIProvider } from './ai/mockProvider.ts';
import { DagValidationError, JobManager } from './jobManager.ts';
import { PreviewStore } from './previewStore.ts';

type ProviderFactory = (request: Request) => AIProvider;

export interface AppServices {
  jobManager: JobManager;
  previewStore: PreviewStore;
  providerFactory?: ProviderFactory;
}

class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

function recordOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError('صيغة الطلب غير صحيحة.');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RequestValidationError(`${label} مطلوب.`);
  }
  return value.trim();
}

function parseProfile(value: unknown): WorkflowProfile {
  if (value === 'quick' || value === 'balanced' || value === 'full') return value;
  return 'balanced';
}

function parseNodes(value: unknown): WorkflowNodeDefinition[] {
  if (!Array.isArray(value)) return structuredClone(DEFAULT_WORKFLOW_NODES);
  for (const item of value) {
    const node = recordOf(item);
    requiredString(node.id, 'معرّف المرحلة');
    requiredString(node.label, 'اسم المرحلة');
  }
  return value as WorkflowNodeDefinition[];
}

function parseEdges(value: unknown): WorkflowEdge[] {
  if (!Array.isArray(value)) return structuredClone(DEFAULT_WORKFLOW_EDGES);
  for (const item of value) {
    const edge = recordOf(item);
    requiredString(edge.id, 'معرّف الرابط');
    requiredString(edge.source, 'مصدر الرابط');
    requiredString(edge.target, 'هدف الرابط');
  }
  return value as WorkflowEdge[];
}

function keysFromRequest(request: Request): string[] {
  const header = request.header('x-gemini-keys') ?? '';
  const configured = header || process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  return configured
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
}

function defaultProviderFactory(request: Request): AIProvider {
  if (process.env.AI_PROVIDER === 'mock') return new MockAIProvider();
  return new GeminiProvider(keysFromRequest(request));
}

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function createApp(services: AppServices): express.Express {
  const app = express();
  const providerFactory = services.providerFactory ?? defaultProviderFactory;
  const upload = multer({
    storage: multer.memoryStorage(),
    preservePath: true,
    limits: { fileSize: 15 * 1024 * 1024, files: 120 },
  });

  app.use(express.json({ limit: '3mb' }));

  app.get('/api/health', (_request, response) => {
    const providerConfigured =
      process.env.AI_PROVIDER === 'mock' ||
      Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS);
    response.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      activeJobs: services.jobManager.listActive().length,
      providerConfigured,
      persistence: 'browser-indexeddb',
      queue: 'in-process',
      timestamp: Date.now(),
    });
  });

  app.get('/api/workflows/default', (_request, response) => {
    response.json({
      nodes: DEFAULT_WORKFLOW_NODES,
      edges: DEFAULT_WORKFLOW_EDGES,
      profiles: PROFILE_META,
    });
  });

  app.post('/api/jobs/orchestration', (request, response, next) => {
    try {
      const body = recordOf(request.body);
      const input: StartWorkflowInput = {
        projectId:
          typeof body.projectId === 'string' && body.projectId
            ? body.projectId
            : crypto.randomUUID(),
        idea: requiredString(body.idea, 'فكرة المشروع'),
        profile: parseProfile(body.profile),
        model:
          typeof body.model === 'string' && body.model.trim()
            ? body.model.trim()
            : process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        nodes: parseNodes(body.nodes),
        edges: parseEdges(body.edges),
        ...(body.resume ? { resume: body.resume as JobSnapshot } : {}),
      };
      const snapshot = services.jobManager.startWorkflow(
        input,
        providerFactory(request),
      );
      response.status(202).json(snapshot);
    } catch (error) {
      next(error);
    }
  });

  const standaloneKinds = new Set([
    'evaluation',
    'self-audit',
    'mockup',
    'idea-improver',
  ]);
  app.post('/api/jobs/:kind', (request, response, next) => {
    try {
      if (!standaloneKinds.has(request.params.kind ?? '')) {
        response.status(404).json({ error: 'نوع المهمة غير موجود.' });
        return;
      }
      const body = recordOf(request.body);
      const input: StartStandaloneInput = {
        projectId:
          typeof body.projectId === 'string' && body.projectId
            ? body.projectId
            : crypto.randomUUID(),
        kind: request.params.kind as StartStandaloneInput['kind'],
        source: requiredString(body.source, 'المحتوى'),
        model:
          typeof body.model === 'string' && body.model.trim()
            ? body.model.trim()
            : process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        ...(typeof body.instruction === 'string' && body.instruction.trim()
          ? { instruction: body.instruction.trim() }
          : {}),
      };
      const snapshot = services.jobManager.startStandalone(
        input,
        providerFactory(request),
      );
      response.status(202).json(snapshot);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/jobs/:id', (request, response) => {
    const snapshot = services.jobManager.get(request.params.id ?? '');
    if (!snapshot) {
      response.status(404).json({ error: 'المهمة غير موجودة أو انتهت مدة حفظها.' });
      return;
    }
    response.json(snapshot);
  });

  app.post('/api/jobs/:id/cancel', (request, response) => {
    const snapshot = services.jobManager.cancel(request.params.id ?? '');
    if (!snapshot) {
      response.status(404).json({ error: 'المهمة غير موجودة.' });
      return;
    }
    response.json(snapshot);
  });

  app.post('/api/jobs/:id/retry/:stageId', (request, response, next) => {
    try {
      const snapshot = services.jobManager.retryStage(
        request.params.id ?? '',
        request.params.stageId ?? '',
      );
      if (!snapshot) {
        response.status(404).json({ error: 'المهمة أو المرحلة غير موجودة.' });
        return;
      }
      response.status(202).json(snapshot);
    } catch (error) {
      next(error);
    }
  });

  app.post(
    '/api/previews',
    upload.array('files', 120),
    asyncHandler((request, response) => {
      const files = request.files;
      if (!Array.isArray(files) || files.length === 0) {
        response.status(400).json({ error: 'اختر ZIP أو مجلدًا للمعاينة.' });
        return;
      }
      const result = services.previewStore.create(files);
      response.status(result.id ? 201 : 422).json(result);
    }),
  );

  app.get('/api/previews/:id/*', (request, response) => {
    services.previewStore.serve(request, response);
  });

  app.delete('/api/previews/:id', (request, response) => {
    const deleted = services.previewStore.delete(request.params.id ?? '');
    response.status(deleted ? 204 : 404).end();
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof DagValidationError) {
      response.status(422).json({
        error: 'المخطط غير صالح.',
        details: error.issues.map((issue) => issue.message),
      });
      return;
    }
    if (error instanceof AIProviderError) {
      response.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof RequestValidationError) {
      response.status(400).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع.';
    response.status(500).json({ error: message });
  };
  app.use(errorHandler);
  return app;
}
