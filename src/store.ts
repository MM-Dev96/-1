import { WorkflowNode, WorkflowEdge } from './types/index.ts';
import { defaultWorkflowNodes, defaultWorkflowEdges } from './utils/workflow.ts';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';



export type MainMode = 'orchestrator' | 'app_evaluator' | 'workflow_editor' | 'repository' | 'settings' | 'live_preview';
export type Tab = 'edit' | 'markdown' | 'app' | 'eval';

export interface Project {
  id: string;
  name: string;
  idea: string;
  status: 'مكتمل' | 'غير مكتمل';
  currentStage: string | null;
  stageArtifacts: Record<string, string>;
  activityLogs: Array<string | { text: string; errorDetails?: string }>;
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
  currentStage: string | null;
  setCurrentStage: (stage: string | null) => void;
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
  appEvalRetryMessage: string;
  setAppEvalRetryMessage: (msg: string) => void;

  mainMode: MainMode;
  setMainMode: (mode: MainMode) => void;

  nodes: WorkflowNode[];
  setNodes: (nodes: WorkflowNode[]) => void;
  edges: WorkflowEdge[];
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: <K extends keyof WorkflowNode>(id: string, field: K, value: WorkflowNode[K]) => void;
  removeNode: (id: string) => void;

  activityLogs: Array<string | { text: string; errorDetails?: string }>;
  setActivityLogs: (logsOrFn: Array<string | { text: string; errorDetails?: string }> | ((prev: Array<string | { text: string; errorDetails?: string }>) => Array<string | { text: string; errorDetails?: string }>)) => void;
  
  stageArtifacts: Record<number, string>;
  setStageArtifacts: (artifactsOrFn: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  
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
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  requestQueue: any[];
  addToQueue: (req: any) => void;
  removeFromQueue: (reqId: string) => void;
  clearQueue: () => void;
  setCustomApiKeys: (keys: string[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
  customApiKeys: [],
  setCustomApiKeys: (customApiKeys) => set({ customApiKeys }),
  isConnected: false,
  setIsConnected: (isConnected) => set({ isConnected }),
  requestQueue: [],
  addToQueue: (req) => set((state) => ({ requestQueue: [...state.requestQueue, req] })),
  removeFromQueue: (reqId) => set((state) => ({ requestQueue: state.requestQueue.filter((r: any) => r.id !== reqId) })),
  clearQueue: () => set({ requestQueue: [] }),
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  idea: 'تطبيق ويب لإدارة المهام (Kanban Board) متقدم يشبه Trello. يحتوي على واجهة سحب وإفلات للبطاقات بين الأعمدة (To Do, In Progress, Done). يجب أن يكون التصميم عصرياً واحترافياً باستخدام Tailwind CSS، مع دعم للوضع الليلي، ورسوم بيانية بسيطة توضح إحصائيات المهام المنجزة.',
  setIdea: (idea) => set({ idea }),
  isProcessing: false,
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  currentStage: null,
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
  appEvalRetryMessage: '',
  setAppEvalRetryMessage: (appEvalRetryMessage) => set({ appEvalRetryMessage }),

  mainMode: 'orchestrator',
  setMainMode: (mainMode) => set({ mainMode }),

  nodes: defaultWorkflowNodes,
  edges: defaultWorkflowEdges,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  updateNode: (id: string, field: any, value: any) => set((state) => ({ nodes: state.nodes.map(n => n.id === id ? { ...n, [field]: value } : n) })),
  removeNode: (id) => set((state) => ({ nodes: state.nodes.filter(n => n.id !== id), edges: state.edges.filter(e => e.source !== id && e.target !== id) })),

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
