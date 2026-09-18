# Jegyzőkönyv (Meeting Minutes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note for this session:** per established user preference (lean coding
> workflow — write code directly, skip SDD subagent ceremony, merge only
> at the very end of multi-phase work), this plan is executed *inline* by
> the coordinating session itself, task by task, without dispatching
> implementer/reviewer subagents. The checkbox structure still tracks
> progress.

**Goal:** Build the full frontend Jegyzőkönyv (meeting minutes) module for `worf-app`: CRUD for header/agenda items/action items/participants/attachments, the DRAFT→PENDING_APPROVAL→APPROVED→revise state machine, rich-text agenda item fields with hyperlink support, PDF export, the AI import wizard, and Task/Calendar integration hooks.

**Architecture:** Mirrors the existing `components/groups/tasks/*` + `lib/api/tasks.ts` module shape (thin API wrapper functions, a client-state-holding wrapper component per route, focused sub-components) and the `app/[locale]/groups/[groupId]/posts/*` routing shape (separate list/new/detail pages instead of modals, because the minutes detail view is too complex for a modal). Rich text reuses the existing `components/posts/MarkdownEditor.tsx` Tiptap editor unmodified — its `Link` extension already supports hyperlink insertion.

**Tech Stack:** Next.js App Router (client components), TypeScript, Tiptap (`@tiptap/react` + `@tiptap/extension-link`, already a dependency), `next-intl`, `axios` via `lib/api/client.ts`, `react-hot-toast`, `vitest` for pure-logic unit tests.

**Spec:** `docs/superpowers/specs/2026-09-18-meeting-minutes-design.md`

## Global Constraints

- All `/v1/minutes/*` calls go through `lib/api/client.ts`'s `apiClient` (never raw axios/fetch) — it injects the Bearer token via the `/api/proxy` route and the `x-forwarded-for` header.
- Every jegyzőkönyv-domain id (`id`/`minutes_id`/`agenda_item_id`/`action_item_id`/`participant_id`/`attachment_id`) is opaque — pass through exactly as received, never parse/decode/re-encode client-side.
- `calendar_event_id` is a **raw UUID string**, not an opaque id — never route it through `normalizeGroupId` or similar codec helpers.
- `group_id`/`assignee_group_id` use the same opaque codec as everywhere else in the app — safe to pass through `normalizeGroupId` where the existing pattern already does so (e.g. before `getGroupPermissions`-style calls), but for the `/v1/minutes/*` calls themselves, pass the `groupId` prop through unchanged, exactly as `tasks.ts`/`sprints.ts` do (no normalization inside the API wrapper functions).
- Content-modifying endpoints (`modify`, `agenda-item/*`, `action-item/*`, `participant/*`) are only valid in `DRAFT` — the UI must hide/disable those controls outside `DRAFT` rather than relying solely on the backend 422.
- Attachments (`attachment/link`/`unlink`) and Task-promotion are allowed in any status — never gate those controls on `DRAFT`.
- Follow the codebase's existing test convention: `vitest` unit tests for pure logic (id/status mapping, error translation, proposal normalization) — no unit tests for React CRUD components (none exist for `tasks`/`posts`/`sprints` either); verify UI manually via the `run` skill.
- New i18n keys go under a `group_minutes` namespace in both `messages/en.json` and `messages/hu.json`, following the flat-key structure already used by `tasks`/`posts` (see `messages/en.json:115-180`).
- Follow existing 2-space indent, single-quote, no-semicolon-optional TypeScript style already used in `lib/api/*.ts` and `components/groups/tasks/*`.

---

## Task 1: Types and API client layer

**Files:**
- Create: `components/groups/minutes/types.ts`
- Create: `lib/api/minutes.ts`

**Interfaces:**
- Produces: `MinutesStatus`, `ParticipantRole`, `ApprovalStatus` union types; `MeetingMinutes`, `AgendaItem`, `ActionItem`, `MinutesParticipant`, `MinutesAttachment`, `MinutesListResponse`, `MinutesImportProposal` interfaces (exact shape below) — every later task imports these from `components/groups/minutes/types.ts`.
- Produces: every `lib/api/minutes.ts` export listed below — every later task calls these instead of `apiClient` directly.

- [ ] **Step 1: Write `components/groups/minutes/types.ts`**

```ts
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
  calendar_event_id?: string | null;
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
```

- [ ] **Step 2: Write `lib/api/minutes.ts`**

```ts
import apiClient from './client';

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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors from the two new files (pre-existing unrelated errors, if any, are out of scope).

- [ ] **Step 4: Commit**

```bash
git add components/groups/minutes/types.ts lib/api/minutes.ts
git commit -m "feat(minutes): add types and API client layer"
```

---

## Task 2: Status/role mapping and error translation helpers

**Files:**
- Create: `lib/i18n/minutes.ts`
- Test: `lib/i18n/__tests__/minutes.test.ts`

**Interfaces:**
- Consumes: `MinutesStatus`, `ParticipantRole` from `components/groups/minutes/types.ts` (Task 1).
- Produces: `translateMinutesStatus(t, status)`, `translateParticipantRole(t, role)`, `translateMinutesApiError(t, error, fallbackKey)` — used by every UI task from Task 4 onward.

- [ ] **Step 1: Write the failing test**

```ts
// lib/i18n/__tests__/minutes.test.ts
import {describe, expect, it} from 'vitest';
import {translateMinutesApiError, translateMinutesStatus, translateParticipantRole} from '../minutes';

function fakeTranslator(known: Record<string, string>) {
  const t = ((key: string) => known[key] ?? `MISSING:${key}`) as any;
  t.has = (key: string) => key in known;
  return t;
}

describe('translateMinutesStatus', () => {
  it('maps a known status to its translation', () => {
    const t = fakeTranslator({'group_minutes.status_enum.DRAFT': 'Piszkozat'});
    expect(translateMinutesStatus(t, 'DRAFT')).toBe('Piszkozat');
  });

  it('falls back to the raw status for an unknown value', () => {
    const t = fakeTranslator({});
    expect(translateMinutesStatus(t, 'WEIRD')).toBe('WEIRD');
  });
});

describe('translateParticipantRole', () => {
  it('maps a known role to its translation', () => {
    const t = fakeTranslator({'group_minutes.role_enum.WITNESS': 'Hitelesítő'});
    expect(translateParticipantRole(t, 'WITNESS')).toBe('Hitelesítő');
  });
});

describe('translateMinutesApiError', () => {
  it('maps a known status code to its translation', () => {
    const t = fakeTranslator({'group_minutes.errors.api.422': 'Érvénytelen adat.'});
    const error = {response: {status: 422}};
    expect(translateMinutesApiError(t, error, 'group_minutes.errors.default')).toBe('Érvénytelen adat.');
  });

  it('falls back to the default key for an unmapped status', () => {
    const t = fakeTranslator({'group_minutes.errors.default': 'Ismeretlen hiba.'});
    const error = {response: {status: 418}};
    expect(translateMinutesApiError(t, error, 'group_minutes.errors.default')).toBe('Ismeretlen hiba.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/i18n/__tests__/minutes.test.ts`
Expected: FAIL — `../minutes` module not found.

- [ ] **Step 3: Write `lib/i18n/minutes.ts`**

```ts
type MinimalTranslator = ((key: string, values?: Record<string, unknown>) => string) & {
  has: (key: string) => boolean;
};

export function translateMinutesStatus(t: MinimalTranslator, status: string): string {
  const key = `group_minutes.status_enum.${status}`;
  return t.has(key) ? t(key) : status;
}

export function translateParticipantRole(t: MinimalTranslator, role: string): string {
  const key = `group_minutes.role_enum.${role}`;
  return t.has(key) ? t(key) : role;
}

export function translateMinutesApiError(t: MinimalTranslator, error: unknown, fallbackKey: string): string {
  const status = (error as {response?: {status?: number}} | undefined)?.response?.status;
  const key = status ? `group_minutes.errors.api.${status}` : null;
  if (key && t.has(key)) {
    return t(key);
  }
  return t(fallbackKey);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/i18n/__tests__/minutes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/i18n/minutes.ts lib/i18n/__tests__/minutes.test.ts
git commit -m "feat(minutes): add status/role/error translation helpers"
```

---

## Task 3: i18n keys (en/hu)

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/hu.json`

**Interfaces:**
- Produces: `group_minutes.*` namespace keys consumed by every UI task (4-11) via `useTranslations('group_minutes')`.

- [ ] **Step 1: Add the `group_minutes` namespace to `messages/en.json`**

Insert as a new top-level key (alongside the existing `"tasks"` key at line 115), with this shape:

```json
"group_minutes": {
  "nav_label": "Minutes",
  "list": {
    "title": "Meeting minutes",
    "empty": "No meeting minutes yet.",
    "create": "New minutes",
    "import": "Import from document",
    "filter_status_all": "All statuses",
    "filter_date_from": "From",
    "filter_date_to": "To",
    "version_label": "Version {version}"
  },
  "status_enum": {
    "DRAFT": "Draft",
    "PENDING_APPROVAL": "Pending approval",
    "APPROVED": "Approved",
    "ARCHIVED": "Archived"
  },
  "role_enum": {
    "ATTENDEE": "Attendee",
    "CHAIR": "Chair",
    "LEADER": "Leader",
    "MINUTE_TAKER": "Minute taker",
    "WITNESS": "Witness"
  },
  "form": {
    "subject": "Subject",
    "meeting_date": "Meeting date",
    "location": "Location",
    "minute_taker": "Minute taker",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "delete_confirm": "Delete this meeting minutes draft?"
  },
  "agenda": {
    "title": "Agenda items",
    "add": "Add agenda item",
    "item_title": "Title",
    "discussion": "Discussion",
    "decision": "Decision",
    "presenter": "Presenter",
    "delete_confirm": "Delete this agenda item?",
    "action_items": "Action items",
    "add_action_item": "Add action item",
    "description": "Description",
    "due_date": "Due date",
    "assignee": "Assignee",
    "promote_to_task": "Convert to task",
    "promoted": "Linked to task {issueKey}",
    "delete_action_confirm": "Delete this action item?"
  },
  "participants": {
    "title": "Participants",
    "add": "Add participant",
    "role": "Role",
    "member": "Group member",
    "free_text_name": "Name (not a member)",
    "remove_confirm": "Remove this participant?",
    "prepopulate_from_event": "Prefill from calendar event"
  },
  "witness": {
    "title": "Witnesses",
    "progress": "{approved} of {total} witnesses approved",
    "approve": "Approve",
    "reject": "Reject",
    "reason_prompt": "Reason for rejection",
    "rejection_reason": "Rejection reason: {reason}",
    "no_access": "You are not registered as a witness on this record."
  },
  "attachments": {
    "title": "Attachments",
    "add": "Attach file",
    "label": "Label",
    "remove_confirm": "Remove this attachment?",
    "export_pdf": "Export as PDF",
    "exported": "PDF exported and attached."
  },
  "state": {
    "finalize": "Finalize",
    "finalize_confirm": "Finalize this draft and send for witness approval?",
    "finalize_needs_witness": "Add at least one witness before finalizing.",
    "revise": "Create new version",
    "revise_confirm": "Create a new draft version from this approved minutes?"
  },
  "import": {
    "title": "Import meeting minutes",
    "step_upload": "1. Upload document",
    "step_analyze": "2. Analyze",
    "step_review": "3. Review & confirm",
    "upload_hint": "Upload a Word or PDF document to digitize.",
    "analyzing": "Analyzing document…",
    "disabled": "The meeting minutes import feature is not enabled.",
    "confirm": "Create minutes",
    "back": "Back",
    "confidence_notes": "AI notes"
  },
  "editor": {
    "toolbar": {
      "paragraph": "Paragraph",
      "bold": "Bold",
      "italic": "Italic",
      "strikethrough": "Strikethrough",
      "heading1": "Heading 1",
      "heading2": "Heading 2",
      "alignLeft": "Align left",
      "alignCenter": "Align center",
      "alignRight": "Align right",
      "blockquote": "Blockquote",
      "bulletList": "Bullet list",
      "orderedList": "Ordered list",
      "taskList": "Task list",
      "codeBlock": "Code block",
      "horizontalRule": "Horizontal rule",
      "link": "Link",
      "image": "Image",
      "table": "Table"
    },
    "prompts": {
      "linkUrl": "Link URL",
      "imageUrl": "Image URL"
    },
    "autosave": {
      "saving": "Saving…",
      "saved": "Saved",
      "atSuffix": ""
    },
    "table": {
      "insertTable": "Insert table",
      "selectSize": "Select size",
      "addRowBefore": "Add row before",
      "addRowAfter": "Add row after",
      "deleteRow": "Delete row",
      "addColumnBefore": "Add column before",
      "addColumnAfter": "Add column after",
      "deleteColumn": "Delete column",
      "mergeCells": "Merge cells",
      "splitCell": "Split cell",
      "toggleHeader": "Toggle header row",
      "deleteTable": "Delete table",
      "addRow": "Add row",
      "addColumn": "Add column",
      "rowOperations": "Row",
      "columnOperations": "Column",
      "cellOperations": "Cell"
    }
  },
  "errors": {
    "default": "Something went wrong. Please try again.",
    "api": {
      "403": "You don't have permission to do this.",
      "404": "This record was no longer found.",
      "422": "The provided data is invalid.",
      "429": "Too many requests — please wait a moment and try again.",
      "502": "The AI service could not process this document.",
      "503": "The meeting minutes import feature is not enabled."
    }
  }
}
```

- [ ] **Step 2: Add the same namespace to `messages/hu.json`**

Same key structure, Hungarian copy (this repo's default locale is Hungarian per the system's language instruction — translate every string above naturally, e.g. `"nav_label": "Jegyzőkönyvek"`, `"status_enum": {"DRAFT": "Piszkozat", "PENDING_APPROVAL": "Hitelesítésre vár", "APPROVED": "Jóváhagyva", "ARCHIVED": "Archivált"}`, `"role_enum": {"ATTENDEE": "Résztvevő", "CHAIR": "Levezető elnök", "LEADER": "Vezető", "MINUTE_TAKER": "Jegyzőkönyvvezető", "WITNESS": "Hitelesítő"}`, etc., following the same key names 1:1).

- [ ] **Step 3: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); JSON.parse(require('fs').readFileSync('messages/hu.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/hu.json
git commit -m "feat(minutes): add group_minutes i18n namespace"
```

---

## Task 4: Navigation wiring

**Files:**
- Modify: `lib/permissions/access.ts`
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a working `minutes` `NavKey` and sidebar entry — Task 5's `page.tsx` relies on `hasPermission('group.minutes.read')` already being reachable through the group permission context (unchanged — `GroupPermissionContext` fetches the full permission map regardless of nav wiring), but the sidebar link is what makes the route discoverable.

- [ ] **Step 1: Add `minutes` to `NavKey` and the requirement maps in `lib/permissions/access.ts`**

```ts
export type NavKey =
  | 'dashboard'
  | 'groups'
  | 'tasks'
  | 'minutes'
  | 'calendar'
  | 'posts'
  | 'files'
  | 'roles'
  | 'permissions'
  | 'admin'
  | 'profile';
```

In `navPermissionRequirements`, add after the `tasks: 'GROUP_ONLY',` line:

```ts
  minutes: 'GROUP_ONLY',
```

In `groupNavPermissionRequirements`, add after the `tasks: {anyOf: ['group.task.read']},` line:

```ts
  minutes: {anyOf: ['group.minutes.read']},
```

In `systemRoutePermissionRequirements`, add after its `tasks: 'GROUP_ONLY',` line:

```ts
  minutes: 'GROUP_ONLY',
```

In `groupRoutePermissionRequirements`, add after its `tasks: {anyOf: ['group.task.read']},` line:

```ts
  minutes: {anyOf: ['group.minutes.read']},
```

- [ ] **Step 2: Wire the sidebar entry in `components/layout/Sidebar.tsx`**

Add `ScrollText` to the `lucide-react` import on line 10 (append to the existing named-import list).

In `navIcons` (line 34-45), add after `tasks: ClipboardList,`:

```ts
  minutes: ScrollText,
```

In `navKeys` (line 47), insert `'minutes'` right after `'tasks'`:

```ts
const navKeys: NavKey[] = ['dashboard', 'groups', 'tasks', 'minutes', 'calendar', 'posts', 'files', 'roles', 'permissions', 'admin'];
```

In `resolveHref` (around line 265-276), add after the `if (key === 'tasks') return ...` line:

```ts
    if (key === 'minutes') return `/${locale}/groups/${encodedGroupId}/minutes`;
```

The nav label itself is rendered from a translation key elsewhere in the file (follow whatever pattern the existing `tasks` label uses — likely `useTranslations` with a `nav.<key>` or similar lookup; if the label comes from a per-key translation namespace, add `"minutes": "Jegyzőkönyvek"` / `"Minutes"` next to the existing `"tasks"` entry at `messages/en.json:16` and the matching `hu.json` line — check the exact namespace name used by grepping for `"tasks": "Tasks"` in both files before adding).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run the dev server (`run` skill) as a user with `group.minutes.read` in some group's permission map (or temporarily fake it in `GroupPermissionContext` state via devtools) and confirm a "Jegyzőkönyvek" sidebar entry appears under that group and links to `/groups/<id>/minutes` (404 is expected until Task 5 exists — this step only verifies the link renders and the permission gate hides it for users without the permission).

- [ ] **Step 5: Commit**

```bash
git add lib/permissions/access.ts components/layout/Sidebar.tsx messages/en.json messages/hu.json
git commit -m "feat(minutes): wire sidebar navigation and permission gating"
```

---

## Task 5: List page

**Files:**
- Create: `app/[locale]/groups/[groupId]/minutes/page.tsx`
- Create: `components/groups/minutes/MinutesStatusBadge.tsx`
- Create: `components/groups/minutes/MinutesCard.tsx`
- Create: `components/groups/minutes/MinutesListClient.tsx`

**Interfaces:**
- Consumes: `MeetingMinutes`, `MinutesStatus` (Task 1 types), `listMinutes` (Task 1 api), `translateMinutesStatus` (Task 2), `group_minutes.list.*`/`group_minutes.status_enum.*` (Task 3 i18n).
- Produces: the `/groups/[groupId]/minutes` route; `MinutesListClient` exported as default, `{groupId: string; permissions: {create: boolean; import: boolean}}` props — consumed nowhere else (leaf route), but the prop shape is the template Task 6/7's wrapper components copy.

- [ ] **Step 1: Write `components/groups/minutes/MinutesStatusBadge.tsx`**

```tsx
'use client';

import {useTranslations} from 'next-intl';
import {translateMinutesStatus} from '@/lib/i18n/minutes';
import type {MinutesStatus} from './types';

const STATUS_CLASSES: Record<MinutesStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  ARCHIVED: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500'
};

export default function MinutesStatusBadge({status}: {status: MinutesStatus}) {
  const t = useTranslations('group_minutes');
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {translateMinutesStatus(t, status)}
    </span>
  );
}
```

- [ ] **Step 2: Write `components/groups/minutes/MinutesCard.tsx`**

```tsx
'use client';

import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import MinutesStatusBadge from './MinutesStatusBadge';
import type {MeetingMinutes} from './types';

export default function MinutesCard({groupId, minutes}: {groupId: string; minutes: MeetingMinutes}) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const meetingDate = new Date(minutes.meeting_date).toLocaleDateString(locale);

  return (
    <Link
      href={`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(minutes.id)}`}
      className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
    >
      <div className="min-w-0">
        <div className="truncate font-medium text-[var(--text-primary)]">{minutes.subject}</div>
        <div className="text-sm text-[var(--text-secondary)]">
          {meetingDate}
          {minutes.version > 1 ? ` · ${t('list.version_label', {version: minutes.version})}` : ''}
        </div>
      </div>
      <MinutesStatusBadge status={minutes.status} />
    </Link>
  );
}
```

- [ ] **Step 3: Write `components/groups/minutes/MinutesListClient.tsx`**

```tsx
'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations, useLocale} from 'next-intl';
import Link from 'next/link';
import {Plus, FileUp} from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import MinutesCard from './MinutesCard';
import type {MeetingMinutes, MinutesListResponse} from './types';
import {listMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface MinutesListClientProps {
  groupId: string;
  permissions: {create: boolean};
}

export default function MinutesListClient({groupId, permissions}: MinutesListClientProps) {
  const t = useTranslations('group_minutes');
  const locale = useLocale();
  const [minutes, setMinutes] = useState<MeetingMinutes[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {data} = await listMinutes({group_id: groupId, page_number: 1, load_number: 20});
      const payload = data as MinutesListResponse;
      setMinutes(payload.minutes ?? []);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setLoading(false);
    }
  }, [groupId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('list.title')}</h1>
        {permissions.create && (
          <div className="flex gap-2">
            <Link href={`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/import`}>
              <Button variant="secondary">
                <FileUp className="mr-2 h-4 w-4" />
                {t('list.import')}
              </Button>
            </Link>
            <Link href={`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/new`}>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('list.create')}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : minutes.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">{t('list.empty')}</p>
      ) : (
        <div className="space-y-2">
          {minutes.map((item) => (
            <MinutesCard key={item.id} groupId={groupId} minutes={item} />
          ))}
        </div>
      )}
    </section>
  );
}
```

(Check `components/ui/Button.tsx` and `components/ui/Skeleton.tsx` exports before this step — if `Button`'s default export signature or `variant` prop differs from this usage, adjust the JSX to match the real component API rather than the guess above.)

- [ ] **Step 4: Write `app/[locale]/groups/[groupId]/minutes/page.tsx`**

```tsx
'use client';

import {use} from 'react';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import MinutesListClient from '@/components/groups/minutes/MinutesListClient';

export default function GroupMinutesPage({params}: {params: Promise<{groupId: string; locale: string}>}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-40 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  if (!hasPermission('group.minutes.read')) {
    return null;
  }

  return (
    <MinutesListClient
      groupId={decodedGroupId}
      permissions={{create: hasPermission('group.minutes.create')}}
    />
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors (fix any prop-signature mismatches against the real `Button`/`Skeleton` components found in Step 3's check).

- [ ] **Step 6: Manual verification**

Via the `run` skill: navigate to `/groups/<id>/minutes` as a user with `group.minutes.read`. Confirm the empty state renders, then (once the backend has at least one record, or after Task 6 lets you create one) confirm cards render with correct subject/date/status/version.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/groups/[groupId]/minutes/page.tsx components/groups/minutes/MinutesStatusBadge.tsx components/groups/minutes/MinutesCard.tsx components/groups/minutes/MinutesListClient.tsx
git commit -m "feat(minutes): add meeting minutes list page"
```

---

## Task 6: Create page (header form)

**Files:**
- Create: `app/[locale]/groups/[groupId]/minutes/new/page.tsx`
- Create: `components/groups/minutes/MinutesHeaderForm.tsx`

**Interfaces:**
- Consumes: `createMinutes` (Task 1), `getGroupMembers` (existing, from `lib/api/groups.ts` — same helper `TaskClientWrapper.tsx:36` already imports), `group_minutes.form.*` (Task 3).
- Produces: `MinutesHeaderForm` component with props `{groupId: string; initial?: Partial<{subject: string; meeting_date: string; location: string; minute_taker_id: string}>; onSubmit: (values) => Promise<void>; submitLabel: string}` — reused unmodified by Task 9's edit-in-place header section on the detail page.

- [ ] **Step 1: Write `components/groups/minutes/MinutesHeaderForm.tsx`**

```tsx
'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {Select, SelectTrigger, SelectValue, SelectContent, SelectItem} from '@/components/ui/select';
import {getGroupMembers} from '@/lib/api/groups';
import type {GroupUser} from './types-groupuser';

export interface MinutesHeaderFormValues {
  subject: string;
  meeting_date: string;
  location: string;
  minute_taker_id: string;
}

export interface MinutesHeaderFormProps {
  groupId: string;
  initial?: Partial<MinutesHeaderFormValues>;
  onSubmit: (values: MinutesHeaderFormValues) => Promise<void>;
  submitLabel: string;
  submitting?: boolean;
}

export default function MinutesHeaderForm({groupId, initial, onSubmit, submitLabel, submitting}: MinutesHeaderFormProps) {
  const t = useTranslations('group_minutes');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [meetingDate, setMeetingDate] = useState(initial?.meeting_date ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [minuteTakerId, setMinuteTakerId] = useState(initial?.minute_taker_id ?? '');
  const [members, setMembers] = useState<GroupUser[]>([]);

  useEffect(() => {
    let mounted = true;
    getGroupMembers(groupId)
      .then((res: any) => {
        if (!mounted) return;
        const list = res?.data?.data ?? res?.data ?? [];
        setMembers(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (mounted) setMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, [groupId]);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({subject, meeting_date: meetingDate, location, minute_taker_id: minuteTakerId});
      }}
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.subject')}</label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.meeting_date')}</label>
        <Input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.location')}</label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.minute_taker')}</label>
        <Select value={minuteTakerId} onValueChange={setMinuteTakerId}>
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {members.map((member) => (
              <SelectItem key={member.user_id} value={member.user_id}>
                {member.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
```

Before this step, check `components/groups/tasks/types.ts:149-154` for the real `GroupUser` shape and `lib/api/groups.ts` for `getGroupMembers`'s real signature/response shape (`TaskClientWrapper.tsx:36-63` shows the actual unwrap logic — reuse that exact unwrap pattern here instead of the simplified guess above, and import `GroupUser` from `@/components/groups/tasks/types` directly rather than creating a duplicate `types-groupuser` file).

- [ ] **Step 2: Write `app/[locale]/groups/[groupId]/minutes/new/page.tsx`**

```tsx
'use client';

import {use} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import MinutesHeaderForm, {type MinutesHeaderFormValues} from '@/components/groups/minutes/MinutesHeaderForm';
import {createMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export default function NewMinutesPage({params}: {params: Promise<{groupId: string; locale: string}>}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('group_minutes');

  if (isLoading) return null;
  if (!hasPermission('group.minutes.create')) return null;

  const handleSubmit = async (values: MinutesHeaderFormValues) => {
    try {
      const {data} = await createMinutes({
        group_id: decodedGroupId,
        subject: values.subject,
        meeting_date: values.meeting_date,
        location: values.location || undefined,
        minute_taker_id: values.minute_taker_id || undefined
      });
      const minutesId = (data as {minutes_id: string}).minutes_id;
      router.push(`/${locale}/groups/${encodeURIComponent(decodedGroupId)}/minutes/${encodeURIComponent(minutesId)}`);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <section className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">{t('list.create')}</h1>
      <MinutesHeaderForm groupId={decodedGroupId} onSubmit={handleSubmit} submitLabel={t('form.save')} />
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Create a minutes record through the form, confirm redirect to `/minutes/<new-id>` (404 expected until Task 9 exists — confirms the id round-trips correctly by checking the URL).

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/groups/[groupId]/minutes/new/page.tsx components/groups/minutes/MinutesHeaderForm.tsx
git commit -m "feat(minutes): add create-minutes header form and page"
```

---

## Task 7: Rich text editor i18n wiring helper

**Files:**
- Create: `components/groups/minutes/minutesEditorI18n.ts`

**Interfaces:**
- Consumes: `group_minutes.editor.*` (Task 3).
- Produces: `buildMinutesEditorI18n(t): MarkdownEditorI18n` — consumed by Task 8's `AgendaItemCard`.

- [ ] **Step 1: Write `components/groups/minutes/minutesEditorI18n.ts`**

```ts
import type {MarkdownEditorI18n} from '@/components/posts/MarkdownEditor';

type MinimalTranslator = (key: string) => string;

export function buildMinutesEditorI18n(t: MinimalTranslator): MarkdownEditorI18n {
  return {
    toolbar: {
      paragraph: t('editor.toolbar.paragraph'),
      bold: t('editor.toolbar.bold'),
      italic: t('editor.toolbar.italic'),
      strikethrough: t('editor.toolbar.strikethrough'),
      heading1: t('editor.toolbar.heading1'),
      heading2: t('editor.toolbar.heading2'),
      alignLeft: t('editor.toolbar.alignLeft'),
      alignCenter: t('editor.toolbar.alignCenter'),
      alignRight: t('editor.toolbar.alignRight'),
      blockquote: t('editor.toolbar.blockquote'),
      bulletList: t('editor.toolbar.bulletList'),
      orderedList: t('editor.toolbar.orderedList'),
      taskList: t('editor.toolbar.taskList'),
      codeBlock: t('editor.toolbar.codeBlock'),
      horizontalRule: t('editor.toolbar.horizontalRule'),
      link: t('editor.toolbar.link'),
      image: t('editor.toolbar.image'),
      table: t('editor.toolbar.table')
    },
    prompts: {
      linkUrl: t('editor.prompts.linkUrl'),
      imageUrl: t('editor.prompts.imageUrl')
    },
    autosave: {
      saving: t('editor.autosave.saving'),
      saved: t('editor.autosave.saved'),
      atSuffix: t('editor.autosave.atSuffix')
    },
    table: {
      insertTable: t('editor.table.insertTable'),
      selectSize: t('editor.table.selectSize'),
      addRowBefore: t('editor.table.addRowBefore'),
      addRowAfter: t('editor.table.addRowAfter'),
      deleteRow: t('editor.table.deleteRow'),
      addColumnBefore: t('editor.table.addColumnBefore'),
      addColumnAfter: t('editor.table.addColumnAfter'),
      deleteColumn: t('editor.table.deleteColumn'),
      mergeCells: t('editor.table.mergeCells'),
      splitCell: t('editor.table.splitCell'),
      toggleHeader: t('editor.table.toggleHeader'),
      deleteTable: t('editor.table.deleteTable'),
      addRow: t('editor.table.addRow'),
      addColumn: t('editor.table.addColumn'),
      rowOperations: t('editor.table.rowOperations'),
      columnOperations: t('editor.table.columnOperations'),
      cellOperations: t('editor.table.cellOperations')
    }
  };
}
```

Confirm `components/posts/MarkdownEditor.tsx` exports `MarkdownEditorI18n` as a named export (it does — `export interface MarkdownEditorI18n` at line 115) before importing it here.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/groups/minutes/minutesEditorI18n.ts
git commit -m "feat(minutes): add MarkdownEditor i18n adapter for agenda items"
```

---

## Task 8: Agenda items and action items (rich text + hyperlinks)

**Files:**
- Create: `components/groups/minutes/ActionItemRow.tsx`
- Create: `components/groups/minutes/AgendaItemCard.tsx`
- Create: `components/groups/minutes/AgendaItemList.tsx`

**Interfaces:**
- Consumes: `AgendaItem`, `ActionItem` (Task 1), `createAgendaItem`/`modifyAgendaItem`/`deleteAgendaItem`/`createActionItem`/`modifyActionItem`/`deleteActionItem`/`promoteActionItemToTask` (Task 1), `buildMinutesEditorI18n` (Task 7), `MarkdownEditor` default export (existing), `group_minutes.agenda.*` (Task 3).
- Produces: `AgendaItemList` component, props `{groupId: string; minutesId: string; agendaItems: AgendaItem[]; editable: boolean; onChange: (items: AgendaItem[]) => void; groupMembers: GroupUser[]}` — consumed by Task 9's `MinutesDetailClient`.

- [ ] **Step 1: Write `components/groups/minutes/ActionItemRow.tsx`**

```tsx
'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {ArrowUpRight, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import type {ActionItem} from './types';
import {deleteActionItem, promoteActionItemToTask} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface ActionItemRowProps {
  groupId: string;
  item: ActionItem;
  editable: boolean;
  onDeleted: (actionItemId: string) => void;
  onPromoted: (actionItemId: string, taskId: string) => void;
}

export default function ActionItemRow({groupId, item, editable, onDeleted, onPromoted}: ActionItemRowProps) {
  const t = useTranslations('group_minutes');
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(t('agenda.delete_action_confirm'))) return;
    setBusy(true);
    try {
      await deleteActionItem({group_id: groupId, action_item_id: item.id});
      onDeleted(item.id);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const handlePromote = async () => {
    setBusy(true);
    try {
      const {data} = await promoteActionItemToTask({group_id: groupId, action_item_id: item.id});
      const taskId = (data as {task_id: string}).task_id;
      onPromoted(item.id, taskId);
      toast.success(t('agenda.promoted', {issueKey: taskId}));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm text-[var(--text-primary)]">{item.description}</div>
        {item.due_date && (
          <div className="text-xs text-[var(--text-secondary)]">{new Date(item.due_date).toLocaleDateString()}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!item.linked_task_id && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={handlePromote}>
            <ArrowUpRight className="mr-1 h-4 w-4" />
            {t('agenda.promote_to_task')}
          </Button>
        )}
        {editable && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/groups/minutes/AgendaItemCard.tsx`**

```tsx
'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus, Trash2} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import MarkdownEditor from '@/components/posts/MarkdownEditor';
import ActionItemRow from './ActionItemRow';
import {buildMinutesEditorI18n} from './minutesEditorI18n';
import type {AgendaItem, ActionItem} from './types';
import {modifyAgendaItem, deleteAgendaItem, createActionItem} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface AgendaItemCardProps {
  groupId: string;
  item: AgendaItem;
  editable: boolean;
  onDeleted: (agendaItemId: string) => void;
  onUpdated: (agendaItemId: string, patch: Partial<AgendaItem>) => void;
}

export default function AgendaItemCard({groupId, item, editable, onDeleted, onUpdated}: AgendaItemCardProps) {
  const t = useTranslations('group_minutes');
  const editorI18n = buildMinutesEditorI18n((key) => t(key as any));
  const [title, setTitle] = useState(item.title);
  const [discussion, setDiscussion] = useState(item.discussion ?? '');
  const [decision, setDecision] = useState(item.decision ?? '');
  const [actionItems, setActionItems] = useState<ActionItem[]>(item.action_items ?? []);
  const [newActionDescription, setNewActionDescription] = useState('');

  const persistField = async (field: 'title' | 'discussion' | 'decision', value: string) => {
    try {
      await modifyAgendaItem({group_id: groupId, agenda_item_id: item.id, [field]: value});
      onUpdated(item.id, {[field]: value} as Partial<AgendaItem>);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handleDeleteAgendaItem = async () => {
    if (!window.confirm(t('agenda.delete_confirm'))) return;
    try {
      await deleteAgendaItem({group_id: groupId, agenda_item_id: item.id});
      onDeleted(item.id);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handleAddActionItem = async () => {
    if (!newActionDescription.trim()) return;
    try {
      const {data} = await createActionItem({
        group_id: groupId,
        agenda_item_id: item.id,
        description: newActionDescription
      });
      const actionItemId = (data as {action_item_id: string}).action_item_id;
      setActionItems((prev) => [...prev, {id: actionItemId, agenda_item_id: item.id, description: newActionDescription}]);
      setNewActionDescription('');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <div className="flex items-center justify-between gap-2">
        {editable ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== item.title && persistField('title', title)}
            className="flex-1 font-medium"
          />
        ) : (
          <h3 className="font-medium text-[var(--text-primary)]">{title}</h3>
        )}
        {editable && (
          <Button variant="ghost" size="sm" onClick={handleDeleteAgendaItem}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-medium uppercase text-[var(--text-secondary)]">{t('agenda.discussion')}</div>
        {editable ? (
          <MarkdownEditor
            value={discussion}
            onChange={(value) => {
              setDiscussion(value);
              void persistField('discussion', value);
            }}
            i18n={editorI18n}
          />
        ) : (
          <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: discussion}} />
        )}
      </div>

      <div>
        <div className="mb-1 text-xs font-medium uppercase text-[var(--text-secondary)]">{t('agenda.decision')}</div>
        {editable ? (
          <MarkdownEditor
            value={decision}
            onChange={(value) => {
              setDecision(value);
              void persistField('decision', value);
            }}
            i18n={editorI18n}
          />
        ) : (
          <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: decision}} />
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase text-[var(--text-secondary)]">{t('agenda.action_items')}</div>
        {actionItems.map((action) => (
          <ActionItemRow
            key={action.id}
            groupId={groupId}
            item={action}
            editable={editable}
            onDeleted={(id) => setActionItems((prev) => prev.filter((a) => a.id !== id))}
            onPromoted={(id, taskId) =>
              setActionItems((prev) => prev.map((a) => (a.id === id ? {...a, linked_task_id: taskId} : a)))
            }
          />
        ))}
        {editable && (
          <div className="flex gap-2">
            <Input
              value={newActionDescription}
              onChange={(e) => setNewActionDescription(e.target.value)}
              placeholder={t('agenda.description')}
            />
            <Button variant="secondary" onClick={handleAddActionItem}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `components/groups/minutes/AgendaItemList.tsx`**

```tsx
'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import AgendaItemCard from './AgendaItemCard';
import type {AgendaItem} from './types';
import {createAgendaItem} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';

export interface AgendaItemListProps {
  groupId: string;
  minutesId: string;
  agendaItems: AgendaItem[];
  editable: boolean;
  onChange: (items: AgendaItem[]) => void;
}

export default function AgendaItemList({groupId, minutesId, agendaItems, editable, onChange}: AgendaItemListProps) {
  const t = useTranslations('group_minutes');
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      const sortOrder = agendaItems.length;
      const {data} = await createAgendaItem({group_id: groupId, minutes_id: minutesId, sort_order: sortOrder, title: newTitle});
      const agendaItemId = (data as {agenda_item_id: string}).agenda_item_id;
      onChange([...agendaItems, {id: agendaItemId, minutes_id: minutesId, sort_order: sortOrder, title: newTitle, action_items: []}]);
      setNewTitle('');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">{t('agenda.title')}</h2>
      </div>
      {agendaItems
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => (
          <AgendaItemCard
            key={item.id}
            groupId={groupId}
            item={item}
            editable={editable}
            onDeleted={(id) => onChange(agendaItems.filter((a) => a.id !== id))}
            onUpdated={(id, patch) => onChange(agendaItems.map((a) => (a.id === id ? {...a, ...patch} : a)))}
          />
        ))}
      {editable && (
        <div className="flex gap-2">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('agenda.item_title')} />
          <Button variant="secondary" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t('agenda.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors. Fix any `Button`/`Input` prop mismatches against their real component definitions (`components/ui/Button.tsx`, `components/ui/Input.tsx`) — check those files if the compiler flags a prop name/type mismatch.

- [ ] **Step 5: Manual verification**

In a `DRAFT` minutes record (via Task 9's detail page once it exists), add an agenda item, type into the discussion field, use the toolbar's link button to insert a hyperlink, confirm it renders as a clickable link both while editing and after reload (read-only render path).

- [ ] **Step 6: Commit**

```bash
git add components/groups/minutes/ActionItemRow.tsx components/groups/minutes/AgendaItemCard.tsx components/groups/minutes/AgendaItemList.tsx
git commit -m "feat(minutes): add agenda item and action item editing with rich text"
```

---

## Task 9: Detail page shell (header, state machine, participants, witness panel)

**Files:**
- Create: `app/[locale]/groups/[groupId]/minutes/[minutesId]/page.tsx`
- Create: `components/groups/minutes/MinutesDetailClient.tsx`
- Create: `components/groups/minutes/ParticipantsPanel.tsx`
- Create: `components/groups/minutes/WitnessPanel.tsx`
- Create: `components/groups/minutes/MinutesStateActions.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-8 (`types.ts`, `lib/api/minutes.ts`, `MinutesStatusBadge`, `MinutesHeaderForm`, `AgendaItemList`, translation helpers, i18n keys).
- Produces: the `/minutes/[minutesId]` route — terminal for this plan (Task 10/11 add panels into this same page below).

- [ ] **Step 1: Write `components/groups/minutes/ParticipantsPanel.tsx`**

```tsx
'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus, Trash2, RefreshCw} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import {Select, SelectTrigger, SelectValue, SelectContent, SelectItem} from '@/components/ui/select';
import {translateParticipantRole, translateMinutesApiError} from '@/lib/i18n/minutes';
import {getGroupMembers} from '@/lib/api/groups';
import {addParticipant, removeParticipant, prepopulateParticipantsFromEvent} from '@/lib/api/minutes';
import {PARTICIPANT_ROLES, type MinutesParticipant, type ParticipantRole} from './types';
import type {GroupUser} from '@/components/groups/tasks/types';

export interface ParticipantsPanelProps {
  groupId: string;
  minutesId: string;
  calendarEventId?: string | null;
  participants: MinutesParticipant[];
  editable: boolean;
  onChange: (participants: MinutesParticipant[]) => void;
}

export default function ParticipantsPanel({groupId, minutesId, calendarEventId, participants, editable, onChange}: ParticipantsPanelProps) {
  const t = useTranslations('group_minutes');
  const [members, setMembers] = useState<GroupUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [freeTextName, setFreeTextName] = useState('');
  const [role, setRole] = useState<ParticipantRole>('ATTENDEE');

  useEffect(() => {
    let mounted = true;
    getGroupMembers(groupId)
      .then((res: any) => {
        if (!mounted) return;
        const list = res?.data?.data ?? res?.data ?? [];
        setMembers(Array.isArray(list) ? list : []);
      })
      .catch(() => mounted && setMembers([]));
    return () => {
      mounted = false;
    };
  }, [groupId]);

  const handleAdd = async () => {
    if (!selectedUserId && !freeTextName.trim()) return;
    try {
      const {data} = await addParticipant({
        group_id: groupId,
        minutes_id: minutesId,
        role,
        user_id: selectedUserId || undefined,
        display_name: selectedUserId ? undefined : freeTextName
      });
      const participantId = (data as {participant_id: string}).participant_id;
      onChange([
        ...participants,
        {
          id: participantId,
          minutes_id: minutesId,
          role,
          user_id: selectedUserId || null,
          display_name: selectedUserId ? null : freeTextName
        }
      ]);
      setSelectedUserId('');
      setFreeTextName('');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handleRemove = async (participantId: string) => {
    if (!window.confirm(t('participants.remove_confirm'))) return;
    try {
      await removeParticipant({group_id: groupId, participant_id: participantId});
      onChange(participants.filter((p) => p.id !== participantId));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handlePrepopulate = async () => {
    if (!calendarEventId) return;
    try {
      const {data} = await prepopulateParticipantsFromEvent({group_id: groupId, minutes_id: minutesId, calendar_event_id: calendarEventId});
      const newIds = (data as {participant_ids: string[]}).participant_ids;
      if (newIds.length > 0) {
        toast.success(t('participants.prepopulate_from_event'));
      }
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">{t('participants.title')}</h2>
        {editable && calendarEventId && (
          <Button variant="ghost" size="sm" onClick={handlePrepopulate}>
            <RefreshCw className="mr-1 h-4 w-4" />
            {t('participants.prepopulate_from_event')}
          </Button>
        )}
      </div>
      <ul className="space-y-1">
        {participants.map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <span>
              {p.user_id ? members.find((m) => m.user_id === p.user_id)?.full_name ?? p.user_id : p.display_name}
              {' — '}
              {translateParticipantRole(t, p.role)}
            </span>
            {editable && (
              <Button variant="ghost" size="sm" onClick={() => handleRemove(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('participants.member')} />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={freeTextName}
            onChange={(e) => setFreeTextName(e.target.value)}
            placeholder={t('participants.free_text_name')}
            className="w-48"
            disabled={!!selectedUserId}
          />
          <Select value={role} onValueChange={(v) => setRole(v as ParticipantRole)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTICIPANT_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {translateParticipantRole(t, r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t('participants.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `components/groups/minutes/WitnessPanel.tsx`**

```tsx
'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {castWitnessVote} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {MinutesParticipant, MinutesStatus} from './types';

export interface WitnessPanelProps {
  groupId: string;
  minutesId: string;
  status: MinutesStatus;
  participants: MinutesParticipant[];
  currentUserId: string | null;
  canApprove: boolean;
  onVoted: () => void;
}

export default function WitnessPanel({groupId, minutesId, status, participants, currentUserId, canApprove, onVoted}: WitnessPanelProps) {
  const t = useTranslations('group_minutes');
  const [busy, setBusy] = useState(false);
  const witnesses = participants.filter((p) => p.role === 'WITNESS');
  if (witnesses.length === 0) return null;

  const approvedCount = witnesses.filter((w) => w.approval_status === 'APPROVED').length;
  const selfWitness = witnesses.find((w) => w.user_id === currentUserId);
  const canVote = status === 'PENDING_APPROVAL' && canApprove && !!selfWitness && selfWitness.approval_status === 'PENDING';

  const vote = async (decision: 'APPROVE' | 'REJECT') => {
    let reason: string | undefined;
    if (decision === 'REJECT') {
      reason = window.prompt(t('witness.reason_prompt')) ?? undefined;
      if (!reason) return;
    }
    setBusy(true);
    try {
      await castWitnessVote({group_id: groupId, minutes_id: minutesId, decision, reason});
      onVoted();
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <h2 className="font-semibold text-[var(--text-primary)]">{t('witness.title')}</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        {t('witness.progress', {approved: approvedCount, total: witnesses.length})}
      </p>
      <ul className="space-y-1 text-sm">
        {witnesses.map((w) => (
          <li key={w.id}>
            {w.user_id ?? w.display_name} — {w.approval_status ?? 'PENDING'}
          </li>
        ))}
      </ul>
      {canVote && (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => vote('APPROVE')}>
            {t('witness.approve')}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => vote('REJECT')}>
            {t('witness.reject')}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `components/groups/minutes/MinutesStateActions.tsx`**

```tsx
'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {finalizeMinutes, reviseMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {MinutesStatus} from './types';

export interface MinutesStateActionsProps {
  groupId: string;
  minutesId: string;
  status: MinutesStatus;
  canFinalize: boolean;
  canRevise: boolean;
  onFinalized: () => void;
}

export default function MinutesStateActions({groupId, minutesId, status, canFinalize, canRevise, onFinalized}: MinutesStateActionsProps) {
  const t = useTranslations('group_minutes');
  const router = useRouter();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  const handleFinalize = async () => {
    if (!window.confirm(t('state.finalize_confirm'))) return;
    setBusy(true);
    try {
      await finalizeMinutes({group_id: groupId, minutes_id: minutesId});
      onFinalized();
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const handleRevise = async () => {
    if (!window.confirm(t('state.revise_confirm'))) return;
    setBusy(true);
    try {
      const {data} = await reviseMinutes({group_id: groupId, minutes_id: minutesId});
      const newMinutesId = (data as {new_minutes_id: string}).new_minutes_id;
      router.push(`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(newMinutesId)}`);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2">
      {status === 'DRAFT' && canFinalize && (
        <Button disabled={busy} onClick={handleFinalize}>
          {t('state.finalize')}
        </Button>
      )}
      {status === 'APPROVED' && canRevise && (
        <Button variant="secondary" disabled={busy} onClick={handleRevise}>
          {t('state.revise')}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `components/groups/minutes/MinutesDetailClient.tsx`**

```tsx
'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Skeleton from '@/components/ui/Skeleton';
import MinutesStatusBadge from './MinutesStatusBadge';
import MinutesHeaderForm, {type MinutesHeaderFormValues} from './MinutesHeaderForm';
import AgendaItemList from './AgendaItemList';
import ParticipantsPanel from './ParticipantsPanel';
import WitnessPanel from './WitnessPanel';
import MinutesStateActions from './MinutesStateActions';
import type {MeetingMinutes} from './types';
import {getMinutes, modifyMinutes} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import {useAuthStore} from '@/lib/store/authStore';

export interface MinutesDetailClientProps {
  groupId: string;
  minutesId: string;
  permissions: {
    modify: boolean;
    finalize: boolean;
    approve: boolean;
  };
}

export default function MinutesDetailClient({groupId, minutesId, permissions}: MinutesDetailClientProps) {
  const t = useTranslations('group_minutes');
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserId = useAuthStore((s: any) => s.user?.id ?? null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {data} = await getMinutes({group_id: groupId, minutes_id: minutesId});
      setMinutes((data as {minutes: MeetingMinutes}).minutes);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setLoading(false);
    }
  }, [groupId, minutesId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !minutes) {
    return <Skeleton className="h-96 w-full" />;
  }

  const editable = minutes.status === 'DRAFT' && permissions.modify;

  const handleHeaderSubmit = async (values: MinutesHeaderFormValues) => {
    try {
      await modifyMinutes({
        group_id: groupId,
        minutes_id: minutesId,
        subject: values.subject,
        meeting_date: values.meeting_date,
        location: values.location || undefined,
        minute_taker_id: values.minute_taker_id || undefined
      });
      setMinutes({...minutes, ...values});
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{minutes.subject}</h1>
          <MinutesStatusBadge status={minutes.status} />
        </div>
        <MinutesStateActions
          groupId={groupId}
          minutesId={minutesId}
          status={minutes.status}
          canFinalize={permissions.finalize}
          canRevise={permissions.modify}
          onFinalized={load}
        />
      </div>

      {minutes.rejection_reason && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          {t('witness.rejection_reason', {reason: minutes.rejection_reason})}
        </p>
      )}

      {editable && (
        <MinutesHeaderForm
          groupId={groupId}
          initial={{
            subject: minutes.subject,
            meeting_date: minutes.meeting_date,
            location: minutes.location ?? '',
            minute_taker_id: minutes.minute_taker_id ?? ''
          }}
          onSubmit={handleHeaderSubmit}
          submitLabel={t('form.save')}
        />
      )}

      <AgendaItemList
        groupId={groupId}
        minutesId={minutesId}
        agendaItems={minutes.agenda_items ?? []}
        editable={editable}
        onChange={(agenda_items) => setMinutes({...minutes, agenda_items})}
      />

      <ParticipantsPanel
        groupId={groupId}
        minutesId={minutesId}
        calendarEventId={minutes.calendar_event_id}
        participants={minutes.participants ?? []}
        editable={editable}
        onChange={(participants) => setMinutes({...minutes, participants})}
      />

      <WitnessPanel
        groupId={groupId}
        minutesId={minutesId}
        status={minutes.status}
        participants={minutes.participants ?? []}
        currentUserId={currentUserId}
        canApprove={permissions.approve}
        onVoted={load}
      />
    </section>
  );
}
```

Before this step, check `lib/store/authStore.ts` for the real shape of the logged-in user's id field (the guess above is `s.user?.id` — confirm the actual field name, e.g. it might be `user_id` or nested differently) and adjust `currentUserId` accordingly.

- [ ] **Step 5: Write `app/[locale]/groups/[groupId]/minutes/[minutesId]/page.tsx`**

```tsx
'use client';

import {use} from 'react';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import MinutesDetailClient from '@/components/groups/minutes/MinutesDetailClient';

export default function MinutesDetailPage({params}: {params: Promise<{groupId: string; minutesId: string; locale: string}>}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);
  const decodedMinutesId = decodeURIComponent(unwrappedParams.minutesId);

  if (isLoading) return null;
  if (!hasPermission('group.minutes.read')) return null;

  return (
    <MinutesDetailClient
      groupId={decodedGroupId}
      minutesId={decodedMinutesId}
      permissions={{
        modify: hasPermission('group.minutes.modify'),
        finalize: hasPermission('group.minutes.finalize'),
        approve: hasPermission('group.minutes.approve')
      }}
    />
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors — resolve any real prop/type mismatches found against `authStore.ts`, `groups.ts`, and the UI primitives as flagged.

- [ ] **Step 7: Manual verification (full DRAFT→APPROVED flow)**

Via the `run` skill, with two test users (one Leader with all `group.minutes.*` permissions, one plain member):
1. Leader creates a minutes record, adds an agenda item with a hyperlink in the discussion field, adds an action item.
2. Leader adds a participant with role `WITNESS` (using their own account or a second test account).
3. Leader clicks Finalize — confirm status flips to `PENDING_APPROVAL` and the witness panel shows `0 of 1 approved`.
4. Log in as the witness account, open the same record, click Approve — confirm status flips to `APPROVED` and the badge/lock UI shows.
5. Confirm the agenda item fields render as read-only rich text (link still clickable) and the header form/add buttons are no longer shown.
6. Click "Create new version" (revise) — confirm redirect to a new `DRAFT` record with cloned agenda items/participants.

- [ ] **Step 8: Commit**

```bash
git add app/[locale]/groups/[groupId]/minutes/[minutesId]/page.tsx components/groups/minutes/MinutesDetailClient.tsx components/groups/minutes/ParticipantsPanel.tsx components/groups/minutes/WitnessPanel.tsx components/groups/minutes/MinutesStateActions.tsx
git commit -m "feat(minutes): add detail page with state machine, participants, and witness voting"
```

---

## Task 10: Attachments and PDF export

**Files:**
- Create: `components/groups/minutes/AttachmentsPanel.tsx`
- Modify: `components/groups/minutes/MinutesDetailClient.tsx`

**Interfaces:**
- Consumes: `linkAttachment`/`unlinkAttachment`/`exportMinutesPdf` (Task 1), `MinutesAttachment` (Task 1), existing Files upload flow (`lib/api/files.ts` — check its `startUpload`/`completeUpload` or equivalent exported names before use) and existing Files download flow (same file, download-token function), `group_minutes.attachments.*` (Task 3).
- Produces: `AttachmentsPanel` component, props `{groupId: string; minutesId: string; attachments: MinutesAttachment[]; canManage: boolean; onChange: (attachments: MinutesAttachment[]) => void}`.

- [ ] **Step 1: Inspect the existing Files upload/download API**

Run: `grep -n "export const" lib/api/files.ts`

Note the exact exported function names/signatures for: starting an upload, completing an upload, and requesting a download token/URL. Use those exact names in Step 2 below instead of placeholders — do not invent function names.

- [ ] **Step 2: Write `components/groups/minutes/AttachmentsPanel.tsx`**

```tsx
'use client';

import {useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Paperclip, Trash2, FileDown} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {linkAttachment, unlinkAttachment, exportMinutesPdf} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {MinutesAttachment} from './types';
// import the real upload-start/upload-complete/download-token functions found in Step 1 here

export interface AttachmentsPanelProps {
  groupId: string;
  minutesId: string;
  attachments: MinutesAttachment[];
  canManage: boolean;
  onChange: (attachments: MinutesAttachment[]) => void;
}

export default function AttachmentsPanel({groupId, minutesId, attachments, canManage, onChange}: AttachmentsPanelProps) {
  const t = useTranslations('group_minutes');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleUpload = async (file: File) => {
    setBusy(true);
    try {
      // 1. call the real upload-start function with {scope: 'group', group_id: groupId, filename: file.name, size: file.size, ...}
      // 2. PUT/POST the file bytes to the returned upload URL
      // 3. call the real upload-complete function to obtain file_id
      // 4. linkAttachment({group_id: groupId, minutes_id: minutesId, file_id, label: file.name})
      // (fill in using the exact function names/signatures noted in Step 1)
      throw new Error('wire up real Files upload functions here');
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (attachmentId: string) => {
    if (!window.confirm(t('attachments.remove_confirm'))) return;
    try {
      await unlinkAttachment({group_id: groupId, attachment_id: attachmentId});
      onChange(attachments.filter((a) => a.id !== attachmentId));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  const handleExportPdf = async () => {
    setBusy(true);
    try {
      const {data} = await exportMinutesPdf({group_id: groupId, minutes_id: minutesId});
      const fileId = (data as {file_id: string}).file_id;
      onChange([...attachments, {id: `pdf-${fileId}`, minutes_id: minutesId, file_id: fileId, label: 'Exportált PDF'}]);
      toast.success(t('attachments.exported'));
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--text-primary)]">{t('attachments.title')}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={handleExportPdf}>
            <FileDown className="mr-1 h-4 w-4" />
            {t('attachments.export_pdf')}
          </Button>
          {canManage && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="mr-1 h-4 w-4" />
              {t('attachments.add')}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = '';
        }}
      />
      <ul className="space-y-1 text-sm">
        {attachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between">
            <span>{a.label ?? a.file_id}</span>
            {canManage && (
              <Button variant="ghost" size="sm" onClick={() => handleRemove(a.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

The `handleUpload` body is intentionally left as a structured TODO with the exact call sequence — Step 1's grep output tells you the real function names to fill in; this is the one place in the plan where the implementer must consult a sibling file before finishing the code, because `lib/api/files.ts`'s exact upload API wasn't read during spec/plan authoring.

- [ ] **Step 3: Wire `AttachmentsPanel` into `MinutesDetailClient.tsx`**

Add the import and render it after the `WitnessPanel` block:

```tsx
<AttachmentsPanel
  groupId={groupId}
  minutesId={minutesId}
  attachments={minutes.attachments ?? []}
  canManage={/* hasPermission('group.minutes.attachment.manage') — thread this through the permissions prop, adding attachmentManage: hasPermission('group.minutes.attachment.manage') to both MinutesDetailClientProps and the page.tsx call site from Task 9 Step 5 */ false}
  onChange={(attachments) => setMinutes({...minutes, attachments})}
/>
```

Update `MinutesDetailClientProps['permissions']` (Task 9 Step 4) to add `attachmentManage: boolean`, and update `app/[locale]/groups/[groupId]/minutes/[minutesId]/page.tsx` (Task 9 Step 5) to pass `attachmentManage: hasPermission('group.minutes.attachment.manage')`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Upload a file as an attachment, confirm it appears in the list; click "Export as PDF", confirm a new attachment labeled as the export appears; remove an attachment, confirm it disappears. Verify these work regardless of the record's status (not gated on DRAFT).

- [ ] **Step 6: Commit**

```bash
git add components/groups/minutes/AttachmentsPanel.tsx components/groups/minutes/MinutesDetailClient.tsx "app/[locale]/groups/[groupId]/minutes/[minutesId]/page.tsx"
git commit -m "feat(minutes): add attachments panel and PDF export"
```

---

## Task 11: AI import wizard

**Files:**
- Create: `app/[locale]/groups/[groupId]/minutes/import/page.tsx`
- Create: `components/groups/minutes/MinutesImportWizard.tsx`

**Interfaces:**
- Consumes: `analyzeMinutesImport`/`confirmMinutesImport` (Task 1), `MinutesImportProposal` (Task 1), the same Files upload functions identified in Task 10 Step 1, `MarkdownEditor` + `buildMinutesEditorI18n` (Task 7), `group_minutes.import.*` (Task 3).
- Produces: the `/minutes/import` route — terminal for this plan.

- [ ] **Step 1: Write `components/groups/minutes/MinutesImportWizard.tsx`**

```tsx
'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import {Input} from '@/components/ui/Input';
import MarkdownEditor from '@/components/posts/MarkdownEditor';
import {buildMinutesEditorI18n} from './minutesEditorI18n';
import {analyzeMinutesImport, confirmMinutesImport} from '@/lib/api/minutes';
import {translateMinutesApiError} from '@/lib/i18n/minutes';
import type {MinutesImportProposal} from './types';
// import the real upload-start/upload-complete functions identified in Task 10 Step 1

export interface MinutesImportWizardProps {
  groupId: string;
}

type WizardStep = 'upload' | 'analyzing' | 'review';

export default function MinutesImportWizard({groupId}: MinutesImportWizardProps) {
  const t = useTranslations('group_minutes');
  const router = useRouter();
  const locale = useLocale();
  const editorI18n = buildMinutesEditorI18n((key) => t(key as any));
  const [step, setStep] = useState<WizardStep>('upload');
  const [sourceFileId, setSourceFileId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<MinutesImportProposal | null>(null);
  const [importDisabled, setImportDisabled] = useState(false);

  const handleFileSelected = async (file: File) => {
    setStep('analyzing');
    try {
      // 1. upload-start / upload the file bytes / upload-complete (same sequence as Task 10 AttachmentsPanel.handleUpload)
      //    to obtain file_id; store it via setSourceFileId(file_id)
      const fileId = ''; // replace with the real uploaded file_id
      setSourceFileId(fileId);
      const {data} = await analyzeMinutesImport({group_id: groupId, file_id: fileId});
      setProposal((data as {proposal: MinutesImportProposal}).proposal);
      setStep('review');
    } catch (error: any) {
      if (error?.response?.status === 503) {
        setImportDisabled(true);
        toast.error(t('import.disabled'));
      } else {
        toast.error(translateMinutesApiError(t, error, 'errors.default'));
      }
      setStep('upload');
    }
  };

  const updateAgendaItem = (index: number, patch: Partial<MinutesImportProposal['agenda_items'][number]>) => {
    if (!proposal) return;
    const agenda_items = proposal.agenda_items.map((item, i) => (i === index ? {...item, ...patch} : item));
    setProposal({...proposal, agenda_items});
  };

  const handleConfirm = async () => {
    if (!proposal) return;
    try {
      const {data} = await confirmMinutesImport({
        group_id: groupId,
        subject: proposal.subject,
        meeting_date: proposal.meeting_date,
        location: proposal.location,
        source_file_id: sourceFileId ?? undefined,
        agenda_items: proposal.agenda_items,
        participants: proposal.participants
      });
      const minutesId = (data as {minutes_id: string}).minutes_id;
      router.push(`/${locale}/groups/${encodeURIComponent(groupId)}/minutes/${encodeURIComponent(minutesId)}`);
    } catch (error) {
      toast.error(translateMinutesApiError(t, error, 'errors.default'));
    }
  };

  if (importDisabled) {
    return <p className="text-sm text-[var(--text-secondary)]">{t('import.disabled')}</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">{t('import.title')}</h1>

      {step === 'upload' && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-secondary)]">{t('import.upload_hint')}</p>
          <input
            type="file"
            accept=".doc,.docx,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
        </div>
      )}

      {step === 'analyzing' && <p className="text-sm text-[var(--text-secondary)]">{t('import.analyzing')}</p>}

      {step === 'review' && proposal && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.subject')}</label>
            <Input value={proposal.subject} onChange={(e) => setProposal({...proposal, subject: e.target.value})} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">{t('form.meeting_date')}</label>
            <Input
              type="datetime-local"
              value={proposal.meeting_date}
              onChange={(e) => setProposal({...proposal, meeting_date: e.target.value})}
            />
          </div>

          <div className="space-y-4">
            <h2 className="font-semibold text-[var(--text-primary)]">{t('agenda.title')}</h2>
            {proposal.agenda_items.map((item, index) => (
              <div key={index} className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3">
                <Input value={item.title} onChange={(e) => updateAgendaItem(index, {title: e.target.value})} />
                <MarkdownEditor
                  value={item.discussion ?? ''}
                  onChange={(value) => updateAgendaItem(index, {discussion: value})}
                  i18n={editorI18n}
                />
                <MarkdownEditor
                  value={item.decision ?? ''}
                  onChange={(value) => updateAgendaItem(index, {decision: value})}
                  i18n={editorI18n}
                />
              </div>
            ))}
          </div>

          {proposal.confidence_notes && (
            <p className="text-xs italic text-[var(--text-secondary)]">
              {t('import.confidence_notes')}: {proposal.confidence_notes}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep('upload')}>
              {t('import.back')}
            </Button>
            <Button onClick={handleConfirm}>{t('import.confirm')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

The participant `display_name` → real `user_id` mapping (mentioned in the spec's §7 note about the review UI needing a group-member picker per free-text name) is intentionally minimal here — the confirm payload sends `participants` as the raw `{display_name, role}` proposal objects, matching the backend's documented `confirm` body shape, which accepts free-text participants directly (no `user_id` binding step required by the API contract). If a future iteration wants a member-picker per participant row, add a `Select` next to each proposal participant row following the exact pattern already used in `ParticipantsPanel.tsx` (Task 9 Step 1) — out of scope for this task since the spec's Nem célok section doesn't require it and the API doesn't need it.

- [ ] **Step 2: Write `app/[locale]/groups/[groupId]/minutes/import/page.tsx`**

```tsx
'use client';

import {use} from 'react';
import {useGroupPermission} from '@/components/providers/GroupPermissionContext';
import MinutesImportWizard from '@/components/groups/minutes/MinutesImportWizard';

export default function MinutesImportPage({params}: {params: Promise<{groupId: string; locale: string}>}) {
  const {isLoading, hasPermission} = useGroupPermission();
  const unwrappedParams = use(params);
  const decodedGroupId = decodeURIComponent(unwrappedParams.groupId);

  if (isLoading) return null;
  if (!hasPermission('group.minutes.create')) return null;

  return <MinutesImportWizard groupId={decodedGroupId} />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no new errors — fill in the real upload-start/upload-complete calls (same functions identified in Task 10 Step 1) where the placeholder `const fileId = '';` line is, before this passes meaningfully.

- [ ] **Step 4: Manual verification**

Upload a real Word/PDF meeting minutes document, confirm the analyze step either produces a review form pre-filled with extracted fields (if `MINUTES_AI_IMPORT_ENABLED` is on in the test backend) or shows the disabled message on a 503. In the review form, edit a discussion field and insert a hyperlink, then confirm — verify the created record at `/minutes/<new-id>` shows the edited content and the source document attached (if `source_file_id` was set).

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/groups/[groupId]/minutes/import/page.tsx" components/groups/minutes/MinutesImportWizard.tsx
git commit -m "feat(minutes): add AI-assisted import wizard"
```

---

## Task 12: Full-flow regression pass

**Files:** none created — verification only.

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `lib/i18n/__tests__/minutes.test.ts`.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit -p .`
Expected: zero errors project-wide.

- [ ] **Step 3: Manual end-to-end walkthrough**

Via the `run` skill, repeat the Task 9 Step 7 flow plus: list page filtering by status/date, deleting a DRAFT record, and the import wizard flow from Task 11 Step 4 — all in one sitting, to catch any cross-task integration gaps (e.g. a permission prop that got renamed in one file but not its caller).

- [ ] **Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(minutes): resolve regressions found in full-flow verification"
```
