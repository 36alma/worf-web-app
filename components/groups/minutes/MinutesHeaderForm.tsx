'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import MinuteTakerSelect from './MinuteTakerSelect';

export interface MinutesHeaderFormValues {
  subject: string;
  meeting_date: string;
  location: string;
  minute_taker_id: string;
}

export interface MinutesHeaderFormProps {
  groupId: string;
  /** The record being edited (not set on create) — its witnesses are left out of the minute-taker candidates. */
  minutesId?: string;
  initial?: Partial<MinutesHeaderFormValues>;
  onSubmit: (values: MinutesHeaderFormValues) => Promise<void>;
  submitLabel: string;
  submitting?: boolean;
}

/**
 * Subject / date / location / minute taker. The minute taker is mandatory (`create`, `modify` and
 * `import/confirm` all refuse a record without one), so the submit button stays disabled until one is picked;
 * a new minutes starts with the signed-in user.
 *
 * `meeting_date` is handled as a `datetime-local` value — callers convert with `minutesDates`.
 */
export default function MinutesHeaderForm({
  groupId,
  minutesId,
  initial,
  onSubmit,
  submitLabel,
  submitting
}: MinutesHeaderFormProps) {
  const t = useTranslations('group_minutes');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [meetingDate, setMeetingDate] = useState(initial?.meeting_date ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [minuteTakerId, setMinuteTakerId] = useState(initial?.minute_taker_id ?? '');

  const canSubmit = !submitting && !!subject.trim() && !!meetingDate && !!minuteTakerId;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        void onSubmit({subject, meeting_date: meetingDate, location, minute_taker_id: minuteTakerId});
      }}
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.subject')}</label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.meeting_date')}</label>
        <Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.location')}</label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <MinuteTakerSelect groupId={groupId} minutesId={minutesId} value={minuteTakerId} onChange={setMinuteTakerId} />
      <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit}>
        {submitLabel}
      </Button>
    </form>
  );
}
