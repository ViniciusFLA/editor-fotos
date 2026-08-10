export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface ExportOptions {
  format: ExportFormat;
  scale: number;
}

export function getExportFileName(format: ExportFormat): string {
  const projectName = 'creative';
  const date = new Date().toISOString().slice(0, 10);
  const ext = format === 'jpeg' ? 'jpg' : format;
  return `${projectName}-${date}.${ext}`;
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
