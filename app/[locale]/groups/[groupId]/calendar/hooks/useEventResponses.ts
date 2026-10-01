'use client';

import {useCallback, useEffect, useState} from 'react';
import toast from 'react-hot-toast';
import {getGroupMembers} from '@/lib/api/groups';
import {parseGroupUsers} from '@/lib/utils/groupUsers';
import type {GroupUser} from '@/components/groups/tasks/types';
import type {EventParticipant, InvitationStatus, RsvpStatus, SupportedLocale} from '../types';
import {worfFetch} from '../utils/worfCalendarClient';

interface UseEventResponsesOptions {
  groupId: string;
  locale: SupportedLocale;
  eventId: string | null;
  enabled: boolean;
  canRsvp: boolean;
  canInvite: boolean;
  canReadAttendance: boolean;
  messages: {
    rsvpSaved: string;
    inviteSent: string;
    attendanceSaved: string;
    alreadyInvited: string;
  };
}

const EVENT_PATH = '/v1/group/calendar/event';

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const RSVP_VALUES: RsvpStatus[] = ['GOING', 'NOT_GOING', 'MAYBE'];
const INVITE_VALUES: InvitationStatus[] = ['PENDING', 'ACCEPTED', 'DECLINED'];
const asRsvp = (value: unknown) => RSVP_VALUES.find((item) => item === value) ?? null;
const asInvitation = (value: unknown) => INVITE_VALUES.find((item) => item === value) ?? null;

const readList = (payload: unknown, key: string): Record<string, unknown>[] => {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const inner = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : record;
  const list = inner[key] ?? record[key];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
};

const statusOf = (error: unknown) =>
  error && typeof error === 'object' && 'status' in error ? Number((error as {status: unknown}).status) : 0;

const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * One row per person: invitation status, RSVP and attendance stay separate fields.
 * `participants/get` returns exactly this shape; until the backend has it, {@link mergeLegacy} builds it.
 */
const mapParticipants = (payload: unknown): EventParticipant[] =>
  readList(payload, 'event_participants').map((row) => ({
    userId: text(row.user_id),
    name: text(row.user_full_name),
    isMe: row.is_me === true,
    invitation: asInvitation(row.invitation_status),
    rsvp: asRsvp(row.rsvp_status),
    attended: typeof row.attended === 'boolean' ? row.attended : null
  }));

interface LegacyParts {
  rsvps: Record<string, unknown>[] | null;
  invitations: Record<string, unknown>[] | null;
  attendances: Record<string, unknown>[] | null;
}

// The three legacy lists carry differently encoded user ids, so the rows are joined by name.
const mergeLegacy = ({rsvps, invitations, attendances}: LegacyParts): EventParticipant[] => {
  const byName = new Map<string, EventParticipant>();
  const entry = (userId: string, name: string) => {
    const key = nameKey(name) || userId;
    let current = byName.get(key);
    if (!current) {
      current = {userId, name, isMe: false, invitation: null, rsvp: null, attended: null};
      byName.set(key, current);
    }
    return current;
  };

  invitations?.forEach((row) => {
    entry(text(row.invited_user_id), text(row.invited_user_full_name)).invitation = asInvitation(row.status);
  });
  rsvps?.forEach((row) => {
    entry(text(row.user_id), text(row.user_full_name)).rsvp = asRsvp(row.status);
  });
  attendances?.forEach((row) => {
    entry(text(row.user_id), text(row.user_full_name)).attended = row.attended === true;
  });

  return Array.from(byName.values());
};

export function useEventResponses({
  groupId,
  locale,
  eventId,
  enabled,
  canRsvp,
  canInvite,
  canReadAttendance,
  messages
}: UseEventResponsesOptions) {
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [members, setMembers] = useState<GroupUser[]>([]);
  const [localStatus, setLocalStatus] = useState<RsvpStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const base = useCallback(
    (extra: Record<string, unknown> = {}) => ({group_id: groupId, group_calendar_event_id: eventId, ...extra}),
    [groupId, eventId]
  );

  const call = useCallback(
    (path: string, extra?: Record<string, unknown>) =>
      worfFetch({path: `${EVENT_PATH}/${path}`, locale, body: base(extra), silentError: true}),
    [base, locale]
  );

  // One fetch for the event's people; switching tabs never calls it again.
  const load = useCallback(async () => {
    if (!eventId) return;

    try {
      setParticipants(mapParticipants(await call('participants/get')));
      return;
    } catch (error) {
      if (![404, 405, 422].includes(statusOf(error))) throw error;
    }

    const safe = (allowed: boolean, path: string, key: string) =>
      allowed ? call(path).then((payload) => readList(payload, key)).catch(() => null) : Promise.resolve(null);
    const [rsvps, invitations, attendances] = await Promise.all([
      safe(canRsvp, 'rsvp/get', 'event_rsvps'),
      safe(canInvite, 'invite/get', 'event_invitations'),
      safe(canReadAttendance, 'attendance/get', 'event_attendances')
    ]);
    setParticipants(mergeLegacy({rsvps, invitations, attendances}));
  }, [call, canInvite, canReadAttendance, canRsvp, eventId]);

  useEffect(() => {
    setParticipants([]);
    setLocalStatus(null);

    if (!enabled || !eventId) return;

    let mounted = true;
    setIsLoading(true);
    void load()
      .catch(() => undefined)
      .finally(() => mounted && setIsLoading(false));

    if (canInvite) {
      getGroupMembers(groupId)
        .then((response) => mounted && setMembers(parseGroupUsers(response)))
        .catch(() => undefined);
    }

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, eventId, groupId]);

  const me = participants.find((item) => item.isMe);
  const myStatus = localStatus ?? me?.rsvp ?? null;
  const hasPendingInvite = me?.invitation === 'PENDING';

  const run = async (action: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await action();
    } catch {
      // worfFetch already toasted (or the caller did) — nothing to add here.
    } finally {
      setIsBusy(false);
    }
  };

  const setRsvp = (status: RsvpStatus) =>
    run(async () => {
      await worfFetch({path: `${EVENT_PATH}/rsvp/set`, locale, body: base({status}), successMessage: messages.rsvpSaved});
      setLocalStatus(status);
      await load();
    });

  // Accept = GOING, decline = NOT_GOING: the server syncs the RSVP from the invitation answer.
  const respondToInvitation = (accept: boolean) =>
    run(async () => {
      await worfFetch({
        path: `${EVENT_PATH}/invite/respond`,
        locale,
        body: base({status: accept ? 'ACCEPTED' : 'DECLINED'}),
        successMessage: messages.rsvpSaved
      });
      setLocalStatus(accept ? 'GOING' : 'NOT_GOING');
      await load();
    });

  const invite = (invitedUserId: string) =>
    run(async () => {
      try {
        await worfFetch({
          path: `${EVENT_PATH}/invite/create`,
          locale,
          body: base({invited_user_id: invitedUserId}),
          successMessage: messages.inviteSent,
          silentError: true
        });
      } catch (error) {
        toast.error(statusOf(error) === 409 ? messages.alreadyInvited : (error as Error).message);
        return;
      }
      await load();
    });

  const markAttendance = (userId: string, attended: boolean) =>
    run(async () => {
      await worfFetch({
        path: `${EVENT_PATH}/attendance/mark`,
        locale,
        body: base({user_id: userId, attended}),
        successMessage: messages.attendanceSaved
      });
      await load();
    });

  return {
    participants,
    members,
    myStatus,
    hasPendingInvite,
    isLoading,
    isBusy,
    setRsvp,
    respondToInvitation,
    invite,
    markAttendance
  };
}
