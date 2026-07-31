import { describe, expect, it } from 'vitest';
import type {
  WorkflowEdge,
  WorkflowNodeDefinition,
} from './contracts.ts';
import {
  blockingDagIssues,
  descendantsOf,
  validateDag,
} from './dag.ts';
import {
  DEFAULT_WORKFLOW_EDGES,
  DEFAULT_WORKFLOW_NODES,
  workflowForProfile,
} from './defaultWorkflow.ts';

function node(id: string): WorkflowNodeDefinition {
  return {
    id,
    label: id,
    description: id,
    artifact: `${id}.md`,
    kind: id === 'final' ? 'final' : 'analysis',
    optional: false,
    enabled: true,
    maxRetries: 0,
    position: { x: 0, y: 0 },
  };
}

describe('DAG validation', () => {
  it('accepts the shipped workflow in every profile', () => {
    for (const profile of ['quick', 'balanced', 'full'] as const) {
      const graph = workflowForProfile(
        DEFAULT_WORKFLOW_NODES,
        DEFAULT_WORKFLOW_EDGES,
        profile,
      );
      expect(blockingDagIssues(validateDag(graph.nodes, graph.edges))).toEqual([]);
    }
  });

  it('detects missing references, self loops, duplicates, and cycles', () => {
    const nodes = [node('a'), node('b'), node('b'), node('final')];
    const edges: WorkflowEdge[] = [
      { id: 'same', source: 'a', target: 'b' },
      { id: 'same', source: 'b', target: 'a' },
      { id: 'self', source: 'a', target: 'a' },
      { id: 'missing', source: 'ghost', target: 'final' },
    ];
    const codes = validateDag(nodes, edges).map((issue) => issue.code);
    expect(codes).toContain('DUPLICATE_NODE');
    expect(codes).toContain('DUPLICATE_EDGE');
    expect(codes).toContain('MISSING_NODE');
    expect(codes).toContain('SELF_LOOP');
    expect(codes).toContain('CYCLE');
  });

  it('returns every descendant for selective retries', () => {
    const nodes = [node('a'), node('b'), node('c'), node('final')];
    const edges: WorkflowEdge[] = [
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'b-final', source: 'b', target: 'final' },
      { id: 'a-c', source: 'a', target: 'c' },
    ];
    expect([...descendantsOf('a', nodes, edges)].sort()).toEqual([
      'b',
      'c',
      'final',
    ]);
  });
});
