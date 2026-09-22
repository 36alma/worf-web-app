'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import MinutesContentEditor from './editor/MinutesContentEditor';
import {useChipOpener} from './editor/useChipOpener';
import type {AgendaItem} from './types';
import {deleteAgendaItem, getMinutes, modifyAgendaItem} from '@/lib/api/minutes';
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
  const [title, setTitle] = useState(item.title);
  const [contentHtml, setContentHtml] = useState(item.content_html ?? '');
  const [contentError, setContentError] = useState<string | null>(null);
  const {onContentClick} = useChipOpener();

  const persistField = async (field: 'title' | 'content_html', value: string) => {
    if (field === 'content_html') setContentError(null);
    try {
      await modifyAgendaItem({group_id: groupId, agenda_item_id: item.id, [field]: value});
      let saved = value;
      if (field === 'content_html') {
        // The server re-sanitizes the HTML on save — always show/keep what it stored.
        try {
          const {data} = await getMinutes({group_id: groupId, minutes_id: item.minutes_id});
          const stored = (data?.minutes?.agenda_items ?? data?.agenda_items ?? []) as AgendaItem[];
          saved = stored.find((a) => a.id === item.id)?.content_html ?? value;
          setContentHtml(saved);
        } catch {
          /* keep the editor's own HTML if the re-read fails */
        }
      }
      onUpdated(item.id, {[field]: saved} as Partial<AgendaItem>);
    } catch (error) {
      const detail = (error as {response?: {status?: number; data?: {detail?: unknown}}})?.response;
      if (field === 'content_html' && detail?.status === 422 && typeof detail.data?.detail === 'string') {
        setContentError(detail.data.detail); // e.g. self-reference — the text stays in the editor
      } else {
        toast.error(translateMinutesApiError(t, error, 'errors.default'));
      }
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
        {editable ? (
          <div className="space-y-2">
            <MinutesContentEditor
              groupId={groupId}
              minutesId={item.minutes_id}
              value={contentHtml}
              onChange={setContentHtml}
              placeholder={t('agenda.content_placeholder')}
            />
            {contentError && <p className="text-sm text-[var(--danger,#ef4444)]">{contentError}</p>}
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                disabled={contentHtml === (item.content_html ?? '')}
                onClick={() => void persistField('content_html', contentHtml)}
              >
                {t('agenda.save_content')}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="prose prose-invert minutes-content max-w-none"
            onClick={onContentClick}
            dangerouslySetInnerHTML={{__html: contentHtml}}
          />
        )}
      </div>
    </div>
  );
}
