'use client';

import {useEffect, useMemo, useState} from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import FieldError from '@/components/ui/FieldError';
import {useFieldValidation} from '@/hooks/useFieldValidation';
import {requiredText, optionalText} from '@/lib/validation';
import type {CalendarCopy, CalendarFormValues, GroupCalendarItem} from '../types';

interface CalendarFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  copy: CalendarCopy;
  calendar: GroupCalendarItem | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: CalendarFormValues) => Promise<void>;
}

export default function CalendarFormModal({
  open,
  mode,
  copy,
  calendar,
  submitting,
  onClose,
  onSubmit
}: CalendarFormModalProps) {
  const [values, setValues] = useState<CalendarFormValues>({
    calendarName: '',
    calendarDescription: ''
  });
  const schemas = useMemo(
    () => ({calendarName: requiredText(150), calendarDescription: optionalText(1000)}),
    []
  );
  const {errors, validateField, validateAll, resetErrors} = useFieldValidation(schemas);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValues({
      calendarName: calendar?.name ?? '',
      calendarDescription: calendar?.description ?? ''
    });
    resetErrors();
  }, [calendar, open, resetErrors]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateAll({calendarName: values.calendarName, calendarDescription: values.calendarDescription})) {
      return;
    }

    await onSubmit(values);
  };

  return (
    <Modal open={open} title={mode === 'create' ? copy.createCalendar : copy.editCalendar} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm text-[var(--text-secondary)]">{copy.calendarName}</label>
          <input
            value={values.calendarName}
            onChange={(event) => setValues((current) => ({...current, calendarName: event.target.value}))}
            onBlur={(event) => validateField('calendarName', event.target.value)}
            className="h-[var(--input-height)] w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-sm"
            placeholder={copy.calendarName}
          />
          <FieldError messages={errors.calendarName} />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-[var(--text-secondary)]">{copy.calendarDescription}</label>
          <textarea
            value={values.calendarDescription}
            onChange={(event) =>
              setValues((current) => ({...current, calendarDescription: event.target.value}))
            }
            onBlur={(event) => validateField('calendarDescription', event.target.value)}
            rows={4}
            className="w-full rounded-[var(--input-radius)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
            placeholder={copy.calendarDescription}
          />
          <FieldError messages={errors.calendarDescription} />
        </div>

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
