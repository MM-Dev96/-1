import { db } from '../db/index.ts';
import { projects } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { boss } from './index.ts';
import { callGeminiStream, callGeminiText } from '../services/agent.ts';
import { runDagWorkflow } from './dagRunner.ts';

export function registerWorkers(io: any) {
  // Main orchestrator job (replaces linear workflow with DAG)
  boss.work('workflow-orchestrator-job', async (jobs: any[]) => {
    for (const job of jobs) {
      const { jobId, projectId, idea, nodes, edges, apiKeys } = job.data;
      try {
        const updateDbState = async (nodeId: string, status: string, result?: string) => {
          // If we want to persist stage results to DB we can do it here, or use project's JSON field.
          // For now, we will handle this via the frontend receiving socket events, 
          // or we can update the project in DB.
          try {
            const pId = parseInt(projectId);
            if (projectId && !isNaN(pId) && pId <= 2147483647) {
               // Optional: you can update the project's 'status' column if needed.
               if (status === 'RUNNING') {
                  await db.update(projects).set({ status: 'RUNNING' }).where(eq(projects.id, pId));
               }
            }
          } catch (e) {
             console.error('Failed to update DB state', e);
          }
        };

        const result = await runDagWorkflow(jobId, projectId, idea, nodes, edges, apiKeys, io, updateDbState);
        
        if (result.status === 'COMPLETED' && result.finalPrompt) {
          try {
            const pId = parseInt(projectId);
            if (projectId && !isNaN(pId) && pId <= 2147483647) {
               await db.update(projects).set({ 
                 status: 'COMPLETED',
                 finalPrompt: result.finalPrompt 
               }).where(eq(projects.id, pId));
            }
          } catch (e) {
            console.error('Failed to save final prompt to DB', e);
          }
        } else if (result.status === 'FAILED') {
          try {
            const pId = parseInt(projectId);
            if (projectId && !isNaN(pId) && pId <= 2147483647) {
               await db.update(projects).set({ status: 'FAILED' }).where(eq(projects.id, pId));
            }
          } catch (e) {}
        }
      } catch (error: unknown) {
        console.error('Orchestrator error:', error);
        io.emit('orchestrator_failed', { jobId, error: (error as Error).message });
      }
    }
  });

  // Keep other workers if needed, but the main orchestration is handled above.
}
