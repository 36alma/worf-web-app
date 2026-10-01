'use client';

import {Archive, ArchiveRestore, Bell, CalendarDays, CheckSquare, FileText, Mail, MailOpen, Shield, Trash2, Users} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import Badge from '@/components/ui/Badge';
import {translateInboxActionStatus, translateNotificationCategory} from '@/lib/i18n/notifications';
import {getDateLocale} from '@/lib/utils/calendarHelpers';
import {describeElapsed} from '@/lib/utils/dashboardDates';
import type {InboxItem as InboxItemType} from '@/lib/types/notifications';

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  EVENT: <CalendarDays size={16} strokeWidth={1.75} />,
  TASK: <CheckSquare size={16} strokeWidth={1.75} />,
  MINUTES: <FileText size={16} strokeWidth={1.75} />,
  POST: <FileText size={16} strokeWidth={1.75} />,
  GROUP: <Users size={16} strokeWidth={1.75} />,
  AUTH: <Shield size={16} strokeWidth={1.75} />,
  SYSTEM: <Bell size={16} strokeWidth={1.75} />
};

const ACTION_STATUS_VARIANT: Record<string, 'info' | 'success' | 'neutral' | 'danger'> = {
  PENDING: 'info',
  COMPLETED: 'success',
  EXPIRED: 'neutral',
  FORBIDDEN: 'danger'
};

export interface InboxItemProps {
  item: InboxItemType;
  busy: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onToggleRead: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}

export default function InboxItem({item, busy, onOpen, onAccept, onDecline, onToggleRead, onToggleArchive, onDelete}: InboxItemProps) {
  const t = useTranslations('notifications');
  const locale = useLocale();

  const now = new Date();
  const dateLocale = getDateLocale(locale);
  const relative = new Intl.RelativeTimeFormat(dateLocale, {numeric: 'auto'});
  const absolute = new Intl.DateTimeFormat(dateLocale, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});

  const when = (() => {
    const at = new Date(item.created_at);
    if (Number.isNaN(at.getTime())) return '';
    const elapsed = describeElapsed(at, now);
    return elapsed ? relative.format(-elapsed.value, elapsed.unit) : absolute.format(at);
  })();

  const canAct = item.action?.status === 'PENDING';

  return (
    <li
      className={`rounded-md border border-[var(--border-subtle)] p-3 transition-colors ${
        item.read ? 'bg-transparent' : 'bg-[var(--bg-hover)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--bg-elevated)] text-[var(--text-tertiary)]">
          {CATEGORY_ICON[item.category] ?? <Bell size={16} strokeWidth={1.75} />}
        </span>

        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block text-[13px] font-medium leading-snug text-[var(--text-primary)]">{item.title}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-[var(--text-secondary)]">{item.body}</span>
          <span className="mt-1 block truncate text-xs text-[var(--text-tertiary)]">
            {[item.actor?.full_name, item.group_name, when].filter(Boolean).join(' · ')}
          </span>
        </button>

        {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />}
      </div>

      {item.action && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-11">
          {canAct ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onAccept}
                className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
              >
                {busy ? t('action_busy') : t('action_accept')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDecline}
                className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
              >
                {busy ? t('action_busy') : t('action_decline')}
              </button>
            </>
          ) : (
            <Badge variant={ACTION_STATUS_VARIANT[item.action.status] ?? 'neutral'}>
              {translateInboxActionStatus(t, item.action.status)}
            </Badge>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 pl-11">
        <span className="text-xs text-[var(--text-tertiary)]">{translateNotificationCategory(t, item.category)}</span>
        <span className="flex-1" />
        <button
          type="button"
          aria-label={item.read ? t('mark_unread') : t('mark_read')}
          onClick={onToggleRead}
          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          {item.read ? <Mail size={14} strokeWidth={1.75} /> : <MailOpen size={14} strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          aria-label={item.archived ? t('unarchive') : t('archive')}
          onClick={onToggleArchive}
          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          {item.archived ? <ArchiveRestore size={14} strokeWidth={1.75} /> : <Archive size={14} strokeWidth={1.75} />}
        </button>
        <button
          type="button"
          aria-label={t('delete')}
          onClick={onDelete}
          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--danger)]"
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </li>
  );
}
