import type { StageStatus } from '../../shared/contracts.ts';

export const stageStatusMeta: Record<
  StageStatus,
  { label: string; className: string }
> = {
  PENDING: { label: 'بانتظار دوره', className: 'is-pending' },
  RUNNING: { label: 'يعمل الآن', className: 'is-running' },
  COMPLETED: { label: 'مكتمل', className: 'is-completed' },
  FAILED: { label: 'فشل', className: 'is-failed' },
  BLOCKED: { label: 'محجوب', className: 'is-blocked' },
  SKIPPED: { label: 'تم التجاوز', className: 'is-skipped' },
  CANCELED: { label: 'ملغي', className: 'is-canceled' },
};

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}ث`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}د ${seconds % 60}ث`;
}
