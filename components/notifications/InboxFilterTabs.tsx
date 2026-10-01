'use client';

import {useTranslations} from 'next-intl';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/Tabs';
import type {InboxFilter} from '@/lib/types/notifications';

const FILTERS: InboxFilter[] = ['all', 'unread', 'actionable', 'archived'];

export interface InboxFilterTabsProps {
  value: InboxFilter;
  onChange: (value: InboxFilter) => void;
}

export default function InboxFilterTabs({value, onChange}: InboxFilterTabsProps) {
  const t = useTranslations('notifications');

  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as InboxFilter)}>
      <TabsList className="w-full justify-between">
        {FILTERS.map((filter) => (
          <TabsTrigger key={filter} value={filter} className="flex-1">
            {t(`filter_${filter}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
