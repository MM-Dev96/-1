import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createProjectDraft,
  projectRepository,
  resetRepositoryConnectionForTests,
} from './repository.ts';
import {
  DEFAULT_WORKFLOW_EDGES,
  DEFAULT_WORKFLOW_NODES,
} from '../shared/defaultWorkflow.ts';

async function deleteDatabase(): Promise<void> {
  await resetRepositoryConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('nexus-saas');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database deletion blocked'));
  });
}

describe('project repository', () => {
  beforeEach(deleteDatabase);
  afterEach(deleteDatabase);

  it('persists projects and orders them by update time', async () => {
    const older = createProjectDraft({
      id: 'older',
      idea: 'فكرة المشروع الأقدم',
      profile: 'quick',
      model: 'mock',
      nodes: DEFAULT_WORKFLOW_NODES,
      edges: DEFAULT_WORKFLOW_EDGES,
    });
    const newer = {
      ...createProjectDraft({
        id: 'newer',
        idea: 'فكرة المشروع الأحدث',
        profile: 'balanced' as const,
        model: 'mock',
        nodes: DEFAULT_WORKFLOW_NODES,
        edges: DEFAULT_WORKFLOW_EDGES,
      }),
      updatedAt: older.updatedAt + 10,
    };
    await projectRepository.put(older);
    await projectRepository.put(newer);
    expect((await projectRepository.list()).map((project) => project.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('round-trips the JSON backup format', async () => {
    const project = createProjectDraft({
      id: 'backup',
      idea: 'فكرة النسخة الاحتياطية',
      profile: 'full',
      model: 'mock',
      nodes: DEFAULT_WORKFLOW_NODES,
      edges: DEFAULT_WORKFLOW_EDGES,
    });
    await projectRepository.put(project);
    const json = await projectRepository.exportJson();
    await deleteDatabase();
    expect(await projectRepository.importJson(json)).toBe(1);
    expect((await projectRepository.get('backup'))?.idea).toBe(project.idea);
  });
});
