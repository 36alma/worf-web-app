'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import MarkdownEditor from '@/components/posts/MarkdownEditor';
import ActionItemRow from './ActionItemRow';
import {buildMinutesEditorI18n} from './minutesEditorI18n';
import type {ActionItem, AgendaItem} from './types';
import {createActionItem, deleteAgendaItem, modifyAgendaItem} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface AgendaItemCardProps {
  groupId: string;
  item: AgendaItem;
  editable: boolean;
  onDeleted: (agendaItemId: string) => void;
  onUpdated: (agendaItemId: string, patch: Partial<AgendaItem>) => void;
}

export default function AgendaItemCard({groupId, item, editable, onDeleted, onUpdated}: AgendaItemCardProps) {
  const t = useTranslations('group_minutes');
  const editorI18n = buildMinutesEditorI18n((key) => t(key as any));
  const [title, setTitle] = useState(item.title);
  const [discussion, setDiscussion] = useState(item.discussion ?? '');
  const [decision, setDecision] = useState(item.decision ?? '');
  const [actionItems, setActionItems] = useState<ActionItem[]>(item.action_items ?? []);
  const [newActionDescription, setNewActionDescription] = useState('');

  const persistField = async (field: 'title' | 'discussion' | 'decision', value: string) => {
    try {
      await modifyAgendaItem({group_id: groupId, agenda_item_id: item.id, [field]: value});
      onUpdated(item.id, {[field]: value} as Partial<AgendaItem>);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handleDeleteAgendaItem = async () => {
    if (!window.confirm(t('agenda.delete_confirm'))) return;
    try {
      await deleteAgendaItem({group_id: groupId, agenda_item_id: item.id});
      onDeleted(item.id);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handleAddActionItem = async () => {
    if (!newActionDescription.trim()) return;
    try {
      const {data} = await createActionItem({
        group_id: groupId,
        agenda_item_id: item.id,
        description: newActionDescription
      });
      const actionItemId = (data as {action_item_id: string}).action_item_id;
      setActionItems((prev) => [
        ...prev,
        {id: actionItemId, agenda_item_id: item.id, description: newActionDescription}
      ]);
      setNewActionDescription('');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <div className="flex items-center justify-between gap-2">
        {editable ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== item.title && void persistField('title', title)}
            className="flex-1 font-medium"
          />
        ) : (
          <h3 className="font-medium text-[var(--text-primary)]">{title}</h3>
        )}
        {editable && (
          <Button variant="ghost" size="sm" onClick={handleDeleteAgendaItem}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-medium uppercase text-[var(--text-secondary)]">{t('agenda.discussion')}</div>
        {editable ? (
          <MarkdownEditor
            value={discussion}
            onChange={(value) => {
              setDiscussion(value);
              void persistField('discussion', value);
            }}
            i18n={editorI18n}
          />
        ) : (
          <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: discussion}} />
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-medium uppercase text-[var(--text-secondary)]">{t('agenda.decision')}</div>
        {editable ? (
          <MarkdownEditor
            value={decision}
            onChange={(value) => {
              setDecision(value);
              void persistField('decision', value);
            }}
            i18n={editorI18n}
          />
        ) : (
          <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: decision}} />
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase text-[var(--text-secondary)]">{t('agenda.action_items')}</div>
        {actionItems.map((action) => (
          <ActionItemRow
            key={action.id}
            groupId={groupId}
            item={action}
            editable={editable}
            onDeleted={(id) => setActionItems((prev) => prev.filter((a) => a.id !== id))}
            onPromoted={(id, taskId) =>
              setActionItems((prev) => prev.map((a) => (a.id === id ? {...a, linked_task_id: taskId} : a)))
            }
          />
        ))}
        {editable && (
          <div className="flex gap-2">
            <Input
              value={newActionDescription}
              onChange={(e) => setNewActionDescription(e.target.value)}
              placeholder={t('agenda.description')}
            />
            <Button variant="secondary" onClick={handleAddActionItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
