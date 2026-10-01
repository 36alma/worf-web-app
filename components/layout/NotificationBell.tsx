'use client';

import {useState} from 'react';
import {Bell} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Badge from '@/components/ui/Badge';
import InboxPanel from '@/components/notifications/InboxPanel';
import {useInboxUnreadCount} from '@/hooks/useInboxUnreadCount';

export default function NotificationBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const {unread} = useInboxUnreadCount({refreshKey});

  const bumpUnread = () => setRefreshKey((key) => key + 1);

  return (
    <>
      <button
        type="button"
        aria-label={t('bell_aria_label')}
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] outline-none transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 && (
          <Badge variant="danger" className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] justify-center rounded-full px-1 py-0 text-[10px] leading-[1.1rem]">
            {unread > 99 ? '99+' : unread}
          </Badge>
        )}
      </button>

      <InboxPanel open={open} onClose={() => setOpen(false)} onChanged={bumpUnread} />
    </>
  );
}
