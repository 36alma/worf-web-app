'use client';

import {use} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import MinutesHeaderForm, {type MinutesHeaderFormValues} from '@/components/groups/minutes/MinutesHeaderForm';
import {createMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export default function NewMinutesPage({params}: {params: Promise<{groupId: string; locale: string}>}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('group_minutes');

  if (isLoading) return null;
  if (!hasPermission('group.minutes.create')) return null;

  const handleSubmit = async (values: MinutesHeaderFormValues) => {
    try {
      const {data} = await createMinutes({
        group_id: decodedGroupId,
        subject: values.subject,
        meeting_date: values.meeting_date,
        location: values.location || undefined,
        minute_taker_id: values.minute_taker_id || undefined
      });
      const minutesId = (data as {minutes_id: string}).minutes_id;
      router.push(`/${locale}/groups/${encodeURIComponent(decodedGroupId)}/minutes/${encodeURIComponent(minutesId)}`);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <section className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">{t('list.create')}</h1>
      <MinutesHeaderForm groupId={decodedGroupId} onSubmit={handleSubmit} submitLabel={t('form.save')} />
    </section>
  );
}
