'use client';

import {useMemo, useState} from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type {GroupUser} from '@/components/groups/tasks/types';
import type {EventParticipant, EventResponsePermissions, EventResponsesCopy, RsvpStatus} from '../types';
import MemberCombobox from './MemberCombobox';

interface EventPeopleTabProps {
  copy: EventResponsesCopy;
  permissions: EventResponsePermissions;
  participants: EventParticipant[];
  members: GroupUser[];
  isLoading: boolean;
  isBusy: boolean;
  onInvite: (userId: string) => Promise<void>;
  onMarkAttendance: (userId: string, attended: boolean) => Promise<void>;
}

const RSVP_BADGE: Record<RsvpStatus, 'success' | 'warning' | 'danger'> = {
  GOING: 'success',
  MAYBE: 'warning',
  NOT_GOING: 'danger'
};

/** Everyone involved in the event in ONE list: RSVP badge and attendance checkbox are separate facts. */
export default function EventPeopleTab({
  copy,
  permissions,
  participants,
  members,
  isLoading,
  isBusy,
  onInvite,
  onMarkAttendance
}: EventPeopleTabProps) {
  const [search, setSearch] = useState('');
  const [inviteUserId, setInviteUserId] = useState('');

  const rsvpLabels: Record<RsvpStatus, string> = {GOING: copy.going, MAYBE: copy.maybe, NOT_GOING: copy.notGoing};
  const showAttendance = permissions.canReadAttendance || permissions.canMarkAttendance;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? participants.filter((item) => item.name.toLowerCase().includes(needle)) : participants;
  }, [participants, search]);

  const inviteOptions = useMemo(() => {
    // user_id is not deterministic (a different string per call), so ids from two responses are never
    // compared — the already invited are recognised by name.
    const invitedNames = new Set(
      participants
        .filter((item) => item.invitation !== null && item.invitation !== 'DECLINED')
        .map((item) => item.name.trim().toLowerCase())
    );

    return members
      .map((member) => ({id: member.user_id, label: member.full_name || member.username}))
      .filter((option) => !invitedNames.has(option.label.trim().toLowerCase()));
  }, [members, participants]);

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={copy.search}
        aria-label={copy.search}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
      />

      {permissions.canInvite ? (
        <div className="flex items-start gap-2">
          <MemberCombobox
            options={inviteOptions}
            value={inviteUserId}
            onChange={setInviteUserId}
            placeholder={copy.selectMember}
            emptyText={copy.noMemberMatch}
            ariaLabel={copy.inviteMember}
            disabled={isBusy}
          />
          <Button
            type="button"
            disabled={!inviteUserId || isBusy}
            onClick={async () => {
              await onInvite(inviteUserId);
              setInviteUserId('');
            }}
          >
            {copy.invite}
          </Button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">{isLoading ? '…' : copy.noPeople}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {visible.map((person, index) => (
            // Not user_id: it changes on every call. The list is replaced wholesale on each load.
            <li key={`${index}-${person.name}`} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-sm text-[var(--text-primary)]">{person.name}</span>
              <span className="flex shrink-0 items-center gap-3">
                {person.rsvp ? (
                  <Badge variant={RSVP_BADGE[person.rsvp]}>{rsvpLabels[person.rsvp]}</Badge>
                ) : person.invitation ? (
                  <Badge variant="neutral">{copy.invitedBadge}</Badge>
                ) : null}
                {showAttendance ? (
                  <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={person.attended === true}
                      // Read-only for everyone without attendance.mark.
                      disabled={!permissions.canMarkAttendance || isBusy}
                      onChange={(event) => void onMarkAttendance(person.userId, event.target.checked)}
                    />
                    {copy.attended}
                  </label>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
