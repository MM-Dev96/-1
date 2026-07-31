import { useEffect, useRef, useState } from 'react';
import {
  Code2,
  Expand,
  FileArchive,
  FolderOpen,
  LoaderCircle,
  Monitor,
  Play,
  RefreshCcw,
  Smartphone,
  Square,
  Tablet,
  Upload,
} from 'lucide-react';
import { Modal } from './Modal.tsx';
import { api, standaloneInput, waitForJob } from '../lib/api.ts';
import { projectRepository } from '../lib/repository.ts';
import type { JobSnapshot } from '../shared/contracts.ts';
import { useAppStore } from '../store.ts';

type PreviewTab = 'prototype' | 'static';
type Device = 'mobile' | 'tablet' | 'desktop';

function PreviewFrame({
  html,
  url,
  device,
  refreshKey,
}: {
  html?: string;
  url?: string;
  device: Device;
  refreshKey: number;
}) {
  return (
    <div className={`preview-device preview-device--${device}`}>
      <iframe
        key={refreshKey}
        title="معاينة النموذج"
        sandbox="allow-scripts allow-forms allow-modals"
        src={url}
        srcDoc={url ? undefined : html}
      />
    </div>
  );
}

export default function LivePreview() {
  const model = useAppStore((state) => state.model);
  const apiKeys = useAppStore((state) => state.apiKeys);
  const idea = useAppStore((state) => state.idea);
  const projectId = useAppStore((state) => state.currentProjectId);
  const orchestration = useAppStore((state) => state.jobSnapshot);
  const pushToast = useAppStore((state) => state.pushToast);
  const [tab, setTab] = useState<PreviewTab>('prototype');
  const [device, setDevice] = useState<Device>('mobile');
  const [html, setHtml] = useState('');
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
  }, []);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    void projectRepository.get(projectId).then((project) => {
      if (active && project?.mockupHtml) setHtml(project.mockupHtml);
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (previewId) void api.deletePreview(previewId).catch(() => undefined);
    },
    [previewId],
  );

  const generate = async () => {
    const source = orchestration?.finalOutput || idea;
    if (source.trim().length < 12) {
      pushToast('preview-empty', 'شغّل الفكرة أو اكتب وصفًا أولًا.', 'error');
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setGenerating(true);
    setJob(null);
    try {
      const started = await api.startStandalone(
        standaloneInput('mockup', source, model, projectId ?? crypto.randomUUID()),
        apiKeys,
      );
      setJob(started);
      const result = await waitForJob(started.id, controller.signal, setJob);
      if (result.status !== 'COMPLETED' || !result.finalOutput) {
        throw new Error(result.error ?? 'لم يكتمل النموذج.');
      }
      setHtml(result.finalOutput);
      setRefreshKey((value) => value + 1);
      if (projectId) {
        const project = await projectRepository.get(projectId);
        if (project) {
          await projectRepository.put({
            ...project,
            mockupHtml: result.finalOutput,
            updatedAt: Date.now(),
          });
        }
      }
      pushToast(`mockup:${result.id}`, 'اكتمل نموذج HTML التفاعلي.', 'success');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      pushToast(
        'mockup-error',
        error instanceof Error ? error.message : 'تعذر إنشاء النموذج.',
        'error',
      );
    } finally {
      setGenerating(false);
    }
  };

  const stopGeneration = async () => {
    controllerRef.current?.abort();
    if (job?.id) {
      try {
        await api.cancelJob(job.id);
      } catch {
        // Local cancellation still stops the UI immediately.
      }
    }
    setGenerating(false);
  };

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setUploading(true);
    setUploadMessage('');
    setFileNames([]);
    try {
      if (previewId) await api.deletePreview(previewId).catch(() => undefined);
      const result = await api.uploadPreview(files, controller.signal);
      setFileNames(result.files);
      setUploadMessage(result.message ?? '');
      setPreviewId(result.id ?? null);
      setPreviewUrl(result.url ?? '');
      setRefreshKey((value) => value + 1);
      if (result.buildRequired) {
        pushToast('preview-build', result.message ?? 'المشروع يحتاج build.', 'info');
      } else if (result.url) {
        pushToast('preview-ready', 'المعاينة الثابتة جاهزة.', 'success');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      pushToast(
        'upload-preview-error',
        error instanceof Error ? error.message : 'تعذر رفع الملفات.',
        'error',
      );
    } finally {
      setUploading(false);
    }
  };

  const frame =
    tab === 'prototype'
      ? html
        ? { html }
        : null
      : previewUrl
        ? { url: previewUrl }
        : null;

  return (
    <div className="page preview-page">
      <section className="page-header">
        <div>
          <div className="eyebrow">
            <Code2 size={16} />
            Static Preview
          </div>
          <h1>معاينة واقعية دون ادعاءات</h1>
          <p>
            أنشئ نموذج HTML ثابتًا، أو افتح ملفات مبنية تحتوي index.html. مشاريع
            React/Vite المصدرية تحتاج build أولًا.
          </p>
        </div>
      </section>

      <div className="segmented-control">
        <button
          className={tab === 'prototype' ? 'is-active' : ''}
          onClick={() => setTab('prototype')}
        >
          <Play size={18} />
          نموذج HTML بالذكاء الاصطناعي
        </button>
        <button
          className={tab === 'static' ? 'is-active' : ''}
          onClick={() => setTab('static')}
        >
          <FolderOpen size={18} />
          مشروع ثابت جاهز
        </button>
      </div>

      {tab === 'prototype' ? (
        <section className="preview-source card">
          <div>
            <h2>النموذج التفاعلي</h2>
            <p>
              المصدر: {orchestration?.finalOutput ? 'البرومبت النهائي' : 'الفكرة الحالية'}
            </p>
          </div>
          {generating ? (
            <button className="danger-button" onClick={() => void stopGeneration()}>
              <Square size={17} />
              إيقاف
            </button>
          ) : (
            <button className="primary-button" onClick={() => void generate()}>
              <RefreshCcw size={18} />
              {html ? 'إعادة التوليد' : 'إنشاء النموذج'}
            </button>
          )}
        </section>
      ) : (
        <section className="preview-source card">
          <div>
            <h2>رفع نسخة ثابتة</h2>
            <p>ZIP أو مجلد يحتوي index.html وملفاته النسبية.</p>
          </div>
          <input
            ref={zipRef}
            hidden
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload([file]);
              event.target.value = '';
            }}
          />
          <input
            ref={folderRef}
            hidden
            type="file"
            multiple
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              void upload(files);
              event.target.value = '';
            }}
          />
          <div className="header-actions">
            <button
              className="secondary-button"
              onClick={() => zipRef.current?.click()}
              disabled={uploading}
            >
              <FileArchive size={18} />
              ZIP
            </button>
            <button
              className="primary-button"
              onClick={() => folderRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={18} />
              مجلد
            </button>
          </div>
        </section>
      )}

      {(generating || uploading) && (
        <section className="preview-loading card">
          <LoaderCircle className="spin" size={28} />
          <div>
            <strong>
              {generating ? 'جارِ إنشاء HTML الحقيقي…' : 'جارِ تجهيز الملفات…'}
            </strong>
            <p>
              {job
                ? `${job.progress}% • ${job.metrics.requestCount} استدعاء`
                : 'انتظر لحظات'}
            </p>
          </div>
        </section>
      )}

      {uploadMessage && (
        <div className="warning-banner">
          <Code2 size={18} />
          <div>
            <strong>المعاينة غير جاهزة</strong>
            <span>{uploadMessage}</span>
          </div>
        </div>
      )}

      {frame ? (
        <section className="preview-workspace">
          <header>
            <div className="device-switcher">
              <button
                className={device === 'mobile' ? 'is-active' : ''}
                onClick={() => setDevice('mobile')}
                aria-label="معاينة الجوال"
              >
                <Smartphone size={18} />
              </button>
              <button
                className={device === 'tablet' ? 'is-active' : ''}
                onClick={() => setDevice('tablet')}
                aria-label="معاينة الجهاز اللوحي"
              >
                <Tablet size={18} />
              </button>
              <button
                className={device === 'desktop' ? 'is-active' : ''}
                onClick={() => setDevice('desktop')}
                aria-label="معاينة الكمبيوتر"
              >
                <Monitor size={18} />
              </button>
            </div>
            <div className="header-actions">
              <button
                className="icon-button"
                onClick={() => setRefreshKey((value) => value + 1)}
                aria-label="تحديث المعاينة"
              >
                <RefreshCcw size={18} />
              </button>
              <button
                className="icon-button"
                onClick={() => setFullscreen(true)}
                aria-label="تكبير المعاينة"
              >
                <Expand size={18} />
              </button>
            </div>
          </header>
          <div className="preview-stage">
            <PreviewFrame
              {...frame}
              device={device}
              refreshKey={refreshKey}
            />
          </div>
        </section>
      ) : (
        !generating &&
        !uploading && (
          <div className="empty-state empty-state--large">
            <Monitor size={40} />
            <strong>المعاينة فارغة</strong>
            <p>
              {tab === 'prototype'
                ? 'أنشئ نموذج HTML من الفكرة.'
                : 'ارفع ZIP أو مجلدًا ثابتًا مبنيًا.'}
            </p>
          </div>
        )
      )}

      {tab === 'static' && fileNames.length > 0 && (
        <details className="file-tree card">
          <summary>{fileNames.length} ملفًا تم فحصها</summary>
          <ul>
            {fileNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </details>
      )}

      {fullscreen && frame && (
        <Modal title="معاينة مكبرة" onClose={() => setFullscreen(false)} wide>
          <div className="fullscreen-preview">
            <PreviewFrame
              {...frame}
              device="desktop"
              refreshKey={refreshKey}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
