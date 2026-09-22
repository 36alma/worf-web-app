'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Input} from '@/components/ui/Input';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {useGroupMembers} from '@/hooks/useGroupMembers';
import {useAuthStore} from '@/lib/store/authStore';
import {useMinuteTakerCandidates} from './useMinuteTakerCandidates';
import {resolveCurrentUserId} from './witness';

export interface MinuteTakerSelectProps {
  groupId: string;
  value: string;
  onChange: (userId: string) => void;
  /** The record being edited: its current witnesses are left out (they cannot be minute taker too). */
  minutesId?: string;
  /** Preselect the signed-in user once the candidates arrive, while the field is still empty. */
  autoFillSelf?: boolean;
}

interface Option {
  user_id: string;
  label: string;
}

/**
 * The mandatory minute taker, picked from `minute-taker/candidates`: active members whose role has
 * `group.minutes.modify`. Only an entitled member is offered, so `minutes.minute_taker_not_eligible` is rare.
 *
 * If that endpoint cannot be reached the members are offered instead and the server has the last word.
 */
export default function MinuteTakerSelect({
  groupId,
  value,
  onChange,
  minutesId,
  autoFillSelf = true
}: MinuteTakerSelectProps) {
  const t = useTranslations('group_minutes');
  const members = useGroupMembers(groupId);
  const authUser = useAuthStore((s) => s.user);
  const [query, setQuery] = useState('');
  const {candidates, loading, loaded, failed, truncated} = useMinuteTakerCandidates(groupId, minutesId, {query});
  const prefilled = useRef(!autoFillSelf || !!value);

  const memberLabel = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return member ? member.full_name || member.username : '';
  };

  const options = useMemo<Option[]>(() => {
    const base: Option[] = failed
      ? members.map((m) => ({user_id: m.user_id, label: m.full_name || m.username}))
      : candidates.map((c) => ({user_id: c.user_id, label: c.full_name?.trim() || c.username?.trim() || '—'}));
    return base.sort((a, b) => a.label.localeCompare(b.label));
  }, [candidates, failed, members]);

  const inList = options.some((option) => option.user_id === value);
  // The current value can be missing from the list (lost the permission, beyond the 50 cap, filtered by the
  // search): pinning it keeps the trigger from going blank.
  const shown = useMemo<Option[]>(
    () => (value && !inList ? [{user_id: value, label: memberLabel(value) || t('participants.unknown_name')}, ...options] : options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, value, inList, members, t]
  );
  const searching = query.trim().length > 0;
  const noLongerEligible = !!value && loaded && !failed && !truncated && !searching && !inList;

  // "Me" is the usual minute taker, and prefilling keeps the mandatory field from blocking the form.
  // It runs once (and only for someone who is actually a candidate), so a deliberate change is never overwritten.
  useEffect(() => {
    if (prefilled.current || !loaded || (failed && members.length === 0)) return;
    const myId = resolveCurrentUserId(authUser, members);
    if (myId && options.some((option) => option.user_id === myId)) {
      onChange(myId);
    }
    prefilled.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, members, options, loaded, failed]);

  return (
    <div className="space-y-1">
      <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">
        {t('form.minute_taker')} <span className="text-[var(--danger)]">*</span>
      </label>

      {(truncated || searching) && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('participants.witness_search_placeholder')}
          aria-label={t('participants.witness_search_placeholder')}
        />
      )}

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={t('form.minute_taker')}>
          <SelectValue placeholder={loading && !loaded ? t('editor.flow.loading') : t('form.minute_taker_placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {shown.map((option) => (
            <SelectItem key={option.user_id} value={option.user_id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loaded && !loading && !failed && candidates.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {searching ? t('participants.witness_no_match') : t('form.minute_taker_no_candidates')}
        </p>
      )}
      {noLongerEligible && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{t('form.minute_taker_not_eligible_selected')}</p>
      )}
      {truncated && <p className="text-xs text-[var(--text-tertiary)]">{t('participants.witness_truncated')}</p>}
      <p className="text-xs text-[var(--text-tertiary)]">{t('form.minute_taker_hint')}</p>
    </div>
  );
}
