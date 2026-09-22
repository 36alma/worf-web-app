import apiClient from './client';

/**
 * NOTE: Minutes endpoints are group-only (require group_id parameter),
 * mirroring the task/sprint endpoints - see lib/api/tasks.ts, lib/api/sprints.ts.
 */

export const listMinutes = (data: {
  group_id: string;
  page_number?: number;
  load_number?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  /** One tag, matched case- and whitespace-insensitively. */
  tag?: string;
  /**
   * `false` (server default): only the not-archived; `true`: only the archived (`archived_at != null`);
   * `null`: both. Records in the trash never appear here — see {@link listMinutesTrash}.
   */
  archived?: boolean | null;
}) => apiClient.post('/v1/minutes/list', data);

export const getMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/get', data);

/** All versions of the chain `minutes_id` belongs to (any version's id works), newest first. */
export const getMinutesVersions = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/versions', data);

/**
 * Copies an `ARCHIVED` version into a brand new `DRAFT` (`max(version) + 1`) — the source stays untouched.
 * Rejected (422) while the chain has a `DRAFT`/`PENDING_APPROVAL` version, or when the source is not archived.
 */
export const restoreMinutesVersion = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/restore', data);

/**
 * `PENDING_APPROVAL` → `DRAFT`: takes the finalization back, every witness vote is reset to PENDING.
 * `notify` (server default `true`) tells the registered witnesses — the caller excepted — about it.
 */
export const recallMinutes = (data: {group_id: string; minutes_id: string; notify?: boolean}) =>
  apiClient.post('/v1/minutes/recall', data);

/**
 * Group members that may be added as a WITNESS (active member, role has `minutes.read` + `minutes.approve`).
 * With a `minutes_id` the minute taker is left out and current participants carry `participant_id`/`participant_role`;
 * without one (import review, no record yet) it is the group-level list and the caller filters the minute taker.
 */
export const listWitnessCandidates = (data: {
  group_id: string;
  minutes_id?: string;
  query?: string;
  /** 1–50, the server defaults to 20. */
  limit?: number;
}) => apiClient.post('/v1/minutes/witness/candidates', data);

/**
 * Group members that may be the minute taker (active member, role has `minutes.modify`).
 * With a `minutes_id` the record's current witnesses are left out (they cannot be minute taker too).
 */
export const listMinuteTakerCandidates = (data: {
  group_id: string;
  minutes_id?: string;
  query?: string;
  /** 1–50, the server defaults to 20. */
  limit?: number;
}) => apiClient.post('/v1/minutes/minute-taker/candidates', data);

/** `list`-shaped answer: the PENDING_APPROVAL minutes where the caller is a witness who has not voted yet. */
export const listPendingWitnessMinutes = (data: {
  group_id: string;
  page_number?: number;
  load_number?: number;
}) => apiClient.post('/v1/minutes/witness/pending', data);

/**
 * Same as {@link listPendingWitnessMinutes} across every group the caller is an active, entitled member of
 * (the global "to do"). The items carry the opaque `group_id`, never the group name.
 */
export const listAllPendingWitnessMinutes = (data: {page_number?: number; load_number?: number} = {}) =>
  apiClient.post('/v1/minutes/witness/pending/all', data);

export const createMinutes = (data: {
  group_id: string;
  subject: string;
  meeting_date: string;
  /** Mandatory since the witness rules landed: an active member whose role has `group.minutes.modify`. */
  minute_taker_id: string;
  location?: string;
  calendar_event_id?: string;
}) => apiClient.post('/v1/minutes/create', data);

export const modifyMinutes = (data: {group_id: string; minutes_id: string; [key: string]: unknown}) =>
  apiClient.post('/v1/minutes/modify', data);

/**
 * Soft delete: the record (this one row, not the whole version chain) goes to the trash and can be brought back
 * with {@link restoreDeletedMinutes} until `restorable_until`. Every status but `PENDING_APPROVAL` (422
 * `minutes.delete_invalid_state` — recall it first) may be deleted.
 */
export const deleteMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/delete', data);

/** Hides the record from the default list and makes it read-only (`archived_at`). Needs `group.minutes.archive`. */
export const archiveMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/archive', data);

export const unarchiveMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/unarchive', data);

/** The group's trash, most recently deleted first (`group.minutes.delete`). */
export const listMinutesTrash = (data: {group_id: string; page_number?: number; load_number?: number}) =>
  apiClient.post('/v1/minutes/trash/list', data);

/**
 * Brings a record back from the trash — NOT the same as {@link restoreMinutesVersion} (which copies an
 * `ARCHIVED`-status version into a new draft). 404: not in the trash; 422: retention expired or the chain already
 * has a live current version.
 */
export const restoreDeletedMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/trash/restore', data);

/** 1–10 tags, each ≤ 100 chars (the server trims / collapses whitespace and de-duplicates case-insensitively). */
export const addMinutesTags = (data: {group_id: string; minutes_id: string; tags: string[]}) =>
  apiClient.post('/v1/minutes/tag/add', data);

export const removeMinutesTags = (data: {group_id: string; minutes_id: string; tags: string[]}) =>
  apiClient.post('/v1/minutes/tag/remove', data);

/** Every tag used in the group (trash excluded) with the number of records carrying it — for autocomplete / filters. */
export const listMinutesTags = (data: {group_id: string}) => apiClient.post('/v1/minutes/tag/list', data);

export const createAgendaItem = (data: {
  group_id: string;
  minutes_id: string;
  sort_order: number;
  title: string;
  content_html?: string;
  presenter_id?: string;
}) => apiClient.post('/v1/minutes/agenda-item/create', data);

export const modifyAgendaItem = (data: {group_id: string; agenda_item_id: string; [key: string]: unknown}) =>
  apiClient.post('/v1/minutes/agenda-item/modify', data);

export const deleteAgendaItem = (data: {group_id: string; agenda_item_id: string}) =>
  apiClient.post('/v1/minutes/agenda-item/delete', data);

export const searchMentionUsers = (data: {group_id: string; query: string; limit?: number}) =>
  apiClient.post('/v1/minutes/mentions/search-users', data);

export const addParticipant = (data: {
  group_id: string;
  minutes_id: string;
  role: string;
  user_id?: string;
  display_name?: string;
}) => apiClient.post('/v1/minutes/participant/add', data);

export const modifyParticipant = (data: {
  group_id: string;
  participant_id: string;
  role?: string;
  display_name?: string;
}) => apiClient.post('/v1/minutes/participant/modify', data);

export const removeParticipant = (data: {group_id: string; participant_id: string}) =>
  apiClient.post('/v1/minutes/participant/remove', data);

export const getParticipantCalendarCandidates = (data: {
  group_id: string;
  minutes_id: string;
  calendar_event_id: string;
}) => apiClient.post('/v1/minutes/participant/calendar-candidates', data);

export const confirmParticipantsFromEvent = (data: {
  group_id: string;
  minutes_id: string;
  selected_user_ids: string[];
}) => apiClient.post('/v1/minutes/participant/confirm-from-event', data);

export const linkAttachment = (data: {group_id: string; minutes_id: string; file_id: string; label?: string}) =>
  apiClient.post('/v1/minutes/attachment/link', data);

export const unlinkAttachment = (data: {group_id: string; attachment_id: string}) =>
  apiClient.post('/v1/minutes/attachment/unlink', data);

export const exportMinutesPdf = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/export/pdf', data);

export const finalizeMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/finalize', data);

export const castWitnessVote = (data: {
  group_id: string;
  minutes_id: string;
  decision: 'APPROVE' | 'REJECT';
  reason?: string;
}) => apiClient.post('/v1/minutes/witness/vote', data);

export const reviseMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/revise', data);

export const analyzeMinutesImport = (data: {group_id: string; file_id: string}) =>
  apiClient.post('/v1/minutes/import/analyze', data);

export const confirmMinutesImport = (data: {
  group_id: string;
  subject: string;
  meeting_date: string;
  /** Mandatory — the AI proposal never contains one, the review step has to ask for it. */
  minute_taker_id: string;
  location?: string;
  calendar_event_id?: string;
  source_file_id?: string;
  agenda_items: unknown[];
  /**
   * `user_id` (a group member, opaque id) or `display_name` (an outsider) per entry. A WITNESS must carry a
   * `user_id`, otherwise the whole call is refused before anything is created.
   */
  participants: Array<{role: string; user_id?: string; display_name?: string}>;
}) => apiClient.post('/v1/minutes/import/confirm', data);
