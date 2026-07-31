import { lazy, Suspense, useEffect } from 'react';
import { AppShell } from './components/AppShell.tsx';
import { ToastCenter } from './components/ToastCenter.tsx';
import { useJobConnection } from './hooks/useJobConnection.ts';
import { projectRepository } from './lib/repository.ts';
import { useAppStore } from './store.ts';

const OrchestratorPage = lazy(() => import('./pages/OrchestratorPage.tsx'));
const WorkflowEditor = lazy(() => import('./components/WorkflowEditor.tsx'));
const Repository = lazy(() => import('./components/Repository.tsx'));
const EvaluationPage = lazy(() => import('./pages/EvaluationPage.tsx'));
const LivePreview = lazy(() => import('./components/LivePreview.tsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.tsx'));

function LoadingPage() {
  return (
    <div className="page-loading" role="status">
      <span className="spinner" />
      <p>جارِ تجهيز الواجهة…</p>
    </div>
  );
}

export default function App() {
  const mode = useAppStore((state) => state.mode);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  useJobConnection();

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    void projectRepository.migrateLegacyProjects();
  }, []);

  return (
    <AppShell>
      <Suspense fallback={<LoadingPage />}>
        {mode === 'orchestrator' && <OrchestratorPage />}
        {mode === 'workflow' && <WorkflowEditor />}
        {mode === 'repository' && <Repository />}
        {mode === 'evaluation' && <EvaluationPage />}
        {mode === 'preview' && <LivePreview />}
        {mode === 'settings' && <SettingsPage />}
      </Suspense>
      <ToastCenter />
    </AppShell>
  );
}
