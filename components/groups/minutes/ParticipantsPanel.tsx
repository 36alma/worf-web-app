'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus, RefreshCw, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {translateMinutesApiError, translateParticipantRole} from '@/lib/i18n/minutes';
import {getGroupMembers} from '@/lib/api/groups';
import {addParticipant, prepopulateParticipantsFromEvent, removeParticipant} from '@/lib/api/minutes';
import {PARTICIPANT_ROLES, type MinutesParticipant, type ParticipantRole} from './types';
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

export interface ParticipantsPanelProps {
  groupId: string;
  minutesId: string;
  calendarEventId?: string | null;
  participants: MinutesParticipant[];
  editable: boolean;
  onChange: (participants: MinutesParticipant[]) => void;
}

export default function ParticipantsPanel({
  groupId,
  minutesId,
  calendarEventId,
  participants,
  editable,
  onChange
}: ParticipantsPanelProps) {
  const t = useTranslations('group_minutes');
  const [members, setMembers] = useState<GroupUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [freeTextName, setFreeTextName] = useState('');
  const [role, setRole] = useState<ParticipantRole>('ATTENDEE');

  useEffect(() => {
    let mounted = true;
    getGroupMembers(groupId)
      .then((res) => {
        if (!mounted) return;
        setMembers(parseGroupUsers(res.data));
      })
      .catch(() => mounted && setMembers([]));
    return () => {
      mounted = false;
    };
  }, [groupId]);

  const handleAdd = async () => {
    if (!selectedUserId && !freeTextName.trim()) return;
    try {
      const {data} = await addParticipant({
        group_id: groupId,
        minutes_id: minutesId,
        role,
        user_id: selectedUserId || undefined,
        display_name: selectedUserId ? undefined : freeTextName
      });
      const participantId = (data as {participant_id: string}).participant_id;
      onChange([
        ...participants,
        {
          id: participantId,
          minutes_id: minutesId,
          role,
          user_id: selectedUserId || null,
          display_name: selectedUserId ? null : freeTextName
        }
      ]);
      setSelectedUserId('');
      setFreeTextName('');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handleRemove = async (participantId: string) => {
    if (!window.confirm(t('participants.remove_confirm'))) return;
    try {
      await removeParticipant({group_id: groupId, participant_id: participantId});
      onChange(participants.filter((p) => p.id !== participantId));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handlePrepopulate = async () => {
    if (!calendarEventId) return;
    try {
      const {data} = await prepopulateParticipantsFromEvent({
        group_id: groupId,
        minutes_id: minutesId,
        calendar_event_id: calendarEventId
      });
      const newIds = (data as {participant_ids: string[]}).participant_ids;
      if (newIds.length > 0) {
        toast.success(t('participants.prepopulate_from_event'));
      }
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">{t('participants.title')}</h2>
        {editable && calendarEventId && (
          <Button variant="ghost" size="sm" onClick={handlePrepopulate} startIcon={<RefreshCw className="h-4 w-4" />}>
            {t('participants.prepopulate_from_event')}
          </Button>
        )}
      </div>
      <ul className="space-y-1">
        {participants.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm text-[var(--text-primary)]">
            <span>
              {p.user_id ? members.find((m) => m.user_id === p.user_id)?.full_name ?? p.user_id : p.display_name}
              {' — '}
              {translateParticipantRole(t, p.role)}
            </span>
            {editable && (
              <Button variant="ghost" size="sm" onClick={() => handleRemove(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('participants.member')} />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={freeTextName}
            onChange={(e) => setFreeTextName(e.target.value)}
            placeholder={t('participants.free_text_name')}
            className="w-48"
            disabled={!!selectedUserId}
          />
          <Select value={role} onValueChange={(v) => setRole(v as ParticipantRole)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTICIPANT_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {translateParticipantRole(t, r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={handleAdd} startIcon={<Plus className="h-4 w-4" />}>
            {t('participants.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
