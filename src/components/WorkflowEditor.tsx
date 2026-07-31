import { useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Play,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import type {
  StageKind,
  WorkflowEdge,
  WorkflowNodeDefinition,
  WorkflowProfile,
} from '../shared/contracts.ts';
import { blockingDagIssues, validateDag } from '../shared/dag.ts';
import { workflowForProfile } from '../shared/defaultWorkflow.ts';
import { useAppStore } from '../store.ts';

interface EditorNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  artifact: string;
  kind: StageKind;
  optional: boolean;
  enabled: boolean;
  maxRetries: number;
  model?: string;
  profiles?: WorkflowProfile[];
}

type EditorNode = Node<EditorNodeData>;

function toFlowNode(node: WorkflowNodeDefinition): EditorNode {
  return {
    id: node.id,
    position: { ...node.position },
    data: {
      label: node.label,
      description: node.description,
      artifact: node.artifact,
      kind: node.kind,
      optional: node.optional,
      enabled: node.enabled,
      maxRetries: node.maxRetries,
      ...(node.model ? { model: node.model } : {}),
      ...(node.profiles ? { profiles: [...node.profiles] } : {}),
    },
    className: `workflow-node workflow-node--${node.kind}`,
  };
}

function toDefinition(node: EditorNode): WorkflowNodeDefinition {
  return {
    id: node.id,
    label: node.data.label,
    description: node.data.description,
    artifact: node.data.artifact,
    kind: node.data.kind,
    optional: node.data.optional,
    enabled: node.data.enabled,
    maxRetries: node.data.maxRetries,
    position: { ...node.position },
    ...(node.data.model ? { model: node.data.model } : {}),
    ...(node.data.profiles ? { profiles: [...node.data.profiles] } : {}),
  };
}

function toWorkflowEdges(edges: Edge[]): WorkflowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
}

export default function WorkflowEditor() {
  const storedNodes = useAppStore((state) => state.nodes);
  const storedEdges = useAppStore((state) => state.edges);
  const profile = useAppStore((state) => state.profile);
  const setWorkflow = useAppStore((state) => state.setWorkflow);
  const resetWorkflow = useAppStore((state) => state.resetWorkflow);
  const requestRun = useAppStore((state) => state.requestRun);
  const pushToast = useAppStore((state) => state.pushToast);

  const [flowNodes, setFlowNodes] = useState<EditorNode[]>(() =>
    storedNodes.map(toFlowNode),
  );
  const [flowEdges, setFlowEdges] = useState<Edge[]>(() =>
    storedEdges.map((edge) => ({ ...edge, animated: false })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const definitions = useMemo(
    () => flowNodes.map(toDefinition),
    [flowNodes],
  );
  const workflowEdges = useMemo(
    () => toWorkflowEdges(flowEdges),
    [flowEdges],
  );
  const issues = useMemo(
    () => validateDag(definitions, workflowEdges),
    [definitions, workflowEdges],
  );
  const blockingIssues = blockingDagIssues(issues);
  const selected = flowNodes.find((node) => node.id === selectedId) ?? null;
  const profileGraph = workflowForProfile(definitions, workflowEdges, profile);

  const persist = (nextNodes: EditorNode[], nextEdges: Edge[]) => {
    setWorkflow(nextNodes.map(toDefinition), toWorkflowEdges(nextEdges));
  };

  const handleNodesChange = (changes: NodeChange<EditorNode>[]) => {
    setFlowNodes((current) => {
      const next = applyNodeChanges(changes, current);
      persist(next, flowEdges);
      return next;
    });
  };

  const handleEdgesChange = (changes: EdgeChange<Edge>[]) => {
    setFlowEdges((current) => {
      const next = applyEdgeChanges(changes, current);
      persist(flowNodes, next);
      return next;
    });
  };

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const candidate: Edge = {
      id: `edge-${crypto.randomUUID()}`,
      source: connection.source,
      target: connection.target,
    };
    const next = addEdge(candidate, flowEdges);
    const nextIssues = blockingDagIssues(
      validateDag(definitions, toWorkflowEdges(next)),
    );
    if (nextIssues.some((issue) => issue.code === 'CYCLE' || issue.code === 'SELF_LOOP')) {
      pushToast('edge-cycle', 'هذا الربط يصنع دورة مغلقة، لذلك لم يُضف.', 'error');
      return;
    }
    setFlowEdges(next);
    persist(flowNodes, next);
  };

  const addNode = () => {
    const id = `stage-${crypto.randomUUID()}`;
    const node: EditorNode = {
      id,
      position: { x: 820 + Math.random() * 180, y: 180 + flowNodes.length * 45 },
      data: {
        label: 'مرحلة جديدة',
        description: 'حدد المهمة والمخرج المتوقع بدقة.',
        artifact: `stage-${flowNodes.length + 1}.md`,
        kind: 'analysis',
        optional: false,
        enabled: true,
        maxRetries: 1,
        profiles: ['quick', 'balanced', 'full'],
      },
      className: 'workflow-node workflow-node--analysis',
    };
    const next = [...flowNodes, node];
    setFlowNodes(next);
    setSelectedId(id);
    persist(next, flowEdges);
  };

  const updateSelected = <K extends keyof EditorNodeData>(
    key: K,
    value: EditorNodeData[K],
  ) => {
    if (!selectedId) return;
    const next: EditorNode[] = flowNodes.map((node) =>
      node.id === selectedId
        ? {
            ...node,
            data: { ...node.data, [key]: value },
            className:
              key === 'kind'
                ? `workflow-node workflow-node--${String(value)}`
                : node.className ?? `workflow-node workflow-node--${node.data.kind}`,
          }
        : node,
    );
    setFlowNodes(next);
    persist(next, flowEdges);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const nextNodes = flowNodes.filter((node) => node.id !== selectedId);
    const nextEdges = flowEdges.filter(
      (edge) => edge.source !== selectedId && edge.target !== selectedId,
    );
    setFlowNodes(nextNodes);
    setFlowEdges(nextEdges);
    setSelectedId(null);
    persist(nextNodes, nextEdges);
  };

  const restoreDefault = () => {
    resetWorkflow();
    const state = useAppStore.getState();
    setFlowNodes(state.nodes.map(toFlowNode));
    setFlowEdges(state.edges.map((edge) => ({ ...edge })));
    setSelectedId(null);
    pushToast('workflow-reset', 'استُعيد المسار الافتراضي.', 'success');
  };

  return (
    <div className="page workflow-page">
      <section className="page-header">
        <div>
          <div className="eyebrow">
            <GitBranch size={16} />
            محرر DAG
          </div>
          <h1>صمّم فريق العمل بصريًا</h1>
          <p>أضف المراحل واربطها. المواضع والإعدادات تحفظ تلقائيًا على جهازك.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={restoreDefault}>
            <RotateCcw size={18} />
            استعادة الافتراضي
          </button>
          <button className="secondary-button" onClick={addNode}>
            <Plus size={18} />
            مرحلة
          </button>
          <button
            className="primary-button"
            onClick={() => {
              if (blockingIssues.length > 0) {
                pushToast(
                  'workflow-invalid-run',
                  blockingIssues[0]?.message ?? 'المخطط غير صالح.',
                  'error',
                );
                return;
              }
              requestRun();
            }}
          >
            <Play size={18} />
            استخدام وتشغيل
          </button>
        </div>
      </section>

      <section className="workflow-summary">
        <div>
          <strong>{definitions.length}</strong>
          <span>كل المراحل</span>
        </div>
        <div>
          <strong>{workflowEdges.length}</strong>
          <span>الاعتماديات</span>
        </div>
        <div>
          <strong>{profileGraph.nodes.length}</strong>
          <span>تعمل في وضع {profile}</span>
        </div>
        <div className={blockingIssues.length > 0 ? 'has-error' : 'is-valid'}>
          {blockingIssues.length > 0 ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>
            {blockingIssues.length > 0
              ? `${blockingIssues.length} مشكلة`
              : 'المخطط صالح'}
          </span>
        </div>
      </section>

      <div className="workflow-workbench">
        <section className="flow-canvas" aria-label="مخطط سير العمل">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_event, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            deleteKeyCode={null}
            fitView
            minZoom={0.25}
            maxZoom={1.6}
          >
            <Background color="#31334b" gap={22} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) =>
                node.data.kind === 'final'
                  ? '#a78bfa'
                  : node.data.kind === 'quality'
                    ? '#38bdf8'
                    : '#6d5dfc'
              }
            />
            <Controls />
          </ReactFlow>
        </section>

        <aside className={`node-inspector ${selected ? 'is-open' : ''}`}>
          {selected ? (
            <>
              <div className="node-inspector__heading">
                <div>
                  <span>إعدادات المرحلة</span>
                  <strong>{selected.data.label}</strong>
                </div>
                <button className="danger-icon" onClick={deleteSelected} aria-label="حذف المرحلة">
                  <Trash2 size={18} />
                </button>
              </div>
              <label>
                الاسم
                <input
                  value={selected.data.label}
                  onChange={(event) => updateSelected('label', event.target.value)}
                />
              </label>
              <label>
                الوصف
                <textarea
                  value={selected.data.description}
                  onChange={(event) =>
                    updateSelected('description', event.target.value)
                  }
                  rows={4}
                />
              </label>
              <label>
                اسم الملف
                <input
                  dir="ltr"
                  value={selected.data.artifact}
                  onChange={(event) =>
                    updateSelected('artifact', event.target.value)
                  }
                />
              </label>
              <label>
                النوع
                <select
                  value={selected.data.kind}
                  onChange={(event) =>
                    updateSelected('kind', event.target.value as StageKind)
                  }
                >
                  <option value="analysis">تحليل</option>
                  <option value="implementation">تنفيذ</option>
                  <option value="quality">جودة</option>
                  <option value="final">تجميع نهائي</option>
                </select>
              </label>
              <label>
                إعادة المحاولة
                <select
                  value={selected.data.maxRetries}
                  onChange={(event) =>
                    updateSelected('maxRetries', Number(event.target.value))
                  }
                >
                  <option value={0}>بدون</option>
                  <option value={1}>مرة واحدة</option>
                  <option value={2}>مرتان</option>
                </select>
              </label>
              <label className="switch-row">
                <span>
                  مرحلة اختيارية
                  <small>فشلها لا يوقف المسار بالكامل</small>
                </span>
                <input
                  type="checkbox"
                  checked={selected.data.optional}
                  onChange={(event) =>
                    updateSelected('optional', event.target.checked)
                  }
                />
              </label>
              <label className="switch-row">
                <span>
                  مفعّلة
                  <small>المرحلة المعطلة لا تدخل التنفيذ</small>
                </span>
                <input
                  type="checkbox"
                  checked={selected.data.enabled}
                  onChange={(event) =>
                    updateSelected('enabled', event.target.checked)
                  }
                />
              </label>
              <div className="inspector-saved">
                <Save size={16} />
                يحفظ تلقائيًا
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <GitBranch size={28} />
              <strong>اختر مرحلة</strong>
              <p>اضغط على بطاقة في المخطط لتعديل تفاصيلها.</p>
            </div>
          )}
        </aside>
      </div>

      {issues.length > 0 && (
        <section className="issue-list">
          <h2>ملاحظات المخطط</h2>
          {issues.map((issue) => (
            <div key={`${issue.code}-${issue.nodeIds.join('-')}`}>
              <AlertTriangle size={17} />
              <span>{issue.message}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
