import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore, type ToastMessage } from '../store.ts';

function Toast({ toast }: { toast: ToastMessage }) {
  const dismiss = useAppStore((state) => state.dismissToast);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), 4_500);
    return () => window.clearTimeout(timer);
  }, [dismiss, toast.id]);
  const Icon =
    toast.tone === 'success'
      ? CheckCircle2
      : toast.tone === 'error'
        ? AlertCircle
        : Info;
  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      <Icon size={19} />
      <span>{toast.message}</span>
      <button onClick={() => dismiss(toast.id)} aria-label="إخفاء التنبيه">
        <X size={17} />
      </button>
    </div>
  );
}

export function ToastCenter() {
  const toasts = useAppStore((state) => state.toasts);
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
