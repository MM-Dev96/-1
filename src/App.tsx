import React, { useRef, useEffect, useState } from 'react';
import { Check, Copy, FileCode, Activity, ShieldCheck, Zap, Eye, Terminal, ArrowLeft, Shield, RefreshCw, Play, Edit3, LayoutTemplate, Star, Code2, Plus, Trash2, GripVertical, Settings, User, Bell, ChevronDown, FolderKanban, Search, Menu, X } from 'lucide-react';
import Markdown from 'react-markdown';
import { useAppStore } from './store';
import WorkflowEditor from './components/WorkflowEditor';

const STAGES = [
  { title: 'Product Manager', desc: 'تحليل المتطلبات وتحديد MVP', artifact: 'PRD.md' },
  { title: 'Business Analyst', desc: 'تحليل السوق والمنافسين', artifact: 'Market.md' },
  { title: 'UX Researcher', desc: 'رسم رحلة المستخدم', artifact: 'UserFlow.md' },
  { title: 'Product Designer', desc: 'تصميم واجهة المستخدم', artifact: 'Wireframes.fig' },
  { title: 'Design System Eng', desc: 'بناء النظام البصري', artifact: 'Tokens.json' },
  { title: 'System Architect', desc: 'هيكلة النظام الشاملة', artifact: 'Architecture.md' },
  { title: 'Database Architect', desc: 'تصميم قواعد البيانات', artifact: 'Schema.sql' },
  { title: 'API Architect', desc: 'تصميم الواجهات البرمجية', artifact: 'OpenAPI.yaml' },
  { title: 'Security Engineer', desc: 'نموذج الحماية والأمان', artifact: 'Security.md' },
  { title: 'UX Validation', desc: 'اعتماد تجربة المستخدم', artifact: 'UX_Audit.md' },
  { title: 'AI Architect', desc: 'تكامل الذكاء الاصطناعي', artifact: 'AI_Config.json' },
  { title: 'Frontend Lead', desc: 'واجهات المستخدم', artifact: 'Frontend/' },
  { title: 'Backend Lead', desc: 'الخوادم والمنطق', artifact: 'Backend/' },
  { title: 'Testing Architect', desc: 'ضمان الجودة والاختبار', artifact: 'Tests/' },
  { title: 'DevOps Engineer', desc: 'الاستضافة والحاويات', artifact: 'Dockerfile' },
  { title: 'Technical Writer', desc: 'كتابة التوثيق', artifact: 'Docs.md' },
  { title: 'Legal & Privacy', desc: 'الامتثال للخصوصية', artifact: 'Privacy.md' },
  { title: 'Release Manager', desc: 'خطة الإطلاق', artifact: 'Release.yml' },
  { title: 'Principal Engineer', desc: 'التدقيق النهائي', artifact: 'FinalAudit.md' },
  { title: 'AI Orchestrator', desc: 'تجميع البرومبت', artifact: 'Pipeline.yml' }
];

function MetricBox({ label, value, icon: Icon, colorClass, isProcessing }: { label: string, value: number, icon: React.ElementType, colorClass?: string, isProcessing?: boolean }) {
  let textColor = "text-zinc-500";
  let bgGradient = "from-zinc-800 to-zinc-700";
  
  if (!colorClass || colorClass === "text-zinc-400") {
    if (value >= 90) { textColor = "text-emerald-400"; bgGradient = "from-emerald-500 to-teal-400"; }
    else if (value >= 70) { textColor = "text-amber-400"; bgGradient = "from-amber-500 to-orange-400"; }
    else if (value > 0) { textColor = "text-rose-400"; bgGradient = "from-rose-500 to-red-400"; }
  } else {
    textColor = colorClass;
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between transition-colors hover:border-white/20 relative overflow-hidden group shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
           <Icon size={14} className={textColor} />
           <span className="text-xs uppercase tracking-wider text-zinc-300 font-semibold group-hover:text-white transition-colors">{label}</span>
        </div>
        {value === 0 && isProcessing ? (
           <RefreshCw size={12} className="text-zinc-500 animate-spin" />
        ) : (
           <span className={`text-sm font-mono font-bold ${textColor}`}>{value}%</span>
        )}
      </div>
      <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden relative">
        {value === 0 && isProcessing && (
           <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
        )}
        <div className={`h-full bg-gradient-to-r ${bgGradient}`} style={{ width: `${value}%`, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
      </div>
    </div>
  );
}

function FileProgressIndicator() {
  return <span className="text-teal-400 font-mono text-xs flex gap-1.5 items-center bg-teal-900/20 px-2 py-1 rounded-md" dir="ltr"><RefreshCw size={12} className="animate-spin" /> Compiling...</span>;
}

const ALL_SUGGESTIONS = [
  { label: '🤖 منصة تحليل المشاعر للنصوص', text: 'تطبيق ويب يحلل نصوص المستخدم ومراجعاته ويستخرج المشاعر (إيجابي، سلبي، محايد) مع عرض رسوم بيانية تفاعلية (Charts) لنسب المشاعر وتاريخها.' },
  { label: '📊 مولد لوحات تحكم ديناميكية', text: 'أداة إنشاء لوحات تحكم (Dashboards) تفاعلية تتيح للمستخدمين إضافة وحذف وتغيير حجم المخططات البيانية (Graphs) ومؤشرات الأداء مع بيانات تجريبية حية.' },
  { label: '✍️ مساعد كتابة ذكي للمحتوى', text: 'محرر نصوص متقدم (Markdown Editor) يوفر اقتراحات ذكية لتحسين الصياغة، تصحيح الأخطاء، وإعادة صياغة الجمل بنبرات مختلفة مع معاينة فورية.' },
  { label: '📈 منصة إدارة الحملات التسويقية', text: 'نظام لإدارة الحملات التسويقية يتضمن واجهة مرئية لتتبع عائد الاستثمار (ROI)، وتحديد الميزانيات، وعرض تحليلات تفاعل الجمهور عبر رسوم بيانية.' },
  { label: '🗺️ مستكشف مسارات التعلم التفاعلي', text: 'تطبيق يعرض خرائط طريق (Roadmaps) تعليمية تفاعلية لمختلف التخصصات التقنية، حيث يمكن للمستخدم تتبع تقدمه، وفتح وحدات جديدة، وحفظ ملاحظاته.' },
  { label: '👥 نظام إدارة موارد بشرية مصغر', text: 'بوابة خدمة ذاتية للموظفين لتقديم طلبات الإجازات، استعراض الهيكل التنظيمي، تتبع الحضور والانصراف، وإدارة تقييمات الأداء مع لوحة تحكم للمدير.' },
  { label: '💼 محفظة استثمارية ذكية', text: 'تطبيق تتبع للعملات الرقمية أو الأسهم مع رسوم بيانية حية متحركة، حساب الأرباح والخسائر التلقائي، ومحاكاة للتنبؤات الاستثمارية المستقبلية.' },
  { label: '📝 محرر عقود قانونية ذكي', text: 'أداة لإنشاء وتعديل العقود باستخدام مكتبة بنود قانونية جاهزة، مع إمكانية التعبئة التلقائية للمتغيرات (مثل الأسماء والتواريخ) وعرض العقد النهائي للطباعة.' },
  { label: '📅 منصة جدولة اجتماعات ذكية', text: 'تطبيق لحجز المواعيد يتيح مشاركة التقويم، ومطابقة المناطق الزمنية المختلفة، وعرض شبكة مرئية للأوقات المتاحة لتسهيل عملية الجدولة بين الفرق.' },
  { label: '💰 مدير ميزانية شخصية استباقي', text: 'تطبيق متقدم لإدارة الشؤون المالية الشخصية يصنف النفقات تلقائياً، ويعرض حدود الإنفاق المرئية، ويقدم نصائح مخصصة للتوفير عبر واجهة مستخدم تفاعلية.' },
  { label: '🎯 متتبع أهداف العادات (Habit Tracker)', text: 'تطبيق تتبع للعادات اليومية يعتمد على أسلوب التلعيب (Gamification) مع متتبعات متتالية (Streaks) وتصور لبيانات التقدم الشهري لمساعدة المستخدم على الالتزام.' },
  { label: '🎨 أداة توليد لوحات الألوان', text: 'أداة للمصممين تتيح توليد وتخصيص لوحات ألوان متناسقة، وعرضها على واجهات مستخدم افتراضية لاختبارها، مع إمكانية نسخ أكواد الألوان مباشرة.' }
];

export default function App() {
  const {
    idea, setIdea,
    isProcessing, setIsProcessing,
    currentStage, setCurrentStage,
    finalPrompt, setFinalPrompt,
    errorText, setErrorText,
    copied, setCopied,
    activeTab, setActiveTab,
    mockupHtml, setMockupHtml,
    isGeneratingMockup, setIsGeneratingMockup,
    mockupError, setMockupError,
    mockupSimTimeLeft, setMockupSimTimeLeft,
    mockupSimFiles, setMockupSimFiles,
    mockupApiFinished, setMockupApiFinished,
    evalContent, setEvalContent,
    isEvaluating, setIsEvaluating,
    evalError, setEvalError,
    appEvalContent, setAppEvalContent,
    isAppEvaluating, setIsAppEvaluating,
    appEvalError, setAppEvalError,
    mainMode, setMainMode,
    workflowStages, addStage, updateStage, removeStage,
    activityLogs, setActivityLogs,
    stageArtifacts, setStageArtifacts,
    selectedArtifact, setSelectedArtifact,
    metrics, setMetrics
  } = useAppStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<typeof ALL_SUGGESTIONS>([]);

  const shuffleSuggestions = () => {
    const shuffled = [...ALL_SUGGESTIONS].sort(() => 0.5 - Math.random());
    setCurrentSuggestions(shuffled.slice(0, 3));
  };

  useEffect(() => {
    shuffleSuggestions();
  }, []);

  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const activeJobs = useRef<{ [key: string]: { type: string, index?: number } }>({});

  useEffect(() => {
    import('socket.io-client').then(({ io }) => {
      const socket = io();
      
      socket.on('job_chunk', ({ jobId, text }) => {
        const jobInfo = activeJobs.current[jobId];
        if (!jobInfo) return;
        
        if (jobInfo.type === 'stage' && jobInfo.index !== undefined) {
          useAppStore.getState().setStageArtifacts(prev => ({
            ...prev,
            [jobInfo.index!]: (prev[jobInfo.index!] || '') + text
          }));
        } else if (jobInfo.type === 'prompt') {
          useAppStore.getState().setFinalPrompt(prev => prev + text);
        } else if (jobInfo.type === 'eval') {
          useAppStore.getState().setEvalContent(prev => prev + text);
        } else if (jobInfo.type === 'app_eval') {
          useAppStore.getState().setAppEvalContent(prev => prev + text);
        }
      });
      
      socket.on('job_complete', ({ jobId }) => {
        const jobInfo = activeJobs.current[jobId];
        if (!jobInfo) return;
        
        if (jobInfo.type === 'stage' && jobInfo.index !== undefined) {
          useAppStore.getState().setActivityLogs(prev => [
            ...prev,
            `[${new Date().toLocaleTimeString('ar-SA', { hour12: false })}] تم استلام المخرج بنجاح.`
          ]);
        } else if (jobInfo.type === 'eval') {
          useAppStore.getState().setIsEvaluating(false);
        } else if (jobInfo.type === 'app_eval') {
          useAppStore.getState().setIsAppEvaluating(false);
        }
        
        delete activeJobs.current[jobId];
      });
      
      socket.on('job_error', ({ jobId, error }) => {
        const jobInfo = activeJobs.current[jobId];
        if (!jobInfo) return;
        
        if (jobInfo.type === 'stage' && jobInfo.index !== undefined) {
          useAppStore.getState().setActivityLogs(prev => [
            ...prev,
            `[${new Date().toLocaleTimeString('ar-SA', { hour12: false })}] خطأ في المرحلة: ${error}`
          ]);
        } else if (jobInfo.type === 'prompt') {
          useAppStore.getState().setFinalPrompt(`Error: ${error}`);
        } else if (jobInfo.type === 'eval') {
          useAppStore.getState().setEvalError(error);
          useAppStore.getState().setIsEvaluating(false);
        } else if (jobInfo.type === 'app_eval') {
          useAppStore.getState().setAppEvalError(error);
          useAppStore.getState().setIsAppEvaluating(false);
        }
        delete activeJobs.current[jobId];
      });
      
      (window as any).ioSocket = socket;
    });
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityLogs]);

  const MOCKUP_FILES = [
    'ProjectManifest.json',
    'RequirementsTraceabilityMatrix.json',
    'Architecture.md',
    'DatabaseSchema.sql',
    'OpenAPI.yaml',
    'DesignTokens.json',
    'Frontend/src/App.tsx',
    'Frontend/src/components/UI.tsx',
    'Frontend/src/index.css',
    'Backend/src/server.ts',
    'Backend/src/routes.ts',
    'Tests/e2e.spec.ts',
    'Docker/Dockerfile',
    'Deployment/docker-compose.yml',
    'FinalAudit.md'
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
          setMockupSimFiles(prev => [...prev, MOCKUP_FILES[currentFileIdx]]);
          currentFileIdx++;
        }
      }, 350);

      countdownTimer = setInterval(() => {
        setMockupSimTimeLeft(prev => {
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
    if (isGeneratingMockup && mockupSimTimeLeft === 0 && mockupApiFinished && !mockupError) {
      setIsGeneratingMockup(false);
    }
  }, [isGeneratingMockup, mockupSimTimeLeft, mockupApiFinished, mockupError]);

  const generateMockup = async () => {
    if (mockupHtml || isGeneratingMockup) return;
    setIsGeneratingMockup(true);
    setMockupError('');
    setMockupApiFinished(false);
    try {
      const res = await fetch('/api/generate-mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMockupHtml(data.html);
      setMockupApiFinished(true);
    } catch (err: any) {
      setMockupError(err.message || 'حدث خطأ غير معروف');
      setMockupApiFinished(true);
    }
  };

  const generateEvaluation = async () => {
    if (evalContent || isEvaluating || !finalPrompt) return;
    setIsEvaluating(true);
    setEvalError('');
    setEvalContent('');
    const jobId = `eval_prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    activeJobs.current[jobId] = { type: 'eval' };
    
    try {
      const res = await fetch('/api/evaluate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedPrompt: finalPrompt, jobId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
    } catch (err: any) {
      setEvalError(err.message || 'حدث خطأ أثناء التقييم');
      setIsEvaluating(false);
      delete activeJobs.current[jobId];
    }
  };

  const generateAppEvaluation = async () => {
    if (isAppEvaluating) return;
    setIsAppEvaluating(true);
    setAppEvalError('');
    setAppEvalContent('');
    const jobId = `eval_self_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    activeJobs.current[jobId] = { type: 'app_eval' };
    
    try {
      const res = await fetch('/api/evaluate-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
    } catch (err: any) {
      setAppEvalError(err.message || 'حدث خطأ أثناء التقييم');
      setIsAppEvaluating(false);
      delete activeJobs.current[jobId];
    }
  };

  const startProduction = async () => {
    if (!idea.trim()) return;
    
    setIsProcessing(true);
    setCurrentStage(0);
    setErrorText('');
    setFinalPrompt('');
    setCopied(false);
    setActiveTab('edit');
    setMockupHtml('');
    setMockupError('');
    setEvalContent('');
    setEvalError('');
    setAppEvalContent('');
    setAppEvalError('');
    setActivityLogs([]);
    setMetrics({ security: 0, performance: 0, accessibility: 0, completeness: 0 });

    const waitForJob = (jobId: string) => {
      return new Promise((resolve, reject) => {
        const socket = (window as any).ioSocket;
        if (!socket) return resolve(null);
        
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
        const cleanup = () => {
          socket.off('job_complete', onComplete);
          socket.off('job_error', onError);
        };
        socket.on('job_complete', onComplete);
        socket.on('job_error', onError);
      });
    };

    const runStages = async () => {
      setStageArtifacts({});
      for (let i = 0; i < workflowStages.length; i++) {
        setCurrentStage(i);
        const stage = workflowStages[i];
        
        const timestamp = new Date().toLocaleTimeString('ar-SA', { hour12: false });
        setActivityLogs(prev => [...prev, `[${timestamp}] جاري تشغيل وكيل الذكاء الاصطناعي لمرحلة: ${stage.title}...`]);
        
        if (stageRefs.current[i]) {
          stageRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        try {
          const jobId = `stage_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          activeJobs.current[jobId] = { type: 'stage', index: i };
          
          const res = await fetch('/api/execute-stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idea, stage, jobId })
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to execute stage');
          
          await waitForJob(jobId);
        } catch (e: any) {
          setActivityLogs(prev => [...prev, `[${new Date().toLocaleTimeString('ar-SA', { hour12: false })}] خطأ في مرحلة ${stage.title}: ${e.message}`]);
        }

        setMetrics({
          completeness: Math.floor(((i + 1) / workflowStages.length) * 100),
          security: Math.min(100, Math.floor(((i + 1) / 10) * 100)),
          performance: Math.min(100, Math.floor(((i + 1) / 15) * 100)),
          accessibility: Math.min(100, Math.floor(((i + 1) / 12) * 100)),
        });
      }
      setCurrentStage(workflowStages.length);
    };

    const runApi = async () => {
      const jobId = `prompt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      activeJobs.current[jobId] = { type: 'prompt' };
      try {
        const res = await fetch('/api/generate-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea, workflowStages, jobId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        
        await waitForJob(jobId);
      } catch (e: any) {
        setFinalPrompt(`Error connecting to the server: ${e.message}`);
        delete activeJobs.current[jobId];
      }
    };

    await Promise.all([runStages(), runApi()]);
    setIsProcessing(false);

    setTimeout(() => {
      outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  };

  const copyPrompt = () => {
    if (activeTab === 'eval') {
      navigator.clipboard.writeText(evalContent);
    } else {
      navigator.clipboard.writeText(finalPrompt);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden selection:bg-indigo-500/30" dir="rtl">
      
      {/* Sidebar Navigation */}
      <aside className={`fixed md:static inset-y-0 right-0 z-50 w-64 bg-[#0a0a0a] border-l border-white/5 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Nexus<span className="text-zinc-500 font-light">SaaS</span></span>
          </div>
          <button className="md:hidden text-zinc-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3">الوحدات الأساسية</div>
          <button 
            onClick={() => { setMainMode('orchestrator'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              mainMode === 'orchestrator' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <Play size={16} /> منسق المهام
          </button>
          
          <button 
            onClick={() => { setMainMode('workflow_editor'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              mainMode === 'workflow_editor' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <LayoutTemplate size={16} /> محرر مسار العمل
          </button>

          <button 
            onClick={() => { setMainMode('app_evaluator'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              mainMode === 'app_evaluator' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <Shield size={16} /> مدقق النظام
          </button>
        </div>

        <div className="p-4 border-t border-white/5">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all">
            <Settings size={16} /> الإعدادات
          </button>
          <div className="mt-4 flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 rounded-lg transition-colors">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
              <User size={14} className="text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">أحمد م.</div>
              <div className="text-xs text-zinc-500 truncate">مهندس رئيسي</div>
            </div>
            <ChevronDown size={14} className="text-zinc-500" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-black">
        
        {/* Top Navbar */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-black/40 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-zinc-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="hidden md:flex items-center gap-2 text-sm text-zinc-400">
              <span className="hover:text-zinc-200 cursor-pointer transition-colors">مساحة العمل</span>
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-200 font-medium">
                {mainMode === 'orchestrator' ? 'منسق المهام' : mainMode === 'workflow_editor' ? 'محرر مسار العمل' : 'مدقق النظام'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" placeholder="بحث..." className="bg-zinc-900 border border-zinc-800 rounded-md py-1.5 pr-9 pl-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 w-48 transition-all" />
            </div>
            <button className="relative text-zinc-400 hover:text-white transition-colors">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-black"></span>
            </button>
            <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm">
              <Plus size={16} /> مشروع جديد
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          {/* subtle background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="max-w-7xl mx-auto relative z-10">
            
            {/* Header Section for current mode */}
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
                {mainMode === 'orchestrator' ? 'تنسيق مهام الذكاء الاصطناعي' : mainMode === 'workflow_editor' ? 'محرر مسار العمل الرسومي' : 'التدقيق الذاتي للمنظومة'}
              </h1>
              <p className="text-zinc-400 text-sm">
                {mainMode === 'orchestrator' 
                  ? 'قم بإدارة وتنفيذ دورة حياة تطوير البرمجيات بالكامل باستخدام وكلاء ذكاء اصطناعي متخصصين.'
                  : mainMode === 'workflow_editor'
                    ? 'قم بتصميم الاعتماديات وتدفق البيانات بين وكلاء الذكاء الاصطناعي بشكل مرئي (DAG).'
                    : 'تحليل المنظومة المعمارية الحالية واقتراح تحسينات للارتقاء بها لمستوى المؤسسات.'}
              </p>
            </div>

            {mainMode === 'orchestrator' && (
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
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">نماذج سريعة (Templates):</span>
                        <button onClick={shuffleSuggestions} disabled={isProcessing} className="text-zinc-500 hover:text-indigo-400 transition-colors" title="تحديث النماذج">
                          <RefreshCw size={12} className={isProcessing ? "animate-spin" : ""} />
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

                    <button
                      onClick={startProduction}
                      disabled={isProcessing}
                      className={`w-full py-3.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 ${
                        errorText 
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                          : isProcessing
                            ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:shadow-[0_0_25px_rgba(79,70,229,0.4)]'
                      }`}
                    >
                      {errorText || (isProcessing ? 'جاري التنفيذ...' : finalPrompt ? 'إعادة التنفيذ' : 'بدء مسار العمل')}
                      {!isProcessing && !errorText && (
                        finalPrompt ? <RefreshCw size={16} /> : <Play size={16} fill="currentColor" />
                      )}
                    </button>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <MetricBox label="التقدم" value={metrics.completeness} icon={Check} isProcessing={isProcessing} />
                    <MetricBox label="الأمان" value={metrics.security} icon={ShieldCheck} isProcessing={isProcessing} />
                    <MetricBox label="الأداء" value={metrics.performance} icon={Zap} isProcessing={isProcessing} />
                    <MetricBox label="الوصول" value={metrics.accessibility} icon={Eye} isProcessing={isProcessing} />
                  </div>

                  {/* Activity Log */}
                  <div className="bg-[#0f0f0f] border border-white/10 p-5 rounded-2xl flex-1 flex flex-col min-h-[250px] shadow-sm">
                     <label className="text-xs text-zinc-400 uppercase tracking-widest font-semibold flex items-center gap-2 mb-4">
                       <Activity size={14} className="text-zinc-500" />
                       سجل النظام (System Logs)
                     </label>
                     <div className="flex-1 overflow-y-auto bg-[#050505] rounded-xl p-4 border border-white/5 font-mono text-xs flex flex-col gap-3 custom-scrollbar">
                        {activityLogs.length === 0 && !isProcessing && (
                          <div className="text-zinc-600 text-center m-auto flex flex-col items-center gap-2">
                            <Terminal size={20} className="opacity-50"/>
                            <span>النظام في وضع الاستعداد...</span>
                          </div>
                        )}
                        {activityLogs.map((log, i) => {
                          const isWarning = log.includes('⚠️');
                          const isError = log.includes('🚨');
                          const isSuccess = log.includes('✅') || log.includes('🚀');
                          return (
                            <div key={i} className={`flex gap-3 items-start animate-[fadeIn_0.3s_ease-out_forwards] ${isWarning ? 'text-amber-400/90' : isError ? 'text-rose-400/90' : isSuccess ? 'text-emerald-400/90' : 'text-zinc-400'}`}>
                              <span className="text-zinc-500 shrink-0 mt-0.5">›</span>
                              <span className="leading-relaxed">{log}</span>
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
                         
                         let containerStyle = "bg-[#050505] border-white/5 text-zinc-500";
                         if (isActive) containerStyle = "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/20";
                         else if (isCompleted) containerStyle = "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10 hover:border-white/20";

                         return (
                            <div 
                              key={index}
                              ref={(el) => { if (el) stageRefs.current[index] = el; }} 
                              className={`border p-4 rounded-xl flex flex-col relative transition-all duration-300 cursor-pointer group ${containerStyle}`}
                              onClick={() => {
                                if (isCompleted && stageArtifacts[index]) {
                                  setSelectedArtifact({ title: stage.title, content: stageArtifacts[index] });
                                }
                              }}
                            >
                              <div className="flex justify-between items-start mb-3">
                                <span className={`text-xs font-mono font-bold ${isActive ? 'text-indigo-400' : 'opacity-50'}`}>
                                  {(index + 1).toString().padStart(2, '0')}
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
                              
                              <h4 className={`text-sm font-semibold mb-3 ${isActive ? 'text-white' : ''}`}>{stage.title}</h4>
                              
                              <div className={`mt-auto flex items-center gap-2 text-xs ${isActive ? 'opacity-90' : 'opacity-60'}`}>
                                <FileCode size={12} />
                                <span className="font-mono truncate">{stage.artifact}</span>
                              </div>
                            </div>
                         )
                       })}
                    </div>
                  </div>
                  
                  {/* Results Viewer */}
                  <div
                    ref={outputRef}
                    className={`transition-all duration-500 ease-in-out ${
                      finalPrompt ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 hidden'
                    }`}
                  >
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                      
                      {/* Tabs Header */}
                      <div className="bg-black/50 border-b border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                           <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                           <h2 className="text-lg font-medium text-white">المخرجات المجمعة</h2>
                        </div>
                        
                        <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
                          <button
                            onClick={() => setActiveTab('edit')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all font-medium ${activeTab === 'edit' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            <Code2 size={14} /> كود المصدر
                          </button>
                          <button
                            onClick={() => setActiveTab('markdown')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all font-medium ${activeTab === 'markdown' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            <FileCode size={14} /> التقرير
                          </button>
                          <button
                            onClick={() => { setActiveTab('app'); generateMockup(); }}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all font-medium ${activeTab === 'app' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                          >
                            <LayoutTemplate size={14} /> معاينة حية
                          </button>
                        </div>
                      </div>
                      
                      {/* Content Area */}
                      <div className="relative">
                        {activeTab === 'edit' && (
                          <div className="relative group">
                            <textarea
                              value={finalPrompt}
                              onChange={(e) => setFinalPrompt(e.target.value)}
                              dir="ltr"
                              className="w-full h-[600px] p-6 font-mono text-sm text-zinc-300 bg-[#050505] resize-y focus:outline-none focus:bg-white/[0.02] text-left leading-relaxed custom-scrollbar"
                              spellCheck="false"
                            />
                            <button onClick={copyPrompt} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-lg backdrop-blur text-white opacity-0 group-hover:opacity-100 transition-all border border-white/10">
                              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                            </button>
                          </div>
                        )}
                        
                        {activeTab === 'markdown' && (
                          <div className="w-full h-[600px] p-8 overflow-y-auto bg-[#050505] custom-scrollbar">
                            <div className="prose prose-invert prose-zinc max-w-none prose-headings:font-semibold prose-pre:bg-[#111] prose-pre:border prose-pre:border-white/5" dir="rtl">
                              <Markdown>{finalPrompt}</Markdown>
                            </div>
                          </div>
                        )}
                        
                        {activeTab === 'app' && (
                          <div className="w-full h-[700px] bg-white relative rounded-b-2xl overflow-hidden">
                            {isGeneratingMockup || (mockupSimTimeLeft > 0 && !mockupError) ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] text-white p-6 z-10">
                                <div className="animate-spin rounded-full h-12 w-12 border-2 border-white/10 border-t-indigo-500 mb-6"></div>
                                <h3 className="font-medium text-lg text-zinc-100 mb-2">جاري تهيئة بيئة الاختبار المعزولة...</h3>
                                <p className="text-zinc-400 text-sm mb-8 text-center max-w-sm">يتم الآن نشر الكود على بنية تحتية مؤقتة للمعاينة الحية.</p>
                                
                                <div className="w-full max-w-md bg-black rounded-xl p-5 border border-white/10 text-left font-mono shadow-2xl" dir="ltr">
                                  <div className="flex justify-between text-xs text-zinc-500 mb-4 pb-2 border-b border-white/5">
                                    <span>Deployment Progress</span>
                                    <span>00:{mockupSimTimeLeft.toString().padStart(2, '0')}</span>
                                  </div>
                                  <div className="flex flex-col gap-2 h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                                    {mockupSimFiles.map((file, i) => (
                                      <div key={i} className="flex justify-between items-center text-xs text-zinc-400">
                                        <span className="flex items-center gap-2"><Check size={12} className="text-emerald-500"/> {file}</span>
                                        <span className="text-emerald-500/70">Done</span>
                                      </div>
                                    ))}
                                    {mockupSimTimeLeft > 0 && mockupSimFiles.length < MOCKUP_FILES.length && (
                                      <div className="flex justify-between items-center text-xs text-zinc-300">
                                        <span className="flex items-center gap-2"><Terminal size={12} className="animate-pulse text-indigo-400"/> {MOCKUP_FILES[mockupSimFiles.length]}</span>
                                        <FileProgressIndicator key={mockupSimFiles.length} />
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
                                <p className="font-medium text-lg text-white mb-2">فشل نشر بيئة الاختبار</p>
                                <p className="text-sm text-rose-400/80 max-w-md mb-6">{mockupError}</p>
                                <button onClick={generateMockup} className="px-6 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-lg text-sm font-medium transition-colors">
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

            {mainMode === 'workflow_editor' && (
              <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                <WorkflowEditor />
                
                <div className="bg-[#0f0f0f] border border-white/10 p-6 rounded-2xl shadow-xl">
                  <h3 className="text-lg font-medium text-white mb-4">خصائص العقدة (Node Configuration)</h3>
                  <div className="text-sm text-zinc-400 flex items-center gap-2 bg-black/40 p-4 rounded-xl border border-white/5">
                    <Terminal size={16} className="text-zinc-500" />
                    انقر على أي عقدة في المحرر الرسومي بالأعلى لتخصيص وكيل الذكاء الاصطناعي الخاص بها (Prompt Template, Output Schema, LLM Model).
                  </div>
                </div>
              </div>
            )}

            {mainMode === 'app_evaluator' && (
              <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
                <div className="bg-[#0f0f0f] border border-white/10 p-10 rounded-2xl shadow-xl text-center relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>
                  
                  <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20 shadow-inner">
                    <Shield size={36} className="text-indigo-400" />
                  </div>
                  <h2 className="text-3xl font-semibold text-white mb-4">التدقيق المعماري للنظام</h2>
                  <p className="text-zinc-400 text-sm max-w-xl mx-auto mb-10 leading-relaxed">
                    يقوم هذا المحرك بتحليل الكود المصدري للتطبيق الحالي بدقة للتأكد من توافقه مع معايير بناء تطبيقات المؤسسات (Enterprise Architecture)، شاملاً الأمان، الأداء، وهيكلة قاعدة البيانات.
                  </p>
                  
                  <button
                    onClick={generateAppEvaluation}
                    disabled={isAppEvaluating}
                    className={`px-8 py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 mx-auto ${
                      isAppEvaluating 
                        ? 'bg-zinc-800 text-zinc-500 cursor-wait' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]'
                    }`}
                  >
                    {isAppEvaluating ? (
                      <><RefreshCw size={18} className="animate-spin" /> جاري تحليل النظام (Scanning...)</>
                    ) : (
                      <><Play size={18} fill="currentColor" /> بدء التدقيق الشامل</>
                    )}
                  </button>
                  
                  {appEvalError && (
                    <div className="mt-6 bg-rose-500/10 text-rose-400 p-4 rounded-xl text-sm border border-rose-500/20 text-right" dir="ltr">
                      {appEvalError}
                    </div>
                  )}
                </div>

                {appEvalContent && (
                  <div className="mt-8 bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-black/60 border-b border-white/5 p-4 flex items-center justify-between">
                      <h3 className="font-medium text-white flex items-center gap-2">
                        <FileCode size={16} className="text-indigo-400" />
                        التقرير المعماري النهائي
                      </h3>
                      <button onClick={() => {
                        navigator.clipboard.writeText(appEvalContent);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }} className="text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg border border-white/5">
                        {copied ? <Check size={16} className="text-emerald-400"/> : <Copy size={16} />}
                      </button>
                    </div>
                    <div className="p-8 prose prose-invert prose-zinc max-w-none text-right prose-pre:bg-black prose-pre:border prose-pre:border-white/10 prose-headings:font-semibold custom-scrollbar" dir="rtl">
                      <Markdown>{appEvalContent}</Markdown>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

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
            <div className="p-6 overflow-y-auto flex-1 bg-black custom-scrollbar" dir="ltr">
               <pre className="text-sm font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">{selectedArtifact.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
