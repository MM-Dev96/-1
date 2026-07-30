import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  Connection,
  Edge,
  Node,
  Panel,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Save } from 'lucide-react';
import { useAppStore } from '../store.ts';

export default function WorkflowEditor() {
  const storeNodes = useAppStore(state => state.nodes);
  const storeEdges = useAppStore(state => state.edges);
  const setMainMode = useAppStore(state => state.setMainMode);

  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);

  useEffect(() => {
    setRfNodes(storeNodes.map((n, i) => ({
      id: n.id,
      position: { x: (i % 4) * 250, y: Math.floor(i / 4) * 150 },
      data: { label: n.label, desc: n.desc, artifact: n.artifact },
      type: i === 0 ? 'input' : (i === storeNodes.length - 1 ? 'output' : 'default')
    })));
    setRfEdges(storeEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: true
    })));
  }, [storeNodes, storeEdges]);

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback(
    (params: Connection | Edge) => setRfEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    []
  );

  const saveWorkflowToStore = () => {
    setMainMode('orchestrator');
  };

  const executeWorkflow = () => {
    setMainMode('orchestrator');
  };

  return (
    <div className="w-full h-[600px] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden relative">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        colorMode="dark"
        fitView
      >
        <Panel position="top-right" className="bg-zinc-900 border border-zinc-700 p-3 rounded-xl shadow-lg">
          <h3 className="text-zinc-100 font-bold mb-1 text-sm">محرر مسار العمل (DAG)</h3>
          <p className="text-zinc-400 text-xs mb-3">العرض المبدئي للعقد</p>
          
          <div className="flex gap-2">
            <button 
              onClick={saveWorkflowToStore}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 text-xs font-bold transition-colors"
            >
              <Save size={14} /> حفظ ورجوع
            </button>
            <button 
              onClick={executeWorkflow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded hover:bg-teal-500 text-xs font-bold transition-colors shadow-[0_0_15px_rgba(13,148,136,0.3)]"
            >
              <Play size={14} /> بدء التنفيذ
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