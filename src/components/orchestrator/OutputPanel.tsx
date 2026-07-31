import { useState } from 'react';
import {
  ArrowLeft,
  Clipboard,
  Download,
  FileText,
  Lightbulb,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type {
  JobSnapshot,
  ProjectVersion,
  StageRuntime,
} from '../../shared/contracts.ts';
import { formatDuration, stageStatusMeta } from './ui.ts';

interface OutputPanelProps {
  snapshot: JobSnapshot;
  finalOutput: string;
  versions: ProjectVersion[];
  onOpenArtifact: (stage: StageRuntime) => void;
  onCopy: () => void;
  onDownload: () => void;
  onCompare: (version: ProjectVersion) => void;
}

export function OutputPanel({
  snapshot,
  finalOutput,
  versions,
  onOpenArtifact,
  onCopy,
  onDownload,
  onCompare,
}: OutputPanelProps) {
  const [tab, setTab] = useState<'prompt' | 'artifacts' | 'timeline'>('prompt');
  return (
    <section className="output-section">
      <div className="output-tabs" role="tablist">
        <button
          className={tab === 'prompt' ? 'is-active' : ''}
          onClick={() => setTab('prompt')}
        >
          البرومبت النهائي
        </button>
        <button
          className={tab === 'artifacts' ? 'is-active' : ''}
          onClick={() => setTab('artifacts')}
        >
          الملفات
        </button>
        <button
          className={tab === 'timeline' ? 'is-active' : ''}
          onClick={() => setTab('timeline')}
        >
          الخط الزمني
        </button>
      </div>

      {tab === 'prompt' && (
        <div className="final-output">
          <div className="final-output__toolbar">
            <div>
              <strong>المخرج الموحد</strong>
              <span>
                {finalOutput
                  ? `${finalOutput.length.toLocaleString('ar-SA')} حرف`
                  : 'يظهر عند اكتمال مرحلة التجميع'}
              </span>
            </div>
            <div>
              <button onClick={onCopy} disabled={!finalOutput}>
                <Clipboard size={17} />
                نسخ
              </button>
              <button onClick={onDownload} disabled={!finalOutput}>
                <Download size={17} />
                تنزيل
              </button>
              <button
                onClick={() => {
                  const version = versions[1] ?? versions[0];
                  if (version) onCompare(version);
                }}
                disabled={versions.length < 2}
              >
                <ArrowLeft size={17} />
                مقارنة
              </button>
            </div>
          </div>
          {finalOutput ? (
            <div className="markdown-surface">
              <ReactMarkdown>{finalOutput}</ReactMarkdown>
            </div>
          ) : (
            <div className="empty-state">
              <Lightbulb size={29} />
              <strong>لم يكتمل البرومبت بعد</strong>
              <p>يمكنك متابعة ملفات المراحل أثناء العمل.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'artifacts' && (
        <div className="artifact-grid">
          {snapshot.stages.map((stage) => (
            <button key={stage.id} onClick={() => onOpenArtifact(stage)}>
              <FileText size={20} />
              <strong>{stage.artifact}</strong>
              <span>{stage.label}</span>
              <small>{stage.output.length.toLocaleString('ar-SA')} حرف</small>
            </button>
          ))}
        </div>
      )}

      {tab === 'timeline' && (
        <ol className="timeline">
          {snapshot.stages.map((stage) => (
            <li key={stage.id}>
              <span className={stageStatusMeta[stage.status].className} />
              <div>
                <strong>{stage.label}</strong>
                <p>
                  {stageStatusMeta[stage.status].label}
                  {stage.durationMs ? ` • ${formatDuration(stage.durationMs)}` : ''}
                  {stage.attempt > 1 ? ` • ${stage.attempt} محاولات` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
