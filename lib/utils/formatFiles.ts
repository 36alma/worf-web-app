/** Format a byte count as a short human-readable size string, e.g. "1.2 MB". */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null || Number.isNaN(bytes)) {
    return '-';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/** Shorten a MIME type to a friendly label, falling back to the raw string. */
export function formatMimeType(mimeType: string | null): string {
  if (!mimeType) {
    return '-';
  }
  const knownLabels: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/gif': 'GIF',
    'image/webp': 'WEBP',
    'image/svg+xml': 'SVG',
    'text/plain': 'TXT',
    'text/csv': 'CSV',
    'application/zip': 'ZIP',
    'application/json': 'JSON',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  };
  if (knownLabels[mimeType]) {
    return knownLabels[mimeType];
  }
  if (mimeType.startsWith('image/')) {
    return mimeType.slice('image/'.length).toUpperCase();
  }
  return mimeType;
}

/** Format an ISO timestamp string as a locale date/time string. */
export function formatUploadedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export type FileCategory = 'image' | 'document' | 'spreadsheet' | 'other';

const SPREADSHEET_MIME_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** Bucket a MIME type into a coarse category used for filtering (image/document/spreadsheet/other). */
export function getFileCategory(mimeType: string | null): FileCategory {
  if (!mimeType) {
    return 'other';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (SPREADSHEET_MIME_TYPES.has(mimeType)) {
    return 'spreadsheet';
  }
  if (DOCUMENT_MIME_TYPES.has(mimeType)) {
    return 'document';
  }
  return 'other';
}

/**
 * Best-effort client-side cleanup for filenames the backend would reject
 * (accented characters, disallowed symbols, path separators). Strips
 * diacritics via Unicode NFD decomposition, then replaces any character
 * outside [a-zA-Z0-9._-()\s] with "_". Does not guarantee the backend will
 * accept the result (length/emptiness are not re-checked here) — callers
 * still run it through `filenameSchema` afterwards.
 */
export function sanitizeFilename(name: string): string {
  const withoutAccents = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return withoutAccents.replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
}
