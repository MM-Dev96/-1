import type { ReactNode } from 'react';
import {
  Activity,
  Bot,
  Boxes,
  Eye,
  FolderKanban,
  Menu,
  Settings,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { useAppStore, type MainMode } from '../store.ts';

interface NavItem {
  mode: MainMode;
  label: string;
  shortLabel: string;
  icon: typeof Bot;
}

const navigation: NavItem[] = [
  { mode: 'orchestrator', label: 'المختبر الذكي', shortLabel: 'المختبر', icon: Sparkles },
  { mode: 'workflow', label: 'محرر المسار', shortLabel: 'المسار', icon: Workflow },
  { mode: 'repository', label: 'المشاريع', shortLabel: 'المشاريع', icon: FolderKanban },
  { mode: 'evaluation', label: 'التقييم', shortLabel: 'التقييم', icon: Activity },
  { mode: 'preview', label: 'المعاينة', shortLabel: 'المعاينة', icon: Eye },
  { mode: 'settings', label: 'الإعدادات', shortLabel: 'الإعدادات', icon: Settings },
];

function ConnectionPill() {
  const connection = useAppStore((state) => state.connection);
  const data = {
    connected: { label: 'متصل', className: 'is-connected' },
    connecting: { label: 'جارِ الاتصال', className: 'is-connecting' },
    offline: { label: 'غير متصل', className: 'is-offline' },
  }[connection];
  return (
    <div className={`connection-pill ${data.className}`}>
      <span aria-hidden="true" />
      {data.label}
    </div>
  );
}

function NavButton({ item }: { item: NavItem }) {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const Icon = item.icon;
  return (
    <button
      className={`nav-button ${mode === item.mode ? 'is-active' : ''}`}
      onClick={() => setMode(item.mode)}
      aria-current={mode === item.mode ? 'page' : undefined}
    >
      <Icon size={20} />
      <span className="nav-button__long">{item.label}</span>
      <span className="nav-button__short">{item.shortLabel}</span>
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="brand">
          <div className="brand__mark">
            <Boxes size={22} />
          </div>
          <div>
            <strong>Nexus</strong>
            <span>AI Workspace</span>
          </div>
          <button
            className="icon-button sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar__nav" aria-label="التنقل الرئيسي">
          {navigation.map((item) => (
            <NavButton key={item.mode} item={item} />
          ))}
        </nav>
        <div className="sidebar__foot">
          <Bot size={18} />
          <div>
            <strong>مساعد بناء شخصي</strong>
            <span>يحفظ المشاريع على جهازك</span>
          </div>
        </div>
      </aside>
      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="إغلاق القائمة"
        />
      )}

      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="فتح القائمة"
          >
            <Menu size={23} />
          </button>
          <div className="topbar__title">
            <strong>Nexus Workspace</strong>
            <span>حوّل الفكرة إلى خطة تنفيذ دقيقة</span>
          </div>
          <ConnectionPill />
        </header>
        <main className="workspace__content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="التنقل على الجوال">
        {navigation.map((item) => (
          <NavButton key={item.mode} item={item} />
        ))}
      </nav>
    </div>
  );
}
