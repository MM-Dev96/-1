import React, { useRef, useEffect, useState } from "react";
import {
  Check,
  Copy,
  FileCode,
  Activity,
  ShieldCheck,
  Zap,
  Eye,
  Terminal,
  ArrowLeft,
  Shield,
  RefreshCw,
  Play,
  Edit3,
  LayoutTemplate,
  Star,
  Code2,
  Plus,
  Trash2,
  GripVertical,
  Settings,
  User,
  Bell,
  ChevronDown,
  FolderKanban,
  Search,
  Menu,
  X,
  Archive,
  Save,
} from "lucide-react";
import Markdown from "react-markdown";
import { useAppStore } from "./store";
import WorkflowEditor from "./components/WorkflowEditor";
import Repository from "./components/Repository";
import Sidebar from "./components/Sidebar";
import TopNavbar from "./components/TopNavbar";

function MetricBox({
  label,
  value,
  icon: Icon,
  colorClass,
  isProcessing,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass?: string;
  isProcessing?: boolean;
}) {
  let textColor = "text-zinc-500";
  let bgGradient = "from-zinc-800 to-zinc-700";

  if (!colorClass || colorClass === "text-zinc-400") {
    if (value >= 90) {
      textColor = "text-emerald-400";
      bgGradient = "from-emerald-500 to-teal-400";
    } else if (value >= 70) {
      textColor = "text-amber-400";
      bgGradient = "from-amber-500 to-orange-400";
    } else if (value > 0) {
      textColor = "text-rose-400";
      bgGradient = "from-rose-500 to-red-400";
    }
  } else {
    textColor = colorClass;
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between transition-colors hover:border-white/20 relative overflow-hidden group shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Icon size={14} className={textColor} />
          <span className="text-xs uppercase tracking-wider text-zinc-300 font-semibold group-hover:text-white transition-colors">
            {label}
          </span>
        </div>
        {value === 0 && isProcessing ? (
          <RefreshCw size={12} className="text-zinc-500 animate-spin" />
        ) : (
          <span className={`text-sm font-mono font-bold ${textColor}`}>
            {value}%
          </span>
        )}
      </div>
      <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden relative">
        {value === 0 && isProcessing && (
          <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
        )}
        <div
          className={`h-full bg-gradient-to-r ${bgGradient}`}
          style={{
            width: `${value}%`,
            transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        ></div>
      </div>
    </div>
  );
}

function FileProgressIndicator() {
  return (
    <span
      className="text-teal-400 font-mono text-xs flex gap-1.5 items-center bg-teal-900/20 px-2 py-1 rounded-md"
      dir="ltr"
    >
      <RefreshCw size={12} className="animate-spin" /> Compiling...
    </span>
  );
}

const ALL_SUGGESTIONS = [
  {
    label: "🤖 منصة تحليل المشاعر للنصوص",
    text: "تطبيق ويب يحلل نصوص المستخدم ومراجعاته ويستخرج المشاعر (إيجابي، سلبي، محايد) مع عرض رسوم بيانية تفاعلية (Charts) لنسب المشاعر وتاريخها.",
  },
  {
    label: "📊 مولد لوحات تحكم ديناميكية",
    text: "أداة إنشاء لوحات تحكم (Dashboards) تفاعلية تتيح للمستخدمين إضافة وحذف وتغيير حجم المخططات البيانية (Graphs) ومؤشرات الأداء مع بيانات تجريبية حية.",
  },
  {
    label: "✍️ مساعد كتابة ذكي للمحتوى",
    text: "محرر نصوص متقدم (Markdown Editor) يوفر اقتراحات ذكية لتحسين الصياغة، تصحيح الأخطاء، وإعادة صياغة الجمل بنبرات مختلفة مع معاينة فورية.",
  },
  {
    label: "📈 منصة إدارة الحملات التسويقية",
    text: "نظام لإدارة الحملات التسويقية يتضمن واجهة مرئية لتتبع عائد الاستثمار (ROI)، وتحديد الميزانيات، وعرض تحليلات تفاعل الجمهور عبر رسوم بيانية.",
  },
  {
    label: "🗺️ مستكشف مسارات التعلم التفاعلي",
    text: "تطبيق يعرض خرائط طريق (Roadmaps) تعليمية تفاعلية لمختلف التخصصات التقنية، حيث يمكن للمستخدم تتبع تقدمه، وفتح وحدات جديدة، وحفظ ملاحظاته.",
  },
  {
    label: "👥 نظام إدارة موارد بشرية مصغر",
    text: "بوابة خدمة ذاتية للموظفين لتقديم طلبات الإجازات، استعراض الهيكل التنظيمي، تتبع الحضور والانصراف، وإدارة تقييمات الأداء مع لوحة تحكم للمدير.",
  },
  {
    label: "💼 محفظة استثمارية ذكية",
    text: "تطبيق تتبع للعملات الرقمية أو الأسهم مع رسوم بيانية حية متحركة، حساب الأرباح والخسائر التلقائي، ومحاكاة للتنبؤات الاستثمارية المستقبلية.",
  },
  {
    label: "📝 محرر عقود قانونية ذكي",
    text: "أداة لإنشاء وتعديل العقود باستخدام مكتبة بنود قانونية جاهزة، مع إمكانية التعبئة التلقائية للمتغيرات (مثل الأسماء والتواريخ) وعرض العقد النهائي للطباعة.",
  },
  {
    label: "📅 منصة جدولة اجتماعات ذكية",
    text: "تطبيق لحجز المواعيد يتيح مشاركة التقويم، ومطابقة المناطق الزمنية المختلفة، وعرض شبكة مرئية للأوقات المتاحة لتسهيل عملية الجدولة بين الفرق.",
  },
  {
    label: "💰 مدير ميزانية شخصية استباقي",
    text: "تطبيق متقدم لإدارة الشؤون المالية الشخصية يصنف النفقات تلقائياً، ويعرض حدود الإنفاق المرئية، ويقدم نصائح مخصصة للتوفير عبر واجهة مستخدم تفاعلية.",
  },
  {
    label: "🎯 متتبع أهداف العادات (Habit Tracker)",
    text: "تطبيق تتبع للعادات اليومية يعتمد على أسلوب التلعيب (Gamification) مع متتبعات متتالية (Streaks) وتصور لبيانات التقدم الشهري لمساعدة المستخدم على الالتزام.",
  },
  {
    label: "🎨 أداة توليد لوحات الألوان",
    text: "أداة للمصممين تتيح توليد وتخصيص لوحات ألوان متناسقة، وعرضها على واجهات مستخدم افتراضية لاختبارها، مع إمكانية نسخ أكواد الألوان مباشرة.",
  },
];

export default function App() {
  const {
    idea,
    setIdea,
    isProcessing,
    setIsProcessing,
    currentStage,
    setCurrentStage,
    finalPrompt,
    setFinalPrompt,
    errorText,
    setErrorText,
    copied,
    setCopied,
    activeTab,
    setActiveTab,
    mockupHtml,
    setMockupHtml,
    isGeneratingMockup,
    setIsGeneratingMockup,
    mockupError,
    setMockupError,
    mockupSimTimeLeft,
    setMockupSimTimeLeft,
    mockupSimFiles,
    setMockupSimFiles,
    mockupApiFinished,
    setMockupApiFinished,
    evalContent,
    setEvalContent,
    isEvaluating,
    setIsEvaluating,
    evalError,
    setEvalError,
    appEvalContent,
    setAppEvalContent,
    isAppEvaluating,
    setIsAppEvaluating,
    appEvalError,
    setAppEvalError,
    mainMode,
    setMainMode,
    workflowStages,
    addStage,
    updateStage,
    removeStage,
    activityLogs,
    setActivityLogs,
    stageArtifacts,
    setStageArtifacts,
    selectedArtifact,
    setSelectedArtifact,
    metrics,
    setMetrics,
    addNotification,
    customApiKeys,
    setCustomApiKeys
  } = useAppStore();

  const fetchWithKeys = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...(customApiKeys.length > 0 ? { "X-Gemini-Keys": customApiKeys.join(",") } : {})
    };
    return fetch(url, { ...options, headers });
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [errorDetailsDialog, setErrorDetailsDialog] = useState<{
    isOpen: boolean;
    title: string;
    details: string;
  }>({ isOpen: false, title: "", details: "" });
  const [currentSuggestions, setCurrentSuggestions] = useState<
    typeof ALL_SUGGESTIONS
  >([]);

  // Timer logic for stages
  const [stageTimer, setStageTimer] = useState<number | null>(null);
  const timerIntervalRef = useRef<any>(null);

  const startTimer = () => {
    setStageTimer(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setStageTimer((prev) => (prev !== null ? prev + 1 : null));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setStageTimer(null);
  };

  const formatTimer = (seconds: number | null) => {
    if (seconds === null) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const shuffleSuggestions = () => {
    const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
    setCurrentSuggestions(shuffled.slice(0, 3));
  };

  useEffect(() => {
    shuffleSuggestions();
  }, []);

  useEffect(() => {
    fetchWithKeys('/api/workflows/default')
      .then(res => res.json())
      .then(data => {
         if (data && data.nodes && Array.isArray(data.nodes)) {
            useAppStore.getState().setWorkflowStages(data.nodes);
         }
      })
      .catch(err => console.error("Failed to load workflow stages:", err));
  }, []);

  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const activeJobs = useRef<{
    [key: string]: { type: string; index?: number };
  }>({});

  useEffect(() => {
    import("socket.io-client").then(({ io }) => {
      const socket = io();

      socket.on("job_chunk", ({ jobId, text }) => {
        const jobInfo = activeJobs.current[jobId];
        if (!jobInfo) return;

        if (jobInfo.type === "stage" && jobInfo.index !== undefined) {
          useAppStore.getState().setStageArtifacts((prev) => ({
            ...prev,
            [jobInfo.index!]: (prev[jobInfo.index!] || "") + text,
          }));
        } else if (jobInfo.type === "prompt") {
          useAppStore.getState().setFinalPrompt((prev) => prev + text);
        } else if (jobInfo.type === "eval") {
          useAppStore.getState().setEvalContent((prev) => prev + text);
        } else if (jobInfo.type === "app_eval") {
          useAppStore.getState().setAppEvalContent((prev) => prev + text);
        }
      });

      socket.on("job_complete", ({ jobId }) => {
        const jobInfo = activeJobs.current[jobId];
        if (!jobInfo) return;

        if (jobInfo.type === "stage" && jobInfo.index !== undefined) {
          useAppStore
            .getState()
            .setActivityLogs((prev) => [
              ...prev,
              `[${new Date().toLocaleTimeString("ar-SA", { hour12: false })}] تم استلام المخرج بنجاح.`,
            ]);
        } else if (jobInfo.type === "eval") {
          useAppStore.getState().setIsEvaluating(false);
        } else if (jobInfo.type === "app_eval") {
          useAppStore.getState().setIsAppEvaluating(false);
        }

        delete activeJobs.current[jobId];
      });

      socket.on("job_error", ({ jobId, error }) => {
        const jobInfo = activeJobs.current[jobId];
        if (!jobInfo) return;

        if (jobInfo.type === "stage" && jobInfo.index !== undefined) {
          useAppStore
            .getState()
            .setActivityLogs((prev) => [
              ...prev,
              `[${new Date().toLocaleTimeString("ar-SA", { hour12: false })}] خطأ في المرحلة: ${error}`,
            ]);
        } else if (jobInfo.type === "prompt") {
          useAppStore.getState().setFinalPrompt(`Error: ${error}`);
        } else if (jobInfo.type === "eval") {
          useAppStore.getState().setEvalError(error);
          useAppStore.getState().setIsEvaluating(false);
        } else if (jobInfo.type === "app_eval") {
          useAppStore.getState().setAppEvalError(error);
          useAppStore.getState().setIsAppEvaluating(false);
        }
        delete activeJobs.current[jobId];
      });

      socket.on("orchestrator_started", ({ jobId }) => {
        activeJobs.current[jobId] = { type: "orchestrator" };
      });
      socket.on("orchestrator_stage_start", ({ jobId, stageIndex, stage }) => {
        const stageJobId = `stage_${jobId}_${stageIndex}`;
        activeJobs.current[stageJobId] = { type: "stage", index: stageIndex };
        useAppStore.getState().setCurrentStage(stageIndex);
        useAppStore.getState().setActivityLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString("ar-SA", { hour12: false })}] جاري تشغيل وكيل الذكاء الاصطناعي لمرحلة: ${stage.title}...`,
        ]);
      });
      socket.on("orchestrator_stage_complete", ({ jobId, stageIndex }) => {
        const prevMetrics = useAppStore.getState().metrics;
        useAppStore.getState().setMetrics({
          ...prevMetrics,
          completeness: Math.floor(((stageIndex + 1) / useAppStore.getState().workflowStages.length) * 100),
          security: Math.min(100, Math.floor(((stageIndex + 1) / 10) * 100)),
          performance: Math.min(100, Math.floor(((stageIndex + 1) / 15) * 100)),
          accessibility: Math.min(100, Math.floor(((stageIndex + 1) / 12) * 100)),
        });
      });
      socket.on("orchestrator_prompt_start", ({ jobId }) => {
        const promptJobId = `prompt_${jobId}`;
        activeJobs.current[promptJobId] = { type: "prompt" };
        useAppStore.getState().setActivityLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString("ar-SA", { hour12: false })}] جاري تجميع وتوليد البرومبت النهائي...`,
        ]);
      });
      socket.on("orchestrator_complete", ({ jobId }) => {
        useAppStore.getState().setIsProcessing(false);
        useAppStore.getState().setCurrentStage(useAppStore.getState().workflowStages.length);
        delete activeJobs.current[jobId];
      });
      socket.on("orchestrator_error", ({ jobId, error }) => {
        useAppStore.getState().setIsProcessing(false);
        useAppStore.getState().setErrorText(`خطأ في المنسق: ${error}`);
        delete activeJobs.current[jobId];
      });

      (window as any).ioSocket = socket;
    });
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activityLogs]);

  const MOCKUP_FILES = [
    "ProjectManifest.json",
    "RequirementsTraceabilityMatrix.json",
    "Architecture.md",
    "DatabaseSchema.sql",
    "OpenAPI.yaml",
    "DesignTokens.json",
    "Frontend/src/App.tsx",
    "Frontend/src/components/UI.tsx",
    "Frontend/src/index.css",
    "Backend/src/server.ts",
    "Backend/src/routes.ts",
    "Tests/e2e.spec.ts",
    "Docker/Dockerfile",
    "Deployment/docker-compose.yml",
    "FinalAudit.md",
  ];

  useEffect(() => {
    let fileTimer: NodeJS.Timeout;
    let countdownTimer: NodeJS.Timeout;

    if (isGeneratingMockup && !mockupError) {
      setMockupSimTimeLeft(5);
      setMockupSimFiles([]);
      setMockupApiFinished(false);

      let currentFileIdx = 0;
      fileTimer = setInterval(() => {
        if (currentFileIdx < MOCKUP_FILES.length) {
          setMockupSimFiles((prev) => [...prev, MOCKUP_FILES[currentFileIdx]]);
          currentFileIdx++;
        }
      }, 350);

      countdownTimer = setInterval(() => {
        setMockupSimTimeLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      clearInterval(fileTimer);
      clearInterval(countdownTimer);
    };
  }, [isGeneratingMockup, mockupError]);

  useEffect(() => {
    if (
      isGeneratingMockup &&
      mockupSimTimeLeft === 0 &&
      mockupApiFinished &&
      !mockupError
    ) {
      setIsGeneratingMockup(false);
    }
  }, [isGeneratingMockup, mockupSimTimeLeft, mockupApiFinished, mockupError]);

  const generateMockup = async () => {
    if (mockupHtml || isGeneratingMockup) return;
    setIsGeneratingMockup(true);
    setMockupError("");
    setMockupApiFinished(false);
    try {
      const res = await fetchWithKeys("/api/generate-mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMockupHtml(data.html);
      setMockupApiFinished(true);
      const projectId = useAppStore.getState().currentProjectId;
      if (projectId) {
        useAppStore
          .getState()
          .updateProject(projectId, { mockupHtml: data.html });
      }
    } catch (err: any) {
      setMockupError(err.message || "حدث خطأ غير معروف");
      setMockupApiFinished(true);
    }
  };

  const generateEvaluation = async () => {
    if (evalContent || isEvaluating || !finalPrompt) return;
    setIsEvaluating(true);
    setEvalError("");
    setEvalContent("");
    const jobId = `eval_prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    activeJobs.current[jobId] = { type: "eval" };

    try {
      const res = await fetchWithKeys("/api/evaluate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedPrompt: finalPrompt, jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
    } catch (err: any) {
      setEvalError(err.message || "حدث خطأ أثناء التقييم");
      setIsEvaluating(false);
      delete activeJobs.current[jobId];
    }
  };

  const [appEvalFocusAreas, setAppEvalFocusAreas] = useState<string[]>(['all']);
  const [appEvalCustomNotes, setAppEvalCustomNotes] = useState('');
  const [appEvalDepth, setAppEvalDepth] = useState<'quick' | 'deep'>('deep');
  const [appEvalAvailableFiles, setAppEvalAvailableFiles] = useState<{path: string, size: number}[]>([]);
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [appEvalSelectedFiles, setAppEvalSelectedFiles] = useState<string[]>(['src/App.tsx', 'server.ts']);

  useEffect(() => {
    if (mainMode === 'app_evaluator') {
      fetchWithKeys('/api/project/files')
        .then(res => res.json())
        .then(data => {
           if (Array.isArray(data)) {
             setAppEvalAvailableFiles(data);
             if (data.length > 0 && appEvalSelectedFiles.length === 2 && appEvalSelectedFiles.includes('src/App.tsx') && appEvalSelectedFiles.includes('server.ts')) {
                // Keep default if nothing else was chosen, or we can select all top level
             }
           }
        })
        .catch(console.error);
    }
  }, [mainMode]);

  const generateAppEvaluation = async () => {
    if (isAppEvaluating) return;
    setIsAppEvaluating(true);
    setAppEvalError("");
    setAppEvalContent("");
    const jobId = `eval_self_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    activeJobs.current[jobId] = { type: "app_eval" };

    try {
      const res = await fetchWithKeys("/api/evaluate-self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, focusAreas: appEvalFocusAreas, customNotes: appEvalCustomNotes, depth: appEvalDepth, filePaths: appEvalSelectedFiles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      // Fallback timeout to prevent infinite spinning if socket disconnects or hangs
      setTimeout(() => {
        if (activeJobs.current[jobId]) {
          useAppStore.getState().setAppEvalError("انتهى وقت الانتظار (Timeout). التقرير كبيراً جداً ويستغرق الكثير من الوقت لمعالجته. يرجى المحاولة مرة أخرى أو تقليل نطاق التركيز.");
          useAppStore.getState().setIsAppEvaluating(false);
          delete activeJobs.current[jobId];
        }
      }, 610000); // 10 minutes and 10 seconds

    } catch (err: any) {
      setAppEvalError(err.message || "حدث خطأ أثناء التقييم");
      setIsAppEvaluating(false);
      delete activeJobs.current[jobId];
    }
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  const stopProduction = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setErrorText("تم إيقاف التنفيذ يدوياً. يمكنك استئناف العمل لاحقاً.");
    }
  };

  const startProduction = async () => {
    if (!idea.trim()) return;

    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const isResuming = useAppStore.getState().currentProjectId !== null;
    const project = isResuming
      ? useAppStore
          .getState()
          .projects.find(
            (p) => p.id === useAppStore.getState().currentProjectId,
          )
      : null;

    const startingStage =
      project && project.status === "غير مكتمل" ? project.currentStage || 0 : 0;

    setIsProcessing(true);
    setCurrentStage(startingStage);
    setErrorText("");
    setFinalPrompt(startingStage === 0 ? "" : project?.finalPrompt || "");
    setCopied(false);
    setActiveTab("edit");
    setMockupHtml(startingStage === 0 ? "" : project?.mockupHtml || "");
    setMockupError("");
    setEvalContent("");
    setEvalError("");
    setAppEvalContent("");
    setAppEvalError("");
    setActivityLogs(startingStage === 0 ? [] : project?.activityLogs || []);
    setMetrics({
      security: 0,
      performance: 0,
      accessibility: 0,
      completeness: Math.floor((startingStage / workflowStages.length) * 100),
    });

    let projectId = useAppStore.getState().currentProjectId;
    if (!projectId) {
      projectId = Date.now().toString();
      useAppStore.getState().setCurrentProjectId(projectId);
      useAppStore.getState().addProject({
        id: projectId,
        name:
          idea.slice(0, 30) + (idea.length > 30 ? "..." : "") || "مشروع جديد",
        idea,
        status: "غير مكتمل",
        currentStage: 0,
        stageArtifacts: {},
        activityLogs: [],
        finalPrompt: "",
        mockupHtml: "",
        createdAt: Date.now(),
      });
    } else {
      useAppStore
        .getState()
        .updateProject(projectId, { idea, status: "غير مكتمل" });
    }

    const waitForJob = (jobId: string, timeoutMs: number = 600000, abortSignal?: AbortSignal) => {
      return new Promise((resolve, reject) => {
        let timeoutId: any;

        const socket = (window as any).ioSocket;
        if (!socket) return resolve(null);
        
        if (abortSignal?.aborted) {
          return reject(new Error("Aborted by user"));
        }

        const onAbort = () => {
          cleanup();
          reject(new Error("Aborted by user"));
        };
        
        if (abortSignal) {
          abortSignal.addEventListener("abort", onAbort);
        }

        const resetTimeout = () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            cleanup();
            reject(
              new Error(
                `انتهى وقت الانتظار للمهمة (${timeoutMs / 1000} ثانية). الخادم لا يستجيب.`,
              ),
            );
          }, timeoutMs);
        };

        const onComplete = (data: any) => {
          if (data.jobId === jobId) {
            cleanup();
            resolve(null);
          }
        };
        const onError = (data: any) => {
          if (data.jobId === jobId) {
            cleanup();
            reject(new Error(data.error));
          }
        };
        const onChunk = (data: any) => {
          if (data.jobId === jobId) {
             resetTimeout(); // Reset timer if chunk arrives
          }
        };
        const cleanup = () => {
          clearTimeout(timeoutId);
          socket.off("job_complete", onComplete);
          socket.off("job_error", onError);
          socket.off("job_chunk", onChunk);
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbort);
          }
        };
        
        socket.on("job_complete", onComplete);
        socket.on("job_error", onError);
        socket.on("job_chunk", onChunk);

        resetTimeout();
      });
    };

    const runOrchestrator = async () => {
      if (abortSignal.aborted) throw new Error("Aborted by user");
      
      const res = await fetchWithKeys("/api/start-orchestration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, idea, workflowStages, startingStage }),
        signal: abortSignal,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start orchestrator");
      
      const jobId = data.jobId;

      await new Promise((resolve, reject) => {
        const socket = (window as any).ioSocket;
        if (!socket) return resolve(null);
        
        const onComplete = (dataMsg: any) => {
          if (dataMsg.jobId === jobId) {
            cleanup(); resolve(null);
          }
        };
        const onError = (dataMsg: any) => {
          if (dataMsg.jobId === jobId) {
            cleanup(); reject(new Error(dataMsg.error));
          }
        };
        const onAbort = () => { cleanup(); reject(new Error("Aborted by user")); };
        const cleanup = () => {
          socket.off("orchestrator_complete", onComplete);
          socket.off("orchestrator_error", onError);
          if (abortSignal) abortSignal.removeEventListener("abort", onAbort);
        };
        socket.on("orchestrator_complete", onComplete);
        socket.on("orchestrator_error", onError);
        if (abortSignal) abortSignal.addEventListener("abort", onAbort);
      });
    };

    try {
      await runOrchestrator();

      addNotification(`🎉 اكتمل مسار العمل بالكامل بنجاح!`);
      useAppStore.getState().updateProject(projectId, {
        currentStage: workflowStages.length,
        stageArtifacts: useAppStore.getState().stageArtifacts,
        activityLogs: useAppStore.getState().activityLogs,
        finalPrompt: useAppStore.getState().finalPrompt,
        status: "مكتمل",
      });

      setTimeout(() => {
        outputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyPrompt = () => {
    if (activeTab === "eval") {
      navigator.clipboard.writeText(evalContent);
    } else {
      navigator.clipboard.writeText(finalPrompt);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div
      className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden selection:bg-indigo-500/30"
      dir="rtl"
    >
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-black">
        <TopNavbar setSidebarOpen={setSidebarOpen} />

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          {/* subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="max-w-7xl mx-auto relative z-10">
            {/* Header Section for current mode */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
                {mainMode === "orchestrator"
                  ? "تنسيق مهام الذكاء الاصطناعي"
                  : mainMode === "workflow_editor"
                    ? "محرر مسار العمل الرسومي"
                    : mainMode === "repository"
                      ? "المستودع الرقمي"
                      : "التدقيق الذاتي للمنظومة"}
              </h1>
              <p className="text-zinc-400 text-sm">
                {mainMode === "orchestrator"
                  ? "قم بإدارة وتنفيذ دورة حياة تطوير البرمجيات بالكامل باستخدام وكلاء ذكاء اصطناعي متخصصين."
                  : mainMode === "workflow_editor"
                    ? "قم بتصميم الاعتماديات وتدفق البيانات بين وكلاء الذكاء الاصطناعي بشكل مرئي (DAG)."
                    : mainMode === "repository"
                      ? "مساحة لحفظ مشاريعك المكتملة وإدارتها وإعادة تعديلها بمرونة."
                      : "تحليل المنظومة المعمارية الحالية واقتراح تحسينات للارتقاء بها لمستوى المؤسسات."}
              </p>
            </div>

            {mainMode === "orchestrator" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Right Panel: Input & Status (First in DOM for RTL) */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
                  {/* Idea Input Card */}
                  <div className="bg-[#0f0f0f] border border-white/10 p-6 rounded-2xl shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-xs text-zinc-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                        <Terminal size={14} className="text-indigo-400" />
                        المدخلات الأساسية
                      </label>
                      <div className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-medium border border-emerald-500/20 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        متصل
                      </div>
                    </div>

                    <textarea
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      placeholder="صف المتطلبات الوظيفية أو فكرة المشروع هنا..."
                      className="w-full min-h-[120px] bg-black/50 border border-white/5 rounded-xl p-4 text-sm leading-relaxed text-zinc-200 focus:outline-none focus:border-indigo-500/50 focus:bg-black transition-all resize-none placeholder:text-zinc-600 mb-4"
                      disabled={isProcessing}
                    />

                    <div className="space-y-2 mb-6">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                          نماذج سريعة (Templates):
                        </span>
                        <button
                          onClick={shuffleSuggestions}
                          disabled={isProcessing}
                          className="text-zinc-500 hover:text-indigo-400 transition-colors"
                          title="تحديث النماذج"
                        >
                          <RefreshCw
                            size={12}
                            className={isProcessing ? "animate-spin" : ""}
                          />
                        </button>
                      </div>
                      {currentSuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => !isProcessing && setIdea(item.text)}
                          disabled={isProcessing}
                          className="w-full text-[11px] bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 text-zinc-400 hover:text-zinc-200 rounded-lg px-3 py-2 transition-all text-right flex items-center gap-2"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50"></div>
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2 w-full">
                      <button
                        onClick={startProduction}
                        disabled={isProcessing}
                        className={`flex-1 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
                          errorText
                            ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                            : isProcessing
                              ? "bg-zinc-800 text-zinc-500 cursor-wait"
                              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:shadow-[0_0_25px_rgba(79,70,229,0.4)]"
                        }`}
                      >
                        {errorText ||
                          (isProcessing
                            ? "جاري التنفيذ..."
                            : finalPrompt
                              ? "إعادة التنفيذ"
                              : "بدء مسار العمل")}
                        {!isProcessing &&
                          !errorText &&
                          (finalPrompt ? (
                            <RefreshCw size={16} />
                          ) : (
                            <Play size={16} fill="currentColor" />
                          ))}
                      </button>
                      
                      {isProcessing && (
                        <button
                          onClick={stopProduction}
                          className="px-6 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                          title="إيقاف مؤقت (يمكن استئنافه لاحقاً)"
                        >
                          <div className="w-3 h-3 bg-rose-500 rounded-sm"></div>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <MetricBox
                      label="التقدم"
                      value={metrics.completeness}
                      icon={Check}
                      isProcessing={isProcessing}
                    />
                    <MetricBox
                      label="الأمان"
                      value={metrics.security}
                      icon={ShieldCheck}
                      isProcessing={isProcessing}
                    />
                    <MetricBox
                      label="الأداء"
                      value={metrics.performance}
                      icon={Zap}
                      isProcessing={isProcessing}
                    />
                    <MetricBox
                      label="الوصول"
                      value={metrics.accessibility}
                      icon={Eye}
                      isProcessing={isProcessing}
                    />
                  </div>

                  {/* Activity Log */}
                  <div className="bg-[#0f0f0f] border border-white/10 p-5 rounded-2xl flex-1 flex flex-col min-h-[250px] shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-xs text-zinc-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                        <Activity size={14} className="text-zinc-500" />
                        سجل النظام (System Logs)
                      </label>
                      {stageTimer !== null && isProcessing && (
                        <div className="flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                          </span>
                          {formatTimer(stageTimer)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto bg-[#050505] rounded-xl p-4 border border-white/5 font-mono text-xs flex flex-col gap-3 custom-scrollbar">
                      {activityLogs.length === 0 && !isProcessing && (
                        <div className="text-zinc-600 text-center m-auto flex flex-col items-center gap-2">
                          <Terminal size={20} className="opacity-50" />
                          <span>النظام في وضع الاستعداد...</span>
                        </div>
                      )}
                      {activityLogs.map((logItem, i) => {
                        const logText =
                          typeof logItem === "string" ? logItem : logItem.text;
                        const errorDetails =
                          typeof logItem === "string"
                            ? null
                            : logItem.errorDetails;
                        const isWarning =
                          logText.includes("⚠️") || logText.includes("تحذير");
                        const isError =
                          logText.includes("🚨") || logText.includes("فشل");
                        const isSuccess =
                          logText.includes("✅") || logText.includes("🚀");
                        return (
                          <div
                            key={i}
                            className={`flex gap-3 items-start animate-[fadeIn_0.3s_ease-out_forwards] ${isWarning ? "text-amber-400/90" : isError ? "text-rose-400/90" : isSuccess ? "text-emerald-400/90" : "text-zinc-400"}`}
                          >
                            <span className="text-zinc-500 shrink-0 mt-0.5">
                              ›
                            </span>
                            <div className="flex flex-col gap-1 items-start w-full">
                              <span className="leading-relaxed">{logText}</span>
                              {errorDetails && (
                                <button
                                  onClick={() =>
                                    setErrorDetailsDialog({
                                      isOpen: true,
                                      title: "تفاصيل الخطأ التقني",
                                      details: errorDetails,
                                    })
                                  }
                                  className="text-[10px] mt-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors flex items-center gap-1"
                                >
                                  عرض تفاصيل الخطأ
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                </div>

                {/* Left Panel: Stages & Outputs */}
                <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
                  {/* Pipeline View */}
                  <div className="bg-[#0f0f0f] border border-white/10 p-6 rounded-2xl shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-center mb-6">
                      <label className="text-xs text-zinc-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                        <FolderKanban size={14} className="text-indigo-400" />
                        المهام الجارية (Active Pipeline)
                      </label>
                      <button className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-md transition-colors border border-indigo-500/20">
                        عرض كـ رسوم بيانية (DAG)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {workflowStages.map((stage, index) => {
                        const isActive = currentStage === index;
                        const isCompleted = currentStage > index;

                        let containerStyle =
                          "bg-[#050505] border-white/5 text-zinc-500";
                        if (isActive)
                          containerStyle =
                            "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/20";
                        else if (isCompleted)
                          containerStyle =
                            "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/20";

                        return (
                          <div
                            key={index}
                            ref={(el) => {
                              if (el) stageRefs.current[index] = el;
                            }}
                            className={`border p-4 rounded-xl flex flex-col relative transition-all duration-300 cursor-pointer group ${containerStyle}`}
                            onClick={() => {
                              if (isCompleted && stageArtifacts[index]) {
                                setSelectedArtifact({
                                  title: stage.title,
                                  content: stageArtifacts[index],
                                });
                              }
                            }}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span
                                className={`text-xs font-mono font-bold ${isActive ? "text-indigo-400" : "opacity-50"}`}
                              >
                                {(index + 1).toString().padStart(2, "0")}
                              </span>
                              {isCompleted && (
                                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                                  <Check size={12} />
                                </div>
                              )}
                              {isActive && (
                                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse mt-1.5 shadow-[0_0_8px_rgba(129,140,248,0.8)]"></div>
                              )}
                            </div>

                            <h4
                              className={`text-sm font-semibold mb-3 ${isActive ? "text-white" : ""}`}
                            >
                              {stage.title}
                            </h4>

                            <div
                              className={`mt-auto flex items-center gap-2 text-xs ${isActive ? "opacity-90" : "opacity-60"}`}
                            >
                              <FileCode size={12} />
                              <span className="font-mono truncate">
                                {stage.artifact}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Results Viewer */}
                  <div
                    ref={outputRef}
                    className={`transition-all duration-500 ease-in-out ${
                      finalPrompt
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-4 hidden"
                    }`}
                  >
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                      {/* Tabs Header */}
                      <div className="bg-black/50 border-b border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                          <h2 className="text-lg font-medium text-white">
                            المخرجات المجمعة
                          </h2>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
                            <button
                              onClick={() => setActiveTab("edit")}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all font-medium ${activeTab === "edit" ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
                            >
                              <Code2 size={14} /> كود المصدر
                            </button>
                            <button
                              onClick={() => setActiveTab("markdown")}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all font-medium ${activeTab === "markdown" ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
                            >
                              <FileCode size={14} /> التقرير
                            </button>
                            <button
                              onClick={() => {
                                setActiveTab("app");
                                generateMockup();
                              }}
                              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all font-medium ${activeTab === "app" ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
                            >
                              <LayoutTemplate size={14} /> معاينة حية
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Content Area */}
                      <div className="relative">
                        {activeTab === "edit" && (
                          <div className="relative group">
                            <textarea
                              value={finalPrompt}
                              onChange={(e) => setFinalPrompt(e.target.value)}
                              dir="ltr"
                              className="w-full h-[600px] p-6 font-mono text-sm text-zinc-300 bg-[#050505] resize-y focus:outline-none focus:bg-white/[0.02] text-left leading-relaxed custom-scrollbar"
                              spellCheck="false"
                            />
                            <button
                              onClick={copyPrompt}
                              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-lg backdrop-blur text-white opacity-0 group-hover:opacity-100 transition-all border border-white/10"
                            >
                              {copied ? (
                                <Check size={16} className="text-emerald-400" />
                              ) : (
                                <Copy size={16} />
                              )}
                            </button>
                          </div>
                        )}

                        {activeTab === "markdown" && (
                          <div className="w-full h-[600px] p-8 overflow-y-auto bg-[#050505] custom-scrollbar">
                            <div
                              className="prose prose-invert prose-zinc max-w-none prose-headings:font-semibold prose-pre:bg-[#111] prose-pre:border prose-pre:border-white/5"
                              dir="rtl"
                            >
                              <Markdown>{finalPrompt}</Markdown>
                            </div>
                          </div>
                        )}

                        {activeTab === "app" && (
                          <div className="w-full h-[700px] bg-white relative rounded-b-2xl overflow-hidden">
                            {isGeneratingMockup ||
                            (mockupSimTimeLeft > 0 && !mockupError) ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] text-white p-6 z-10">
                                <div className="animate-spin rounded-full h-12 w-12 border-2 border-white/10 border-t-indigo-500 mb-6"></div>
                                <h3 className="font-medium text-lg text-zinc-100 mb-2">
                                  جاري تهيئة بيئة الاختبار المعزولة...
                                </h3>
                                <p className="text-zinc-400 text-sm mb-8 text-center max-w-sm">
                                  يتم الآن نشر الكود على بنية تحتية مؤقتة
                                  للمعاينة الحية.
                                </p>

                                <div
                                  className="w-full max-w-md bg-black rounded-xl p-5 border border-white/10 text-left font-mono shadow-2xl"
                                  dir="ltr"
                                >
                                  <div className="flex justify-between text-xs text-zinc-500 mb-4 pb-2 border-b border-white/5">
                                    <span>Deployment Progress</span>
                                    <span>
                                      00:
                                      {mockupSimTimeLeft
                                        .toString()
                                        .padStart(2, "0")}
                                    </span>
                                  </div>
                                  <div className="flex flex-col gap-2 h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                                    {mockupSimFiles.map((file, i) => (
                                      <div
                                        key={i}
                                        className="flex justify-between items-center text-xs text-zinc-400"
                                      >
                                        <span className="flex items-center gap-2">
                                          <Check
                                            size={12}
                                            className="text-emerald-500"
                                          />{" "}
                                          {file}
                                        </span>
                                        <span className="text-emerald-500/70">
                                          Done
                                        </span>
                                      </div>
                                    ))}
                                    {mockupSimTimeLeft > 0 &&
                                      mockupSimFiles.length <
                                        MOCKUP_FILES.length && (
                                        <div className="flex justify-between items-center text-xs text-zinc-300">
                                          <span className="flex items-center gap-2">
                                            <Terminal
                                              size={12}
                                              className="animate-pulse text-indigo-400"
                                            />{" "}
                                            {
                                              MOCKUP_FILES[
                                                mockupSimFiles.length
                                              ]
                                            }
                                          </span>
                                          <FileProgressIndicator
                                            key={mockupSimFiles.length}
                                          />
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </div>
                            ) : mockupError ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] text-rose-400 p-6 z-10 text-center">
                                <div className="bg-rose-500/10 p-4 rounded-full mb-4 border border-rose-500/20">
                                  <Shield size={32} className="text-rose-500" />
                                </div>
                                <p className="font-medium text-lg text-white mb-2">
                                  فشل نشر بيئة الاختبار
                                </p>
                                <p className="text-sm text-rose-400/80 max-w-md mb-6">
                                  {mockupError}
                                </p>
                                <button
                                  onClick={generateMockup}
                                  className="px-6 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg text-sm font-medium transition-colors"
                                >
                                  إعادة المحاولة
                                </button>
                              </div>
                            ) : (
                              <iframe
                                srcDoc={mockupHtml}
                                className="w-full h-full border-0 bg-white"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                                title="App Mockup"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mainMode === "workflow_editor" && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <WorkflowEditor />

                <div className="bg-[#0f0f0f] border border-white/10 p-6 rounded-2xl shadow-xl">
                  <h3 className="text-lg font-medium text-white mb-4">
                    خصائص العقدة (Node Configuration)
                  </h3>
                  <div className="text-sm text-zinc-400 flex items-center gap-2 bg-black/40 p-4 rounded-xl border border-white/5">
                    <Terminal size={16} className="text-zinc-500" />
                    انقر على أي عقدة في المحرر الرسومي بالأعلى لتخصيص وكيل
                    الذكاء الاصطناعي الخاص بها (Prompt Template, Output Schema,
                    LLM Model).
                  </div>
                </div>
              </div>
            )}

            {mainMode === "repository" && <Repository />}

            {mainMode === "app_evaluator" && (
              <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
                <div className="bg-[#0f0f0f] border border-white/10 p-10 rounded-2xl shadow-xl text-center relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>

                  <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20 shadow-inner">
                    <Shield size={36} className="text-indigo-400" />
                  </div>
                  <h2 className="text-3xl font-semibold text-white mb-4">
                    التدقيق المعماري للنظام
                  </h2>
                  <p className="text-zinc-400 text-sm max-w-xl mx-auto mb-8 leading-relaxed">
                    يقوم هذا المحرك بتحليل الكود المصدري للتطبيق الحالي بدقة
                    للتأكد من توافقه مع معايير بناء تطبيقات المؤسسات (Enterprise
                    Architecture)، شاملاً الأمان، الأداء، وهيكلة قاعدة البيانات.
                  </p>

                  <div className="mb-10 max-w-2xl mx-auto text-right">
                    <label className="block text-sm font-medium text-zinc-300 mb-4">مجال التركيز للتدقيق (يمكنك اختيار أكثر من واحد):</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'all', label: 'التدقيق الشامل (Full System Audit)', desc: 'مراجعة معمارية النظام بالكامل بأدق التفاصيل' },
                        { id: 'pipeline', label: 'خط الإنتاج (Production Pipeline)', desc: 'مراجعة إدارة المهام والوكلاء' },
                        { id: 'repository', label: 'المستودع (Repository)', desc: 'التأكد من التخزين وحالة المشاريع' },
                        { id: 'ux', label: 'تجربة المستخدم (UX)', desc: 'تفاعل المستخدم والتعامل مع الانتظار' },
                        { id: 'security', label: 'الأمان (Security)', desc: 'تدقيق الثغرات الأمنية' },
                        { id: 'performance', label: 'الأداء (Performance)', desc: 'تحسين الأداء وسرعة الاستجابة' },
                        { id: 'sidebar_nav', label: 'القائمة الجانبية (Sidebar)', desc: 'تحسين التنقل والوصول' },
                        { id: 'preview_engine', label: 'المعاينة الحية (Live Preview)', desc: 'دقة وتفاعلية محاكي التطبيقات' },
                        { id: 'notifications', label: 'الإشعارات (Notifications)', desc: 'إدارة التنبيهات وحالة المهام' },
                        { id: 'settings', label: 'الإعدادات (Settings)', desc: 'تخصيص النظام والتفضيلات' },
                        { id: 'ai_agents', label: 'وكلاء الذكاء الاصطناعي (AI Agents)', desc: 'جودة البرومبت ومخرجات النماذج' },
                        { id: 'agent_integration', label: 'التدقيق المعماري وتكامله مع جوجل استديو (أنت)', desc: 'تقييم معمارية النظام وتوافقه مع قدراتي كوكيل ذكاء اصطناعي' }
                      ].map(option => (
                        <label 
                          key={option.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            appEvalFocusAreas.includes(option.id) 
                              ? 'bg-indigo-500/10 border-indigo-500/50' 
                              : 'bg-black/30 border-white/5 hover:border-white/10'
                          } ${isAppEvaluating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="pt-0.5">
                            <input 
                              type="checkbox"
                              disabled={isAppEvaluating}
                              className="hidden"
                              checked={appEvalFocusAreas.includes(option.id)}
                              onChange={(e) => {
                                if (option.id === 'all') {
                                  if (e.target.checked) setAppEvalFocusAreas(['all']);
                                  else setAppEvalFocusAreas([]);
                                } else {
                                  let newAreas = e.target.checked 
                                    ? [...appEvalFocusAreas.filter(a => a !== 'all'), option.id]
                                    : appEvalFocusAreas.filter(a => a !== option.id);
                                  
                                  if (newAreas.length === 0) newAreas = ['all'];
                                  setAppEvalFocusAreas(newAreas);
                                }
                              }}
                            />
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              appEvalFocusAreas.includes(option.id)
                                ? 'bg-indigo-500 border-indigo-500 text-white'
                                : 'border-zinc-600'
                            }`}>
                              {appEvalFocusAreas.includes(option.id) && <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                          </div>
                          <div>
                            <div className={`text-sm font-medium ${appEvalFocusAreas.includes(option.id) ? 'text-indigo-300' : 'text-zinc-300'}`}>{option.label}</div>
                            <div className="text-xs text-zinc-500 mt-1">{option.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="mt-6 text-right">
                      <label className="block text-sm font-medium text-zinc-300 mb-2">مستوى التدقيق:</label>
                      <div className="flex gap-4">
                        <label className={`flex-1 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${appEvalDepth === 'deep' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300' : 'bg-black/30 border-white/5 hover:border-white/10 text-zinc-300'} ${isAppEvaluating ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input type="radio" name="depth" value="deep" checked={appEvalDepth === 'deep'} onChange={() => setAppEvalDepth('deep')} disabled={isAppEvaluating} className="hidden" />
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${appEvalDepth === 'deep' ? 'border-indigo-500' : 'border-zinc-500'}`}>
                            {appEvalDepth === 'deep' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">تدقيق عميق (مستحسن)</div>
                            <div className="text-xs opacity-70 mt-1">تحليل مفصل وشامل مع اقتراحات معمارية دقيقة وحلول برمجية متقدمة.</div>
                          </div>
                        </label>
                        <label className={`flex-1 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${appEvalDepth === 'quick' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300' : 'bg-black/30 border-white/5 hover:border-white/10 text-zinc-300'} ${isAppEvaluating ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input type="radio" name="depth" value="quick" checked={appEvalDepth === 'quick'} onChange={() => setAppEvalDepth('quick')} disabled={isAppEvaluating} className="hidden" />
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${appEvalDepth === 'quick' ? 'border-indigo-500' : 'border-zinc-500'}`}>
                            {appEvalDepth === 'quick' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">نظرة سريعة</div>
                            <div className="text-xs opacity-70 mt-1">ملخص سريع للمشاكل الأساسية ونقاط التحسين المباشرة بدون تفاصيل معقدة.</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="mt-6 text-right">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-zinc-300">اختيار الملفات لسياق الوكيل:</label>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setAppEvalSelectedFiles(appEvalAvailableFiles.map(f => f.path))}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                            disabled={isAppEvaluating}
                          >
                            تحديد الكل
                          </button>
                          <button 
                            onClick={() => setAppEvalSelectedFiles([])}
                            className="text-xs text-zinc-400 hover:text-zinc-300"
                            disabled={isAppEvaluating}
                          >
                            إلغاء التحديد
                          </button>
                        </div>
                      </div>
                      
                      {/* Context usage progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-zinc-400 mb-1">
                           <span>{appEvalSelectedFiles.reduce((acc, path) => acc + (appEvalAvailableFiles.find(f => f.path === path)?.size || 0), 0).toLocaleString()} حرف</span>
                           <span>الحد الأقصى المسموح {Number(300000).toLocaleString()} حرف</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                           <div 
                             className={`h-full transition-all duration-300 ${appEvalSelectedFiles.reduce((acc, path) => acc + (appEvalAvailableFiles.find(f => f.path === path)?.size || 0), 0) > 300000 ? 'bg-red-500' : 'bg-indigo-500'}`}
                             style={{ width: `${Math.min(100, (appEvalSelectedFiles.reduce((acc, path) => acc + (appEvalAvailableFiles.find(f => f.path === path)?.size || 0), 0) / 300000) * 100)}%` }}
                           ></div>
                        </div>
                        {appEvalSelectedFiles.reduce((acc, path) => acc + (appEvalAvailableFiles.find(f => f.path === path)?.size || 0), 0) > 300000 && (
                          <p className="text-xs text-red-400 mt-1">لقد تجاوزت الحد المسموح به. يرجى إزالة بعض الملفات.</p>
                        )}
                      </div>

                      <div className="bg-black/30 border border-white/5 rounded-xl flex flex-col overflow-hidden">
                        <div className="p-2 border-b border-white/5">
                          <input 
                            type="text" 
                            placeholder="ابحث عن ملف..." 
                            value={fileSearchQuery}
                            onChange={(e) => setFileSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-transparent rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            dir="ltr"
                            disabled={isAppEvaluating}
                          />
                        </div>
                        <div className="p-4 max-h-60 overflow-y-auto custom-scrollbar">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {appEvalAvailableFiles.filter(f => f.path.toLowerCase().includes(fileSearchQuery.toLowerCase())).map(file => (
                              <label key={file.path} className={`flex items-center justify-between gap-3 p-2 rounded-lg cursor-pointer transition-colors ${appEvalSelectedFiles.includes(file.path) ? 'bg-white/10' : 'hover:bg-white/5'} ${isAppEvaluating ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <div className="flex items-center gap-3 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={appEvalSelectedFiles.includes(file.path)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setAppEvalSelectedFiles(prev => [...prev, file.path]);
                                      } else {
                                        setAppEvalSelectedFiles(prev => prev.filter(f => f !== file.path));
                                      }
                                    }}
                                    disabled={isAppEvaluating}
                                    className="hidden"
                                  />
                                  <div className={`min-w-4 w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                                    appEvalSelectedFiles.includes(file.path)
                                      ? 'bg-indigo-500 border-indigo-500 text-white'
                                      : 'border-zinc-600'
                                  }`}>
                                    {appEvalSelectedFiles.includes(file.path) && <svg className="w-3 h-3" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                  </div>
                                  <span className="text-sm text-zinc-300 truncate" dir="ltr" title={file.path}>{file.path}</span>
                                </div>
                                <span className="text-xs text-zinc-500 shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                              </label>
                            ))}
                          </div>
                          {appEvalAvailableFiles.filter(f => f.path.toLowerCase().includes(fileSearchQuery.toLowerCase())).length === 0 && (
                             <div className="text-center text-zinc-500 text-sm py-4">لا توجد ملفات مطابقة للبحث</div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">تضمين ملفات أكثر يستهلك عدد أكبر من الوحدات (Tokens) وقد يستغرق وقتاً أطول.</p>
                    </div>

                    <div className="mt-6 text-right">
                      <label className="block text-sm font-medium text-zinc-300 mb-2">ملاحظات إضافية أو مشكلة محددة (اختياري):</label>
                      <textarea
                        value={appEvalCustomNotes}
                        onChange={(e) => setAppEvalCustomNotes(e.target.value)}
                        disabled={isAppEvaluating}
                        placeholder="مثال: يرجى التركيز على حل مشكلة تعليق المتصفح عند إنشاء المشروع، أو اقتراح أفضل طريقة لإضافة قاعدة بيانات..."
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none h-24"
                        dir="rtl"
                      />
                    </div>
                  </div>

                  <button
                    onClick={generateAppEvaluation}
                    disabled={isAppEvaluating}
                    className={`px-8 py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 mx-auto ${
                      isAppEvaluating
                        ? "bg-zinc-800 text-zinc-500 cursor-wait"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
                    }`}
                  >
                    {isAppEvaluating ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" /> جاري
                        تحليل النظام (Scanning...)
                      </>
                    ) : (
                      <>
                        <Play size={18} fill="currentColor" /> بدء التدقيق
                        الشامل
                      </>
                    )}
                  </button>

                  {appEvalError && (
                    <div
                      className="mt-6 bg-rose-500/10 text-rose-400 p-4 rounded-xl text-sm border border-rose-500/20 text-right"
                      dir="ltr"
                    >
                      {appEvalError}
                    </div>
                  )}
                </div>

                {appEvalContent && (
                  <div className="mt-8 flex bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-500 relative">
                    <div className="hidden lg:block w-64 shrink-0 border-l border-white/5 bg-black/40 p-6 overflow-y-auto custom-scrollbar sticky top-0 max-h-[80vh]">
                      <h4 className="text-sm font-semibold text-zinc-400 mb-4 tracking-wider">محتويات التقرير</h4>
                      <div className="space-y-3">
                        {appEvalContent.split('\n')
                          .filter(line => line.startsWith('## ') || line.startsWith('### '))
                          .map((heading, i) => {
                            const level = heading.startsWith('### ') ? 3 : 2;
                            const text = heading.replace(/^#+\s/, '');
                            return (
                              <div 
                                key={i} 
                                className={`text-sm cursor-pointer hover:text-indigo-400 transition-colors ${level === 3 ? 'pr-4 text-zinc-500' : 'text-zinc-300 font-medium'}`}
                                onClick={() => {
                                  const elements = Array.from(document.querySelectorAll('.app-eval-markdown h2, .app-eval-markdown h3'));
                                  const target = elements.find(el => el.textContent?.includes(text.trim()));
                                  if (target) {
                                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }
                                }}
                              >
                                {text}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                      <div className="bg-black/60 border-b border-white/5 p-4 flex items-center justify-between shrink-0">
                        <h3 className="font-medium text-white flex items-center gap-2">
                          <FileCode size={16} className="text-indigo-400" />
                          التقرير المعماري النهائي
                        </h3>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(appEvalContent);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className="text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg border border-white/5"
                        >
                          {copied ? (
                            <Check size={16} className="text-emerald-400" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                      <div
                        className="p-8 prose prose-invert prose-zinc max-w-none text-right prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-white/10 prose-headings:font-semibold custom-scrollbar overflow-y-auto max-h-[80vh] app-eval-markdown"
                        dir="rtl"
                      >
                        <Markdown>{appEvalContent}</Markdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mainMode === 'settings' && (
              <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
                <div className="bg-[#0f0f0f] border border-white/10 p-10 rounded-2xl shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
                  <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
                    <Settings className="text-emerald-400" /> إعدادات النظام
                  </h2>
                  <div className="space-y-6 text-right">
                    <div className="bg-black/40 border border-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-medium text-white mb-4">التفضيلات العامة</h3>
                      <div className="space-y-4">
                        <label className="flex items-center justify-between text-sm text-zinc-300">
                          <span>تفعيل الإشعارات الصوتية</span>
                          <input type="checkbox" className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-500" />
                        </label>
                        <label className="flex items-center justify-between text-sm text-zinc-300">
                          <span>الوضع الداكن المتوافق</span>
                          <input type="checkbox" defaultChecked className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-500" />
                        </label>
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-medium text-white mb-4">إعدادات النماذج (LLMs)</h3>
                      <div className="space-y-4">
                        <label className="flex flex-col gap-2 text-sm text-zinc-300">
                          <span>النموذج الافتراضي للبرمجة</span>
                          <select className="bg-zinc-900 border border-zinc-700 rounded-md py-2 px-3 text-white focus:outline-none focus:border-indigo-500">
                            <option>gemini-2.5-pro</option>
                            <option>gemini-2.5-flash</option>
                            <option>gemini-2.0-flash</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-xl p-6">
                      <h3 className="text-lg font-medium text-white mb-2">نظام التناوب الذكي للمفاتيح (Smart Key Rotation)</h3>
                      <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                        نظراً لمحدودية الحصة المجانية لمفاتيح API، يوفر النظام حلاً ذكياً: يمكنك إضافة مفاتيح متعددة وسيقوم النظام بتدويرها تلقائياً (Round-robin) لتجنب انقطاع الخدمة (429 Rate Limit) وضمان استمرارية مجانية للخدمة.
                      </p>
                      <div className="space-y-4">
                        <label className="flex flex-col gap-2 text-sm text-zinc-300">
                          <span>أدخل مفاتيح Gemini API (مفتاح واحد في كل سطر)</span>
                          <textarea
                            value={customApiKeys.join('\n')}
                            onChange={(e) => {
                               const keys = e.target.value.split('\n').map(k => k.trim()).filter(Boolean);
                               setCustomApiKeys(keys);
                            }}
                            placeholder={"AIzaSy...\nAIzaSy...\nAIzaSy..."}
                            className="bg-zinc-900 border border-zinc-700 rounded-md py-3 px-4 text-white focus:outline-none focus:border-emerald-500 font-mono text-left"
                            rows={4}
                            dir="ltr"
                          />
                        </label>
                        <p className="text-xs text-emerald-400">
                          {customApiKeys.length > 0 ? `تم إضافة ${customApiKeys.length} مفاتيح. النظام سيتنقل بينها تلقائياً.` : 'سيتم استخدام المفتاح الافتراضي للنظام.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Error Details Modal */}
      {errorDetailsDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
          <div className="bg-[#0f0f0f] w-full max-w-2xl max-h-full rounded-2xl border border-rose-500/20 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-rose-500/10 bg-rose-500/5">
              <h3 className="font-semibold text-rose-400 flex items-center gap-2">
                <Terminal size={18} />
                {errorDetailsDialog.title}
              </h3>
              <button
                onClick={() =>
                  setErrorDetailsDialog({
                    isOpen: false,
                    title: "",
                    details: "",
                  })
                }
                className="text-rose-400/70 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <pre
                className="text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed whitespace-pre-line text-right"
                dir="rtl"
              >
                {errorDetailsDialog.details}
              </pre>
            </div>
            <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end">
              <button
                onClick={() =>
                  setErrorDetailsDialog({
                    isOpen: false,
                    title: "",
                    details: "",
                  })
                }
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors border border-white/5"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Artifact Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
          <div className="bg-[#0f0f0f] w-full max-w-4xl max-h-full rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-white/5 bg-black/60">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <FileCode size={18} className="text-indigo-400" />
                {selectedArtifact.title}
              </h3>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors border border-transparent hover:border-white/5"
              >
                <X size={20} />
              </button>
            </div>
            <div
              className="p-6 overflow-y-auto flex-1 bg-black custom-scrollbar"
              dir="ltr"
            >
              <pre className="text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {selectedArtifact.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
