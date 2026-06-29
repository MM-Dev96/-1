import React from 'react';
import { Play, LayoutTemplate, Shield, Archive, Settings, User, ChevronDown, Zap, X } from 'lucide-react';
import { useAppStore, MainMode } from '../store';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const { mainMode, setMainMode } = useAppStore();

  const handleNav = (mode: MainMode) => {
    setMainMode(mode);
    setSidebarOpen(false);
  };

  const navItems = [
    { mode: 'orchestrator' as MainMode, icon: Play, label: 'منسق المهام' },
    { mode: 'workflow_editor' as MainMode, icon: LayoutTemplate, label: 'محرر مسار العمل' },
    { mode: 'app_evaluator' as MainMode, icon: Shield, label: 'مدقق النظام' },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`fixed md:static inset-y-0 right-0 z-50 w-64 bg-[#0a0a0a] border-l border-white/5 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Nexus<span className="text-zinc-500 font-light">SaaS</span>
            </span>
          </div>
          <button className="md:hidden text-zinc-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          <div className="text-xs font-semibold text-zinc-500 tracking-wider mb-2 px-3">الوحدات الأساسية</div>
          
          {navItems.map(item => (
            <button
              key={item.mode}
              onClick={() => handleNav(item.mode)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${mainMode === item.mode ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"}`}
            >
              <item.icon size={16} /> {item.label}
            </button>
          ))}

          <button
            onClick={() => handleNav('repository')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 mt-4 border-t border-white/5 pt-4 ${mainMode === "repository" ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"}`}
          >
            <Archive size={16} /> المستودع
          </button>
        </div>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={() => handleNav('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${mainMode === 'settings' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}
          >
            <Settings size={16} /> الإعدادات
          </button>
          <div className="mt-4 flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 rounded-lg transition-colors">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
              <User size={14} className="text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">أحمد م.</div>
              <div className="text-xs text-zinc-500 truncate">مهندس رئيسي</div>
            </div>
            <ChevronDown size={14} className="text-zinc-500" />
          </div>
        </div>
      </aside>
    </>
  );
}
