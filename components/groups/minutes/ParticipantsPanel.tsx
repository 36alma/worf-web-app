'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {AlertTriangle, Plus, RefreshCw, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {translateMinutesApiError, translateMinutesErrorCode, translateParticipantRole} from '@/lib/i18n/minutes';
import {addParticipant, removeParticipant} from '@/lib/api/minutes';
import {PARTICIPANT_ROLES, type MinutesParticipant, type ParticipantRole} from './types';
import type {GroupUser} from '@/components/groups/tasks/types';
import {participantName} from './participantName';
import ParticipantCalendarImportModal from './ParticipantCalendarImportModal';
import WitnessCandidatePicker from './WitnessCandidatePicker';
import {NO_WITNESS_FLAGS, type WitnessFlags} from './witnessIssues';

export interface ParticipantsPanelProps {
  groupId: string;
  minutesId: string;
  calendarEventId?: string | null;
  participants: MinutesParticipant[];
  /** The group's members, loaded once by the page (also used to name the witnesses). */
  members: GroupUser[];
  editable: boolean;
  /** Witnesses that are no longer eligible (`is_eligible: false` / a refused finalize) — marked in the list. */
  witnessFlags?: WitnessFlags;
  onChange: (participants: MinutesParticipant[]) => void;
  onImported: () => void;
}

export default function ParticipantsPanel({
  groupId,
  minutesId,
  calendarEventId,
  participants,
  members,
  editable,
  witnessFlags = NO_WITNESS_FLAGS,
  onChange,
  onImported
}: ParticipantsPanelProps) {
  const t = useTranslations('group_minutes');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [freeTextName, setFreeTextName] = useState('');
  const [role, setRole] = useState<ParticipantRole>('ATTENDEE');
  const [importOpen, setImportOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // A witness has to be a registered, eligible member, so that role gets its own candidate picker.
  const witnessMode = role === 'WITNESS';

  const handleAdd = async () => {
    if (!selectedUserId && !freeTextName.trim()) return;
    setAdding(true);
    try {
      const {data} = await addParticipant({
        group_id: groupId,
        minutes_id: minutesId,
        role,
        user_id: selectedUserId || undefined,
        display_name: selectedUserId ? undefined : freeTextName
      });
      const participantId = (data as {participant_id: string}).participant_id;
      onChange([
        ...participants,
        {
          id: participantId,
          minutes_id: minutesId,
          role,
          user_id: selectedUserId || null,
          display_name: selectedUserId ? members.find((m) => m.user_id === selectedUserId)?.full_name ?? null : freeTextName
        }
      ]);
      setSelectedUserId('');
      setFreeTextName('');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (participantId: string) => {
    if (!window.confirm(t('participants.remove_confirm'))) return;
    try {
      await removeParticipant({group_id: groupId, participant_id: participantId});
      onChange(participants.filter((p) => p.id !== participantId));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">{t('participants.title')}</h2>
        {editable && calendarEventId && (
          <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)} startIcon={<RefreshCw className="h-4 w-4" />}>
            {t('participants.import_from_event')}
          </Button>
        )}
      </div>

      {importOpen && calendarEventId && (
        <ParticipantCalendarImportModal
          groupId={groupId}
          minutesId={minutesId}
          calendarEventId={calendarEventId}
          onClose={() => setImportOpen(false)}
          onConfirmed={() => {
            setImportOpen(false);
            onImported();
          }}
        />
      )}
      <ul className="space-y-1">
        {participants.map((p) => {
          const flagged = witnessFlags.has(p.id);
          const flagText = flagged
            ? translateMinutesErrorCode(t, witnessFlags.get(p.id) ?? null) ?? t('participants.witness_ineligible')
            : null;
          return (
            <li
              key={p.id}
              className={
                flagged
                  ? 'flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-sm text-[var(--text-primary)] dark:border-amber-800 dark:bg-amber-900/30'
                  : 'flex items-center justify-between text-sm text-[var(--text-primary)]'
              }
            >
              <div className="min-w-0">
                <span>
                  {participantName(p, members, t('participants.unknown_name'))}
                  {' — '}
                  {translateParticipantRole(t, p.role)}
                </span>
                {flagText && (
                  <p className="flex items-start gap-1 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{flagText}</span>
                  </p>
                )}
              </div>
              {editable && (
                <Button variant="ghost" size="sm" onClick={() => handleRemove(p.id)} aria-label={t('participants.remove')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {editable && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={role} onValueChange={(v) => setRole(v as ParticipantRole)}>
              <SelectTrigger className="w-40" aria-label={t('participants.role')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTICIPANT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {translateParticipantRole(t, r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!witnessMode && (
              <>
                <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v)}>
                  <SelectTrigger className="w-48" aria-label={t('participants.member')}>
                    <SelectValue placeholder={t('participants.member')} />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name || m.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={freeTextName}
                  onChange={(e) => setFreeTextName(e.target.value)}
                  placeholder={t('participants.free_text_name')}
                  className="w-48"
                  disabled={!!selectedUserId}
                />
                <Button
                  variant="secondary"
                  onClick={handleAdd}
                  loading={adding}
                  disabled={!selectedUserId && !freeTextName.trim()}
                  startIcon={<Plus className="h-4 w-4" />}
                >
                  {t('participants.add')}
                </Button>
              </>
            )}
          </div>

          {witnessMode && (
            <>
              <p className="text-xs text-[var(--text-tertiary)]">{t('participants.witness_picker_hint')}</p>
              <WitnessCandidatePicker
                groupId={groupId}
                minutesId={minutesId}
                participants={participants}
                onChange={onChange}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
