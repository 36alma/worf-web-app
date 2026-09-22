'use client';

import {useCallback, useEffect, useState, type ReactNode} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {AlertTriangle} from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '@/components/ui/Skeleton';
import MinutesStatusBadge from './MinutesStatusBadge';
import MinutesArchivedBadge from './MinutesArchivedBadge';
import MinutesTagsPanel from './MinutesTagsPanel';
import MinutesLifecycleActions from './MinutesLifecycleActions';
import MinutesHeaderForm, {type MinutesHeaderFormValues} from './MinutesHeaderForm';
import AgendaItemList from './AgendaItemList';
import ParticipantsPanel from './ParticipantsPanel';
import WitnessPanel from './WitnessPanel';
import WitnessVoteBar from './WitnessVoteBar';
import MinutesVersionsPanel from './MinutesVersionsPanel';
import MinutesStateActions, {type FinalizeIssue} from './MinutesStateActions';
import AttachmentsPanel from './AttachmentsPanel';
import {EntityModalProvider} from './editor/EntityModalProvider';
import {formatDateTime, fromLocalInput, toLocalInput} from './minutesDates';
import {participantName} from './participantName';
import type {MeetingMinutes} from './types';
import {getWitnessState, resolveCurrentUserId} from './witness';
import {collectWitnessFlags} from './witnessIssues';
import {useGroupMembers} from '@/hooks/useGroupMembers';
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
    /** `group.minutes.archive` */
    archive: boolean;
    /** `group.minutes.delete` */
    delete: boolean;
  };
}

/** An amber heads-up above the content — something is wrong with the record, but nothing was refused. */
function Notice({children}: {children: ReactNode}) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function MetaItem({label, value}: {label: string; value: string}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{label}</dt>
      <dd className="text-sm text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

export default function MinutesDetailClient({groupId, minutesId, permissions}: MinutesDetailClientProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [loading, setLoading] = useState(true);
  const [finalizeIssue, setFinalizeIssue] = useState<FinalizeIssue | null>(null);
  const authUser = useAuthStore((s) => s.user);
  const members = useGroupMembers(groupId);

  /** `silent` re-fetches in place (after a vote / finalize) instead of swapping the page for a skeleton. */
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const {data} = await getMinutes({group_id: groupId, minutes_id: minutesId});
        setMinutes((data as {minutes: MeetingMinutes}).minutes);
      } catch (error) {
        toast.error(translateMinutesApiError(t, error, 'errors.default'));
      } finally {
        setLoading(false);
      }
    },
    [groupId, minutesId, t]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !minutes) {
    return <Skeleton className="h-96 w-full" />;
  }

  // An archived record is read-only for everything but tags, attachments and the archive/trash actions.
  const archived = !!minutes.archived_at;
  const editable = minutes.status === 'DRAFT' && permissions.modify && !archived;
  const participants = minutes.participants ?? [];
  const witnessState = getWitnessState({
    status: minutes.status,
    participants,
    currentUserId: resolveCurrentUserId(authUser, members),
    canApprove: permissions.approve,
    viewer: minutes.viewer
  });
  const reload = () => void load(true);

  // A witness the server calls ineligible (`is_eligible: false`) blocks the approval for good, so it is shown from
  // the moment the record is opened. `finalize` naming witnesses adds to the marks but never to the blocker
  // count: that refusal is a moment in time, the persistent flags are what the record looks like now.
  const persistentFlags = collectWitnessFlags(participants);
  const witnessFlags = collectWitnessFlags(participants, finalizeIssue?.issues);
  const refusedNames = (finalizeIssue?.issues ?? [])
    .map((issue) => participants.find((p) => p.id === issue.participantId))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => participantName(p, members, t('participants.unknown_name')));
  const showFlagBand = persistentFlags.size > 0 && refusedNames.length === 0;

  const minuteTakerName =
    (minutes.minute_taker_fullname ?? '').trim() ||
    members.find((m) => m.user_id === minutes.minute_taker_id)?.full_name ||
    (minutes.minute_taker_id ? t('participants.unknown_name') : t('form.minute_taker_missing'));

  const handleHeaderSubmit = async (values: MinutesHeaderFormValues) => {
    try {
      await modifyMinutes({
        group_id: groupId,
        minutes_id: minutesId,
        subject: values.subject,
        meeting_date: fromLocalInput(values.meeting_date),
        location: values.location || undefined,
        // A missing field means "unchanged" server-side; the minute taker can never be cleared.
        minute_taker_id: values.minute_taker_id || undefined
      });
      toast.success(t('editor.flow.saved'));
      setFinalizeIssue(null);
      reload();
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <EntityModalProvider groupId={groupId} minutesId={minutesId}>
      <section className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">{minutes.subject}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <MinutesStatusBadge status={minutes.status} />
              {archived && <MinutesArchivedBadge />}
              <span className="text-xs text-[var(--text-tertiary)]">{t('list.version_label', {version: minutes.version})}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <MinutesStateActions
              groupId={groupId}
              minutesId={minutesId}
              status={minutes.status}
              canFinalize={permissions.finalize}
              canRevise={permissions.modify}
              hasWitness={witnessState.witnesses.length > 0}
              hasMinuteTaker={!!minutes.minute_taker_id}
              minuteTakerEligible={minutes.minute_taker_is_eligible}
              ineligibleWitnessCount={persistentFlags.size}
              archived={archived}
              onFinalized={reload}
              onIssue={setFinalizeIssue}
            />
            <MinutesLifecycleActions
              groupId={groupId}
              minutesId={minutesId}
              status={minutes.status}
              version={minutes.version}
              partOfChain={minutes.version > 1 || !!minutes.root_minutes_id}
              archived={archived}
              canArchive={permissions.archive}
              canDelete={permissions.delete}
              onChanged={reload}
            />
          </div>
        </div>

        {archived && (
          <Notice>
            {t(permissions.archive ? 'archive.banner' : 'archive.banner_read_only', {
              date: formatDateTime(minutes.archived_at, locale)
            })}
          </Notice>
        )}

        <dl className="grid gap-4 rounded-xl border border-[var(--border-default)] p-4 sm:grid-cols-3">
          <MetaItem label={t('form.meeting_date')} value={formatDateTime(minutes.meeting_date, locale)} />
          <MetaItem label={t('form.location')} value={minutes.location || '—'} />
          <MetaItem label={t('form.minute_taker')} value={minuteTakerName} />
        </dl>

        <MinutesTagsPanel
          groupId={groupId}
          minutesId={minutesId}
          tags={minutes.tags ?? []}
          canEdit={permissions.modify}
          onChange={(tags) => setMinutes({...minutes, tags})}
        />

        {minutes.minute_taker_is_eligible === false && (
          <Notice>{t(editable ? 'form.minute_taker_ineligible_editable' : 'form.minute_taker_ineligible')}</Notice>
        )}
        {!minutes.minute_taker_id && editable && (
          <Notice>{t('form.minute_taker_legacy')}</Notice>
        )}

        {showFlagBand && (
          <Notice>
            {t(minutes.status === 'PENDING_APPROVAL' ? 'witness.stuck_banner' : 'witness.ineligible_banner', {
              count: persistentFlags.size
            })}
          </Notice>
        )}

        {minutes.rejection_reason && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {t('witness.rejection_reason', {reason: minutes.rejection_reason})}
          </p>
        )}

        {finalizeIssue && (
          <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">{t('state.finalize_failed')}</p>
              <p>{finalizeIssue.message}</p>
              {refusedNames.length > 0 && (
                <p>{t('state.finalize_ineligible_witnesses', {names: refusedNames.join(', ')})}</p>
              )}
            </div>
          </div>
        )}

        <WitnessVoteBar
          groupId={groupId}
          minutesId={minutesId}
          subject={minutes.subject}
          version={minutes.version}
          state={witnessState}
          onVoted={reload}
        />

        {editable && (
          <MinutesHeaderForm
            groupId={groupId}
            minutesId={minutesId}
            initial={{
              subject: minutes.subject,
              meeting_date: toLocalInput(minutes.meeting_date),
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
          participants={participants}
          members={members}
          editable={editable}
          witnessFlags={witnessFlags}
          onChange={(next) => setMinutes({...minutes, participants: next})}
          onImported={reload}
        />

        <WitnessPanel status={minutes.status} state={witnessState} members={members} witnessFlags={witnessFlags} />

        {(minutes.version > 1 || minutes.root_minutes_id || minutes.status === 'ARCHIVED') && (
          <MinutesVersionsPanel
            groupId={groupId}
            minutesId={minutesId}
            status={minutes.status}
            canModify={permissions.modify}
          />
        )}

        <AttachmentsPanel
          groupId={groupId}
          minutesId={minutesId}
          attachments={minutes.attachments ?? []}
          canManage={permissions.attachmentManage}
          onChange={(attachments) => setMinutes({...minutes, attachments})}
          onExported={reload}
        />
      </section>
    </EntityModalProvider>
  );
}
