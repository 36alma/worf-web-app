'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ArrowUpRight, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import type {ActionItem} from './types';
import {deleteActionItem, promoteActionItemToTask} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface ActionItemRowProps {
  groupId: string;
  item: ActionItem;
  editable: boolean;
  onDeleted: (actionItemId: string) => void;
  onPromoted: (actionItemId: string, taskId: string) => void;
}

export default function ActionItemRow({groupId, item, editable, onDeleted, onPromoted}: ActionItemRowProps) {
  const t = useTranslations('group_minutes');
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(t('agenda.delete_action_confirm'))) return;
    setBusy(true);
    try {
      await deleteActionItem({group_id: groupId, action_item_id: item.id});
      onDeleted(item.id);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const handlePromote = async () => {
    setBusy(true);
    try {
      const {data} = await promoteActionItemToTask({group_id: groupId, action_item_id: item.id});
      const taskId = (data as {task_id: string}).task_id;
      onPromoted(item.id, taskId);
      toast.success(t('agenda.promoted', {issueKey: taskId}));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm text-[var(--text-primary)]">{item.description}</div>
        {item.due_date && (
          <div className="text-xs text-[var(--text-secondary)]">{new Date(item.due_date).toLocaleDateString()}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!item.linked_task_id && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={handlePromote} startIcon={<ArrowUpRight className="h-4 w-4" />}>
            {t('agenda.promote_to_task')}
          </Button>
        )}
        {editable && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
