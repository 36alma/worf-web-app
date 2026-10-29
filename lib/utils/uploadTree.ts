/** A file picked or dropped for upload, with the folder path (relative to the target folder) it came from. */
export interface PendingUpload {
  file: File;
  dir: string[];
}

export interface PendingUploadSummary {
  fileCount: number;
  folderCount: number;
  totalBytes: number;
}

/** Builds the pending list from an `<input webkitdirectory>` / plain file input selection. */
export function fromFileList(files: File[]): PendingUpload[] {
  return files.map((file) => {
    const relative = file.webkitRelativePath;
    return { file, dir: relative ? relative.split('/').slice(0, -1) : [] };
  });
}

const readAllEntries = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    // readEntries returns results in batches; an empty batch means the directory is exhausted.
    const readBatch = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) return resolve(all);
        all.push(...batch);
        readBatch();
      }, reject);
    readBatch();
  });

const readFile = (entry: FileSystemFileEntry) => new Promise<File>((resolve, reject) => entry.file(resolve, reject));

async function walkEntry(entry: FileSystemEntry, dir: string[], out: PendingUpload[]): Promise<void> {
  if (entry.isFile) {
    out.push({ file: await readFile(entry as FileSystemFileEntry), dir });
  } else if (entry.isDirectory) {
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    for (const child of children) await walkEntry(child, [...dir, entry.name], out);
  }
}

/**
 * Builds the pending list from a drop event, walking dropped directories.
 * The entries are captured before the first await — a DataTransfer is only
 * readable synchronously during the event dispatch.
 */
export async function fromDataTransfer(dataTransfer: DataTransfer): Promise<PendingUpload[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => (item.kind === 'file' ? item.webkitGetAsEntry() : null))
    .filter((entry): entry is FileSystemEntry => entry !== null);
  if (entries.length === 0) return fromFileList(Array.from(dataTransfer.files));
  const out: PendingUpload[] = [];
  for (const entry of entries) await walkEntry(entry, [], out);
  return out;
}

export function summarizePending(pending: PendingUpload[]): PendingUploadSummary {
  const folders = new Set<string>();
  let totalBytes = 0;
  for (const { file, dir } of pending) {
    totalBytes += file.size;
    dir.forEach((_, index) => folders.add(dir.slice(0, index + 1).join('/')));
  }
  return { fileCount: pending.length, folderCount: folders.size, totalBytes };
}
