'use client';

import { ChangeEvent, DragEvent, KeyboardEvent, ReactNode, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import clsx from 'clsx';

export interface FileDropzoneProps {
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  /** Label shown while a drag is hovering over the zone (already translated by the caller). */
  dragLabel?: string;
  /** Optional label/instructions rendered inside the dropzone (already translated by the caller). */
  children?: ReactNode;
}

/**
 * Drag & drop area with a hidden multi-file `<input type="file">` for click-to-browse. No
 * file-reading or validation logic lives here — the caller decides what to do with the files.
 */
export default function FileDropzone({ onFilesSelect, accept, dragLabel, children }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // dragleave also fires when the pointer moves onto a child element; only reset on a real exit.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) onFilesSelect(files);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onFilesSelect(files);
    // Reset so selecting the same file(s) again still fires a change event.
    event.target.value = '';
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={clsx(
        'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-8 text-center text-sm transition-colors duration-150',
        isDragOver
          ? 'border-[var(--accent)] bg-[var(--bg-hover)] text-[var(--text-primary)]'
          : 'border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
      )}
    >
      <input ref={inputRef} type="file" multiple accept={accept} className="hidden" onChange={handleInputChange} />
      <UploadCloud
        size={32}
        strokeWidth={1.5}
        className={clsx('transition-transform duration-150', isDragOver ? '-translate-y-1 text-[var(--accent)]' : 'group-hover:-translate-y-0.5')}
      />
      {isDragOver && dragLabel ? <span>{dragLabel}</span> : children}
    </div>
  );
}
