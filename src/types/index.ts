export type StageStatus = 'PENDING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

export interface WorkflowNode {
  id: string;
  label: string;
  desc: string;
  artifact: string;
  status?: StageStatus;
  result?: string;
  error?: string;
  startTime?: number;
  errorDetails?: unknown;
  timeoutReason?: string;
  maxRetries?: number;
  retryCount?: number;
  model?: string;
  dependencies?: string[]; // Array of node ids this node depends on
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}
