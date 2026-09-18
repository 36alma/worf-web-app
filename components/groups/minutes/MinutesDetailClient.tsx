'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Skeleton from '@/components/ui/Skeleton';
import MinutesStatusBadge from './MinutesStatusBadge';
import MinutesHeaderForm, {type MinutesHeaderFormValues} from './MinutesHeaderForm';
import AgendaItemList from './AgendaItemList';
import ParticipantsPanel from './ParticipantsPanel';
import WitnessPanel from './WitnessPanel';
import MinutesStateActions from './MinutesStateActions';
import AttachmentsPanel from './AttachmentsPanel';
import type {MeetingMinutes} from './types';
import {getMinutes, modifyMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import {useAuthStore} from '@/lib/store/authStore';

export interface MinutesDetailClientProps {
  groupId: string;
  minutesId: string;
  permissions: {
    modify: boolean;
    finalize: boolean;
    approve: boolean;
    attachmentManage: boolean;
  };
}

export default function MinutesDetailClient({groupId, minutesId, permissions}: MinutesDetailClientProps) {
  const t = useTranslations('group_minutes');
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {data} = await getMinutes({group_id: groupId, minutes_id: minutesId});
      setMinutes((data as {minutes: MeetingMinutes}).minutes);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setLoading(false);
    }
  }, [groupId, minutesId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !minutes) {
    return <Skeleton className="h-96 w-full" />;
  }

  const editable = minutes.status === 'DRAFT' && permissions.modify;

  const handleHeaderSubmit = async (values: MinutesHeaderFormValues) => {
    try {
      await modifyMinutes({
        group_id: groupId,
        minutes_id: minutesId,
        subject: values.subject,
        meeting_date: values.meeting_date,
        location: values.location || undefined,
        minute_taker_id: values.minute_taker_id || undefined
      });
      setMinutes({...minutes, ...values});
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{minutes.subject}</h1>
          <MinutesStatusBadge status={minutes.status} />
        </div>
        <MinutesStateActions
          groupId={groupId}
          minutesId={minutesId}
          status={minutes.status}
          canFinalize={permissions.finalize}
          canRevise={permissions.modify}
          onFinalized={load}
        />
      </div>

      {minutes.rejection_reason && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          {t('witness.rejection_reason', {reason: minutes.rejection_reason})}
        </p>
      )}

      {editable && (
        <MinutesHeaderForm
          groupId={groupId}
          initial={{
            subject: minutes.subject,
            meeting_date: minutes.meeting_date,
            location: minutes.location ?? '',
            minute_taker_id: minutes.minute_taker_id ?? ''
          }}
          onSubmit={handleHeaderSubmit}
          submitLabel={t('form.save')}
        />
      )}

      <AgendaItemList
        groupId={groupId}
        minutesId={minutesId}
        agendaItems={minutes.agenda_items ?? []}
        editable={editable}
        onChange={(agenda_items) => setMinutes({...minutes, agenda_items})}
      />

      <ParticipantsPanel
        groupId={groupId}
        minutesId={minutesId}
        calendarEventId={minutes.calendar_event_id}
        participants={minutes.participants ?? []}
        editable={editable}
        onChange={(participants) => setMinutes({...minutes, participants})}
      />

      <WitnessPanel
        groupId={groupId}
        minutesId={minutesId}
        status={minutes.status}
        participants={minutes.participants ?? []}
        currentUserId={currentUserId ?? null}
        canApprove={permissions.approve}
        onVoted={load}
      />

      <AttachmentsPanel
        groupId={groupId}
        minutesId={minutesId}
        attachments={minutes.attachments ?? []}
        canManage={permissions.attachmentManage}
        onChange={(attachments) => setMinutes({...minutes, attachments})}
      />
    </section>
  );
}
