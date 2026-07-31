import { describe, expect, it } from 'vitest';
import type {
  JobEvent,
  JobSnapshot,
  WorkflowEdge,
  WorkflowNodeDefinition,
} from '../shared/contracts.ts';
import { MockAIProvider } from './ai/mockProvider.ts';
import { JobManager } from './jobManager.ts';

function node(
  id: string,
  options: { optional?: boolean; kind?: WorkflowNodeDefinition['kind'] } = {},
): WorkflowNodeDefinition {
  return {
    id,
    label: id,
    description: id,
    artifact: `${id}.md`,
    kind: options.kind ?? 'analysis',
    optional: options.optional ?? false,
    enabled: true,
    maxRetries: 0,
    position: { x: 0, y: 0 },
  };
}

async function finished(
  manager: JobManager,
  id: string,
  timeoutMs = 2_000,
): Promise<JobSnapshot> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const snapshot = manager.get(id);
    if (snapshot && !['QUEUED', 'RUNNING'].includes(snapshot.status)) {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for job');
}

describe('JobManager', () => {
  it('runs independent branches and emits a monotonic shared event contract', async () => {
    const events: JobEvent[] = [];
    const manager = new JobManager((_room, event) => events.push(event));
    const nodes = [
      node('a'),
      node('b'),
      node('c'),
      node('final', { kind: 'final' }),
    ];
    const edges: WorkflowEdge[] = [
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'a-c', source: 'a', target: 'c' },
      { id: 'b-final', source: 'b', target: 'final' },
      { id: 'c-final', source: 'c', target: 'final' },
    ];
    const started = manager.startWorkflow(
      {
        projectId: 'project',
        idea: 'فكرة طويلة بما يكفي للاختبار',
        profile: 'quick',
        model: 'mock',
        nodes,
        edges,
      },
      new MockAIProvider(),
    );
    const result = await finished(manager, started.id);
    expect(result.status).toBe('COMPLETED');
    expect(result.finalOutput).toContain('# final');
    expect(result.metrics.requestCount).toBe(4);
    expect(events.map((event) => event.sequence)).toEqual(
      [...events.map((event) => event.sequence)].sort((a, b) => a - b),
    );
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
  });

  it('blocks descendants of a failed mandatory stage but lets an independent branch settle', async () => {
    const manager = new JobManager();
    const nodes = [
      node('failure'),
      node('blocked'),
      node('independent'),
      node('final', { kind: 'final' }),
    ];
    const edges: WorkflowEdge[] = [
      { id: 'failure-blocked', source: 'failure', target: 'blocked' },
      { id: 'blocked-final', source: 'blocked', target: 'final' },
      { id: 'independent-final', source: 'independent', target: 'final' },
    ];
    const started = manager.startWorkflow(
      {
        projectId: 'project',
        idea: 'فكرة طويلة بما يكفي للاختبار',
        profile: 'quick',
        model: 'mock',
        nodes,
        edges,
      },
      new MockAIProvider({ failTasks: ['failure'] }),
    );
    const result = await finished(manager, started.id);
    expect(result.status).toBe('FAILED');
    expect(result.stages.find((stage) => stage.id === 'failure')?.status).toBe(
      'FAILED',
    );
    expect(result.stages.find((stage) => stage.id === 'blocked')?.status).toBe(
      'BLOCKED',
    );
    expect(
      result.stages.find((stage) => stage.id === 'independent')?.status,
    ).toBe('COMPLETED');
  });

  it('honors cancellation through AbortSignal', async () => {
    const manager = new JobManager();
    const started = manager.startWorkflow(
      {
        projectId: 'project',
        idea: 'فكرة طويلة بما يكفي للاختبار',
        profile: 'quick',
        model: 'mock',
        nodes: [node('slow'), node('final', { kind: 'final' })],
        edges: [{ id: 'slow-final', source: 'slow', target: 'final' }],
      },
      new MockAIProvider({ latencyMs: 80 }),
    );
    manager.cancel(started.id);
    const result = await finished(manager, started.id);
    expect(result.status).toBe('CANCELED');
    expect(result.stages.every((stage) => stage.status === 'CANCELED')).toBe(
      true,
    );
  });
});
