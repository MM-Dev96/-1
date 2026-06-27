import React, { useState, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Save } from 'lucide-react';
import { useAppStore } from '../store';

const initialNodes: Node[] = [
  { id: '1', position: { x: 250, y: 5 }, data: { label: 'Product Manager', task_type: 'PM', prompt_template: 'Analyze idea', artifact_schema: 'PRD' }, type: 'input' },
  { id: '2', position: { x: 100, y: 100 }, data: { label: 'UX Researcher', task_type: 'UX', prompt_template: 'Design UX', artifact_schema: 'UserFlow' } },
  { id: '3', position: { x: 400, y: 100 }, data: { label: 'System Architect', task_type: 'Arch', prompt_template: 'System Architecture', artifact_schema: 'ArchDoc' } },
  { id: '4', position: { x: 250, y: 200 }, data: { label: 'AI Orchestrator', task_type: 'Orch', prompt_template: 'Orchestrate', artifact_schema: 'Pipeline' }, type: 'output' },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e1-3', source: '1', target: '3', animated: true },
  { id: 'e2-4', source: '2', target: '4', animated: true },
  { id: 'e3-4', source: '3', target: '4', animated: true },
];

export default function WorkflowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isSaving, setIsSaving] = useState(false);
  const idea = useAppStore(state => state.idea);
  const setActivityLogs = useAppStore(state => state.setActivityLogs);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const saveWorkflow = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 1, // mock
          name: 'Custom Workflow',
          nodes,
          edges
        })
      });
      const data = await res.json();
      return data.id;
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const executeWorkflow = async () => {
    try {
      let wfId = await saveWorkflow();
      if (!wfId) return;

      setActivityLogs(prev => [...prev, '🚀 بدء تنفيذ مسار العمل باستخدام محرك DAG...']);
      
      const res = await fetch('/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: wfId,
          context: { idea }
        })
      });
      const data = await res.json();
      if (data.executionId) {
        setActivityLogs(prev => [...prev, `تم استلام معرّف التنفيذ: ${data.executionId} (Job ID: ${data.jobId})`]);
      }
    } catch (e) {
      console.error(e);
      setActivityLogs(prev => [...prev, '❌ فشل الاتصال بمحرك المهام.']);
    }
  };

  return (
    <div className="w-full h-[600px] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="dark"
        fitView
      >
        <Panel position="top-right" className="bg-zinc-900 border border-zinc-700 p-3 rounded-xl shadow-lg">
          <h3 className="text-zinc-100 font-bold mb-1 text-sm">محرر مسار العمل (DAG Editor)</h3>
          <p className="text-zinc-400 text-xs mb-3">اسحب لربط العقد وتحديد الاعتماديات بين وكلاء الذكاء الاصطناعي</p>
          
          <div className="flex gap-2">
            <button 
              onClick={saveWorkflow}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 text-xs font-bold transition-colors"
            >
              <Save size={14} /> حفظ
            </button>
            <button 
              onClick={executeWorkflow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded hover:bg-teal-500 text-xs font-bold transition-colors shadow-[0_0_15px_rgba(13,148,136,0.3)]"
            >
              <Play size={14} /> تنفيذ (Execute)
            </button>
          </div>
        </Panel>
        
        <Controls className="bg-zinc-800 border-zinc-700 fill-zinc-300" />
        <MiniMap nodeStrokeWidth={3} nodeColor="#4f46e5" maskColor="rgba(0,0,0,0.5)" />
        <Background color="#3f3f46" gap={16} />
      </ReactFlow>
    </div>
  );
}
