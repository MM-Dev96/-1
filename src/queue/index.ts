import { PgBoss } from 'pg-boss';
import * as dotenv from 'dotenv';
import { db } from '../db/index.ts';
import { executionLogs, artifacts } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

dotenv.config();

const connectionString = `postgres://${process.env.SQL_USER}:${process.env.SQL_PASSWORD}@${process.env.SQL_HOST}/${process.env.SQL_DB_NAME}`;

export const boss = new PgBoss(connectionString);

boss.on('error', error => console.error('pg-boss error:', error));

export async function startQueue() {
  await boss.start();

  await boss.work('workflow-execution', async (jobs) => {
    for (const job of jobs) {
      const { workflowId, executionId, nodes, edges, context } = job.data as any;
      
      try {
        await db.update(executionLogs).set({ status: 'running' }).where(eq(executionLogs.id, executionId));
        
        const llm = new ChatGoogleGenerativeAI({
          model: "gemini-2.5-flash",
          apiKey: process.env.GEMINI_API_KEY,
        });

        // Simple DAG simulation
        let currentContext = { ...context };
        let completedNodes = new Set<string>();
        
        // Topologically sort nodes based on edges
        const graph = new Map<string, string[]>();
        const inDegree = new Map<string, number>();
        
        nodes.forEach((n: any) => {
          graph.set(n.id, []);
          inDegree.set(n.id, 0);
        });
        
        edges.forEach((e: any) => {
          if (!graph.has(e.source)) graph.set(e.source, []);
          graph.get(e.source)!.push(e.target);
          inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
        });
        
        const queue: any[] = [];
        nodes.forEach((n: any) => {
          if (inDegree.get(n.id) === 0) queue.push(n);
        });
        
        let stepLogs = [];
        
        while (queue.length > 0) {
          const node = queue.shift();
          const taskType = node.data?.task_type || node.task_type || node.data?.label || 'General Task';
          const promptTemplate = node.data?.prompt_template || node.prompt_template || 'Analyze the context';
          const artifactSchema = node.data?.artifact_schema || node.artifact_schema || 'Markdown text';
          
          // Producer Agent
          const producerPrompt = `You are the Producer Agent.
Role: ${taskType}
Goal: ${promptTemplate}
Output Schema: ${artifactSchema}

Context:
${JSON.stringify(currentContext)}

Please generate your output:`;
          
          let response = await llm.invoke(producerPrompt);
          let resultText = response.content as string;
          
          // Critic Agent (Self-Correction Loop)
          const criticPrompt = `You are the Reviewer Agent for ${taskType}.
Analyze this output against the goal: "${promptTemplate}" and schema "${artifactSchema}".
If it fails to meet the goals, provide feedback and a corrected version. If it is good, reply strictly with "APPROVED: " followed by the original text.

Output to review:
${resultText}`;

          const reviewResponse = await llm.invoke(criticPrompt);
          const reviewText = reviewResponse.content as string;
          
          if (!reviewText.startsWith("APPROVED:")) {
             // Second attempt by Producer
             const fixPrompt = `Your previous output was rejected. 
Critic Feedback: 
${reviewText}

Please rewrite the output to fix these issues.`;
             const fixedResponse = await llm.invoke(fixPrompt);
             resultText = fixedResponse.content as string;
             stepLogs.push({ nodeId: node.id, action: 'self_correction_applied' });
          } else {
             resultText = reviewText.replace("APPROVED: ", "");
          }
          
          currentContext[node.id] = resultText;
          stepLogs.push({ nodeId: node.id, result: 'Completed successfully' });
          
          // Insert artifact
          await db.insert(artifacts).values({
            executionId,
            content: `### ${taskType}\n\n${resultText}`
          });
          
          graph.get(node.id)?.forEach((neighbor: string) => {
            inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
            if (inDegree.get(neighbor) === 0) {
              queue.push(nodes.find((n: any) => n.id === neighbor));
            }
          });
        }

        await db.update(executionLogs).set({ 
          status: 'completed',
          logData: stepLogs
        }).where(eq(executionLogs.id, executionId));
        
      } catch (e: any) {
        console.error('Job error', e);
        await db.update(executionLogs).set({ 
          status: 'failed',
          logData: { error: e.message }
        }).where(eq(executionLogs.id, executionId));
      }
    }
  });
}
