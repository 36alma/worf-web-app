'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import MinutesFormModal from '@/components/groups/minutes/MinutesFormModal';
import MinutesViewModal from '@/components/groups/minutes/MinutesViewModal';
import {fromLocalInput, toLocalInput} from '@/components/groups/minutes/minutesDates';
import type {MinutesHeaderFormValues} from '@/components/groups/minutes/MinutesHeaderForm';
import type {MeetingMinutes} from '@/components/groups/minutes/types';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import {createMinutes, getMinutes, modifyMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {ChipRef} from '../entities';
import {useOpenErrorToast, type EntityHostProps} from './shared';

/** `MinutesFormModal` (the header form) to create/edit, `MinutesViewModal` to open a chip. */
export default function MinutesEntityModals({ctx, request, onDone}: EntityHostProps) {
  const {groupId} = ctx;
  const t = useTranslations('group_minutes');
  const {hasPermission} = useGroupPermission();
  const reportOpenError = useOpenErrorToast();
  const createdRef = useRef<ChipRef[]>([]);
  const [editing, setEditing] = useState<MeetingMinutes | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const modifyId = request.mode === 'modify' ? request.item.id : null;
  useEffect(() => {
    if (!modifyId) return;
    let mounted = true;
    getMinutes({group_id: groupId, minutes_id: modifyId})
      .then(({data}) => mounted && setEditing((data as {minutes: MeetingMinutes}).minutes))
      .catch((error) => {
        if (!mounted) return;
        reportOpenError(error);
        onDone();
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, modifyId]);

  const submit = async (values: MinutesHeaderFormValues) => {
    setSubmitting(true);
    try {
      const body = {
        subject: values.subject,
        meeting_date: fromLocalInput(values.meeting_date),
        location: values.location || undefined
      };
      if (editing) {
        // On `modify` a missing minute taker means "unchanged" — it can never be cleared.
        await modifyMinutes({
          group_id: groupId,
          minutes_id: editing.id,
          ...body,
          minute_taker_id: values.minute_taker_id || undefined
        });
        toast.success(t('editor.flow.saved'));
        onDone();
        return;
      }
      const {data} = await createMinutes({group_id: groupId, ...body, minute_taker_id: values.minute_taker_id});
      const id = String((data as {minutes_id?: string}).minutes_id ?? '');
      if (id) createdRef.current = [{type: 'minutes', id, label: values.subject}];
      toast.success(t('editor.flow.saved'));
      onDone(createdRef.current);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setSubmitting(false);
    }
  };

  if (request.mode === 'view' && !editing) {
    return (
      <MinutesViewModal
        open
        groupId={groupId}
        minutesId={request.ref.id}
        canModify={hasPermission('group.minutes.modify')}
        canApprove={hasPermission('group.minutes.approve')}
        onClose={() => onDone()}
        onEdit={setEditing}
        onLoadError={(error) => {
          reportOpenError(error);
          onDone();
        }}
      />
    );
  }

  if (request.mode === 'modify' && !editing) return null;

  return (
    <MinutesFormModal
      open
      title={editing ? t('editor.entities.minutes.modify_title') : t('editor.entities.minutes.create_title')}
      groupId={groupId}
      minutesId={editing?.id}
      initial={
        editing
          ? {
              subject: editing.subject,
              meeting_date: toLocalInput(editing.meeting_date),
              location: editing.location ?? '',
              minute_taker_id: editing.minute_taker_id ?? ''
            }
          : undefined
      }
      submitting={submitting}
      onSubmit={submit}
      onClose={() => onDone(createdRef.current)}
    />
  );
}
