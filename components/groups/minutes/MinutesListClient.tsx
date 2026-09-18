'use client';

import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import Link from 'next/link';
import {FileUp, Plus} from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import MinutesCard from './MinutesCard';
import type {MeetingMinutes, MinutesListResponse} from './types';
import {listMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface MinutesListClientProps {
  groupId: string;
  permissions: {create: boolean};
}

export default function MinutesListClient({groupId, permissions}: MinutesListClientProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const [minutes, setMinutes] = useState<MeetingMinutes[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {data} = await listMinutes({group_id: groupId, page_number: 1, load_number: 20});
      const payload = data as MinutesListResponse;
      setMinutes(payload.minutes ?? []);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('list.title')}</h1>
        {permissions.create && (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : minutes.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">{t('list.empty')}</p>
      ) : (
        <div className="space-y-2">
          {minutes.map((item) => (
            <MinutesCard key={item.id} groupId={groupId} minutes={item} />
          ))}
        </div>
      )}
    </section>
  );
}
