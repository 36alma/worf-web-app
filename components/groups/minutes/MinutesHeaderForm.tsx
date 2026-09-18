'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {getGroupMembers} from '@/lib/api/groups';
import type {GroupUser} from '@/components/groups/tasks/types';

const parseGroupUsers = (payload: unknown): GroupUser[] => {
  if (!payload || typeof payload !== 'object') return [];
  const raw = payload as Record<string, unknown>;
  const data = raw.data ?? raw;
  const inner = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const arr = inner.data ?? inner.users ?? inner.group_users ?? inner.items ?? (Array.isArray(data) ? data : []);
  if (!Array.isArray(arr)) return [];

  return arr
    .map((item: any): GroupUser | null => {
      if (!item || typeof item !== 'object') return null;
      const user_id = String(item.user_id ?? '').trim();
      if (!user_id) return null;
      return {
        user_id,
        full_name: String(item.full_name ?? item.fullname ?? item.name ?? item.email ?? ''),
        email: String(item.email ?? ''),
        username: String(item.username ?? (item.email ?? '').split('@')[0] ?? '')
      };
    })
    .filter((user): user is GroupUser => user !== null);
};

export interface MinutesHeaderFormValues {
  subject: string;
  meeting_date: string;
  location: string;
  minute_taker_id: string;
}

export interface MinutesHeaderFormProps {
  groupId: string;
  initial?: Partial<MinutesHeaderFormValues>;
  onSubmit: (values: MinutesHeaderFormValues) => Promise<void>;
  submitLabel: string;
  submitting?: boolean;
}

export default function MinutesHeaderForm({groupId, initial, onSubmit, submitLabel, submitting}: MinutesHeaderFormProps) {
  const t = useTranslations('group_minutes');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [meetingDate, setMeetingDate] = useState(initial?.meeting_date ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [minuteTakerId, setMinuteTakerId] = useState(initial?.minute_taker_id ?? '');
  const [members, setMembers] = useState<GroupUser[]>([]);

  useEffect(() => {
    let mounted = true;
    getGroupMembers(groupId)
      .then((res) => {
        if (!mounted) return;
        setMembers(parseGroupUsers(res.data));
      })
      .catch(() => {
        if (mounted) setMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, [groupId]);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
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
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.minute_taker')}</label>
        <Select value={minuteTakerId} onValueChange={setMinuteTakerId}>
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.user_id} value={member.user_id}>
                {member.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="primary" disabled={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
