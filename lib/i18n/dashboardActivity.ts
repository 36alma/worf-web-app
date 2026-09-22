import type {ActivityItem} from '@/lib/types/dashboard';

/** The slice of next-intl's translator this needs — lets a plain stub stand in for it in tests. */
export interface ActivityTranslator {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
}

/** Types whose message shows the change (`from → to`); everything else just names what was changed. */
const WITH_VALUES = new Set(['task.status_changed', 'task.priority_changed']);

/**
 * The sentence for one feed row, from the `dashboard.activity` namespace (`events.<entity>.<action>`).
 * `translateValue` turns a stored value into text (a status or priority label) — the raw value when it has none.
 * An action this build has no sentence for still reads sensibly ("X changed: title") instead of showing a key.
 */
export function describeActivity(
  t: ActivityTranslator,
  item: ActivityItem,
  translateValue: (type: string, value: string) => string
): string {
  const values = {
    actor: item.actor?.fullname?.trim() || t('someone'),
    title: item.entity.title,
    from: item.old_value ? translateValue(item.type, item.old_value) : '',
    to: item.new_value ? translateValue(item.type, item.new_value) : ''
  };

  const wantsValues = WITH_VALUES.has(item.type) && !!item.old_value && !!item.new_value;
  const key = `events.${item.type}${WITH_VALUES.has(item.type) && !wantsValues ? '_plain' : ''}`;
  return t.has(key) ? t(key, values) : t('events.unknown', values);
}
