export const MINUTES_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ARCHIVED'] as const;
export type MinutesStatus = (typeof MINUTES_STATUSES)[number];

export const PARTICIPANT_ROLES = ['ATTENDEE', 'CHAIR', 'LEADER', 'MINUTE_TAKER', 'WITNESS'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface AgendaItem {
  id: string;
  minutes_id: string;
  sort_order: number;
  title: string;
  content_html?: string | null;
  presenter_id?: string | null;
}

/** The stable `minutes.*` codes a witness can be flagged / refused with. */
export type WitnessIssueCode =
  | 'minutes.witness_requires_registered_user'
  | 'minutes.witness_is_minute_taker'
  | 'minutes.witness_not_eligible';

export interface MinutesParticipant {
  id: string;
  minutes_id: string;
  user_id?: string | null;
  display_name?: string | null;
  role: ParticipantRole;
  approval_status?: ApprovalStatus | null;
  approved_at?: string | null;
  /** Only set for a WITNESS (`get`): still eligible? `null` for every other role. */
  is_eligible?: boolean | null;
  /** Why a witness is not eligible (`is_eligible: false`), otherwise `null`. */
  eligibility_issue?: WitnessIssueCode | string | null;
}

/** A witness the server flagged in a `revise` / `restore` answer (`participant_id` is the NEW version's row). */
export interface MinutesWarning {
  participant_id: string;
  code: string;
}

/**
 * The caller's own standing on the record, computed by the server (`get`). Voting is driven by this block,
 * so the client never has to compare opaque `user_id`s.
 */
export interface MinutesViewer {
  /** The caller is a WITNESS participant on this record. */
  is_witness: boolean;
  /** Witness + PENDING_APPROVAL + the role holds `group.minutes.approve`. Stays true after an APPROVE vote. */
  can_vote: boolean;
  /** `PENDING` / `APPROVED`; `null` for a non-witness. */
  my_approval_status?: ApprovalStatus | null;
}

/** A group member that may be the minute taker (`minute-taker/candidates`). */
export interface MinuteTakerCandidate {
  user_id: string;
  username?: string | null;
  full_name?: string | null;
}

/** A group member that may be added as a WITNESS (`witness/candidates`). */
export interface WitnessCandidate {
  user_id: string;
  username?: string | null;
  full_name?: string | null;
  /** Already a participant on this record — promote with `participant/modify`, not `participant/add`. */
  participant_id?: string | null;
  participant_role?: ParticipantRole | null;
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
  /** Sent by the witness lists (`witness/pending[/all]`), so no separate group lookup is needed for the name. */
  group_name?: string | null;
  calendar_event_id?: string | null; // NYERS UUID, nem opaque id
  subject: string;
  meeting_date: string;
  location?: string | null;
  minute_taker_id?: string | null;
  /** Resolved name of the minute taker, sent by `get` — saves matching the opaque id against the members. */
  minute_taker_fullname?: string | null;
  /** Only sent by `get`: can the minute taker still edit? `null` when the (old) row has no minute taker. */
  minute_taker_is_eligible?: boolean | null;
  status: MinutesStatus;
  version: number;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  agenda_items?: AgendaItem[];
  participants?: MinutesParticipant[];
  attachments?: MinutesAttachment[];
  /** Only sent by `get` (not by `list`/`versions`), and only by servers that already know the witness rules. */
  viewer?: MinutesViewer | null;
  /** Free-text labels, unique case-insensitively (first spelling wins); `[]` when there are none. */
  tags?: string[];
  /**
   * When a user archived the record; `null`/absent = not archived. NOT `status === 'ARCHIVED'` (that one means
   * "superseded by a newer version"). An archived record is read-only and left out of the default list.
   */
  archived_at?: string | null;
  /** Always `null` outside the trash (`get`/`list`/`versions` never return a deleted row). */
  deleted_at?: string | null;
}

/** An item of `trash/list`: the `list` header fields plus who/when deleted it and until when it can be restored. */
export interface TrashedMinutes extends MeetingMinutes {
  deleted_at: string;
  /** User-codec id — matches a group member's `user_id`. */
  deleted_by_id?: string | null;
  restorable_until: string;
}

export interface MinutesTrashResponse {
  minutes: TrashedMinutes[];
  total_minutes: number;
  total_pages: number;
  current_page: number;
}

/** `tag/list` item — how many (not trashed) records carry the tag. */
export interface MinutesTagCount {
  name: string;
  count: number;
}

/** Hard limits of the tag endpoints, mirrored so the UI can refuse before asking the server. */
export const MINUTES_TAG_MAX_LENGTH = 50;
export const MINUTES_TAGS_PER_MINUTES = 10;

/** `export/pdf`: identical content answers with the same `file_id` (`cached: true`) and attaches nothing new. */
export interface MinutesExportResult {
  minutes_id: string;
  file_id: string;
  cached: boolean;
}

export interface MinutesListResponse {
  minutes: MeetingMinutes[];
  total_minutes: number;
  total_pages: number;
  current_page: number;
}

export interface MinutesImportAgendaItemProposal {
  title: string;
  content_html?: string;
}

export interface MinutesImportParticipantProposal {
  display_name: string;
  role: ParticipantRole;
  /**
   * Review-step only: the group member the reviewer assigned to this name (opaque id). The server never
   * proposes one — it does not guess which member a name belongs to.
   */
  user_id?: string;
}

export interface MinutesImportProposal {
  subject: string;
  meeting_date: string;
  location?: string;
  participants: MinutesImportParticipantProposal[];
  agenda_items: MinutesImportAgendaItemProposal[];
  confidence_notes?: string;
}
