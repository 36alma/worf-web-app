import {useTranslations} from 'next-intl';
import Badge from '../ui/Badge';

const map: Record<string, {color: 'green' | 'yellow' | 'red'; key: string}> = {
  LOW: {color: 'green', key: 'priority_low'},
  MEDIUM: {color: 'yellow', key: 'priority_medium'},
  HIGH: {color: 'red', key: 'priority_high'},
  CRITICAL: {color: 'red', key: 'priority_critical'}
};

export default function TaskPriorityBadge({priority}: {priority: string}) {
  const t = useTranslations('tasks');
  const item = map[priority] ?? map.MEDIUM;
  return <Badge color={item.color}>{t(item.key)}</Badge>;
}
