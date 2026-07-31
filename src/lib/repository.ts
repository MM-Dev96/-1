import type {
  ProjectRecord,
  ProjectVersion,
  WorkflowEdge,
  WorkflowNodeDefinition,
  WorkflowProfile,
} from '../shared/contracts.ts';
import {
  DEFAULT_WORKFLOW_EDGES,
  DEFAULT_WORKFLOW_NODES,
} from '../shared/defaultWorkflow.ts';

const DATABASE_NAME = 'nexus-saas';
const DATABASE_VERSION = 2;
const PROJECT_STORE = 'projects';
const MIGRATION_MARKER = 'nexus:idb-migrated-v2';

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        const store = database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('status', 'status');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('تعذر فتح قاعدة المشاريع المحلية.'));
  });
  return databasePromise;
}

function isProfile(value: unknown): value is WorkflowProfile {
  return value === 'quick' || value === 'balanced' || value === 'full';
}

function legacyProject(value: unknown): ProjectRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id =
    typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID();
  const createdAt =
    typeof item.createdAt === 'number' ? item.createdAt : Date.now();
  const oldArtifacts =
    item.stageArtifacts &&
    typeof item.stageArtifacts === 'object' &&
    !Array.isArray(item.stageArtifacts)
      ? (item.stageArtifacts as Record<string, unknown>)
      : {};
  const artifacts: Record<string, string> = {};
  for (const [key, content] of Object.entries(oldArtifacts)) {
    if (typeof content === 'string') artifacts[key] = content;
  }
  const finalPrompt =
    typeof item.finalPrompt === 'string' ? item.finalPrompt : '';
  const versions: ProjectVersion[] = finalPrompt
    ? [
        {
          id: crypto.randomUUID(),
          createdAt,
          label: 'نسخة مستوردة',
          finalPrompt,
        },
      ]
    : [];
  return {
    id,
    name:
      typeof item.name === 'string' && item.name.trim()
        ? item.name
        : 'مشروع مستورد',
    idea: typeof item.idea === 'string' ? item.idea : '',
    status: finalPrompt ? 'completed' : 'draft',
    profile: isProfile(item.profile) ? item.profile : 'balanced',
    model:
      typeof item.model === 'string' && item.model
        ? item.model
        : 'gemini-2.5-flash',
    nodes: structuredClone(DEFAULT_WORKFLOW_NODES),
    edges: structuredClone(DEFAULT_WORKFLOW_EDGES),
    artifacts,
    finalPrompt,
    mockupHtml: typeof item.mockupHtml === 'string' ? item.mockupHtml : '',
    versions,
    createdAt,
    updatedAt: createdAt,
  };
}

async function migrateLegacyProjects(): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(MIGRATION_MARKER)) return;
  try {
    const raw = localStorage.getItem('app-store');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { projects?: unknown[] } };
      for (const item of parsed.state?.projects ?? []) {
        const project = legacyProject(item);
        if (project) await projectRepository.put(project);
      }
    }
    localStorage.setItem(MIGRATION_MARKER, '1');
  } catch {
    localStorage.setItem(MIGRATION_MARKER, 'failed');
  }
}

function assertProject(value: unknown): ProjectRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ملف المشروع غير صالح.');
  }
  const project = value as Partial<ProjectRecord>;
  if (
    typeof project.id !== 'string' ||
    typeof project.name !== 'string' ||
    typeof project.idea !== 'string' ||
    !Array.isArray(project.nodes) ||
    !Array.isArray(project.edges)
  ) {
    throw new Error('ملف المشروع يفتقد الحقول الأساسية.');
  }
  return project as ProjectRecord;
}

export const projectRepository = {
  async list(): Promise<ProjectRecord[]> {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const records = await requestResult(
      transaction.objectStore(PROJECT_STORE).getAll() as IDBRequest<ProjectRecord[]>,
    );
    await transactionDone(transaction);
    return records.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(id: string): Promise<ProjectRecord | null> {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const record = await requestResult(
      transaction.objectStore(PROJECT_STORE).get(id) as IDBRequest<
        ProjectRecord | undefined
      >,
    );
    await transactionDone(transaction);
    return record ?? null;
  },

  async put(project: ProjectRecord): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readwrite');
    transaction.objectStore(PROJECT_STORE).put(structuredClone(project));
    await transactionDone(transaction);
  },

  async delete(id: string): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(PROJECT_STORE, 'readwrite');
    transaction.objectStore(PROJECT_STORE).delete(id);
    await transactionDone(transaction);
  },

  async exportJson(): Promise<string> {
    const projects = await this.list();
    return JSON.stringify(
      { format: 'nexus-saas', version: 2, exportedAt: Date.now(), projects },
      null,
      2,
    );
  },

  async importJson(json: string): Promise<number> {
    const parsed = JSON.parse(json) as unknown;
    const container =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    const values = Array.isArray(container?.projects)
      ? container.projects
      : [parsed];
    let count = 0;
    for (const value of values) {
      const project = assertProject(value);
      await this.put({ ...project, updatedAt: Date.now() });
      count += 1;
    }
    return count;
  },

  migrateLegacyProjects,
};

export function createProjectDraft(input: {
  id?: string;
  idea: string;
  profile: WorkflowProfile;
  model: string;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdge[];
}): ProjectRecord {
  const timestamp = Date.now();
  return {
    id: input.id ?? crypto.randomUUID(),
    name: input.idea.trim().split(/\s+/).slice(0, 6).join(' ') || 'فكرة جديدة',
    idea: input.idea,
    status: 'draft',
    profile: input.profile,
    model: input.model,
    nodes: structuredClone(input.nodes),
    edges: structuredClone(input.edges),
    artifacts: {},
    finalPrompt: '',
    mockupHtml: '',
    versions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function resetRepositoryConnectionForTests(): Promise<void> {
  if (databasePromise) {
    const database = await databasePromise;
    database.close();
  }
  databasePromise = null;
}
