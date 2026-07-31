import { randomUUID } from 'node:crypto';
import type {
  JobEvent,
  JobEventName,
  JobEventPayloadMap,
  JobKind,
  JobSnapshot,
  StageRuntime,
  StartStandaloneInput,
  StartWorkflowInput,
  WorkflowNodeDefinition,
} from '../shared/contracts.ts';
import {
  blockingDagIssues,
  buildDagMaps,
  descendantsOf,
  validateDag,
  type DagIssue,
} from '../shared/dag.ts';
import {
  PROFILE_META,
  workflowForProfile,
} from '../shared/defaultWorkflow.ts';
import type { AIProvider } from './ai/provider.ts';
import { isAbortError, userFacingProviderError } from './ai/provider.ts';
import {
  cleanStandaloneOutput,
  stagePrompt,
  standalonePrompt,
  validateModelOutput,
} from './ai/prompts.ts';

export class DagValidationError extends Error {
  constructor(readonly issues: DagIssue[]) {
    super(issues.map((issue) => issue.message).join('\n'));
    this.name = 'DagValidationError';
  }
}

export type JobEventSink = (room: string, event: JobEvent) => void;

interface ManagedJob {
  snapshot: JobSnapshot;
  provider: AIProvider;
  controller: AbortController;
  standalone?: { prompt: string; systemInstruction: string };
  running?: Promise<void>;
}

function now(): number {
  return Date.now();
}

function cloneSnapshot(snapshot: JobSnapshot): JobSnapshot {
  return structuredClone(snapshot);
}

function terminal(status: StageRuntime['status']): boolean {
  return [
    'COMPLETED',
    'FAILED',
    'BLOCKED',
    'SKIPPED',
    'CANCELED',
  ].includes(status);
}

function progressOf(stages: StageRuntime[]): number {
  if (stages.length === 0) return 100;
  return Math.round(
    (stages.filter((stage) => terminal(stage.status)).length / stages.length) *
      100,
  );
}

function stageFromDefinition(node: WorkflowNodeDefinition): StageRuntime {
  return {
    ...structuredClone(node),
    status: 'PENDING',
    attempt: 0,
    output: '',
  };
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export class JobManager {
  private readonly jobs = new Map<string, ManagedJob>();

  constructor(private readonly emitToRoom: JobEventSink = () => undefined) {}

  startWorkflow(input: StartWorkflowInput, provider: AIProvider): JobSnapshot {
    const graph = workflowForProfile(input.nodes, input.edges, input.profile);
    const issues = validateDag(graph.nodes, graph.edges);
    const blocking = blockingDagIssues(issues);
    if (blocking.length > 0) throw new DagValidationError(blocking);

    const stages = graph.nodes.map(stageFromDefinition);
    if (input.resume) {
      const previous = new Map(
        input.resume.stages.map((stage) => [stage.id, stage]),
      );
      for (const stage of stages) {
        const old = previous.get(stage.id);
        if (old && ['COMPLETED', 'SKIPPED'].includes(old.status) && old.output) {
          stage.status = old.status;
          stage.output = old.output;
          stage.attempt = old.attempt;
          if (old.completedAt) stage.completedAt = old.completedAt;
          if (old.durationMs) stage.durationMs = old.durationMs;
        }
      }
    }

    return this.registerJob(
      {
        id: randomUUID(),
        projectId: input.projectId,
        kind: 'orchestration',
        status: 'QUEUED',
        idea: input.idea.trim(),
        profile: input.profile,
        model: input.model,
        stages,
        edges: graph.edges,
        progress: progressOf(stages),
        sequence: 0,
        createdAt: now(),
        updatedAt: now(),
        metrics: {
          requestCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          contextCharacters: 0,
        },
      },
      provider,
    );
  }

  startStandalone(
    input: StartStandaloneInput,
    provider: AIProvider,
  ): JobSnapshot {
    const prompt = standalonePrompt(input.kind, input.source, input.instruction);
    const label: Record<Exclude<JobKind, 'orchestration'>, string> = {
      evaluation: 'تقييم البرومبت',
      'self-audit': 'التدقيق الذاتي',
      mockup: 'النموذج التفاعلي',
      'idea-improver': 'تحسين الفكرة',
    };
    const node: WorkflowNodeDefinition = {
      id: input.kind,
      label: label[input.kind],
      description: label[input.kind],
      artifact: input.kind === 'mockup' ? 'prototype.html' : `${input.kind}.md`,
      kind: 'final',
      optional: false,
      enabled: true,
      maxRetries: 1,
      position: { x: 0, y: 0 },
    };
    const snapshot: JobSnapshot = {
      id: randomUUID(),
      projectId: input.projectId,
      kind: input.kind,
      status: 'QUEUED',
      idea: input.source,
      profile: 'quick',
      model: input.model,
      stages: [stageFromDefinition(node)],
      edges: [],
      progress: 0,
      sequence: 0,
      createdAt: now(),
      updatedAt: now(),
      metrics: {
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        contextCharacters: input.source.length,
      },
    };
    return this.registerJob(snapshot, provider, prompt);
  }

  get(jobId: string): JobSnapshot | null {
    const job = this.jobs.get(jobId);
    return job ? cloneSnapshot(job.snapshot) : null;
  }

  listActive(): JobSnapshot[] {
    return [...this.jobs.values()]
      .filter((job) => ['QUEUED', 'RUNNING'].includes(job.snapshot.status))
      .map((job) => cloneSnapshot(job.snapshot));
  }

  cancel(jobId: string): JobSnapshot | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    if (!['QUEUED', 'RUNNING'].includes(job.snapshot.status)) {
      return cloneSnapshot(job.snapshot);
    }
    job.controller.abort();
    return cloneSnapshot(job.snapshot);
  }

  retryStage(jobId: string, stageId: string): JobSnapshot | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const target = job.snapshot.stages.find((stage) => stage.id === stageId);
    if (!target) return null;
    if (job.snapshot.status === 'RUNNING') {
      throw new Error('أوقف المهمة الجارية قبل إعادة مرحلة محددة.');
    }
    const affected = descendantsOf(
      stageId,
      job.snapshot.stages,
      job.snapshot.edges,
    );
    affected.add(stageId);
    for (const stage of job.snapshot.stages) {
      if (!affected.has(stage.id)) continue;
      stage.status = 'PENDING';
      stage.attempt = 0;
      stage.output = '';
      delete stage.error;
      delete stage.startedAt;
      delete stage.completedAt;
      delete stage.durationMs;
    }
    delete job.snapshot.error;
    delete job.snapshot.completedAt;
    delete job.snapshot.finalOutput;
    job.snapshot.progress = progressOf(job.snapshot.stages);
    job.snapshot.status = 'QUEUED';
    job.snapshot.updatedAt = now();
    job.controller = new AbortController();
    this.emit(job, 'job:status', { status: 'QUEUED' });
    this.launch(job);
    return cloneSnapshot(job.snapshot);
  }

  private registerJob(
    snapshot: JobSnapshot,
    provider: AIProvider,
    standalone?: { prompt: string; systemInstruction: string },
  ): JobSnapshot {
    const job: ManagedJob = {
      snapshot,
      provider,
      controller: new AbortController(),
      ...(standalone ? { standalone } : {}),
    };
    this.jobs.set(snapshot.id, job);
    this.emit(job, 'job:created', { snapshot: cloneSnapshot(job.snapshot) });
    this.prune();
    this.launch(job);
    return cloneSnapshot(job.snapshot);
  }

  private launch(job: ManagedJob): void {
    if (job.running) return;
    job.running = this.run(job).finally(() => {
      delete job.running;
    });
  }

  private async run(job: ManagedJob): Promise<void> {
    const startedAt = now();
    job.snapshot.status = 'RUNNING';
    job.snapshot.updatedAt = now();
    this.emit(job, 'job:status', { status: 'RUNNING' });

    const concurrency =
      job.snapshot.kind === 'orchestration'
        ? PROFILE_META[job.snapshot.profile].concurrency
        : 1;
    const { parents } = buildDagMaps(job.snapshot.stages, job.snapshot.edges);
    const running = new Map<string, Promise<void>>();

    try {
      while (job.snapshot.stages.some((stage) => !terminal(stage.status))) {
        if (job.controller.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        for (const stage of job.snapshot.stages) {
          if (stage.status !== 'PENDING') continue;
          const dependencies = (parents.get(stage.id) ?? [])
            .map((id) => job.snapshot.stages.find((candidate) => candidate.id === id))
            .filter((candidate): candidate is StageRuntime => Boolean(candidate));
          if (
            dependencies.some((dependency) =>
              ['FAILED', 'BLOCKED', 'CANCELED'].includes(dependency.status),
            )
          ) {
            stage.status = 'BLOCKED';
            stage.error = 'تعذّر التشغيل لأن مرحلة إلزامية سابقة لم تكتمل.';
            stage.completedAt = now();
            this.emitStageStatus(job, stage);
            this.emitProgress(job);
          }
        }

        const ready = job.snapshot.stages.filter((stage) => {
          if (stage.status !== 'PENDING' || running.has(stage.id)) return false;
          const dependencies = (parents.get(stage.id) ?? [])
            .map((id) => job.snapshot.stages.find((candidate) => candidate.id === id))
            .filter((candidate): candidate is StageRuntime => Boolean(candidate));
          return dependencies.every((dependency) =>
            ['COMPLETED', 'SKIPPED'].includes(dependency.status),
          );
        });

        while (ready.length > 0 && running.size < concurrency) {
          const stage = ready.shift();
          if (!stage) continue;
          const promise = this.runStage(job, stage, parents.get(stage.id) ?? [])
            .catch(() => undefined)
            .finally(() => running.delete(stage.id));
          running.set(stage.id, promise);
        }

        if (running.size === 0) {
          const pending = job.snapshot.stages.filter(
            (stage) => stage.status === 'PENDING',
          );
          if (pending.length > 0) {
            for (const stage of pending) {
              stage.status = 'BLOCKED';
              stage.error = 'لا توجد طريقة صالحة للوصول إلى هذه المرحلة.';
              stage.completedAt = now();
              this.emitStageStatus(job, stage);
            }
          }
          break;
        }
        await Promise.race(running.values());
      }
      await Promise.allSettled(running.values());

      if (job.controller.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const failedMandatory = job.snapshot.stages.some(
        (stage) =>
          !stage.optional && ['FAILED', 'BLOCKED', 'CANCELED'].includes(stage.status),
      );
      if (failedMandatory) {
        throw new Error('تعذرت مرحلة إلزامية واحدة أو أكثر.');
      }

      const finalStage =
        job.snapshot.stages.find(
          (stage) => stage.kind === 'final' && stage.status === 'COMPLETED',
        ) ??
        [...job.snapshot.stages]
          .reverse()
          .find((stage) => stage.status === 'COMPLETED');
      if (finalStage) job.snapshot.finalOutput = finalStage.output;
      job.snapshot.status = 'COMPLETED';
      job.snapshot.progress = 100;
      job.snapshot.completedAt = now();
      job.snapshot.updatedAt = now();
      job.snapshot.metrics.durationMs = now() - startedAt;
      this.emit(job, 'job:completed', {
        snapshot: cloneSnapshot(job.snapshot),
      });
    } catch (error) {
      if (isAbortError(error)) {
        for (const stage of job.snapshot.stages) {
          if (stage.status === 'RUNNING' || stage.status === 'PENDING') {
            stage.status = 'CANCELED';
            stage.completedAt = now();
            this.emitStageStatus(job, stage);
          }
        }
        job.snapshot.status = 'CANCELED';
        job.snapshot.progress = progressOf(job.snapshot.stages);
        job.snapshot.completedAt = now();
        job.snapshot.updatedAt = now();
        job.snapshot.metrics.durationMs = now() - startedAt;
        this.emit(job, 'job:canceled', {
          snapshot: cloneSnapshot(job.snapshot),
        });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      job.snapshot.status = 'FAILED';
      job.snapshot.error = message;
      job.snapshot.progress = progressOf(job.snapshot.stages);
      job.snapshot.completedAt = now();
      job.snapshot.updatedAt = now();
      job.snapshot.metrics.durationMs = now() - startedAt;
      this.emit(job, 'job:failed', {
        snapshot: cloneSnapshot(job.snapshot),
      });
    }
  }

  private async runStage(
    job: ManagedJob,
    stage: StageRuntime,
    dependencyIds: string[],
  ): Promise<void> {
    const dependencies = dependencyIds
      .map((id) => job.snapshot.stages.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is StageRuntime => Boolean(candidate));
    const maxAttempts = Math.max(1, stage.maxRetries + 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      stage.attempt = attempt;
      stage.status = 'RUNNING';
      stage.output = '';
      delete stage.error;
      stage.startedAt = now();
      this.emitStageStatus(job, stage);

      const prompt = job.standalone
        ? {
            ...job.standalone,
            contextCharacters: job.snapshot.idea.length,
          }
        : stagePrompt(
            job.snapshot.idea,
            stage,
            dependencies,
            job.snapshot.profile,
          );
      const contextCharacters = prompt.contextCharacters;
      job.snapshot.metrics.requestCount += 1;
      job.snapshot.metrics.contextCharacters += contextCharacters;
      this.emitProgress(job);

      try {
        let finalUsage = { inputTokens: 0, outputTokens: 0 };
        for await (const chunk of job.provider.stream({
          taskId: stage.id,
          prompt: prompt.prompt,
          model: stage.model || job.snapshot.model,
          signal: job.controller.signal,
          systemInstruction: prompt.systemInstruction,
          temperature: stage.kind === 'final' ? 0.25 : 0.4,
          maxOutputTokens: stage.kind === 'final' ? 12_000 : 7_000,
        })) {
          if (chunk.text) {
            stage.output += chunk.text;
            this.emit(job, 'stage:chunk', {
              stageId: stage.id,
              chunk: chunk.text,
            });
          }
          if (chunk.usage) finalUsage = chunk.usage;
        }
        stage.output = cleanStandaloneOutput(job.snapshot.kind, stage.output);
        validateModelOutput(job.snapshot.kind, stage.output);
        stage.status = 'COMPLETED';
        stage.completedAt = now();
        stage.durationMs = stage.completedAt - stage.startedAt;
        job.snapshot.metrics.inputTokens += finalUsage.inputTokens;
        job.snapshot.metrics.outputTokens += finalUsage.outputTokens;
        this.emitStageStatus(job, stage);
        this.emitProgress(job);
        return;
      } catch (error) {
        if (isAbortError(error)) throw error;
        const providerError = userFacingProviderError(error);
        if (attempt < maxAttempts && providerError.retryable) {
          this.emit(job, 'stage:retry', {
            stageId: stage.id,
            attempt: attempt + 1,
            message: `إعادة محاولة ${stage.label} (${attempt + 1}/${maxAttempts})`,
          });
          await abortableDelay(600 * attempt, job.controller.signal);
          continue;
        }
        stage.error = providerError.message;
        stage.status = stage.optional ? 'SKIPPED' : 'FAILED';
        stage.completedAt = now();
        stage.durationMs = stage.completedAt - stage.startedAt;
        this.emitStageStatus(job, stage);
        this.emitProgress(job);
        return;
      }
    }
  }

  private emitStageStatus(job: ManagedJob, stage: StageRuntime): void {
    this.emit(job, 'stage:status', {
      stageId: stage.id,
      status: stage.status,
      attempt: stage.attempt,
      ...(stage.error ? { error: stage.error } : {}),
      ...(stage.startedAt ? { startedAt: stage.startedAt } : {}),
      ...(stage.completedAt ? { completedAt: stage.completedAt } : {}),
      ...(stage.durationMs ? { durationMs: stage.durationMs } : {}),
    });
  }

  private emitProgress(job: ManagedJob): void {
    job.snapshot.progress = progressOf(job.snapshot.stages);
    job.snapshot.updatedAt = now();
    this.emit(job, 'job:metrics', {
      metrics: { ...job.snapshot.metrics },
      progress: job.snapshot.progress,
    });
  }

  private emit<T extends JobEventName>(
    job: ManagedJob,
    eventName: T,
    payload: JobEventPayloadMap[T],
  ): void {
    job.snapshot.sequence += 1;
    job.snapshot.updatedAt = now();
    const event = {
      id: randomUUID(),
      event: eventName,
      jobId: job.snapshot.id,
      projectId: job.snapshot.projectId,
      sequence: job.snapshot.sequence,
      timestamp: job.snapshot.updatedAt,
      payload,
    } as JobEvent<T>;
    this.emitToRoom(
      `job:${job.snapshot.id}`,
      event as unknown as JobEvent,
    );
  }

  private prune(): void {
    if (this.jobs.size <= 100) return;
    const finished = [...this.jobs.values()]
      .filter((job) => !['QUEUED', 'RUNNING'].includes(job.snapshot.status))
      .sort((a, b) => a.snapshot.updatedAt - b.snapshot.updatedAt);
    while (this.jobs.size > 100 && finished.length > 0) {
      const oldest = finished.shift();
      if (oldest) this.jobs.delete(oldest.snapshot.id);
    }
  }
}
