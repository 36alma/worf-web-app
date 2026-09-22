'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {BellRing, FileUp, Plus, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import MinutesCard from './MinutesCard';
import {
  MINUTES_STATUSES,
  type MeetingMinutes,
  type MinutesListResponse,
  type MinutesStatus,
  type MinutesTagCount
} from './types';
import {listMinutes, listMinutesTags, listPendingWitnessMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError, translateMinutesStatus} from '@/lib/i18n/minutes';

export interface MinutesListClientProps {
  groupId: string;
  permissions: {create: boolean; approve: boolean; delete: boolean};
}

const ALL = 'ALL';

/** Which records the list shows: the default hides the archived ones (`archived_at`), `all` sends `archived: null`. */
type ArchivedView = 'active' | 'archived' | 'all';
const ARCHIVED_PARAM: Record<ArchivedView, boolean | null> = {active: false, archived: true, all: null};
const ARCHIVED_LABEL = {
  active: 'list.filter_archived_active',
  archived: 'list.filter_archived_only',
  all: 'list.filter_archived_all'
} as const;

export default function MinutesListClient({groupId, permissions}: MinutesListClientProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const [minutes, setMinutes] = useState<MeetingMinutes[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<MinutesStatus | typeof ALL>(ALL);
  const [archivedView, setArchivedView] = useState<ArchivedView>('active');
  const [tagFilter, setTagFilter] = useState<string>(ALL);
  /** The group's tags (with usage counts) — the options of the tag filter. */
  const [tags, setTags] = useState<MinutesTagCount[]>([]);
  /** `witness/pending`: the records awaiting *this* user's vote — the server does the matching. */
  const [pending, setPending] = useState<MeetingMinutes[]>([]);
  const [onlyPending, setOnlyPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {data} = await listMinutes({
        group_id: groupId,
        page_number: 1,
        load_number: 20,
        status: statusFilter === ALL ? undefined : statusFilter,
        tag: tagFilter === ALL ? undefined : tagFilter,
        archived: ARCHIVED_PARAM[archivedView]
      });
      const payload = data as MinutesListResponse;
      setMinutes(payload.minutes ?? []);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setLoading(false);
    }
  }, [groupId, statusFilter, archivedView, tagFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    listMinutesTags({group_id: groupId})
      .then(({data}) => mounted && setTags((data as {tags?: MinutesTagCount[]}).tags ?? []))
      .catch(() => mounted && setTags([]));
    return () => {
      mounted = false;
    };
  }, [groupId]);

  useEffect(() => {
    if (!permissions.approve) {
      setPending([]);
      return;
    }
    let mounted = true;
    listPendingWitnessMinutes({group_id: groupId, page_number: 1, load_number: 50})
      .then(({data}) => mounted && setPending((data as MinutesListResponse).minutes ?? []))
      .catch(() => mounted && setPending([]));
    return () => {
      mounted = false;
    };
  }, [groupId, permissions.approve]);

  const pendingIds = useMemo(() => new Set(pending.map((m) => m.id)), [pending]);
  // The server orders tags by code point; the filter should follow the UI language.
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name, locale, {sensitivity: 'base'})),
    [tags, locale]
  );
  const visible = onlyPending ? pending : minutes;
  const filtered = statusFilter !== ALL || tagFilter !== ALL || archivedView !== 'active';

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('list.title')}</h1>
        <div className="flex flex-wrap gap-2">
          {permissions.delete && (
            <Link href={`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/trash`}>
              <Button variant="ghost" startIcon={<Trash2 className="h-4 w-4" />}>
                {t('list.trash')}
              </Button>
            </Link>
          )}
          {permissions.create && (
            <>
              <Link href={`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/import`}>
                <Button variant="secondary" startIcon={<FileUp className="h-4 w-4" />}>
                  {t('list.import')}
                </Button>
              </Link>
              <Link href={`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/new`}>
                <Button variant="primary" startIcon={<Plus className="h-4 w-4" />}>
                  {t('list.create')}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--text-secondary)]">{t('list.filter_status_label')}</span>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MinutesStatus | typeof ALL)}>
          <SelectTrigger className="w-52" aria-label={t('list.filter_status_label')} disabled={onlyPending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('list.filter_status_all')}</SelectItem>
            {MINUTES_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {translateMinutesStatus(t, status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-[var(--text-secondary)]">{t('list.filter_archived_label')}</span>
        <Select value={archivedView} onValueChange={(v) => setArchivedView(v as ArchivedView)}>
          <SelectTrigger className="w-40" aria-label={t('list.filter_archived_label')} disabled={onlyPending}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ARCHIVED_LABEL) as ArchivedView[]).map((view) => (
              <SelectItem key={view} value={view}>
                {t(ARCHIVED_LABEL[view])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.length > 0 && (
          <>
            <span className="text-sm text-[var(--text-secondary)]">{t('list.filter_tag_label')}</span>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-48" aria-label={t('list.filter_tag_label')} disabled={onlyPending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('list.filter_tag_all')}</SelectItem>
                {sortedTags.map((tag) => (
                  <SelectItem key={tag.name} value={tag.name}>
                    {tag.name} ({tag.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {pending.length > 0 && (
          <Button
            variant={onlyPending ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={onlyPending}
            startIcon={<BellRing className="h-4 w-4" />}
            onClick={() => setOnlyPending((v) => !v)}
          >
            {t('list.filter_awaiting_me', {count: pending.length})}
          </Button>
        )}
      </div>

      {loading && !onlyPending ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          {onlyPending ? t('list.awaiting_empty') : filtered ? t('list.empty_filtered') : t('list.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => (
            <MinutesCard key={item.id} groupId={groupId} minutes={item} awaitingMyVote={pendingIds.has(item.id)} />
          ))}
        </div>
      )}
    </section>
  );
}
