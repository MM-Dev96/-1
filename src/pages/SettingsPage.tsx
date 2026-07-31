import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Database,
  KeyRound,
  LoaderCircle,
  RefreshCcw,
  RotateCcw,
  Server,
  Settings,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { useAppStore } from '../store.ts';

interface HealthState {
  status: string;
  activeJobs: number;
  providerConfigured: boolean;
  uptimeSeconds: number;
}

export default function SettingsPage() {
  const model = useAppStore((state) => state.model);
  const setModel = useAppStore((state) => state.setModel);
  const apiKeys = useAppStore((state) => state.apiKeys);
  const setApiKeys = useAppStore((state) => state.setApiKeys);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const setReducedMotion = useAppStore((state) => state.setReducedMotion);
  const resetWorkflow = useAppStore((state) => state.resetWorkflow);
  const pushToast = useAppStore((state) => state.pushToast);
  const [keysText, setKeysText] = useState(apiKeys.join('\n'));
  const [health, setHealth] = useState<HealthState | null>(null);
  const [healthError, setHealthError] = useState('');
  const [checking, setChecking] = useState(true);

  const checkHealth = async () => {
    setChecking(true);
    setHealthError('');
    try {
      setHealth(await api.health());
    } catch (error) {
      setHealth(null);
      setHealthError(
        error instanceof Error ? error.message : 'الخادم غير متاح.',
      );
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    let active = true;
    void api
      .health()
      .then((result) => {
        if (active) setHealth(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHealth(null);
        setHealthError(
          error instanceof Error ? error.message : 'الخادم غير متاح.',
        );
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const saveKeys = () => {
    const keys = keysText
      .split(/[\n,]/)
      .map((key) => key.trim())
      .filter(Boolean);
    setApiKeys(keys);
    pushToast('keys-saved', `حُفظ ${keys.length} مفتاح على هذا الجهاز.`, 'success');
  };

  return (
    <div className="page settings-page">
      <section className="page-header">
        <div>
          <div className="eyebrow">
            <Settings size={16} />
            إعدادات فعلية
          </div>
          <h1>الإعدادات والحالة</h1>
          <p>كل خيار هنا متصل بسلوك حقيقي في التطبيق.</p>
        </div>
      </section>

      <div className="settings-grid">
        <section className="settings-card card">
          <div className="settings-card__icon">
            <Activity size={21} />
          </div>
          <div className="settings-card__heading">
            <h2>حالة المحرك</h2>
            <p>قراءة مباشرة من ‎/api/health</p>
          </div>
          {checking ? (
            <div className="health-row">
              <LoaderCircle className="spin" size={18} />
              جارِ الفحص…
            </div>
          ) : health ? (
            <div className="health-list">
              <div>
                <Server size={17} />
                <span>الخادم</span>
                <strong className="text-success">يعمل</strong>
              </div>
              <div>
                <Sparkles size={17} />
                <span>Gemini</span>
                <strong
                  className={
                    health.providerConfigured || apiKeys.length > 0
                      ? 'text-success'
                      : 'text-warning'
                  }
                >
                  {health.providerConfigured || apiKeys.length > 0
                    ? 'جاهز'
                    : 'يحتاج مفتاح'}
                </strong>
              </div>
              <div>
                <Database size={17} />
                <span>الحفظ</span>
                <strong>IndexedDB</strong>
              </div>
              <div>
                <Activity size={17} />
                <span>المهام النشطة</span>
                <strong>{health.activeJobs}</strong>
              </div>
            </div>
          ) : (
            <div className="health-error">
              <WifiOff size={19} />
              {healthError}
            </div>
          )}
          <button className="secondary-button" onClick={() => void checkHealth()}>
            <RefreshCcw size={17} />
            فحص الآن
          </button>
        </section>

        <section className="settings-card card">
          <div className="settings-card__icon">
            <Sparkles size={21} />
          </div>
          <div className="settings-card__heading">
            <h2>نموذج Gemini</h2>
            <p>يُرسل هذا الاسم نفسه إلى مزود الذكاء الاصطناعي.</p>
          </div>
          <label>
            اسم النموذج
            <input
              dir="ltr"
              list="gemini-models"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
            <datalist id="gemini-models">
              <option value="gemini-2.5-flash" />
              <option value="gemini-2.5-pro" />
            </datalist>
          </label>
          <small className="field-hint">
            تستطيع كتابة اسم نموذج متاح لحسابك بدل الخيارات المقترحة.
          </small>
        </section>

        <section className="settings-card card settings-card--wide">
          <div className="settings-card__icon">
            <KeyRound size={21} />
          </div>
          <div className="settings-card__heading">
            <h2>مفاتيح Gemini</h2>
            <p>ضع كل مفتاح في سطر. ينتقل المحرك إلى المفتاح التالي عند حدود الطلبات.</p>
          </div>
          <textarea
            dir="ltr"
            value={keysText}
            onChange={(event) => setKeysText(event.target.value)}
            rows={5}
            placeholder="AIza…"
          />
          <div className="settings-card__actions">
            <span>{apiKeys.length} مفتاح محفوظ</span>
            <button className="primary-button" onClick={saveKeys}>
              <CheckCircle2 size={18} />
              حفظ المفاتيح
            </button>
          </div>
        </section>

        <section className="settings-card card">
          <div className="settings-card__icon">
            <Settings size={21} />
          </div>
          <div className="settings-card__heading">
            <h2>الحركة والوصول</h2>
            <p>احترام الراحة البصرية على الجوال.</p>
          </div>
          <label className="switch-row">
            <span>
              تقليل الحركة
              <small>يوقف أغلب الانتقالات والمؤثرات</small>
            </span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
          </label>
        </section>

        <section className="settings-card card">
          <div className="settings-card__icon">
            <RotateCcw size={21} />
          </div>
          <div className="settings-card__heading">
            <h2>المسار الافتراضي</h2>
            <p>إعادة مراحل الفريق وروابطها فقط دون حذف المشاريع.</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              resetWorkflow();
              pushToast('settings-reset-workflow', 'استُعيد المسار الافتراضي.', 'success');
            }}
          >
            <RotateCcw size={17} />
            استعادة المسار
          </button>
        </section>
      </div>
    </div>
  );
}
