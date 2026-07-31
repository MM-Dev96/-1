import type {
  WorkflowEdge,
  WorkflowNodeDefinition,
} from './contracts.ts';

export interface DagIssue {
  code:
    | 'DUPLICATE_NODE'
    | 'DUPLICATE_EDGE'
    | 'MISSING_NODE'
    | 'SELF_LOOP'
    | 'CYCLE'
    | 'EMPTY_LABEL'
    | 'NO_FINAL_NODE';
  message: string;
  nodeIds: string[];
}

export interface DagMaps {
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
}

export function buildDagMaps(
  nodes: WorkflowNodeDefinition[],
  edges: WorkflowEdge[],
): DagMaps {
  const parents = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const children = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    parents.get(edge.target)?.push(edge.source);
    children.get(edge.source)?.push(edge.target);
  }
  return { parents, children };
}

export function validateDag(
  nodes: WorkflowNodeDefinition[],
  edges: WorkflowEdge[],
): DagIssue[] {
  const issues: DagIssue[] = [];
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        code: 'DUPLICATE_NODE',
        message: `معرّف المرحلة مكرر: ${node.id}`,
        nodeIds: [node.id],
      });
    }
    nodeIds.add(node.id);
    if (!node.label.trim()) {
      issues.push({
        code: 'EMPTY_LABEL',
        message: `المرحلة ${node.id} بلا اسم.`,
        nodeIds: [node.id],
      });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        code: 'DUPLICATE_EDGE',
        message: `معرّف الرابط مكرر: ${edge.id}`,
        nodeIds: [edge.source, edge.target],
      });
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        code: 'MISSING_NODE',
        message: `الرابط ${edge.id} يشير إلى مرحلة غير موجودة.`,
        nodeIds: [edge.source, edge.target],
      });
    }
    if (edge.source === edge.target) {
      issues.push({
        code: 'SELF_LOOP',
        message: `المرحلة ${edge.source} لا يمكن أن تعتمد على نفسها.`,
        nodeIds: [edge.source],
      });
    }
  }

  if (!nodes.some((node) => node.kind === 'final')) {
    issues.push({
      code: 'NO_FINAL_NODE',
      message: 'لا توجد مرحلة نهائية؛ سيُستخدم آخر مخرج مكتمل كما هو.',
      nodeIds: [],
    });
  }

  const validEdges = edges.filter(
    (edge) =>
      nodeIds.has(edge.source) &&
      nodeIds.has(edge.target) &&
      edge.source !== edge.target,
  );
  const { parents, children } = buildDagMaps(nodes, validEdges);
  const indegree = new Map(
    nodes.map((node) => [node.id, parents.get(node.id)?.length ?? 0]),
  );
  const queue = nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    visited += 1;
    for (const child of children.get(id) ?? []) {
      const next = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, next);
      if (next === 0) queue.push(child);
    }
  }
  if (visited !== nodes.length) {
    const cyclic = nodes
      .filter((node) => (indegree.get(node.id) ?? 0) > 0)
      .map((node) => node.id);
    issues.push({
      code: 'CYCLE',
      message: `المخطط يحتوي دورة مغلقة بين: ${cyclic.join('، ')}`,
      nodeIds: cyclic,
    });
  }
  return issues;
}

export function blockingDagIssues(issues: DagIssue[]): DagIssue[] {
  return issues.filter((issue) => issue.code !== 'NO_FINAL_NODE');
}

export function descendantsOf(
  nodeId: string,
  nodes: WorkflowNodeDefinition[],
  edges: WorkflowEdge[],
): Set<string> {
  const { children } = buildDagMaps(nodes, edges);
  const result = new Set<string>();
  const queue = [...(children.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || result.has(id)) continue;
    result.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return result;
}
