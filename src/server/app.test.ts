import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { DEFAULT_WORKFLOW_EDGES, DEFAULT_WORKFLOW_NODES } from '../shared/defaultWorkflow.ts';
import { MockAIProvider } from './ai/mockProvider.ts';
import { createApp } from './app.ts';
import { JobManager } from './jobManager.ts';
import { PreviewStore } from './previewStore.ts';

describe('HTTP API', () => {
  it('reports health without a database or external queue', async () => {
    const app = createApp({
      jobManager: new JobManager(),
      previewStore: new PreviewStore(),
      providerFactory: () => new MockAIProvider(),
    });
    const response = await supertest(app).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.persistence).toBe('browser-indexeddb');
    expect(response.body.queue).toBe('in-process');
  });

  it('validates input and starts a real JobManager workflow', async () => {
    const manager = new JobManager();
    const app = createApp({
      jobManager: manager,
      previewStore: new PreviewStore(),
      providerFactory: () => new MockAIProvider(),
    });
    await supertest(app).post('/api/jobs/orchestration').send({}).expect(400);
    const response = await supertest(app)
      .post('/api/jobs/orchestration')
      .send({
        projectId: 'api-project',
        idea: 'فكرة تطبيق شخصية واضحة للاختبار',
        profile: 'quick',
        model: 'mock',
        nodes: DEFAULT_WORKFLOW_NODES,
        edges: DEFAULT_WORKFLOW_EDGES,
      })
      .expect(202);
    expect(typeof response.body.id).toBe('string');
    expect(manager.get(response.body.id)?.projectId).toBe('api-project');
  });
});
