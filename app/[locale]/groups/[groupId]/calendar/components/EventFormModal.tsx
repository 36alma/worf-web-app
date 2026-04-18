'use client';

import {useEffect, useMemo, useState} from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type {
  CalendarCopy,
  EventDraftRange,
  EventFormValues,
  GroupCalendarEventItem,
  SupportedLocale
} from '../types';
import {getInitialEventFormValues} from '../utils/calendarMappers';
import {getTimezoneGroups, getTimezoneDisplayName, getTimezoneOffset} from '../utils/timezones';

interface EventFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  copy: CalendarCopy;
  locale: SupportedLocale;
  event: GroupCalendarEventItem | null;
  initialRange: EventDraftRange | null;
  timezone: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: EventFormValues) => Promise<void>;
}

export default function EventFormModal({
  open,
  mode,
  copy,
  locale,
  event,
  initialRange,
  timezone,
  submitting,
  onClose,
  onSubmit
}: EventFormModalProps) {
  const timezoneGroups = useMemo(() => getTimezoneGroups(locale), [locale]);
  const [values, setValues] = useState<EventFormValues>(() =>
    getInitialEventFormValues(null, null, timezone)
  );
  const [error, setError] = useState('');
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextValues = getInitialEventFormValues(event, initialRange, timezone);
    setValues(nextValues);
    setError('');
    setShowOptionalFields(Boolean(nextValues.location || nextValues.timezone));
  }, [event, initialRange, open, timezone]);

  const dateInputType = values.allDay ? 'date' : 'datetime-local';

  const handleSubmit = async (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (!values.name.trim()) {
      setError(copy.validationName);
      return;
    }

    if (!values.kind) {
      setError(copy.validationKind);
      return;
    }

    if (values.startAt && values.endAt && new Date(values.endAt).getTime() < new Date(values.startAt).getTime()) {
      setError(copy.validationStartEnd);
      return;
    }

    if (values.repeatEnabled && values.repeatEnds === 'until' && !values.untilAt.trim()) {
      setError(copy.validationRepeatUntil);
      return;
    }

    if (
      values.repeatEnabled &&
      values.repeatEnds === 'count' &&
      (!values.countN.trim() || Number(values.countN) < 1)
    ) {
      setError(copy.validationRepeatCount);
      return;
    }

    setError('');
    await onSubmit(values);
  };

  return (
    <Modal open={open} title={mode === 'create' ? copy.createEvent : copy.editEvent} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm text-[var(--text-secondary)]">{copy.eventName}</label>
            <input
              value={values.name}
              onChange={(event) => setValues((current) => ({...current, name: event.target.value}))}
              className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
              placeholder={copy.eventName}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-[var(--text-secondary)]">{copy.eventKind}</label>
            <select
              value={values.kind}
              onChange={(event) =>
                setValues((current) => ({...current, kind: event.target.value as EventFormValues['kind']}))
              }
              className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
            >
              {Object.entries(copy.kindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={values.allDay}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  allDay: event.target.checked,
                  startAt: '',
                  endAt: ''
                }))
              }
            />
            {copy.allDay}
          </label>

          <div className="space-y-1">
            <label className="text-sm text-[var(--text-secondary)]">{copy.eventStart}</label>
            <input
              type={dateInputType}
              value={values.startAt}
              onChange={(event) => setValues((current) => ({...current, startAt: event.target.value}))}
              className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
            />
          </div>

          {values.startAt ? (
            <div className="space-y-1">
              <label className="text-sm text-[var(--text-secondary)]">{copy.eventEnd}</label>
              <input
                type={dateInputType}
                value={values.endAt}
                onChange={(event) => setValues((current) => ({...current, endAt: event.target.value}))}
                className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
          <button
            type="button"
            onClick={() => setShowOptionalFields((current) => !current)}
            className="text-sm font-medium text-[var(--accent)]"
          >
            {showOptionalFields ? copy.optionalFields : `+ ${copy.addOptionalFields}`}
          </button>

          {showOptionalFields ? (
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm text-[var(--text-secondary)]">{copy.eventLocation}</label>
                <input
                  value={values.location}
                  onChange={(event) =>
                    setValues((current) => ({...current, location: event.target.value}))
                  }
                  className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-[var(--text-secondary)]">{copy.eventTimezone}</label>
                <select
                  value={values.timezone}
                  onChange={(event) =>
                    setValues((current) => ({...current, timezone: event.target.value}))
                  }
                  className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm"
                >
                  <option value="">{copy.eventTimezone}</option>
                  {timezoneGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.zones.map((tz) => {
                        const offset = getTimezoneOffset(tz);
                        const display = getTimezoneDisplayName(tz, locale);
                        return (
                          <option key={tz} value={tz}>
                            {display}{offset ? ` (${offset})` : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
          <label className="flex items-center gap-3 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={values.repeatEnabled}
              onChange={(event) =>
                setValues((current) => ({...current, repeatEnabled: event.target.checked}))
              }
            />
            {copy.repeatLabel}
          </label>

          {values.repeatEnabled ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm text-[var(--text-secondary)]">{copy.repeatFrequency}</label>
                <select
                  value={values.repeatFrequency}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      repeatFrequency: event.target.value as EventFormValues['repeatFrequency']
                    }))
                  }
                  className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm"
                >
                  {Object.entries(copy.repeatFrequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-[var(--text-secondary)]">{copy.repeatLabel}</label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="radio"
                    checked={values.repeatEnds === 'until'}
                    onChange={() => setValues((current) => ({...current, repeatEnds: 'until'}))}
                  />
                  {copy.repeatUntil}
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="radio"
                    checked={values.repeatEnds === 'count'}
                    onChange={() => setValues((current) => ({...current, repeatEnds: 'count'}))}
                  />
                  {copy.repeatCount}
                </label>
              </div>

              {values.repeatEnds === 'until' ? (
                <div className="space-y-1">
                  <label className="text-sm text-[var(--text-secondary)]">{copy.repeatUntil}</label>
                  <input
                    type="datetime-local"
                    value={values.untilAt}
                    onChange={(event) =>
                      setValues((current) => ({...current, untilAt: event.target.value}))
                    }
                    className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-sm text-[var(--text-secondary)]">{copy.repeatCount}</label>
                  <input
                    type="number"
                    min={1}
                    value={values.countN}
                    onChange={(event) =>
                      setValues((current) => ({...current, countN: event.target.value}))
                    }
                    className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 text-sm"
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            {copy.cancel}
          </Button>
          <Button type="submit" disabled={submitting}>
            {copy.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
