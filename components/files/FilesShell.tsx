'use client';

import { ReactNode } from 'react';

export interface FilesShellProps {
  children: ReactNode;
}

export default function FilesShell({ children }: FilesShellProps) {
  return <div className="mx-auto max-w-5xl">{children}</div>;
}
