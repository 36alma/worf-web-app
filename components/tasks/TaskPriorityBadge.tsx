import {useTranslations} from 'next-intl';
import Badge from '../ui/Badge';

const map: Record<string, {color: 'green' | 'yellow' | 'red'; key: string}> = {
  LOWEST: {color: 'green', key: 'priority_lowest'},
  LOW: {color: 'green', key: 'priority_low'},
  MEDIUM: {color: 'yellow', key: 'priority_medium'},
  HIGH: {color: 'red', key: 'priority_high'},
  HIGHEST: {color: 'red', key: 'priority_highest'}
};

export default function TaskPriorityBadge({priority}: {priority: string}) {
  const t = useTranslations('tasks');
  const item = map[priority] ?? map.MEDIUM;
  return <Badge color={item.color}>{t(item.key as any)}</Badge>;
}
