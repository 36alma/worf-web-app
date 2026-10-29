'use client';

import * as Label from '@radix-ui/react-label';
import {CalendarClock, Globe2, MessageSquare, Timer} from 'lucide-react';
import {useMemo} from 'react';
import {useTranslations} from 'next-intl';
import {Switch} from '@/components/ui/Switch';
import type {PostWriteStatus} from '@/lib/api/posts';
import {listTimeZones} from '@/lib/utils/zonedTime';

export interface PublishSettingsValue {
  status: PostWriteStatus;
  /** `YYYY-MM-DDTHH:mm` wall clock in `timeZone`. */
  publishAt: string;
  expiresAt: string;
  timeZone: string;
  commentsEnabled: boolean;
}

interface PostPublishSettingsProps {
  value: PublishSettingsValue;
  statuses: PostWriteStatus[];
  disabled?: boolean;
  errors: {publishAt?: string; expiresAt?: string};
  onChange: (patch: Partial<PublishSettingsValue>) => void;
}

const inputClass =
  'form-input h-10 w-full rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 text-[14px] text-[var(--text-primary)] outline-none hover:border-[var(--border-hover)] focus:border-[var(--border-focus)] disabled:opacity-50';
const labelClass = 'form-label mb-2 flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]';

export default function PostPublishSettings({value, statuses, disabled, errors, onChange}: PostPublishSettingsProps) {
  const t = useTranslations('posts.publish');
  const statusT = useTranslations('posts.status');
  const zones = useMemo(() => listTimeZones(), []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="form-group">
        <Label.Root htmlFor="post-status" className={labelClass}>
          {t('status')}
        </Label.Root>
        <select
          id="post-status"
          value={value.status}
          disabled={disabled}
          onChange={(event) => onChange({status: event.target.value as PostWriteStatus})}
          className={inputClass}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusT(status)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{t(`statusHint.${value.status}`)}</p>
      </div>

      <div className="form-group">
        <Label.Root htmlFor="post-timezone" className={labelClass}>
          <Globe2 size={14} strokeWidth={1.75} />
          {t('timeZone')}
        </Label.Root>
        <select
          id="post-timezone"
          value={value.timeZone}
          disabled={disabled}
          onChange={(event) => onChange({timeZone: event.target.value})}
          className={inputClass}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </div>

      {value.status === 'scheduled' && (
        <div className="form-group">
          <Label.Root htmlFor="post-publish-at" className={labelClass}>
            <CalendarClock size={14} strokeWidth={1.75} />
            {t('publishAt')}
          </Label.Root>
          <input
            id="post-publish-at"
            type="datetime-local"
            value={value.publishAt}
            disabled={disabled}
            onChange={(event) => onChange({publishAt: event.target.value})}
            className={inputClass}
          />
          {errors.publishAt && <p className="mt-1 text-xs text-[var(--danger)]">{errors.publishAt}</p>}
        </div>
      )}

      <div className="form-group">
        <Label.Root htmlFor="post-expires-at" className={labelClass}>
          <Timer size={14} strokeWidth={1.75} />
          {t('expiresAt')}
        </Label.Root>
        <div className="flex gap-2">
          <input
            id="post-expires-at"
            type="datetime-local"
            value={value.expiresAt}
            disabled={disabled}
            onChange={(event) => onChange({expiresAt: event.target.value})}
            className={inputClass}
          />
          {value.expiresAt && !disabled && (
            <button
              type="button"
              onClick={() => onChange({expiresAt: ''})}
              className="shrink-0 rounded-md px-2 text-xs text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
            >
              {t('clear')}
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{t('expiresHint')}</p>
        {errors.expiresAt && <p className="mt-1 text-xs text-[var(--danger)]">{errors.expiresAt}</p>}
      </div>

      <div className="form-group flex items-center justify-between gap-3 md:col-span-2">
        <Label.Root htmlFor="post-comments" className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]">
          <MessageSquare size={14} strokeWidth={1.75} />
          {t('commentsEnabled')}
        </Label.Root>
        <Switch
          id="post-comments"
          checked={value.commentsEnabled}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({commentsEnabled: checked})}
        />
      </div>
    </div>
  );
}
