import type {GroupUser} from '@/components/groups/tasks/types';
import type {MinutesParticipant} from './types';

/**
 * The name to show for a participant. The server's `display_name` always wins (also when a `user_id` is set);
 * a linked member falls back to the group's member list. The opaque `user_id` is never shown.
 */
export function participantName(participant: MinutesParticipant, members: GroupUser[] = [], fallback = ''): string {
  return (
    participant.display_name?.trim() ||
    (participant.user_id ? members.find((m) => m.user_id === participant.user_id)?.full_name?.trim() : '') ||
    fallback
  );
}
