export function downloadText(
  fileName: string,
  content: string,
  type = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function copyText(content: string): Promise<void> {
  await navigator.clipboard.writeText(content);
}
