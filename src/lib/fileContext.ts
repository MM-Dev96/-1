const relevantExtensions = new Set([
  'txt',
  'md',
  'json',
  'ts',
  'tsx',
  'js',
  'jsx',
  'html',
  'css',
  'yaml',
  'yml',
  'sql',
]);

export interface FileContextResult {
  text: string;
  included: string[];
  ignored: string[];
  truncated: boolean;
}

export async function readFileContext(
  files: File[],
  limit = 160_000,
): Promise<FileContextResult> {
  const included: string[] = [];
  const ignored: string[] = [];
  const sections: string[] = [];
  let length = 0;
  let truncated = false;
  for (const file of files.slice(0, 40)) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!relevantExtensions.has(extension) || file.size > 500_000) {
      ignored.push(file.name);
      continue;
    }
    const content = await file.text();
    const remaining = limit - length;
    if (remaining <= 0) {
      truncated = true;
      ignored.push(file.name);
      continue;
    }
    const section = `\n\n## FILE: ${file.name}\n${content.slice(0, remaining)}`;
    sections.push(section);
    included.push(file.name);
    length += section.length;
    if (content.length > remaining) truncated = true;
  }
  return { text: sections.join(''), included, ignored, truncated };
}
