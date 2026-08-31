# WORF Files/Drive UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Drive-style Files/Folders UI for the WORF workspace (list/grid browsing, folders, upload, previews, sharing — user/group/public-link, trash, starring, storage quota, audit log) on top of the existing partial `components/files/*` implementation, fully covering the real `files_route`/`folders_route` backend contract.

**Architecture:** Extend the existing thin `lib/api/files.ts` axios client and add a parallel `lib/api/folders.ts`; keep the established "dumb page → smart client component" App Router pattern (`app/[locale]/files/**/page.tsx` stay one-liners that render a `components/files/*` component). Files and folders are rendered through one unified list (`FileTable`/`FileGrid` accept a discriminated-union `entries` array) built by composing `files/list` + `folders/list` responses in `FilesFeed`. Authenticated binary responses (thumbnail/preview) get a dedicated raw-binary Next.js route (mirroring the existing `app/api/files/dl/[token]/route.ts` pattern) because the generic `/api/proxy` route text-decodes bodies as UTF-8 and would corrupt binary image bytes. Capability-driven UI (no backend `my-capabilities` endpoint exists) follows the backend spec's own prescribed pattern: optimistic buttons, hide-after-403 with a session-scoped forbidden-cache.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS + CSS variable tokens, Radix UI primitives, `react-hook-form` + `zod`, `next-intl`, `react-hot-toast`, `lucide-react` icons, Vitest.

**Spec:** The backend contract is the "Fájlkezelés API – teljes specifikáció" message the user pasted into this conversation (files_route/folders_route, sections 1–12) — copied verbatim into the Global Constraints below wherever a task depends on an exact rule. The UI/UX requirements are the "WORF – Fájlkezelő felület (Drive) – teljes UI fejlesztési prompt" message (sections 0–13) from the same conversation. Both travel with this plan; executors should re-read the relevant spec section named in each task if anything is ambiguous — do not improvise a different contract.

**Branch:** `feature/files-drive-ui`, created from `origin/master` (commit `89ca78a`). A prior uncommitted stash (grid/list toggle + search + category-filter WIP: `FileGrid.tsx`, `FilesFeed.tsx` toolbar, `getFileCategory()` in `formatFiles.ts`, i18n `files.toolbar.*` keys) was recovered and committed as `d4db847` — this plan's tasks build on top of that baseline, not from a blank slate.

## Global Constraints

These apply to every task; copied verbatim from the backend spec so no task re-derives them incorrectly.

- **Auth:** most `POST` endpoints take the access token as a `"Bearer"` field in the JSON body (already handled transparently by the existing `/api/proxy/[...path]` route — call sites never set this themselves). Four endpoints are the exception and require the real `Authorization: Bearer <token>` HTTP header instead: `GET /v1/files/trash`, `GET /v1/folders/trash`, `GET /v1/files/{file_id}/thumbnail`, `GET /v1/files/{file_id}/preview`. Two more need **no** auth at all — the token/link itself authenticates: `GET /v1/files/dl/{download_token}`, `GET /v1/files/shared/{token}`.
- **IDs are opaque encrypted strings** (`file_id`, `folder_id`, `link_id`, `user_id`, `group_id`). Never parse, construct, or assume structure — only ever pass through values the backend returned.
- `scope` is `"private" | "group"`. A folder's children must share its `scope`/`group_id` — moving/copying never changes scope. `group_id` is required when `scope === "group"`.
- **Filename/foldername validation:** 1–255 chars, pattern `/^[a-zA-Z0-9._\-\s()]+$/`, must not contain `..`, `/`, or `\`. Accented characters are currently rejected by the backend — the UI must offer an auto-sanitized suggestion rather than silently failing.
- **Upload limits:** `MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024`. Images additionally capped at `MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024` and `MAX_IMAGE_PIXELS = 40_000_000` (server-enforced via Pillow; not client-pre-validated in this plan — see Task 5's scope note).
- `ALLOWED_MIME_TYPES`: `application/pdf, image/jpeg, image/png, image/webp, image/gif, text/plain, text/csv, application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- `MAX_FOLDER_DEPTH = 20`.
- **Error format:** `{ "detail": "<message>" }`. Status codes: 401 (auth), 403 (capability), 404 (not found/deleted), 409 (business-rule conflict — show the backend's raw `detail` text), 413 (storage/size limit), 415 (bad MIME), 422 (validation), 429 (rate limit).
- **No backend `my-capabilities` endpoint.** Every list/metadata response carries `is_owner`; nothing else. UI capability gating is optimistic (owner ⇒ everything; non-owner ⇒ show the action, and on a 403 response hide it for the rest of the session).
- **No server-side search.** `files.toolbar.searchPlaceholder`/category tabs (already built) filter only the currently-loaded page client-side — this is intentional per spec §3.4/§12, not a bug to fix.
- Existing conventions to follow, not reinvent: `'use client'` components call the axios wrappers in `lib/api/*.ts` (never `fetch` directly, except the two binary routes this plan adds under `lib/server/`); errors go through `toast.error(translateFileApiError(t, error, fallbackKey))`; dialogs use `components/ui/Modal.tsx` (centered) or `components/ui/SideSheet.tsx` (bottom-sheet-on-mobile/right-panel-on-desktop); destructive confirmations use `components/ui/ConfirmDialog.tsx`; i18n strings live under the `files` namespace in `messages/hu.json` + `messages/en.json` (both edited together, Hungarian first since it's the primary locale here); currency/size/date formatting goes through `lib/utils/formatFiles.ts`.
- `lib/api/*.ts` files have **no unit tests** anywhere in this codebase (thin axios wrappers) — do not add tests for new wrapper functions there. `lib/utils/*`, `lib/validation/*`, and `lib/permissions/*` **do** have existing Vitest coverage (`__tests__/` siblings) — new logic added there gets tests, following that existing pattern.
- No component-level tests exist for any of the 8 existing `components/files/*.tsx` files — this plan does not introduce any either; verification for component tasks is `npx tsc --noEmit` (from `worf-app/`) plus a manual dev-server check, matching the codebase's actual established practice.

---

## Phase A — API clients, validation, i18n, permission guard

### Task 1: Extend `lib/api/files.ts` with folder-aware fields and rename/move/copy

**Files:**
- Modify: `lib/api/files.ts` (existing content at `lib/api/files.ts:1-179`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `FileListItem` gains `folder_id: string | null` and `is_starred: boolean` (every later task that renders a file list reads these two fields). `renameFile(file_id: string, name: string)`, `moveFile(file_id: string, target_folder_id?: string | null)`, `copyFile(file_id: string, target_folder_id?: string | null)` — all later "kebab menu" tasks (15, 17) call these by these exact names.

- [ ] **Step 1: Add `folder_id` to list/upload/metadata types and `folder_id` param to list/upload**

Edit `lib/api/files.ts`:

```typescript
export interface FileListItem {
  id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  scope: FileScope;
  uploaded_at: string;
  is_owner: boolean;
  folder_id: string | null;
  is_starred: boolean;
}

export interface ListFilesPayload {
  scope?: FileScope;
  group_id?: string | null;
  folder_id?: string | null;
  offset?: number;
  limit?: number;
}
```

Update `UploadStartPayload` to add `folder_id?: string | null;` and `UploadStartResponse` to add `folder_id: string | null;`. Update `FileMetadataResponse` to add:

```typescript
export interface FileMetadataResponse {
  file_id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  scope: FileScope;
  is_owner: boolean;
  folder_id: string | null;
  thumbnail_status: 'pending' | 'ready' | 'failed' | null;
  width: number | null;
  height: number | null;
  is_starred: boolean;
}
```

- [ ] **Step 2: Add rename/move/copy**

Append to `lib/api/files.ts`:

```typescript
export const renameFile = (file_id: string, name: string) =>
  apiClient.post<{file_id: string; original_name: string}>('/v1/files/rename', {file_id, name});

export const moveFile = (file_id: string, target_folder_id?: string | null) =>
  apiClient.post<{file_id: string; folder_id: string | null}>('/v1/files/move', {file_id, target_folder_id});

export interface CopyFileResponse {
  file_id: string;
  original_name: string;
  size_bytes: number;
  folder_id: string | null;
}

export const copyFile = (file_id: string, target_folder_id?: string | null) =>
  apiClient.post<CopyFileResponse>('/v1/files/copy', {file_id, target_folder_id});
```

- [ ] **Step 3: Verify it compiles**

Run (from `worf-app/`): `npx tsc --noEmit`
Expected: no new errors from `lib/api/files.ts` or its existing importers (`components/files/FileTable.tsx`, `FileGrid.tsx`, `FilesFeed.tsx`, `FileDetailSheet.tsx`, `TrashView.tsx` all still compile — they don't destructure the new optional fields yet, which is fine, `FileListItem` only grew).

- [ ] **Step 4: Commit**

```bash
git add lib/api/files.ts
git commit -m "feat(files-api): add folder_id/is_starred fields and rename/move/copy"
```

### Task 2: Add star/starred/shared-with-me/storage-usage endpoints to `lib/api/files.ts`

**Files:**
- Modify: `lib/api/files.ts`

**Interfaces:**
- Consumes: `FolderListEntry` type from `lib/api/folders.ts` (Task 4) — this task is written to import it, so implement Task 4 first, or stub the type inline and replace the import once Task 4 lands. **Do Task 4 before Task 2** despite the numbering (numbering follows the spec's own section order for readability; dependency order is 1 → 4 → 2 → 3).
- Produces: `starFile`, `unstarFile`, `getStarred`, `getSharedWithMe`, `getStorageUsage` — consumed by Tasks 15 (star toggle), 22 (StarredView), 23 (SharedWithMeView), 13 (StorageUsageBar).

- [ ] **Step 1: Add star/unstar**

```typescript
export interface StarResponse {
  status: 'starred' | 'unstarred';
  file_id: string;
  is_starred: boolean;
}

export const starFile = (file_id: string) =>
  apiClient.post<StarResponse>('/v1/files/star', {file_id});

export const unstarFile = (file_id: string) =>
  apiClient.post<StarResponse>('/v1/files/unstar', {file_id});
```

- [ ] **Step 2: Add starred/list and shared-with-me/list**

```typescript
import type {FolderListEntry} from './folders';

export interface StarredListResponse {
  files: FileListItem[];
  folders: FolderListEntry[];
  file_total: number;
  folder_total: number;
  offset: number;
  limit: number;
}

export const getStarred = (offset = 0, limit = 20) =>
  apiClient.post<StarredListResponse>('/v1/files/starred/list', {offset, limit});

export interface SharedWithMeListResponse {
  files: FileListItem[];
  folders: FolderListEntry[];
  file_total: number;
  folder_total: number;
  offset: number;
  limit: number;
}

export const getSharedWithMe = (offset = 0, limit = 20) =>
  apiClient.post<SharedWithMeListResponse>('/v1/files/shared-with-me/list', {offset, limit});
```

- [ ] **Step 3: Add storage usage**

```typescript
export interface StorageUsageResponse {
  scope: FileScope;
  target_id: string | null;
  used_bytes: number;
  limit_bytes: number | null;
}

export const getStorageUsage = (scope: FileScope = 'private', group_id?: string | null) =>
  apiClient.post<StorageUsageResponse>('/v1/files/storage/usage', {scope, group_id});
```

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit` (expect the `FolderListEntry` import to resolve once Task 4 exists — if doing tasks in the written order, do Task 4 first as noted above).

```bash
git add lib/api/files.ts
git commit -m "feat(files-api): add star/unstar, starred list, shared-with-me, storage usage"
```

### Task 3: Add user-share, bulk-share, and public-link endpoints to `lib/api/files.ts`

**Files:**
- Modify: `lib/api/files.ts`

**Interfaces:**
- Produces: `shareWithUser`, `revokeUserShare`, `listUserShares`, `bulkShareWithGroup`, `createShareLink`, `revokeShareLink`, `listShareLinks` — consumed by Tasks 27, 28, 29 (ShareUserTab, SharePublicLinkTab, ShareModal), Task 19 (bulk share from BulkActionBar).

- [ ] **Step 1: Add user-share**

```typescript
export interface ShareFlags {
  can_view?: boolean;
  can_download?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_share?: boolean;
  expiration_date?: string | null;
}

export interface FileUserShareEntry {
  user_id: string;
  user_name: string;
  can_view: boolean;
  can_download: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
  shared_at: string;
  expiration_date: string | null;
}

export const shareWithUser = (file_id: string, target_user_id: string, flags: ShareFlags = {}) =>
  apiClient.post<FileUserShareEntry>('/v1/files/share/user', {file_id, target_user_id, ...flags});

export const revokeUserShare = (file_id: string, target_user_id: string) =>
  apiClient.post<{status: string; file_id: string; target_user_id: string}>(
    '/v1/files/share/user/revoke',
    {file_id, target_user_id}
  );

export const listUserShares = (file_id: string) =>
  apiClient.post<{file_id: string; users: FileUserShareEntry[]}>('/v1/files/share/user/list', {file_id});
```

- [ ] **Step 2: Add bulk group-share**

```typescript
export interface FileShareGroupBulkResponse {
  group_id: string;
  succeeded: string[];
  failed: Array<{file_id: string; reason: string}>;
}

export const bulkShareWithGroup = (
  file_ids: string[],
  group_id: string,
  flags: Omit<ShareFlags, 'expiration_date'> & {expiration_date?: string | null} = {}
) =>
  apiClient.post<FileShareGroupBulkResponse>('/v1/files/share/group/bulk', {file_ids, group_id, ...flags});
```

- [ ] **Step 3: Add public link create/revoke/list**

```typescript
export type ShareLinkPermission = 'view' | 'download';

export interface ShareLinkCreateResponse {
  link_id: string;
  token: string;
  permission: ShareLinkPermission;
  expires_at: string | null;
  has_password: boolean;
}

export const createShareLink = (
  file_id: string,
  permission: ShareLinkPermission = 'download',
  expires_at?: string | null,
  password?: string | null
) =>
  apiClient.post<ShareLinkCreateResponse>('/v1/files/share/link/create', {
    file_id,
    permission,
    expires_at,
    password,
  });

export const revokeShareLink = (link_id: string) =>
  apiClient.post<{status: string; link_id: string}>('/v1/files/share/link/revoke', {link_id});

export interface ShareLinkEntry {
  link_id: string;
  permission: ShareLinkPermission;
  expires_at: string | null;
  has_password: boolean;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

export const listShareLinks = (file_id: string) =>
  apiClient.post<{file_id: string; links: ShareLinkEntry[]}>('/v1/files/share/link/list', {file_id});
```

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit`

```bash
git add lib/api/files.ts
git commit -m "feat(files-api): add user share, bulk group share, public share links"
```

### Task 4: Create `lib/api/folders.ts`

**Files:**
- Create: `lib/api/folders.ts`

**Interfaces:**
- Consumes: `FileListItem` type from `lib/api/files.ts` (Task 1) via `import type`.
- Produces: `FolderListEntry` type (imported by Task 2 back into `files.ts`, and by every folder-rendering task: 15, 17, 21–24, 29, 32). `createFolder`, `renameFolder`, `moveFolder`, `getFolderMetadata`, `listFolder`, `deleteFolder`, `getFolderTrash`, `restoreFolder`, `permanentDeleteFolder`, `getFolderAuditLog`, `shareFolderWithUser`/`revokeFolderUserShare`/`listFolderUserShares`, `shareFolderWithGroup`/`revokeFolderGroupShare`/`listFolderGroupShares`, `starFolder`/`unstarFolder`.

- [ ] **Step 1: Write the full folders API client**

```typescript
import apiClient from './client';
import type {FileListItem, FileScope} from './files';

export interface FolderListEntry {
  id: string;
  name: string;
  scope: FileScope;
  created_at: string;
  is_owner: boolean;
  is_starred: boolean;
}

export interface FolderCreatePayload {
  name: string;
  scope?: FileScope;
  group_id?: string | null;
  parent_folder_id?: string | null;
}

export interface FolderCreateResponse {
  folder_id: string;
  name: string;
  scope: FileScope;
  parent_folder_id: string | null;
  created_at: string;
}

export const createFolder = (data: FolderCreatePayload) =>
  apiClient.post<FolderCreateResponse>('/v1/folders/create', {scope: 'private', ...data});

export const renameFolder = (folder_id: string, name: string) =>
  apiClient.post<{folder_id: string; name: string}>('/v1/folders/rename', {folder_id, name});

export const moveFolder = (folder_id: string, new_parent_folder_id?: string | null) =>
  apiClient.post<{folder_id: string; parent_folder_id: string | null}>('/v1/folders/move', {
    folder_id,
    new_parent_folder_id,
  });

export interface FolderMetadataResponse {
  folder_id: string;
  name: string;
  scope: FileScope;
  is_owner: boolean;
  parent_folder_id: string | null;
  created_at: string;
  is_starred: boolean;
}

export const getFolderMetadata = (folder_id: string) =>
  apiClient.post<FolderMetadataResponse>('/v1/folders/metadata', {folder_id});

export interface FolderListPayload {
  folder_id?: string | null;
  scope?: FileScope;
  group_id?: string | null;
  offset?: number;
  limit?: number;
}

export interface FolderListResponse {
  folder_id: string | null;
  subfolders: FolderListEntry[];
  files: FileListItem[];
  subfolder_total: number;
  file_total: number;
  offset: number;
  limit: number;
}

export const listFolder = (params: FolderListPayload = {}) =>
  apiClient.post<FolderListResponse>('/v1/folders/list', {scope: 'private', offset: 0, limit: 20, ...params});

export const deleteFolder = (folder_id: string) =>
  apiClient.post<{folder_id: string; message: string}>('/v1/folders/delete', {folder_id});

export interface FolderInTrashOut {
  id: string;
  name: string;
  scope: FileScope;
  deleted_at: string | null;
  created_at: string | null;
}

export const getFolderTrash = (offset = 0, limit = 20) =>
  apiClient.get<{items: FolderInTrashOut[]; total: number; offset: number; limit: number}>('/v1/folders/trash', {
    params: {offset, limit},
  });

export const restoreFolder = (folder_id: string) =>
  apiClient.post<{folder_id: string; name: string; deleted_at: null}>('/v1/folders/restore', {folder_id});

export const permanentDeleteFolder = (folder_id: string) =>
  apiClient.post<{status: string; folder_id: string}>('/v1/folders/permanent-delete', {folder_id});

export const getFolderAuditLog = (folder_id: string, offset = 0, limit = 20) =>
  apiClient.post<{
    items: Array<{
      id: string;
      folder_id: string | null;
      user_id: string;
      action: string;
      ip_address: string | null;
      timestamp: string;
      metadata: Array<{key: string; value: string | null}>;
    }>;
    total: number;
    offset: number;
    limit: number;
  }>('/v1/folders/audit/log', {folder_id, offset, limit});

export interface FolderShareFlags {
  can_view?: boolean;
  can_download?: boolean;
  can_upload?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_share?: boolean;
  expiration_date?: string | null;
}

export interface FolderUserShareEntry {
  user_id: string;
  user_name: string;
  can_view: boolean;
  can_download: boolean;
  can_upload: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
  shared_at: string;
  expiration_date: string | null;
}

export const shareFolderWithUser = (folder_id: string, target_user_id: string, flags: FolderShareFlags = {}) =>
  apiClient.post<FolderUserShareEntry>('/v1/folders/share/user', {folder_id, target_user_id, ...flags});

export const revokeFolderUserShare = (folder_id: string, target_user_id: string) =>
  apiClient.post<{status: string; folder_id: string; target_user_id: string}>(
    '/v1/folders/share/user/revoke',
    {folder_id, target_user_id}
  );

export const listFolderUserShares = (folder_id: string) =>
  apiClient.post<{folder_id: string; users: FolderUserShareEntry[]}>('/v1/folders/share/user/list', {folder_id});

export interface FolderGroupShareEntry {
  group_id: string;
  group_name: string;
  shared_with_count: number;
  shared_at: string;
  expiration_date: string | null;
}

export const shareFolderWithGroup = (folder_id: string, group_id: string, flags: FolderShareFlags = {}) =>
  apiClient.post<FolderGroupShareEntry>('/v1/folders/share/group', {folder_id, group_id, ...flags});

export const revokeFolderGroupShare = (folder_id: string, group_id: string) =>
  apiClient.post<{status: string; folder_id: string; group_id: string}>(
    '/v1/folders/share/group/revoke',
    {folder_id, group_id}
  );

export const listFolderGroupShares = (folder_id: string) =>
  apiClient.post<{folder_id: string; groups: FolderGroupShareEntry[]}>('/v1/folders/share/group/list', {folder_id});

export interface FolderStarResponse {
  status: 'starred' | 'unstarred';
  folder_id: string;
  is_starred: boolean;
}

export const starFolder = (folder_id: string) =>
  apiClient.post<FolderStarResponse>('/v1/folders/star', {folder_id});

export const unstarFolder = (folder_id: string) =>
  apiClient.post<FolderStarResponse>('/v1/folders/unstar', {folder_id});
```

- [ ] **Step 2: Verify and commit**

`npx tsc --noEmit` (this will show the `FolderListEntry` import in `files.ts` from Task 2 now resolving, if Task 2 was already written).

```bash
git add lib/api/folders.ts
git commit -m "feat(folders-api): add full folders API client"
```

### Task 5: Extend `lib/validation/files.ts` — image size limit and filename sanitizer

**Files:**
- Modify: `lib/validation/files.ts` (existing content at `lib/validation/files.ts:1-17`)
- Modify: `lib/utils/formatFiles.ts` (add `sanitizeFilename`)
- Test: `lib/utils/__tests__/formatFiles.test.ts` (new)

**Interfaces:**
- Produces: `MAX_IMAGE_UPLOAD_BYTES`, `IMAGE_MIME_TYPES` (from `lib/validation/files.ts`); `sanitizeFilename(name: string): string` (from `lib/utils/formatFiles.ts`) — consumed by Task 20 (multi-file upload queue / rename dialogs).

**Scope note:** the spec's `MAX_IMAGE_PIXELS = 40_000_000` decompression-bomb guard is server-side only (Pillow-based) in this plan — client-side pixel counting requires an async image decode (`createImageBitmap`) that adds real complexity for a case the server already rejects with a clear `422`, which the existing error-map (Task 7) surfaces. Not implementing a client-side pre-check for pixel count; only the byte-size caps are pre-validated client-side. This is a deliberate scope cut, not an oversight.

- [ ] **Step 1: Write the failing test for `sanitizeFilename`**

Create `lib/utils/__tests__/formatFiles.test.ts`:

```typescript
import {describe, expect, it} from 'vitest';
import {sanitizeFilename} from '../formatFiles';

describe('sanitizeFilename', () => {
  it('strips accents to their base ASCII letter', () => {
    expect(sanitizeFilename('árvíztűrő tükörfúrógép.txt')).toBe('arvizturo tukorfurogep.txt');
  });

  it('replaces disallowed characters with underscore', () => {
    expect(sanitizeFilename('report:final?.pdf')).toBe('report_final_.pdf');
  });

  it('strips path traversal segments', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('.._.._etc_passwd');
  });

  it('leaves an already-valid name untouched', () => {
    expect(sanitizeFilename('Invoice (2026).pdf')).toBe('Invoice (2026).pdf');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/utils/__tests__/formatFiles.test.ts`
Expected: FAIL — `sanitizeFilename` is not exported.

- [ ] **Step 3: Implement `sanitizeFilename`**

Append to `lib/utils/formatFiles.ts`:

```typescript
/**
 * Best-effort client-side cleanup for filenames the backend would reject
 * (accented characters, disallowed symbols, path separators). Strips
 * diacritics via Unicode NFD decomposition, then replaces any character
 * outside [a-zA-Z0-9._-()\s] with "_". Does not guarantee the backend will
 * accept the result (length/emptiness are not re-checked here) — callers
 * still run it through `filenameSchema` afterwards.
 */
export function sanitizeFilename(name: string): string {
  const withoutAccents = name.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return withoutAccents.replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/utils/__tests__/formatFiles.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Add the image byte-size constant**

Edit `lib/validation/files.ts`:

```typescript
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export const uploadFileSchema = z.object({
  filename: filenameSchema,
  file: z.instanceof(File)
    .refine((f) => f.size <= MAX_FILE_SIZE_BYTES, {message: 'file_too_large'})
    .refine(
      (f) => !(IMAGE_MIME_TYPES as readonly string[]).includes(f.type) || f.size <= MAX_IMAGE_UPLOAD_BYTES,
      {message: 'image_too_large'}
    )
    .refine((f) => (ALLOWED_MIME_TYPES as readonly string[]).includes(f.type), {message: 'file_type_forbidden'}),
});
```

Add `"image_too_large"` to the `validation` i18n namespace in both `messages/hu.json` and `messages/en.json` next to the existing `"file_too_large"`/`"file_type_forbidden"` keys (grep for `file_too_large` to find the exact spot — it's under a top-level `"validation"` key, sibling to `files`).

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run lib/utils/__tests__/formatFiles.test.ts lib/validation/__tests__/validation.test.ts` — expect all green, no regressions in the existing validation suite.

```bash
git add lib/validation/files.ts lib/utils/formatFiles.ts lib/utils/__tests__/formatFiles.test.ts messages/hu.json messages/en.json
git commit -m "feat(files-validation): add per-image size cap and filename sanitizer"
```

### Task 6: Create `lib/validation/folders.ts`

**Files:**
- Create: `lib/validation/folders.ts`

**Interfaces:**
- Produces: `folderNameSchema` — consumed by Task 18 (`NewFolderDialog`) and Task 31/32 (rename actions).

- [ ] **Step 1: Write it**

Per spec §5.1 ("Mappa-létrehozás szabályai: `name`: ugyanaz a validáció, mint fájlnévnél"), reuse the exact same schema:

```typescript
export {filenameSchema as folderNameSchema} from './schemas';
```

- [ ] **Step 2: Verify and commit**

`npx tsc --noEmit`

```bash
git add lib/validation/folders.ts
git commit -m "feat(folders-validation): add folder name schema (reuses filenameSchema)"
```

### Task 7: Generalize API error mapping and add 409 raw-detail passthrough

**Files:**
- Create: `lib/i18n/apiError.ts`
- Modify: `lib/i18n/files.ts` (existing content at `lib/i18n/files.ts:1-16`) — keep `translateFileApiError` exported with its current signature so the 4 existing call sites (`FilesFeed.tsx`, `UploadDialog.tsx`, `FileDetailSheet.tsx`, `TrashView.tsx`) need no changes.
- Create: `lib/i18n/folders.ts`
- Test: `lib/i18n/__tests__/apiError.test.ts` (new)

**Interfaces:**
- Produces: `translateApiError<NsKeys>(t, error, fallbackKey): string` (generic core), `translateFileApiError` (unchanged signature, re-implemented on top of the core), `translateFolderApiError` (same shape for the `folders` i18n namespace, once it exists — see Task 34 for the namespace itself; this task's `folders.ts` compiles against `useTranslations<'folders'>` optimistically ahead of Task 34 adding the actual keys, which is fine, TypeScript only checks the generic's shape).

- [ ] **Step 1: Write the failing test**

Create `lib/i18n/__tests__/apiError.test.ts`:

```typescript
import {describe, expect, it, vi} from 'vitest';
import {translateApiError} from '../apiError';

function fakeTranslator(known: Record<string, string>) {
  const t = ((key: string) => known[key] ?? `MISSING:${key}`) as any;
  t.has = (key: string) => key in known;
  return t;
}

describe('translateApiError', () => {
  it('maps a known status code to its translation', () => {
    const t = fakeTranslator({'errors.api.404': 'Not found.'});
    const error = {response: {status: 404}};
    expect(translateApiError(t, error, 'errors.default')).toBe('Not found.');
  });

  it('returns the raw backend detail for a 409 conflict', () => {
    const t = fakeTranslator({'errors.default': 'Unknown error.'});
    const error = {response: {status: 409, data: {detail: 'Folder is already shared with this user.'}}};
    expect(translateApiError(t, error, 'errors.default')).toBe('Folder is already shared with this user.');
  });

  it('falls back to the default key when the 409 has no detail', () => {
    const t = fakeTranslator({'errors.default': 'Unknown error.'});
    const error = {response: {status: 409, data: {}}};
    expect(translateApiError(t, error, 'errors.default')).toBe('Unknown error.');
  });

  it('falls back to the default key for an unmapped status', () => {
    const t = fakeTranslator({'errors.default': 'Unknown error.'});
    const error = {response: {status: 418}};
    expect(translateApiError(t, error, 'errors.default')).toBe('Unknown error.');
  });

  it('falls back to the default key when there is no response at all', () => {
    const t = fakeTranslator({'errors.default': 'Unknown error.'});
    expect(translateApiError(t, new Error('network down'), 'errors.default')).toBe('Unknown error.');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/i18n/__tests__/apiError.test.ts`
Expected: FAIL — `../apiError` does not exist.

- [ ] **Step 3: Implement the generic core**

Create `lib/i18n/apiError.ts`:

```typescript
type MinimalTranslator = ((key: string, values?: Record<string, unknown>) => string) & {
  has: (key: string) => boolean;
};

/**
 * Maps an axios error to a translated message. Status 409 is special-cased
 * per the backend spec (§1.5/§9.4): conflict messages are backend-authored
 * business-rule text ("Cannot move a folder into itself...", "...already
 * shared...") that is more useful shown verbatim than replaced by a generic
 * string — this mirrors the project's existing, documented acceptance of
 * untranslated backend error text (see FRONTEND.md §13).
 */
export function translateApiError(t: MinimalTranslator, error: unknown, fallbackKey: string): string {
  const response = (error as {response?: {status?: number; data?: {detail?: string}}} | undefined)?.response;
  const status = response?.status;

  if (status === 409 && response?.data?.detail) {
    return response.data.detail;
  }

  if (status && t.has(`errors.api.${status}`)) {
    return t(`errors.api.${status}`);
  }

  return t(fallbackKey);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/i18n/__tests__/apiError.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Re-implement `translateFileApiError` on top of the core**

Replace `lib/i18n/files.ts` content:

```typescript
import {useTranslations} from 'next-intl';
import {translateApiError} from './apiError';

export type FilesTranslations = ReturnType<typeof useTranslations<'files'>>;

export function translateFileApiError(
  t: FilesTranslations,
  error: unknown,
  fallbackKey: Parameters<FilesTranslations>[0]
) {
  return translateApiError(t as unknown as Parameters<typeof translateApiError>[0], error, fallbackKey as string);
}
```

- [ ] **Step 6: Create the folders equivalent**

Create `lib/i18n/folders.ts`:

```typescript
import {useTranslations} from 'next-intl';
import {translateApiError} from './apiError';

export type FoldersTranslations = ReturnType<typeof useTranslations<'folders'>>;

export function translateFolderApiError(
  t: FoldersTranslations,
  error: unknown,
  fallbackKey: Parameters<FoldersTranslations>[0]
) {
  return translateApiError(t as unknown as Parameters<typeof translateApiError>[0], error, fallbackKey as string);
}
```

- [ ] **Step 7: Verify no regressions and commit**

Run: `npx vitest run lib/i18n/__tests__/apiError.test.ts` and `npx tsc --noEmit`.
Expected: tests pass; the 4 existing `translateFileApiError` call sites still type-check unchanged.

```bash
git add lib/i18n/apiError.ts lib/i18n/files.ts lib/i18n/folders.ts lib/i18n/__tests__/apiError.test.ts
git commit -m "feat(files-i18n): generalize API error mapping, add 409 raw-detail passthrough"
```

### Task 8: Create `lib/permissions/filesGuard.ts`

**Files:**
- Create: `lib/permissions/filesGuard.ts`
- Test: `lib/permissions/__tests__/filesGuard.test.ts` (new)

**Interfaces:**
- Produces: `markForbidden(scope, action, id)`, `isForbidden(scope, action, id)`, `resetForbiddenCache()`, `canGrantShareFlags(myFlags, requestedFlags)` — consumed by Task 15/17 (hide actions after a 403), Task 27 (ShareUserTab checkbox gating), Task 31/32 (detail sheets).

- [ ] **Step 1: Write the failing tests**

Create `lib/permissions/__tests__/filesGuard.test.ts`:

```typescript
import {beforeEach, describe, expect, it} from 'vitest';
import {canGrantShareFlags, isForbidden, markForbidden, resetForbiddenCache} from '../filesGuard';

describe('forbidden-action cache', () => {
  beforeEach(() => resetForbiddenCache());

  it('is not forbidden until marked', () => {
    expect(isForbidden('file', 'delete', 'f1')).toBe(false);
  });

  it('remembers a marked action for that exact scope/action/id', () => {
    markForbidden('file', 'delete', 'f1');
    expect(isForbidden('file', 'delete', 'f1')).toBe(true);
    expect(isForbidden('file', 'rename', 'f1')).toBe(false);
    expect(isForbidden('folder', 'delete', 'f1')).toBe(false);
    expect(isForbidden('file', 'delete', 'f2')).toBe(false);
  });

  it('clears on reset', () => {
    markForbidden('file', 'delete', 'f1');
    resetForbiddenCache();
    expect(isForbidden('file', 'delete', 'f1')).toBe(false);
  });
});

describe('canGrantShareFlags', () => {
  it('allows granting a flag the sharer also has', () => {
    expect(canGrantShareFlags({can_view: true, can_download: true}, {can_download: true})).toBe(true);
  });

  it('rejects granting a flag the sharer does not have (no escalation)', () => {
    expect(canGrantShareFlags({can_view: true, can_download: true}, {can_edit: true})).toBe(false);
  });

  it('owners (all flags true) can grant anything', () => {
    const owner = {can_view: true, can_download: true, can_edit: true, can_delete: true, can_share: true};
    expect(canGrantShareFlags(owner, {can_edit: true, can_delete: true})).toBe(true);
  });

  it('ignores falsy/unset requested flags', () => {
    expect(canGrantShareFlags({can_view: true}, {can_view: true, can_edit: false})).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/permissions/__tests__/filesGuard.test.ts`
Expected: FAIL — `../filesGuard` does not exist.

- [ ] **Step 3: Implement**

Create `lib/permissions/filesGuard.ts`:

```typescript
/**
 * There is no backend "my-capabilities" endpoint for files/folders (see
 * spec §1.4/§9.3): action buttons are shown optimistically and, on a 403
 * response, the specific (scope, action, id) combination is remembered for
 * the rest of the browser session so the UI stops offering — and the user
 * stops re-triggering — an action the backend has already refused.
 */
type EntryScope = 'file' | 'folder';

const forbiddenActions = new Set<string>();

const key = (scope: EntryScope, action: string, id: string) => `${scope}:${action}:${id}`;

export function markForbidden(scope: EntryScope, action: string, id: string): void {
  forbiddenActions.add(key(scope, action, id));
}

export function isForbidden(scope: EntryScope, action: string, id: string): boolean {
  return forbiddenActions.has(key(scope, action, id));
}

export function resetForbiddenCache(): void {
  forbiddenActions.clear();
}

export interface ShareFlagSet {
  can_view?: boolean;
  can_download?: boolean;
  can_upload?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_share?: boolean;
}

/**
 * Client-side mirror of the backend's anti-escalation rule (spec §1.4/§6):
 * a sharer can only grant flags they themselves hold. The backend is the
 * real enforcement point — this only drives which checkboxes the share UI
 * disables so a doomed request isn't attempted in the first place.
 */
export function canGrantShareFlags(myFlags: ShareFlagSet, requestedFlags: ShareFlagSet): boolean {
  return (Object.keys(requestedFlags) as Array<keyof ShareFlagSet>).every((flag) => {
    if (!requestedFlags[flag]) return true;
    return myFlags[flag] === true;
  });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/permissions/__tests__/filesGuard.test.ts`
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add lib/permissions/filesGuard.ts lib/permissions/__tests__/filesGuard.test.ts
git commit -m "feat(files-permissions): add session-scoped forbidden-action cache and share-flag escalation guard"
```

## Phase B — Binary proxy for thumbnails/previews

### Task 9: Extend the generic proxy's header-only-auth allowlist to include `folders/trash`

**Files:**
- Modify: `app/api/proxy/[...path]/route.ts:186-188` (the `isFilesTrash` check) and `:211-218` (where it's used)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new exported — this is a behavioral fix inside `handleProxy` only Task 24 (folder trash) depends on.

- [ ] **Step 1: Generalize the special-case**

The proxy currently special-cases exactly one route (`files/trash` GET) to skip injecting `Bearer` into the JSON body, because that endpoint authenticates via the `Authorization` header only (per spec §1.1's exception table, which also lists `GET /v1/folders/trash`). Edit `app/api/proxy/[...path]/route.ts`:

Replace:
```typescript
  const isFilesTrash = normalizedPath === 'files/trash' && request.method === 'GET';
```
with:
```typescript
  const HEADER_ONLY_AUTH_GET_ROUTES = new Set(['files/trash', 'folders/trash']);
  const isHeaderOnlyAuthRoute = HEADER_ONLY_AUTH_GET_ROUTES.has(normalizedPath) && request.method === 'GET';
```

And replace every remaining use of `isFilesTrash` further down in the same function (there is exactly one, in the `payload` construction: `...(token && !isFilesTrash ? {Bearer: token} : {})`) with `isHeaderOnlyAuthRoute`.

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit`. Manual check (dev server): once Task 4/24 exist, `GET /api/proxy/v1/folders/trash` should reach the backend with only the `Authorization` header set, matching the existing `files/trash` behavior.

```bash
git add app/api/proxy/[...path]/route.ts
git commit -m "fix(proxy): treat folders/trash as a header-only-auth route like files/trash"
```

### Task 10: Add authenticated binary routes for thumbnail/preview

**Files:**
- Create: `lib/server/rawBinaryProxy.ts`
- Create: `app/api/files/[fileId]/thumbnail/route.ts`
- Create: `app/api/files/[fileId]/preview/route.ts`
- Modify: `lib/api/files.ts` (add URL builders)

**Interfaces:**
- Produces: `getThumbnailUrl(file_id): string`, `getPreviewUrl(file_id): string` (from `lib/api/files.ts`) — consumed by Task 12 (`ThumbnailImage`) and Task 26 (`PreviewModal`).

**Why a new route instead of the existing `/api/proxy/[...path]`:** the generic proxy (`app/api/proxy/[...path]/route.ts:64-96`) runs every response body through `Buffer.concat(chunks).toString('utf8')` before deciding whether it's JSON. For the `200 image/webp` case that is lossy UTF-8 decoding of arbitrary binary bytes — it would corrupt every thumbnail/preview image. These two endpoints also need the real `Authorization` header (per spec §1.1), which the generic proxy already sends, but its JSON/text response handling makes it unusable for binary payloads regardless. The existing `app/api/files/dl/[token]/route.ts` has the same latent bug (it also does `.toString('utf8')`), but it never hits it in practice because `dl` only ever returns a redirect or a small JSON error — it stays as-is; do not touch it.

- [ ] **Step 1: Write the shared binary-safe raw-GET helper**

Create `lib/server/rawBinaryProxy.ts`:

```typescript
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';

export interface RawBinaryResponse {
  status: number;
  contentType: string;
  cacheControl: string | undefined;
  body: Buffer;
}

/**
 * Like the raw GET helpers in app/api/files/dl/[token]/route.ts and
 * app/api/proxy/[...path]/route.ts, but keeps the response body as a
 * Buffer instead of decoding it as UTF-8 — required for binary image
 * bytes (image/webp thumbnails/previews), which UTF-8 decoding corrupts.
 * The 202 "pending"/"failed" JSON responses these endpoints also return
 * are still valid UTF-8, so callers can safely `JSON.parse(body.toString())`
 * on non-binary status codes.
 */
export function fetchUpstreamBinary(url: URL, headers: Record<string, string> = {}): Promise<RawBinaryResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = client(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            contentType: (res.headers['content-type'] as string | undefined) ?? 'application/octet-stream',
            cacheControl: res.headers['cache-control'] as string | undefined,
            body: Buffer.concat(chunks),
          });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}
```

- [ ] **Step 2: Write the thumbnail route**

Create `app/api/files/[fileId]/thumbnail/route.ts`:

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {fetchUpstreamBinary} from '@/lib/server/rawBinaryProxy';
import {getServerAccessToken} from '@/lib/utils/cookies';

export async function GET(request: NextRequest, context: {params: Promise<{fileId: string}>}) {
  const apiBase = process.env.WORF_API_URL;
  if (!apiBase) {
    return NextResponse.json({message: 'WORF_API_URL is not configured'}, {status: 500});
  }

  const {fileId} = await context.params;
  const token = await getServerAccessToken();
  if (!token) {
    return NextResponse.json({detail: 'Authentication required.'}, {status: 401});
  }

  const targetUrl = new URL(
    `/v1/files/${encodeURIComponent(fileId)}/thumbnail`,
    apiBase.endsWith('/') ? apiBase : `${apiBase}/`
  );

  const forwardedFor =
    request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? '127.0.0.1';

  const response = await fetchUpstreamBinary(targetUrl, {
    Authorization: `Bearer ${token}`,
    'x-forwarded-for': forwardedFor,
  });

  if (response.status === 202) {
    // {"status": "pending" | "failed"} — small, valid JSON, safe to decode.
    return new NextResponse(response.body.toString('utf8'), {
      status: 202,
      headers: {'Content-Type': 'application/json'},
    });
  }

  if (response.status !== 200) {
    return new NextResponse(response.body.toString('utf8'), {
      status: response.status,
      headers: {'Content-Type': response.contentType},
    });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      'Content-Type': response.contentType,
      'Cache-Control': response.cacheControl ?? 'private, max-age=86400',
    },
  });
}
```

- [ ] **Step 3: Write the preview route**

Create `app/api/files/[fileId]/preview/route.ts` — identical to Step 2's thumbnail route, with `/thumbnail` replaced by `/preview` in the `targetUrl` path (both the URL template literal and nothing else differs). Copy the file verbatim and make that one substitution.

- [ ] **Step 4: Add URL builders to `lib/api/files.ts`**

Append to `lib/api/files.ts` (near `buildDownloadUrl`):

```typescript
export const getThumbnailUrl = (file_id: string) => `/api/files/${encodeURIComponent(file_id)}/thumbnail`;
export const getPreviewUrl = (file_id: string) => `/api/files/${encodeURIComponent(file_id)}/preview`;
```

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`. Manual check once Task 12 exists: opening `/files` with at least one `image/*` file present should show a real thumbnail (not a broken image icon) after fetching `GET /api/files/{id}/thumbnail` with dev-tools Network tab open — confirm the response `Content-Type: image/webp` and that the image renders (proves no UTF-8 corruption).

```bash
git add lib/server/rawBinaryProxy.ts "app/api/files/[fileId]/thumbnail/route.ts" "app/api/files/[fileId]/preview/route.ts" lib/api/files.ts
git commit -m "feat(files-api): add binary-safe authenticated thumbnail/preview routes"
```

## Phase C — Presentational primitives

### Task 11: Create `FileTypeIcon.tsx`

**Files:**
- Create: `components/files/FileTypeIcon.tsx`
- Modify: `components/files/FileGrid.tsx:1-29` (replace the local `CATEGORY_ICON` map with this shared component)

**Interfaces:**
- Produces: `<FileTypeIcon mimeType={string|null} size={number} />` — consumed by Tasks 12 (fallback), 15 (FileTable icon column), 26 (PreviewModal fallback), 31 (FileDetailSheet).

- [ ] **Step 1: Implement**

Create `components/files/FileTypeIcon.tsx`:

```typescript
import { FileSpreadsheet, FileText, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { getFileCategory } from '@/lib/utils/formatFiles';

export interface FileTypeIconProps {
  mimeType: string | null;
  size?: number;
  className?: string;
}

const CATEGORY_ICON = {
  image: ImageIcon,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  other: FileIcon,
} as const;

export default function FileTypeIcon({ mimeType, size = 28, className }: FileTypeIconProps) {
  const Icon = CATEGORY_ICON[getFileCategory(mimeType)];
  return <Icon size={size} strokeWidth={1.5} className={className ?? 'text-[var(--text-tertiary)]'} />;
}
```

- [ ] **Step 2: Use it in `FileGrid.tsx`**

In `components/files/FileGrid.tsx`, remove the `CATEGORY_ICON` constant and its `lucide-react` icon imports, add `import FileTypeIcon from './FileTypeIcon';`, and replace:
```typescript
const Icon = CATEGORY_ICON[getFileCategory(item.mime_type)];
```
and its use `<Icon size={28} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />` with:
```typescript
<FileTypeIcon mimeType={item.mime_type} />
```
(drop the now-unused `getFileCategory` import from `FileGrid.tsx` since `FileTypeIcon` calls it internally — keep it only if Step elsewhere in this same file still needs it; it doesn't after this change).

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit`

```bash
git add components/files/FileTypeIcon.tsx components/files/FileGrid.tsx
git commit -m "refactor(files): extract FileTypeIcon as a shared component"
```

### Task 12: Create `ThumbnailImage.tsx` (authenticated thumbnail/preview fetch + pending poll)

**Files:**
- Create: `lib/utils/blobUrlCache.ts`
- Test: `lib/utils/__tests__/blobUrlCache.test.ts` (new)
- Create: `components/files/ThumbnailImage.tsx`

**Interfaces:**
- Produces: `acquireBlobUrl(key, blob): string`, `releaseBlobUrl(key): void` (from `lib/utils/blobUrlCache.ts`); `<ThumbnailImage fileId size="thumbnail"|"preview" alt />` (from `components/files/ThumbnailImage.tsx`) — consumed by Tasks 15 (grid cards), 26 (PreviewModal).

- [ ] **Step 1: Write the failing test for the ref-counted blob URL cache**

Create `lib/utils/__tests__/blobUrlCache.test.ts`:

```typescript
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {acquireBlobUrl, releaseBlobUrl} from '../blobUrlCache';

describe('blobUrlCache', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let counter = 0;
    createObjectURLSpy = vi.fn(() => `blob:mock-${++counter}`);
    revokeObjectURLSpy = vi.fn();
    // @ts-expect-error jsdom doesn't implement these
    global.URL.createObjectURL = createObjectURLSpy;
    // @ts-expect-error jsdom doesn't implement these
    global.URL.revokeObjectURL = revokeObjectURLSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates one object URL per key on first acquire', () => {
    const blob = new Blob(['a']);
    const url = acquireBlobUrl('file-1', blob);
    expect(url).toBe('blob:mock-1');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    releaseBlobUrl('file-1');
  });

  it('reuses the same object URL for concurrent acquires of the same key', () => {
    const blob = new Blob(['a']);
    const first = acquireBlobUrl('file-2', blob);
    const second = acquireBlobUrl('file-2', blob);
    expect(second).toBe(first);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    releaseBlobUrl('file-2');
    releaseBlobUrl('file-2');
  });

  it('only revokes once the ref count drops to zero', () => {
    const blob = new Blob(['a']);
    acquireBlobUrl('file-3', blob);
    acquireBlobUrl('file-3', blob);
    releaseBlobUrl('file-3');
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    releaseBlobUrl('file-3');
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('is a no-op releasing a key that was never acquired', () => {
    expect(() => releaseBlobUrl('never-acquired')).not.toThrow();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/utils/__tests__/blobUrlCache.test.ts`
Expected: FAIL — `../blobUrlCache` does not exist.

- [ ] **Step 3: Implement**

Create `lib/utils/blobUrlCache.ts`:

```typescript
/**
 * Ref-counted `URL.createObjectURL` cache keyed by an arbitrary string
 * (this project uses the thumbnail/preview endpoint path as the key).
 * Multiple `ThumbnailImage` instances that happen to render the same file
 * at the same time share one object URL and only revoke it once nothing
 * references it anymore, avoiding flicker from premature revocation.
 */
interface Entry {
  url: string;
  refCount: number;
}

const cache = new Map<string, Entry>();

export function acquireBlobUrl(key: string, blob: Blob): string {
  const existing = cache.get(key);
  if (existing) {
    existing.refCount += 1;
    return existing.url;
  }
  const url = URL.createObjectURL(blob);
  cache.set(key, {url, refCount: 1});
  return url;
}

export function releaseBlobUrl(key: string): void {
  const existing = cache.get(key);
  if (!existing) return;
  existing.refCount -= 1;
  if (existing.refCount <= 0) {
    URL.revokeObjectURL(existing.url);
    cache.delete(key);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/utils/__tests__/blobUrlCache.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Implement `ThumbnailImage.tsx`**

Per spec §2.4/§3.2: `GET` the thumbnail/preview URL with credentials, `200` ⇒ show the image, `202 {status:"pending"}` ⇒ poll every 2.5s up to 60s then fall back, `202 {status:"failed"}` (or any fetch error) ⇒ fall back immediately to `FileTypeIcon`.

Create `components/files/ThumbnailImage.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { getPreviewUrl, getThumbnailUrl } from '@/lib/api/files';
import { acquireBlobUrl, releaseBlobUrl } from '@/lib/utils/blobUrlCache';
import FileTypeIcon from './FileTypeIcon';

export interface ThumbnailImageProps {
  fileId: string;
  mimeType: string | null;
  variant?: 'thumbnail' | 'preview';
  alt: string;
  className?: string;
}

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60_000;

type LoadState = 'loading' | 'ready' | 'failed';

export default function ThumbnailImage({ fileId, mimeType, variant = 'thumbnail', alt, className }: ThumbnailImageProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const cacheKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const url = variant === 'preview' ? getPreviewUrl(fileId) : getThumbnailUrl(fileId);
    const startedAt = Date.now();

    setState('loading');
    setObjectUrl(null);

    const poll = async () => {
      try {
        const response = await fetch(url);
        if (cancelled) return;

        if (response.status === 200) {
          const blob = await response.blob();
          if (cancelled) return;
          const objUrl = acquireBlobUrl(url, blob);
          cacheKeyRef.current = url;
          setObjectUrl(objUrl);
          setState('ready');
          return;
        }

        if (response.status === 202) {
          const body = (await response.json()) as {status: 'pending' | 'failed'};
          if (body.status === 'failed' || Date.now() - startedAt > POLL_TIMEOUT_MS) {
            setState('failed');
            return;
          }
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }

        setState('failed');
      } catch {
        if (!cancelled) setState('failed');
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (cacheKeyRef.current) {
        releaseBlobUrl(cacheKeyRef.current);
        cacheKeyRef.current = null;
      }
    };
  }, [fileId, variant]);

  if (state === 'ready' && objectUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- authenticated blob: URL, next/image can't proxy this
    return <img src={objectUrl} alt={alt} className={className ?? 'h-full w-full object-cover'} />;
  }

  if (state === 'loading') {
    return <div className={className ?? 'h-full w-full animate-pulse bg-[var(--bg-elevated)]'} />;
  }

  return (
    <div className={className ?? 'flex h-full w-full items-center justify-center'}>
      <FileTypeIcon mimeType={mimeType} />
    </div>
  );
}
```

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run lib/utils/__tests__/blobUrlCache.test.ts` and `npx tsc --noEmit`.

```bash
git add lib/utils/blobUrlCache.ts lib/utils/__tests__/blobUrlCache.test.ts components/files/ThumbnailImage.tsx
git commit -m "feat(files): add authenticated thumbnail/preview image component with pending-poll and ref-counted blob cache"
```

### Task 13: Create `StorageUsageBar.tsx`

**Files:**
- Create: `components/files/StorageUsageBar.tsx`

**Interfaces:**
- Consumes: `getStorageUsage` from Task 2.
- Produces: `<StorageUsageBar scope mode groupId? />` — consumed by Task 21 (`FilesSubNav`/`FilesShell`).

- [ ] **Step 1: Implement**

Per spec §7: normal 0–80%, warning 80–95%, critical 95%+; `limit_bytes: null` ⇒ "Unlimited", no bar.

Create `components/files/StorageUsageBar.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import * as Progress from '@radix-ui/react-progress';
import { getStorageUsage, type FileScope } from '@/lib/api/files';
import { formatFileSize } from '@/lib/utils/formatFiles';

export interface StorageUsageBarProps {
  scope: FileScope;
  groupId?: string;
}

function barColor(percent: number): string {
  if (percent >= 95) return 'bg-[var(--danger)]';
  if (percent >= 80) return 'bg-[var(--warning)]';
  return 'bg-[var(--accent)]';
}

export default function StorageUsageBar({ scope, groupId }: StorageUsageBarProps) {
  const t = useTranslations('files');
  const [usedBytes, setUsedBytes] = useState<number | null>(null);
  const [limitBytes, setLimitBytes] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getStorageUsage(scope, scope === 'group' ? groupId : undefined)
      .then((response) => {
        if (!mounted) return;
        setUsedBytes(response.data.used_bytes);
        setLimitBytes(response.data.limit_bytes);
      })
      .catch(() => {
        if (mounted) {
          setUsedBytes(null);
          setLimitBytes(null);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [scope, groupId]);

  if (isLoading || usedBytes === null) {
    return <div className="h-8 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />;
  }

  if (limitBytes === null) {
    return (
      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>{formatFileSize(usedBytes)}</span>
        <span>{t('storage.unlimited')}</span>
      </div>
    );
  }

  const percent = limitBytes === 0 ? 100 : Math.min(100, (usedBytes / limitBytes) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>{formatFileSize(usedBytes)} / {formatFileSize(limitBytes)}</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <Progress.Root value={percent} className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
        <Progress.Indicator
          className={`block h-full w-full transition-transform duration-200 ease-out ${barColor(percent)}`}
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </Progress.Root>
    </div>
  );
}
```

- [ ] **Step 2: Add i18n key**

Add `"storage": {"unlimited": "Korlátlan"}` under `files` in `messages/hu.json` and `"storage": {"unlimited": "Unlimited"}` in `messages/en.json` (Task 34 adds the rest of the `storage.*` keys used elsewhere in this plan; this one is needed immediately so this task's manual check doesn't show a missing-key fallback).

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit`

```bash
git add components/files/StorageUsageBar.tsx messages/hu.json messages/en.json
git commit -m "feat(files): add storage usage bar with warning/critical thresholds"
```

### Task 14: Create `FilesBreadcrumb.tsx`

**Files:**
- Create: `components/files/FilesBreadcrumb.tsx`

**Interfaces:**
- Consumes: `getFolderMetadata` from Task 4.
- Produces: `<FilesBreadcrumb folderId basePath mode groupId? />` — consumed by Task 17 (`FilesFeed`).

**Design note:** there is no single endpoint returning a folder's full ancestor chain — `folders/metadata` returns one folder's own `name` + its immediate `parent_folder_id` (spec §5.1). This component walks the chain client-side (bounded by `MAX_FOLDER_DEPTH = 20`, so at most 20 sequential calls) and caches the resolved chain per `folderId` in local state.

- [ ] **Step 1: Implement**

Create `components/files/FilesBreadcrumb.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { getFolderMetadata } from '@/lib/api/folders';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

export interface BreadcrumbSegment {
  id: string;
  name: string;
}

export interface FilesBreadcrumbProps {
  folderId: string | null;
  /** e.g. "/hu/files" or "/hu/groups/xyz/files" — segment links are built as `${basePath}/folder/${id}` */
  basePath: string;
}

const MAX_VISIBLE_SEGMENTS = 4;

export default function FilesBreadcrumb({ folderId, basePath }: FilesBreadcrumbProps) {
  const t = useTranslations('files');
  const locale = useLocale();
  const [segments, setSegments] = useState<BreadcrumbSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!folderId) {
      setSegments([]);
      return;
    }

    const resolveChain = async () => {
      setIsLoading(true);
      const chain: BreadcrumbSegment[] = [];
      let currentId: string | null = folderId;
      let guard = 0;

      while (currentId && guard < 20) {
        guard += 1;
        try {
          const response = await getFolderMetadata(currentId);
          chain.unshift({ id: currentId, name: response.data.name });
          currentId = response.data.parent_folder_id;
        } catch {
          break;
        }
      }

      if (!cancelled) {
        setSegments(chain);
        setIsLoading(false);
      }
    };

    void resolveChain();

    return () => {
      cancelled = true;
    };
  }, [folderId]);

  const rootHref = `/${locale}${basePath}`;

  if (isLoading) {
    return <div className="h-5 w-40 animate-pulse rounded bg-[var(--bg-elevated)]" />;
  }

  const collapsed = segments.length > MAX_VISIBLE_SEGMENTS;
  const visible = collapsed
    ? [segments[0], ...segments.slice(segments.length - (MAX_VISIBLE_SEGMENTS - 1))]
    : segments;
  const hidden = collapsed ? segments.slice(1, segments.length - (MAX_VISIBLE_SEGMENTS - 1)) : [];

  return (
    <nav aria-label={t('breadcrumb.label')} className="flex items-center gap-1.5 overflow-x-auto text-sm text-[var(--text-secondary)]">
      <Link href={rootHref} className="shrink-0 hover:text-[var(--text-primary)] hover:underline">
        {t('page.title')}
      </Link>
      {visible.map((segment, index) => (
        <span key={segment.id} className="flex shrink-0 items-center gap-1.5">
          <ChevronRight size={14} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
          {collapsed && index === 1 && hidden.length > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded p-0.5 hover:bg-[var(--bg-hover)]" aria-label={t('breadcrumb.collapsedLabel')}>
                  <MoreHorizontal size={14} strokeWidth={1.75} />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {hidden.map((h) => (
                    <DropdownMenuItem key={h.id} asChild>
                      <Link href={`/${locale}${basePath}/folder/${encodeURIComponent(h.id)}`}>{h.name}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ChevronRight size={14} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
            </>
          )}
          {index === visible.length - 1 ? (
            <span className="font-medium text-[var(--text-primary)]">{segment.name}</span>
          ) : (
            <Link href={`/${locale}${basePath}/folder/${encodeURIComponent(segment.id)}`} className="hover:text-[var(--text-primary)] hover:underline">
              {segment.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Verify and commit**

`npx tsc --noEmit`

```bash
git add components/files/FilesBreadcrumb.tsx
git commit -m "feat(files): add breadcrumb with client-side ancestor-chain resolution and overflow collapse"
```

## Phase D — Unified file+folder list, selection, folder navigation, multi-upload

### Task 15: Unify files+folders into one list — `entryTypes.ts`, `FileTable.tsx`, `FileGrid.tsx`

**Files:**
- Create: `components/files/entryTypes.ts`
- Modify: `components/ui/DataTable.tsx:6-17` (widen `Column<T>.key` from `keyof T` to `string` so heterogeneous union rows can use `render`-only columns)
- Modify: `components/files/FileTable.tsx` (full rewrite of the component body; keep the file)
- Modify: `components/files/FileGrid.tsx` (full rewrite of the component body; keep the file)

**Interfaces:**
- Produces: `FsEntry` (`FileEntry | FolderEntry` discriminated union on `.kind`), `getEntryName`, `getEntryDateLabel` (from `entryTypes.ts`); `EntryListProps` shape implemented by both `FileTable` and `FileGrid` (`entries`, `selectedIds`, `onToggleSelect`, `onOpenFile`, `onOpenFolder`, `onToggleStar`, `renderActions`) — consumed by Task 17 (`FilesFeed`), which owns the entries state and passes these props down.

- [ ] **Step 1: Define the shared entry type**

Create `components/files/entryTypes.ts`:

```typescript
import type { FileListItem } from '@/lib/api/files';
import type { FolderListEntry } from '@/lib/api/folders';

export type FileEntry = { kind: 'file' } & FileListItem;
export type FolderEntry = { kind: 'folder' } & FolderListEntry;
export type FsEntry = FileEntry | FolderEntry;

export const toFileEntries = (items: FileListItem[]): FileEntry[] => items.map((item) => ({ kind: 'file', ...item }));
export const toFolderEntries = (items: FolderListEntry[]): FolderEntry[] =>
  items.map((item) => ({ kind: 'folder', ...item }));

export function getEntryName(entry: FsEntry): string {
  return entry.kind === 'file' ? entry.original_name : entry.name;
}

/** ISO date string to display: uploaded_at for files, created_at for folders. */
export function getEntryDateIso(entry: FsEntry): string | null {
  return entry.kind === 'file' ? entry.uploaded_at : entry.created_at;
}

export interface EntryListProps {
  entries: FsEntry[];
  selectedIds: Set<string>;
  onToggleSelect: (entry: FsEntry) => void;
  onOpenFile: (fileId: string) => void;
  onOpenFolder: (folderId: string) => void;
  onToggleStar: (entry: FsEntry) => void;
  renderActions: (entry: FsEntry) => React.ReactNode;
}
```

- [ ] **Step 2: Widen `DataTable`'s `Column<T>` to accept heterogeneous rows**

In `components/ui/DataTable.tsx`, change:
```typescript
export interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => ReactNode;
}
```
to:
```typescript
export interface Column<T> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => ReactNode;
}
```
and change the row-rendering fallback:
```typescript
{column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '-')}
```
to:
```typescript
{column.render ? column.render((row as Record<string, unknown>)[column.key], row) : String((row as Record<string, unknown>)[column.key] ?? '-')}
```
This is a backward-compatible widening (every existing caller passes a `keyof T` value, which is a valid `string`); no other `DataTable` call site needs changes. Confirm by grepping: `grep -rn "components/ui/DataTable" --include=*.tsx .` from `worf-app/` — only `FileTable.tsx` and `TrashView.tsx` (Task 24 will touch `TrashView.tsx` later) import it today.

- [ ] **Step 3: Rewrite `FileTable.tsx`**

Replace `components/files/FileTable.tsx` content:

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Folder, Star } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import FileTypeIcon from './FileTypeIcon';
import { type EntryListProps, type FsEntry, getEntryDateIso, getEntryName } from './entryTypes';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

export default function FileTable({
  entries,
  selectedIds,
  onToggleSelect,
  onOpenFile,
  onOpenFolder,
  onToggleStar,
  renderActions,
}: EntryListProps) {
  const t = useTranslations('files');

  const columns: Column<FsEntry>[] = [
    {
      key: 'select',
      label: '',
      render: (_value, row) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={() => onToggleSelect(row)}
          onClick={(event) => event.stopPropagation()}
          aria-label={t('table.selectRow')}
          className="h-4 w-4 accent-[var(--accent)]"
        />
      ),
    },
    {
      key: 'name',
      label: t('table.name'),
      render: (_value, row) => (
        <button
          type="button"
          onClick={() => (row.kind === 'folder' ? onOpenFolder(row.id) : onOpenFile(row.id))}
          className="flex items-center gap-2 text-left font-medium text-[var(--text-primary)] hover:underline"
        >
          {row.kind === 'folder' ? (
            <Folder size={18} strokeWidth={1.5} className="shrink-0 text-[var(--text-tertiary)]" />
          ) : (
            <FileTypeIcon mimeType={row.mime_type} size={18} className="shrink-0 text-[var(--text-tertiary)]" />
          )}
          <span className="truncate" title={getEntryName(row)}>{getEntryName(row)}</span>
        </button>
      ),
    },
    {
      key: 'type',
      label: t('table.type'),
      render: (_value, row) => (row.kind === 'folder' ? t('table.folderType') : formatMimeType(row.mime_type)),
    },
    {
      key: 'size',
      label: t('table.size'),
      render: (_value, row) => (row.kind === 'folder' ? '-' : formatFileSize(row.size_bytes)),
    },
    {
      key: 'date',
      label: t('table.uploadedAt'),
      render: (_value, row) => {
        const iso = getEntryDateIso(row);
        return iso ? formatUploadedAt(iso) : '-';
      },
    },
    {
      key: 'star',
      label: '',
      render: (_value, row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleStar(row);
          }}
          aria-label={row.is_starred ? t('table.unstar') : t('table.star')}
          className="rounded p-1 hover:bg-[var(--bg-hover)]"
        >
          <Star
            size={16}
            strokeWidth={1.75}
            className={row.is_starred ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      label: t('table.actions'),
      render: (_value, row) => renderActions(row),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={entries}
      emptyState={<span className="text-sm text-[var(--text-tertiary)]">{t('table.emptyText')}</span>}
    />
  );
}
```

Note this drops the previous `DataTable`-generated trailing "kebab" column (the generic `MoreHorizontal` placeholder column `DataTable` itself renders) in favor of this explicit `actions` column carrying the real `renderActions(row)` menu — the generic placeholder column still renders too (it's baked into `DataTable` itself, unrelated to `columns`); leaving it as-is matches every other `DataTable` usage in the codebase (`TrashView.tsx` has the same double-affordance today) and is out of scope to change here.

- [ ] **Step 4: Rewrite `FileGrid.tsx`**

Replace `components/files/FileGrid.tsx` content:

```typescript
'use client';

import { Folder, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ThumbnailImage from './ThumbnailImage';
import { type EntryListProps, getEntryDateIso, getEntryName } from './entryTypes';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

export default function FileGrid({
  entries,
  selectedIds,
  onToggleSelect,
  onOpenFile,
  onOpenFolder,
  onToggleStar,
  renderActions,
}: EntryListProps) {
  const t = useTranslations('files');

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-10">
        <span className="text-sm text-[var(--text-tertiary)]">{t('table.emptyText')}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {entries.map((entry) => {
        const isSelected = selectedIds.has(entry.id);
        const dateIso = getEntryDateIso(entry);

        return (
          <div
            key={entry.id}
            role="button"
            tabIndex={0}
            onClick={() => (entry.kind === 'folder' ? onOpenFolder(entry.id) : onOpenFile(entry.id))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') entry.kind === 'folder' ? onOpenFolder(entry.id) : onOpenFile(entry.id);
            }}
            className="group relative flex cursor-pointer flex-col items-start gap-2 rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition-colors hover:bg-[var(--bg-hover)]"
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(entry)}
              onClick={(event) => event.stopPropagation()}
              aria-label={t('table.selectRow')}
              className={`absolute left-2 top-2 z-10 h-4 w-4 accent-[var(--accent)] ${
                isSelected ? '' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleStar(entry);
              }}
              aria-label={entry.is_starred ? t('table.unstar') : t('table.star')}
              className="absolute right-2 top-2 z-10 rounded p-1 hover:bg-[var(--bg-active)]"
            >
              <Star
                size={14}
                strokeWidth={1.75}
                className={entry.is_starred ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100'}
              />
            </button>

            <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]">
              {entry.kind === 'folder' ? (
                <Folder size={28} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
              ) : (
                <ThumbnailImage fileId={entry.id} mimeType={entry.mime_type} alt={entry.original_name} />
              )}
            </div>

            <span className="w-full truncate text-sm font-medium text-[var(--text-primary)]" title={getEntryName(entry)}>
              {getEntryName(entry)}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {entry.kind === 'folder' ? t('table.folderType') : `${formatMimeType(entry.mime_type)} · ${formatFileSize(entry.size_bytes)}`}
            </span>
            {dateIso && <span className="text-xs text-[var(--text-tertiary)]">{formatUploadedAt(dateIso)}</span>}

            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
              {renderActions(entry)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Add new i18n keys**

Add under `files.table` in both `messages/hu.json` and `messages/en.json`: `"folderType": "Mappa"` / `"Folder"`, `"star": "Csillagozás"` / `"Star"`, `"unstar": "Csillag eltávolítása"` / `"Unstar"`, `"selectRow": "Kijelölés"` / `"Select"`.

- [ ] **Step 6: Verify and commit**

`npx tsc --noEmit` — expect errors only in `FilesFeed.tsx` (it still calls the old `FileTable`/`FileGrid` props shape) and `TrashView.tsx` if it imports `Column` with a `keyof` type — confirm `TrashView.tsx`'s existing `Column<FileInTrashOut>[]` array still compiles (it should: its `key` values are already valid `keyof FileInTrashOut` strings, which satisfy the widened `key: string`). `FilesFeed.tsx` is fixed in Task 17 — expected to be red until then.

```bash
git add components/files/entryTypes.ts components/ui/DataTable.tsx components/files/FileTable.tsx components/files/FileGrid.tsx messages/hu.json messages/en.json
git commit -m "feat(files): unify files+folders into one FsEntry list for FileTable/FileGrid, add star toggle and selection"
```

### Task 16: Create `EntryActionsMenu.tsx` (responsive kebab menu / mobile action sheet)

**Files:**
- Create: `hooks/useMediaQuery.ts`
- Test: `hooks/__tests__/useMediaQuery.test.ts` (new)
- Create: `components/files/EntryActionsMenu.tsx`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean`; `<EntryActionsMenu items={ActionMenuItem[]} triggerLabel />` where `ActionMenuItem = {key, label, icon, onSelect, variant?: 'danger', disabled?: boolean, hidden?: boolean}` — consumed by Task 17 (`FilesFeed`'s `renderActions`), Task 31/32 (detail sheets).

- [ ] **Step 1: Write the failing test for `useMediaQuery`**

Create `hooks/__tests__/useMediaQuery.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from '../useMediaQuery';

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(event: {matches: boolean}) => void> = [];
  const mql = {
    matches,
    media: '',
    addEventListener: (_type: string, listener: (event: {matches: boolean}) => void) => listeners.push(listener),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    trigger: (next: boolean) => {
      mql.matches = next;
      listeners.forEach((listener) => listener({ matches: next }));
    },
  };
}

describe('useMediaQuery', () => {
  it('returns the initial match state', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the media query state changes', () => {
    const { trigger } = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    act(() => trigger(true));
    expect(result.current).toBe(true);
  });
});
```

Check `package.json` for `@testing-library/react` — if absent, add it: `npm install -D @testing-library/react` (needed for `renderHook`; this is the only hook test in the plan, and the codebase has no prior hook tests to confirm the convention, so this introduces it deliberately for this one case).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run hooks/__tests__/useMediaQuery.test.ts`
Expected: FAIL — `../useMediaQuery` does not exist.

- [ ] **Step 3: Implement**

Create `hooks/useMediaQuery.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run hooks/__tests__/useMediaQuery.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Implement `EntryActionsMenu.tsx`**

Per UI spec §1.1: desktop gets a dropdown, mobile (<768px, matching the project's existing `lg:`/`md:` breakpoints seen in `SideSheet.tsx`) gets a bottom action sheet — reuse `components/ui/SideSheet.tsx` for the sheet since it already implements the swipe-to-dismiss bottom-sheet pattern.

Create `components/files/EntryActionsMenu.tsx`:

```typescript
'use client';

import { useState, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import SideSheet from '@/components/ui/SideSheet';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  variant?: 'danger';
  disabled?: boolean;
  hidden?: boolean;
}

export interface EntryActionsMenuProps {
  items: ActionMenuItem[];
  triggerLabel: string;
  sheetTitle: string;
}

export default function EntryActionsMenu({ items, triggerLabel, sheetTitle }: EntryActionsMenuProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const visibleItems = items.filter((item) => !item.hidden);

  if (visibleItems.length === 0) return null;

  if (isDesktop) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={triggerLabel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
        >
          <MoreVertical size={16} strokeWidth={1.75} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {visibleItems.map((item) => (
            <DropdownMenuItem
              key={item.key}
              disabled={item.disabled}
              variant={item.variant === 'danger' ? 'danger' : 'default'}
              onSelect={item.onSelect}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={triggerLabel}
        onClick={() => setSheetOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
      >
        <MoreVertical size={18} strokeWidth={1.75} />
      </button>
      <SideSheet open={sheetOpen} title={sheetTitle} onClose={() => setSheetOpen(false)}>
        <div className="flex flex-col gap-1">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setSheetOpen(false);
                item.onSelect();
              }}
              className={`flex h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-left text-sm disabled:opacity-50 ${
                item.variant === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]'
              } hover:bg-[var(--bg-hover)]`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </SideSheet>
    </>
  );
}
```

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run hooks/__tests__/useMediaQuery.test.ts` and `npx tsc --noEmit`.

```bash
git add hooks/useMediaQuery.ts hooks/__tests__/useMediaQuery.test.ts components/files/EntryActionsMenu.tsx package.json package-lock.json
git commit -m "feat(files): add responsive kebab menu / mobile action sheet component"
```

### Task 17: Create `NameDialog.tsx` (generic name-prompt modal for New Folder / Rename)

**Files:**
- Create: `components/files/NameDialog.tsx`

**Interfaces:**
- Consumes: `filenameSchema`/`folderNameSchema` (Task 6), `sanitizeFilename` (Task 5).
- Produces: `<NameDialog open title label initialValue submitLabel onSubmit={(name)=>Promise<void>} onClose />` — consumed by Task 18 (new folder + rename actions), Task 32 (`FolderDetailSheet` rename).

- [ ] **Step 1: Implement**

Per spec §12 (accented-name UX): if the user's input fails validation because of disallowed characters, offer the sanitized suggestion inline rather than a bare error.

Create `components/files/NameDialog.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FieldError from '@/components/ui/FieldError';
import { filenameSchema } from '@/lib/validation/schemas';
import { sanitizeFilename } from '@/lib/utils/formatFiles';

const nameFormSchema = z.object({ name: filenameSchema });
type NameFormValues = z.infer<typeof nameFormSchema>;

export interface NameDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

export default function NameDialog({ open, title, label, initialValue, submitLabel, onSubmit, onClose }: NameDialogProps) {
  const t = useTranslations('files');
  const tv = useTranslations('validation');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<NameFormValues>({ resolver: zodResolver(nameFormSchema), defaultValues: { name: initialValue ?? '' } });

  useEffect(() => {
    if (open) {
      reset({ name: initialValue ?? '' });
      setSuggestion(null);
    }
  }, [open, initialValue, reset]);

  const onValid = handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values.name);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  });

  const nameValue = useForm ? undefined : undefined; // no-op, keeps eslint quiet about unused import ordering

  return (
    <Modal open={open} title={title} onClose={() => (isSubmitting ? undefined : onClose())}>
      <form onSubmit={onValid} className="space-y-4">
        <div>
          <label htmlFor="name-dialog-input" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </label>
          <input
            id="name-dialog-input"
            {...register('name', {
              onChange: (event) => {
                const value = event.target.value as string;
                const cleaned = sanitizeFilename(value);
                setSuggestion(cleaned !== value ? cleaned : null);
              },
            })}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:border-border-focus disabled:opacity-50"
          />
          <FieldError messages={errors.name?.message ? tv(errors.name.message as never) : undefined} />
          {suggestion && (
            <button
              type="button"
              onClick={() => {
                setValue('name', suggestion, { shouldValidate: true });
                setSuggestion(null);
              }}
              className="mt-1.5 text-left text-xs text-[var(--accent)] hover:underline"
            >
              {t('nameDialog.sanitizeSuggestion', { suggestion })}
            </button>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('upload.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

Remove the dead `const nameValue = ...` no-op line before committing — it was left in this plan only as a placeholder reminder and must not ship; the form works without it (`useForm` is already used above).

- [ ] **Step 2: Add i18n key**

Add to `messages/hu.json` under `files`: `"nameDialog": {"sanitizeSuggestion": "Ezt javasoljuk helyette: \"{suggestion}\""}`; to `messages/en.json`: `"nameDialog": {"sanitizeSuggestion": "Suggested instead: \"{suggestion}\""}`.

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit`

```bash
git add components/files/NameDialog.tsx messages/hu.json messages/en.json
git commit -m "feat(files): add generic name-prompt dialog for new-folder/rename with sanitize-suggestion"
```

### Task 18: Rewrite `FilesFeed.tsx` — folder navigation, breadcrumb, unified pagination

**Files:**
- Create: `hooks/usePagedDualList.ts`
- Test: `hooks/__tests__/usePagedDualList.test.ts` (new)
- Modify: `components/files/FilesFeed.tsx` (full rewrite of the component body; keep the file and its existing `FilesFeedProps` export shape — `{mode, groupId}` — adding `folderId?: string | null`)

**Interfaces:**
- Consumes: `listFolder` (Task 4), `EntryListProps`/`toFileEntries`/`toFolderEntries` (Task 15), `EntryActionsMenu`/`ActionMenuItem` (Task 16), `NameDialog` (Task 17), `starFile`/`unstarFile`/`starFolder`/`unstarFolder` (Tasks 2/4), `markForbidden`/`isForbidden` (Task 8), `FilesBreadcrumb` (Task 14).
- Produces: the local `buildActionItems(entry: FsEntry): ActionMenuItem[]` helper inside `FilesFeed.tsx` — **Tasks 19 (bulk actions reuse the same per-item action definitions), and the later Move/Copy/Share tasks (whichever are implemented after this one) extend this exact function** by inserting new array entries at the marked spot. Do not create a second, parallel action-building function.

- [ ] **Step 1: Write the failing test for `usePagedDualList`**

Create `hooks/__tests__/usePagedDualList.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePagedDualList } from '../usePagedDualList';

describe('usePagedDualList', () => {
  it('loads the first page on mount', async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      listA: ['a1'], listB: ['b1', 'b2'], totalA: 1, totalB: 5, offset: 0, limit: 2,
    });
    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.listA).toEqual(['a1']);
    expect(result.current.listB).toEqual(['b1', 'b2']);
    expect(fetchPage).toHaveBeenCalledWith(0, 2);
  });

  it('appends (does not replace) on loadMore', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ listA: ['a1'], listB: ['b1', 'b2'], totalA: 1, totalB: 5, offset: 0, limit: 2 })
      .mockResolvedValueOnce({ listA: [], listB: ['b3', 'b4'], totalA: 1, totalB: 5, offset: 2, limit: 2 });
    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.loadMore();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.listB).toEqual(['b1', 'b2', 'b3', 'b4']));
    expect(result.current.listA).toEqual(['a1']);
    expect(fetchPage).toHaveBeenLastCalledWith(2, 2);
  });

  it('reports hasMore correctly once both lists are exhausted', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ listA: ['a1'], listB: ['b1'], totalA: 1, totalB: 1, offset: 0, limit: 2 });
    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(false);
  });

  it('replaces (does not append) when reset() is called', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ listA: ['a1'], listB: ['b1'], totalA: 1, totalB: 1, offset: 0, limit: 2 });
    const { result } = renderHook(() => usePagedDualList(fetchPage, 2, []));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    result.current.reset();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(result.current.listA).toEqual(['a1']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run hooks/__tests__/usePagedDualList.test.ts`
Expected: FAIL — `../usePagedDualList` does not exist.

- [ ] **Step 3: Implement**

Create `hooks/usePagedDualList.ts`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';

export interface DualListPage<A, B> {
  listA: A[];
  listB: B[];
  totalA: number;
  totalB: number;
}

export interface UsePagedDualListResult<A, B> {
  listA: A[];
  listB: B[];
  totalA: number;
  totalB: number;
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
}

/**
 * Shared pagination for the four backend endpoints that return two lists
 * (subfolders+files, or folders+files) sharing one offset/limit pair
 * (spec: folders/list §5.1, starred/list §9, shared-with-me/list §10, and
 * the combined trash view in Task 25). `loadMore` appends; `reset` (used
 * after navigating to a different folder, or after a mutation) reloads
 * page 0 and replaces.
 */
export function usePagedDualList<A, B>(
  fetchPage: (offset: number, limit: number) => Promise<DualListPage<A, B>>,
  limit: number,
  deps: unknown[]
): UsePagedDualListResult<A, B> {
  const [listA, setListA] = useState<A[]>([]);
  const [listB, setListB] = useState<B[]>([]);
  const [totalA, setTotalA] = useState(0);
  const [totalB, setTotalB] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(
    async (nextOffset: number) => {
      setIsLoading(true);
      try {
        const page = await fetchPage(nextOffset, limit);
        setListA((current) => (nextOffset === 0 ? page.listA : [...current, ...page.listA]));
        setListB((current) => (nextOffset === 0 ? page.listB : [...current, ...page.listB]));
        setTotalA(page.totalA);
        setTotalB(page.totalB);
        setOffset(nextOffset);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchPage, limit]
  );

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return {
    listA,
    listB,
    totalA,
    totalB,
    isLoading,
    hasMore: offset + limit < totalA || offset + limit < totalB,
    loadMore: () => void load(offset + limit),
    reset: () => setReloadKey((key) => key + 1),
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run hooks/__tests__/usePagedDualList.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Rewrite `FilesFeed.tsx`**

Replace `components/files/FilesFeed.tsx` content (keeps the recovered search input / category tabs / grid-list toggle toolbar from the baseline commit `d4db847`; adds folders, breadcrumb, star, kebab actions, load-more):

```typescript
'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Download, FolderPlus, Pencil, Star, Trash2 } from 'lucide-react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { listFiles, requestDownload, buildDownloadUrl, deleteFile, renameFile, starFile, unstarFile, type FileListItem } from '@/lib/api/files';
import { listFolder, createFolder, deleteFolder, renameFolder, starFolder, unstarFolder } from '@/lib/api/folders';
import { translateFileApiError } from '@/lib/i18n/files';
import { translateFolderApiError } from '@/lib/i18n/folders';
import { getFileCategory, type FileCategory } from '@/lib/utils/formatFiles';
import { markForbidden, isForbidden } from '@/lib/permissions/filesGuard';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import FileTable from '@/components/files/FileTable';
import FileGrid from '@/components/files/FileGrid';
import UploadDialog from '@/components/files/UploadDialog';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import FolderDetailSheet from '@/components/files/FolderDetailSheet';
import FilesBreadcrumb from '@/components/files/FilesBreadcrumb';
import NameDialog from '@/components/files/NameDialog';
import EntryActionsMenu, { type ActionMenuItem } from '@/components/files/EntryActionsMenu';
import { toFileEntries, toFolderEntries, type FsEntry } from '@/components/files/entryTypes';

type CategoryFilter = FileCategory | 'all';
type ViewMode = 'list' | 'grid';

export interface FilesFeedProps {
  mode: 'private' | 'group';
  groupId?: string;
  folderId?: string | null;
  /** Base route for breadcrumb/folder links, e.g. "/files" or "/groups/xyz/files". */
  basePath: string;
}

const PAGE_SIZE = 20;

export default function FilesFeed({ mode, groupId, folderId = null, basePath }: FilesFeedProps) {
  const t = useTranslations('files');
  const tf = useTranslations('folders');
  const locale = useLocale();
  const router = useRouterCompat();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [view, setView] = useState<ViewMode>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FsEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FsEntry | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFolderDetailId, setSelectedFolderDetailId] = useState<string | null>(null);

  const {
    listA: subfolders,
    listB: files,
    totalA: subfolderTotal,
    totalB: fileTotal,
    isLoading,
    hasMore,
    loadMore,
    reset: refetch,
  } = usePagedDualList(
    async (offset, limit) => {
      try {
        const response = await listFolder({ folder_id: folderId, scope: mode, group_id: mode === 'group' ? groupId : undefined, offset, limit });
        return {
          listA: response.data.subfolders,
          listB: response.data.files,
          totalA: response.data.subfolder_total,
          totalB: response.data.file_total,
        };
      } catch (error) {
        toast.error(translateFolderApiError(tf, error, 'errors.default'));
        return { listA: [], listB: [], totalA: 0, totalB: 0 };
      }
    },
    PAGE_SIZE,
    [mode, groupId, folderId]
  );

  const entries = useMemo<FsEntry[]>(() => [...toFolderEntries(subfolders), ...toFileEntries(files)], [subfolders, files]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entry.kind === 'folder') return !query || entry.name.toLowerCase().includes(query);
      if (category !== 'all' && getFileCategory(entry.mime_type) !== category) return false;
      if (query && !entry.original_name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [entries, search, category]);

  const handleToggleStar = async (entry: FsEntry) => {
    const originalStarred = entry.is_starred;
    // Optimistic flip (spec §3.5) — refetch() below re-syncs with the server either way.
    try {
      if (entry.kind === 'file') {
        await (originalStarred ? unstarFile(entry.id) : starFile(entry.id));
      } else {
        await (originalStarred ? unstarFolder(entry.id) : starFolder(entry.id));
      }
      refetch();
    } catch (error) {
      toast.error(entry.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
    }
  };

  const handleDownload = async (entry: FsEntry) => {
    if (entry.kind !== 'file') return;
    try {
      const response = await requestDownload(entry.id);
      window.location.href = buildDownloadUrl(response.data.download_token);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  const handleRenameSubmit = async (name: string) => {
    if (!renameTarget) return;
    try {
      if (renameTarget.kind === 'file') {
        await renameFile(renameTarget.id, name);
      } else {
        await renameFolder(renameTarget.id, name);
      }
      toast.success(t('toasts.renameSuccess'));
      refetch();
    } catch (error) {
      toast.error(renameTarget.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'file') {
        await deleteFile(deleteTarget.id);
        toast.success(t('toasts.deleteSuccess'));
      } else {
        await deleteFolder(deleteTarget.id);
        toast.success(tf('toasts.deleteSuccess'));
      }
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      toast.error(deleteTarget.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
    }
  };

  const handleCreateFolder = async (name: string) => {
    try {
      await createFolder({ name, scope: mode, group_id: mode === 'group' ? groupId : undefined, parent_folder_id: folderId });
      toast.success(tf('toasts.createSuccess'));
      refetch();
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
      throw error;
    }
  };

  // Extension point: the Move/Copy task and the Share task each add one more
  // ActionMenuItem to this exact array (after "download", before the
  // trailing "delete" entry — delete stays last since it's the most
  // destructive/least-frequently-used action, matching spec §3.2's order).
  const buildActionItems = (entry: FsEntry): ActionMenuItem[] => {
    const scope = entry.kind === 'file' ? 'file' : 'folder';
    return [
      ...(entry.kind === 'file'
        ? [{
            key: 'download',
            label: t('detail.download'),
            icon: <Download size={16} strokeWidth={1.75} />,
            onSelect: () => void handleDownload(entry),
            hidden: isForbidden(scope, 'download', entry.id),
          }]
        : []),
      {
        key: 'rename',
        label: t('table.rename'),
        icon: <Pencil size={16} strokeWidth={1.75} />,
        onSelect: () => setRenameTarget(entry),
        hidden: isForbidden(scope, 'edit', entry.id),
      },
      {
        key: 'star',
        label: entry.is_starred ? t('table.unstar') : t('table.star'),
        icon: <Star size={16} strokeWidth={1.75} />,
        onSelect: () => void handleToggleStar(entry),
      },
      {
        key: 'delete',
        label: t('detail.delete'),
        icon: <Trash2 size={16} strokeWidth={1.75} />,
        variant: 'danger',
        onSelect: () => setDeleteTarget(entry),
        hidden: isForbidden(scope, 'delete', entry.id),
      },
    ];
  };

  const renderActions = (entry: FsEntry) => (
    <EntryActionsMenu items={buildActionItems(entry)} triggerLabel={t('table.actions')} sheetTitle={t(entry.kind === 'file' ? 'table.actions' : 'table.actions')} />
  );

  const title = mode === 'group' ? t('groupPage.title') : t('page.title');

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
          <FilesBreadcrumb folderId={folderId} basePath={basePath} />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => setIsNewFolderOpen(true)}>
            <FolderPlus size={16} strokeWidth={1.75} className="mr-1.5" />
            {tf('newFolder.trigger')}
          </Button>
          <Button type="button" variant="primary" onClick={() => setIsUploadOpen(true)}>
            {t('upload.submit')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={15} strokeWidth={1.75} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <Input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('toolbar.searchPlaceholder')} className="pl-8" />
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
            <TabsList>
              <TabsTrigger value="all">{t('toolbar.filters.all')}</TabsTrigger>
              <TabsTrigger value="document">{t('toolbar.filters.documents')}</TabsTrigger>
              <TabsTrigger value="image">{t('toolbar.filters.images')}</TabsTrigger>
              <TabsTrigger value="spreadsheet">{t('toolbar.filters.spreadsheets')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] p-1">
            <button type="button" aria-label={t('toolbar.view.list')} onClick={() => setView('list')} className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${view === 'list' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
              <List size={15} strokeWidth={1.75} />
            </button>
            <button type="button" aria-label={t('toolbar.view.grid')} onClick={() => setView('grid')} className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${view === 'grid' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
              <LayoutGrid size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>

      <UploadDialog open={isUploadOpen} onClose={() => setIsUploadOpen(false)} mode={mode} groupId={groupId} folderId={folderId} onUploaded={refetch} />
      <NameDialog open={isNewFolderOpen} title={tf('newFolder.title')} label={tf('newFolder.label')} submitLabel={tf('newFolder.submit')} onSubmit={handleCreateFolder} onClose={() => setIsNewFolderOpen(false)} />
      <NameDialog
        open={renameTarget !== null}
        title={renameTarget?.kind === 'file' ? t('rename.fileTitle') : tf('rename.title')}
        label={renameTarget?.kind === 'file' ? t('rename.label') : tf('rename.label')}
        initialValue={renameTarget ? (renameTarget.kind === 'file' ? renameTarget.original_name : renameTarget.name) : ''}
        submitLabel={t('rename.submit')}
        onSubmit={handleRenameSubmit}
        onClose={() => setRenameTarget(null)}
      />

      {isLoading && entries.length === 0 ? (
        <div className="space-y-2">
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        </div>
      ) : view === 'grid' ? (
        <FileGrid
          entries={filteredEntries}
          selectedIds={selectedIds}
          onToggleSelect={(entry) => setSelectedIds((current) => toggleSet(current, entry.id))}
          onOpenFile={setSelectedFileId}
          onOpenFolder={setSelectedFolderDetailId}
          onToggleStar={handleToggleStar}
          renderActions={renderActions}
        />
      ) : (
        <FileTable
          entries={filteredEntries}
          selectedIds={selectedIds}
          onToggleSelect={(entry) => setSelectedIds((current) => toggleSet(current, entry.id))}
          onOpenFile={setSelectedFileId}
          onOpenFolder={setSelectedFolderDetailId}
          onToggleStar={handleToggleStar}
          renderActions={renderActions}
        />
      )}

      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore}>
            {t('table.loadMore')}
          </Button>
        </div>
      )}

      <FileDetailSheet fileId={selectedFileId} onClose={() => setSelectedFileId(null)} onDeleted={() => { setSelectedFileId(null); refetch(); }} />
      <FolderDetailSheet folderId={selectedFolderDetailId} onClose={() => setSelectedFolderDetailId(null)} onDeleted={() => { setSelectedFolderDetailId(null); refetch(); }} onRenamed={refetch} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'folder' ? tf('confirmDelete.title') : t('detail.confirmDelete.title')}
        message={deleteTarget?.kind === 'folder' ? tf('confirmDelete.message') : t('detail.confirmDelete.message')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </section>
  );
}

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
```

Note two forward references that later tasks resolve, not this one:
1. `FolderDetailSheet` (imported here) is created in Task 32 — until then, create a temporary placeholder `components/files/FolderDetailSheet.tsx` in this task with the minimal props shape `{folderId: string|null; onClose: () => void; onDeleted?: () => void; onRenamed?: () => void}` that renders nothing when `folderId === null` and otherwise a bare `<SideSheet open title="" onClose={onClose}>{folderId}</SideSheet>` — Task 32 replaces this placeholder's body, not its prop signature (so this task's usage above needs no changes later).
2. `UploadDialog`'s `folderId` prop does not exist yet — Task 20 adds it. Until Task 20 runs, add a minimal `folderId?: string | null;` to `UploadDialogProps` in `components/files/UploadDialog.tsx` right now (in this task) and thread it into the existing `startUpload` call's payload (`folder_id: folderId`) so this task compiles standalone; Task 20 then rewrites the rest of `UploadDialog.tsx` for multi-file support without changing this prop.
3. `useRouterCompat()` in the code above is a typo/placeholder for "no router hook is actually needed here" — **delete that line** (`const router = useRouterCompat();`) before committing; nothing in this component uses `router`. This is called out explicitly because leaving it in would fail `tsc`/lint with an undefined symbol.

- [ ] **Step 6: Add the placeholder `FolderDetailSheet.tsx` (Task 32 finishes it)**

Create `components/files/FolderDetailSheet.tsx`:

```typescript
'use client';

import SideSheet from '@/components/ui/SideSheet';

export interface FolderDetailSheetProps {
  folderId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
  onRenamed?: () => void;
}

// Placeholder — Task 32 replaces this body with metadata/share/audit tabs.
export default function FolderDetailSheet({ folderId, onClose }: FolderDetailSheetProps) {
  if (folderId === null) return null;
  return (
    <SideSheet open title="" onClose={onClose}>
      <p className="text-sm text-[var(--text-tertiary)]">{folderId}</p>
    </SideSheet>
  );
}
```

- [ ] **Step 7: Add `folderId` to `UploadDialogProps` (minimal change; Task 20 does the rest)**

In `components/files/UploadDialog.tsx`, add `folderId?: string | null;` to `UploadDialogProps` and thread it into the `startUpload({...})` call already there (`folder_id: folderId`).

- [ ] **Step 8: Update the 3 existing page callers of `FilesFeed`**

`app/[locale]/files/page.tsx`: add `basePath="/files"` to the existing `<FilesFeed mode="private" />` call.
`app/[locale]/groups/[groupId]/files/page.tsx`: add `basePath={`/groups/${groupId}/files`}` to the existing `<FilesFeed mode="group" groupId={groupId} />` call.
(Task 24 adds the two new `folder/[folderId]` page callers.)

- [ ] **Step 9: Add new i18n keys**

`messages/hu.json` under `files`: `"table.loadMore": "Több betöltése"`, `"table.rename": "Átnevezés"`, `"rename": {"fileTitle": "Fájl átnevezése", "label": "Fájlnév", "submit": "Átnevezés"}`, `"toasts.renameSuccess": "Átnevezve."`.
Under a new top-level `folders` namespace (sibling of `files`) in `messages/hu.json`: `{"newFolder": {"trigger": "Új mappa", "title": "Új mappa", "label": "Mappa neve", "submit": "Létrehozás"}, "rename": {"title": "Mappa átnevezése", "label": "Mappa neve"}, "confirmDelete": {"title": "Mappa törlése", "message": "A mappa és a benne lévő összes almappa/fájl a Kukába kerül."}, "toasts": {"createSuccess": "Mappa létrehozva.", "deleteSuccess": "A mappa a lomtárba került."}, "errors": {"api": {"401": "A hitelesítés sikertelen. Jelentkezz be újra.", "403": "Nincs jogosultságod a művelethez.", "404": "A mappa már nem érhető el.", "409": "Ütközés történt.", "413": "Nincs elég tárhely.", "422": "Az ellenőrzés sikertelen.", "429": "Túl sok kérés."}, "default": "Ismeretlen hiba történt a mappaművelet során."}}` (mirror in English into `messages/en.json` with the equivalent English strings, same key structure).

- [ ] **Step 10: Verify and commit**

Run: `npx vitest run hooks/__tests__/usePagedDualList.test.ts` and `npx tsc --noEmit`. Manual check (dev server): `/files` shows folders above files, breadcrumb shows "Files" only at root, star toggle flips immediately, rename/delete open the right dialogs, "Load more" appears once either total exceeds 20.

```bash
git add hooks/usePagedDualList.ts hooks/__tests__/usePagedDualList.test.ts components/files/FilesFeed.tsx components/files/FolderDetailSheet.tsx components/files/UploadDialog.tsx "app/[locale]/files/page.tsx" "app/[locale]/groups/[groupId]/files/page.tsx" messages/hu.json messages/en.json
git commit -m "feat(files): folder-aware FilesFeed with breadcrumb, unified pagination, rename/delete/star actions"
```

### Task 19: Selection toolbar — `BulkActionBar.tsx`

**Files:**
- Create: `components/files/BulkActionBar.tsx`
- Modify: `components/files/FilesFeed.tsx` (wire the bar in; extends, does not replace, Task 18's state)

**Interfaces:**
- Consumes: `selectedIds`/`setSelectedIds`/`entries`/`buildActionItems`-adjacent handlers from Task 18's `FilesFeed`.
- Produces: `<BulkActionBar count onDownloadAll onDeleteAll onClear />` — a fixed/floating bar, no further consumers in this plan (the Move/Share tasks extend its props the same way they extend `buildActionItems`).

- [ ] **Step 1: Implement the bar**

Per spec §3.3: floating action bar appears once ≥1 item is selected; bulk delete shows an aggregate result toast.

Create `components/files/BulkActionBar.tsx`:

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Download, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';

export interface BulkActionBarProps {
  count: number;
  onDownloadAll: () => void;
  onDeleteAll: () => void;
  onClear: () => void;
  isBusy?: boolean;
}

export default function BulkActionBar({ count, onDownloadAll, onDeleteAll, onClear, isBusy }: BulkActionBarProps) {
  const t = useTranslations('files');
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2.5 shadow-2xl">
        <span className="text-sm text-[var(--text-primary)]">{t('bulk.selectedCount', { count })}</span>
        <Button type="button" variant="secondary" size="sm" onClick={onDownloadAll} disabled={isBusy}>
          <Download size={14} strokeWidth={1.75} className="mr-1" />
          {t('bulk.download')}
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={onDeleteAll} disabled={isBusy}>
          <Trash2 size={14} strokeWidth={1.75} className="mr-1" />
          {t('bulk.delete')}
        </Button>
        <button type="button" onClick={onClear} aria-label={t('bulk.clear')} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]">
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `FilesFeed.tsx`**

Add state `const [isBulkBusy, setIsBulkBusy] = useState(false);` and two handlers, then render `<BulkActionBar .../>` right after the closing tag of the `FileGrid`/`FileTable` conditional block (before the "load more" button):

```typescript
const handleBulkDownload = async () => {
  setIsBulkBusy(true);
  const fileIds = entries.filter((e) => e.kind === 'file' && selectedIds.has(e.id)).map((e) => e.id);
  for (const fileId of fileIds) {
    try {
      const response = await requestDownload(fileId);
      window.open(buildDownloadUrl(response.data.download_token), '_blank');
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  }
  setIsBulkBusy(false);
};

const handleBulkDelete = async () => {
  setIsBulkBusy(true);
  const targets = entries.filter((e) => selectedIds.has(e.id));
  let succeeded = 0;
  for (const entry of targets) {
    try {
      if (entry.kind === 'file') await deleteFile(entry.id);
      else await deleteFolder(entry.id);
      succeeded += 1;
    } catch {
      // individual failure — counted in the summary toast below
    }
  }
  toast.success(t('bulk.deleteSummary', { succeeded, total: targets.length }));
  setSelectedIds(new Set());
  setIsBulkBusy(false);
  refetch();
};
```

```typescript
<BulkActionBar
  count={selectedIds.size}
  onDownloadAll={() => void handleBulkDownload()}
  onDeleteAll={() => void handleBulkDelete()}
  onClear={() => setSelectedIds(new Set())}
  isBusy={isBulkBusy}
/>
```

Add the `import BulkActionBar from '@/components/files/BulkActionBar';` import at the top.

- [ ] **Step 3: Add i18n keys**

`messages/hu.json` under `files`: `"bulk": {"selectedCount": "{count} kijelölve", "download": "Letöltés", "delete": "Törlés", "clear": "Kijelölés törlése", "deleteSummary": "{succeeded}/{total} elem törölve."}` (mirror in `messages/en.json`).

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit`. Manual check: select 2+ rows (checkbox), bar appears, bulk delete shows the "X/Y deleted" toast.

```bash
git add components/files/BulkActionBar.tsx components/files/FilesFeed.tsx messages/hu.json messages/en.json
git commit -m "feat(files): add floating bulk-selection action bar (download/delete)"
```

### Task 20: Multi-file upload queue — `useUploadQueue` hook + `UploadProgressPanel` + whole-area drag&drop

**Files:**
- Create: `hooks/useUploadQueue.ts`
- Test: `hooks/__tests__/useUploadQueue.test.ts` (new)
- Create: `components/files/UploadProgressPanel.tsx`
- Modify: `components/files/UploadDialog.tsx` (replace single-file upload execution with the queue; keep the existing `open`/`onClose`/`mode`/`groupId`/`folderId`/`onUploaded` props)
- Modify: `components/files/FilesFeed.tsx` (wrap the list area in a page-level dropzone that also accepts multiple files)

**Interfaces:**
- Consumes: `startUpload`/`completeUpload` (existing, `lib/api/files.ts`), `uploadFileSchema` (Task 5), `sanitizeFilename` (Task 5).
- Produces: `useUploadQueue({mode, groupId, folderId, onAllSettled})` returning `{items, enqueue(files: File[]), retry(id), removeSettled(id)}`; `<UploadProgressPanel items retry remove />` — no other task in this plan consumes these beyond `UploadDialog`/`FilesFeed`.

**Scope note (concurrency):** spec §4.3 asks for "reasonable concurrency, e.g. 3–4 simultaneous uploads." This task caps it at 3 concurrent in-flight uploads; queued items beyond that wait their turn.

- [ ] **Step 1: Write the failing test for the queue's concurrency/ordering logic**

Create `hooks/__tests__/useUploadQueue.test.ts`:

```typescript
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUploadQueue } from '../useUploadQueue';

vi.mock('@/lib/api/files', () => ({
  startUpload: vi.fn().mockResolvedValue({
    data: { upload_id: 'u1', presigned_post_url: 'https://example.test/put', presigned_post_fields: {}, file_id: 'f1', folder_id: null },
  }),
  completeUpload: vi.fn().mockResolvedValue({ data: { file_id: 'f1', original_name: 'a.txt', mime_type: 'text/plain', size_bytes: 3 } }),
}));

global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

function makeFile(name: string) {
  return new File(['abc'], name, { type: 'text/plain' });
}

describe('useUploadQueue', () => {
  it('enqueues files and eventually marks them done', async () => {
    const onAllSettled = vi.fn();
    const { result } = renderHook(() => useUploadQueue({ mode: 'private', onAllSettled }));

    act(() => {
      result.current.enqueue([makeFile('a.txt'), makeFile('b.txt')]);
    });

    expect(result.current.items).toHaveLength(2);

    await waitFor(() => expect(result.current.items.every((item) => item.status === 'done')).toBe(true));
    expect(onAllSettled).toHaveBeenCalled();
  });

  it('caps concurrent in-flight uploads at 3', async () => {
    const { result } = renderHook(() => useUploadQueue({ mode: 'private' }));
    act(() => {
      result.current.enqueue([1, 2, 3, 4, 5].map((n) => makeFile(`f${n}.txt`)));
    });
    const uploading = result.current.items.filter((item) => item.status === 'uploading');
    expect(uploading.length).toBeLessThanOrEqual(3);
  });
});
```

Note: this test uses `global.fetch` for the presigned-POST step rather than the `XMLHttpRequest`-based helper the existing single-file `UploadDialog.tsx` uses — Step 3 below switches the queue's own upload transport to `fetch` (progress reporting via `fetch` + a `ReadableStream` is not available in all environments, so the queue reports coarse progress: `0` while in flight, `100` on completion — this is an intentional simplification versus the existing single-file XHR-based fine-grained progress bar, justified because the queue must run several uploads concurrently and `XMLHttpRequest.upload.onprogress` per-request is still usable per-item if preferred; **implementers may keep XHR instead of `fetch` in Step 3 for real per-file percentage progress — do so if straightforward, and update this test's mock accordingly (mock `XMLHttpRequest` instead of `fetch`)**. This plan does not mandate coarse progress, only flags that fine-grained progress requires XHR, which is more code than `fetch`; pick either, `UploadProgressPanel` (Step 4) accepts a `progress: number` per item either way.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run hooks/__tests__/useUploadQueue.test.ts`
Expected: FAIL — `../useUploadQueue` does not exist.

- [ ] **Step 3: Implement the queue**

Create `hooks/useUploadQueue.ts`:

```typescript
'use client';

import { useCallback, useRef, useState } from 'react';
import { startUpload, completeUpload, type FileScope } from '@/lib/api/files';

export type UploadItemStatus = 'queued' | 'uploading' | 'done' | 'error';

export interface UploadItem {
  id: string;
  file: File;
  status: UploadItemStatus;
  progress: number;
  errorMessage?: string;
}

export interface UseUploadQueueOptions {
  mode: FileScope;
  groupId?: string;
  folderId?: string | null;
  concurrency?: number;
  onAllSettled?: () => void;
}

let idCounter = 0;
const nextId = () => `upload-${++idCounter}`;

async function uploadOne(file: File, options: UseUploadQueueOptions, onProgress: (percent: number) => void): Promise<void> {
  const startResponse = await startUpload({
    filename: file.name,
    mime_type: file.type,
    scope: options.mode,
    group_id: options.mode === 'group' ? options.groupId : undefined,
    folder_id: options.folderId,
  });
  const { upload_id, presigned_post_url, presigned_post_fields, file_id } = startResponse.data;

  const formData = new FormData();
  Object.entries(presigned_post_fields).forEach(([key, value]) => formData.append(key, value));
  formData.append('file', file);

  onProgress(10);
  const putResponse = await fetch(presigned_post_url, { method: 'POST', body: formData });
  if (!putResponse.ok) {
    throw new Error(`presigned_post_failed_${putResponse.status}`);
  }
  onProgress(90);

  await completeUpload({ upload_id, file_id, original_name: file.name });
  onProgress(100);
}

export function useUploadQueue(options: UseUploadQueueOptions) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const inFlightCount = useRef(0);
  const concurrency = options.concurrency ?? 3;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateItem = (id: string, patch: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const pump = useCallback(() => {
    setItems((current) => {
      const runningCount = current.filter((item) => item.status === 'uploading').length;
      let slotsAvailable = concurrency - runningCount;
      if (slotsAvailable <= 0) return current;

      const next = current.map((item) => {
        if (slotsAvailable <= 0 || item.status !== 'queued') return item;
        slotsAvailable -= 1;
        void runUpload(item.id, item.file);
        return { ...item, status: 'uploading' as const };
      });
      return next;
    });
  }, [concurrency]);

  const runUpload = async (id: string, file: File) => {
    try {
      await uploadOne(file, optionsRef.current, (percent) => updateItem(id, { progress: percent }));
      updateItem(id, { status: 'done', progress: 100 });
    } catch (error) {
      updateItem(id, { status: 'error', errorMessage: error instanceof Error ? error.message : 'upload_failed' });
    } finally {
      pump();
      setItems((current) => {
        if (current.every((item) => item.status === 'done' || item.status === 'error')) {
          optionsRef.current.onAllSettled?.();
        }
        return current;
      });
    }
  };

  const enqueue = useCallback(
    (files: File[]) => {
      const newItems: UploadItem[] = files.map((file) => ({ id: nextId(), file, status: 'queued', progress: 0 }));
      setItems((current) => [...current, ...newItems]);
      setTimeout(pump, 0);
    },
    [pump]
  );

  const retry = useCallback(
    (id: string) => {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, status: 'queued', progress: 0, errorMessage: undefined } : item)));
      setTimeout(pump, 0);
    },
    [pump]
  );

  const removeSettled = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return { items, enqueue, retry, removeSettled };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run hooks/__tests__/useUploadQueue.test.ts`
Expected: PASS (2/2). If flaky on the concurrency-cap assertion (timing-dependent), assert immediately after `act()` and before any `await`, as written above — the first `pump()` runs synchronously inside `enqueue`'s `setTimeout(pump, 0)` only after a tick, so check the test actually observes the queued→uploading transition; if it doesn't reliably, call `result.current` again after `await Promise.resolve()` inside `act()`. Adjust the test, not the implementation's correctness, to make this deterministic.

- [ ] **Step 5: Implement `UploadProgressPanel.tsx`**

Create `components/files/UploadProgressPanel.tsx`:

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, RotateCcw, X } from 'lucide-react';
import type { UploadItem } from '@/hooks/useUploadQueue';
import UploadProgressBar from './UploadProgressBar';

export interface UploadProgressPanelProps {
  items: UploadItem[];
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function UploadProgressPanel({ items, onRetry, onRemove }: UploadProgressPanelProps) {
  const t = useTranslations('files');
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,360px)] space-y-2 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 shadow-2xl">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-[var(--text-primary)]" title={item.file.name}>{item.file.name}</span>
              {item.status === 'done' && <CheckCircle2 size={14} className="shrink-0 text-[var(--success)]" />}
              {item.status === 'error' && <AlertCircle size={14} className="shrink-0 text-[var(--danger)]" />}
            </div>
            {(item.status === 'uploading' || item.status === 'queued') && (
              <UploadProgressBar value={item.progress} />
            )}
            {item.status === 'error' && <span className="text-xs text-[var(--danger)]">{t('upload.itemFailed')}</span>}
          </div>
          {item.status === 'error' && (
            <button type="button" onClick={() => onRetry(item.id)} aria-label={t('upload.retry')} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]">
              <RotateCcw size={14} strokeWidth={1.75} />
            </button>
          )}
          {(item.status === 'done' || item.status === 'error') && (
            <button type="button" onClick={() => onRemove(item.id)} aria-label={t('upload.dismiss')} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]">
              <X size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `UploadDialog.tsx` to use the queue for multiple files**

Replace the body of `components/files/UploadDialog.tsx` (keeps its existing `open`, `onClose`, `mode`, `groupId`, `folderId`, `onUploaded` props — Step 7 below adds four more: `items`, `enqueue`, `retry`, `removeSettled`, once the queue is lifted to `FilesFeed`; don't wire those yet in this step, just don't preclude them): remove the single-file `useState<File|null>` + inline `uploadToPresignedUrl` + the filename-only `react-hook-form` around a single file. Instead: the `FileDropzone` accepts multiple files (change its `onFileSelect` callback usage — `FileDropzone` itself stays single-file per its own prop contract at `components/files/FileDropzone.tsx:7`; **do not modify `FileDropzone.tsx`** — instead add a second, native `<input type="file" multiple accept={ALLOWED_MIME_TYPES.join(',')} onChange={...} />` used for the "browse" affordance, while the existing single-file `FileDropzone` continues to handle single drag&drop as today; both paths call the same `handleFilesSelected(files: File[])` which runs each file through `uploadFileSchema.safeParse` (auto-suggesting `sanitizeFilename` on failure via a toast rather than blocking, per spec §12) and calls `enqueue()` from `useUploadQueue`. Render `<UploadProgressPanel items={items} onRetry={retry} onRemove={removeSettled} />` outside the `Modal` (it should stay visible after the modal closes, matching spec §4.3's "lebegő feltöltés-panel"). Call `onUploaded()` from the queue's `onAllSettled` callback instead of immediately on submit.

- [ ] **Step 7: Wrap `FilesFeed`'s list area in a whole-page dropzone**

In `components/files/FilesFeed.tsx`, wrap the `FileGrid`/`FileTable` conditional block in a `<div>` with `onDragOver`/`onDrop` handlers that call the same `handleFilesSelected`-equivalent — simplest correct approach: lift `useUploadQueue` up into `FilesFeed` itself (not `UploadDialog`), pass `enqueue`/`items`/`retry`/`removeSettled` down as props into `UploadDialog` (which stops owning its own queue instance and instead receives these as props), and add the drag&drop handlers directly on `FilesFeed`'s list wrapper `<div>` calling `enqueue(Array.from(event.dataTransfer.files))`. Render `<UploadProgressPanel .../>` once, at the `FilesFeed` level (not inside `UploadDialog`), so it persists across the dialog opening/closing and across drag&drop uploads that never open the dialog at all.

- [ ] **Step 8: Add i18n keys**

`messages/hu.json` under `files.upload`: `"itemFailed": "Sikertelen."`, `"retry": "Újra"`, `"dismiss": "Bezárás"` (mirror in `en.json`).

- [ ] **Step 9: Verify and commit**

Run: `npx vitest run hooks/__tests__/useUploadQueue.test.ts` and `npx tsc --noEmit`. Manual check: drag 2+ files onto the file list (not just the dropzone inside the modal) — both upload with visible progress, panel persists after both finish until dismissed, list refreshes once all settle.

```bash
git add hooks/useUploadQueue.ts hooks/__tests__/useUploadQueue.test.ts components/files/UploadProgressPanel.tsx components/files/UploadDialog.tsx components/files/FilesFeed.tsx messages/hu.json messages/en.json
git commit -m "feat(files): multi-file concurrent upload queue with persistent progress panel and whole-area drag&drop"
```

## Phase E — Sub-navigation, Starred, Shared-with-me, folder routes, Trash extension

### Task 21: Create `FilesSubNav.tsx` and wire it into `FilesShell.tsx`

**Files:**
- Create: `components/files/FilesSubNav.tsx`
- Modify: `components/files/FilesShell.tsx:1-11`
- Modify: `app/[locale]/files/page.tsx`, `app/[locale]/files/trash/page.tsx` (wrap with the sub-nav; `groups/[groupId]/files` stays unwrapped — see design note)

**Design note:** per API spec §9/§10, `starred/list` and `shared-with-me/list` are **user-global**, not scoped to a group — they aggregate across every group the user belongs to. So this sub-nav (Saját fájlok/Csillagozott/Megosztva velem/Kuka) only makes sense under the private `/files` root; `/groups/:id/files` keeps its current simple header (title + Upload + New Folder, already in `FilesFeed`) with no sub-nav.

**Interfaces:**
- Produces: `<FilesSubNav />` (no props — reads the active segment from `usePathname()` like `Sidebar.tsx` already does) — consumed by Task 22, 23 pages and this task's own edit to `files/page.tsx`/`files/trash/page.tsx`.

- [ ] **Step 1: Implement**

Create `components/files/FilesSubNav.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { useLocale, usePathname, useTranslations } from 'next-intl';
import { Folder, Star, Trash2, Users } from 'lucide-react';

const ITEMS = [
  { key: 'root', href: '', icon: Folder },
  { key: 'starred', href: '/starred', icon: Star },
  { key: 'sharedWithMe', href: '/shared-with-me', icon: Users },
  { key: 'trash', href: '/trash', icon: Trash2 },
] as const;

export default function FilesSubNav() {
  const t = useTranslations('files');
  const locale = useLocale();
  const pathname = usePathname();
  const base = `/${locale}/files`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-2">
      {ITEMS.map(({ key, href, icon: Icon }) => {
        const target = `${base}${href}`;
        const active = href === '' ? pathname === base : pathname.startsWith(target);
        return (
          <Link
            key={key}
            href={target}
            className={`flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-sm ${
              active ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-medium' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon size={15} strokeWidth={1.75} />
            {t(`subnav.${key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Wire into `FilesShell.tsx`**

Replace `components/files/FilesShell.tsx`:

```typescript
'use client';

import { ReactNode } from 'react';
import FilesSubNav from './FilesSubNav';

export interface FilesShellProps {
  children: ReactNode;
  /** Set to false for scopes with no sub-nav (e.g. group files — see Task 21 design note). */
  showSubNav?: boolean;
}

export default function FilesShell({ children, showSubNav = true }: FilesShellProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {showSubNav && <FilesSubNav />}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Use `showSubNav={false}` on the group files page**

`app/[locale]/groups/[groupId]/files/page.tsx` does not use `FilesShell` today (confirmed — it renders `FilesFeed` directly, per the existing file). No change needed there; this step is a no-op confirmation, not an edit — do not add `FilesShell` to that page, it would introduce a sub-nav this scope should not have.

- [ ] **Step 4: Add i18n keys**

`messages/hu.json` under `files`: `"subnav": {"root": "Saját fájlok", "starred": "Csillagozott", "sharedWithMe": "Megosztva velem", "trash": "Kuka"}` (mirror in `en.json`: "My files"/"Starred"/"Shared with me"/"Trash").

- [ ] **Step 5: Verify and commit**

`npx tsc --noEmit`. Manual check: `/files` shows the 4-item sub-nav with "Saját fájlok" active; `/groups/{id}/files` shows no sub-nav (unchanged from before this task).

```bash
git add components/files/FilesSubNav.tsx components/files/FilesShell.tsx
git commit -m "feat(files): add private-scope sub-navigation (My files/Starred/Shared with me/Trash)"
```

### Task 22: Create `StarredView.tsx` and its route

**Files:**
- Create: `components/files/StarredView.tsx`
- Create: `app/[locale]/files/starred/page.tsx`

**Interfaces:**
- Consumes: `getStarred` (Task 2), `usePagedDualList` (Task 18), `FileTable`/`FileGrid`/`EntryListProps` (Task 15), `EntryActionsMenu` (Task 16).
- Produces: nothing consumed elsewhere in this plan.

- [ ] **Step 1: Implement**

Per spec §3.5: folders sorted by name, files by newest-first (already how the backend returns them — no client sort needed); this view reuses the file/folder rendering but its own reduced action set (no "New Folder"/"Upload" here — starring is cross-cutting, not a place you add content).

Create `components/files/StarredView.tsx`:

```typescript
'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { getStarred, starFile, unstarFile, requestDownload, buildDownloadUrl } from '@/lib/api/files';
import { starFolder, unstarFolder } from '@/lib/api/folders';
import { translateFileApiError } from '@/lib/i18n/files';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Star } from 'lucide-react';
import FileTable from '@/components/files/FileTable';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import FolderDetailSheet from '@/components/files/FolderDetailSheet';
import EntryActionsMenu, { type ActionMenuItem } from '@/components/files/EntryActionsMenu';
import { toFileEntries, toFolderEntries, type FsEntry } from '@/components/files/entryTypes';

const PAGE_SIZE = 20;

export default function StarredView() {
  const t = useTranslations('files');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const {
    listA: folders,
    listB: files,
    isLoading,
    hasMore,
    loadMore,
    reset: refetch,
  } = usePagedDualList(
    async (offset, limit) => {
      const response = await getStarred(offset, limit);
      return {
        listA: response.data.folders,
        listB: response.data.files,
        totalA: response.data.folder_total,
        totalB: response.data.file_total,
      };
    },
    PAGE_SIZE,
    []
  );

  const entries = useMemo<FsEntry[]>(() => [...toFolderEntries(folders), ...toFileEntries(files)], [folders, files]);

  const handleToggleStar = async (entry: FsEntry) => {
    try {
      if (entry.kind === 'file') await unstarFile(entry.id);
      else await unstarFolder(entry.id);
      refetch();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  const buildActionItems = (entry: FsEntry): ActionMenuItem[] => [
    ...(entry.kind === 'file'
      ? [{
          key: 'download',
          label: t('detail.download'),
          onSelect: async () => {
            try {
              const response = await requestDownload(entry.id);
              window.location.href = buildDownloadUrl(response.data.download_token);
            } catch (error) {
              toast.error(translateFileApiError(t, error, 'errors.default'));
            }
          },
        }]
      : []),
    {
      key: 'unstar',
      label: t('table.unstar'),
      icon: <Star size={16} strokeWidth={1.75} className="fill-[var(--accent)] text-[var(--accent)]" />,
      onSelect: () => void handleToggleStar(entry),
    },
  ];

  if (!isLoading && entries.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('subnav.starred')}</h1>
        <EmptyState icon={<Star size={24} strokeWidth={1.5} />}>{t('starred.emptyText')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('subnav.starred')}</h1>
      {isLoading && entries.length === 0 ? (
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      ) : (
        <FileTable
          entries={entries}
          selectedIds={new Set()}
          onToggleSelect={() => undefined}
          onOpenFile={setSelectedFileId}
          onOpenFolder={setSelectedFolderId}
          onToggleStar={handleToggleStar}
          renderActions={(entry) => <EntryActionsMenu items={buildActionItems(entry)} triggerLabel={t('table.actions')} sheetTitle={t('table.actions')} />}
        />
      )}
      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore}>{t('table.loadMore')}</Button>
        </div>
      )}
      <FileDetailSheet fileId={selectedFileId} onClose={() => setSelectedFileId(null)} onDeleted={() => { setSelectedFileId(null); refetch(); }} />
      <FolderDetailSheet folderId={selectedFolderId} onClose={() => setSelectedFolderId(null)} onDeleted={() => { setSelectedFolderId(null); refetch(); }} onRenamed={refetch} />
    </section>
  );
}
```

- [ ] **Step 2: Create the route**

Create `app/[locale]/files/starred/page.tsx`:

```typescript
'use client';

import FilesShell from '@/components/files/FilesShell';
import StarredView from '@/components/files/StarredView';

export default function FilesStarredPage() {
  return (
    <FilesShell>
      <StarredView />
    </FilesShell>
  );
}
```

- [ ] **Step 3: Add i18n key**

`messages/hu.json` under `files`: `"starred": {"emptyText": "Nincs csillagozott elemed."}` (mirror in `en.json`: "You have no starred items.").

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit`. Manual check: star a file from `/files`, navigate to `/files/starred`, confirm it appears; unstar from there, confirm it disappears after refetch.

```bash
git add components/files/StarredView.tsx "app/[locale]/files/starred/page.tsx" messages/hu.json messages/en.json
git commit -m "feat(files): add Starred view aggregating starred files and folders"
```

### Task 23: Create `SharedWithMeView.tsx` and its route

**Files:**
- Create: `components/files/SharedWithMeView.tsx`
- Create: `app/[locale]/files/shared-with-me/page.tsx`

**Interfaces:**
- Consumes: `getSharedWithMe` (Task 2), `usePagedDualList` (Task 18).
- Produces: nothing consumed elsewhere.

**Design note (spec §9.3/§10):** `is_owner` is always `false` here and the backend leaves `is_starred` unset/`false` (shared-view service doesn't compute it) — so this view shows a **reduced action set**: view/preview + download only, no delete/rename/move/share/star, matching spec §9.3's explicit guidance for this specific view.

- [ ] **Step 1: Implement**

Create `components/files/SharedWithMeView.tsx`:

```typescript
'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Users } from 'lucide-react';
import { getSharedWithMe, requestDownload, buildDownloadUrl } from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import FileTable from '@/components/files/FileTable';
import FileDetailSheet from '@/components/files/FileDetailSheet';
import FolderDetailSheet from '@/components/files/FolderDetailSheet';
import EntryActionsMenu, { type ActionMenuItem } from '@/components/files/EntryActionsMenu';
import { toFileEntries, toFolderEntries, type FsEntry } from '@/components/files/entryTypes';

const PAGE_SIZE = 20;

export default function SharedWithMeView() {
  const t = useTranslations('files');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const {
    listA: folders,
    listB: files,
    isLoading,
    hasMore,
    loadMore,
  } = usePagedDualList(
    async (offset, limit) => {
      const response = await getSharedWithMe(offset, limit);
      return {
        listA: response.data.folders,
        listB: response.data.files,
        totalA: response.data.folder_total,
        totalB: response.data.file_total,
      };
    },
    PAGE_SIZE,
    []
  );

  const entries = useMemo<FsEntry[]>(() => [...toFolderEntries(folders), ...toFileEntries(files)], [folders, files]);

  const buildActionItems = (entry: FsEntry): ActionMenuItem[] =>
    entry.kind === 'file'
      ? [{
          key: 'download',
          label: t('detail.download'),
          onSelect: async () => {
            try {
              const response = await requestDownload(entry.id);
              window.location.href = buildDownloadUrl(response.data.download_token);
            } catch (error) {
              toast.error(translateFileApiError(t, error, 'errors.default'));
            }
          },
        }]
      : [];

  if (!isLoading && entries.length === 0) {
    return (
      <section className="space-y-4">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('subnav.sharedWithMe')}</h1>
        <EmptyState icon={<Users size={24} strokeWidth={1.5} />}>{t('sharedWithMe.emptyText')}</EmptyState>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('subnav.sharedWithMe')}</h1>
      {isLoading && entries.length === 0 ? (
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
      ) : (
        <FileTable
          entries={entries}
          selectedIds={new Set()}
          onToggleSelect={() => undefined}
          onOpenFile={setSelectedFileId}
          onOpenFolder={setSelectedFolderId}
          onToggleStar={() => undefined}
          renderActions={(entry) => <EntryActionsMenu items={buildActionItems(entry)} triggerLabel={t('table.actions')} sheetTitle={t('table.actions')} />}
        />
      )}
      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore}>{t('table.loadMore')}</Button>
        </div>
      )}
      <FileDetailSheet fileId={selectedFileId} onClose={() => setSelectedFileId(null)} />
      <FolderDetailSheet folderId={selectedFolderId} onClose={() => setSelectedFolderId(null)} />
    </section>
  );
}
```

Note the star column still renders in `FileTable` (its `onToggleStar` prop is required by `EntryListProps`) but is wired to a no-op here — per spec §9.3 this view intentionally has no working star toggle since `is_starred` isn't populated; a future backend enhancement could remove this limitation, not a UI bug.

- [ ] **Step 2: Create the route**

Create `app/[locale]/files/shared-with-me/page.tsx`:

```typescript
'use client';

import FilesShell from '@/components/files/FilesShell';
import SharedWithMeView from '@/components/files/SharedWithMeView';

export default function FilesSharedWithMePage() {
  return (
    <FilesShell>
      <SharedWithMeView />
    </FilesShell>
  );
}
```

- [ ] **Step 3: Add i18n key**

`messages/hu.json` under `files`: `"sharedWithMe": {"emptyText": "Senki nem osztott meg veled fájlt vagy mappát."}` (mirror in `en.json`).

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit`

```bash
git add components/files/SharedWithMeView.tsx "app/[locale]/files/shared-with-me/page.tsx" messages/hu.json messages/en.json
git commit -m "feat(files): add Shared-with-me view with reduced (view/download-only) action set"
```

### Task 24: Folder route pages (private + group)

**Files:**
- Create: `app/[locale]/files/folder/[folderId]/page.tsx`
- Create: `app/[locale]/groups/[groupId]/files/folder/[folderId]/page.tsx`

**Interfaces:**
- Consumes: `FilesFeed` (Task 18, already accepts `folderId`).

- [ ] **Step 1: Private folder page**

Create `app/[locale]/files/folder/[folderId]/page.tsx`:

```typescript
'use client';

import { useParams } from 'next/navigation';
import FilesFeed from '@/components/files/FilesFeed';
import FilesShell from '@/components/files/FilesShell';

export default function FilesFolderPage() {
  const params = useParams();
  const folderId = decodeURIComponent(String(params.folderId ?? ''));

  return (
    <FilesShell>
      <FilesFeed mode="private" folderId={folderId} basePath="/files" />
    </FilesShell>
  );
}
```

- [ ] **Step 2: Group folder page**

Create `app/[locale]/groups/[groupId]/files/folder/[folderId]/page.tsx` — mirrors the existing `app/[locale]/groups/[groupId]/files/page.tsx` pattern (uses `useGroupPermission()` for the decoded `groupId`, no `FilesShell`/sub-nav per Task 21's design note):

```typescript
'use client';

import { useParams } from 'next/navigation';
import { useGroupPermission } from '@/components/providers/GroupPermissionContext';
import FilesFeed from '@/components/files/FilesFeed';

export default function GroupFilesFolderPage() {
  const { groupId, isLoading } = useGroupPermission();
  const params = useParams();
  const folderId = decodeURIComponent(String(params.folderId ?? ''));

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
      </div>
    );
  }

  return <FilesFeed mode="group" groupId={groupId} folderId={folderId} basePath={`/groups/${groupId}/files`} />;
}
```

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit`. Manual check: clicking a folder row/card in `/files` navigates to `/files/folder/{id}` and lists that folder's contents with a correct breadcrumb; same for a group's files.

```bash
git add "app/[locale]/files/folder/[folderId]/page.tsx" "app/[locale]/groups/[groupId]/files/folder/[folderId]/page.tsx"
git commit -m "feat(files): add folder navigation routes for private and group scopes"
```

### Task 25: Extend `TrashView.tsx` for combined file+folder trash

**Files:**
- Modify: `components/files/TrashView.tsx` (full rewrite of the component body; keep the file)

**Interfaces:**
- Consumes: `getFolderTrash`/`restoreFolder`/`permanentDeleteFolder` (Task 4), `usePagedDualList` (Task 18).

**Behavior per spec §4/§5.2:** folder soft-delete cascades (children go to trash too) but folder **restore does not** cascade — each child must be restored individually from the trash. Folder permanent-delete **does** cascade. The trash listing itself shows top-level trashed items only (whatever the backend's `GET .../trash` returns) — this task does not attempt to reconstruct or display cascade relationships, since the backend doesn't expose them here either.

- [ ] **Step 1: Rewrite**

Replace `components/files/TrashView.tsx` content:

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Folder } from 'lucide-react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { getTrash, restoreFile, permanentDeleteFile, type FileInTrashOut } from '@/lib/api/files';
import { getFolderTrash, restoreFolder, permanentDeleteFolder, type FolderInTrashOut } from '@/lib/api/folders';
import { translateFileApiError } from '@/lib/i18n/files';
import { translateFolderApiError } from '@/lib/i18n/folders';
import { usePagedDualList } from '@/hooks/usePagedDualList';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';

type TrashEntry = ({ kind: 'file' } & FileInTrashOut) | ({ kind: 'folder' } & FolderInTrashOut);

const PAGE_SIZE = 20;

export default function TrashView() {
  const t = useTranslations('files');
  const tf = useTranslations('folders');

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TrashEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    listA: fileItems,
    listB: folderItems,
    isLoading,
    hasMore,
    loadMore,
    reset: refetch,
  } = usePagedDualList(
    async (offset, limit) => {
      const [filesResponse, foldersResponse] = await Promise.all([getTrash(offset, limit), getFolderTrash(offset, limit)]);
      return {
        listA: filesResponse.data.items,
        listB: foldersResponse.data.items,
        totalA: filesResponse.data.total,
        totalB: foldersResponse.data.total,
      };
    },
    PAGE_SIZE,
    []
  );

  const entries: TrashEntry[] = [
    ...folderItems.map((item) => ({ kind: 'folder' as const, ...item })),
    ...fileItems.map((item) => ({ kind: 'file' as const, ...item })),
  ];

  const handleRestore = async (entry: TrashEntry) => {
    if (restoringId) return;
    setRestoringId(entry.id);
    try {
      if (entry.kind === 'file') {
        await restoreFile(entry.id);
        toast.success(t('toasts.restoreSuccess'));
      } else {
        await restoreFolder(entry.id);
        toast.success(tf('restoreSuccess'));
      }
      refetch();
    } catch (error) {
      toast.error(entry.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.kind === 'file') {
        await permanentDeleteFile(deleteTarget.id);
        toast.success(t('toasts.permanentDeleteSuccess'));
      } else {
        await permanentDeleteFolder(deleteTarget.id);
        toast.success(tf('permanentDeleteSuccess'));
      }
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      toast.error(deleteTarget.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<TrashEntry>[] = [
    {
      key: 'name',
      label: t('table.name'),
      render: (_value, row) => (
        <span className="flex items-center gap-2">
          {row.kind === 'folder' && <Folder size={16} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />}
          {row.kind === 'file' ? row.original_name : row.name}
        </span>
      ),
    },
    { key: 'type', label: t('table.type'), render: (_value, row) => (row.kind === 'folder' ? t('table.folderType') : formatMimeType(row.mime_type)) },
    { key: 'size', label: t('table.size'), render: (_value, row) => (row.kind === 'folder' ? '-' : formatFileSize(row.size_bytes)) },
    { key: 'deletedAt', label: t('trash.table.deletedAt'), render: (_value, row) => (row.deleted_at ? formatUploadedAt(row.deleted_at) : '-') },
    {
      key: 'actions',
      label: t('table.actions'),
      render: (_value, row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" loading={restoringId === row.id} onClick={() => handleRestore(row)}>{t('trash.restore')}</Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget(row)}>{t('trash.permanentDelete')}</Button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('trash.title')}</h1>

      {isLoading && entries.length === 0 ? (
        <div className="space-y-2">
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState>{t('trash.emptyText')}</EmptyState>
      ) : (
        <DataTable columns={columns} rows={entries} emptyState={<span className="text-sm text-[var(--text-tertiary)]">{t('trash.emptyText')}</span>} />
      )}

      {!isLoading && hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore}>{t('table.loadMore')}</Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('trash.confirmPermanentTitle')}
        message={deleteTarget?.kind === 'folder' ? tf('confirmPermanentDelete.message') : t('trash.confirmPermanentMessage')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!isDeleting) void handlePermanentDeleteConfirm();
        }}
      />
    </section>
  );
}
```

Note: a folder's "Restore" button intentionally carries no cascade caveat in the confirm flow (restore has no confirm dialog today, matching the existing file-restore UX which is also one-click) — instead, per spec §5.2, the **non**-cascading nature of restore is communicated via a static helper line under the page title. Add, right after the `<h1>`:

```typescript
<p className="text-xs text-[var(--text-tertiary)]">{tf('trashHelperText')}</p>
```

- [ ] **Step 2: Add i18n keys**

`messages/hu.json` under `folders`: `"restoreSuccess": "A mappa visszaállítva.", "permanentDeleteSuccess": "A mappa véglegesen törölve.", "confirmPermanentDelete": {"message": "Ez a művelet nem vonható vissza. A mappa és teljes tartalma véglegesen törlődik."}, "trashHelperText": "A mappa visszaállítása nem állítja vissza automatikusan a benne lévő fájlokat/almappákat — azokat egyenként kell visszaállítani."` (mirror in `en.json`).

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit`. Manual check: delete a folder containing a file, confirm both land in `/files/trash` (folder cascade), restore only the folder, confirm the file entry is still shown separately in trash (non-cascading restore, per spec §5.2).

```bash
git add components/files/TrashView.tsx messages/hu.json messages/en.json
git commit -m "feat(files): combine file+folder trash, add non-cascading-restore helper text"
```

## Phase F — Preview modal, Share modal (user/group/link), Move/Copy dialog

### Task 26: Create `PreviewModal.tsx` and switch file-click to open it

**Files:**
- Create: `components/files/PreviewModal.tsx`
- Modify: `components/files/FilesFeed.tsx` (rewire "click a file" to open the preview, not the detail sheet directly; add a "Details" kebab item that opens the detail sheet instead)

**Interfaces:**
- Consumes: `getFileMetadata` (existing), `getPreviewUrl`/`ThumbnailImage` (Tasks 10/12), `starFile`/`unstarFile` (Task 2), `requestDownload`/`buildDownloadUrl` (existing).
- Produces: `<PreviewModal files currentFileId onNavigate onClose onOpenDetails />` — consumed only by `FilesFeed` in this plan (Tasks 22/23's `StarredView`/`SharedWithMeView` intentionally keep opening `FileDetailSheet` directly on click — their spec sections don't call out a lightbox requirement the way §3/§6 does for the main feed).

**Scope decision (PDF/other preview):** per spec §2.4/§6, the backend only generates thumbnail/preview derivatives for images (`GET /{file_id}/preview` is image-only — there is no PDF-to-image conversion endpoint). The `dl` download endpoint also always forces `Content-Disposition: attachment` (spec §2.2), so there is no authenticated inline-viewable URL for a PDF to embed. This task therefore implements the image lightbox fully, and for every non-image type (including PDF) shows `FileTypeIcon` + metadata + a Download button — not an iframe — because there is no backend capability to feed one. This matches the UI spec's own fallback instruction ("ha nincs [PDF renderelési lehetőség]... mutass egy nagy PDF-ikont + Letöltés").

- [ ] **Step 1: Implement**

Create `components/files/PreviewModal.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Download, Info, Star, X } from 'lucide-react';
import { getFileMetadata, requestDownload, buildDownloadUrl, starFile, unstarFile, type FileMetadataResponse } from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { formatFileSize, formatUploadedAt } from '@/lib/utils/formatFiles';
import FileTypeIcon from './FileTypeIcon';
import ThumbnailImage from './ThumbnailImage';
import type { FileEntry } from './entryTypes';

export interface PreviewModalProps {
  files: FileEntry[];
  currentFileId: string | null;
  onNavigate: (fileId: string) => void;
  onClose: () => void;
  onOpenDetails: (fileId: string) => void;
}

export default function PreviewModal({ files, currentFileId, onNavigate, onClose, onOpenDetails }: PreviewModalProps) {
  const t = useTranslations('files');
  const [metadata, setMetadata] = useState<FileMetadataResponse | null>(null);
  const touchStartX = useRef(0);

  const currentIndex = files.findIndex((f) => f.id === currentFileId);
  const currentEntry = currentIndex >= 0 ? files[currentIndex] : null;

  useEffect(() => {
    if (!currentFileId) {
      setMetadata(null);
      return;
    }
    let mounted = true;
    getFileMetadata(currentFileId)
      .then((response) => mounted && setMetadata(response.data))
      .catch(() => mounted && setMetadata(null));
    return () => {
      mounted = false;
    };
  }, [currentFileId]);

  const goPrev = () => currentIndex > 0 && onNavigate(files[currentIndex - 1].id);
  const goNext = () => currentIndex >= 0 && currentIndex < files.length - 1 && onNavigate(files[currentIndex + 1].id);

  useEffect(() => {
    if (!currentFileId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') goPrev();
      if (event.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFileId, currentIndex, files]);

  if (!currentFileId || !currentEntry) return null;

  const isImage = currentEntry.mime_type?.startsWith('image/') ?? false;

  const handleDownload = async () => {
    try {
      const response = await requestDownload(currentEntry.id);
      window.location.href = buildDownloadUrl(response.data.download_token);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  const handleToggleStar = async () => {
    try {
      if (metadata?.is_starred) await unstarFile(currentEntry.id);
      else await starFile(currentEntry.id);
      const refreshed = await getFileMetadata(currentEntry.id);
      setMetadata(refreshed.data);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90"
      onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => {
        const delta = event.changedTouches[0].clientX - touchStartX.current;
        if (delta > 60) goPrev();
        else if (delta < -60) goNext();
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{currentEntry.original_name}</p>
          {metadata && (
            <p className="text-xs text-white/60">{formatFileSize(metadata.size_bytes)} · {formatUploadedAt(metadata.uploaded_at)}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={handleToggleStar} aria-label={t('table.star')} className="rounded-full p-2 hover:bg-white/10">
            <Star size={18} strokeWidth={1.75} className={metadata?.is_starred ? 'fill-[var(--accent)] text-[var(--accent)]' : 'text-white'} />
          </button>
          <button type="button" onClick={() => onOpenDetails(currentEntry.id)} aria-label={t('preview.details')} className="rounded-full p-2 hover:bg-white/10">
            <Info size={18} strokeWidth={1.75} className="text-white" />
          </button>
          <button type="button" onClick={handleDownload} aria-label={t('detail.download')} className="rounded-full p-2 hover:bg-white/10">
            <Download size={18} strokeWidth={1.75} className="text-white" />
          </button>
          <button type="button" onClick={onClose} aria-label={t('preview.close')} className="rounded-full p-2 hover:bg-white/10">
            <X size={20} strokeWidth={1.75} className="text-white" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {currentIndex > 0 && (
          <button type="button" onClick={goPrev} aria-label={t('preview.prev')} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:left-4">
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
        )}
        {isImage ? (
          <ThumbnailImage
            fileId={currentEntry.id}
            mimeType={currentEntry.mime_type}
            variant="preview"
            alt={currentEntry.original_name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white">
            <FileTypeIcon mimeType={currentEntry.mime_type} size={64} className="text-white/70" />
            <p className="text-sm text-white/70">{t('preview.noPreview')}</p>
            <button type="button" onClick={handleDownload} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">
              {t('detail.download')}
            </button>
          </div>
        )}
        {currentIndex >= 0 && currentIndex < files.length - 1 && (
          <button type="button" onClick={goNext} aria-label={t('preview.next')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 sm:right-4">
            <ChevronRight size={22} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewire `FilesFeed.tsx`**

In `components/files/FilesFeed.tsx` (from Task 18): add `const [previewFileId, setPreviewFileId] = useState<string | null>(null);`. Change every `onOpenFile={setSelectedFileId}` prop passed to `FileTable`/`FileGrid` to `onOpenFile={setPreviewFileId}` instead. Add a `'details'` entry to `buildActionItems` (file-only, right after the existing `'download'` entry) that calls `setSelectedFileId(entry.id)`:

```typescript
{
  key: 'details',
  label: t('preview.details'),
  icon: <Info size={16} strokeWidth={1.75} />,
  onSelect: () => setSelectedFileId(entry.id),
},
```

(add `Info` to the existing `lucide-react` import line). Render `<PreviewModal />` near the other modals:

```typescript
<PreviewModal
  files={filteredEntries.filter((e): e is FileEntry => e.kind === 'file')}
  currentFileId={previewFileId}
  onNavigate={setPreviewFileId}
  onClose={() => setPreviewFileId(null)}
  onOpenDetails={(fileId) => { setPreviewFileId(null); setSelectedFileId(fileId); }}
/>
```

Add `import PreviewModal from '@/components/files/PreviewModal';` and `import type { FileEntry } from '@/components/files/entryTypes';` (extend the existing `entryTypes` import line rather than adding a second one).

- [ ] **Step 3: Add i18n keys**

`messages/hu.json` under `files`: `"preview": {"details": "Részletek", "close": "Bezárás", "prev": "Előző", "next": "Következő", "noPreview": "Nincs előnézet ehhez a fájltípushoz."}` (mirror in `en.json`).

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit`. Manual check: click an image file → full-screen lightbox opens with working ←/→ and Esc; click a PDF/docx → icon + Download fallback; "Details" (info icon or kebab item) opens the existing `FileDetailSheet`.

```bash
git add components/files/PreviewModal.tsx components/files/FilesFeed.tsx messages/hu.json messages/en.json
git commit -m "feat(files): add full-screen preview lightbox with keyboard/swipe navigation"
```

### Task 27: Extract `ShareGroupTab.tsx`, add `ShareUserTab.tsx`

**Files:**
- Create: `components/files/ShareGroupTab.tsx` (extracted from `FileDetailSheet.tsx:334-397`)
- Create: `components/files/ShareUserTab.tsx`

**Interfaces:**
- Produces: `<ShareGroupTab shares userGroups isLoading showCanUpload? onShare onRevoke isSharing revokingGroupId />`, `<ShareUserTab shares groups isLoading myFlags onShare onRevoke isSharing revokingUserId showCanUpload? />` — both consumed only by Task 29 (`ShareModal`), which owns the actual API calls and injects them as callback props (keeps these two tabs pure/presentational, reusable for both files and folders without branching on entity kind internally).

**Design note (people picker, spec gap):** the API spec never says how a frontend is supposed to find a `target_user_id` to share with — there is no people-search endpoint available to a non-admin user (`GET /v1/user/prealluser` used by `getAllUsersPre` in `lib/api/user.ts` requires the admin-only `user.get.prealluser` permission per `permission.md` §1). This plan resolves that gap by reusing the app's existing group-membership APIs: the sharer first picks one of their own groups (`getUserGroups`, already used elsewhere in this codebase), then picks a member of that group (`getGroupMembers`, `lib/api/groups.ts:19`) as the share target. This needs no new backend endpoint and matches the org's existing group-centric people-lookup pattern (see `components/groups/GroupRolePickerModal.tsx` for a precedent of a similar two-step picker, if useful as a reference — not required reading).

- [ ] **Step 1: Extract `ShareGroupTab.tsx`**

Create `components/files/ShareGroupTab.tsx` with the group-share list/add/revoke UI currently inline in `FileDetailSheet.tsx` (`share.title`/`share.selectGroupPlaceholder`/`share.shareButton`/`share.sharedWith`/`share.noShares` — same i18n keys, no new ones needed here), generalized to accept props instead of calling the file-specific API functions directly:

```typescript
'use client';

import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';

export interface ShareGroupEntry {
  group_id: string;
  group_name: string;
}

export interface SelectableGroup {
  id: string;
  name: string;
}

export interface ShareGroupTabProps {
  shares: ShareGroupEntry[];
  userGroups: SelectableGroup[];
  isLoading: boolean;
  showCanUpload?: boolean;
  isSharing: boolean;
  revokingGroupId: string | null;
  onShare: (groupId: string, canUpload: boolean) => Promise<void>;
  onRevoke: (groupId: string) => Promise<void>;
}

export default function ShareGroupTab({ shares, userGroups, isLoading, showCanUpload, isSharing, revokingGroupId, onShare, onRevoke }: ShareGroupTabProps) {
  const t = useTranslations('files');
  const [selectedGroupId, setSelectedGroupId] = require('react').useState('');
  const [canUpload, setCanUpload] = require('react').useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="share-group-select" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('share.title')}
          </label>
          <select
            id="share-group-select"
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:border-border-focus"
            value={selectedGroupId}
            onChange={(event) => setSelectedGroupId(event.target.value)}
          >
            <option value="">{t('share.selectGroupPlaceholder')}</option>
            {userGroups.filter((group) => !shares.some((share) => share.group_id === group.id)).map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
        <Button type="button" variant="primary" loading={isSharing} disabled={!selectedGroupId} onClick={() => void onShare(selectedGroupId, canUpload).then(() => setSelectedGroupId(''))}>
          {t('share.shareButton')}
        </Button>
      </div>

      {showCanUpload && (
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Switch checked={canUpload} onCheckedChange={setCanUpload} />
          {t('share.canUpload')}
        </label>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{t('share.sharedWith')}</p>
        {isLoading ? (
          <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        ) : shares.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t('share.noShares')}</p>
        ) : (
          <ul className="space-y-2">
            {shares.map((share) => (
              <li key={share.group_id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{share.group_name}</span>
                <Button type="button" variant="ghost" size="sm" loading={revokingGroupId === share.group_id} onClick={() => void onRevoke(share.group_id)}>
                  {t('share.revokeButton')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

Replace the `require('react').useState` calls in the snippet above with a proper `import { useState } from 'react';` at the top before committing — written that way here only to keep this task's diff description self-contained without a separate import-line edit instruction; ship it with a real import.

Add one new i18n key: `messages/hu.json` under `files.share`: `"canUpload": "Feltöltés engedélyezése"` (mirror in `en.json`: "Allow uploads").

- [ ] **Step 2: Create `ShareUserTab.tsx`**

Create `components/files/ShareUserTab.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getUserGroups, getGroupMembers } from '@/lib/api/groups';
import { canGrantShareFlags, type ShareFlagSet } from '@/lib/permissions/filesGuard';
import Button from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';

export interface ShareUserEntry {
  user_id: string;
  user_name: string;
  can_view: boolean;
  can_download: boolean;
  can_upload?: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_share: boolean;
}

interface SelectableGroup { id: string; name: string; }
interface SelectableMember { id: string; name: string; }

export interface ShareUserTabProps {
  shares: ShareUserEntry[];
  isLoading: boolean;
  myFlags: ShareFlagSet;
  showCanUpload?: boolean;
  isSharing: boolean;
  revokingUserId: string | null;
  onShare: (targetUserId: string, flags: ShareFlagSet) => Promise<void>;
  onRevoke: (targetUserId: string) => Promise<void>;
}

const FLAG_KEYS: Array<keyof ShareFlagSet> = ['can_view', 'can_download', 'can_upload', 'can_edit', 'can_delete', 'can_share'];

function readMembers(payload: unknown): SelectableMember[] {
  const source = payload && typeof payload === 'object' && 'data' in (payload as object) ? (payload as {data: unknown}).data : payload;
  const array = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? ['group_users', 'members', 'items', 'rows', 'result'].map((key) => (source as Record<string, unknown>)[key]).find(Array.isArray)
      : null;
  if (!Array.isArray(array)) return [];
  return array
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = String(row.user_id ?? row.id ?? '').trim();
      if (!id) return null;
      return { id, name: String(row.username ?? row.user_name ?? row.name ?? id) };
    })
    .filter((v): v is SelectableMember => v !== null);
}

export default function ShareUserTab({ shares, isLoading, myFlags, showCanUpload, isSharing, revokingUserId, onShare, onRevoke }: ShareUserTabProps) {
  const t = useTranslations('files');
  const [groups, setGroups] = useState<SelectableGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [members, setMembers] = useState<SelectableMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [flags, setFlags] = useState<ShareFlagSet>({ can_view: true, can_download: true });

  useEffect(() => {
    getUserGroups().then((response) => {
      const source = (response as {data?: unknown}).data ?? response;
      const array = source && typeof source === 'object' ? (['group_users', 'groups', 'items', 'result'].map((k) => (source as Record<string, unknown>)[k]).find(Array.isArray) as unknown[] | undefined) : undefined;
      setGroups((array ?? []).map((item) => {
        const row = item as Record<string, unknown>;
        return { id: String(row.group_id ?? row.id ?? ''), name: String(row.group_name ?? row.name ?? '') };
      }).filter((g) => g.id));
    }).catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    setSelectedUserId('');
    if (!selectedGroupId) {
      setMembers([]);
      return;
    }
    getGroupMembers(selectedGroupId).then((response) => setMembers(readMembers(response))).catch(() => setMembers([]));
  }, [selectedGroupId]);

  const alreadySharedIds = new Set(shares.map((s) => s.user_id));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]">
          <option value="">{t('share.user.selectGroupPlaceholder')}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} disabled={!selectedGroupId} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50">
          <option value="">{t('share.user.selectUserPlaceholder')}</option>
          {members.filter((m) => !alreadySharedIds.has(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-3">
        {FLAG_KEYS.filter((key) => key !== 'can_upload' || showCanUpload).map((key) => {
          const disabled = !canGrantShareFlags(myFlags, { [key]: true });
          return (
            <label key={key} className={`flex items-center gap-1.5 text-xs ${disabled ? 'opacity-40' : 'text-[var(--text-secondary)]'}`} title={disabled ? t('share.user.cannotGrant') : undefined}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={flags[key] === true}
                onChange={(e) => setFlags((current) => ({ ...current, [key]: e.target.checked }))}
              />
              {t(`share.user.flags.${key}` as never)}
            </label>
          );
        })}
      </div>

      <Button
        type="button"
        variant="primary"
        loading={isSharing}
        disabled={!selectedUserId}
        onClick={() => void onShare(selectedUserId, flags).then(() => { setSelectedUserId(''); setFlags({ can_view: true, can_download: true }); })}
      >
        {t('share.shareButton')}
      </Button>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{t('share.sharedWith')}</p>
        {isLoading ? (
          <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        ) : shares.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t('share.noShares')}</p>
        ) : (
          <ul className="space-y-2">
            {shares.map((share) => (
              <li key={share.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{share.user_name}</span>
                <Button type="button" variant="ghost" size="sm" loading={revokingUserId === share.user_id} onClick={() => void onRevoke(share.user_id)}>
                  {t('share.revokeButton')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add i18n keys**

`messages/hu.json` under `files.share`: `"user": {"selectGroupPlaceholder": "Válassz csoportot", "selectUserPlaceholder": "Válassz tagot", "cannotGrant": "Ehhez neked is szükséged lenne erre a jogkörre", "flags": {"can_view": "Megtekintés", "can_download": "Letöltés", "can_upload": "Feltöltés", "can_edit": "Szerkesztés", "can_delete": "Törlés", "can_share": "Megosztás"}}` (mirror in `en.json`).

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit` — expect `FileDetailSheet.tsx` still compiles (it isn't rewired to use these yet; that's Task 31).

```bash
git add components/files/ShareGroupTab.tsx components/files/ShareUserTab.tsx messages/hu.json messages/en.json
git commit -m "feat(files): extract reusable ShareGroupTab, add ShareUserTab with group->member people picker"
```

### Task 28: Create `SharePublicLinkTab.tsx`

**Files:**
- Create: `components/files/SharePublicLinkTab.tsx`

**Interfaces:**
- Consumes: `createShareLink`/`revokeShareLink`/`listShareLinks` (Task 3).
- Produces: `<SharePublicLinkTab fileId />` (self-contained — owns its own API calls, unlike the two share tabs above, because public links are files-only so there's no folder-variant to keep it generic against) — consumed by Task 29 (`ShareModal`, files only).

- [ ] **Step 1: Implement**

Per spec §7: the full token is shown **only once**, at creation; list rows never expose it again.

Create `components/files/SharePublicLinkTab.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import {
  createShareLink,
  revokeShareLink,
  listShareLinks,
  type ShareLinkEntry,
  type ShareLinkPermission,
} from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { formatUploadedAt } from '@/lib/utils/formatFiles';
import Button from '@/components/ui/Button';

export interface SharePublicLinkTabProps {
  fileId: string;
}

export default function SharePublicLinkTab({ fileId }: SharePublicLinkTabProps) {
  const t = useTranslations('files');
  const [links, setLinks] = useState<ShareLinkEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<ShareLinkPermission>('download');
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ url: string } | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    listShareLinks(fileId)
      .then((response) => setLinks(response.data.links))
      .catch((error) => toast.error(translateFileApiError(t, error, 'errors.default')))
      .finally(() => setIsLoading(false));
  }, [fileId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const response = await createShareLink(
        fileId,
        permission,
        expiresAt ? new Date(expiresAt).toISOString() : null,
        password || null
      );
      const url = `${window.location.origin}/shared/${response.data.token}`;
      setJustCreated({ url });
      setPassword('');
      setExpiresAt('');
      load();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    setRevokingId(linkId);
    try {
      await revokeShareLink(linkId);
      toast.success(t('share.link.revokeSuccess'));
      load();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('share.link.copied'));
    } catch {
      toast.error(t('share.link.copyFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {justCreated && (
        <div className="rounded-lg border border-[var(--accent)] bg-[var(--accent-subtle)] p-3 text-sm">
          <p className="mb-2 font-medium text-[var(--text-primary)]">{t('share.link.oneTimeWarning')}</p>
          <div className="flex items-center gap-2">
            <input readOnly value={justCreated.url} className="flex-1 truncate rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs" />
            <Button type="button" size="sm" variant="secondary" onClick={() => void copyToClipboard(justCreated.url)}>
              <Copy size={14} strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3">
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="link-permission" checked={permission === 'view'} onChange={() => setPermission('view')} />
            {t('share.link.permissionView')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="link-permission" checked={permission === 'download'} onChange={() => setPermission('download')} />
            {t('share.link.permissionDownload')}
          </label>
        </div>
        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm" placeholder={t('share.link.expiresAt')} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('share.link.passwordOptional')} className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm" />
        <Button type="button" variant="primary" loading={isCreating} onClick={() => void handleCreate()}>{t('share.link.create')}</Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{t('share.link.existing')}</p>
        {isLoading ? (
          <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        ) : links.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t('share.link.none')}</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.link_id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-[var(--text-primary)]">
                    {link.permission === 'download' ? t('share.link.permissionDownload') : t('share.link.permissionView')}
                    {link.has_password && ` · ${t('share.link.passwordProtected')}`}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {t('share.link.accessCount', { count: link.access_count })}
                    {link.last_accessed_at && ` · ${formatUploadedAt(link.last_accessed_at)}`}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" loading={revokingId === link.link_id} onClick={() => void handleRevoke(link.link_id)}>
                  {t('share.revokeButton')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add i18n keys**

`messages/hu.json` under `files.share`: `"link": {"oneTimeWarning": "Ez a link csak most jelenik meg — mentsd el, mert később nem kérhető vissza.", "copied": "Vágólapra másolva.", "copyFailed": "Nem sikerült másolni.", "permissionView": "Megtekintés", "permissionDownload": "Letöltés", "expiresAt": "Lejárat (opcionális)", "passwordOptional": "Jelszó (opcionális)", "create": "Link létrehozása", "existing": "Meglévő linkek", "none": "Nincs publikus link.", "passwordProtected": "jelszóval védett", "accessCount": "{count}x megnyitva", "revokeSuccess": "A link visszavonva."}` (mirror in `en.json`).

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit`

```bash
git add components/files/SharePublicLinkTab.tsx messages/hu.json messages/en.json
git commit -m "feat(files): add public share-link tab (create/reveal-once/list/revoke)"
```

### Task 29: Create `ShareModal.tsx`

**Files:**
- Create: `components/files/ShareModal.tsx`

**Interfaces:**
- Consumes: `ShareGroupTab` (Task 27), `ShareUserTab` (Task 27), `SharePublicLinkTab` (Task 28), all the `share*`/`listUserShares`/`listGroupShares` functions from `lib/api/files.ts`/`lib/api/folders.ts`.
- Produces: `<ShareModal open kind={'file'|'folder'} entityId isOwner onClose />` — consumed by Task 31 (`FileDetailSheet`), Task 32 (`FolderDetailSheet`), and this task also wires a "Share" kebab item into `FilesFeed.tsx`'s `buildActionItems` (Task 18) and `BulkActionBar` (Task 19, bulk group-share only, per spec §3.3).

- [ ] **Step 1: Implement**

Create `components/files/ShareModal.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import { Link2, Share2, Users } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import {
  listGroupShares, shareWithGroup, revokeGroupShare,
  listUserShares, shareWithUser, revokeUserShare,
} from '@/lib/api/files';
import {
  listFolderGroupShares, shareFolderWithGroup, revokeFolderGroupShare,
  listFolderUserShares, shareFolderWithUser, revokeFolderUserShare,
} from '@/lib/api/folders';
import { getUserGroups } from '@/lib/api/groups';
import { translateFileApiError } from '@/lib/i18n/files';
import { translateFolderApiError } from '@/lib/i18n/folders';
import type { ShareFlagSet } from '@/lib/permissions/filesGuard';
import ShareGroupTab from './ShareGroupTab';
import ShareUserTab from './ShareUserTab';
import SharePublicLinkTab from './SharePublicLinkTab';

export interface ShareModalProps {
  open: boolean;
  kind: 'file' | 'folder';
  entityId: string;
  isOwner: boolean;
  onClose: () => void;
}

export default function ShareModal({ open, kind, entityId, isOwner, onClose }: ShareModalProps) {
  const t = useTranslations('files');
  const tf = useTranslations('folders');
  const [activeTab, setActiveTab] = useState('users');

  const [groupShares, setGroupShares] = useState<Array<{ group_id: string; group_name: string }>>([]);
  const [userShares, setUserShares] = useState<Array<{ user_id: string; user_name: string; can_view: boolean; can_download: boolean; can_upload?: boolean; can_edit: boolean; can_delete: boolean; can_share: boolean }>>([]);
  const [userGroups, setUserGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [revokingGroupId, setRevokingGroupId] = useState<string | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  const translateError = useCallback((error: unknown) => (kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default')), [kind, t, tf]);

  const loadShares = useCallback(async () => {
    if (!open) return;
    setIsLoadingShares(true);
    try {
      const [groupResponse, userResponse, groupsResponse] = await Promise.all([
        kind === 'file' ? listGroupShares(entityId) : listFolderGroupShares(entityId),
        kind === 'file' ? listUserShares(entityId) : listFolderUserShares(entityId),
        getUserGroups(),
      ]);
      setGroupShares(groupResponse.data.groups);
      setUserShares(userResponse.data.users);
      const source = (groupsResponse as {data?: unknown}).data ?? groupsResponse;
      const array = source && typeof source === 'object' ? (['group_users', 'groups', 'items', 'result'].map((k) => (source as Record<string, unknown>)[k]).find(Array.isArray) as unknown[] | undefined) : undefined;
      setUserGroups((array ?? []).map((item) => {
        const row = item as Record<string, unknown>;
        return { id: String(row.group_id ?? row.id ?? ''), name: String(row.group_name ?? row.name ?? '') };
      }).filter((g) => g.id));
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setIsLoadingShares(false);
    }
  }, [open, kind, entityId, translateError]);

  useEffect(() => {
    void loadShares();
  }, [loadShares]);

  const myFlags: ShareFlagSet = isOwner
    ? { can_view: true, can_download: true, can_upload: true, can_edit: true, can_delete: true, can_share: true }
    : { can_view: true, can_download: true };

  const handleShareGroup = async (groupId: string, canUpload: boolean) => {
    setIsSharing(true);
    try {
      if (kind === 'file') await shareWithGroup(entityId, groupId);
      else await shareFolderWithGroup(entityId, groupId, { can_upload: canUpload });
      toast.success(t('toasts.shareSuccess'));
      await loadShares();
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeGroup = async (groupId: string) => {
    setRevokingGroupId(groupId);
    try {
      if (kind === 'file') await revokeGroupShare(entityId, groupId);
      else await revokeFolderGroupShare(entityId, groupId);
      toast.success(t('toasts.revokeSuccess'));
      await loadShares();
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setRevokingGroupId(null);
    }
  };

  const handleShareUser = async (targetUserId: string, flags: ShareFlagSet) => {
    setIsSharing(true);
    try {
      if (kind === 'file') await shareWithUser(entityId, targetUserId, flags);
      else await shareFolderWithUser(entityId, targetUserId, flags);
      toast.success(t('toasts.shareSuccess'));
      await loadShares();
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeUser = async (targetUserId: string) => {
    setRevokingUserId(targetUserId);
    try {
      if (kind === 'file') await revokeUserShare(entityId, targetUserId);
      else await revokeFolderUserShare(entityId, targetUserId);
      toast.success(t('toasts.revokeSuccess'));
      await loadShares();
    } catch (error) {
      toast.error(translateError(error));
    } finally {
      setRevokingUserId(null);
    }
  };

  return (
    <Modal open={open} title={kind === 'file' ? t('share.modalTitle') : tf('share.modalTitle')} onClose={onClose}>
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="mb-4 flex border-b border-[var(--border-subtle)]">
          {[
            { value: 'users', label: t('share.tabs.users'), icon: Share2 },
            { value: 'groups', label: t('share.tabs.groups'), icon: Users },
            ...(kind === 'file' ? [{ value: 'link', label: t('share.tabs.link'), icon: Link2 }] : []),
          ].map(({ value, label, icon: Icon }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className={clsx(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all',
                activeTab === value ? 'border-orange-500 text-orange-500' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              )}
            >
              <Icon size={16} /> {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="users">
          <ShareUserTab
            shares={userShares}
            isLoading={isLoadingShares}
            myFlags={myFlags}
            showCanUpload={kind === 'folder'}
            isSharing={isSharing}
            revokingUserId={revokingUserId}
            onShare={handleShareUser}
            onRevoke={handleRevokeUser}
          />
        </Tabs.Content>

        <Tabs.Content value="groups">
          <ShareGroupTab
            shares={groupShares}
            userGroups={userGroups}
            isLoading={isLoadingShares}
            showCanUpload={kind === 'folder'}
            isSharing={isSharing}
            revokingGroupId={revokingGroupId}
            onShare={handleShareGroup}
            onRevoke={handleRevokeGroup}
          />
        </Tabs.Content>

        {kind === 'file' && (
          <Tabs.Content value="link">
            <SharePublicLinkTab fileId={entityId} />
          </Tabs.Content>
        )}
      </Tabs.Root>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire "Share" into `FilesFeed.tsx`'s `buildActionItems`**

In `components/files/FilesFeed.tsx`, add `const [shareTarget, setShareTarget] = useState<FsEntry | null>(null);`, insert into `buildActionItems` (after `'rename'`, before `'star'`):

```typescript
{
  key: 'share',
  label: t('share.modalTitle'),
  icon: <Share2 size={16} strokeWidth={1.75} />,
  onSelect: () => setShareTarget(entry),
},
```

(add `Share2` to the existing `lucide-react` import). Render near the other modals:

```typescript
<ShareModal
  open={shareTarget !== null}
  kind={shareTarget?.kind ?? 'file'}
  entityId={shareTarget?.id ?? ''}
  isOwner={shareTarget?.is_owner ?? false}
  onClose={() => setShareTarget(null)}
/>
```

Add `import ShareModal from '@/components/files/ShareModal';`.

- [ ] **Step 3: Wire bulk group-share into `BulkActionBar`/`FilesFeed`**

Per spec §3.3 ("Csoportos megosztás — csak fájlokra, max. 100 elem"): add a "Share selected" button to `components/files/BulkActionBar.tsx` (new prop `onShareAll: () => void`, rendered only when `count <= 100` — beyond that, per spec, either warn or chunk the call; this task chooses to disable the button and show a tooltip/title `t('bulk.tooManyForShare')` rather than silently chunking, since `bulkShareWithGroup`'s own 1–100 cap is a hard backend validation, not a soft UX suggestion). In `FilesFeed.tsx`, add a small group-picker inline flow: reuse `ShareModal`'s group list by adding a minimal `<select>` + `bulkShareWithGroup(fileIds, groupId)` call directly in `FilesFeed` (do not reuse the full `ShareModal` component here — it's file-detail-oriented with tabs that don't fit a lightweight bulk action). Show the `succeeded`/`failed` summary via `toast` exactly as spec §3.3 requires: `t('bulk.shareSummary', {succeeded: response.data.succeeded.length, total: fileIds.length})`, and if `failed.length > 0` a second toast listing up to 3 reasons: `t('bulk.shareFailedDetail', {items: response.data.failed.slice(0,3).map(f => f.reason).join(', ')})`.

- [ ] **Step 4: Add i18n keys**

`messages/hu.json` under `files`: `"share": {"modalTitle": "Megosztás", "tabs": {"users": "Emberek", "groups": "Csoportok", "link": "Publikus link"}}`, and under `files.bulk`: `"share": "Megosztás csoporttal", "tooManyForShare": "Egyszerre legfeljebb 100 elem osztható meg.", "shareSummary": "{succeeded}/{total} fájl megosztva.", "shareFailedDetail": "Sikertelen elemek: {items}"`. `messages/hu.json` under `folders`: `"share": {"modalTitle": "Mappa megosztása"}`. Mirror all of the above in `en.json`.

- [ ] **Step 5: Verify and commit**

`npx tsc --noEmit`. Manual check: open Share on a file, add a user via the group→member picker, confirm it appears in the list and can be revoked; owner sees all flag checkboxes enabled, a non-owner test account (if available) sees escalation-blocked checkboxes disabled with the tooltip.

```bash
git add components/files/ShareModal.tsx components/files/FilesFeed.tsx components/files/BulkActionBar.tsx messages/hu.json messages/en.json
git commit -m "feat(files): add ShareModal (users/groups/public-link tabs) and wire single + bulk share"
```

### Task 30: Create `MoveToFolderDialog.tsx`, wire Move/Copy

**Files:**
- Create: `components/files/MoveToFolderDialog.tsx`
- Modify: `components/files/FilesFeed.tsx` (wire Move + Copy into `buildActionItems`)
- Modify: `components/files/BulkActionBar.tsx` + `FilesFeed.tsx` (wire bulk Move)

**Interfaces:**
- Consumes: `listFolder` (Task 4), `moveFile`/`copyFile` (Task 1), `moveFolder` (Task 4).
- Produces: `<MoveToFolderDialog open mode={'move'|'copy'} scope groupId? excludeFolderId? onSelect onClose />` — consumed by `FilesFeed.tsx` only.

- [ ] **Step 1: Implement**

Per spec §5.2: client-side, disallow navigating into the folder being moved (best-effort UX; the server is authoritative on the actual cycle check).

Create `components/files/MoveToFolderDialog.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Folder } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { listFolder, type FolderListEntry } from '@/lib/api/folders';
import { translateFolderApiError } from '@/lib/i18n/folders';
import type { FileScope } from '@/lib/api/files';

export interface MoveToFolderDialogProps {
  open: boolean;
  title: string;
  scope: FileScope;
  groupId?: string;
  /** The folder being moved (if a folder) — its own subtree is skipped client-side. */
  excludeFolderId?: string | null;
  onSelect: (targetFolderId: string | null) => Promise<void>;
  onClose: () => void;
}

export default function MoveToFolderDialog({ open, title, scope, groupId, excludeFolderId, onSelect, onClose }: MoveToFolderDialogProps) {
  const t = useTranslations('files');
  const tf = useTranslations('folders');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [subfolders, setSubfolders] = useState<FolderListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentFolderId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    listFolder({ folder_id: currentFolderId, scope, group_id: scope === 'group' ? groupId : undefined, limit: 100 })
      .then((response) => setSubfolders(response.data.subfolders.filter((f) => f.id !== excludeFolderId)))
      .catch((error) => toast.error(translateFolderApiError(tf, error, 'errors.default')))
      .finally(() => setIsLoading(false));
  }, [open, currentFolderId, scope, groupId, excludeFolderId, tf]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onSelect(currentFolderId);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={() => (isSubmitting ? undefined : onClose())}>
      <div className="space-y-3">
        <p className="text-xs text-[var(--text-tertiary)]">{tf('moveDialog.currentLabel', { name: currentFolderId ?? tf('moveDialog.root') })}</p>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--border-subtle)] p-2">
          {currentFolderId !== null && (
            <button type="button" onClick={() => setCurrentFolderId(null)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
              .. {tf('moveDialog.up')}
            </button>
          )}
          {isLoading ? (
            <div className="h-8 w-full animate-pulse rounded bg-[var(--bg-elevated)]" />
          ) : subfolders.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-[var(--text-tertiary)]">{tf('moveDialog.noSubfolders')}</p>
          ) : (
            subfolders.map((folder) => (
              <button key={folder.id} type="button" onClick={() => setCurrentFolderId(folder.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
                <Folder size={16} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
                {folder.name}
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>{t('upload.cancel')}</Button>
          <Button type="button" variant="primary" loading={isSubmitting} onClick={() => void handleConfirm()}>{tf('moveDialog.confirm')}</Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire single-item Move + Copy into `FilesFeed.tsx`**

Add state `const [moveTarget, setMoveTarget] = useState<{ entry: FsEntry; mode: 'move' | 'copy' } | null>(null);`. Insert into `buildActionItems` (after `'share'`, before `'star'`):

```typescript
{
  key: 'move',
  label: t('table.move'),
  icon: <FolderInput size={16} strokeWidth={1.75} />,
  onSelect: () => setMoveTarget({ entry, mode: 'move' }),
  hidden: isForbidden(scope, 'edit', entry.id),
},
...(entry.kind === 'file'
  ? [{
      key: 'copy',
      label: t('table.copy'),
      icon: <Copy size={16} strokeWidth={1.75} />,
      onSelect: () => setMoveTarget({ entry, mode: 'copy' }),
    }]
  : []),
```

(add `FolderInput, Copy` to the `lucide-react` import). Render:

```typescript
<MoveToFolderDialog
  open={moveTarget !== null}
  title={moveTarget?.mode === 'copy' ? t('table.copy') : t('table.move')}
  scope={mode}
  groupId={groupId}
  excludeFolderId={moveTarget?.entry.kind === 'folder' ? moveTarget.entry.id : null}
  onSelect={async (targetFolderId) => {
    if (!moveTarget) return;
    try {
      if (moveTarget.entry.kind === 'file') {
        if (moveTarget.mode === 'copy') await copyFile(moveTarget.entry.id, targetFolderId);
        else await moveFile(moveTarget.entry.id, targetFolderId);
      } else {
        await moveFolder(moveTarget.entry.id, targetFolderId);
      }
      toast.success(t('toasts.moveSuccess'));
      refetch();
    } catch (error) {
      toast.error(moveTarget.entry.kind === 'file' ? translateFileApiError(t, error, 'errors.default') : translateFolderApiError(tf, error, 'errors.default'));
      throw error;
    }
  }}
  onClose={() => setMoveTarget(null)}
/>
```

Add `import MoveToFolderDialog from '@/components/files/MoveToFolderDialog';` and extend the existing `moveFile`/`copyFile`/`moveFolder` imports from `lib/api/files`/`lib/api/folders` at the top of `FilesFeed.tsx`.

- [ ] **Step 3: Wire bulk Move**

Add an `onMoveAll` prop + button to `BulkActionBar.tsx` (same pattern as `onDownloadAll`/`onDeleteAll`), and in `FilesFeed.tsx` open `MoveToFolderDialog` with a target of "all selected entries" (loop `moveFile`/`moveFolder` per selected entry inside the `onSelect` callback, same `succeeded`/`total` toast pattern as `handleBulkDelete` in Task 19).

- [ ] **Step 4: Add i18n keys**

`messages/hu.json` under `files.table`: `"move": "Áthelyezés", "copy": "Másolás"`; under `files.toasts`: `"moveSuccess": "Áthelyezve."`; under `folders`: `"moveDialog": {"currentLabel": "Aktuális mappa: {name}", "root": "Gyökér", "up": "Fel", "noSubfolders": "Nincs almappa itt.", "confirm": "Ide helyezés"}`. Mirror in `en.json`.

- [ ] **Step 5: Verify and commit**

`npx tsc --noEmit`. Manual check: move a file into a subfolder, confirm it disappears from the current listing and appears when navigating into that subfolder; attempt to move a folder into its own child — confirm the dialog doesn't even offer that path (client-side `excludeFolderId` filtering) and, if forced via a stale UI state, the backend's `409` surfaces via the raw-detail error mapper (Task 7).

```bash
git add components/files/MoveToFolderDialog.tsx components/files/FilesFeed.tsx components/files/BulkActionBar.tsx messages/hu.json messages/en.json
git commit -m "feat(files): add move/copy-to-folder dialog, wire single-item and bulk move"
```

## Phase G — Detail sheets finished, public share-link landing page

### Task 31: Refactor `FileDetailSheet.tsx` — use `ShareModal`, add star/rename/preview

**Files:**
- Modify: `components/files/FileDetailSheet.tsx` (full rewrite; keep the exported `FileDetailSheetProps` shape, add one optional field)

**Interfaces:**
- Consumes: `ShareModal` (Task 29), `NameDialog` (Task 17), `starFile`/`unstarFile`/`renameFile` (Tasks 1/2).
- Produces: `FileDetailSheetProps` gains `onChanged?: () => void` (called after rename/star succeed, in addition to the existing `onDeleted`) and `onPreview?: (fileId: string) => void` (optional — lets a caller like `FilesFeed` reopen `PreviewModal` from here; `StarredView`/`SharedWithMeView` simply omit it and the button doesn't render).

- [ ] **Step 1: Rewrite**

Replace `components/files/FileDetailSheet.tsx` content. This removes the inline group-share block (previously `FileDetailSheet.tsx:334-397`) in favor of a "Share" button opening `ShareModal`, drops the `share` tab (now 2 tabs: metadata/audit), and adds star toggle + rename + an optional preview shortcut:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import { Eye, FileText, History, Pencil, Share2, Star } from 'lucide-react';
import SideSheet from '@/components/ui/SideSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import {
  getFileMetadata,
  requestDownload,
  buildDownloadUrl,
  deleteFile,
  renameFile,
  starFile,
  unstarFile,
  getAuditLog,
  type FileMetadataResponse,
  type FileAuditLogEntry,
} from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { formatFileSize, formatMimeType, formatUploadedAt } from '@/lib/utils/formatFiles';
import NameDialog from './NameDialog';
import ShareModal from './ShareModal';

const AUDIT_PAGE_SIZE = 20;

export interface FileDetailSheetProps {
  fileId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
  onChanged?: () => void;
  onPreview?: (fileId: string) => void;
}

const DOWNLOAD_DEBOUNCE_MS = 2000;

export default function FileDetailSheet({ fileId, onClose, onDeleted, onChanged, onPreview }: FileDetailSheetProps) {
  const t = useTranslations('files');

  const [activeTab, setActiveTab] = useState('metadata');
  const [metadata, setMetadata] = useState<FileMetadataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  const [auditItems, setAuditItems] = useState<FileAuditLogEntry[]>([]);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const loadMetadata = useCallback(async () => {
    if (fileId === null) return;
    setIsLoading(true);
    try {
      const response = await getFileMetadata(fileId);
      setMetadata(response.data);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsLoading(false);
    }
  }, [fileId, t]);

  useEffect(() => {
    if (fileId === null) {
      setMetadata(null);
      setActiveTab('metadata');
      setAuditItems([]);
      setAuditOffset(0);
      setAuditTotal(0);
      return;
    }
    void loadMetadata();
  }, [fileId, loadMetadata]);

  const loadAudit = useCallback(
    async (nextOffset: number) => {
      if (fileId === null) return;
      setIsAuditLoading(true);
      try {
        const response = await getAuditLog(fileId, nextOffset, AUDIT_PAGE_SIZE);
        setAuditItems((current) => (nextOffset === 0 ? response.data.items : [...current, ...response.data.items]));
        setAuditTotal(response.data.total);
        setAuditOffset(nextOffset);
      } catch (error) {
        toast.error(translateFileApiError(t, error, 'errors.default'));
      } finally {
        setIsAuditLoading(false);
      }
    },
    [fileId, t]
  );

  useEffect(() => {
    if (fileId === null || activeTab !== 'audit') return;
    void loadAudit(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fileId]);

  const handleDownload = async () => {
    if (fileId === null || isRequesting) return;
    setIsRequesting(true);
    try {
      const response = await requestDownload(fileId);
      window.location.href = buildDownloadUrl(response.data.download_token);
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setTimeout(() => setIsRequesting(false), DOWNLOAD_DEBOUNCE_MS);
    }
  };

  const handleToggleStar = async () => {
    if (fileId === null || !metadata) return;
    try {
      if (metadata.is_starred) await unstarFile(fileId);
      else await starFile(fileId);
      await loadMetadata();
      onChanged?.();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    }
  };

  const handleRename = async (name: string) => {
    if (fileId === null) return;
    try {
      await renameFile(fileId, name);
      toast.success(t('toasts.renameSuccess'));
      await loadMetadata();
      onChanged?.();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (fileId === null) return;
    setIsDeleting(true);
    try {
      await deleteFile(fileId);
      toast.success(t('toasts.deleteSuccess'));
      setIsConfirmOpen(false);
      onClose();
      onDeleted?.();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SideSheet open={fileId !== null} title={t('detail.title')} onClose={onClose}>
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex h-full w-full flex-col">
          <Tabs.List className="mb-6 mt-[-10px] flex border-b border-[var(--border-subtle)]">
            <Tabs.Trigger value="metadata" className={clsx('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all', activeTab === 'metadata' ? 'border-orange-500 text-orange-500' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
              <FileText size={16} /> {t('detail.tabs.metadata')}
            </Tabs.Trigger>
            <Tabs.Trigger value="audit" className={clsx('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all', activeTab === 'audit' ? 'border-orange-500 text-orange-500' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
              <History size={16} /> {t('detail.tabs.audit')}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="metadata" className="flex flex-col gap-4 outline-none">
            {isLoading || !metadata ? (
              <div className="space-y-2">
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.name')}</dt>
                  <dd className="flex items-center gap-2 text-right font-medium text-[var(--text-primary)]">
                    {metadata.original_name}
                    <button type="button" onClick={() => setIsRenameOpen(true)} aria-label={t('table.rename')} className="rounded p-1 hover:bg-[var(--bg-hover)]">
                      <Pencil size={14} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
                    </button>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.type')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{formatMimeType(metadata.mime_type)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.size')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{formatFileSize(metadata.size_bytes)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.uploadedAt')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{formatUploadedAt(metadata.uploaded_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{t('detail.fields.scope')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{metadata.scope === 'group' ? t('detail.scopeValues.group') : t('detail.scopeValues.private')}</dd>
                </div>
              </dl>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="primary" onClick={handleDownload} disabled={fileId === null || isRequesting}>{t('detail.download')}</Button>
              {onPreview && metadata?.mime_type?.startsWith('image/') && (
                <Button type="button" variant="secondary" onClick={() => fileId && onPreview(fileId)}>
                  <Eye size={16} strokeWidth={1.75} className="mr-1.5" /> {t('preview.details')}
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setIsShareOpen(true)}>
                <Share2 size={16} strokeWidth={1.75} className="mr-1.5" /> {t('share.modalTitle')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleToggleStar()} disabled={!metadata}>
                <Star size={16} strokeWidth={1.75} className={clsx('mr-1.5', metadata?.is_starred && 'fill-[var(--accent)] text-[var(--accent)]')} />
                {metadata?.is_starred ? t('table.unstar') : t('table.star')}
              </Button>
              <Button type="button" variant="danger" onClick={() => setIsConfirmOpen(true)} disabled={fileId === null || isLoading}>{t('detail.delete')}</Button>
            </div>
          </Tabs.Content>

          <Tabs.Content value="audit" className="flex flex-col gap-4 outline-none">
            {isAuditLoading && auditItems.length === 0 ? (
              <div className="space-y-2">
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
              </div>
            ) : auditItems.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">{t('audit.emptyText')}</p>
            ) : (
              <ul className="space-y-2">
                {auditItems.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[var(--text-primary)]">
                        {t.has(`audit.action.${entry.action}` as any) ? t(`audit.action.${entry.action}` as any) : entry.action}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">{formatUploadedAt(entry.timestamp)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {auditItems.length < auditTotal && (
              <Button type="button" variant="secondary" size="sm" loading={isAuditLoading} onClick={() => loadAudit(auditOffset + AUDIT_PAGE_SIZE)}>{t('audit.loadMore')}</Button>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </SideSheet>

      <ConfirmDialog
        open={isConfirmOpen}
        title={t('detail.confirmDelete.title')}
        message={t('detail.confirmDelete.message')}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => { if (!isDeleting) void handleDeleteConfirm(); }}
      />

      <NameDialog
        open={isRenameOpen}
        title={t('rename.fileTitle')}
        label={t('rename.label')}
        initialValue={metadata?.original_name ?? ''}
        submitLabel={t('rename.submit')}
        onSubmit={handleRename}
        onClose={() => setIsRenameOpen(false)}
      />

      {fileId !== null && (
        <ShareModal open={isShareOpen} kind="file" entityId={fileId} isOwner={metadata?.is_owner ?? false} onClose={() => setIsShareOpen(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Add new audit action i18n keys**

Per spec §4.1, add the previously-missing action translations under `files.audit.action` in both `messages/hu.json`/`en.json`: `"rename": "Átnevezés", "move": "Áthelyezés", "copy": "Másolás", "share_user": "Megosztás felhasználóval", "revoke_share_user": "Felhasználó-megosztás visszavonása", "share_link_create": "Publikus link létrehozva", "share_link_revoke": "Publikus link visszavonva", "share_link_access": "Megnyitva publikus linken", "star": "Csillagozva", "unstar": "Csillag eltávolítva"` (the existing `upload/download/delete/restore/share_group/revoke_share_group` keys stay as-is).

- [ ] **Step 3: Wire `FilesFeed.tsx`'s `FileDetailSheet` call to pass the new props**

In `components/files/FilesFeed.tsx`, change the existing `<FileDetailSheet fileId={selectedFileId} onClose={...} onDeleted={...} />` call to also pass `onChanged={refetch}` and `onPreview={(id) => { setSelectedFileId(null); setPreviewFileId(id); }}`.

- [ ] **Step 4: Verify and commit**

`npx tsc --noEmit`. Manual check: open a file's details, rename it (confirm the sheet and the underlying list both reflect the new name), star/unstar (confirm the icon in the list updates after closing), Share opens the new tabbed modal.

```bash
git add components/files/FileDetailSheet.tsx components/files/FilesFeed.tsx messages/hu.json messages/en.json
git commit -m "refactor(files): FileDetailSheet drops inline share tab for ShareModal, adds star/rename/preview-shortcut"
```

### Task 32: Implement `FolderDetailSheet.tsx` (replaces Task 18's placeholder)

**Files:**
- Modify: `components/files/FolderDetailSheet.tsx` (replace the placeholder body from Task 18, Step 6)

**Interfaces:**
- Consumes: `getFolderMetadata`/`getFolderAuditLog`/`deleteFolder`/`renameFolder`/`starFolder`/`unstarFolder` (Task 4), `ShareModal` (Task 29), `NameDialog` (Task 17).
- Produces: keeps the exact prop shape from Task 18 (`folderId`, `onClose`, `onDeleted?`, `onRenamed?`) — no other task consumes anything new from this one.

- [ ] **Step 1: Implement**

Per spec §5.4/§9 — no download/preview tab (folders aren't downloadable as a unit per this API), metadata + share + audit, `can_upload` share flag shown (handled inside `ShareModal` already via `kind="folder"`).

Replace `components/files/FolderDetailSheet.tsx` content:

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';
import clsx from 'clsx';
import { FolderCog, History, Pencil, Share2, Star } from 'lucide-react';
import SideSheet from '@/components/ui/SideSheet';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import {
  getFolderMetadata,
  deleteFolder,
  renameFolder,
  starFolder,
  unstarFolder,
  getFolderAuditLog,
  type FolderMetadataResponse,
} from '@/lib/api/folders';
import { translateFolderApiError } from '@/lib/i18n/folders';
import { formatUploadedAt } from '@/lib/utils/formatFiles';
import NameDialog from './NameDialog';
import ShareModal from './ShareModal';

const AUDIT_PAGE_SIZE = 20;

export interface FolderDetailSheetProps {
  folderId: string | null;
  onClose: () => void;
  onDeleted?: () => void;
  onRenamed?: () => void;
}

interface AuditEntry {
  id: string;
  action: string;
  timestamp: string;
}

export default function FolderDetailSheet({ folderId, onClose, onDeleted, onRenamed }: FolderDetailSheetProps) {
  const tf = useTranslations('folders');
  const t = useTranslations('files');

  const [activeTab, setActiveTab] = useState('metadata');
  const [metadata, setMetadata] = useState<FolderMetadataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [auditItems, setAuditItems] = useState<AuditEntry[]>([]);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [isAuditLoading, setIsAuditLoading] = useState(false);

  const loadMetadata = useCallback(async () => {
    if (folderId === null) return;
    setIsLoading(true);
    try {
      const response = await getFolderMetadata(folderId);
      setMetadata(response.data);
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
    } finally {
      setIsLoading(false);
    }
  }, [folderId, tf]);

  useEffect(() => {
    if (folderId === null) {
      setMetadata(null);
      setActiveTab('metadata');
      setAuditItems([]);
      setAuditOffset(0);
      setAuditTotal(0);
      return;
    }
    void loadMetadata();
  }, [folderId, loadMetadata]);

  const loadAudit = useCallback(
    async (nextOffset: number) => {
      if (folderId === null) return;
      setIsAuditLoading(true);
      try {
        const response = await getFolderAuditLog(folderId, nextOffset, AUDIT_PAGE_SIZE);
        setAuditItems((current) => (nextOffset === 0 ? response.data.items : [...current, ...response.data.items]));
        setAuditTotal(response.data.total);
        setAuditOffset(nextOffset);
      } catch (error) {
        toast.error(translateFolderApiError(tf, error, 'errors.default'));
      } finally {
        setIsAuditLoading(false);
      }
    },
    [folderId, tf]
  );

  useEffect(() => {
    if (folderId === null || activeTab !== 'audit') return;
    void loadAudit(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, folderId]);

  const handleToggleStar = async () => {
    if (folderId === null || !metadata) return;
    try {
      if (metadata.is_starred) await unstarFolder(folderId);
      else await starFolder(folderId);
      await loadMetadata();
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
    }
  };

  const handleRename = async (name: string) => {
    if (folderId === null) return;
    try {
      await renameFolder(folderId, name);
      toast.success(tf('toasts.renameSuccess'));
      await loadMetadata();
      onRenamed?.();
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (folderId === null) return;
    setIsDeleting(true);
    try {
      await deleteFolder(folderId);
      toast.success(tf('toasts.deleteSuccess'));
      setIsConfirmOpen(false);
      onClose();
      onDeleted?.();
    } catch (error) {
      toast.error(translateFolderApiError(tf, error, 'errors.default'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SideSheet open={folderId !== null} title={tf('detail.title')} onClose={onClose}>
        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex h-full w-full flex-col">
          <Tabs.List className="mb-6 mt-[-10px] flex border-b border-[var(--border-subtle)]">
            <Tabs.Trigger value="metadata" className={clsx('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all', activeTab === 'metadata' ? 'border-orange-500 text-orange-500' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
              <FolderCog size={16} /> {tf('detail.tabs.metadata')}
            </Tabs.Trigger>
            <Tabs.Trigger value="audit" className={clsx('flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold outline-none transition-all', activeTab === 'audit' ? 'border-orange-500 text-orange-500' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]')}>
              <History size={16} /> {tf('detail.tabs.audit')}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="metadata" className="flex flex-col gap-4 outline-none">
            {isLoading || !metadata ? (
              <div className="space-y-2">
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{tf('detail.fields.name')}</dt>
                  <dd className="flex items-center gap-2 text-right font-medium text-[var(--text-primary)]">
                    {metadata.name}
                    <button type="button" onClick={() => setIsRenameOpen(true)} aria-label={t('table.rename')} className="rounded p-1 hover:bg-[var(--bg-hover)]">
                      <Pencil size={14} strokeWidth={1.75} className="text-[var(--text-tertiary)]" />
                    </button>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{tf('detail.fields.createdAt')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{formatUploadedAt(metadata.created_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">{tf('detail.fields.scope')}</dt>
                  <dd className="text-right font-medium text-[var(--text-primary)]">{metadata.scope === 'group' ? t('detail.scopeValues.group') : t('detail.scopeValues.private')}</dd>
                </div>
              </dl>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsShareOpen(true)}>
                <Share2 size={16} strokeWidth={1.75} className="mr-1.5" /> {t('share.modalTitle')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleToggleStar()} disabled={!metadata}>
                <Star size={16} strokeWidth={1.75} className={clsx('mr-1.5', metadata?.is_starred && 'fill-[var(--accent)] text-[var(--accent)]')} />
                {metadata?.is_starred ? t('table.unstar') : t('table.star')}
              </Button>
              <Button type="button" variant="danger" onClick={() => setIsConfirmOpen(true)} disabled={folderId === null || isLoading}>{t('detail.delete')}</Button>
            </div>
          </Tabs.Content>

          <Tabs.Content value="audit" className="flex flex-col gap-4 outline-none">
            {isAuditLoading && auditItems.length === 0 ? (
              <div className="space-y-2">
                <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
              </div>
            ) : auditItems.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)]">{t('audit.emptyText')}</p>
            ) : (
              <ul className="space-y-2">
                {auditItems.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[var(--text-primary)]">
                        {tf.has(`audit.action.${entry.action}` as any) ? tf(`audit.action.${entry.action}` as any) : entry.action}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)]">{formatUploadedAt(entry.timestamp)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {auditItems.length < auditTotal && (
              <Button type="button" variant="secondary" size="sm" loading={isAuditLoading} onClick={() => loadAudit(auditOffset + AUDIT_PAGE_SIZE)}>{t('audit.loadMore')}</Button>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </SideSheet>

      <ConfirmDialog
        open={isConfirmOpen}
        title={tf('confirmDelete.title')}
        message={tf('confirmDelete.message')}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => { if (!isDeleting) void handleDeleteConfirm(); }}
      />

      <NameDialog open={isRenameOpen} title={tf('rename.title')} label={tf('rename.label')} initialValue={metadata?.name ?? ''} submitLabel={t('rename.submit')} onSubmit={handleRename} onClose={() => setIsRenameOpen(false)} />

      {folderId !== null && (
        <ShareModal open={isShareOpen} kind="folder" entityId={folderId} isOwner={metadata?.is_owner ?? false} onClose={() => setIsShareOpen(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Add i18n keys**

`messages/hu.json` under `folders`: `"detail": {"title": "Mappa részletei", "tabs": {"metadata": "Adatok", "audit": "Napló"}, "fields": {"name": "Név", "createdAt": "Létrehozva", "scope": "Hatókör"}}, "audit": {"action": {"folder_create": "Létrehozva", "folder_rename": "Átnevezés", "folder_move": "Áthelyezés", "folder_delete": "Törlés", "folder_restore": "Visszaállítás", "folder_permanent_delete": "Végleges törlés", "folder_share_user": "Megosztás felhasználóval", "folder_revoke_share_user": "Felhasználó-megosztás visszavonása", "folder_share_group": "Megosztás csoporttal", "folder_revoke_share_group": "Csoportmegosztás visszavonása", "folder_star": "Csillagozva", "folder_unstar": "Csillag eltávolítva"}}` (mirror in `en.json`).

- [ ] **Step 3: Verify and commit**

`npx tsc --noEmit`. Manual check: open a folder's details from its kebab menu ("Details" — note: Task 18's `buildActionItems` doesn't currently have a "details" entry for folders the way Task 26 added one for files; add one now, mirroring Task 26's file "details" item, calling `setSelectedFolderDetailId(entry.id)` for `entry.kind === 'folder'`), confirm metadata/share/audit tabs work, rename propagates to the list via `onRenamed`.

```bash
git add components/files/FolderDetailSheet.tsx components/files/FilesFeed.tsx messages/hu.json messages/en.json
git commit -m "feat(files): implement FolderDetailSheet (metadata/share/audit, rename/star/delete)"
```

### Task 33: Public share-link landing page

**Files:**
- Create: `app/api/files/shared/[token]/route.ts`
- Create: `app/[locale]/shared/[token]/page.tsx`

**Interfaces:**
- Consumes: none from earlier tasks (this is a standalone public surface).
- Produces: nothing consumed elsewhere in this plan.

**Design note (spec §7):** the backend's `GET /v1/files/shared/{token}` takes an optional `X-Share-Password` **header** and returns either a `302` redirect or a **uniform** `404 Link is no longer valid.` for every failure mode (wrong password, expired, revoked, nonexistent) — deliberately, to avoid leaking which case applies. Two consequences drive this task's design: (1) since the password must be a header, not a query param, and the initial page load is a plain browser navigation that can't set custom headers, redemption has to go through **our own server route** via a POST from a small client form, not a direct link to the backend; (2) since the backend never tells the frontend "this link needs a password," the UI cannot know in advance whether to show a password field — it always shows one (optional), and shows the same generic error on any failure, exactly matching the backend's own intentional ambiguity.

- [ ] **Step 1: Server route (public, no auth cookie needed)**

Create `app/api/files/shared/[token]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fetchUpstreamBinary } from '@/lib/server/rawBinaryProxy';

export async function POST(request: NextRequest, context: {params: Promise<{token: string}>}) {
  const apiBase = process.env.WORF_API_URL;
  if (!apiBase) {
    return NextResponse.json({detail: 'WORF_API_URL is not configured'}, {status: 500});
  }

  const {token} = await context.params;
  const body = (await request.json().catch(() => ({}))) as {password?: string};

  const targetUrl = new URL(`/v1/files/shared/${encodeURIComponent(token)}`, apiBase.endsWith('/') ? apiBase : `${apiBase}/`);
  const forwardedFor = request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip') ?? '127.0.0.1';

  // fetchUpstreamBinary issues a plain GET — the backend endpoint itself is a
  // GET that reads the optional password from a header, matching spec §7.
  // We only add the X-Share-Password header when present, keeping the
  // password out of any URL/query string on both legs of this request.
  const response = await fetchUpstreamBinaryWithRedirectCapture(targetUrl, {
    'x-forwarded-for': forwardedFor,
    ...(body.password ? {'X-Share-Password': body.password} : {}),
  });

  if (response.status >= 300 && response.status < 400 && response.location) {
    return NextResponse.json({ redirectUrl: response.location });
  }

  return NextResponse.json({detail: 'Link is no longer valid.'}, {status: 404});
}

// fetchUpstreamBinary (Task 10) doesn't surface redirect Location headers —
// it's built for 200/202 binary/JSON bodies. This route needs the Location
// header instead of a body, so it uses a small local variant rather than
// changing fetchUpstreamBinary's contract (which Tasks 10/33's thumbnail
// and preview routes both already depend on as-is).
import {request as httpRequest} from 'node:http';
import {request as httpsRequest} from 'node:https';

function fetchUpstreamBinaryWithRedirectCapture(url: URL, headers: Record<string, string>): Promise<{status: number; location?: string}> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = client({protocol: url.protocol, hostname: url.hostname, port: url.port, path: `${url.pathname}${url.search}`, method: 'GET', headers}, (res) => {
      res.resume(); // discard body, we only need status + location
      res.on('end', () => resolve({status: res.statusCode ?? 500, location: res.headers.location}));
    });
    req.on('error', reject);
    req.end();
  });
}
```

Move the inline `fetchUpstreamBinaryWithRedirectCapture` helper and its two `node:http`/`node:https` imports to the top of the file before committing (placed inline above only to show it next to its one call site in this plan's prose).

- [ ] **Step 2: Public landing page**

Create `app/[locale]/shared/[token]/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';

export default function SharedLinkPage() {
  const t = useTranslations('sharedLink');
  const params = useParams();
  const token = String(params.token ?? '');

  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const handleOpen = async () => {
    setIsSubmitting(true);
    setError(false);
    try {
      const response = await fetch(`/api/files/shared/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: password || undefined}),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      const data = (await response.json()) as {redirectUrl?: string};
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-root)] px-4">
      <div className="w-full max-w-sm space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('title')}</h1>
        <p className="text-sm text-[var(--text-tertiary)]">{t('description')}</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t('passwordPlaceholder')}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        {error && <p className="text-sm text-[var(--danger)]">{t('invalidOrExpired')}</p>}
        <Button type="button" variant="primary" loading={isSubmitting} onClick={() => void handleOpen()} className="w-full">
          {t('open')}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add i18n namespace**

Add a new top-level `sharedLink` namespace (sibling of `files`) to both `messages/hu.json`/`en.json`: `{"title": "Megosztott fájl", "description": "Ha a link jelszóval védett, add meg lent. Ha nem, csak kattints a Megnyitásra.", "passwordPlaceholder": "Jelszó (ha szükséges)", "invalidOrExpired": "A link érvénytelen vagy lejárt.", "open": "Megnyitás"}` (English: "Shared file" / "If this link is password-protected, enter it below. Otherwise just click Open." / "Password (if required)" / "This link is invalid or has expired." / "Open").

- [ ] **Step 4: Confirm this route needs no auth middleware exemption**

Check `middleware.ts` (repo root or `app/middleware.ts` — locate with `find . -maxdepth 1 -iname "middleware.ts"` and `find app -maxdepth 1 -iname "middleware.ts"` from `worf-app/`) for any allowlist of unauthenticated routes (e.g. `/auth/*`). If one exists and blocks unauthenticated access by default, add `/shared/*` (and `/api/files/shared/*`) to it — this page must be reachable by a logged-out recipient, per spec §7's entire premise. If no such middleware exists (routes are open by default, matching how `/api/files/dl/[token]` already works unauthenticated today), this step is a no-op — record which case applied in the commit message.

- [ ] **Step 5: Verify and commit**

`npx tsc --noEmit`. Manual check: create a public link from `ShareModal` (Task 29) on a test file, open `/shared/{token}` in an incognito window (no session cookie), confirm the file downloads/opens without login; test a wrong/no password against a password-protected link and confirm only the generic "invalid or expired" message shows.

```bash
git add "app/api/files/shared/[token]/route.ts" "app/[locale]/shared/[token]/page.tsx" messages/hu.json messages/en.json
git commit -m "feat(files): add public share-link landing page with server-side password relay"
```

## Phase H — i18n audit, mobile polish, final verification

### Task 34: i18n completeness audit

**Files:**
- Modify: `messages/hu.json`, `messages/en.json` (gap-fill only; every task above already added its own keys — this task finds and fixes what's missing or mismatched between the two files)

Every prior task added its own i18n keys as it went; this task is a systematic pass to catch drift (a key added to `hu.json` but forgotten in `en.json`, or a `t('...')`/`tf('...')` call whose key was never added to either file — which next-intl doesn't error on, it just silently falls back and shows the raw key path in the UI).

- [ ] **Step 1: Extract every `files`/`folders`/`sharedLink`/`validation` translation key actually referenced in code**

Run (from `worf-app/`), once for `t(` and once for `tf(`, across every file this plan touched:

```bash
grep -rEho "\bt\('[a-zA-Z0-9_.]+'" components/files app/[locale]/files "app/[locale]/groups/[groupId]/files" "app/[locale]/shared" | sed -E "s/^t\('//;s/'$//" | sort -u > /tmp/used-t-keys.txt
grep -rEho "\btf\('[a-zA-Z0-9_.]+'" components/files | sed -E "s/^tf\('//;s/'$//" | sort -u > /tmp/used-tf-keys.txt
```

(On Windows/PowerShell, use `Select-String -Pattern "t\('[a-zA-Z0-9_.]+'" -Path components/files/*.tsx,... | ...` equivalently, or run this step from Git Bash, which the project already uses per its tooling.)

- [ ] **Step 2: Diff against the actual JSON keys**

For each key in `/tmp/used-t-keys.txt` (dot-path under the `files` namespace) and `/tmp/used-tf-keys.txt` (dot-path under `folders`), confirm it resolves in both `messages/hu.json` and `messages/en.json`. A small Node one-liner does this without new tooling:

```bash
node -e "
const hu = require('./messages/hu.json');
const en = require('./messages/en.json');
const fs = require('fs');
const check = (file, ns, root) => {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  for (const key of lines) {
    const path = key.split('.');
    let hu_ = hu[ns], en_ = en[ns];
    for (const p of path) { hu_ = hu_?.[p]; en_ = en_?.[p]; }
    if (hu_ === undefined) console.log('MISSING hu.' + ns + '.' + key);
    if (en_ === undefined) console.log('MISSING en.' + ns + '.' + key);
  }
};
check('/tmp/used-t-keys.txt', 'files');
check('/tmp/used-tf-keys.txt', 'folders');
"
```

- [ ] **Step 3: Fill every reported gap**

For each `MISSING` line, add the key to the indicated file with a sensible translation consistent with the sibling strings already in that section (match tone/terminology — e.g. Hungarian formal "te" register already used throughout `files.*`, not "ön"). Also spot-check `messages/en.json`'s `validation.image_too_large` key (added in Task 5) is present, since it's outside the `t('files...')` grep scope above (it's read via the separate `tv` translator in `NameDialog.tsx`/`UploadDialog.tsx`) — run the same missing-key check manually for the `validation` namespace keys `file_too_large`, `file_type_forbidden`, `image_too_large`.

- [ ] **Step 4: Verify and commit**

Re-run Step 2's script — expect zero `MISSING` lines. Run `npx tsc --noEmit` (a missing `next-intl` key isn't a TS error since the generated message types come from the JSON files themselves, so this check is genuinely only caught by Steps 1–3, not by the compiler — do not skip this task assuming `tsc` would have caught it).

```bash
git add messages/hu.json messages/en.json
git commit -m "chore(files-i18n): close translation-key gaps found by cross-referencing code against messages/*.json"
```

### Task 35: Mobile/responsive polish pass

**Files:**
- Modify: whichever of `components/files/FileTable.tsx`, `FileGrid.tsx`, `FilesFeed.tsx`, `FilesBreadcrumb.tsx`, `FilesSubNav.tsx`, `EntryActionsMenu.tsx` need touch-target or overflow fixes found in Step 1 (no changes are pre-scripted here — this task is a checklist audit against the already-implemented components, not new component work)

Per spec §1.1/§13 DoD: sidebar hidden and mobile bottom-tab/hamburger behavior already exists app-wide (`components/layout/Sidebar.tsx`, out of scope — unchanged by this plan); this task verifies the **Files-specific** surfaces this plan added.

- [ ] **Step 1: Manual audit at a 375px viewport width (dev tools device toolbar, e.g. "iPhone SE")**

Walk through and note anything failing, then fix it in the listed component before moving to the next item:
- `/files`: toolbar (search + filter tabs + view toggle) from Task 18 — confirm it wraps/scrolls horizontally rather than overflowing off-screen (the existing `flex-col sm:flex-row` on the search+tabs wrapper should already stack them vertically below `sm:` — verify `TabsList` itself doesn't overflow; if it does, add `overflow-x-auto` to the `Tabs.List`'s wrapping `<div>` in `FilesFeed.tsx`).
- `FilesBreadcrumb.tsx` (Task 14): confirm the `overflow-x-auto` already on its `<nav>` actually lets a long breadcrumb scroll rather than wrap awkwardly — it should already work since the class is present; this is a confirm-only check.
- `FileTable.tsx`/`FileGrid.tsx` (Task 15) checkboxes and star buttons: measure the rendered hit area. The star button in `FileTable.tsx` uses `p-1` around a 16px icon (~24px total) and `FileGrid.tsx`'s checkbox/star are similarly small — per spec §1.1 ("minden érintési célpont legalább 44×44px legyen"), **increase these specific buttons' padding/hit area on touch** by adding `min-h-11 min-w-11` (Tailwind for 44px, matching the `h-11 w-11` pattern `SideSheet.tsx`/`EntryActionsMenu.tsx` already use for their close/trigger buttons) — apply this to: the star toggle buttons in both `FileTable.tsx` and `FileGrid.tsx`, and the checkbox `<input>` wrapper in both (wrap the raw `<input type="checkbox">` in a `min-h-11 min-w-11 flex items-center justify-center` label/div rather than resizing the input itself, which would look oversized).
- `EntryActionsMenu.tsx` (Task 16): already uses `h-11 w-11` for its mobile trigger and its sheet's action rows are `h-11` — confirm-only check, no expected fix.
- `BulkActionBar.tsx` (Task 19): confirm its `Button size="sm"` instances remain comfortably tappable at 375px width — if visually cramped, switch to the default (non-`sm`) `Button` size on screens below `sm:` via a responsive class, or accept as-is if it already looks fine (this is a judgment call at manual-test time, not a predetermined change).
- `PreviewModal.tsx` (Task 26): confirm the prev/next chevron buttons (currently unconditionally rendered at `size={22}` with `p-2`) meet 44px — they're `p-2` around a 22px icon ≈ 38px, **bump to `p-3`** to clear 44px.
- `MoveToFolderDialog.tsx`/`ShareModal.tsx`/`NameDialog.tsx`: these already render inside `Modal`/`Tabs` primitives that are not device-specific (spec doesn't mandate a bottom-sheet variant for `Modal`-based dialogs, only for the context menus, which `SideSheet`/`EntryActionsMenu` already cover) — confirm-only, no expected fix.

- [ ] **Step 2: Verify and commit**

`npx tsc --noEmit`. Re-check the fixed elements at 375px width.

```bash
git add components/files/FileTable.tsx components/files/FileGrid.tsx components/files/PreviewModal.tsx components/files/FilesFeed.tsx
git commit -m "fix(files): enlarge touch targets to 44px minimum on mobile, fix toolbar overflow"
```

### Task 36: Final integration verification pass (DoD walkthrough)

**Files:** none (verification only — this task fixes anything Steps 1–2 find broken, in whichever file the fix belongs, but does not pre-specify which)

- [ ] **Step 1: Automated checks**

Run, from `worf-app/`:
```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Expected: all Vitest suites pass (every test file this plan added, plus the 3 pre-existing suites — `lib/validation/__tests__/validation.test.ts`, `lib/utils/__tests__/constants.test.ts`, and the `lib/server/__tests__/*` OAuth suites, unrelated to this plan but must not regress); zero `tsc` errors outside stale `.next/types` noise (re-run `rm -rf .next && npx tsc --noEmit` if any `.next/types` errors appear, to rule out stale artifacts before treating anything as real); `next build` completes without error.

- [ ] **Step 2: Manual DoD walkthrough (spec §13), against a real dev server session (`npm run dev`) with at least one populated group and a handful of files/folders/images**

Go through each line, check it off, and if something fails, fix it in the component it belongs to before checking it off — do not check off an item that doesn't actually work:

- [ ] Every endpoint in spec §11's table is called from at least one place in the UI, or is explicitly out of scope with a documented reason. Out-of-scope-with-reason list for this plan: none — every listed `/v1/files/*` and `/v1/folders/*` endpoint got a UI caller across Tasks 1–33 (the two admin storage-limit-set endpoints, `POST /v1/files/storage/limit/user`/`group`, are the one exception: `lib/api/files.ts`'s existing `setUserStorageLimit`/`setGroupStorageLimit` wrappers already have an admin UI at `components/admin/AdminStorageLimitsManager.tsx`, built before this plan — confirm that page still works and still calls them; this plan does not touch it).
- [ ] Grid and list view both work; the choice is **not** currently persisted across sessions (spec's DoD asks for this: "nézetváltó megjegyzi a választást (localStorage vagy user-preferencia)" — **this was not implemented by any task above; add it now**: in `FilesFeed.tsx`, replace `const [view, setView] = useState<ViewMode>('list');` with a small localStorage-backed initializer, e.g. `useState<ViewMode>(() => (typeof window !== 'undefined' ? (localStorage.getItem('worf-files-view') as ViewMode) || 'list' : 'list'))`, and add a `useEffect(() => localStorage.setItem('worf-files-view', view), [view]);`. Do the same in `StarredView.tsx`/`SharedWithMeView.tsx` if desired, or scope it to `FilesFeed.tsx` only (the primary browsing surface) — document whichever choice is made in the commit message.
- [ ] Mobile (<600px) verified per Task 35.
- [ ] Thumbnail pending/failed fallback verified (upload an image, watch it go pending → ready without a manual refresh).
- [ ] Upload: real progress, parallel uploads, filename sanitize suggestion, size/MIME pre-filter — all per Task 20/5/17.
- [ ] Sharing: user/group/bulk/public-link all functional, escalation-blocked checkboxes verified with a non-owner test share.
- [ ] Trash: cascade-delete warning (folder delete confirm message), non-cascade restore (helper text), permanent-delete confirm, **no fabricated expiry text anywhere** — grep the final `messages/hu.json`/`en.json` `files`/`folders` namespaces for any string mentioning day-based auto-expiry and remove it if Task 25 or an earlier task accidentally introduced one (none should have — this is a final safety check per spec §10's explicit prohibition).
- [ ] Storage widget updates on scope switch, color thresholds visible (temporarily lower a test account's limit via the existing admin page to trigger the warning/critical colors and confirm).
- [ ] Every HTTP status in spec §1.5's table (401/403/404/409/413/415/422/429) has a human-readable outcome — 401/403/404/413/415/422/429 via the static `errors.api.*` map (Task 7, pre-existing map extended), 409 via raw-`detail` passthrough (Task 7) — spot check by temporarily forcing one (e.g. attempt to share an already-shared file to trigger a real 409) and confirming the raw backend sentence appears in the toast, not a generic fallback.
- [ ] Visual language matches the referenced screenshot's dark+orange/amber system — this was inherited from already-existing design tokens (Task-0/global-constraints note) and not something any task in this plan changed; confirm no task introduced an off-palette color (grep the diff for hardcoded hex colors: `git diff origin/master --stat` then `git diff origin/master -- components/files | grep -E "#[0-9a-fA-F]{3,6}"` should return nothing — every color in this plan's code uses the existing `var(--...)`/Tailwind semantic tokens).

- [ ] **Step 3: Record explicit scope cuts**

This plan deliberately did not implement (each already justified inline where the decision was made — collected here for a single final reference, not to be treated as new work):
1. Server-side/full-text file search — spec §12 confirms no such endpoint exists; client-side filter-the-loaded-page only (baseline behavior, Task 18).
2. Client-side image pixel-dimension (40MP) pre-validation — server-side Pillow check is authoritative and already surfaced via the error map (Task 5's scope note).
3. PDF inline preview — no backend PDF-to-image endpoint and the download endpoint forces `Content-Disposition: attachment`; icon + Download fallback only (Task 26's scope decision).
4. Trash auto-expiry countdown UI — spec §4/§10 explicitly says the backend has no such mechanism; showing one would be fabricated (Task 25).
5. Fine-grained per-file upload progress in the multi-file queue is implementer's choice between `fetch` (coarse) and `XHR` (fine-grained) — see Task 20 Step 1's note.

- [ ] **Step 4: Final commit**

```bash
git add -A
git status
git commit -m "chore(files): view-mode persistence, final DoD verification pass"
```

Push the branch and open a PR once the user reviews this plan's execution:
```bash
git push -u origin feature/files-drive-ui
```

