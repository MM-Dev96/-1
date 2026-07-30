import { WorkflowNode, WorkflowEdge } from '../types/index.ts';
import { callGeminiStream, callGeminiText } from '../services/agent.ts';

// In-memory cancellation set for a single-instance app.
export const cancelledJobs = new Set<string>();

export async function runDagWorkflow(
  jobId: string,
  projectId: string,
  idea: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  apiKeys: string[],
  io: any,
  updateDbState: (nodeId: string, status: string, result?: string) => Promise<void>
) {
  cancelledJobs.delete(jobId);
  io.emit('orchestrator_started', { jobId, projectId });
  
  // Build DAG
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodeMap = new Map<string, WorkflowNode>();
  
  nodes.forEach(n => {
    graph.set(n.id, []);
    inDegree.set(n.id, 0);
    nodeMap.set(n.id, n);
  });
  
  edges.forEach(e => {
    if (graph.has(e.source) && inDegree.has(e.target)) {
      graph.get(e.source)!.push(e.target);
      inDegree.set(e.target, inDegree.get(e.target)! + 1);
    }
  });

  const nodeOutputs = new Map<string, string>();
  
  // Pre-fill outputs for already completed nodes (if resuming)
  nodes.forEach(n => {
    if (n.status === 'COMPLETED' && n.result) {
      nodeOutputs.set(n.id, n.result);
      // Simulate completion by decrementing dependencies
      graph.get(n.id)?.forEach(target => {
         inDegree.set(target, inDegree.get(target)! - 1);
      });
    }
  });

  const queue: string[] = [];
  nodes.forEach(n => {
    if (inDegree.get(n.id) === 0 && n.status !== 'COMPLETED') {
      queue.push(n.id);
    }
  });

  let hasFailed = false;
  let activePromises: Promise<void>[] = [];
  
  const processNode = async (nodeId: string) => {
    if (cancelledJobs.has(jobId)) return;
    
    const node = nodeMap.get(nodeId)!;
    node.status = 'RUNNING';
    io.emit('stage_started', { jobId, nodeId, label: node.label });
    await updateDbState(nodeId, 'RUNNING');
    
    try {
      // Gather context from dependencies
      let contextStr = '';
      edges.filter(e => e.target === nodeId).forEach(e => {
        const sourceNode = nodeMap.get(e.source);
        if (sourceNode && nodeOutputs.has(e.source)) {
          contextStr += `\n--- [Output from ${sourceNode.label}] ---\n${nodeOutputs.get(e.source)}\n`;
        }
      });
      
      const prompt = `You are a professional AI Agent acting as a "${node.label}".
Your task is: ${node.desc}
The output artifact MUST be named: ${node.artifact}

The project idea is:
"${idea}"

Relevant Context (outputs from previous stages):
${contextStr}

Please generate the content for the artifact "${node.artifact}". Respond ONLY with the content of the artifact. Do NOT wrap it in markdown code blocks unless the artifact itself is a markdown file. Focus only on the goals of your stage.`;

      const stageJobId = `stage_${jobId}_${nodeId}`;
      let resultText = '';
      
      const responseStream = await callGeminiStream(apiKeys, prompt, `execute stage ${node.label}`, stageJobId, io);
      for await (const chunk of responseStream) {
        if (cancelledJobs.has(jobId)) {
          throw new Error('Cancelled by user');
        }
        if (chunk.text) {
          resultText += chunk.text;
          io.emit('stage_chunk', { jobId, nodeId, text: chunk.text });
        }
      }
      
      node.status = 'COMPLETED';
      node.result = resultText;
      nodeOutputs.set(nodeId, resultText);
      
      io.emit('stage_completed', { jobId, nodeId, label: node.label });
      await updateDbState(nodeId, 'COMPLETED', resultText);
      
      // Unlock next nodes
      graph.get(nodeId)?.forEach(target => {
        inDegree.set(target, inDegree.get(target)! - 1);
        if (inDegree.get(target) === 0) {
          const nextNode = nodeMap.get(target)!;
          if (nextNode.status !== 'COMPLETED') {
            queue.push(target);
          }
        }
      });
      
    } catch (e: any) {
      if (e.message === 'Cancelled by user') {
         node.status = 'CANCELED';
         io.emit('stage_cancelled', { jobId, nodeId, label: node.label });
         await updateDbState(nodeId, 'CANCELED');
      } else {
         node.status = 'FAILED';
         node.error = e.message;
         hasFailed = true;
         io.emit('stage_failed', { jobId, nodeId, label: node.label, error: e.message });
         await updateDbState(nodeId, 'FAILED');
      }
    }
  };

  while ((queue.length > 0 || activePromises.length > 0) && !hasFailed && !cancelledJobs.has(jobId)) {
    while (queue.length > 0 && activePromises.length < 3 && !hasFailed && !cancelledJobs.has(jobId)) {
      const nodeId = queue.shift()!;
      const promise = processNode(nodeId).finally(() => {
        activePromises = activePromises.filter(p => p !== promise);
      });
      activePromises.push(promise);
    }
    // Wait for at least one promise to resolve if we reached concurrency limit or queue is empty but things are running
    if (activePromises.length > 0) {
      await Promise.race(activePromises);
    }
  }
  
  if (cancelledJobs.has(jobId)) {
    io.emit('orchestrator_cancelled', { jobId });
    return { status: 'CANCELED', finalPrompt: null, outputs: nodeOutputs };
  }
  
  if (hasFailed) {
    io.emit('orchestrator_failed', { jobId, error: 'One or more stages failed.' });
    return { status: 'FAILED', finalPrompt: null, outputs: nodeOutputs };
  }
  
  // All stages completed. Generate Final Prompt
  io.emit('final_prompt_started', { jobId });
  
  try {
    let combinedContext = '';
    nodes.forEach(n => {
      combinedContext += `\n\n====================\nStage: ${n.label} (Artifact: ${n.artifact})\n====================\n${nodeOutputs.get(n.id) || ''}`;
    });
    
    const finalPromptInstruction = `You are the AI Orchestrator and Master Prompt Engineer.
A user has provided a basic idea for a software project:
"${idea}"

The project has been processed by a team of AI experts, producing the following artifacts:
${combinedContext}

Your task is to synthesize all these artifacts into a single, cohesive, and comprehensive Prompt (or specification document) that can be passed to an AI coding agent to generate the actual application code.
Ensure the final prompt includes the Architecture, DB Schema, UI/UX requirements, and all critical logic constraints derived from the experts' work. 
Do not include conversational filler. Just output the final prompt directly.`;

    let finalPromptText = '';
    const finalJobId = `final_${jobId}`;
    const responseStream = await callGeminiStream(apiKeys, finalPromptInstruction, 'generate final prompt', finalJobId, io);
    for await (const chunk of responseStream) {
      if (cancelledJobs.has(jobId)) {
        throw new Error('Cancelled by user');
      }
      if (chunk.text) {
        finalPromptText += chunk.text;
        io.emit('final_prompt_chunk', { jobId, text: chunk.text });
      }
    }
    
    io.emit('final_prompt_completed', { jobId, text: finalPromptText });
    io.emit('orchestrator_completed', { jobId });
    
    return { status: 'COMPLETED', finalPrompt: finalPromptText, outputs: nodeOutputs };
  } catch (e: any) {
    if (e.message === 'Cancelled by user') {
      io.emit('orchestrator_cancelled', { jobId });
      return { status: 'CANCELED', finalPrompt: null, outputs: nodeOutputs };
    }
    io.emit('orchestrator_failed', { jobId, error: 'Failed to generate final prompt: ' + e.message });
    return { status: 'FAILED', finalPrompt: null, outputs: nodeOutputs };
  }
}
