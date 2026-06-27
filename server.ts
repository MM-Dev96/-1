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
import { workflowDefinitions, executionLogs, projects } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

dotenv.config();

const MODELS_TO_TRY = ['gemini-3.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];

async function executeGeminiCall<T>(ai: GoogleGenAI, prompt: string, taskName: string, callFn: (modelName: string) => Promise<T>): Promise<T> {
  let lastError: any = null;
  for (let i = 0; i < MODELS_TO_TRY.length; i++) {
    const modelName = MODELS_TO_TRY[i];
    let attempts = 5;
    let delay = 1000;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        console.log(`Attempting ${taskName} with model: ${modelName} (Attempt ${attempt}/${attempts})...`);
        const response = await callFn(modelName);
        console.log(`Success ${taskName} with model: ${modelName}`);
        return response;
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message || '';
        const errorStr = typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error);
        const is429 = error.status === 429 || error.code === 429 || errorMsg.includes('429') || errorMsg.includes('Quota') || errorStr.includes('429');
        const is503 = error.status === 503 || error.code === 503 || error.status === 'UNAVAILABLE' || errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('high demand') || errorStr.includes('503') || errorStr.includes('UNAVAILABLE');

        console.log(`Model ${modelName} attempt ${attempt} did not succeed (429: ${is429}, 503: ${is503}).`);
        let isTransient = error.status === 503 || error.code === 503 || error.status === 'UNAVAILABLE' ||
                           errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('high demand') ||
                           errorStr.includes('503') || errorStr.includes('UNAVAILABLE') || errorStr.includes('high demand') ||
                           error.status === 429 || error.code === 429 || errorMsg.includes('429') || errorStr.includes('429') || errorMsg.includes('Quota');

        if (errorMsg.includes('GenerateRequestsPerDay') || errorStr.includes('GenerateRequestsPerDay')) {
          isTransient = false;
        }

        if (isTransient && attempt < attempts) {
          let waitTime = delay;
          
          let parsedError = null;
          try {
            if (typeof errorMsg === 'string' && errorMsg.startsWith('{')) {
              parsedError = JSON.parse(errorMsg).error;
            } else if (error.error) {
              parsedError = error.error;
            }
          } catch (e) {}

          const details = parsedError?.details || error.details;
          const innerMsg = parsedError?.message || errorMsg;
          
          const is429 = error.status === 429 || error.code === 429 || innerMsg.includes('429') || innerMsg.includes('Quota') || errorStr.includes('429');
          const is503 = error.status === 503 || error.code === 503 || error.status === 'UNAVAILABLE' || innerMsg.includes('503') || innerMsg.includes('UNAVAILABLE') || innerMsg.includes('high demand') || errorStr.includes('503') || errorStr.includes('UNAVAILABLE');

          if (is429) {
             console.log(`Model ${modelName} hit quota limit. Skipping to next model.`);
             break;
          } else if (is503) {
            console.log(`Model ${modelName} is 503 unavailable. Skipping to next model.`);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          delay *= 1.5;
        } else {
          break;
        }
      }
    }
    if (i < MODELS_TO_TRY.length - 1) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw lastError || new Error(`All models failed for task: ${taskName}`);
}

async function* callGeminiStream(ai: GoogleGenAI, prompt: string, taskName: string): AsyncGenerator<{text: string}, void, unknown> {
  const response = await executeGeminiCall(ai, prompt, taskName, async (modelName) => {
    return await ai.models.generateContent({ model: modelName, contents: prompt });
  });
  
  if (response && response.text) {
    const fullText = response.text;
    const chunkSize = 40;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      yield { text: fullText.slice(i, i + chunkSize) };
      await new Promise(r => setTimeout(r, 10));
    }
  }
}

async function callGeminiText(ai: GoogleGenAI, prompt: string, taskName: string) {
  return executeGeminiCall(ai, prompt, taskName, async (modelName) => {
    const response = await ai.models.generateContent({ model: modelName, contents: prompt });
    return response.text || '';
  });
}

let cachedAppCode: string | null = null;

async function initializeAppCodeCache() {
  try {
    const appTsx = await fs.promises.readFile(path.join(process.cwd(), 'src', 'App.tsx'), 'utf-8');
    const serverTs = await fs.promises.readFile(path.join(process.cwd(), 'server.ts'), 'utf-8');
    cachedAppCode = `=== src/App.tsx ===\n${appTsx}\n\n=== server.ts ===\n${serverTs}`;
    console.log('App code cached successfully.');
  } catch (e) {
    console.error('Failed to read and cache source files', e);
    cachedAppCode = "تعذر قراءة الكود المصدري.";
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
  
  const PORT = 3000;
  
  await initializeAppCodeCache();
  
  startQueue().catch(e => console.error("Failed to start pg-boss queue", e));

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

  // Set up in-memory queue system (since real Redis is not available in this environment)
  type Job = { jobId: string, task: () => Promise<void> };
  const jobQueue: Job[] = [];
  let isProcessingQueue = false;

  const processQueue = async () => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;
    while (jobQueue.length > 0) {
      const job = jobQueue.shift();
      if (job) {
        try {
          await job.task();
        } catch (e) {
          console.error(`Job ${job.jobId} failed:`, e);
        }
      }
    }
    isProcessingQueue = false;
  };

  const enqueueJob = (jobId: string, task: () => Promise<void>) => {
    jobQueue.push({ jobId, task });
    setTimeout(processQueue, 200);
  };

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

  app.post('/api/execute-stage', async (req, res) => {
    try {
      const { idea, stage, jobId: clientJobId } = req.body;
      if (!idea || !stage) {
        return res.status(400).json({ error: 'Idea and stage are required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const jobId = clientJobId || `stage_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      enqueueJob(jobId, async () => {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `You are a professional AI Agent acting as a "${stage.title}".
Your task is: ${stage.desc}
The output artifact MUST be named: ${stage.artifact}

The project idea is:
"${idea}"

Please generate the content for the artifact "${stage.artifact}". 
Respond ONLY with the content of the artifact. Do NOT wrap it in markdown code blocks unless the artifact itself is a markdown file, in which case use standard markdown formatting. Keep it concise but professional.`;

          const responseStream = await callGeminiStream(ai, prompt, `execute stage ${stage.title}`);
          
          for await (const chunk of responseStream) {
            if (chunk.text) {
              io.emit('job_chunk', { jobId, text: chunk.text });
            }
          }
          io.emit('job_complete', { jobId });
        } catch (error: any) {
          console.error('Execute stage error in background job:', error);
          io.emit('job_error', { jobId, error: error.message || 'Failed to execute stage' });
          throw error;
        }
      });

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

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const jobId = clientJobId || `prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      enqueueJob(jobId, async () => {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              }
            }
          });

          const dynamicExperts = workflowStages 
            ? workflowStages.map((stage: any, index: number) => `${index + 1}. **${stage.title}:** [مُلْزِم] المهمة: ${stage.desc}، مخرجه الإلزامي هو ${stage.artifact}`).join('\n')
            : `1. **مدير المنتج (Product Manager):** [مُلْزِم] مخرجه وثيقة PRD.md
2. **المهندس المعماري:** [مُلْزِم] ArchitectureDecisionRecord.md
3. **منسق الذكاء الاصطناعي (AI Orchestrator):** يجمع المخرجات لإنشاء Pipeline ومخرجه الإلزامي هو مخطط الاعتماديات pipeline_dag.json.`;

          const prompt = `You are an AI Orchestrator and Master Prompt Engineer.
A user has provided a basic idea for a software project:
"${idea}"

Your task is to take this idea and generate an extremely detailed, strict, and comprehensive prompt that acts as a Software Engineering RFC & Workflow Pipeline to build a complete enterprise-grade application.

The output MUST be the generated prompt itself, ready to be copied and pasted to another AI. Do not include conversational filler. Just output the prompt directly.
IMPORTANT: THE GENERATED PROMPT MUST BE WRITTEN ENTIRELY IN ARABIC.

The generated prompt MUST incorporate the following constraints and structure exactly:

**1. مواصفات الأداء والقياس الصارمة وميزانية الأداء (Measurable SLAs & Performance Budget):**
- **منهجية القياس (Benchmark Methodology):** [مُلْزِم] قياس الأداء على بيئة تمثل الحد الأدنى (2 vCPU, 2GB RAM) باستخدام k6 أو Autocannon. يجب إجراء اختبارات حمل متقدمة.
- **زمن الاستجابة (P95 Latency):** [مُلْزِم] أقل من 100ms للطلبات العادية.

**2. مصفوفة الأولويات وحسم التعارضات (Engineering Priority Matrix):**
1. الأمان والخصوصية وحماية البيانات (Security & Privacy).
2. الاستقرار والأداء.

**3. الخبراء المشاركون والملفات والمخرجات الإلزامية لكل خبير (Participating Software Experts):**
يجب أن يتم تسليم المخرجات التالية من قبل الخبراء المعنيين بناءً على سير العمل الديناميكي المحدد:
${dynamicExperts}

**4. قيود التقنيات الصارمة (Technology Constraints):**
Enforce these exact technologies:
- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS, Shadcn UI, Motion One
- Backend: Node.js, NestJS, Prisma, PostgreSQL, Redis
- Authentication: Better Auth
- Deployment: Docker, Vercel, GitHub Actions

اكتب الموجه المولد باللغة العربية بأسلوب هندسي دقيق، صلب، وعالي التركيز ليكون بمثابة عقد ملزم (Executable Spec Contract) لا يترك أي فرصة للتأويل.`;

          const responseStream = await callGeminiStream(ai, prompt, 'prompt generation');

          for await (const chunk of responseStream) {
            if (chunk.text) {
              io.emit('job_chunk', { jobId, text: chunk.text });
            }
          }
          io.emit('job_complete', { jobId });
        } catch (error: any) {
          console.error('Error generating prompt in background job:', error);
          io.emit('job_error', { jobId, error: error.message || 'Failed to generate prompt' });
          throw error;
        }
      });

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

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const ai = new GoogleGenAI({ apiKey });
      
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

      let responseText = await callGeminiText(ai, prompt, 'mockup generation');
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

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const jobId = clientJobId || `eval_prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      enqueueJob(jobId, async () => {
        try {
          const ai = new GoogleGenAI({ apiKey });
          
          const prompt = `أنت الآن "كبير المهندسين المعماريين" (Principal Software Architect) ومستشار جودة برمجيات عالمي.
مهمتك مراجعة وتقييم "مسار العمل / البرومبت الهندسي" المرفق أدناه، والذي صُمم لبناء تطبيق مؤسسي.
أريدك أن تقيم هذا المسار بناءً على معايير الجودة العالمية (مثل الأمان، الأداء، التوسع، تجربة المستخدم، والموثوقية).
قدم تقريراً احترافياً، منسقاً بشكل رائع باستخدام Markdown، يحتوي على:
1. **التقييم العام:** درجة من 100 مع تحليل موجز.
2. **نقاط القوة:** ما المميز في هذا المسار.
3. **فرص التحسين (الترقيات):** اقتراحات فعلية لترقية المسار وجعله بمستوى FAANG ويستحق جوائز عالمية.
4. **مسار العمل المحسن:** أعد صياغة أجزاء من المسار لتكون أفضل وأكثر احترافية إذا لزم الأمر.

اكتب التقرير باللغة العربية، بأسلوب احترافي جداً ومقنع.

البرومبت الهندسي المراد تقييمه:
"""
${generatedPrompt}
"""`;

          const responseStream = await callGeminiStream(ai, prompt, 'prompt evaluation');

          for await (const chunk of responseStream) {
            if (chunk.text) {
              io.emit('job_chunk', { jobId, text: chunk.text });
            }
          }
          io.emit('job_complete', { jobId });
        } catch (error: any) {
          console.error('Error in evaluate-prompt background job:', error);
          io.emit('job_error', { jobId, error: error.message || 'Failed to generate evaluation' });
          throw error;
        }
      });

      res.json({ jobId });
    } catch (error: any) {
      console.error('Error initiating evaluation:', error);
      res.status(500).json({ error: error.message || 'Failed to initiate evaluation' });
    }
  });

  app.post('/api/evaluate-self', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      
      const clientJobId = req.body.jobId;

      let appCode = cachedAppCode || "تعذر قراءة الكود المصدري.";

      const jobId = clientJobId || `eval_self_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      enqueueJob(jobId, async () => {
        try {
          const ai = new GoogleGenAI({ apiKey });
          
          const prompt = `أنت الآن كبير مهندسي برمجيات (Principal Software Engineer) ومهندس معماري للنظم المؤسسية (Enterprise Systems Architect) خبير في بناء أنظمة سير العمل (Workflow Orchestration) ومنصات الـ SaaS المتقدمة.
قم بمراجعة الكود المصدري لهذا التطبيق (وهو حالياً نموذج مبدئي "Prototype" لمنسق سير عمل هندسي).
الهدف الأساسي هو **ترقية التطبيق من مجرد نموذج شكلي إلى نظام حقيقي متكامل ومتقدم (Feature Development & Architecture)**.

**مهم جداً: تجاهل تماماً الأمور البصرية (الألوان، التصميم، CSS، UI/UX السطحي). تركيزك يجب أن يكون بنسبة 100% على تطوير الميزات والهندسة البرمجية.**

أريد منك تقديم تقرير هندسي احترافي يقترح ميزات وحلولاً برمجية معمارية ترتقي بهذا التطبيق ليصبح منصة مؤسسية حقيقية.
لا تقم بمدح التطبيق أو كتابة مقدمات. ادخل في صلب الموضوع مباشرة وكن صارماً وعملياً.
قدم تقريراً هندسياً احترافياً باللغة العربية منسقاً بـ Markdown يحتوي على:

1. **تطوير ميزات جديدة قوية (Feature Engineering):** كيف نحول سير العمل الثابت (Hardcoded) إلى محرك سير عمل حقيقي قابل للتكوين (Dynamic DAG Engine)؟ (قدم خططاً وحلولاً برمجية).
2. **بنية النظام والواجهة الخلفية (System Architecture & Backend):** ما هي الميزات البرمجية، قواعد البيانات، أو الـ APIs التي يجب إضافتها ليدعم التطبيق العمل التعاوني، حفظ المشاريع، وإدارة مهام الذكاء الاصطناعي بشكل حقيقي متوازٍ؟
3. **تكامل الذكاء الاصطناعي الفعلي (Real AI Integration):** التطبيق حالياً يعتمد على محاكاة وفترات انتظار وهمية في مسار العمل. كيف نبني بنية تحتية لربط كل مرحلة (Stage) بوكيل ذكاء اصطناعي (AI Agent) حقيقي يقوم بتوليد المخرجات الخاصة بها بشكل مستقل؟
4. **جودة الكود المعمارية (Code Architecture & Performance):** ملاحظات معمارية حول كيفية تقسيم المكونات وإدارة الحالة المعقدة (State Management) والتعامل مع البيانات الديناميكية (مع الحلول المباشرة).

الكود المصدري للتطبيق:
\`\`\`
${appCode}
\`\`\``;

          const responseStream = await callGeminiStream(ai, prompt, 'self evaluation');

          for await (const chunk of responseStream) {
            if (chunk.text) {
              io.emit('job_chunk', { jobId, text: chunk.text });
            }
          }
          io.emit('job_complete', { jobId });
        } catch (error: any) {
          console.error('Error in evaluate-self background job:', error);
          io.emit('job_error', { jobId, error: error.message || 'Failed to generate app evaluation' });
          throw error;
        }
      });

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
