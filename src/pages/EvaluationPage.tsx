import { useRef, useState } from 'react';
import {
  Activity,
  ClipboardCheck,
  Download,
  Files,
  LoaderCircle,
  Play,
  Square,
  Upload,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api, standaloneInput, waitForJob } from '../lib/api.ts';
import { downloadText } from '../lib/download.ts';
import { readFileContext } from '../lib/fileContext.ts';
import type { JobSnapshot } from '../shared/contracts.ts';
import { useAppStore } from '../store.ts';

type EvaluationKind = 'evaluation' | 'self-audit';

export default function EvaluationPage() {
  const model = useAppStore((state) => state.model);
  const apiKeys = useAppStore((state) => state.apiKeys);
  const currentIdea = useAppStore((state) => state.idea);
  const pushToast = useAppStore((state) => state.pushToast);
  const [kind, setKind] = useState<EvaluationKind>('evaluation');
  const [source, setSource] = useState('');
  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    if (source.trim().length < 20) {
      pushToast('evaluation-empty', 'ألصق محتوى أو أضف ملفات أولًا.', 'error');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setSnapshot(null);
    try {
      const started = await api.startStandalone(
        standaloneInput(kind, source, model),
        apiKeys,
      );
      setSnapshot(started);
      const result = await waitForJob(started.id, controller.signal, setSnapshot);
      if (result.status === 'FAILED') {
        throw new Error(result.error ?? 'تعذر إكمال التقييم.');
      }
      pushToast(`evaluation:${result.id}`, 'اكتمل التقرير.', 'success');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      pushToast(
        'evaluation-error',
        error instanceof Error ? error.message : 'تعذر التقييم.',
        'error',
      );
    } finally {
      setRunning(false);
    }
  };

  const stop = async () => {
    abortRef.current?.abort();
    if (snapshot?.id) {
      try {
        await api.cancelJob(snapshot.id);
      } catch {
        // The local abort already stopped polling; the server may be unavailable.
      }
    }
    setRunning(false);
  };

  const addFiles = async (selected: File[]) => {
    const result = await readFileContext(selected);
    setFiles(result.included);
    setSource((current) => `${current}${result.text}`);
    if (result.ignored.length > 0 || result.truncated) {
      pushToast(
        'files-filtered',
        'أُضيفت الملفات النصية المناسبة فقط، مع ضغط المحتوى الطويل.',
        'info',
      );
    }
  };

  const output = snapshot?.finalOutput ?? '';

  return (
    <div className="page evaluation-page">
      <section className="page-header">
        <div>
          <div className="eyebrow">
            <Activity size={16} />
            JobManager
          </div>
          <h1>تقييم حقيقي للمحتوى</h1>
          <p>حلّل برومبتًا أو ملفات مختارة. تظهر النتيجة من المهمة الفعلية دون مؤشرات وهمية.</p>
        </div>
      </section>

      <div className="segmented-control">
        <button
          className={kind === 'evaluation' ? 'is-active' : ''}
          onClick={() => setKind('evaluation')}
          disabled={running}
        >
          <ClipboardCheck size={18} />
          تقييم البرومبت
        </button>
        <button
          className={kind === 'self-audit' ? 'is-active' : ''}
          onClick={() => setKind('self-audit')}
          disabled={running}
        >
          <Activity size={18} />
          تدقيق ذاتي للمشروع
        </button>
      </div>

      <section className="evaluation-input card">
        <div className="section-heading">
          <div>
            <h2>المحتوى المراد تحليله</h2>
            <p>تُقبل الملفات النصية والبرمجية ذات الصلة فقط.</p>
          </div>
          <div className="header-actions">
            <button
              className="secondary-button"
              onClick={() => setSource(currentIdea)}
              disabled={!currentIdea || running}
            >
              استخدام الفكرة الحالية
            </button>
            <input
              ref={uploadRef}
              hidden
              type="file"
              multiple
              accept=".txt,.md,.json,.ts,.tsx,.js,.jsx,.html,.css,.yaml,.yml,.sql"
              onChange={(event) => {
                const selected = [...(event.target.files ?? [])];
                void addFiles(selected);
                event.target.value = '';
              }}
            />
            <button
              className="secondary-button"
              onClick={() => uploadRef.current?.click()}
              disabled={running}
            >
              <Upload size={17} />
              ملفات
            </button>
          </div>
        </div>
        {files.length > 0 && (
          <div className="file-chips">
            <Files size={16} />
            {files.map((file) => (
              <span key={file}>{file}</span>
            ))}
          </div>
        )}
        <textarea
          value={source}
          onChange={(event) => setSource(event.target.value)}
          rows={14}
          placeholder="ألصق البرومبت، وصف المشروع، أو أجزاء الكود هنا…"
          disabled={running}
        />
        <div className="evaluation-actions">
          <span>{source.length.toLocaleString('ar-SA')} حرف ضمن السياق</span>
          {running ? (
            <button className="danger-button" onClick={() => void stop()}>
              <Square size={17} />
              إيقاف
            </button>
          ) : (
            <button className="primary-button" onClick={() => void run()}>
              <Play size={18} />
              بدء التحليل
            </button>
          )}
        </div>
      </section>

      {snapshot && (
        <section className="evaluation-output card">
          <div className="section-heading">
            <div>
              <h2>التقرير</h2>
              <p>
                {snapshot.status} • {snapshot.progress}% •{' '}
                {snapshot.metrics.requestCount} استدعاء
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => downloadText(`${kind}.md`, output)}
              disabled={!output}
            >
              <Download size={17} />
              تنزيل
            </button>
          </div>
          {running && (
            <div className="progress-line">
              <span style={{ width: `${snapshot.progress}%` }} />
            </div>
          )}
          {output ? (
            <div className="markdown-surface">
              <ReactMarkdown>{output}</ReactMarkdown>
            </div>
          ) : (
            <div className="modal-loading">
              <LoaderCircle className="spin" />
              <p>يُبنى التقرير الآن…</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
