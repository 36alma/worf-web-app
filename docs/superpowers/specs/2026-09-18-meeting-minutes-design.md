# Jegyzőkönyv (Meeting Minutes) modul — frontend design

Dátum: 2026-09-18
Státusz: jóváhagyva, implementációra vár

## Kontextus

A backend `/v1/minutes/*` alatt egy teljes jegyzőkönyv-modult biztosít
(fejléc, napirendi pontok, feladatok, résztvevők, mellékletek,
hitelesítési állapotgép, PDF export, AI-alapú import, Task/naptár
integráció — ld. a felhasználó által megadott teljes API-referenciát).
A frontendben (`worf-app`) jelenleg semmilyen ehhez kapcsolódó kód nincs
(`Grep` a `minutes`/`jegyzőkönyv` kulcsszavakra csak i18n JSON-okban és a
`MarkdownEditor.tsx` komment-mintázatában talált találatot, ami nem
kapcsolódik ehhez a funkcióhoz).

A projektben már van egy hasonló mélységű, csoport-szintű modul —
**Tasks/Sprints** (`components/groups/tasks/*`, `lib/api/tasks.ts`,
`lib/api/sprints.ts`) —, amit mintaként követünk, illetve a **Posts**
modul (`app/[locale]/groups/[groupId]/posts/*`) ad mintát a
lista/részlet/szerkesztés különálló oldalakra bontásához és a Tiptap
rich text tartalom read-only megjelenítéséhez (`dangerouslySetInnerHTML`
+ `prose` class).

## Célok

1. Teljes CRUD a jegyzőkönyv fejlécre, napirendi pontokra, feladatokra,
   résztvevőkre és mellékletekre.
2. Az állapotgép (DRAFT → PENDING_APPROVAL → APPROVED → revise → új DRAFT)
   vizuális és funkcionális támogatása: finalize, hitelesítői szavazás,
   revise.
3. A napirendi pontok `discussion`/`decision` mezői **teljes értékű,
   interaktív rich text szerkesztőt** kapjanak (a meglévő
   `MarkdownEditor.tsx`-re építve), **hivatkozás (hyperlink) beszúrási
   lehetőséggel** — ez a `Link` extension már benne van a komponensben.
4. Mellékletek csatolása/leválasztása a meglévő Files-flow-n keresztül,
   valamint PDF export.
5. AI-alapú import wizard (Word/PDF jegyzőkönyv digitalizálása) —
   feltöltés → elemzés → szerkeszthető review → megerősítés.
6. Task-promóció (feladatból valódi Task) és naptár-előtöltés
   (résztvevők automatikus felvétele naptáreseményből).
7. Jogosultság-vezérelt UI minden művelethez, a meglévő
   `GroupPermissionContext`/`hasPermission` mintát követve.

## Nem célok

- Nincs backend munka — a `/v1/minutes/*` végpontok készen állnak, a
  spec csak a frontend integrációt írja le.
- Nincs valós idejű (websocket) frissítés a hitelesítési folyamathoz —
  a felhasználó a `get` újrahívásával (manuális frissítés gombbal vagy
  művelet utáni refetch-csel) látja a friss állapotot.
- Nincs teljes verzió-lánc böngésző UI (a `root_minutes_id` szerinti
  összes verzió automatikus felderítése) — csak egy egyszerű "előző
  verzió" link, ha a jelenlegi jegyzőkönyvnek van `root_minutes_id`-ja
  vagy ha a lista tartalmaz ugyanahhoz a `root_minutes_id`-hoz tartozó
  másik sort (kliens-oldali szűrés a már betöltött listán, nem külön
  végpont).
- A `calendar_event_id`-alapú "Résztvevők előtöltése" gomb csak akkor
  jelenik meg, ha a jegyzőkönyvnek van `calendar_event_id`-ja — a
  naptáresemény-választó UI (ha a felhasználó menet közben akarna
  eseményt hozzárendelni) nem témája ennek a spec-nek.

## Explicit döntések

- **Külön oldalak, nem modál** a lista/részlet/létrehozás/import
  számára (Posts mintája), mert a jegyzőkönyv-részlet (napirendi pontok
  + feladatok + résztvevők + hitelesítők + mellékletek) túl komplex egy
  modálhoz.
- **A rich text mezők HTML-t tárolnak és adnak át a backendnek**
  string mezőként (`discussion`, `decision`) — ugyanúgy, ahogy a Posts
  modul a `body` mezőt kezeli. Nincs markdown-konverzió, nincs extra
  sanitizálás bevezetve (a projekt jelenlegi konvenciója szerint).
- **A melléklet-kezelés bekerül ebbe a körbe** (a felhasználó explicit
  döntése), a PDF exporttal együtt.
- **Az import wizard AI-elemzés funkciója feature-flag-mögötti** — a
  frontend elkapja az `import/analyze` 503-as válaszát és elrejti/
  letiltja az "Import" gombot, nem előzetes config-lekérdezéssel dönt.

## Adatréteg

### `components/groups/minutes/types.ts`

A `tasks/types.ts` mintáját követve:

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
  minutes: MeetingMinutes[]; // list válaszban agenda_items/participants/attachments NINCS jelen
  total_minutes: number;
  total_pages: number;
  current_page: number;
}

export interface MinutesImportProposal {
  subject: string;
  meeting_date: string;
  location?: string;
  participants: {display_name: string; role: ParticipantRole}[];
  agenda_items: {
    title: string;
    discussion?: string;
    decision?: string;
    action_items?: {description: string; due_date?: string; assignee_name?: string}[];
  }[];
  confidence_notes?: string;
}
```

### `lib/api/minutes.ts`

Vékony POST wrapperek, a `sprints.ts` mintáját követve — egy függvény
végpontonként, nincs osztály/kliens-absztrakció:

```ts
import apiClient from './client';

export const createMinutes = (data: {...}) => apiClient.post('/v1/minutes/create', data);
export const modifyMinutes = (data: {...}) => apiClient.post('/v1/minutes/modify', data);
export const deleteMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/delete', data);
export const getMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/get', data);
export const listMinutes = (data: {group_id: string; page_number?: number; load_number?: number; status?: string; date_from?: string; date_to?: string}) =>
  apiClient.post('/v1/minutes/list', data);

export const createAgendaItem = (data: {...}) => apiClient.post('/v1/minutes/agenda-item/create', data);
export const modifyAgendaItem = (data: {...}) => apiClient.post('/v1/minutes/agenda-item/modify', data);
export const deleteAgendaItem = (data: {group_id: string; agenda_item_id: string}) =>
  apiClient.post('/v1/minutes/agenda-item/delete', data);

export const createActionItem = (data: {...}) => apiClient.post('/v1/minutes/action-item/create', data);
export const modifyActionItem = (data: {...}) => apiClient.post('/v1/minutes/action-item/modify', data);
export const deleteActionItem = (data: {group_id: string; action_item_id: string}) =>
  apiClient.post('/v1/minutes/action-item/delete', data);
export const promoteActionItemToTask = (data: {group_id: string; action_item_id: string; issue_key?: string}) =>
  apiClient.post('/v1/minutes/action-item/promote-to-task', data);

export const addParticipant = (data: {...}) => apiClient.post('/v1/minutes/participant/add', data);
export const modifyParticipant = (data: {...}) => apiClient.post('/v1/minutes/participant/modify', data);
export const removeParticipant = (data: {group_id: string; participant_id: string}) =>
  apiClient.post('/v1/minutes/participant/remove', data);
export const prepopulateParticipantsFromEvent = (data: {group_id: string; minutes_id: string; calendar_event_id: string}) =>
  apiClient.post('/v1/minutes/participant/prepopulate-from-event', data);

export const linkAttachment = (data: {group_id: string; minutes_id: string; file_id: string; label?: string}) =>
  apiClient.post('/v1/minutes/attachment/link', data);
export const unlinkAttachment = (data: {group_id: string; attachment_id: string}) =>
  apiClient.post('/v1/minutes/attachment/unlink', data);

export const exportMinutesPdf = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/export/pdf', data);

export const finalizeMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/finalize', data);
export const castWitnessVote = (data: {group_id: string; minutes_id: string; decision: 'APPROVE' | 'REJECT'; reason?: string}) =>
  apiClient.post('/v1/minutes/witness/vote', data);
export const reviseMinutes = (data: {group_id: string; minutes_id: string}) =>
  apiClient.post('/v1/minutes/revise', data);

export const analyzeMinutesImport = (data: {group_id: string; file_id: string}) =>
  apiClient.post('/v1/minutes/import/analyze', data);
export const confirmMinutesImport = (data: {...}) => apiClient.post('/v1/minutes/import/confirm', data);
```

Minden `group_id` a hívó oldalon a már meglévő `normalizeGroupId`
mintával kerül előkészítésre, ha az adott hívási helyen szükséges
(ugyanúgy, mint `getGroupPermissions`-nál).

## Routing

```
app/[locale]/groups/[groupId]/minutes/
  page.tsx                    — lista (szűrők: státusz, dátum-tartomány; kártya/táblázat nézet)
  new/page.tsx                — kézi létrehozás (fejléc form, utána redirect a részletre)
  import/page.tsx             — AI-import wizard (3 lépés)
  [minutesId]/page.tsx        — részlet (fejléc, napirendi pontok, résztvevők, mellékletek, állapotgép)
```

Minden oldal `'use client'`, a `use(params)` + `decodeURIComponent`
mintát követi (ld. `tasks/page.tsx`), és a
`useGroupPermission()`-ből olvasott `hasPermission('group.minutes.*')`
alapján dönt a megjelenítésről (Silent Policy: olvasási jog nélkül
`null`-t rendereld, ahogy a `tasks/page.tsx` teszi).

## Navigáció

`lib/permissions/access.ts`:

```ts
export type NavKey = ... | 'minutes' | ...;

navPermissionRequirements.minutes = 'GROUP_ONLY';
groupNavPermissionRequirements.minutes = {anyOf: ['group.minutes.read']};
groupRoutePermissionRequirements.minutes = {anyOf: ['group.minutes.read']};
```

`components/layout/Sidebar.tsx`:

```ts
navIcons.minutes = ScrollText; // lucide-react, még nincs importálva
navKeys: [..., 'tasks', 'minutes', 'calendar', ...] // Tasks és Calendar közé
resolveHref: key === 'minutes' → `/${locale}/groups/${encodedGroupId}/minutes`
```

## UI komponensek

`components/groups/minutes/` alá, a `groups/tasks/` szerkezetét
követve:

- **`MinutesListClient.tsx`** — a `TaskClientWrapper.tsx` mintája:
  state (lista, szűrők, lapozás), `listMinutes` hívás, kártya-lista
  render, "Új jegyzőkönyv" / "Import" gombok (jogosultságtól függően).
- **`MinutesCard.tsx`** — egy sor a listában: tárgy, dátum, státusz-badge,
  verzió-jelző.
- **`MinutesStatusBadge.tsx`** — a 4 státusz vizuális jelzése (DRAFT
  szürke, PENDING_APPROVAL sárga, APPROVED zöld+lakat, ARCHIVED
  szürkített).
- **`MinutesFormModal.tsx` vagy `new/page.tsx` inline form** — fejléc
  mezők (subject, meeting_date, location, minute_taker_id — a Tasks
  `assigneer` választó mintáját követve egy csoporttag-dropdown).
- **`MinutesDetailClient.tsx`** — a részlet-oldal fő komponense:
  `getMinutes` hívás, majd al-szekciók renderelése; `status === 'DRAFT'`
  alapján dönt a szerkesztő UI aktív/rejtett állapotáról.
- **`AgendaItemList.tsx`** + **`AgendaItemCard.tsx`** — napirendi pontok,
  mindegyikben a `MarkdownEditor` a `discussion`/`decision` mezőkhöz
  (csak DRAFT-ban szerkeszthető, egyébként `prose` + `dangerouslySetInnerHTML`
  read-only render), beágyazott `ActionItemRow.tsx` lista "Task-ká
  alakítás" gombbal.
- **`ParticipantsPanel.tsx`** — résztvevő lista + hozzáadás/eltávolítás
  (csoporttag-dropdown VAGY szabad `display_name`), "Résztvevők
  előtöltése az eseményből" gomb, ha van `calendar_event_id`.
- **`WitnessPanel.tsx`** — a `participants.filter(p => p.role === 'WITNESS')`
  alapján: ki hogyan szavazott; Jóváhagyás/Elutasítás gomb csak akkor,
  ha a bejelentkezett user `user_id`-ja szerepel a witness listában.
- **`AttachmentsPanel.tsx`** — a meglévő Files feltöltési komponenshez
  kapcsolódva (upload/start → complete → `linkAttachment`), lista +
  törlés (`unlinkAttachment`), "PDF exportálás" gomb (`exportMinutesPdf`
  → a kapott `file_id`-vel a meglévő Files letöltési flow).
- **`MinutesStateActions.tsx`** — Finalize / Revise gombok, a megfelelő
  jogosultság és állapot-feltételek mögött.
- **`MinutesImportWizard.tsx`** (az `import/page.tsx` alatt) — 3 lépés:
  1. fájlfeltöltés (meglévő Files upload komponens újrahasznosítva),
  2. `analyzeMinutesImport` hívás + loading state, 503 esetén hibaüzenet
     és visszalépés,
  3. szerkeszthető review-form (`MinutesImportProposal` mezőire épülő
     form, `MarkdownEditor` a discussion/decision mezőkhöz,
     csoporttag-választó a `display_name`/`assignee_name` mezőkhöz) →
     `confirmMinutesImport`.

## Rich text integráció

A `MarkdownEditor` komponens **nincs módosítva** funkcionálisan — a
`Link` extension már `autolink: true` és `openOnClick: false`
beállítással benne van, tehát a hivatkozás-beszúrás (toolbar `Link2`
gomb → URL prompt → `setLink`) azonnal elérhető, amint a komponenst az
`AgendaItemCard`/`MinutesImportWizard` beköti a `discussion`/`decision`
mezőkre. Az `i18n` prop kitöltéséhez új fordítási kulcsok kellenek a
`group_minutes.editor` névtér alatt (a Posts modul meglévő
`MarkdownEditorI18n` kitöltési mintáját másolva).

Read-only megjelenítés (PENDING_APPROVAL/APPROVED/ARCHIVED állapotban,
vagy a lista nézetben): `<div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: discussion}} />`.

## Hibakezelés

`lib/i18n/minutes.ts` — a `translateTaskApiError` mintáját követve: a
9. fejezetben (felhasználó által megadott doksi) felsorolt
`ValidationError`/`PermissionDeniedError`/`RecordNotFoundError`/
`FeatureDisabledError`/`MinutesExtractionError`/`MinutesAIStructuringError`
szövegek → magyar UI-üzenetek map-je, `toast.error(...)` hívásokhoz.

## Jogosultságok

A `permissions` prop objektum a `page.tsx`-ekben a `tasks/page.tsx`
mintáját követi:

```ts
const permissions = {
  minutes: {
    create: hasPermission('group.minutes.create'),
    read: hasPermission('group.minutes.read'),
    modify: hasPermission('group.minutes.modify'),
    delete: hasPermission('group.minutes.delete'),
    attachmentManage: hasPermission('group.minutes.attachment.manage'),
    finalize: hasPermission('group.minutes.finalize'),
    approve: hasPermission('group.minutes.approve')
  }
};
```

A `witness/vote` gombok emellett rekord-szintű ellenőrzést is végeznek
(saját `user_id` szerepel-e WITNESS-ként a `participants[]`-ben) — ez
NEM helyettesíthető a jogosultság-map-pel, mert a backend is külön
ellenőrzi (403, ha a jog megvan, de a felvétel hiányzik).

## i18n

Új névtér: `messages/en.json` és `messages/hu.json` →
`group_minutes` kulcs alatt, alnévterekkel: `list`, `detail`,
`form`, `status`, `participants`, `witness`, `attachments`,
`import`, `editor` (a `MarkdownEditorI18n` interfészhez), `errors`.
A meglévő `tasks`/`posts` névterek szerkezetét követi (lapos
kulcs-érték párok, nem beágyazott ICU-üzenetek, hacsak nincs
paraméterezés, pl. `{count}-ból {approved} hitelesítő jóváhagyta`).

## Tesztelés

- Manuális UI-verifikáció a `run` skillel: teljes flow végigfuttatása
  (create → agenda item + rich text + hivatkozás beszúrása → participant
  hozzáadása WITNESS szerepkörrel → finalize → witness vote → approved
  állapot ellenőrzése → revise → új DRAFT verzió létrejötte).
- Import wizard: feltöltés → analyze (vagy 503 fallback, ha a backend
  flag ki van kapcsolva a teszt-környezetben) → review → confirm.
- Jogosultság-mátrix ellenőrzése: olyan felhasználóval is tesztelni,
  akinek nincs egyik `group.minutes.*` joga sem (a nav-elem nem
  jelenhet meg, az oldal `null`-t renderel).
