'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import AgendaItemCard from './AgendaItemCard';
import type {AgendaItem} from './types';
import {createAgendaItem} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface AgendaItemListProps {
  groupId: string;
  minutesId: string;
  agendaItems: AgendaItem[];
  editable: boolean;
  onChange: (items: AgendaItem[]) => void;
}

export default function AgendaItemList({groupId, minutesId, agendaItems, editable, onChange}: AgendaItemListProps) {
  const t = useTranslations('group_minutes');
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      const sortOrder = agendaItems.length;
      const {data} = await createAgendaItem({
        group_id: groupId,
        minutes_id: minutesId,
        sort_order: sortOrder,
        title: newTitle
      });
      const agendaItemId = (data as {agenda_item_id: string}).agenda_item_id;
      onChange([
        ...agendaItems,
        {id: agendaItemId, minutes_id: minutesId, sort_order: sortOrder, title: newTitle, action_items: []}
      ]);
      setNewTitle('');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">{t('agenda.title')}</h2>
      </div>
      {agendaItems
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => (
          <AgendaItemCard
            key={item.id}
            groupId={groupId}
            item={item}
            editable={editable}
            onDeleted={(id) => onChange(agendaItems.filter((a) => a.id !== id))}
            onUpdated={(id, patch) => onChange(agendaItems.map((a) => (a.id === id ? {...a, ...patch} : a)))}
          />
        ))}
      {editable && (
        <div className="flex gap-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('agenda.item_title')} />
          <Button variant="secondary" onClick={handleAdd} startIcon={<Plus className="h-4 w-4" />}>
            {t('agenda.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
