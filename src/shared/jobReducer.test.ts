import { describe, expect, it } from 'vitest';
import type { JobEvent, JobSnapshot } from './contracts.ts';
import { reduceJobEvent } from './jobReducer.ts';

function snapshot(): JobSnapshot {
  return {
    id: 'job-1',
    projectId: 'project-1',
    kind: 'orchestration',
    status: 'RUNNING',
    idea: 'فكرة اختبار',
    profile: 'quick',
    model: 'mock',
    stages: [
      {
        id: 'stage',
        label: 'مرحلة',
        description: 'مرحلة',
        artifact: 'stage.md',
        kind: 'final',
        optional: false,
        enabled: true,
        maxRetries: 0,
        position: { x: 0, y: 0 },
        status: 'RUNNING',
        attempt: 1,
        output: '',
      },
    ],
    edges: [],
    progress: 0,
    sequence: 2,
    createdAt: 1,
    updatedAt: 2,
    metrics: {
      requestCount: 1,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      contextCharacters: 10,
    },
  };
}

describe('job event reducer', () => {
  it('applies chunks once and rejects older sequences', () => {
    const current = snapshot();
    const chunk: JobEvent<'stage:chunk'> = {
      id: 'event-3',
      event: 'stage:chunk',
      jobId: current.id,
      projectId: current.projectId,
      sequence: 3,
      timestamp: 3,
      payload: { stageId: 'stage', chunk: 'hello' },
    };
    const updated = reduceJobEvent(current, chunk);
    expect(updated?.stages[0]?.output).toBe('hello');
    expect(reduceJobEvent(updated, chunk)?.stages[0]?.output).toBe('hello');
  });

  it('replaces local state with the authoritative final snapshot', () => {
    const current = snapshot();
    const completed = { ...current, status: 'COMPLETED' as const, progress: 100 };
    const event: JobEvent<'job:completed'> = {
      id: 'event-4',
      event: 'job:completed',
      jobId: current.id,
      projectId: current.projectId,
      sequence: 4,
      timestamp: 4,
      payload: { snapshot: completed },
    };
    expect(reduceJobEvent(current, event)).toEqual(completed);
  });
});
