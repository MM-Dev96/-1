import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  JobSnapshot,
  ProjectRecord,
  WorkflowEdge,
  WorkflowNodeDefinition,
  WorkflowProfile,
} from './shared/contracts.ts';
import {
  DEFAULT_WORKFLOW_EDGES,
  DEFAULT_WORKFLOW_NODES,
} from './shared/defaultWorkflow.ts';

export type MainMode =
  | 'orchestrator'
  | 'workflow'
  | 'repository'
  | 'evaluation'
  | 'preview'
  | 'settings';
export type ConnectionState = 'connecting' | 'connected' | 'offline';
export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  key: string;
  message: string;
  tone: ToastTone;
  createdAt: number;
}

interface AppState {
  mode: MainMode;
  sidebarOpen: boolean;
  idea: string;
  profile: WorkflowProfile;
  model: string;
  apiKeys: string[];
  reducedMotion: boolean;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdge[];
  currentProjectId: string | null;
  activeJobId: string | null;
  jobSnapshot: JobSnapshot | null;
  connection: ConnectionState;
  toasts: ToastMessage[];
  runRequest: number;
  setMode: (mode: MainMode) => void;
  setSidebarOpen: (open: boolean) => void;
  setIdea: (idea: string) => void;
  setProfile: (profile: WorkflowProfile) => void;
  setModel: (model: string) => void;
  setApiKeys: (keys: string[]) => void;
  setReducedMotion: (reduced: boolean) => void;
  setWorkflow: (
    nodes: WorkflowNodeDefinition[],
    edges: WorkflowEdge[],
  ) => void;
  resetWorkflow: () => void;
  setCurrentProjectId: (id: string | null) => void;
  setActiveJobId: (id: string | null) => void;
  setJobSnapshot: (snapshot: JobSnapshot | null) => void;
  setConnection: (connection: ConnectionState) => void;
  pushToast: (key: string, message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
  requestRun: () => void;
  loadProject: (project: ProjectRecord) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'orchestrator',
      sidebarOpen: false,
      idea: '',
      profile: 'balanced',
      model: 'gemini-2.5-flash',
      apiKeys: [],
      reducedMotion: false,
      nodes: structuredClone(DEFAULT_WORKFLOW_NODES),
      edges: structuredClone(DEFAULT_WORKFLOW_EDGES),
      currentProjectId: null,
      activeJobId: null,
      jobSnapshot: null,
      connection: 'connecting',
      toasts: [],
      runRequest: 0,
      setMode: (mode) => set({ mode, sidebarOpen: false }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setIdea: (idea) => set({ idea }),
      setProfile: (profile) => set({ profile }),
      setModel: (model) => set({ model }),
      setApiKeys: (apiKeys) => set({ apiKeys }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setWorkflow: (nodes, edges) =>
        set({
          nodes: structuredClone(nodes),
          edges: structuredClone(edges),
        }),
      resetWorkflow: () =>
        set({
          nodes: structuredClone(DEFAULT_WORKFLOW_NODES),
          edges: structuredClone(DEFAULT_WORKFLOW_EDGES),
        }),
      setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
      setActiveJobId: (activeJobId) => set({ activeJobId }),
      setJobSnapshot: (jobSnapshot) => set({ jobSnapshot }),
      setConnection: (connection) => set({ connection }),
      pushToast: (key, message, tone = 'info') =>
        set((state) => {
          const duplicate = state.toasts.some(
            (toast) =>
              toast.key === key && Date.now() - toast.createdAt < 4_000,
          );
          if (duplicate) return state;
          const next: ToastMessage = {
            id: crypto.randomUUID(),
            key,
            message,
            tone,
            createdAt: Date.now(),
          };
          return { toasts: [next, ...state.toasts].slice(0, 3) };
        }),
      dismissToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        })),
      requestRun: () => set({ runRequest: Date.now(), mode: 'orchestrator' }),
      loadProject: (project) =>
        set({
          currentProjectId: project.id,
          idea: project.idea,
          profile: project.profile,
          model: project.model,
          nodes: structuredClone(project.nodes),
          edges: structuredClone(project.edges),
          jobSnapshot: project.lastJob ? structuredClone(project.lastJob) : null,
          activeJobId:
            project.lastJob &&
            ['QUEUED', 'RUNNING'].includes(project.lastJob.status)
              ? project.lastJob.id
              : null,
          mode: 'orchestrator',
        }),
    }),
    {
      name: 'nexus-ui',
      version: 2,
      partialize: (state) => ({
        idea: state.idea,
        profile: state.profile,
        model: state.model,
        apiKeys: state.apiKeys,
        reducedMotion: state.reducedMotion,
        nodes: state.nodes,
        edges: state.edges,
        currentProjectId: state.currentProjectId,
        activeJobId: state.activeJobId,
      }),
    },
  ),
);
