import React, { useState } from 'react';
import { useAppStore, Project } from '../store';
import { Archive, Trash2, Edit3, LayoutTemplate, Play, Shield, Terminal, ArrowRight, Eye, Code2, AlertCircle, Bot } from 'lucide-react';

export default function Repository() {
  const { projects, removeProject, setIdea, setFinalPrompt, setMockupHtml, setMainMode, setActiveTab, setCurrentProjectId, setCurrentStage, setStageArtifacts, setActivityLogs } = useAppStore();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [repoTab, setRepoTab] = useState<'preview' | 'code' | 'artifacts'>('preview');
  const [selectedArtifactIndex, setSelectedArtifactIndex] = useState<number>(0);

  const loadProjectToOrchestrator = (project: Project, problem: string | null = null) => {
    let newIdea = project.idea;
    if (problem) {
      newIdea = `${project.idea}\n\nتعديلات مطلوبة:\n${problem}`;
    }
    setIdea(newIdea);
    setFinalPrompt(project.finalPrompt || '');
    setMockupHtml(project.mockupHtml || '');
    setCurrentStage(project.currentStage || 0);
    setStageArtifacts(project.stageArtifacts || {});
    setActivityLogs(project.activityLogs || []);
    setCurrentProjectId(project.id);
    setActiveTab('edit');
    setMainMode('orchestrator');
  };

  if (selectedProject) {
    return (
      <div className="flex flex-col h-full gap-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between bg-[#0f0f0f] border border-white/10 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedProject(null)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 text-zinc-400 hover:text-white"
            >
              <ArrowRight size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold text-white">{selectedProject.name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedProject.status === 'مكتمل' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'}`}>
                  {selectedProject.status}
                </span>
              </div>
              <p className="text-xs text-zinc-500">تم الحفظ في: {new Date(selectedProject.createdAt).toLocaleString('ar-SA')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (selectedProject.status === 'مكتمل') {
                  const problem = window.prompt('اذكر المشكلة أو التعديل المطلوب:');
                  if (problem !== null) {
                    loadProjectToOrchestrator(selectedProject, problem);
                  }
                } else {
                  loadProjectToOrchestrator(selectedProject);
                }
              }}
              className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              {selectedProject.status === 'مكتمل' ? <><Edit3 size={16} /> تعديل المشروع</> : <><Play size={16} /> استكمال المشروع</>}
            </button>
            <button
              onClick={() => {
                if (window.confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
                  removeProject(selectedProject.id);
                  setSelectedProject(null);
                }
              }}
              className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              <Trash2 size={16} /> حذف
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[#050505] relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
          <div className="bg-[#0f0f0f] p-2 border-b border-white/10 flex items-center gap-2">
            <div className="flex bg-black/50 p-1 rounded-lg border border-white/5">
              <button
                onClick={() => setRepoTab('preview')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all font-medium ${repoTab === 'preview' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Eye size={14} /> معاينة حية
              </button>
              <button
                onClick={() => setRepoTab('code')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all font-medium ${repoTab === 'code' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Code2 size={14} /> الكود المصدري
              </button>
              <button
                onClick={() => setRepoTab('artifacts')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-all font-medium ${repoTab === 'artifacts' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Bot size={14} /> مخرجات المراحل
              </button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden flex flex-col">
            {repoTab === 'preview' && (
              selectedProject.mockupHtml ? (
                <iframe
                  srcDoc={selectedProject.mockupHtml}
                  className="w-full flex-1 border-0 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                  title="Project Preview"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] text-zinc-500">
                  <LayoutTemplate size={48} className="mb-4 opacity-50" />
                  <p>لا توجد معاينة متوفرة لهذا المشروع.</p>
                </div>
              )
            )}

            {repoTab === 'code' && (
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#0a0a0a]">
                <textarea
                  readOnly
                  value={selectedProject.finalPrompt || "لا يوجد كود مصدري متاح."}
                  dir="ltr"
                  className="w-full h-full bg-transparent text-zinc-300 font-mono text-sm resize-none focus:outline-none"
                  spellCheck="false"
                />
              </div>
            )}

            {repoTab === 'artifacts' && (
              <div className="flex-1 flex overflow-hidden">
                <div className="w-64 bg-[#0a0a0a] border-l border-white/5 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                  {Object.entries(selectedProject.stageArtifacts || {}).map(([indexStr, content]) => {
                    const idx = parseInt(indexStr);
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedArtifactIndex(idx)}
                        className={`text-right p-3 rounded-lg text-sm transition-all ${
                          selectedArtifactIndex === idx
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            : "hover:bg-white/5 text-zinc-400 border border-transparent"
                        }`}
                      >
                        <div className="font-medium mb-1">المرحلة {idx + 1}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{content.substring(0, 30)}...</div>
                      </button>
                    );
                  })}
                  {Object.keys(selectedProject.stageArtifacts || {}).length === 0 && (
                    <div className="text-center p-4 text-zinc-500 text-xs">لا توجد مخرجات مسجلة.</div>
                  )}
                </div>
                <div className="flex-1 p-4 bg-[#050505] overflow-y-auto custom-scrollbar">
                  <textarea
                    readOnly
                    value={selectedProject.stageArtifacts?.[selectedArtifactIndex] || "اختر إحدى المراحل لعرض المخرجات."}
                    dir="ltr"
                    className="w-full h-full bg-transparent text-emerald-400/90 font-mono text-sm resize-none focus:outline-none"
                    spellCheck="false"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-full bg-[#0f0f0f] border border-white/10 p-12 rounded-2xl flex flex-col items-center justify-center text-center text-zinc-500 gap-4">
            <Archive size={48} className="opacity-20" />
            <div>
              <p className="font-medium text-zinc-300 mb-1">المستودع فارغ</p>
              <p className="text-sm">لم تقم بحفظ أي مشاريع بعد. يمكنك حفظ المشاريع من صفحة المنسق بعد اكتمالها.</p>
            </div>
          </div>
        ) : (
          projects.map(project => (
            <div key={project.id} className="bg-[#0f0f0f] border border-white/10 hover:border-white/20 p-5 rounded-2xl flex flex-col gap-4 transition-all group shadow-lg hover:shadow-xl">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                  <LayoutTemplate size={20} className="text-indigo-400" />
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
                      removeProject(project.id);
                    }
                  }}
                  className="text-zinc-600 hover:text-rose-400 transition-colors p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-semibold text-white truncate pr-2">{project.name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${project.status === 'مكتمل' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'}`}>
                    {project.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">{new Date(project.createdAt).toLocaleDateString('ar-SA')}</p>
              </div>

              <div className="text-sm text-zinc-400 line-clamp-2 bg-black/40 p-3 rounded-xl border border-white/5 flex-1">
                {project.idea}
              </div>

              <div className="mt-auto pt-2 flex gap-2">
                <button
                  onClick={() => setSelectedProject(project)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm font-medium transition-colors border border-white/5 flex items-center justify-center gap-2"
                >
                  <Eye size={16} /> معاينة
                </button>
                <button
                  onClick={() => {
                    if (project.status === 'مكتمل') {
                      const problem = window.prompt('اذكر المشكلة أو التعديل المطلوب:');
                      if (problem !== null) {
                        loadProjectToOrchestrator(project, problem);
                      }
                    } else {
                      loadProjectToOrchestrator(project);
                    }
                  }}
                  className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 py-2 px-3 rounded-lg transition-colors border border-indigo-500/20"
                  title={project.status === 'مكتمل' ? 'تعديل' : 'استكمال'}
                >
                  {project.status === 'مكتمل' ? <Edit3 size={16} /> : <Play size={16} />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
