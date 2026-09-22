'use client';

import {useTranslations} from 'next-intl';
import {AlertTriangle, Trash2} from 'lucide-react';
import Button from '@/components/ui/Button';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import type {GroupUser} from '@/components/groups/tasks/types';
import {translateParticipantRole} from '@/lib/i18n/minutes';
import type {ImportParticipantProblem} from './importParticipants';
import {PARTICIPANT_ROLES, type MinutesImportParticipantProposal, type ParticipantRole, type WitnessCandidate} from './types';

/** Radix `Select` items cannot carry an empty value, so "no member" is this sentinel. */
const NO_MEMBER = '__none__';

interface Option {
  user_id: string;
  label: string;
}

export interface ImportParticipantsReviewProps {
  participants: MinutesImportParticipantProposal[];
  problems: ReadonlyMap<number, ImportParticipantProblem>;
  members: GroupUser[];
  /** `witness/candidates` (group level, no record yet) — what a WITNESS row may be assigned to. */
  witnessCandidates: WitnessCandidate[];
  /** That list could not be loaded: every member is offered and the server judges the choice. */
  witnessCandidatesFailed: boolean;
  /** The minute taker picked above — never offered as a witness. */
  minuteTakerId: string;
  onChange: (participants: MinutesImportParticipantProposal[]) => void;
}

const memberLabel = (member: GroupUser) => member.full_name || member.username;
const candidateLabel = (candidate: WitnessCandidate) => candidate.full_name?.trim() || candidate.username?.trim() || '—';

/**
 * The AI proposal names people as free text. Each name is matched to a group member here (nothing is guessed
 * server-side): that is what lets a witness through, since a witness has to be a registered, eligible member.
 * A row left unassigned is imported as an outsider's name — fine for everybody except a witness.
 */
export default function ImportParticipantsReview({
  participants,
  problems,
  members,
  witnessCandidates,
  witnessCandidatesFailed,
  minuteTakerId,
  onChange
}: ImportParticipantsReviewProps) {
  const t = useTranslations('group_minutes');

  const update = (index: number, patch: Partial<MinutesImportParticipantProposal>) =>
    onChange(participants.map((p, i) => (i === index ? {...p, ...patch} : p)));

  const optionsFor = (participant: MinutesImportParticipantProposal): Option[] => {
    const base: Option[] =
      participant.role === 'WITNESS' && !witnessCandidatesFailed
        ? witnessCandidates
            .filter((c) => c.user_id !== minuteTakerId)
            .map((c) => ({user_id: c.user_id, label: candidateLabel(c)}))
        : members.map((m) => ({user_id: m.user_id, label: memberLabel(m)}));
    const current = participant.user_id;
    // Keep the assigned member selectable even when a role change dropped them from the list — the problem
    // message then says why, instead of the trigger going blank.
    if (current && !base.some((o) => o.user_id === current)) {
      const known = members.find((m) => m.user_id === current);
      base.unshift({user_id: current, label: known ? memberLabel(known) : t('participants.unknown_name')});
    }
    return base.sort((a, b) => a.label.localeCompare(b.label));
  };

  const problemText = (problem: ImportParticipantProblem): string => {
    switch (problem) {
      case 'witness_needs_member':
        return t('import.witness_needs_member');
      case 'witness_not_eligible':
        return t('errors.code.witness_not_eligible');
      case 'witness_is_minute_taker':
        return t('errors.code.witness_is_minute_taker');
      case 'duplicate_member':
        return t('import.member_duplicate');
    }
  };

  return (
    <ul className="space-y-2">
      {participants.map((participant, index) => {
        const problem = problems.get(index);
        return (
          <li
            key={`${participant.display_name}-${index}`}
            className={`space-y-1 rounded-lg border p-2 ${
              problem ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' : 'border-[var(--border-subtle)]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{participant.display_name}</span>
              <Select value={participant.role} onValueChange={(value) => update(index, {role: value as ParticipantRole})}>
                <SelectTrigger className="w-44" aria-label={t('participants.role')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTICIPANT_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {translateParticipantRole(t, role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={participant.user_id ?? NO_MEMBER}
                onValueChange={(value) => update(index, {user_id: value === NO_MEMBER ? undefined : value})}
              >
                <SelectTrigger className="w-52" aria-label={t('import.assign_member')}>
                  <SelectValue placeholder={t('import.assign_member')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MEMBER}>{t('import.not_a_member')}</SelectItem>
                  {optionsFor(participant).map((option) => (
                    <SelectItem key={option.user_id} value={option.user_id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('participants.remove')}
                onClick={() => onChange(participants.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {problem && (
              <p className="flex items-start gap-1 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{problemText(problem)}</span>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
