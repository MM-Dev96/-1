import { randomUUID } from 'node:crypto';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type { Request, Response } from 'express';

interface PreviewEntry {
  id: string;
  files: Map<string, Buffer>;
  indexPath: string;
  createdAt: number;
}

export interface PreviewResult {
  id?: string;
  url?: string;
  files: string[];
  buildRequired: boolean;
  message?: string;
}

function normalizeFilePath(filePath: string): string {
  return filePath
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
}

function stripSharedRoot(files: Map<string, Buffer>): Map<string, Buffer> {
  const names = [...files.keys()];
  if (names.length === 0) return files;
  const firstSegments = names.map((name) => name.split('/')[0]);
  const root = firstSegments[0];
  if (!root || !firstSegments.every((segment) => segment === root)) return files;
  const stripped = new Map<string, Buffer>();
  for (const [name, buffer] of files) {
    const next = name.split('/').slice(1).join('/');
    if (next) stripped.set(next, buffer);
  }
  return stripped.size > 0 ? stripped : files;
}

function extractFiles(uploads: Express.Multer.File[]): Map<string, Buffer> {
  if (
    uploads.length === 1 &&
    uploads[0] &&
    uploads[0].originalname.toLowerCase().endsWith('.zip')
  ) {
    const zip = new AdmZip(uploads[0].buffer);
    const files = new Map<string, Buffer>();
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const name = normalizeFilePath(entry.entryName);
      if (name && !name.startsWith('__MACOSX/')) {
        files.set(name, entry.getData());
      }
    }
    return stripSharedRoot(files);
  }

  const files = new Map<string, Buffer>();
  for (const upload of uploads) {
    const name = normalizeFilePath(upload.originalname);
    if (name) files.set(name, upload.buffer);
  }
  return stripSharedRoot(files);
}

function findIndex(files: Map<string, Buffer>): string | null {
  const candidates = [...files.keys()].filter((name) =>
    /(^|\/)index\.html$/i.test(name),
  );
  return (
    candidates.find((name) => name.toLowerCase() === 'index.html') ??
    candidates.find((name) => name.toLowerCase() === 'public/index.html') ??
    candidates.sort((a, b) => a.split('/').length - b.split('/').length)[0] ??
    null
  );
}

export class PreviewStore {
  private readonly entries = new Map<string, PreviewEntry>();
  private readonly lifetimeMs = 30 * 60 * 1000;

  constructor() {
    const timer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    timer.unref();
  }

  create(uploads: Express.Multer.File[]): PreviewResult {
    const files = extractFiles(uploads);
    const fileNames = [...files.keys()].sort();
    const indexPath = findIndex(files);
    if (!indexPath) {
      const hasBuildProject =
        files.has('package.json') ||
        fileNames.some((name) => /(^|\/)(vite|next)\.config\./i.test(name));
      return {
        files: fileNames,
        buildRequired: hasBuildProject,
        message: hasBuildProject
          ? 'المجلد يحتوي مشروعًا يحتاج build. المعاينة الثابتة تقبل ناتج dist أو build الذي يحتوي index.html.'
          : 'لم يُعثر على index.html داخل الملفات.',
      };
    }

    const id = randomUUID();
    this.entries.set(id, { id, files, indexPath, createdAt: Date.now() });
    return {
      id,
      url: `/api/previews/${id}/`,
      files: fileNames,
      buildRequired: false,
    };
  }

  serve(request: Request, response: Response): void {
    const entry = this.entries.get(request.params.id ?? '');
    if (!entry) {
      response.status(404).send('Preview expired or not found.');
      return;
    }
    const wildcard = request.params[0] ?? '';
    const baseDir = path.posix.dirname(entry.indexPath);
    const requested =
      wildcard.trim() === ''
        ? entry.indexPath
        : normalizeFilePath(path.posix.join(baseDir, wildcard));
    const file = entry.files.get(requested);
    if (!file) {
      response.status(404).send('Preview file not found.');
      return;
    }
    response.type(path.posix.extname(requested) || 'application/octet-stream');
    response.send(file);
  }

  delete(id: string): boolean {
    return this.entries.delete(id);
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.lifetimeMs;
    for (const [id, entry] of this.entries) {
      if (entry.createdAt < cutoff) this.entries.delete(id);
    }
  }
}
