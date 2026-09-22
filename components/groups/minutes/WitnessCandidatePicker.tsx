'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, Plus, Search} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {addParticipant, modifyParticipant} from '@/lib/api/minutes';
import {translateMinutesApiError, translateParticipantRole} from '@/lib/i18n/minutes';
import type {MinutesParticipant, WitnessCandidate} from './types';
import {useWitnessCandidates} from './useWitnessCandidates';

export interface WitnessCandidatePickerProps {
  groupId: string;
  minutesId: string;
  participants: MinutesParticipant[];
  onChange: (participants: MinutesParticipant[]) => void;
}

const candidateLabel = (candidate: WitnessCandidate) => candidate.full_name?.trim() || candidate.username?.trim() || '—';

/**
 * A witness may only be a registered, eligible member, so they are picked from `witness/candidates`
 * (active member + `group.minutes.read` **and** `group.minutes.approve`, minute taker excluded) instead of
 * a free-text name. Someone who is already a participant is promoted with `participant/modify` — the same
 * user cannot be added to a minutes twice.
 */
export default function WitnessCandidatePicker({groupId, minutesId, participants, onChange}: WitnessCandidatePickerProps) {
  const t = useTranslations('group_minutes');
  const [query, setQuery] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const {candidates, loading, failed, truncated, reload} = useWitnessCandidates(groupId, minutesId, {query});

  const witnessUserIds = new Set(participants.filter((p) => p.role === 'WITNESS').map((p) => p.user_id));

  const handlePick = async (candidate: WitnessCandidate) => {
    setBusyUserId(candidate.user_id);
    try {
      if (candidate.participant_id) {
        await modifyParticipant({group_id: groupId, participant_id: candidate.participant_id, role: 'WITNESS'});
        onChange(
          participants.map((p) =>
            p.id === candidate.participant_id
              ? {...p, role: 'WITNESS', approval_status: 'PENDING', is_eligible: true, eligibility_issue: null}
              : p
          )
        );
      } else {
        const {data} = await addParticipant({
          group_id: groupId,
          minutes_id: minutesId,
          role: 'WITNESS',
          user_id: candidate.user_id
        });
        onChange([
          ...participants,
          {
            id: (data as {participant_id: string}).participant_id,
            minutes_id: minutesId,
            role: 'WITNESS',
            user_id: candidate.user_id,
            display_name: candidateLabel(candidate),
            approval_status: 'PENDING',
            // A candidate is eligible by definition — the same rules build the list.
            is_eligible: true,
            eligibility_issue: null
          }
        ]);
      }
      // The picked member is now a witness, so the candidate row has to reflect its new `participant_role`.
      reload();
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('participants.witness_search_placeholder')}
          aria-label={t('participants.witness_search_placeholder')}
        />
      </div>

      {loading && <p className="text-xs text-[var(--text-tertiary)]">{t('editor.flow.loading')}</p>}

      {!loading && failed && <p className="text-xs text-amber-700 dark:text-amber-300">{t('participants.witness_candidates_failed')}</p>}

      {!loading && !failed && candidates.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {query.trim() ? t('participants.witness_no_match') : t('participants.witness_no_candidates')}
        </p>
      )}

      {candidates.length > 0 && (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {candidates.map((candidate) => {
            const already = witnessUserIds.has(candidate.user_id) || candidate.participant_role === 'WITNESS';
            return (
              <li key={candidate.user_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-[var(--text-primary)]">
                  {candidateLabel(candidate)}
                  {candidate.participant_role && !already && (
                    <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">
                      ({translateParticipantRole(t, candidate.participant_role)})
                    </span>
                  )}
                </span>
                {already ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--text-tertiary)]">
                    <Check className="h-3.5 w-3.5" />
                    {t('participants.witness_already')}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyUserId === candidate.user_id}
                    disabled={!!busyUserId}
                    startIcon={<Plus className="h-4 w-4" />}
                    onClick={() => void handlePick(candidate)}
                  >
                    {candidate.participant_id ? t('participants.witness_promote') : t('participants.add')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {truncated && <p className="text-xs text-[var(--text-tertiary)]">{t('participants.witness_truncated')}</p>}
    </div>
  );
}
