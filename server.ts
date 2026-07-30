import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import AdmZip from "adm-zip";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import { startQueue, boss } from "./src/queue/index.ts";
import { db } from "./src/db/index.ts";
import {
  workflowDefinitions,
  executionLogs,
  projects,
  proposedChanges,
} from "./src/db/schema.ts";
import { eq } from "drizzle-orm";
import { buildSelfEvaluationPrompt } from "./src/utils/promptBuilder.ts";

dotenv.config();

const MODELS_TO_TRY = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
];

function getApiKeys(req: express.Request): string[] {
  const headerKeys = req.headers["x-gemini-keys"] as string;
  if (headerKeys) {
    return headerKeys
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }
  const envKeys = process.env.GEMINI_API_KEYS;
  if (envKeys) {
    return envKeys
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }
  if (process.env.GEMINI_API_KEY) {
    return [process.env.GEMINI_API_KEY];
  }
  return [];
}

import { callGeminiStream, callGeminiText } from "./src/services/agent.ts";

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, { 
    cors: { origin: "*" },
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000
  });

  io.on('connection', (socket) => {
    console.info(`[Socket.io] Client connected: ${socket.id}`);
    
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', (reason) => {
      console.info(`[Socket.io] Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`[Socket.io] Socket error on ${socket.id}:`, err);
    });
  });

  io.engine.on("connection_error", (err) => {
    console.error("[Socket.io] Connection error:", err.req, err.code, err.message, err.context);
  });

  const PORT = 3000;

  try {
    await startQueue(io);
    console.log("pg-boss started successfully");
  } catch (e) {
    console.error("Failed to start pg-boss queue", e);
  }

  app.use(express.json());

  // --- CRUD for Projects ---
  app.get("/api/projects", async (req, res) => {
    try {
      const allProjects = await db.query.projects.findMany();
      res.json(allProjects);
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const { name, description, userId } = req.body;
      const newProject = await db
        .insert(projects)
        .values({
          name,
          description,
          userId: userId || 1, // fallback for now
        })
        .returning();
      res.json(newProject[0]);
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // --- CRUD for Workflows ---
  app.get("/api/workflows", async (req, res) => {
    try {
      const allWorkflows = await db.query.workflowDefinitions.findMany();
      res.json(allWorkflows);
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/workflows", async (req, res) => {
    try {
      const { projectId, name, nodes, edges } = req.body;
      const newWf = await db
        .insert(workflowDefinitions)
        .values({
          projectId: projectId || 1, // Fallback
          name,
          nodes,
          edges,
        })
        .returning();
      res.json(newWf[0]);
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.put("/api/workflows/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { nodes, edges } = req.body;
      const updated = await db
        .update(workflowDefinitions)
        .set({
          nodes,
          edges,
        })
        .where(eq(workflowDefinitions.id, parseInt(id)))
        .returning();
      res.json(updated[0]);
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/workflows/default", async (req, res) => {
    try {
      let wf = await db.query.workflowDefinitions.findFirst({
        where: (w, { eq }) => eq(w.name, "Default Stages"),
      });

      if (!wf) {
        // Fallback or seed
        const defaultNodes = [
          {
            title: "Product Manager",
            desc: "تحليل المتطلبات وتحديد MVP",
            artifact: "PRD.md",
          },
          {
            title: "Business Analyst",
            desc: "تحليل السوق والمنافسين",
            artifact: "Market.md",
          },
          {
            title: "UX Researcher",
            desc: "رسم رحلة المستخدم",
            artifact: "UserFlow.md",
          },
          {
            title: "Product Designer",
            desc: "تصميم واجهة المستخدم",
            artifact: "Wireframes.fig",
          },
          {
            title: "Design System Eng",
            desc: "بناء النظام البصري",
            artifact: "Tokens.json",
          },
          {
            title: "System Architect",
            desc: "هيكلة النظام الشاملة",
            artifact: "Architecture.md",
          },
          {
            title: "Database Architect",
            desc: "تصميم قواعد البيانات",
            artifact: "Schema.sql",
          },
          {
            title: "API Architect",
            desc: "تصميم الواجهات البرمجية",
            artifact: "OpenAPI.yaml",
          },
          {
            title: "Security Engineer",
            desc: "نموذج الحماية والأمان",
            artifact: "Security.md",
          },
          {
            title: "UX Validation",
            desc: "اعتماد تجربة المستخدم",
            artifact: "UX_Audit.md",
          },
          {
            title: "AI Architect",
            desc: "تكامل الذكاء الاصطناعي",
            artifact: "AI_Config.json",
          },
          {
            title: "Frontend Lead",
            desc: "واجهات المستخدم",
            artifact: "Frontend_Architecture.md",
          },
          {
            title: "Backend Lead",
            desc: "الخوادم والمنطق",
            artifact: "Backend_Architecture.md",
          },
          {
            title: "Testing Architect",
            desc: "ضمان الجودة والاختبار",
            artifact: "Testing_Strategy.md",
          },
          {
            title: "DevOps Engineer",
            desc: "الاستضافة والحاويات",
            artifact: "Dockerfile",
          },
          {
            title: "Technical Writer",
            desc: "كتابة التوثيق",
            artifact: "Docs.md",
          },
          {
            title: "Legal & Privacy",
            desc: "الامتثال للخصوصية",
            artifact: "Privacy.md",
          },
          {
            title: "Release Manager",
            desc: "خطة الإطلاق",
            artifact: "Release.yml",
          },
          {
            title: "Principal Engineer",
            desc: "التدقيق النهائي",
            artifact: "FinalAudit.md",
          },
          {
            title: "AI Orchestrator",
            desc: "تجميع البرومبت",
            artifact: "Pipeline.yml",
          },
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

        const newWf = await db
          .insert(workflowDefinitions)
          .values({
            projectId: projectId,
            name: "Default Stages",
            nodes: defaultNodes,
            edges: [],
          })
          .returning();
        wf = newWf[0];
      }

      res.json(wf);
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/workflows/run", async (req, res) => {
    try {
      const { workflowId, context } = req.body;

      const wf = await db.query.workflowDefinitions.findFirst({
        where: (w, { eq }) => eq(w.id, workflowId),
      });

      if (!wf) return res.status(404).json({ error: "Workflow not found" });

      const execution = await db
        .insert(executionLogs)
        .values({
          workflowId: wf.id,
          status: "pending",
        })
        .returning();

      const jobId = await boss.send("workflow-execution", {
        workflowId: wf.id,
        executionId: execution[0].id,
        nodes: wf.nodes,
        edges: wf.edges,
        context,
      });

      res.json({ executionId: execution[0].id, jobId });
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  const upload = multer({ dest: "uploads/" });

  app.post("/api/preview/upload", upload.array("files"), (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const paths = req.body.paths as string | string[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadId = Date.now().toString() + Math.floor(Math.random() * 1000);
      const targetDir = path.join(
        process.cwd(),
        "public",
        "previews",
        uploadId,
      );

      fs.mkdirSync(targetDir, { recursive: true });
      const publicDir = path.join(process.cwd(), "public");

      // Build file tree
      interface FileNode {
        name: string;
        type: "directory" | "file";
        path: string;
        children?: FileNode[];
      }
      
      const buildFileTree = (dir: string, baseDir: string): FileNode[] => {
        const items = fs.readdirSync(dir);
        const tree: FileNode[] = [];
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const isDirectory = fs.statSync(itemPath).isDirectory();
          const relativePath =
            "/" + path.relative(baseDir, itemPath).replace(/\\/g, "/");

          if (isDirectory) {
            tree.push({
              name: item,
              type: "directory",
              path: relativePath,
              children: buildFileTree(itemPath, baseDir),
            });
          } else {
            tree.push({
              name: item,
              type: "file",
              path: relativePath,
            });
          }
        }
        // sort directories first
        return tree.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === "directory" ? -1 : 1;
        });
      };

      // Check if it's a single zip file
      if (
        files.length === 1 &&
        (files[0].originalname.toLowerCase().endsWith(".zip") || files[0].originalname.toLowerCase().endsWith(".rar"))
      ) {
        if (files[0].originalname.toLowerCase().endsWith(".rar")) {
          fs.unlinkSync(files[0].path);
          return res.status(400).json({ error: "Unsupported compression format. Please use .zip" });
        }
        
        try {
          const zip = new AdmZip(files[0].path);
          zip.extractAllTo(targetDir, true);
          fs.unlinkSync(files[0].path); // cleanup uploaded zip

          // Find index.html. Sometimes zip contains a root folder. Let's try to find it.
          let previewUrl = `/previews/${uploadId}/index.html`;
          const extractedEntries = zip.getEntries();
          const htmlEntries = extractedEntries.filter((e) =>
            e.entryName.toLowerCase().endsWith("index.html"),
          );
          if (htmlEntries.length > 0) {
            // Find the shortest path (closest to root)
            htmlEntries.sort((a, b) => a.entryName.length - b.entryName.length);
            previewUrl = `/previews/${uploadId}/${htmlEntries[0].entryName}`;
          }

          const fileTree = buildFileTree(targetDir, publicDir);
          return res.json({ previewUrl, fileTree });
        } catch (zipError: unknown) {
          fs.unlinkSync(files[0].path);
          return res.status(400).json({ error: "Failed to extract zip file: " + (zipError as Error).message });
        }
      }

      // Check if it's a single html file
      if (
        files.length === 1 &&
        files[0].originalname.toLowerCase().endsWith(".html")
      ) {
        const destPath = path.join(targetDir, "index.html");
        fs.renameSync(files[0].path, destPath);
        return res.json({ previewUrl: `/previews/${uploadId}/index.html` });
      }

      // Folder upload logic (webkitdirectory)
      const pathsArray = Array.isArray(paths) ? paths : [paths];

      files.forEach((file, index) => {
        // Find the relative path from the upload
        const relPath = pathsArray[index];
        if (!relPath) {
          // fallback if path is not provided
          const fullDestPath = path.join(targetDir, file.originalname);
          fs.renameSync(file.path, fullDestPath);
          return;
        }

        // Strip the top-level directory name (e.g., "my-app/src/index.js" -> "src/index.js")
        const parts = relPath.split("/");
        // Only strip if there's an actual top-level directory. If it's just the file, we shouldn't strip.
        if (parts.length > 1) {
          parts.shift(); // remove the top-level directory
        }
        const finalPath = parts.join("/");

        if (!finalPath) {
          // if it's in the root of the folder, keep it
          const fullDestPath = path.join(targetDir, file.originalname);
          fs.renameSync(file.path, fullDestPath);
          return;
        }

        const fullDestPath = path.join(targetDir, finalPath);
        fs.mkdirSync(path.dirname(fullDestPath), { recursive: true });
        fs.renameSync(file.path, fullDestPath);
      });

      // Find index.html recursively in the targetDir
      const findIndexHtml = (dir: string, baseDir: string): string | null => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          if (fs.statSync(itemPath).isDirectory()) {
            const found = findIndexHtml(itemPath, baseDir);
            if (found) return found;
          } else if (item.toLowerCase() === "index.html") {
            return "/" + path.relative(baseDir, itemPath).replace(/\\/g, "/");
          }
        }
        return null;
      };

      const relativeHtmlPath =
        findIndexHtml(targetDir, publicDir) ||
        `/previews/${uploadId}/index.html`;

      const fileTree = buildFileTree(targetDir, publicDir);

      res.json({ previewUrl: relativeHtmlPath, fileTree });
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/jobs/:jobId/cancel", (req, res) => {
    const { jobId } = req.params;
    const { cancelledJobs } = require("./src/queue/dagRunner.ts");
    cancelledJobs.add(jobId);
    res.json({ success: true });
  });

  app.post("/api/start-orchestration", async (req, res) => {
    try {
      const { projectId, idea, nodes, edges } = req.body;
      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error("No API keys configured");
      }

      const jobId = `orchestrator_${Date.now()}`;
      io.emit("test_event", { message: "API hit!" });
      await boss.send("workflow-orchestrator-job", {
        nodes,
        edges,
        jobId,
        projectId,
        idea,
        
        
        apiKeys,
      });
      res.json({ jobId });
    } catch (error: unknown) {
      console.error("Start orchestration error:", error);
      res
        .status(500)
        .json({ error: (error as Error).message || "Failed to start orchestration" });
    }
  });

  app.post("/api/agent/propose-change", async (req, res) => {
    try {
      const { projectId, filePath, newContent, diffPatch, agentId, stageId } =
        req.body;
      const change = await db
        .insert(proposedChanges)
        .values({
          projectId: projectId || 1, // Fallback if no project
          filePath,
          newContent,
          diffPatch,
          status: "pending",
          agentId,
          stageId,
          createdAt: new Date(),
        })
        .returning();

      io.emit("new_proposed_change", { projectId, change: change[0] });
      res.json(change[0]);
    } catch (error: unknown) {
      console.error("Propose change error:", error);
      res
        .status(500)
        .json({ error: (error as Error).message || "Failed to propose change" });
    }
  });

  app.post("/api/execute-stage", async (req, res) => {
    try {
      const { idea, stage, jobId: clientJobId } = req.body;
      if (!idea || !stage) {
        return res.status(400).json({ error: "Idea and stage are required" });
      }

      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error("No API keys configured");
      }

      const jobId =
        clientJobId ||
        `stage_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await boss.send("execute-stage-job", { jobId, idea, stage, apiKeys });

      res.json({ jobId });
    } catch (error: unknown) {
      console.error("Execute stage error:", error);
      res
        .status(500)
        .json({ error: (error as Error).message || "Failed to execute stage" });
    }
  });

  app.post("/api/generate-prompt", async (req, res) => {
    try {
      const { idea, workflowStages, jobId: clientJobId } = req.body;
      if (!idea) {
        return res.status(400).json({ error: "Idea is required" });
      }

      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error("No API keys configured");
      }

      const jobId =
        clientJobId ||
        `prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await boss.send("generate-prompt-job", {
        jobId,
        idea,
        workflowStages,
        apiKeys,
      });

      res.json({ jobId });
    } catch (error: unknown) {
      console.error("Error initiating prompt generation:", error);
      res
        .status(500)
        .json({
          error: (error as Error).message || "Failed to initiate prompt generation",
        });
    }
  });

  app.post("/api/generate-mockup", async (req, res) => {
    try {
      const { idea, finalPrompt, stageArtifacts } = req.body;
      if (!idea) {
        return res.status(400).json({ error: "Idea is required" });
      }

      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error("No API keys configured");
      }

      const prompt = `You are an expert Full-Stack Developer and UI/UX Designer.
Create a fully functional, interactive, and highly polished Application Prototype for the following app idea:
"${idea}"

Use the following detailed architecture and specifications generated by the AI experts:

${finalPrompt || Object.values(stageArtifacts || {}).join("\n\n")}

REQUIREMENTS:
- Return a SINGLE valid HTML file containing the entire application.
- You MUST use React and Babel standalone to build a functional app.
- Include the following CDNs in the <head>:
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css" rel="stylesheet" />
- Write all your React code inside a <script type="text/babel"> tag.
- Use Remix Icons for icons by using the <i> tag (e.g., <i className="ri-home-line"></i>). DO NOT USE Lucide.
- Create multiple React components (e.g., Header, Sidebar, Dashboard, Modals) and assemble them in a main <App /> component.
- Mount the app: const root = ReactDOM.createRoot(document.getElementById('root')); root.render(<App />);
- Make it highly interactive! Use React state (useState), effects (useEffect) to make buttons work, navigate between views (conditional rendering), add/remove items, etc.
- Add realistic dummy data and simulate API calls or local storage if needed to make it feel like a real working app.
- Ensure the design is enterprise-grade, modern, and responsive using Tailwind CSS. Add elegant animations and transitions.
- Use Arabic language for the interface (dir="rtl") unless requested otherwise.
- DO NOT include markdown formatting (\`\`\`html). Output strictly the raw HTML string starting with <!DOCTYPE html>.`;

      let responseText = await callGeminiText(
        apiKeys,
        prompt,
        "mockup generation",
      );
      responseText = responseText
        .replace(/^\s*```(html)?/im, "")
        .replace(/```\s*$/m, "")
        .trim();

      if (!responseText) {
        throw new Error("Failed to generate mockup");
      }

      res.json({ html: responseText });
    } catch (error: unknown) {
      console.error("Error generating mockup:", error);
      res
        .status(500)
        .json({ error: (error as Error).message || "Failed to generate mockup" });
    }
  });

  app.post("/api/evaluate-prompt", async (req, res) => {
    try {
      const { generatedPrompt, jobId: clientJobId } = req.body;
      if (!generatedPrompt) {
        return res.status(400).json({ error: "Generated prompt is required" });
      }

      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error("No API keys configured");
      }

      const jobId =
        clientJobId ||
        `eval_prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      await boss.send("evaluate-prompt-job", {
        jobId,
        generatedPrompt,
        apiKeys,
      });

      res.json({ jobId });
    } catch (error: unknown) {
      console.error("Error initiating evaluation:", error);
      res
        .status(500)
        .json({ error: (error as Error).message || "Failed to initiate evaluation" });
    }
  });

  app.get("/api/project/files", async (req, res) => {
    try {
      const getFiles = async (
        dir: string,
        fileList: { path: string; size: number }[] = [],
      ) => {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = await fs.promises.stat(filePath);
          if (stat.isDirectory()) {
            if (
              !file.startsWith(".") &&
              file !== "node_modules" &&
              file !== "dist"
            ) {
              await getFiles(filePath, fileList);
            }
          } else {
            if (
              /\.(ts|tsx|js|jsx|json|md|html|css)$/.test(file) &&
              !file.endsWith("package-lock.json") &&
              !file.endsWith("yarn.lock") &&
              !file.endsWith("pnpm-lock.yaml")
            ) {
              const relativePath = path.relative(process.cwd(), filePath);
              fileList.push({ path: relativePath, size: stat.size });
            }
          }
        }
        return fileList;
      };

      const allFiles = await getFiles(process.cwd());
      res.json(allFiles);
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/evaluate-self", async (req, res) => {
    try {
      const apiKeys = getApiKeys(req);
      if (apiKeys.length === 0) {
        throw new Error("No API keys configured");
      }

      const clientJobId = req.body.jobId;
      const focusAreas = req.body.focusAreas || ["all"];
      const customNotes = req.body.customNotes || "";
      const depth = req.body.depth || "deep";
      const filePaths = req.body.filePaths || ["src/App.tsx", "server.ts"];

      let appCode = "";
      const maxTotalChars = 300000;
      let currentChars = 0;

      for (const fp of filePaths) {
        try {
          let content = await fs.promises.readFile(
            path.join(process.cwd(), fp),
            "utf-8",
          );
          currentChars += content.length;
          if (currentChars > maxTotalChars) {
            throw new Error(
              `لقد تجاوزت الملفات المختارة الحد الأقصى المسموح به (${maxTotalChars} حرف). يرجى تقليل عدد الملفات المختارة والمحاولة مرة أخرى.`,
            );
          }
          appCode += `\n=== ${fp} ===\n${content}\n`;
        } catch (e: unknown) {
          if ((e as Error).message.includes("لقد تجاوزت الملفات")) {
            throw e; // re-throw the limit error
          }
          appCode += `\n=== ${fp} ===\n(تعذر قراءة الملف)\n`;
        }
      }

      const jobId =
        clientJobId ||
        `eval_self_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      let focusInstructions = "";
      // Prompt logic moved to promptBuilder

      await boss.send("evaluate-self-job", {
        jobId,
        focusAreas,
        customNotes,
        depth,
        appCode,
        apiKeys,
      });

      res.json({ jobId });
    } catch (error: unknown) {
      console.error("Error initiating app evaluation:", error);
      res
        .status(500)
        .json({ error: (error as Error).message || "Failed to initiate app evaluation" });
    }
  });

  // Serve previews statically
  app.use(
    "/previews",
    express.static(path.join(process.cwd(), "public", "previews")),
  );

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
