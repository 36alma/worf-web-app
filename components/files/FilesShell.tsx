'use client';

import { ReactNode } from 'react';
import FilesSubNav from './FilesSubNav';

export interface FilesShellProps {
  children: ReactNode;
  /** Set to false for scopes with no sub-nav (e.g. group files — see Task 21 design note). */
  showSubNav?: boolean;
}

export default function FilesShell({ children, showSubNav = true }: FilesShellProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {showSubNav && <FilesSubNav />}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
