import React, { useState } from 'react';
import { Menu, Search, Bell, Plus, Check } from 'lucide-react';
import { useAppStore, MainMode } from '../store';

interface TopNavbarProps {
  setSidebarOpen: (open: boolean) => void;
}

export default function TopNavbar({ setSidebarOpen }: TopNavbarProps) {
  const { mainMode, setCurrentProjectId, setIdea, setStageArtifacts, setActivityLogs, setFinalPrompt, setMockupHtml, setCurrentStage, setMainMode: setGlobalMainMode, notifications, markNotificationRead, clearNotifications } = useAppStore();
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 bg-black/40 backdrop-blur-md sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          className="md:hidden text-zinc-400 hover:text-white"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>
        <div className="hidden md:flex items-center gap-2 text-sm text-zinc-400">
          <span className="hover:text-zinc-200 cursor-pointer transition-colors">
            مساحة العمل
          </span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-200 font-medium">
            {mainMode === "orchestrator"
              ? "منسق المهام"
              : mainMode === "workflow_editor"
                ? "محرر مسار العمل"
                : mainMode === "repository"
                  ? "المستودع"
                  : mainMode === "settings"
                    ? "الإعدادات"
                    : "مدقق النظام"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            placeholder="بحث عن مشروع..."
            className="bg-zinc-900 border border-zinc-800 rounded-md py-1.5 pr-9 pl-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 w-48 transition-all"
          />
        </div>
        
        {/* Notification Bell */}
        <div className="relative group">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative text-zinc-400 hover:text-white transition-colors p-2"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-rose-500 rounded-full border border-black flex items-center justify-center text-[8px] text-white font-bold">{unreadCount}</span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute left-0 mt-2 w-80 bg-[#121212] border border-white/10 rounded-xl shadow-2xl py-2 z-50">
              <div className="flex items-center justify-between px-4 pb-2 border-b border-white/5 mb-2">
                <span className="font-medium text-sm text-white">الإشعارات</span>
                {notifications.length > 0 && (
                  <button onClick={() => clearNotifications()} className="text-xs text-zinc-500 hover:text-zinc-300">مسح الكل</button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-zinc-500 text-sm">لا توجد إشعارات حالياً</div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => markNotificationRead(n.id)}
                      className={`px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${!n.read ? 'bg-indigo-500/5' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-indigo-500' : 'bg-transparent'}`} />
                        <div>
                          <p className={`text-sm ${!n.read ? 'text-zinc-200' : 'text-zinc-400'}`}>{n.message}</p>
                          <span className="text-[10px] text-zinc-600 mt-1 block">{new Date(n.timestamp).toLocaleTimeString('ar-SA')}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        <button 
          onClick={() => {
            setCurrentProjectId(null);
            setIdea("");
            setStageArtifacts({});
            setActivityLogs([]);
            setFinalPrompt("");
            setMockupHtml("");
            setCurrentStage(0);
            setGlobalMainMode('orchestrator');
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} /> مشروع جديد
        </button>
      </div>
    </header>
  );
}
