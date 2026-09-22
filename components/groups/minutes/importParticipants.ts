import type {MinutesImportParticipantProposal} from './types';

/**
 * Why a participant of the import review cannot be sent as it is. The server refuses the whole
 * `import/confirm` (and creates nothing) over the witness rules, so they are checked here first.
 */
export type ImportParticipantProblem =
  | 'witness_needs_member'
  | 'witness_not_eligible'
  | 'witness_is_minute_taker'
  | 'duplicate_member';

/**
 * The problems of the review's participants, by index. A row has at most one problem (the first found).
 *
 * - A WITNESS must be a registered member: a bare name (no `user_id`) is refused by the server.
 * - The minute taker cannot be a witness too.
 * - `eligibleWitnessIds` is the `witness/candidates` answer; `null` when it is unknown (request failed, or the
 *   list is truncated) — the server then has the last word, so nothing is concluded from it.
 * - The same member can only be a participant once per record.
 */
export function findImportParticipantProblems({
  participants,
  minuteTakerId,
  eligibleWitnessIds
}: {
  participants: MinutesImportParticipantProposal[];
  minuteTakerId: string;
  eligibleWitnessIds: ReadonlySet<string> | null;
}): Map<number, ImportParticipantProblem> {
  const problems = new Map<number, ImportParticipantProblem>();
  const seen = new Set<string>();

  participants.forEach((participant, index) => {
    const userId = participant.user_id;
    if (participant.role === 'WITNESS') {
      if (!userId) problems.set(index, 'witness_needs_member');
      else if (minuteTakerId && userId === minuteTakerId) problems.set(index, 'witness_is_minute_taker');
      else if (eligibleWitnessIds && !eligibleWitnessIds.has(userId)) problems.set(index, 'witness_not_eligible');
    }
    if (userId) {
      if (!problems.has(index) && seen.has(userId)) problems.set(index, 'duplicate_member');
      seen.add(userId);
    }
  });
  return problems;
}

/** A row assigned to a member goes out with just the `user_id` (the name then resolves live), otherwise as a name. */
export function buildImportParticipantsPayload(
  participants: MinutesImportParticipantProposal[]
): Array<{role: string; user_id?: string; display_name?: string}> {
  return participants.map((participant) =>
    participant.user_id
      ? {role: participant.role, user_id: participant.user_id}
      : {role: participant.role, display_name: participant.display_name}
  );
}

/**
 * Turns the witnesses that break a witness rule into plain attendees; every other row is left alone
 * (a duplicated member stays one — being an attendee instead would not make it unique).
 */
export function downgradeProblemWitnesses(
  participants: MinutesImportParticipantProposal[],
  problems: ReadonlyMap<number, ImportParticipantProblem>
): MinutesImportParticipantProposal[] {
  return participants.map((participant, index) => {
    const problem = problems.get(index);
    return participant.role === 'WITNESS' && problem && problem !== 'duplicate_member'
      ? {...participant, role: 'ATTENDEE'}
      : participant;
  });
}
