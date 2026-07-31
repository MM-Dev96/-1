import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CalendarDays,
  Download,
  FileJson,
  FileText,
  FolderOpen,
  Import,
  LoaderCircle,
  Search,
  Trash2,
} from 'lucide-react';
import { Modal } from './Modal.tsx';
import { downloadText } from '../lib/download.ts';
import { projectRepository } from '../lib/repository.ts';
import type { ProjectRecord } from '../shared/contracts.ts';
import { useAppStore } from '../store.ts';

function projectMarkdown(project: ProjectRecord): string {
  const artifacts = Object.entries(project.artifacts)
    .map(([id, content]) => `## ${id}\n\n${content}`)
    .join('\n\n---\n\n');
  return `# ${project.name}

## الفكرة

${project.idea}

## البرومبت النهائي

${project.finalPrompt || 'لم يُنشأ بعد.'}

## ملفات المراحل

${artifacts || 'لا توجد ملفات بعد.'}
`;
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

export default function Repository() {
  const loadProject = useAppStore((state) => state.loadProject);
  const pushToast = useAppStore((state) => state.pushToast);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      await projectRepository.migrateLegacyProjects();
      setProjects(await projectRepository.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void projectRepository
      .migrateLegacyProjects()
      .then(() => projectRepository.list())
      .then((records) => {
        if (active) setProjects(records);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.idea.toLowerCase().includes(query),
    );
  }, [projects, search]);

  const exportAll = async () => {
    const json = await projectRepository.exportJson();
    downloadText('nexus-projects.json', json, 'application/json');
    pushToast('export-projects', 'نُزّلت نسخة احتياطية من المشاريع.', 'success');
  };

  const importFile = async (file: File) => {
    try {
      const count = await projectRepository.importJson(await file.text());
      await refresh();
      pushToast('import-projects', `استُورد ${count} مشروع.`, 'success');
    } catch (error) {
      pushToast(
        'import-error',
        error instanceof Error ? error.message : 'تعذر الاستيراد.',
        'error',
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await projectRepository.delete(deleteTarget.id);
    setProjects((current) =>
      current.filter((project) => project.id !== deleteTarget.id),
    );
    pushToast(`deleted:${deleteTarget.id}`, 'حُذف المشروع المحلي.', 'success');
    setDeleteTarget(null);
  };

  return (
    <div className="page repository-page">
      <section className="page-header">
        <div>
          <div className="eyebrow">
            <Archive size={16} />
            IndexedDB
          </div>
          <h1>مستودع المشاريع</h1>
          <p>كل مشروع ونسخه وملفاته محفوظة محليًا في هذا المتصفح.</p>
        </div>
        <div className="header-actions">
          <input
            ref={importRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = '';
            }}
          />
          <button
            className="secondary-button"
            onClick={() => importRef.current?.click()}
          >
            <Import size={18} />
            استيراد
          </button>
          <button
            className="secondary-button"
            onClick={() => void exportAll()}
            disabled={projects.length === 0}
          >
            <FileJson size={18} />
            نسخة JSON
          </button>
        </div>
      </section>

      <div className="repository-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو الفكرة…"
          />
        </label>
        <span>{filtered.length.toLocaleString('ar-SA')} مشروع</span>
      </div>

      {loading ? (
        <div className="page-loading">
          <LoaderCircle className="spin" />
          <p>جارِ قراءة المشاريع…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state empty-state--large">
          <FolderOpen size={38} />
          <strong>{search ? 'لا توجد نتيجة' : 'لا توجد مشاريع محفوظة'}</strong>
          <p>
            {search
              ? 'جرّب كلمة أخرى.'
              : 'شغّل أول فكرة وسيظهر المشروع هنا تلقائيًا.'}
          </p>
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card__top">
                <span className={`project-status is-${project.status}`}>
                  {project.status === 'completed'
                    ? 'مكتمل'
                    : project.status === 'running'
                      ? 'قيد العمل'
                      : project.status === 'failed'
                        ? 'متوقف'
                        : 'مسودة'}
                </span>
                <button
                  className="danger-icon"
                  onClick={() => setDeleteTarget(project)}
                  aria-label={`حذف ${project.name}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <h2>{project.name}</h2>
              <p>{project.idea || 'مشروع دون وصف.'}</p>
              <div className="project-card__stats">
                <span>
                  <FileText size={15} />
                  {Object.keys(project.artifacts).length} ملفات
                </span>
                <span>
                  <Archive size={15} />
                  {project.versions.length} نسخ
                </span>
              </div>
              <div className="project-card__date">
                <CalendarDays size={15} />
                {formatDate(project.updatedAt)}
              </div>
              <div className="project-card__actions">
                <button
                  className="primary-button"
                  onClick={() => loadProject(project)}
                >
                  <FolderOpen size={17} />
                  فتح المشروع
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    downloadText(
                      `${project.name.replaceAll(/\s+/g, '-')}.md`,
                      projectMarkdown(project),
                    )
                  }
                >
                  <Download size={17} />
                  Markdown
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {deleteTarget && (
        <Modal title="تأكيد حذف المشروع" onClose={() => setDeleteTarget(null)}>
          <div className="confirm-copy">
            <Trash2 size={30} />
            <p>
              سيُحذف <strong>{deleteTarget.name}</strong> من هذا المتصفح. يمكنك
              استعادته فقط إذا صدّرت نسخة JSON سابقًا.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => setDeleteTarget(null)}
            >
              إلغاء
            </button>
            <button className="danger-button" onClick={() => void confirmDelete()}>
              حذف نهائي
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
