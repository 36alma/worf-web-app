export const MINUTES_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ARCHIVED'] as const;
export type MinutesStatus = (typeof MINUTES_STATUSES)[number];

export const PARTICIPANT_ROLES = ['ATTENDEE', 'CHAIR', 'LEADER', 'MINUTE_TAKER', 'WITNESS'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ActionItem {
  id: string;
  agenda_item_id: string;
  description: string;
  due_date?: string | null;
  assignee_user_id?: string | null;
  assignee_group_id?: string | null;
  linked_task_id?: string | null;
}

export interface AgendaItem {
  id: string;
  minutes_id: string;
  sort_order: number;
  title: string;
  discussion?: string | null;
  decision?: string | null;
  presenter_id?: string | null;
  action_items?: ActionItem[];
}

export interface MinutesParticipant {
  id: string;
  minutes_id: string;
  user_id?: string | null;
  display_name?: string | null;
  role: ParticipantRole;
  approval_status?: ApprovalStatus | null;
  approved_at?: string | null;
}

export interface MinutesAttachment {
  id: string;
  minutes_id: string;
  file_id: string;
  label?: string | null;
  uploaded_by_user_id?: string | null;
}

export interface MeetingMinutes {
  id: string;
  root_minutes_id?: string | null;
  group_id: string;
  calendar_event_id?: string | null; // NYERS UUID, nem opaque id
  subject: string;
  meeting_date: string;
  location?: string | null;
  minute_taker_id?: string | null;
  status: MinutesStatus;
  version: number;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  agenda_items?: AgendaItem[];
  participants?: MinutesParticipant[];
  attachments?: MinutesAttachment[];
}

export interface MinutesListResponse {
  minutes: MeetingMinutes[];
  total_minutes: number;
  total_pages: number;
  current_page: number;
}

export interface MinutesImportActionItemProposal {
  description: string;
  due_date?: string;
  assignee_name?: string;
}

export interface MinutesImportAgendaItemProposal {
  title: string;
  discussion?: string;
  decision?: string;
  action_items?: MinutesImportActionItemProposal[];
}

export interface MinutesImportParticipantProposal {
  display_name: string;
  role: ParticipantRole;
}

export interface MinutesImportProposal {
  subject: string;
  meeting_date: string;
  location?: string;
  participants: MinutesImportParticipantProposal[];
  agenda_items: MinutesImportAgendaItemProposal[];
  confidence_notes?: string;
}
