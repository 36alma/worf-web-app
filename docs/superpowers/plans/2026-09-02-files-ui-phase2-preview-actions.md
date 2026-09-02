# Files UI – 2. fázis: Preview alapértelmezett megnyitás + akciólista-builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fájlra kattintva támogatott típusnál (jelenleg: kép) a Preview
nyíljon meg közvetlenül a Details helyett; a kebab-menü (`EntryActionsMenu`)
egészüljön ki Preview/Details/Megosztás menüpontokkal; az akciólista-építő
logika kerüljön ki egy önálló, tesztelhető `entryActions.tsx` modulba.

**Architecture:** A jelenlegi `FilesFeed.buildActionItems` inline
függvényt kiemeljük egy tiszta `buildEntryActions(entry, context)`
függvénybe (`components/files/entryActions.tsx`), ami `ActionMenuItem[]`-t
ad vissza — ugyanazt a típust, amit az `EntryActionsMenu` már ma is fogyaszt
(`components/files/EntryActionsMenu.tsx:14-22`, nincs benne módosítás).
Ez a modul a 3. fázisban (jobbklikk context menu + long-press) is
újrafelhasználásra kerül majd, ezért most kap saját fájlt és unit tesztet.
`FilesFeed.tsx` az `onOpenFile` prop mögötti logikát szétválasztja: ha a
fájl előnézhető (kép MIME-típus), a `PreviewModal`-t nyitja meg
(`setPreviewFileId`), egyébként a `FileDetailSheet`-et (`setSelectedFileId`)
— ez a döntés `fileEntries`-ből (`FilesFeed.tsx:110`) néz ki egy entry-t
`fileId` alapján, mert az `EntryListProps.onOpenFile` szignatúrája csak
`(fileId: string) => void` (nem kap teljes entry-t — ez nem változik ebben
a fázisban). A Megosztás menüpont a már meglévő, `kind: 'file' | 'folder'`-t
generikusan támogató `ShareModal`-t nyitja meg közvetlenül a kebab-menüből,
a `FileDetailSheet` megkerülésével.

**Tech Stack:** Next.js (App Router), React, TypeScript, `next-intl`,
`lucide-react` ikonok, Vitest (unit teszt).

**Spec:** `docs/superpowers/specs/2026-09-02-files-ui-interactions-design.md`
(2. fázis szakasz; a "Közös akciólista-builder" és "Adatfolyam —
Preview/Details" architektúra-alszakaszok)

## Global Constraints

- Ne törd az `EntryListProps` interfészt (`components/files/entryTypes.ts:21-44`)
  — `onOpenFile: (fileId: string) => void` szignatúrája nem változik, csak
  a `FilesFeed`-ben átadott implementáció.
- Az `ActionMenuItem` típus (`components/files/EntryActionsMenu.tsx:14-22`)
  nem változik — az új `entryActions.tsx` ugyanezt a típust importálja és
  tölti ki, nem definiál újat.
- A Megosztás/Jogosultságok menüpont csak akkor jelenjen meg, ha
  `entry.is_owner === true` — a listázó végpontok (`FileListItem`,
  `FolderListEntry`, `lib/api/files.ts:42-52`, `lib/api/folders.ts:4-11`)
  nem adnak vissza `can_share` mezőt, csak `is_owner`-t, ezért a spec
  táblázatának "is_owner vagy can_share" feltétele ebben a fázisban
  `is_owner`-re egyszerűsödik (ugyanaz a minta, mint
  `FileDetailSheet.tsx:176` `canManage` számítása).
- Mappákra ebben a fázisban **nem** kap a kebab-menü "Details" pontot — a
  `FolderDetailSheet` még placeholder stub, a 4. fázis építi ki. A
  "Megosztás" viszont mappákra is bekerül, mert a `ShareModal` már ma is
  generikusan támogatja a `kind: 'folder'`-t (`ShareModal.tsx:26-32`), nem
  függ a `FolderDetailSheet`-től.
- A `isForbidden`/`markForbidden` mintát (`lib/permissions/filesGuard.ts`)
  változatlanul kell használni a Letöltés/Átnevezés/Törlés elrejtéséhez —
  ugyanaz a `(scope, action, id)` kulcs-forma, amit a jelenlegi
  `buildActionItems` is használ.
- Ne vezess be új i18n namespace-t; az új kulcsok a meglévő `files`
  namespace `table` alkulcsa alá kerülnek (lásd Task 2).
- `entryActions.tsx` tiszta függvényeket exportál (nincs benne hook, nincs
  `'use client'` direktíva) — a JSX-hasznalat miatt `.tsx` kiterjesztésű,
  de nem React komponens.

---

## Fájlstruktúra

- **Új:** `components/files/entryActions.tsx` — `isPreviewable(entry)` és
  `buildEntryActions(entry, context)` tiszta függvények, `EntryActionsContext`
  típussal.
- **Új:** `components/files/__tests__/entryActions.test.ts` — unit tesztek
  a fenti két függvényre.
- **Módosítva:** `components/files/FilesFeed.tsx` — az inline
  `buildActionItems` eltávolítása, `handleOpenFile` bevezetése, `ShareModal`
  bekötése, `renderActions` átírása az új `buildEntryActions`-re.
- **Módosítva:** `messages/en.json`, `messages/hu.json` — két új kulcs a
  `files.table` alatt: `preview`, `open`.

---

### Task 1: `entryActions.tsx` — közös akciólista-builder + unit tesztek

**Files:**
- Create: `components/files/entryActions.tsx`
- Create: `components/files/__tests__/entryActions.test.ts`
- Test: `components/files/__tests__/entryActions.test.ts` (ugyanaz a fájl)

**Interfaces:**
- Consumes: `ActionMenuItem` (`components/files/EntryActionsMenu.tsx:14-22`,
  `{ key: string; label: string; icon?: ReactNode; onSelect: () => void;
  variant?: 'danger'; disabled?: boolean; hidden?: boolean; }`), `FsEntry`
  (`components/files/entryTypes.ts:6`), `isForbidden` (`lib/permissions/filesGuard.ts:18`,
  szignatúra `(scope: 'file' | 'folder', action: string, id: string) => boolean`).
- Produces: `isPreviewable(entry: FsEntry): boolean`,
  `buildEntryActions(entry: FsEntry, context: EntryActionsContext):
  ActionMenuItem[]`, és az `EntryActionsContext` típus — ezeket importálja
  majd Task 2 (`FilesFeed.tsx`), és a 3. fázis terve is erre a két exportra
  fog hivatkozni.

`EntryActionsContext` alakja:

```typescript
export interface EntryActionsContext {
  /** Translation function scoped to the 'files' namespace (useTranslations('files') return value is a valid supertype). */
  t: (key: string) => string;
  onOpenFolder: (entry: FsEntry) => void;
  onPreview: (entry: FsEntry) => void;
  onDetails: (entry: FsEntry) => void;
  onShare: (entry: FsEntry) => void;
  onDownload: (entry: FsEntry) => void;
  onRename: (entry: FsEntry) => void;
  onToggleStar: (entry: FsEntry) => void;
  onDelete: (entry: FsEntry) => void;
}
```

Az akciólista sorrendje entry-típusonként (a spec §"Közös akciólista-builder"
táblázata alapján, a jelen fázis hatókörére szűkítve — ld. Global Constraints):

| Kulcs | Fájl | Mappa | Feltétel |
|---|---|---|---|
| `open` | – | ✓ | mindig (csak mappánál) |
| `preview` | ✓ | – | `isPreviewable(entry)` |
| `details` | ✓ | – | mindig (csak fájlnál — mappa Details a 4. fázisban) |
| `download` | ✓ | – | `!isForbidden(scope, 'download', entry.id)` |
| `share` | ✓ | ✓ | `entry.is_owner` |
| `rename` | ✓ | ✓ | `!isForbidden(scope, 'edit', entry.id)` |
| `star` | ✓ | ✓ | mindig |
| `delete` | ✓ | ✓ | `!isForbidden(scope, 'delete', entry.id)` |

Ez a sorrend (open → preview → details → download → share → rename → star
→ delete) megtartja a jelenlegi `FilesFeed.buildActionItems` konvencióját
(a `delete` marad utolsó, mint a legdestruktívabb/legritkábban használt
akció), és a `hidden` mezőt (nem a lista tényleges kihagyását) használja a
feltételes elemekhez, pontosan úgy, ahogy a mai kód is teszi — az
`EntryActionsMenu` maga szűri ki a `hidden: true` elemeket
(`EntryActionsMenu.tsx:33`).

- [ ] **Step 1: Írd meg a failing tesztet `isPreviewable`-re**

`components/files/__tests__/entryActions.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { resetForbiddenCache, markForbidden } from '@/lib/permissions/filesGuard';
import { isPreviewable, buildEntryActions, type EntryActionsContext } from '../entryActions';
import type { FileEntry, FolderEntry } from '../entryTypes';

const makeFile = (overrides: Partial<FileEntry> = {}): FileEntry => ({
  kind: 'file',
  id: 'f1',
  original_name: 'photo.png',
  mime_type: 'image/png',
  size_bytes: 1024,
  scope: 'private',
  uploaded_at: '2026-01-01T00:00:00Z',
  is_owner: true,
  folder_id: null,
  is_starred: false,
  ...overrides,
});

const makeFolder = (overrides: Partial<FolderEntry> = {}): FolderEntry => ({
  kind: 'folder',
  id: 'd1',
  name: 'Documents',
  scope: 'private',
  created_at: '2026-01-01T00:00:00Z',
  is_owner: true,
  is_starred: false,
  ...overrides,
});

describe('isPreviewable', () => {
  it('is true for image files', () => {
    expect(isPreviewable(makeFile({ mime_type: 'image/jpeg' }))).toBe(true);
  });

  it('is false for non-image files', () => {
    expect(isPreviewable(makeFile({ mime_type: 'application/pdf' }))).toBe(false);
  });

  it('is false for files with no mime_type', () => {
    expect(isPreviewable(makeFile({ mime_type: null }))).toBe(false);
  });

  it('is false for folders', () => {
    expect(isPreviewable(makeFolder())).toBe(false);
  });
});
```

- [ ] **Step 2: Futtasd, hogy lásd, elbukik (a modul még nem létezik)**

Run: `npx vitest run components/files/__tests__/entryActions.test.ts`
Expected: FAIL — `Cannot find module '../entryActions'` (vagy hasonló
import-hiba), mert `components/files/entryActions.tsx` még nem létezik.

- [ ] **Step 3: Hozd létre `components/files/entryActions.tsx`-t (minimális `isPreviewable`-lel egyelőre)**

```tsx
import type { ReactNode } from 'react';
import { Download, Eye, FileText, FolderOpen, Pencil, Share2, Star, Trash2 } from 'lucide-react';
import type { ActionMenuItem } from './EntryActionsMenu';
import type { FsEntry } from './entryTypes';
import { isForbidden } from '@/lib/permissions/filesGuard';

export function isPreviewable(entry: FsEntry): boolean {
  return entry.kind === 'file' && Boolean(entry.mime_type?.startsWith('image/'));
}
```

- [ ] **Step 4: Futtasd újra, ellenőrizd hogy az `isPreviewable` tesztek zöldek**

Run: `npx vitest run components/files/__tests__/entryActions.test.ts`
Expected: az `isPreviewable` blokk 4 tesztje PASS, a `buildEntryActions`
importja még hiányzik a fájlból, úgyhogy a teszt fájl teteje eddig még
nem hivatkozik rá (a következő stepben adjuk hozzá a `buildEntryActions`
teszteket és implementációt együtt).

- [ ] **Step 5: Írd meg a failing teszteket `buildEntryActions`-re**

Egészítsd ki `components/files/__tests__/entryActions.test.ts`-t (a fájl
végére, az `isPreviewable` `describe` blokk után):

```typescript
describe('buildEntryActions', () => {
  const noop = () => {};
  const baseContext: EntryActionsContext = {
    t: (key: string) => key,
    onOpenFolder: noop,
    onPreview: noop,
    onDetails: noop,
    onShare: noop,
    onDownload: noop,
    onRename: noop,
    onToggleStar: noop,
    onDelete: noop,
  };

  beforeEach(() => resetForbiddenCache());

  it('includes preview for an image file the user owns', () => {
    const keys = buildEntryActions(makeFile(), baseContext).map((item) => item.key);
    expect(keys).toEqual(['preview', 'details', 'download', 'share', 'rename', 'star', 'delete']);
  });

  it('omits preview for a non-image file', () => {
    const keys = buildEntryActions(makeFile({ mime_type: 'application/pdf' }), baseContext).map((item) => item.key);
    expect(keys).toEqual(['details', 'download', 'share', 'rename', 'star', 'delete']);
  });

  it('omits share for a file the user does not own', () => {
    const keys = buildEntryActions(makeFile({ is_owner: false }), baseContext).map((item) => item.key);
    expect(keys).not.toContain('share');
  });

  it('folders get open + share + rename + star + delete, no preview/details/download', () => {
    const keys = buildEntryActions(makeFolder(), baseContext).map((item) => item.key);
    expect(keys).toEqual(['open', 'share', 'rename', 'star', 'delete']);
  });

  it('marks download hidden when forbidden', () => {
    markForbidden('file', 'download', 'f1');
    const items = buildEntryActions(makeFile(), baseContext);
    const download = items.find((item) => item.key === 'download');
    expect(download?.hidden).toBe(true);
  });

  it('marks rename hidden when forbidden', () => {
    markForbidden('file', 'edit', 'f1');
    const items = buildEntryActions(makeFile(), baseContext);
    const rename = items.find((item) => item.key === 'rename');
    expect(rename?.hidden).toBe(true);
  });

  it('marks delete hidden when forbidden', () => {
    markForbidden('folder', 'delete', 'd1');
    const items = buildEntryActions(makeFolder(), baseContext);
    const del = items.find((item) => item.key === 'delete');
    expect(del?.hidden).toBe(true);
  });

  it('star label reflects is_starred', () => {
    const starredItem = buildEntryActions(makeFile({ is_starred: true }), { ...baseContext, t: (key) => key }).find((item) => item.key === 'star');
    const unstarredItem = buildEntryActions(makeFile({ is_starred: false }), { ...baseContext, t: (key) => key }).find((item) => item.key === 'star');
    expect(starredItem?.label).toBe('table.unstar');
    expect(unstarredItem?.label).toBe('table.star');
  });

  it('calls the matching context callback with the entry on select', () => {
    let received: FsEntry | null = null;
    const ctx: EntryActionsContext = { ...baseContext, onDelete: (entry) => { received = entry; } };
    const file = makeFile();
    const items = buildEntryActions(file, ctx);
    items.find((item) => item.key === 'delete')?.onSelect();
    expect(received).toBe(file);
  });
});
```

- [ ] **Step 6: Futtasd, hogy lásd, elbukik (`buildEntryActions` még nincs exportálva)**

Run: `npx vitest run components/files/__tests__/entryActions.test.ts`
Expected: FAIL — `buildEntryActions`/`EntryActionsContext` nincs exportálva
`../entryActions`-ből.

- [ ] **Step 7: Egészítsd ki `components/files/entryActions.tsx`-t a teljes implementációval**

```tsx
import type { ReactNode } from 'react';
import { Download, Eye, FileText, FolderOpen, Pencil, Share2, Star, Trash2 } from 'lucide-react';
import type { ActionMenuItem } from './EntryActionsMenu';
import type { FsEntry } from './entryTypes';
import { isForbidden } from '@/lib/permissions/filesGuard';

export function isPreviewable(entry: FsEntry): boolean {
  return entry.kind === 'file' && Boolean(entry.mime_type?.startsWith('image/'));
}

export interface EntryActionsContext {
  /** Translation function scoped to the 'files' namespace (useTranslations('files') return value is a valid supertype). */
  t: (key: string) => string;
  onOpenFolder: (entry: FsEntry) => void;
  onPreview: (entry: FsEntry) => void;
  onDetails: (entry: FsEntry) => void;
  onShare: (entry: FsEntry) => void;
  onDownload: (entry: FsEntry) => void;
  onRename: (entry: FsEntry) => void;
  onToggleStar: (entry: FsEntry) => void;
  onDelete: (entry: FsEntry) => void;
}

export function buildEntryActions(entry: FsEntry, ctx: EntryActionsContext): ActionMenuItem[] {
  const scope = entry.kind === 'file' ? 'file' : 'folder';
  const items: ActionMenuItem[] = [];

  if (entry.kind === 'folder') {
    items.push({
      key: 'open',
      label: ctx.t('table.open'),
      icon: <FolderOpen size={16} strokeWidth={1.75} />,
      onSelect: () => ctx.onOpenFolder(entry),
    });
  }

  if (entry.kind === 'file' && isPreviewable(entry)) {
    items.push({
      key: 'preview',
      label: ctx.t('table.preview'),
      icon: <Eye size={16} strokeWidth={1.75} />,
      onSelect: () => ctx.onPreview(entry),
    });
  }

  if (entry.kind === 'file') {
    items.push({
      key: 'details',
      label: ctx.t('preview.details'),
      icon: <FileText size={16} strokeWidth={1.75} />,
      onSelect: () => ctx.onDetails(entry),
    });
    items.push({
      key: 'download',
      label: ctx.t('detail.download'),
      icon: <Download size={16} strokeWidth={1.75} />,
      onSelect: () => ctx.onDownload(entry),
      hidden: isForbidden(scope, 'download', entry.id),
    });
  }

  if (entry.is_owner) {
    items.push({
      key: 'share',
      label: ctx.t('share.modalTitle'),
      icon: <Share2 size={16} strokeWidth={1.75} />,
      onSelect: () => ctx.onShare(entry),
    });
  }

  items.push({
    key: 'rename',
    label: ctx.t('table.rename'),
    icon: <Pencil size={16} strokeWidth={1.75} />,
    onSelect: () => ctx.onRename(entry),
    hidden: isForbidden(scope, 'edit', entry.id),
  });

  items.push({
    key: 'star',
    label: entry.is_starred ? ctx.t('table.unstar') : ctx.t('table.star'),
    icon: <Star size={16} strokeWidth={1.75} />,
    onSelect: () => ctx.onToggleStar(entry),
  });

  items.push({
    key: 'delete',
    label: ctx.t('detail.delete'),
    icon: <Trash2 size={16} strokeWidth={1.75} />,
    variant: 'danger',
    onSelect: () => ctx.onDelete(entry),
    hidden: isForbidden(scope, 'delete', entry.id),
  });

  return items;
}
```

Megjegyzés: a `ReactNode` importot csak akkor tartsd meg, ha ténylegesen
hivatkozol rá típusként; ha a TypeScript/lint unused-import hibát jelez rá
(mert az `icon?: ReactNode` már az `ActionMenuItem` típusból jön, nem
ebből a fájlból kell újra kimondani), töröld az importot.

- [ ] **Step 8: Futtasd újra, ellenőrizd hogy minden teszt zöld**

Run: `npx vitest run components/files/__tests__/entryActions.test.ts`
Expected: PASS, mind a 13 teszt (4 `isPreviewable` + 9 `buildEntryActions`).

- [ ] **Step 9: TypeScript és lint ellenőrzés**

Run: `npx tsc --noEmit`
Expected: nincs hiba `entryActions.tsx`-ben vagy a teszt fájlban.

- [ ] **Step 10: Commit**

```bash
git add components/files/entryActions.tsx components/files/__tests__/entryActions.test.ts
git commit -m "feat(files): extract shared entry-actions builder with tests"
```

---

### Task 2: `FilesFeed.tsx` bekötés — Preview-first kattintás, kebab-menü bővítés, Megosztás

**Files:**
- Modify: `components/files/FilesFeed.tsx`
- Modify: `messages/en.json`
- Modify: `messages/hu.json`

**Interfaces:**
- Consumes: `isPreviewable`, `buildEntryActions`, `EntryActionsContext`
  (Task 1, `components/files/entryActions.tsx`); `ShareModal`
  (`components/files/ShareModal.tsx`, props `{ open, kind, entityId,
  isOwner, onClose }`, már létező, nincs módosítás rajta).
- Produces: nincs új export — a `FilesFeed` komponens publikus props-ja
  (`FilesFeedProps`) változatlan.

- [ ] **Step 1: Adj hozzá két új i18n kulcsot a `files.table` alá**

`messages/en.json`, a `table` objektumban (`"rename": "Rename",` sor után,
`"pagination"` elé):

```json
      "rename": "Rename",
      "preview": "Preview",
      "open": "Open",
      "pagination": {
```

`messages/hu.json`, ugyanoda:

```json
      "rename": "Átnevezés",
      "preview": "Előnézet",
      "open": "Megnyitás",
      "pagination": {
```

- [ ] **Step 2: Importáld az új modulokat `FilesFeed.tsx`-ben**

A fájl tetején cseréld a lucide-react importot (`Download, FolderPlus,
Pencil, Star, Trash2` — a `Download`/`Pencil`/`Trash2` a Task 1 után csak
`entryActions.tsx`-ben kell, itt már nem):

```tsx
import { FolderPlus, Star } from 'lucide-react';
```

Add hozzá az új importokat a többi `components/files/*` import mellé:

```tsx
import ShareModal from '@/components/files/ShareModal';
import { buildEntryActions, isPreviewable } from '@/components/files/entryActions';
```

- [ ] **Step 3: Vezesd be a `shareTarget` state-et**

A `selectedFileId`/`previewFileId` state-ek mellé (`FilesFeed.tsx:74-75`
körül):

```tsx
  const [shareTarget, setShareTarget] = useState<FsEntry | null>(null);
```

- [ ] **Step 4: Vezesd be a `handleOpenFile` handlert**

A `handleOpenFolder` definíciója után (`FilesFeed.tsx:112` körül):

```tsx
  const handleOpenFile = (fileId: string) => {
    const entry = fileEntries.find((file) => file.id === fileId);
    if (entry && isPreviewable(entry)) {
      setPreviewFileId(fileId);
    } else {
      setSelectedFileId(fileId);
    }
  };
```

- [ ] **Step 5: Cseréld le az inline `buildActionItems`-t és `renderActions`-t**

Töröld a teljes `buildActionItems` függvényt (`FilesFeed.tsx:207-245`, a
"// Extension point" kommenttől a záró `};`-ig) és a mai `renderActions`-t
(`FilesFeed.tsx:247-249`), és írd helyükre:

```tsx
  const renderActions = (entry: FsEntry) => (
    <EntryActionsMenu
      items={buildEntryActions(entry, {
        t,
        onOpenFolder: (target) => handleOpenFolder(target.id),
        onPreview: (target) => setPreviewFileId(target.id),
        onDetails: (target) => setSelectedFileId(target.id),
        onShare: (target) => setShareTarget(target),
        onDownload: (target) => void handleDownload(target),
        onRename: (target) => setRenameTarget(target),
        onToggleStar: (target) => void handleToggleStar(target),
        onDelete: (target) => setDeleteTarget(target),
      })}
      triggerLabel={t('table.actions')}
      sheetTitle={t('table.actions')}
    />
  );
```

- [ ] **Step 6: Cseréld az `onOpenFile` prop-átadást `FileGrid`/`FileTable`-nél**

`FilesFeed.tsx:321-341` körül, mindkét (`FileGrid` és `FileTable`) JSX-ben:

```tsx
          onOpenFile={setSelectedFileId}
```

cseréld erre (mindkét helyen):

```tsx
          onOpenFile={handleOpenFile}
```

- [ ] **Step 7: Rendereld a `ShareModal`-t**

A meglévő `<PreviewModal .../>` blokk után (`FilesFeed.tsx:358-364`
környékén), add hozzá:

```tsx
      {shareTarget && (
        <ShareModal
          open={shareTarget !== null}
          kind={shareTarget.kind}
          entityId={shareTarget.id}
          isOwner={shareTarget.is_owner}
          onClose={() => setShareTarget(null)}
        />
      )}
```

- [ ] **Step 8: Ellenőrizd, hogy nincs elhagyott hivatkozás a régi `buildActionItems`-re**

Run:

```bash
grep -n "buildActionItems" components/files/FilesFeed.tsx
```

Expected: nincs találat.

- [ ] **Step 9: TypeScript és lint ellenőrzés**

Run: `npx tsc --noEmit`
Expected: nincs hiba (nincs unused import — `Download`/`Pencil`/`Trash2`
eltávolítva a Step 2-ben; ellenőrizd, hogy `FolderPlus`/`Star` továbbra is
használatban vannak-e a fájlban, ahogy Step 2 leírja).

- [ ] **Step 10: Futtasd a teljes teszt-suite-ot**

Run: `npx vitest run`
Expected: minden korábbi teszt továbbra is PASS (nincs regresszió), plusz
a Task 1-ben írt `entryActions.test.ts` is PASS.

- [ ] **Step 11: Indítsd el a dev szervert, és nézd meg böngészőben**

Run: `npm run dev`, majd a Files nézetben:
1. Kattints egy kép fájlra → a Preview modal nyíljon meg közvetlenül
   (ne a Details sheet).
2. Kattints egy nem-kép fájlra (pl. egy feltöltött dokumentumra) → a
   Details sheet nyíljon meg (mint korábban).
3. Nyisd meg egy fájl kebab-menüjét → lásd a Preview (csak kép esetén),
   Details, Download, Share (csak ha te vagy a tulajdonos), Rename, Star,
   Delete pontokat, ebben a sorrendben.
4. Nyisd meg egy mappa kebab-menüjét → lásd az Open, Share (ha tulajdonos
   vagy), Rename, Star, Delete pontokat — nincs Preview/Details/Download.
5. Kattints a kebab-menü Share pontjára → a `ShareModal` nyíljon meg
   közvetlenül (Details sheet megkerülésével).

Expected: mind az 5 lépés a leírtak szerint viselkedik.

- [ ] **Step 12: Commit**

```bash
git add components/files/FilesFeed.tsx messages/en.json messages/hu.json
git commit -m "feat(files): open preview by default on click, expand kebab menu with preview/details/share"
```

---

## Self-Review (elvégezve a terv írásakor)

1. **Spec-lefedettség:** a spec 2. fázisának mindkét pontja ("Kattintásra
   fájlon: Preview nyílik meg... egyébként Details" és "`buildActionItems`
   bővítése: Details, Preview, Megosztás menüpontok bekerülnek a kebab
   menübe is") lefedve Task 1 (builder + tesztek) és Task 2 (bekötés) által.
   A spec architektúra-szakaszának "Adatfolyam — Preview/Details" pontja
   (`onOpenFile` szétválasztása) Task 2 Step 4-ben valósul meg.
2. **Placeholder-ellenőrzés:** nincs "TODO"/"implement later" jellegű
   lépés; minden step konkrét kódot vagy konkrét parancsot tartalmaz.
3. **Típus-konzisztencia:** `EntryActionsContext` mezői (Task 1) 1:1
   megfelelnek a Task 2 Step 5-ben átadott callback-eknek
   (`onOpenFolder`, `onPreview`, `onDetails`, `onShare`, `onDownload`,
   `onRename`, `onToggleStar`, `onDelete`); az `ActionMenuItem` típus
   nem változik a jelenlegi `EntryActionsMenu.tsx`-hez képest; a
   `buildEntryActions`/`isPreviewable` export-nevek megegyeznek Task 1
   és Task 2 összes hivatkozásában.
