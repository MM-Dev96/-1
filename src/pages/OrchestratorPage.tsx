import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  Clock3,
  FileText,
  Layers3,
  LoaderCircle,
  PauseCircle,
  Play,
  Plus,
  RefreshCcw,
  Route,
  Save,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { Modal } from '../components/Modal.tsx';
import { OutputPanel } from '../components/orchestrator/OutputPanel.tsx';
import { StageCard } from '../components/orchestrator/StageCard.tsx';
import { formatDuration } from '../components/orchestrator/ui.ts';
import { api, standaloneInput, waitForJob } from '../lib/api.ts';
import { copyText, downloadText } from '../lib/download.ts';
import {
  createProjectDraft,
  projectRepository,
} from '../lib/repository.ts';
import type {
  JobSnapshot,
  ProjectRecord,
  ProjectVersion,
  StageRuntime,
  WorkflowProfile,
} from '../shared/contracts.ts';
import { blockingDagIssues, validateDag } from '../shared/dag.ts';
import {
  PROFILE_META,
  workflowForProfile,
} from '../shared/defaultWorkflow.ts';
import { useAppStore } from '../store.ts';

const profileOrder: WorkflowProfile[] = ['quick', 'balanced', 'full'];

function statusForProject(snapshot: JobSnapshot): ProjectRecord['status'] {
  if (snapshot.status === 'COMPLETED') return 'completed';
  if (snapshot.status === 'FAILED') return 'failed';
  if (snapshot.status === 'CANCELED') return 'draft';
  return 'running';
}

export default function OrchestratorPage() {
  const idea = useAppStore((state) => state.idea);
  const setIdea = useAppStore((state) => state.setIdea);
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const model = useAppStore((state) => state.model);
  const apiKeys = useAppStore((state) => state.apiKeys);
  const nodes = useAppStore((state) => state.nodes);
  const edges = useAppStore((state) => state.edges);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const setCurrentProjectId = useAppStore(
    (state) => state.setCurrentProjectId,
  );
  const activeJobId = useAppStore((state) => state.activeJobId);
  const setActiveJobId = useAppStore((state) => state.setActiveJobId);
  const snapshot = useAppStore((state) => state.jobSnapshot);
  const setSnapshot = useAppStore((state) => state.setJobSnapshot);
  const pushToast = useAppStore((state) => state.pushToast);
  const setMode = useAppStore((state) => state.setMode);
  const runRequest = useAppStore((state) => state.runRequest);

  const [starting, setStarting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [artifactDraft, setArtifactDraft] = useState('');
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [compareVersion, setCompareVersion] = useState<ProjectVersion | null>(
    null,
  );
  const [improvedIdea, setImprovedIdea] = useState('');
  const [improving, setImproving] = useState(false);
  const [clock, setClock] = useState(0);
  const handledRunRequest = useRef(0);
  const improvementController = useRef<AbortController | null>(null);

  const profiledWorkflow = useMemo(
    () => workflowForProfile(nodes, edges, profile),
    [edges, nodes, profile],
  );
  const dagIssues = useMemo(
    () =>
      blockingDagIssues(
        validateDag(profiledWorkflow.nodes, profiledWorkflow.edges),
      ),
    [profiledWorkflow],
  );
  const isRunning =
    starting || Boolean(snapshot && ['QUEUED', 'RUNNING'].includes(snapshot.status));
  const elapsed = snapshot
    ? (snapshot.completedAt ?? (clock || snapshot.updatedAt)) -
      snapshot.createdAt
    : 0;
  const selectedStage =
    snapshot?.stages.find((stage) => stage.id === selectedStageId) ?? null;

  useEffect(() => {
    if (!snapshot || !['QUEUED', 'RUNNING'].includes(snapshot.status)) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [snapshot]);

  useEffect(() => {
    if (!currentProjectId) return;
    let active = true;
    void projectRepository.get(currentProjectId).then((project) => {
      if (active) setVersions(project?.versions ?? []);
    });
    return () => {
      active = false;
    };
  }, [currentProjectId]);

  useEffect(() => {
    if (!snapshot || !currentProjectId) return;
    const timer = window.setTimeout(() => {
      setSaveState('saving');
      void (async () => {
        const existing =
          (await projectRepository.get(currentProjectId)) ??
          createProjectDraft({
            id: currentProjectId,
            idea,
            profile,
            model,
            nodes,
            edges,
          });
        const artifacts = Object.fromEntries(
          snapshot.stages
            .filter((stage) => stage.output)
            .map((stage) => [stage.id, stage.output]),
        );
        const finalPrompt = snapshot.finalOutput ?? existing.finalPrompt;
        const nextVersions = [...existing.versions];
        if (
          snapshot.status === 'COMPLETED' &&
          finalPrompt &&
          nextVersions[0]?.finalPrompt !== finalPrompt
        ) {
          nextVersions.unshift({
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            label: `نسخة ${nextVersions.length + 1}`,
            finalPrompt,
          });
        }
        const updated: ProjectRecord = {
          ...existing,
          idea,
          profile,
          model,
          nodes: structuredClone(nodes),
          edges: structuredClone(edges),
          artifacts,
          finalPrompt,
          status: statusForProject(snapshot),
          versions: nextVersions,
          lastJob: structuredClone(snapshot),
          updatedAt: Date.now(),
        };
        await projectRepository.put(updated);
        setVersions(nextVersions);
        setSaveState('saved');
      })().catch(() => setSaveState('idle'));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [currentProjectId, edges, idea, model, nodes, profile, snapshot]);

  const startRun = useCallback(
    async (resume = false) => {
      if (idea.trim().length < 12) {
        pushToast(
          'idea-short',
          'اكتب فكرة أوضح قليلًا قبل تشغيل الفريق.',
          'error',
        );
        return;
      }
      if (dagIssues.length > 0) {
        pushToast('invalid-dag', dagIssues[0]?.message ?? 'المخطط غير صالح.', 'error');
        return;
      }
      setStarting(true);
      try {
        const projectId = currentProjectId ?? crypto.randomUUID();
        const existing = await projectRepository.get(projectId);
        if (!existing) {
          await projectRepository.put(
            createProjectDraft({
              id: projectId,
              idea,
              profile,
              model,
              nodes,
              edges,
            }),
          );
        }
        const next = await api.startWorkflow(
          {
            projectId,
            idea,
            profile,
            model,
            nodes,
            edges,
            ...(resume && snapshot ? { resume: snapshot } : {}),
          },
          apiKeys,
        );
        setCurrentProjectId(projectId);
        setSnapshot(next);
        setActiveJobId(next.id);
        pushToast(
          `started:${next.id}`,
          resume ? 'استؤنفت المراحل المكتملة.' : 'بدأ الفريق العمل على الفكرة.',
          'success',
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'تعذر بدء المهمة.';
        pushToast('start-error', message, 'error');
      } finally {
        setStarting(false);
      }
    },
    [
      apiKeys,
      currentProjectId,
      dagIssues,
      edges,
      idea,
      model,
      nodes,
      profile,
      pushToast,
      setActiveJobId,
      setCurrentProjectId,
      setSnapshot,
      snapshot,
    ],
  );

  useEffect(() => {
    if (
      runRequest > 0 &&
      handledRunRequest.current !== runRequest &&
      !isRunning
    ) {
      handledRunRequest.current = runRequest;
      void startRun(false);
    }
  }, [isRunning, runRequest, startRun]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!isRunning) void startRun(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRunning, startRun]);

  const cancelRun = async () => {
    if (!activeJobId) return;
    try {
      const next = await api.cancelJob(activeJobId);
      setSnapshot(next);
      pushToast(`cancel:${activeJobId}`, 'جارِ إيقاف جميع المراحل…', 'info');
    } catch (error) {
      pushToast(
        'cancel-error',
        error instanceof Error ? error.message : 'تعذر الإلغاء.',
        'error',
      );
    }
  };

  const retryStage = async (stageId: string) => {
    if (!snapshot) return;
    try {
      const next = await api.retryStage(snapshot.id, stageId);
      setSnapshot(next);
      setActiveJobId(next.id);
      pushToast(`retry:${stageId}`, 'أُعيدت المرحلة وما يعتمد عليها.', 'success');
    } catch (error) {
      pushToast(
        'retry-error',
        error instanceof Error ? error.message : 'تعذرت إعادة المرحلة.',
        'error',
      );
    }
  };

  const improveIdea = async () => {
    if (idea.trim().length < 12) {
      pushToast('idea-improve-empty', 'اكتب الفكرة أولًا.', 'error');
      return;
    }
    improvementController.current?.abort();
    const controller = new AbortController();
    improvementController.current = controller;
    setImproving(true);
    setImprovedIdea('');
    try {
      const job = await api.startStandalone(
        standaloneInput('idea-improver', idea, model),
        apiKeys,
      );
      const result = await waitForJob(job.id, controller.signal);
      if (result.status !== 'COMPLETED' || !result.finalOutput) {
        throw new Error(result.error ?? 'لم يكتمل تحسين الفكرة.');
      }
      setImprovedIdea(result.finalOutput);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      pushToast(
        'improve-error',
        error instanceof Error ? error.message : 'تعذر تحسين الفكرة.',
        'error',
      );
    } finally {
      setImproving(false);
    }
  };

  const openArtifact = (stage: StageRuntime) => {
    setSelectedStageId(stage.id);
    setArtifactDraft(stage.output);
  };

  const saveArtifact = () => {
    if (!snapshot || !selectedStage) return;
    const next: JobSnapshot = {
      ...snapshot,
      stages: snapshot.stages.map((stage) =>
        stage.id === selectedStage.id
          ? { ...stage, output: artifactDraft }
          : stage,
      ),
      ...(snapshot.finalOutput === selectedStage.output
        ? { finalOutput: artifactDraft }
        : {}),
      updatedAt: Date.now(),
    };
    setSnapshot(next);
    setSelectedStageId(null);
    pushToast(`artifact:${selectedStage.id}`, 'حُفظ تعديل الملف محليًا.', 'success');
  };

  const finalOutput = snapshot?.finalOutput ?? '';

  return (
    <div className="page orchestrator-page">
      <section className="hero-card">
        <div className="eyebrow">
          <Sparkles size={16} />
          فريق وكلاء يعمل وفق مخطط DAG حقيقي
        </div>
        <div className="hero-card__heading">
          <div>
            <h1>ما الفكرة التي تريد تحويلها إلى مشروع؟</h1>
            <p>
              اكتبها بطريقتك. سيحللها الفريق، يراجع التعارضات، ويخرج لك برومبتًا
              واحدًا قابلًا للتنفيذ.
            </p>
          </div>
          <div className="header-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setCurrentProjectId(null);
                setActiveJobId(null);
                setSnapshot(null);
                setVersions([]);
                setIdea('');
              }}
              disabled={isRunning}
            >
              <Plus size={18} />
              فكرة جديدة
            </button>
            <button className="secondary-button" onClick={() => setMode('workflow')}>
              <Route size={18} />
              تعديل المسار
            </button>
          </div>
        </div>
        <div className="idea-composer">
          <textarea
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="مثال: أريد تطبيقًا شخصيًا يساعدني على تنظيم مشاريعي، يحفظ كل شيء محليًا ويقترح الخطوة التالية…"
            rows={6}
            disabled={isRunning}
            aria-label="فكرة المشروع"
          />
          <div className="idea-composer__footer">
            <span>{idea.length.toLocaleString('ar-SA')} حرف</span>
            <button
              className="text-button"
              onClick={() => void improveIdea()}
              disabled={improving || isRunning}
            >
              {improving ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <WandSparkles size={17} />
              )}
              تحسين ذكي مع موافقتك
            </button>
          </div>
        </div>
      </section>

      <section className="profile-section">
        <div className="section-heading">
          <div>
            <h2>عمق العمل</h2>
            <p>الأرقام أدناه استدعاءات فعلية متوقعة وليست مؤشرًا تجميليًا.</p>
          </div>
          <div className={`autosave-state is-${saveState}`}>
            <Save size={15} />
            {saveState === 'saving'
              ? 'جارِ الحفظ'
              : saveState === 'saved'
                ? 'محفوظ محليًا'
                : 'حفظ تلقائي'}
          </div>
        </div>
        <div className="profile-grid">
          {profileOrder.map((value) => {
            const graph = workflowForProfile(nodes, edges, value);
            return (
              <button
                key={value}
                className={`profile-card ${profile === value ? 'is-selected' : ''}`}
                onClick={() => setProfile(value)}
                disabled={isRunning}
              >
                <span className="profile-card__check">
                  {profile === value && <Check size={15} />}
                </span>
                <strong>{PROFILE_META[value].label}</strong>
                <small>{PROFILE_META[value].description}</small>
                <span>{graph.nodes.length} استدعاء متوقع</span>
              </button>
            );
          })}
        </div>
        {dagIssues.length > 0 && (
          <div className="warning-banner">
            <AlertTriangle size={18} />
            <div>
              <strong>المخطط يحتاج إصلاحًا قبل التشغيل</strong>
              <span>{dagIssues[0]?.message}</span>
            </div>
          </div>
        )}
        <div className="run-actions">
          {isRunning ? (
            <button className="danger-button" onClick={() => void cancelRun()}>
              <PauseCircle size={19} />
              إيقاف المهمة
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={() => void startRun(false)}
              disabled={starting || dagIssues.length > 0}
            >
              {starting ? (
                <LoaderCircle className="spin" size={19} />
              ) : (
                <Play size={19} />
              )}
              تشغيل الفريق
            </button>
          )}
          {snapshot &&
            ['FAILED', 'CANCELED'].includes(snapshot.status) &&
            !isRunning && (
              <button
                className="secondary-button"
                onClick={() => void startRun(true)}
              >
                <RefreshCcw size={18} />
                استئناف من المراحل المنجزة
              </button>
          )}
          <span className="keyboard-hint">⌘/Ctrl + Enter للتشغيل</span>
        </div>
      </section>

      {snapshot && (
        <>
          <section className="metrics-strip">
            <div>
              <Layers3 size={19} />
              <span>التقدم</span>
              <strong>{snapshot.progress}%</strong>
            </div>
            <div>
              <Sparkles size={19} />
              <span>الاستدعاءات</span>
              <strong>{snapshot.metrics.requestCount}</strong>
            </div>
            <div>
              <Clock3 size={19} />
              <span>المدة</span>
              <strong>{formatDuration(elapsed)}</strong>
            </div>
            <div>
              <FileText size={19} />
              <span>المخرجات</span>
              <strong>
                {snapshot.stages
                  .reduce((sum, stage) => sum + stage.output.length, 0)
                  .toLocaleString('ar-SA')}
              </strong>
            </div>
            <div className="metrics-strip__progress">
              <span style={{ width: `${snapshot.progress}%` }} />
            </div>
          </section>

          <section className="pipeline-section">
            <div className="section-heading">
              <div>
                <h2>خط سير المراحل</h2>
                <p>اضغط على أي مرحلة لعرض ملفها أو تعديله.</p>
              </div>
              <span className={`job-state is-${snapshot.status.toLowerCase()}`}>
                {snapshot.status}
              </span>
            </div>
            <div className="stage-list">
              {snapshot.stages.map((stage) => (
                <StageCard
                  key={stage.id}
                  stage={stage}
                  onOpen={() => openArtifact(stage)}
                  onRetry={() => void retryStage(stage.id)}
                  retryAllowed={
                    !isRunning &&
                    ['FAILED', 'BLOCKED', 'COMPLETED', 'SKIPPED'].includes(
                      stage.status,
                    )
                  }
                />
              ))}
            </div>
          </section>

          <OutputPanel
            snapshot={snapshot}
            finalOutput={finalOutput}
            versions={versions}
            onOpenArtifact={openArtifact}
            onCopy={() => {
              void copyText(finalOutput).then(() =>
                pushToast('copy-final', 'نُسخ البرومبت.', 'success'),
              );
            }}
            onDownload={() =>
              downloadText('nexus-final-prompt.md', finalOutput)
            }
            onCompare={setCompareVersion}
          />
        </>
      )}

      {selectedStage && (
        <Modal
          title={`${selectedStage.label} — ${selectedStage.artifact}`}
          onClose={() => setSelectedStageId(null)}
          wide
        >
          <textarea
            className="artifact-editor"
            value={artifactDraft}
            onChange={(event) => setArtifactDraft(event.target.value)}
            placeholder="لا يوجد مخرج لهذه المرحلة بعد."
          />
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => setSelectedStageId(null)}
            >
              إلغاء
            </button>
            <button className="primary-button" onClick={saveArtifact}>
              <Save size={18} />
              حفظ التعديل
            </button>
          </div>
        </Modal>
      )}

      {(improving || improvedIdea) && (
        <Modal
          title="اقتراح تحسين الفكرة"
          onClose={() => {
            improvementController.current?.abort();
            setImprovedIdea('');
          }}
          wide
        >
          {improving ? (
            <div className="modal-loading">
              <LoaderCircle className="spin" />
              <p>جارِ تحليل الفكرة واقتراح نسخة أوضح…</p>
            </div>
          ) : (
            <>
              <textarea
                className="artifact-editor artifact-editor--short"
                value={improvedIdea}
                onChange={(event) => setImprovedIdea(event.target.value)}
              />
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  onClick={() => setImprovedIdea('')}
                >
                  إبقاء فكرتي
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    setIdea(improvedIdea);
                    setImprovedIdea('');
                    pushToast('idea-applied', 'طُبق التحسين بعد موافقتك.', 'success');
                  }}
                >
                  <Check size={18} />
                  اعتماد الاقتراح
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {compareVersion && (
        <Modal
          title={`مقارنة مع ${compareVersion.label}`}
          onClose={() => setCompareVersion(null)}
          wide
        >
          <div className="compare-grid">
            <section>
              <h3>{compareVersion.label}</h3>
              <pre>{compareVersion.finalPrompt}</pre>
            </section>
            <section>
              <h3>النسخة الحالية</h3>
              <pre>{finalOutput}</pre>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
