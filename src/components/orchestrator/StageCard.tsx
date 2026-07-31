import {
  CheckCircle2,
  LoaderCircle,
  RefreshCcw,
  XCircle,
} from 'lucide-react';
import type { StageRuntime } from '../../shared/contracts.ts';
import { formatDuration, stageStatusMeta } from './ui.ts';

interface StageCardProps {
  stage: StageRuntime;
  onOpen: () => void;
  onRetry: () => void;
  retryAllowed: boolean;
}

export function StageCard({
  stage,
  onOpen,
  onRetry,
  retryAllowed,
}: StageCardProps) {
  const meta = stageStatusMeta[stage.status];
  return (
    <article className={`stage-card ${meta.className}`}>
      <button className="stage-card__main" onClick={onOpen}>
        <span className="stage-card__state">
          {stage.status === 'RUNNING' ? (
            <LoaderCircle className="spin" size={19} />
          ) : stage.status === 'COMPLETED' ? (
            <CheckCircle2 size={19} />
          ) : stage.status === 'FAILED' || stage.status === 'BLOCKED' ? (
            <XCircle size={19} />
          ) : (
            <span className="stage-card__number">{stage.attempt || '—'}</span>
          )}
        </span>
        <span className="stage-card__copy">
          <strong>{stage.label}</strong>
          <small>{stage.artifact}</small>
        </span>
        <span className={`stage-status ${meta.className}`}>{meta.label}</span>
      </button>
      <div className="stage-card__meta">
        <span>{stage.output.length.toLocaleString('ar-SA')} حرف</span>
        <span>
          {stage.durationMs ? formatDuration(stage.durationMs) : 'لم يبدأ'}
        </span>
        {retryAllowed && (
          <button onClick={onRetry}>
            <RefreshCcw size={15} />
            إعادة هذه المرحلة وما بعدها
          </button>
        )}
      </div>
      {stage.error && <p className="inline-error">{stage.error}</p>}
    </article>
  );
}
