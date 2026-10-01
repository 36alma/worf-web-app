'use client';

import Button from '@/components/ui/Button';
import type {
  CalendarCopy,
  EventParticipant,
  GroupCalendarEventItem,
  RsvpStatus
} from '../types';
import {formatEventDate} from '../utils/calendarMappers';

interface EventDetailsTabProps {
  locale: string;
  copy: CalendarCopy;
  event: GroupCalendarEventItem;
  /** Undefined when the user has no RSVP right (or the event cannot be answered): the block is left out. */
  rsvp?: {
    participants: EventParticipant[];
    myStatus: RsvpStatus | null;
    hasPendingInvite: boolean;
    isBusy: boolean;
    onSetRsvp: (status: RsvpStatus) => Promise<void>;
    onRespondToInvitation: (accept: boolean) => Promise<void>;
  };
}

const RSVP_ORDER: RsvpStatus[] = ['GOING', 'MAYBE', 'NOT_GOING'];
const label = 'text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]';

export default function EventDetailsTab({locale, copy, event, rsvp}: EventDetailsTabProps) {
  const r = copy.responses;
  const rsvpLabels: Record<RsvpStatus, string> = {GOING: r.going, MAYBE: r.maybe, NOT_GOING: r.notGoing};

  const summary = rsvp
    ? RSVP_ORDER.map((status) => ({
        status,
        count: rsvp.participants.filter((person) => person.rsvp === status).length
      }))
        .filter((item) => item.count > 0)
        .map((item) => `${item.count} ${rsvpLabels[item.status]}`)
        .join(' · ')
    : '';

  return (
    <div className="space-y-5">
      {rsvp?.hasPendingInvite ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
          <span className="text-sm text-[var(--text-primary)]">{r.invitedBanner}</span>
          <span className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={rsvp.isBusy}
              onClick={() => void rsvp.onRespondToInvitation(true)}
            >
              {r.accept}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={rsvp.isBusy}
              onClick={() => void rsvp.onRespondToInvitation(false)}
            >
              {r.decline}
            </Button>
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <p className={label}>{copy.eventKind}</p>
          <p className="text-sm text-[var(--text-primary)]">{copy.kindLabels[event.kind]}</p>
        </div>
        <div className="space-y-1">
          <p className={label}>{copy.eventTimezone}</p>
          <p className="text-sm text-[var(--text-primary)]">{event.timezone ?? copy.emptyValue}</p>
        </div>
        <div className="space-y-1">
          <p className={label}>{copy.eventStart}</p>
          <p className="text-sm text-[var(--text-primary)]">
            {formatEventDate(event.startAt, locale, event.timezone) || copy.emptyValue}
          </p>
        </div>
        <div className="space-y-1">
          <p className={label}>{copy.eventEnd}</p>
          <p className="text-sm text-[var(--text-primary)]">
            {formatEventDate(event.endAt, locale, event.timezone) || copy.emptyValue}
          </p>
        </div>
        <div className="space-y-1 md:col-span-2">
          <p className={label}>{copy.eventLocation}</p>
          <p className="text-sm text-[var(--text-primary)]">{event.location ?? copy.emptyValue}</p>
        </div>
      </div>

      {rsvp ? (
        <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
          <p className={label}>{r.yourAnswer}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={r.yourAnswer}>
            {RSVP_ORDER.map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={rsvp.myStatus === status ? 'primary' : 'secondary'}
                aria-pressed={rsvp.myStatus === status}
                disabled={rsvp.isBusy}
                onClick={() => void rsvp.onSetRsvp(status)}
              >
                {rsvpLabels[status]}
              </Button>
            ))}
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{summary || r.summaryEmpty}</p>
        </div>
      ) : null}
    </div>
  );
}
