import {parseMinutesCode, type MinutesErrorCode, type MinutesIssue} from '@/lib/i18n/minutes';
import type {MinutesParticipant, MinutesWarning} from './types';

/**
 * Witnesses that cannot do (or can no longer do) the job, by participant id. The value is the reason —
 * `null` when the server flagged the witness with a code this client does not know.
 */
export type WitnessFlags = ReadonlyMap<string, MinutesErrorCode | null>;

export const NO_WITNESS_FLAGS: WitnessFlags = new Map();

/**
 * Merges the two sources of "this witness is a problem" into one map, so the panels only ask one question:
 *  - the persistent `is_eligible: false` / `eligibility_issue` the server sends with every `get`, and
 *  - the `issues[]` of a finalize that was just refused (the same witnesses, named exactly by the server).
 * Only participants that are still WITNESS rows on the record are kept — a removed or replaced witness drops out.
 */
export function collectWitnessFlags(participants: MinutesParticipant[], refused: MinutesIssue[] = []): WitnessFlags {
  const flags = new Map<string, MinutesErrorCode | null>();
  const witnessIds = new Set(participants.filter((p) => p.role === 'WITNESS').map((p) => p.id));

  for (const participant of participants) {
    if (participant.role === 'WITNESS' && participant.is_eligible === false) {
      flags.set(participant.id, parseMinutesCode(participant.eligibility_issue));
    }
  }
  for (const issue of refused) {
    if (witnessIds.has(issue.participantId)) {
      flags.set(issue.participantId, issue.code ?? flags.get(issue.participantId) ?? null);
    }
  }
  return flags;
}

/** How many of a `revise` / `restore` answer's `warnings` name a witness (an unknown shape counts as none). */
export function countWarnings(payload: unknown): number {
  const warnings = (payload as {warnings?: unknown} | undefined)?.warnings;
  if (!Array.isArray(warnings)) return 0;
  return (warnings as Array<Partial<MinutesWarning> | null>).filter((w) => !!w?.participant_id).length;
}
