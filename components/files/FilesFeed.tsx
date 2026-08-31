'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { LayoutGrid, List, Search } from 'lucide-react';
import { listFiles, type FileListItem } from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { getFileCategory, type FileCategory } from '@/lib/utils/formatFiles';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import FileTable from '@/components/files/FileTable';
import FileGrid from '@/components/files/FileGrid';
import UploadDialog from '@/components/files/UploadDialog';
import FileDetailSheet from '@/components/files/FileDetailSheet';

type CategoryFilter = FileCategory | 'all';
type ViewMode = 'list' | 'grid';

export interface FilesFeedProps {
  mode: 'private' | 'group';
  groupId?: string;
}

const DEFAULT_LIMIT = 20;

export default function FilesFeed({ mode, groupId }: FilesFeedProps) {
  const t = useTranslations('files');
  const locale = useLocale();

  const [items, setItems] = useState<FileListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(DEFAULT_LIMIT);
  const [isLoading, setIsLoading] = useState(true);

  // ── Refresh mechanism ────────────────────────────────────────────
  // `refreshKey` is bumped by `refetch()` below to force the load effect
  // to re-run without changing offset/limit. Task 3 (upload) is expected
  // to call `refetch()` from inside this component (e.g. after edit,
  // once the upload button/dialog is added here) to pull in the new file.
  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = useCallback(() => setRefreshKey((key) => key + 1), []);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [view, setView] = useState<ViewMode>('list');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await listFiles({
          scope: mode,
          group_id: mode === 'group' ? groupId : undefined,
          offset,
          limit,
        });
        if (!mounted) return;
        setItems(response.data.items);
        setTotal(response.data.total);
      } catch (error) {
        if (!mounted) return;
        setItems([]);
        setTotal(0);
        toast.error(translateFileApiError(t, error, 'errors.default'));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [mode, groupId, offset, limit, refreshKey, t]);

  const title = mode === 'group' ? t('groupPage.title') : t('page.title');
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  // Search/category filtering runs client-side over the currently loaded page,
  // since the list API has no query/category params yet.
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'all' && getFileCategory(item.mime_type) !== category) {
        return false;
      }
      if (query && !item.original_name.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [items, search, category]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
        <div className="flex items-center gap-2">
          {mode === 'private' && (
            <Link href={`/${locale}/files/trash`}>
              <Button type="button" variant="secondary">
                {t('trash.title')}
              </Button>
            </Link>
          )}
          <Button type="button" variant="primary" onClick={() => setIsUploadOpen(true)}>
            {t('upload.submit')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <Input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('toolbar.searchPlaceholder')}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
            <TabsList>
              <TabsTrigger value="all">{t('toolbar.filters.all')}</TabsTrigger>
              <TabsTrigger value="document">{t('toolbar.filters.documents')}</TabsTrigger>
              <TabsTrigger value="image">{t('toolbar.filters.images')}</TabsTrigger>
              <TabsTrigger value="spreadsheet">{t('toolbar.filters.spreadsheets')}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] p-1">
            <button
              type="button"
              aria-label={t('toolbar.view.list')}
              onClick={() => setView('list')}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${
                view === 'list'
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <List size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label={t('toolbar.view.grid')}
              onClick={() => setView('grid')}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${
                view === 'grid'
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <LayoutGrid size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <UploadDialog
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        mode={mode}
        groupId={groupId}
        onUploaded={refetch}
      />

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        </div>
      ) : view === 'grid' ? (
        <FileGrid items={filteredItems} onSelectFile={setSelectedFileId} />
      ) : (
        <FileTable items={filteredItems} onSelectFile={setSelectedFileId} />
      )}

      <FileDetailSheet
        fileId={selectedFileId}
        onClose={() => setSelectedFileId(null)}
        onDeleted={() => {
          setSelectedFileId(null);
          refetch();
        }}
      />

      {!isLoading && total > limit && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">
            {t('table.pagination.range', {
              from: total === 0 ? 0 : offset + 1,
              to: Math.min(offset + limit, total),
              total,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasPrev}
              onClick={() => setOffset((current) => Math.max(0, current - limit))}
            >
              {t('table.pagination.prev')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasNext}
              onClick={() => setOffset((current) => current + limit)}
            >
              {t('table.pagination.next')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
