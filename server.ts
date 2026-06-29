import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { startQueue, boss } from './src/queue/index.ts';
import { db } from './src/db/index.ts';
import { workflowDefinitions, executionLogs, projects, proposedChanges } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { buildSelfEvaluationPrompt } from './src/utils/promptBuilder.ts';

dotenv.config();

const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

function getApiKeys(req: express.Request): string[] {
  const headerKeys = req.headers['x-gemini-keys'] as string;
  if (headerKeys) {
    return headerKeys.split(',').map(k => k.trim()).filter(Boolean);
  }
  const envKeys = process.env.GEMINI_API_KEYS;
  if (envKeys) {
    return envKeys.split(',').map(k => k.trim()).filter(Boolean);
  }
  if (process.env.GEMINI_API_KEY) {
    return [process.env.GEMINI_API_KEY];
  }
  return [];
}

import { callGeminiStream, callGeminiText } from './src/services/agent.ts';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
  
  const PORT = 3000;
  
  try {
    await startQueue(io);
    console.log("pg-boss started successfully");
  } catch (e) {
    console.error("Failed to start pg-boss queue", e);
  }

  app.use(express.json());

  // --- CRUD for Projects ---
  app.get('/api/projects', async (req, res) => {
    try {
      const allProjects = await db.query.projects.findMany();
      res.json(allProjects);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const { name, description, userId } = req.body;
      const newProject = await db.insert(projects).values({
        name,
        description,
        userId: userId || 1 // fallback for now
      }).returning();
      res.json(newProject[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- CRUD for Workflows ---
  app.get('/api/workflows', async (req, res) => {
    try {
      const allWorkflows = await db.query.workflowDefinitions.findMany();
      res.json(allWorkflows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/workflows', async (req, res) => {
    try {
      const { projectId, name, nodes, edges } = req.body;
      const newWf = await db.insert(workflowDefinitions).values({
        projectId: projectId || 1, // Fallback
        name,
        nodes,
        edges
      }).returning();
      res.json(newWf[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/workflows/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { nodes, edges } = req.body;
      const updated = await db.update(workflowDefinitions).set({
        nodes,
        edges
      }).where(eq(workflowDefinitions.id, parseInt(id))).returning();
      res.json(updated[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/workflows/default', async (req, res) => {
    try {
      let wf = await db.query.workflowDefinitions.findFirst({
        where: (w, { eq }) => eq(w.name, 'Default Stages')
      });

      if (!wf) {
        // Fallback or seed
        const defaultNodes = [
          { title: "Product Manager", desc: "تحليل المتطلبات وتحديد MVP", artifact: "PRD.md" },
          { title: "Business Analyst", desc: "تحليل السوق والمنافسين", artifact: "Market.md" },
          { title: "UX Researcher", desc: "رسم رحلة المستخدم", artifact: "UserFlow.md" },
          { title: "Product Designer", desc: "تصميم واجهة المستخدم", artifact: "Wireframes.fig" },
          { title: "Design System Eng", desc: "بناء النظام البصري", artifact: "Tokens.json" },
          { title: "System Architect", desc: "هيكلة النظام الشاملة", artifact: "Architecture.md" },
          { title: "Database Architect", desc: "تصميم قواعد البيانات", artifact: "Schema.sql" },
          { title: "API Architect", desc: "تصميم الواجهات البرمجية", artifact: "OpenAPI.yaml" },
          { title: "Security Engineer", desc: "نموذج الحماية والأمان", artifact: "Security.md" },
          { title: "UX Validation", desc: "اعتماد تجربة المستخدم", artifact: "UX_Audit.md" },
          { title: "AI Architect", desc: "تكامل الذكاء الاصطناعي", artifact: "AI_Config.json" },
          { title: "Frontend Lead", desc: "واجهات المستخدم", artifact: "Frontend_Architecture.md" },
          { title: "Backend Lead", desc: "الخوادم والمنطق", artifact: "Backend_Architecture.md" },
          { title: "Testing Architect", desc: "ضمان الجودة والاختبار", artifact: "Testing_Strategy.md" },
          { title: "DevOps Engineer", desc: "الاستضافة والحاويات", artifact: "Dockerfile" },
          { title: "Technical Writer", desc: "كتابة التوثيق", artifact: "Docs.md" },
          { title: "Legal & Privacy", desc: "الامتثال للخصوصية", artifact: "Privacy.md" },
          { title: "Release Manager", desc: "خطة الإطلاق", artifact: "Release.yml" },
          { title: "Principal Engineer", desc: "التدقيق النهائي", artifact: "FinalAudit.md" },
          { title: "AI Orchestrator", desc: "تجميع البرومبت", artifact: "Pipeline.yml" }
        ];
        
        let projectId = 1;
        // ensure project exists or use dummy project
        const project = await db.query.projects.findFirst();
        if (project) {
          projectId = project.id as number;
        } else {
           // wait, we can't seed it if no project and no user exists. Let's just return the default array directly.
           return res.json({ nodes: defaultNodes });
        }

        const newWf = await db.insert(workflowDefinitions).values({
          projectId: projectId,
          name: 'Default Stages',
          nodes: defaultNodes,
          edges: []
        }).returning();
        wf = newWf[0];
      }

      res.json(wf);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });



  app.post('/api/workflows/run', async (req, res) => {
    try {
      const { workflowId, context } = req.body;
      
      const wf = await db.query.workflowDefinitions.findFirst({
        where: (w, { eq }) => eq(w.id, workflowId)
      });
      
      if (!wf) return res.status(404).json({ error: 'Workflow not found' });
      
      const execution = await db.insert(executionLogs).values({
        workflowId: wf.id,
        status: 'pending'
      }).returning();
      
      const jobId = await boss.send('workflow-execution', {
        workflowId: wf.id,
        executionId: execution[0].id,
        nodes: wf.nodes,
        edges: wf.edges,
        context
      });
      
      res.json({ executionId: execution[0].id, jobId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/start-orchestration', async (req, res) => {
    try {
      const { projectId, idea, workflowStages, startingStage } = req.body;
      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error('No API keys configured');
      }

      const jobId = `orchestrator_${Date.now()}`;
      await boss.send('workflow-orchestrator-job', { jobId, projectId, idea, workflowStages, startingStage, apiKeys });
      res.json({ jobId });
    } catch (error: any) {
      console.error('Start orchestration error:', error);
      res.status(500).json({ error: error.message || 'Failed to start orchestration' });
    }
  });

  app.post('/api/agent/propose-change', async (req, res) => {
    try {
      const { projectId, filePath, newContent, diffPatch, agentId, stageId } = req.body;
      const change = await db.insert(proposedChanges).values({
        projectId: projectId || 1, // Fallback if no project
        filePath,
        newContent,
        diffPatch,
        status: 'pending',
        agentId,
        stageId,
        createdAt: new Date()
      }).returning();
      
      io.emit('new_proposed_change', { projectId, change: change[0] });
      res.json(change[0]);
    } catch (error: any) {
      console.error('Propose change error:', error);
      res.status(500).json({ error: error.message || 'Failed to propose change' });
    }
  });

  app.post('/api/execute-stage', async (req, res) => {
    try {
      const { idea, stage, jobId: clientJobId } = req.body;
      if (!idea || !stage) {
        return res.status(400).json({ error: 'Idea and stage are required' });
      }

      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error('No API keys configured');
      }

      const jobId = clientJobId || `stage_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      await boss.send('execute-stage-job', { jobId, idea, stage, apiKeys });

      res.json({ jobId });
    } catch (error: any) {
      console.error('Execute stage error:', error);
      res.status(500).json({ error: error.message || 'Failed to execute stage' });
    }
  });

  app.post('/api/generate-prompt', async (req, res) => {
    try {
      const { idea, workflowStages, jobId: clientJobId } = req.body;
      if (!idea) {
        return res.status(400).json({ error: 'Idea is required' });
      }

      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error('No API keys configured');
      }

      const jobId = clientJobId || `prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await boss.send('generate-prompt-job', { jobId, idea, workflowStages, apiKeys });

      res.json({ jobId });
    } catch (error: any) {
      console.error('Error initiating prompt generation:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate prompt generation' });
    }
  });

  app.post('/api/generate-mockup', async (req, res) => {
    try {
      const { idea } = req.body;
      if (!idea) {
        return res.status(400).json({ error: 'Idea is required' });
      }

      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error('No API keys configured');
      }

      const prompt = `You are an expert Full-Stack Developer and UI/UX Designer.
Create a fully functional, interactive, and highly polished Application Prototype for the following app idea:
"${idea}"

REQUIREMENTS:
- Return a SINGLE valid HTML file containing the entire application.
- You MUST use React and Babel standalone to build a functional app.
- Include the following CDNs in the <head>:
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
- Write all your React code inside a <script type="text/babel" data-type="module"> or just <script type="text/babel"> tag.
- Create multiple React components (e.g., Header, Sidebar, Dashboard, Modals) and assemble them in a main <App /> component.
- Mount the app: ReactDOM.createRoot(document.getElementById('root')).render(<App />);
- Make it highly interactive! Use React state (useState), effects (useEffect) to make buttons work, navigate between views (conditional rendering), add/remove items, etc.
- Add realistic dummy data and simulate API calls or local storage if needed to make it feel like a real working app.
- Ensure the design is enterprise-grade, modern, and responsive using Tailwind CSS.
- Use Arabic language for the interface (dir="rtl").
- DO NOT include markdown formatting (\`\`\`html). Output strictly the raw HTML string starting with <!DOCTYPE html>.`;

      let responseText = await callGeminiText(apiKeys, prompt, 'mockup generation');
      responseText = responseText.replace(/^\s*```(html)?/mi, '').replace(/```\s*$/m, '').trim();

      if (!responseText) {
        throw new Error('Failed to generate mockup');
      }

      res.json({ html: responseText });
    } catch (error: any) {
      console.error('Error generating mockup:', error);
      res.status(500).json({ error: error.message || 'Failed to generate mockup' });
    }
  });

  app.post('/api/evaluate-prompt', async (req, res) => {
    try {
      const { generatedPrompt, jobId: clientJobId } = req.body;
      if (!generatedPrompt) {
        return res.status(400).json({ error: 'Generated prompt is required' });
      }

      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error('No API keys configured');
      }

      const jobId = clientJobId || `eval_prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await boss.send('evaluate-prompt-job', { jobId, generatedPrompt, apiKeys });

      res.json({ jobId });
    } catch (error: any) {
      console.error('Error initiating evaluation:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate evaluation' });
    }
  });

  app.get('/api/project/files', async (req, res) => {
    try {
      const getFiles = async (dir: string, fileList: { path: string, size: number }[] = []) => {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.promises.stat(filePath);
          if (stat.isDirectory()) {
            if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist') {
              await getFiles(filePath, fileList);
            }
          } else {
            if (/\.(ts|tsx|js|jsx|json|md|html|css)$/.test(file)) {
               const relativePath = path.relative(process.cwd(), filePath);
               fileList.push({ path: relativePath, size: stat.size });
            }
          }
        }
        return fileList;
      };
      
      const allFiles = await getFiles(process.cwd());
      res.json(allFiles);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/evaluate-self', async (req, res) => {
    try {
      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error('No API keys configured');
      }
      
      const clientJobId = req.body.jobId;
      const focusAreas = req.body.focusAreas || ['all'];
      const customNotes = req.body.customNotes || '';
      const depth = req.body.depth || 'deep';
      const filePaths = req.body.filePaths || ['src/App.tsx', 'server.ts'];

      let appCode = "";
      const maxTotalChars = 300000;
      let currentChars = 0;

      for (const fp of filePaths) {
         try {
           let content = await fs.promises.readFile(path.join(process.cwd(), fp), 'utf-8');
           currentChars += content.length;
           if (currentChars > maxTotalChars) {
             throw new Error(`لقد تجاوزت الملفات المختارة الحد الأقصى المسموح به (${maxTotalChars} حرف). يرجى تقليل عدد الملفات المختارة والمحاولة مرة أخرى.`);
           }
           appCode += `\n=== ${fp} ===\n${content}\n`;
         } catch (e: any) {
           if (e.message.includes('لقد تجاوزت الملفات')) {
             throw e; // re-throw the limit error
           }
           appCode += `\n=== ${fp} ===\n(تعذر قراءة الملف)\n`;
         }
      }

      const jobId = clientJobId || `eval_self_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      let focusInstructions = "";
      // Prompt logic moved to promptBuilder
      
      await boss.send('evaluate-self-job', { jobId, focusAreas, customNotes, depth, appCode, apiKeys });

      res.json({ jobId });
    } catch (error: any) {
      console.error('Error initiating app evaluation:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate app evaluation' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
