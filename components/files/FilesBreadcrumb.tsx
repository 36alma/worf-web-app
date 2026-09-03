'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { getFolderMetadata } from '@/lib/api/folders';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

export interface BreadcrumbSegment {
  id: string;
  name: string;
}

export interface FilesBreadcrumbProps {
  folderId: string | null;
  /** e.g. "/hu/files" or "/hu/groups/xyz/files" — segment links are built as `${basePath}/folder/${id}` */
  basePath: string;
}

const MAX_VISIBLE_SEGMENTS = 4;

export default function FilesBreadcrumb({ folderId, basePath }: FilesBreadcrumbProps) {
  const t = useTranslations('files');
  const locale = useLocale();
  const [segments, setSegments] = useState<BreadcrumbSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIncomplete, setIsIncomplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!folderId) {
      setSegments([]);
      setIsIncomplete(false);
      return;
    }

    const resolveChain = async () => {
      setIsLoading(true);
      setIsIncomplete(false);
      const chain: BreadcrumbSegment[] = [];
      let currentId: string | null = folderId;
      let guard = 0;

      while (currentId && guard < 20) {
        guard += 1;
        try {
          const response = await getFolderMetadata(currentId);
          chain.unshift({ id: currentId, name: response.data.name });
          currentId = response.data.parent_folder_id;
        } catch {
          break;
        }
      }

      if (!cancelled) {
        setSegments(chain);
        setIsIncomplete(Boolean(currentId));
        setIsLoading(false);
      }
    };

    void resolveChain();

    return () => {
      cancelled = true;
    };
  }, [folderId]);

  const rootHref = `/${locale}${basePath}`;

  if (isLoading) {
    return <div className="h-5 w-40 animate-pulse rounded bg-[var(--bg-elevated)]" />;
  }

  const collapsed = segments.length > MAX_VISIBLE_SEGMENTS;
  const visible = collapsed
    ? [segments[0], ...segments.slice(segments.length - (MAX_VISIBLE_SEGMENTS - 1))]
    : segments;
  const hidden = collapsed ? segments.slice(1, segments.length - (MAX_VISIBLE_SEGMENTS - 1)) : [];

  return (
    <nav aria-label={t('breadcrumb.label')} className="flex items-center gap-1.5 overflow-x-auto text-sm text-[var(--text-secondary)]">
      {isIncomplete && (
        <span
          className="shrink-0 text-[var(--text-tertiary)]"
          title={t('breadcrumb.incompleteTitle')}
          aria-label={t('breadcrumb.incompleteTitle')}
        >
          …
        </span>
      )}
      <DroppableCrumb folderId={null} disabled={folderId === null}>
        <Link href={rootHref} className="shrink-0 hover:text-[var(--text-primary)] hover:underline">
          {t('page.title')}
        </Link>
      </DroppableCrumb>
      {visible.map((segment, index) => (
        <span key={segment.id} className="flex shrink-0 items-center gap-1.5">
          <ChevronRight size={14} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
          {collapsed && index === 1 && hidden.length > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded p-0.5 hover:bg-[var(--bg-hover)]" aria-label={t('breadcrumb.collapsedLabel')}>
                  <MoreHorizontal size={14} strokeWidth={1.75} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {hidden.map((h) => (
                    <DropdownMenuItem key={h.id} asChild>
                      <Link href={`/${locale}${basePath}/folder/${encodeURIComponent(h.id)}`}>{h.name}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ChevronRight size={14} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
            </>
          )}
          {index === visible.length - 1 ? (
            <span className="font-medium text-[var(--text-primary)]">{segment.name}</span>
          ) : (
            <DroppableCrumb folderId={segment.id}>
              <Link href={`/${locale}${basePath}/folder/${encodeURIComponent(segment.id)}`} className="hover:text-[var(--text-primary)] hover:underline">
                {segment.name}
              </Link>
            </DroppableCrumb>
          )}
        </span>
      ))}
    </nav>
  );
}

function DroppableCrumb({ folderId, disabled, children }: { folderId: string | null; disabled?: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder-drop:${folderId ?? 'root'}`, data: { folderId }, disabled });
  return (
    <span ref={setNodeRef} className={clsx('shrink-0 rounded px-0.5', isOver && !disabled && 'bg-[var(--bg-active)] ring-2 ring-inset ring-[var(--accent)]')}>
      {children}
    </span>
  );
}
