export type WorkflowProfile = 'quick' | 'balanced' | 'full';
export type JobKind =
  | 'orchestration'
  | 'evaluation'
  | 'self-audit'
  | 'mockup'
  | 'idea-improver';
export type JobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED';
export type StageStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED'
  | 'SKIPPED'
  | 'CANCELED';
export type StageKind = 'analysis' | 'implementation' | 'quality' | 'final';

export interface Point {
  x: number;
  y: number;
}

export interface WorkflowNodeDefinition {
  id: string;
  label: string;
  description: string;
  artifact: string;
  kind: StageKind;
  optional: boolean;
  enabled: boolean;
  maxRetries: number;
  model?: string;
  position: Point;
  profiles?: WorkflowProfile[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface StageRuntime extends WorkflowNodeDefinition {
  status: StageStatus;
  attempt: number;
  output: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export interface JobMetrics {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  contextCharacters: number;
}

export interface JobSnapshot {
  id: string;
  projectId: string;
  kind: JobKind;
  status: JobStatus;
  idea: string;
  profile: WorkflowProfile;
  model: string;
  stages: StageRuntime[];
  edges: WorkflowEdge[];
  progress: number;
  sequence: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  finalOutput?: string;
  error?: string;
  metrics: JobMetrics;
}

export const JOB_EVENT_CHANNEL = 'job:event' as const;
export const JOB_SUBSCRIBE_CHANNEL = 'job:subscribe' as const;
export const JOB_SNAPSHOT_CHANNEL = 'job:snapshot' as const;

export type JobEventName =
  | 'job:created'
  | 'job:status'
  | 'job:completed'
  | 'job:failed'
  | 'job:canceled'
  | 'stage:status'
  | 'stage:chunk'
  | 'stage:retry'
  | 'job:metrics';

export interface JobEventPayloadMap {
  'job:created': { snapshot: JobSnapshot };
  'job:status': { status: JobStatus; error?: string };
  'job:completed': { snapshot: JobSnapshot };
  'job:failed': { snapshot: JobSnapshot };
  'job:canceled': { snapshot: JobSnapshot };
  'stage:status': {
    stageId: string;
    status: StageStatus;
    attempt: number;
    error?: string;
    startedAt?: number;
    completedAt?: number;
    durationMs?: number;
  };
  'stage:chunk': { stageId: string; chunk: string };
  'stage:retry': { stageId: string; attempt: number; message: string };
  'job:metrics': { metrics: JobMetrics; progress: number };
}

export type JobEvent<T extends JobEventName = JobEventName> = {
  [K in T]: {
    id: string;
    event: K;
    jobId: string;
    projectId: string;
    sequence: number;
    timestamp: number;
    payload: JobEventPayloadMap[K];
  };
}[T];

export interface StartWorkflowInput {
  projectId: string;
  idea: string;
  profile: WorkflowProfile;
  model: string;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdge[];
  resume?: JobSnapshot;
}

export interface StartStandaloneInput {
  projectId: string;
  kind: Exclude<JobKind, 'orchestration'>;
  source: string;
  model: string;
  instruction?: string;
}

export interface ProjectVersion {
  id: string;
  createdAt: number;
  label: string;
  finalPrompt: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  idea: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  profile: WorkflowProfile;
  model: string;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdge[];
  artifacts: Record<string, string>;
  finalPrompt: string;
  mockupHtml: string;
  versions: ProjectVersion[];
  lastJob?: JobSnapshot;
  createdAt: number;
  updatedAt: number;
}

export interface ApiErrorBody {
  error: string;
  details?: string[];
}
