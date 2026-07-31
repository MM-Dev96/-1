import type { JobEvent, JobSnapshot, StageRuntime } from './contracts.ts';

function updateStage(
  snapshot: JobSnapshot,
  stageId: string,
  updater: (stage: StageRuntime) => StageRuntime,
): JobSnapshot {
  return {
    ...snapshot,
    stages: snapshot.stages.map((stage) =>
      stage.id === stageId ? updater(stage) : stage,
    ),
  };
}

export function reduceJobEvent(
  current: JobSnapshot | null,
  event: JobEvent,
): JobSnapshot | null {
  if (event.event === 'job:created') return event.payload.snapshot;
  if (event.event === 'job:completed') return event.payload.snapshot;
  if (event.event === 'job:failed') return event.payload.snapshot;
  if (event.event === 'job:canceled') return event.payload.snapshot;
  if (!current || current.id !== event.jobId || event.sequence <= current.sequence) {
    return current;
  }

  const base = { ...current, sequence: event.sequence, updatedAt: event.timestamp };
  if (event.event === 'job:status') {
    return {
      ...base,
      status: event.payload.status,
      ...(event.payload.error ? { error: event.payload.error } : {}),
    };
  }
  if (event.event === 'stage:chunk') {
    return updateStage(base, event.payload.stageId, (stage) => ({
      ...stage,
      output: stage.output + event.payload.chunk,
    }));
  }
  if (event.event === 'stage:status') {
    return updateStage(base, event.payload.stageId, (stage) => ({
      ...stage,
      status: event.payload.status,
      attempt: event.payload.attempt,
      ...(event.payload.error ? { error: event.payload.error } : {}),
      ...(event.payload.startedAt ? { startedAt: event.payload.startedAt } : {}),
      ...(event.payload.completedAt
        ? { completedAt: event.payload.completedAt }
        : {}),
      ...(event.payload.durationMs ? { durationMs: event.payload.durationMs } : {}),
    }));
  }
  if (event.event === 'job:metrics') {
    return {
      ...base,
      metrics: event.payload.metrics,
      progress: event.payload.progress,
    };
  }
  return base;
}
