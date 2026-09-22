import type {GroupUser} from '@/components/groups/tasks/types';
import type {ApprovalStatus, MinutesParticipant, MinutesStatus, MinutesViewer} from './types';

export interface WitnessAuthUser {
  id?: string | null;
  user_id?: string | null;
  email?: string | null;
  username?: string | null;
}

const norm = (value?: string | null) => (value ?? '').trim().toLowerCase();

/**
 * The logged-in user's opaque `user_id` (same codec as `participants[].user_id`).
 * Prefers what the profile endpoint gave us; otherwise falls back to the group member that matches
 * the profile's e-mail (then username) — the member `user_id`s are what `participant/add` stores.
 */
export function resolveCurrentUserId(user: WitnessAuthUser | null | undefined, members: GroupUser[] = []): string | null {
  const direct = (user?.id || user?.user_id || '').trim();
  if (direct) return direct;

  const email = norm(user?.email);
  if (email) {
    const byEmail = members.find((m) => norm(m.email) === email);
    if (byEmail?.user_id) return byEmail.user_id;
  }
  const username = norm(user?.username);
  if (username) {
    const byUsername = members.find((m) => norm(m.username) === username);
    if (byUsername?.user_id) return byUsername.user_id;
  }
  return null;
}

export interface WitnessState {
  witnesses: MinutesParticipant[];
  approvedCount: number;
  /** The caller's own WITNESS record on this minutes, if any — `null` when the server's `viewer` is all we have. */
  self: MinutesParticipant | null;
  /** The caller is a witness on this record (`viewer.is_witness`, or their own participant row). */
  isWitness: boolean;
  /** The caller's own vote: `PENDING` / `APPROVED`, `null` for a non-witness. */
  myApprovalStatus: ApprovalStatus | null;
  /** Vote buttons are allowed: awaiting approval + own WITNESS record + `group.minutes.approve`. */
  canVote: boolean;
  /** Registered as a witness, but the role lacks `group.minutes.approve` — the server would answer 403. */
  selfWithoutPermission: boolean;
  /** WITNESS entries without a `user_id` (free-text names) — they can never vote. */
  externalWitnesses: MinutesParticipant[];
}

/**
 * Who has to approve, and what the caller may do about it.
 *
 * `viewer` (the `get` response's own block) is authoritative when the server sends it: it already knows
 * the caller's role permissions, so no opaque `user_id` has to be compared. `currentUserId` + `canApprove`
 * stay as the fallback for a server that does not answer with `viewer` yet, and they still name the caller's
 * own participant row (used for the "you approved at …" timestamp).
 */
export function getWitnessState({
  status,
  participants,
  currentUserId,
  canApprove,
  viewer
}: {
  status: MinutesStatus;
  participants: MinutesParticipant[];
  currentUserId: string | null;
  canApprove: boolean;
  viewer?: MinutesViewer | null;
}): WitnessState {
  const witnesses = participants.filter((p) => p.role === 'WITNESS');
  const self = currentUserId ? witnesses.find((w) => w.user_id === currentUserId) ?? null : null;
  const isWitness = viewer ? viewer.is_witness : !!self;

  return {
    witnesses,
    approvedCount: witnesses.filter((w) => w.approval_status === 'APPROVED').length,
    self,
    isWitness,
    // With a `viewer` the server decides: a non-witness has no vote, even when an old participant row suggests one.
    myApprovalStatus: viewer
      ? viewer.my_approval_status ?? (viewer.is_witness ? self?.approval_status ?? null : null)
      : self?.approval_status ?? null,
    // A vote stays changeable while PENDING_APPROVAL, so `approval_status` is deliberately not part of this.
    canVote: viewer ? viewer.can_vote : status === 'PENDING_APPROVAL' && canApprove && !!self,
    selfWithoutPermission: isWitness && !canApprove,
    externalWitnesses: witnesses.filter((w) => !w.user_id)
  };
}
