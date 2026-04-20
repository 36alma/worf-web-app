import {useTranslations} from 'next-intl';
import Badge from '../ui/Badge';

const statusMap: Record<string, {key: string; color: 'slate' | 'indigo' | 'green' | 'red' | 'yellow'}> = {
  TODO: {key: 'status_todo', color: 'slate'},
  IN_PROGRESS: {key: 'status_in_progress', color: 'indigo'},
  DONE: {key: 'status_done', color: 'green'},
  BLOCKED: {key: 'status_blocked', color: 'red'},
  REVIEW: {key: 'status_review', color: 'yellow'}
};

export default function TaskStatusBadge({status}: {status: string}) {
  const t = useTranslations('tasks');
  const view = statusMap[status] ?? statusMap.TODO;
  return <Badge color={view.color}>{t(view.key as any)}</Badge>;
}
