import { describe, expect, it } from 'vitest';
import { PreviewStore } from './previewStore.ts';

function upload(name: string, content: string): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname: name,
    encoding: '7bit',
    mimetype: 'text/plain',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
  } as Express.Multer.File;
}

describe('PreviewStore', () => {
  it('accepts built static files that contain index.html', () => {
    const store = new PreviewStore();
    const result = store.create([
      upload('site/index.html', '<!doctype html><link rel="stylesheet" href="style.css">'),
      upload('site/style.css', 'body{color:red}'),
    ]);
    expect(result.id).toBeTruthy();
    expect(result.url).toMatch(/^\/api\/previews\//);
    expect(result.buildRequired).toBe(false);
  });

  it('reports source projects that require a build instead of pretending to run them', () => {
    const store = new PreviewStore();
    const result = store.create([
      upload('package.json', '{"scripts":{"build":"vite build"}}'),
      upload('src/App.tsx', 'export default function App(){return null}'),
    ]);
    expect(result.id).toBeUndefined();
    expect(result.buildRequired).toBe(true);
    expect(result.message).toContain('build');
  });
});
