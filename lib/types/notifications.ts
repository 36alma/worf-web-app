export type NotificationChannel = 'MAIL' | 'PUSH' | 'TELEGRAM' | 'INBOX';

export type NotificationCategory = 'EVENT' | 'TASK' | 'MINUTES' | 'POST' | 'GROUP' | 'AUTH' | 'SYSTEM';

export type InboxFilter = 'all' | 'unread' | 'actionable' | 'archived';

export type InboxEntityType = 'event' | 'task' | 'minutes' | 'post';

export type InboxActionKind = 'ACCEPT' | 'DECLINE' | 'OPEN';

export type InboxActionStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'FORBIDDEN';

export type InboxActionResult = 'ACCEPTED' | 'DECLINED' | null;

export interface PreferenceType {
  notification_type: string;
  category: NotificationCategory;
  label: string;
  channels: NotificationChannel[];
  configurable: boolean;
}

/** `group_id: null` = the exception applies to every group. */
export interface PreferenceOptOut {
  notification_type: string;
  channel: NotificationChannel;
  group_id: string | null;
  group_name: string | null;
}

export interface PreferencesResponse {
  types: PreferenceType[];
  opt_outs: PreferenceOptOut[];
}

export interface PreferenceChange {
  notification_type: string;
  channel: NotificationChannel;
  /** Omit for a group-independent change; the server rejects a `group_id` the caller isn't a member of. */
  group_id?: string;
  /** `false` creates the opt-out (turns the channel off); `true` removes it (turns it back on). */
  enabled: boolean;
}

export interface InboxItemAction {
  kind: 'EVENT_INVITATION';
  status: InboxActionStatus;
  available: Array<'ACCEPT' | 'DECLINE'>;
  result: InboxActionResult;
}

/**
 * `notification_id` and `group_id` are opaque and non-deterministic — the same underlying item gets a different
 * string on every response. Only ever send them back verbatim; never compare them as strings and never use
 * `notification_id` as a React `key` (see {@link inboxItemKey} in `lib/utils/inbox.ts`).
 */
export interface InboxItem {
  notification_id: string;
  notification_type: string;
  category: NotificationCategory;
  /** Plain text — render with `{}` interpolation only, never `dangerouslySetInnerHTML`. */
  title: string;
  /** Plain text — same rule as `title`. */
  body: string;
  group_id: string | null;
  group_name: string | null;
  entity: {type: InboxEntityType; id: string} | null;
  actor: {user_id: string; full_name: string} | null;
  /** ISO 8601 UTC, `Z`-suffixed. */
  created_at: string;
  read: boolean;
  archived: boolean;
  action: InboxItemAction | null;
}

export interface InboxListParams {
  filter: InboxFilter;
  category?: NotificationCategory | null;
  /** The previous response's `next_before`; omit for the first page. */
  before?: string | null;
  /** 1–50. */
  load_number: number;
}

export interface InboxListResponse {
  items: InboxItem[];
  next_before: string | null;
}

export interface InboxActionRequest {
  notification_id: string;
  action: InboxActionKind;
}

export interface InboxActionResponse {
  notification_id: string;
  action: InboxActionKind;
  status: 'COMPLETED';
  result: InboxActionResult;
  /** Only present for `OPEN` — where the caller should navigate. */
  target?: {entity_type: InboxEntityType; entity_id: string; group_id: string | null} | null;
}
