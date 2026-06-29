import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Stage {
  title: string;
  desc: string;
  artifact: string;
}

const DEFAULT_STAGES: Stage[] = [
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

export type MainMode = 'orchestrator' | 'app_evaluator' | 'workflow_editor' | 'repository' | 'settings';
export type Tab = 'edit' | 'markdown' | 'app' | 'eval';

export interface Project {
  id: string;
  name: string;
  idea: string;
  status: 'مكتمل' | 'غير مكتمل';
  currentStage: number;
  stageArtifacts: Record<number, string>;
  activityLogs: any[];
  finalPrompt: string;
  mockupHtml: string;
  createdAt: number;
}

interface AppState {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  idea: string;
  setIdea: (idea: string) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  currentStage: number;
  setCurrentStage: (stage: number) => void;
  finalPrompt: string;
  setFinalPrompt: (promptOrFn: string | ((prev: string) => string)) => void;
  errorText: string;
  setErrorText: (errorText: string) => void;
  copied: boolean;
  setCopied: (copied: boolean) => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  
  mockupHtml: string;
  setMockupHtml: (html: string) => void;
  isGeneratingMockup: boolean;
  setIsGeneratingMockup: (isGenerating: boolean) => void;
  mockupError: string;
  setMockupError: (error: string) => void;
  mockupSimTimeLeft: number;
  setMockupSimTimeLeft: (timeOrFn: number | ((prev: number) => number)) => void;
  mockupSimFiles: string[];
  setMockupSimFiles: (filesOrFn: string[] | ((prev: string[]) => string[])) => void;
  mockupApiFinished: boolean;
  setMockupApiFinished: (finished: boolean) => void;
  
  evalContent: string;
  setEvalContent: (contentOrFn: string | ((prev: string) => string)) => void;
  isEvaluating: boolean;
  setIsEvaluating: (isEvaluating: boolean) => void;
  evalError: string;
  setEvalError: (error: string) => void;
  
  appEvalContent: string;
  setAppEvalContent: (contentOrFn: string | ((prev: string) => string)) => void;
  isAppEvaluating: boolean;
  setIsAppEvaluating: (isAppEvaluating: boolean) => void;
  appEvalError: string;
  setAppEvalError: (error: string) => void;

  mainMode: MainMode;
  setMainMode: (mode: MainMode) => void;

  workflowStages: Stage[];
  setWorkflowStages: (stages: Stage[]) => void;
  addStage: () => void;
  updateStage: (index: number, field: keyof Stage, value: string) => void;
  removeStage: (index: number) => void;

  activityLogs: any[];
  setActivityLogs: (logsOrFn: any[] | ((prev: any[]) => any[])) => void;
  
  stageArtifacts: Record<number, string>;
  setStageArtifacts: (artifactsOrFn: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
  
  selectedArtifact: { title: string; content: string } | null;
  setSelectedArtifact: (artifact: { title: string; content: string } | null) => void;
  
  metrics: { security: number; performance: number; accessibility: number; completeness: number };
  setMetrics: (metrics: { security: number; performance: number; accessibility: number; completeness: number }) => void;

  projects: Project[];
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;

  notifications: Array<{ id: string; message: string; read: boolean; timestamp: number }>;
  addNotification: (message: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  customApiKeys: string[];
  setCustomApiKeys: (keys: string[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
  customApiKeys: [],
  setCustomApiKeys: (customApiKeys) => set({ customApiKeys }),
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  idea: '',
  setIdea: (idea) => set({ idea }),
  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  currentStage: -1,
  setCurrentStage: (currentStage) => set({ currentStage }),
  finalPrompt: '',
  setFinalPrompt: (promptOrFn) => set((state) => ({ finalPrompt: typeof promptOrFn === 'function' ? promptOrFn(state.finalPrompt) : promptOrFn })),
  errorText: '',
  setErrorText: (errorText) => set({ errorText }),
  copied: false,
  setCopied: (copied) => set({ copied }),
  activeTab: 'edit',
  setActiveTab: (activeTab) => set({ activeTab }),

  mockupHtml: '',
  setMockupHtml: (mockupHtml) => set({ mockupHtml }),
  isGeneratingMockup: false,
  setIsGeneratingMockup: (isGeneratingMockup) => set({ isGeneratingMockup }),
  mockupError: '',
  setMockupError: (mockupError) => set({ mockupError }),
  mockupSimTimeLeft: 0,
  setMockupSimTimeLeft: (timeOrFn) => set((state) => ({ mockupSimTimeLeft: typeof timeOrFn === 'function' ? timeOrFn(state.mockupSimTimeLeft) : timeOrFn })),
  mockupSimFiles: [],
  setMockupSimFiles: (filesOrFn) => set((state) => ({ mockupSimFiles: typeof filesOrFn === 'function' ? filesOrFn(state.mockupSimFiles) : filesOrFn })),
  mockupApiFinished: false,
  setMockupApiFinished: (mockupApiFinished) => set({ mockupApiFinished }),

  evalContent: '',
  setEvalContent: (contentOrFn) => set((state) => ({ evalContent: typeof contentOrFn === 'function' ? contentOrFn(state.evalContent) : contentOrFn })),
  isEvaluating: false,
  setIsEvaluating: (isEvaluating) => set({ isEvaluating }),
  evalError: '',
  setEvalError: (evalError) => set({ evalError }),

  appEvalContent: '',
  setAppEvalContent: (contentOrFn) => set((state) => ({ appEvalContent: typeof contentOrFn === 'function' ? contentOrFn(state.appEvalContent) : contentOrFn })),
  isAppEvaluating: false,
  setIsAppEvaluating: (isAppEvaluating) => set({ isAppEvaluating }),
  appEvalError: '',
  setAppEvalError: (appEvalError) => set({ appEvalError }),

  mainMode: 'orchestrator',
  setMainMode: (mainMode) => set({ mainMode }),

  workflowStages: DEFAULT_STAGES,
  setWorkflowStages: (workflowStages) => set({ workflowStages }),
  addStage: () => set((state) => ({
    workflowStages: [...state.workflowStages, { title: 'مرحلة جديدة (New Role)', desc: 'وصف المهمة المطلوبة', artifact: 'output.md' }]
  })),
  updateStage: (index, field, value) => set((state) => {
    const newStages = [...state.workflowStages];
    newStages[index] = { ...newStages[index], [field]: value };
    return { workflowStages: newStages };
  }),
  removeStage: (index) => set((state) => {
    if (state.workflowStages.length <= 1) return state;
    const newStages = [...state.workflowStages];
    newStages.splice(index, 1);
    return { workflowStages: newStages };
  }),

  activityLogs: [],
  setActivityLogs: (logsOrFn) => set((state) => ({ activityLogs: typeof logsOrFn === 'function' ? logsOrFn(state.activityLogs) : logsOrFn })),

  stageArtifacts: {},
  setStageArtifacts: (artifactsOrFn) => set((state) => ({ stageArtifacts: typeof artifactsOrFn === 'function' ? artifactsOrFn(state.stageArtifacts) : artifactsOrFn })),

  selectedArtifact: null,
  setSelectedArtifact: (selectedArtifact) => set({ selectedArtifact }),

  metrics: { security: 0, performance: 0, accessibility: 0, completeness: 0 },
  setMetrics: (metrics) => set({ metrics }),

  projects: [],
  addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
  removeProject: (id) => set((state) => ({ projects: state.projects.filter(p => p.id !== id) })),
  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p)
  })),

  notifications: [],
  addNotification: (message) => set((state) => ({
    notifications: [{ id: Date.now().toString(), message, read: false, timestamp: Date.now() }, ...state.notifications]
  })),
  markNotificationRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
  })),
  clearNotifications: () => set({ notifications: [] })
}),
{
  name: 'app-store',
  partialize: (state) => ({ projects: state.projects, currentProjectId: state.currentProjectId, notifications: state.notifications, customApiKeys: state.customApiKeys })
}
));
