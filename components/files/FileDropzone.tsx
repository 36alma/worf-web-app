'use client';

import { ChangeEvent, DragEvent, KeyboardEvent, ReactNode, useRef, useState } from 'react';
import clsx from 'clsx';

export interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  /** Optional label/instructions rendered inside the dropzone (already translated by the caller). */
  children?: ReactNode;
}

/**
 * Simple drag & drop area with a hidden `<input type="file">` fallback. No file-reading or
 * validation logic lives here — the caller decides what to do with the selected `File`.
 */
export default function FileDropzone({ onFileSelect, accept, children }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileSelect(file);
    // Reset so selecting the same file again still fires a change event.
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
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed px-4 py-8 text-center text-sm transition-colors duration-150',
        isDragOver
          ? 'border-[var(--accent)] bg-[var(--bg-hover)] text-[var(--text-primary)]'
          : 'border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]'
      )}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleInputChange} />
      {children}
    </div>
  );
}
