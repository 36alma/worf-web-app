/**
 * Response shapes of the cross-group dashboard endpoints — see docs/dashboard-api.md.
 * Ids marked `OpaqueId` are encrypted per response: the same entity comes back as a different string on every call,
 * so they may be sent back to the API but never compared as strings.
 */
import type {Task} from '@/components/groups/tasks/types';

/** `2026-09-21T12:00:00Z` */
export type ISOUtc = string;
export type OpaqueId = string;

export interface DashboardSummary {
  group_count: number;
  open_tasks_count: number;
  overdue_tasks_count: number;
  upcoming_events_count: number;
  next_event_at: ISOUtc | null;
  pending_witness_count: number;
}

export interface DashboardTask extends Task {
  group_id: OpaqueId;
  group_name: string | null;
  /**
   * How the panel names the reporter (the task modal reads `reporter_id`, and the field name has a typo upstream).
   * `normalizeDashboardTask` folds it into `reporter_id`.
   */
  reporter?: {reporter_email?: string; reporter_fullname?: string; reporter_fulname?: string} | null;
}

export interface TaskPanelAllResponse {
  tasks: DashboardTask[];
  total_tasks: number;
  total_pages: number;
  current_page: number;
}

export type TaskScope = 'assigned_to_me' | 'all' | 'reported_by_me';

export interface TaskPanelAllParams {
  page_number?: number;
  /** 1–50 */
  load_number?: number;
  scope?: TaskScope;
  exclude_done?: boolean;
  overdue_only?: boolean;
  include_archived?: boolean;
}

/** One occurrence of an event. `start_at`/`end_at`/`until_at`/`original_start_at` are wall-clock times in `timezone`. */
export interface UpcomingEvent {
  group_calendar_event_id: string;
  group_calendar_id: OpaqueId;
  kind: string;
  name: string;
  parent_id: string | null;
  location: string | null;
  all_day: boolean;
  start_at: string | null;
  end_at: string | null;
  rrule: string | null;
  until_at: string | null;
  count_n: number | null;
  original_start_at: string | null;
  is_cancelled: boolean;
  is_global: boolean;
  timezone: string | null;
  group_id: OpaqueId;
  group_name: string | null;
  calendar_name: string;
  occurrence_start_at: ISOUtc;
  occurrence_end_at: ISOUtc;
}

export interface UpcomingEventsResponse {
  events: UpcomingEvent[];
  total_events: number;
  total_pages: number;
  current_page: number;
}

export interface UpcomingEventsParams {
  /** ISO 8601; defaults to now. */
  from?: string;
  /** Defaults to `from` + 14 days; the whole window is at most 92 days. */
  to?: string;
  page_number?: number;
  /** 1–100 */
  load_number?: number;
}

export type ActivityEntityType = 'task' | 'minutes';

export interface ActivityItem {
  /** e.g. `task.status_changed`, `minutes.approved` */
  type: string;
  actor: {user_id: OpaqueId; fullname: string | null} | null;
  occurred_at: ISOUtc;
  entity: {type: ActivityEntityType; id: OpaqueId; title: string; key: string | null};
  group_id: OpaqueId;
  group_name: string | null;
  old_value: string | null;
  new_value: string | null;
}

export interface ActivityResponse {
  items: ActivityItem[];
  /** Opaque cursor for the next page; `null` when there is nothing more. */
  next_before: string | null;
}

export interface ActivityParams {
  before?: string | null;
  /** 1–50 */
  load_number?: number;
  group_id?: OpaqueId | null;
  /** Entity (`task`) or entity.action (`task.status_changed`) tokens, at most 20. */
  types?: string[] | null;
}
