'use client';

import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import toast from 'react-hot-toast';
import {AlertCircle, Bell} from 'lucide-react';
import SideSheet from '@/components/ui/SideSheet';
import EmptyState from '@/components/ui/EmptyState';
import TaskDetailModal from '@/components/groups/tasks/TaskDetailModal';
import type {Task} from '@/components/groups/tasks/types';
import InboxFilterTabs from './InboxFilterTabs';
import InboxItem from './InboxItem';
import {useInboxList} from '@/hooks/useInboxList';
import {useGroupContext} from '@/hooks/useGroupContext';
import {getTask} from '@/lib/api/tasks';
import {translateNotificationApiError} from '@/lib/i18n/notifications';
import {normalizeGroupId} from '@/lib/utils/groupId';
import {toTaskModalPermissions} from '@/lib/utils/dashboardTasks';
import {inboxItemKey} from '@/lib/utils/inbox';
import type {InboxFilter} from '@/lib/types/notifications';

export interface InboxPanelProps {
  open: boolean;
  onClose: () => void;
  /** Called whenever an action may have changed the unread count, so the bell can refetch right away. */
  onChanged: () => void;
}

export default function InboxPanel({open, onClose, onChanged}: InboxPanelProps) {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const router = useRouter();

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const {items, hasMore, loading, loadingMore, failed, loadMore, retry, markRead, toggleArchive, remove, performAction} =
    useInboxList({enabled: open, filter, pageSize: 20});

  // The task a row asked to open, and the record once it has been fetched.
  const [openTask, setOpenTask] = useState<{group_id: string; task_id: string} | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const groupContext = useGroupContext(openTask?.group_id ?? null);

  useEffect(() => {
    if (!openTask) {
      setTask(null);
      return;
    }
    let mounted = true;
    getTask(openTask)
      .then(({data}) => {
        if (!mounted) return;
        const loaded = (data?.task ?? data) as Task & {task_id?: string};
        setTask({...loaded, id: loaded.id || loaded.task_id || openTask.task_id});
      })
      .catch(() => {
        if (!mounted) return;
        toast.error(t('errors.api.404'));
        setOpenTask(null);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTask]);

  const navigateToEntity = useCallback(
    (target: {entity_type: string; entity_id: string; group_id: string | null} | null | undefined) => {
      if (!target?.group_id) return;
      const groupPath = encodeURIComponent(normalizeGroupId(target.group_id));
      if (target.entity_type === 'task') {
        setOpenTask({group_id: normalizeGroupId(target.group_id), task_id: target.entity_id});
        return;
      }
      onClose();
      if (target.entity_type === 'minutes') {
        router.push(`/${locale}/groups/${groupPath}/minutes/${encodeURIComponent(target.entity_id)}`);
      } else if (target.entity_type === 'post') {
        router.push(`/${locale}/groups/${groupPath}/posts/${encodeURIComponent(target.entity_id)}`);
      } else if (target.entity_type === 'event') {
        // No deep-link to a single event yet — land on the group's calendar.
        router.push(`/${locale}/groups/${groupPath}/calendar`);
      }
    },
    [locale, onClose, router]
  );

  const handleOpen = async (notificationId: string, entity: {type: string; id: string} | null, groupId: string | null) => {
    try {
      const response = await performAction(notificationId, 'OPEN');
      onChanged();
      if (response?.target) {
        navigateToEntity(response.target);
      } else if (entity) {
        navigateToEntity({entity_type: entity.type, entity_id: entity.id, group_id: groupId});
      }
    } catch (error) {
      toast.error(translateNotificationApiError(t, error, 'action_error_generic'));
    }
  };

  const handleAction = async (notificationId: string, action: 'ACCEPT' | 'DECLINE') => {
    setBusyId(notificationId);
    try {
      await performAction(notificationId, action);
      onChanged();
    } catch (error) {
      toast.error(translateNotificationApiError(t, error, 'action_error_generic'));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleRead = async (notificationId: string, read: boolean) => {
    try {
      await markRead([notificationId], !read);
      onChanged();
    } catch {
      toast.error(t('error_generic'));
    }
  };

  const handleToggleArchive = async (notificationId: string, archived: boolean) => {
    try {
      await toggleArchive([notificationId], !archived);
      onChanged();
    } catch {
      toast.error(t('error_generic'));
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await remove([notificationId]);
      onChanged();
    } catch {
      toast.error(t('error_generic'));
    }
  };

  const handleLoadMore = async () => {
    try {
      await loadMore();
    } catch {
      toast.error(t('error_generic'));
    }
  };

  const showSkeleton = items === null && !failed && loading;

  return (
    <>
      <SideSheet open={open} onClose={onClose} title={t('title')}>
        <div className="space-y-3">
          <InboxFilterTabs value={filter} onChange={setFilter} />

          {showSkeleton ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-shimmer h-20 w-full rounded-md" />
              ))}
            </div>
          ) : failed ? (
            <EmptyState
              icon={<AlertCircle size={20} strokeWidth={1.75} />}
              action={
                <button type="button" onClick={retry} className="rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                  {t('retry')}
                </button>
              }
            >
              {t('error_generic')}
            </EmptyState>
          ) : items === null || items.length === 0 ? (
            <EmptyState icon={<Bell size={20} strokeWidth={1.75} />}>{t(`empty_${filter}`)}</EmptyState>
          ) : (
            <>
              <ul className="space-y-2">
                {items.map((item, index) => (
                  <InboxItem
                    key={inboxItemKey(item, index)}
                    item={item}
                    busy={busyId === item.notification_id}
                    onOpen={() => handleOpen(item.notification_id, item.entity, item.group_id)}
                    onAccept={() => handleAction(item.notification_id, 'ACCEPT')}
                    onDecline={() => handleAction(item.notification_id, 'DECLINE')}
                    onToggleRead={() => handleToggleRead(item.notification_id, item.read)}
                    onToggleArchive={() => handleToggleArchive(item.notification_id, item.archived)}
                    onDelete={() => handleDelete(item.notification_id)}
                  />
                ))}
              </ul>
              {hasMore && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="rounded-md px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
                  >
                    {loadingMore ? t('loading_more') : t('load_more')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </SideSheet>

      {/* Rendered above the SideSheet so a task row can be opened without leaving the Inbox. */}
      <TaskDetailModal
        open={!!task && !groupContext.loading}
        onClose={() => setOpenTask(null)}
        task={task}
        groupId={openTask?.group_id ?? ''}
        permissions={toTaskModalPermissions(groupContext.hasPermission)}
        groupUsers={groupContext.groupUsers}
        groupUsersLoading={groupContext.groupUsersLoading}
        sprints={groupContext.sprints}
      />
    </>
  );
}
