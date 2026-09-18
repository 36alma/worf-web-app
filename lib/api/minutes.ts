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
}) => apiClient.post('/v1/minutes/list', data);

export const getMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/get', data);

export const createMinutes = (data: {
  group_id: string;
  subject: string;
  meeting_date: string;
  location?: string;
  calendar_event_id?: string;
  minute_taker_id?: string;
}) => apiClient.post('/v1/minutes/create', data);

export const modifyMinutes = (data: {group_id: string; minutes_id: string; [key: string]: unknown}) =>
  apiClient.post('/v1/minutes/modify', data);

export const deleteMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/delete', data);

export const createAgendaItem = (data: {
  group_id: string;
  minutes_id: string;
  sort_order: number;
  title: string;
  discussion?: string;
  decision?: string;
  presenter_id?: string;
}) => apiClient.post('/v1/minutes/agenda-item/create', data);

export const modifyAgendaItem = (data: {group_id: string; agenda_item_id: string; [key: string]: unknown}) =>
  apiClient.post('/v1/minutes/agenda-item/modify', data);

export const deleteAgendaItem = (data: {group_id: string; agenda_item_id: string}) =>
  apiClient.post('/v1/minutes/agenda-item/delete', data);

export const createActionItem = (data: {
  group_id: string;
  agenda_item_id: string;
  description: string;
  due_date?: string;
  assignee_user_id?: string;
  assignee_group_id?: string;
}) => apiClient.post('/v1/minutes/action-item/create', data);

export const modifyActionItem = (data: {
  group_id: string;
  action_item_id: string;
  clear_assignee?: boolean;
  [key: string]: unknown;
}) => apiClient.post('/v1/minutes/action-item/modify', data);

export const deleteActionItem = (data: {group_id: string; action_item_id: string}) =>
  apiClient.post('/v1/minutes/action-item/delete', data);

export const promoteActionItemToTask = (data: {group_id: string; action_item_id: string; issue_key?: string}) =>
  apiClient.post('/v1/minutes/action-item/promote-to-task', data);

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

export const prepopulateParticipantsFromEvent = (data: {
  group_id: string;
  minutes_id: string;
  calendar_event_id: string;
}) => apiClient.post('/v1/minutes/participant/prepopulate-from-event', data);

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
  location?: string;
  calendar_event_id?: string;
  minute_taker_id?: string;
  source_file_id?: string;
  agenda_items: unknown[];
  participants: unknown[];
}) => apiClient.post('/v1/minutes/import/confirm', data);
