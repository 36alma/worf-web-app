'use client';

import {useState} from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/Tabs';
import {useEventResponses} from '../hooks/useEventResponses';
import type {CalendarCopy, EventResponsePermissions, GroupCalendarEventItem, SupportedLocale} from '../types';
import EventDetailsTab from './EventDetailsTab';
import EventPeopleTab from './EventPeopleTab';

interface EventViewModalProps {
  open: boolean;
  locale: SupportedLocale;
  groupId: string;
  copy: CalendarCopy;
  event: GroupCalendarEventItem | null;
  canManageEvents: boolean;
  /** RSVP / invitation / attendance rights; without them the event is shown as plain details. */
  permissions?: EventResponsePermissions;
  isDeleting: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

const NO_RIGHTS: EventResponsePermissions = {
  canRsvp: false,
  canInvite: false,
  canReadAttendance: false,
  canMarkAttendance: false
};

// Both panels share one height so switching tabs never makes the modal jump.
const PANEL = 'min-h-[22rem] data-[state=inactive]:hidden';

export default function EventViewModal({
  open,
  locale,
  groupId,
  copy,
  event,
  canManageEvents,
  permissions = NO_RIGHTS,
  isDeleting,
  onClose,
  onEdit,
  onDelete
}: EventViewModalProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [tab, setTab] = useState('details');

  // RSVP / invitations / attendance only exist for SINGLE events (the backend answers 409 otherwise).
  const rawKind = typeof event?.raw.kind === 'string' ? event.raw.kind.toUpperCase() : '';
  const isSingle = rawKind ? rawKind === 'SINGLE' : !event?.rrule;
  const hasRights = permissions.canRsvp || permissions.canInvite || permissions.canReadAttendance;
  const showResponses = Boolean(event) && isSingle && !event?.isCancelled && hasRights;

  // One load for the event's people, shared by both tabs.
  const responses = useEventResponses({
    groupId,
    locale,
    eventId: event?.id ?? null,
    enabled: open && showResponses,
    canRsvp: permissions.canRsvp,
    canInvite: permissions.canInvite,
    canReadAttendance: permissions.canReadAttendance,
    messages: copy.responses
  });

  if (!event) {
    return null;
  }

  const r = copy.responses;
  const details = (
    <EventDetailsTab
      locale={locale}
      copy={copy}
      event={event}
      rsvp={
        showResponses && permissions.canRsvp
          ? {
              participants: responses.participants,
              myStatus: responses.myStatus,
              hasPendingInvite: responses.hasPendingInvite,
              isBusy: responses.isBusy,
              onSetRsvp: responses.setRsvp,
              onRespondToInvitation: responses.respondToInvitation
            }
          : undefined
      }
    />
  );

  return (
    <>
      <Modal
        open={open}
        title={copy.eventDetails}
        badge={event.isCancelled ? <Badge color="red">{copy.deletedEventLabel}</Badge> : null}
        onClose={onClose}
        footer={
          canManageEvents ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onEdit} disabled={isDeleting}>
                {copy.editEvent}
              </Button>
              <Button type="button" variant="danger" onClick={() => setConfirmDeleteOpen(true)} disabled={isDeleting}>
                {copy.deleteEvent}
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{copy.eventName}</p>
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">{event.name}</h3>
          </div>

          {showResponses ? (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList aria-label={r.tabsLabel}>
                <TabsTrigger value="details">{r.tabDetails}</TabsTrigger>
                <TabsTrigger value="people">{r.tabPeople}</TabsTrigger>
              </TabsList>
              <TabsContent value="details" forceMount className={`${PANEL} pt-3`}>
                {details}
              </TabsContent>
              <TabsContent value="people" forceMount className={`${PANEL} pt-3`}>
                <EventPeopleTab
                  copy={r}
                  permissions={permissions}
                  participants={responses.participants}
                  members={responses.members}
                  isLoading={responses.isLoading}
                  isBusy={responses.isBusy}
                  onInvite={responses.invite}
                  onMarkAttendance={responses.markAttendance}
                />
              </TabsContent>
            </Tabs>
          ) : (
            details
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={copy.deleteEvent}
        message={copy.deleteEventPrompt}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          await onDelete();
          setConfirmDeleteOpen(false);
        }}
        cancelLabel={copy.cancel}
        confirmLabel={copy.confirm}
      />
    </>
  );
}
