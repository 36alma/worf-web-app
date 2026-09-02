# Files UI – hiányzó interakciók (menük, DnD, layout) design

Dátum: 2026-09-02
Státusz: jóváhagyva, implementációra vár

## Kontextus

A `components/files/*` fájlkezelő UI (`FileTable`, `FileGrid`, `FilesFeed`,
`EntryActionsMenu`, `FileDetailSheet`, `PreviewModal`, `FolderDetailSheet`,
`ShareModal`) egy korábbi ágon (`feature/files-drive-ui`) épült fel, de
felhasználói tesztelés közben a következő hiányosságok/hibák derültek ki:

1. **Nincs drag-and-drop mozgatás.** A backend (`POST /v1/files/move`,
   `POST /v1/folders/move`) és a UI-oldali `MoveToFolderDialog.tsx` +
   `BulkActionBar.tsx` már elkészült, de egyik sincs bekötve a
   `FilesFeed`-be — a `BulkActionBar` importja élő, de a JSX-ben soha nem
   renderelődik.
2. **Nincs jobbklikk context menu.** A `@radix-ui/react-context-menu` csomag
   telepítve van, de nincs hozzá wrapper komponens és sehol nincs használva.
   Az egyetlen per-sor/per-kártya menü a kebab gomb (`EntryActionsMenu`),
   ami csak Download/Rename/Star/Delete-et tud.
3. **Kattintásra a Details nyílik, nem a Preview**, és a Preview csak a
   Details sheeten belülről, egy extra kattintással, csak képekre érhető el.
   A Metadata nem önálló felület, hanem a Details sheet alapértelmezett tabja.
4. **A mappáknak nincs saját menüpontjuk/panel-jük.** `FolderDetailSheet.tsx`
   explicit placeholder stub (`// Placeholder — Task 32 replaces this body`),
   nincs bekötve sehova. A megosztás/jogosultság UI (`ShareModal`,
   `ShareUserTab`, `ShareGroupTab`) generikusan már támogatja a
   `kind: 'folder'`-t, csak nincs belépési pont hozzá mappa sorból.
5. **A grid nézet ikon-elrendezése rossz széles (16:9) elrendezésnél.**
   `FileGrid.tsx` az ikont egy önálló, teljes szélességű `h-16` sávban
   jeleníti meg a név/metaadat szöveg felett — ez széles kártyáknál nagy,
   üresnek ható sávot hagy.
6. **Mobilon a lista nézet is választható, pedig használhatatlan.** A
   nézetváltás (`view` state, `FilesFeed.tsx`) teljesen manuális, és csak a
   munkamenet idejére emlékszik rá (a `VIEW_MODE_STORAGE_KEY`/`toViewMode`
   `localStorage`-kód elő van készítve, de nincs ténylegesen bekötve —
   holt kód); nincs breakpoint-alapú kényszerítés grid nézetre kis
   képernyőn.
7. **Nincs long-press support mobilon.** A `PreviewModal` swipe-navigációján
   kívül semmilyen touch-alapú long-press logika nincs a Files kódban.

## Célok

1. Egységes, közös akciólista-builder, amit mindhárom belépési pont
   (jobbklikk context menu, kebab dropdown, long-press bottom sheet)
   ugyanúgy használ — típus- (fájl/mappa) és jogosultság-alapú szűréssel.
2. Kattintásra Preview nyíljon meg támogatott típusnál, egyébként Details.
3. Fájl/mappa húzása (drag-and-drop) másik mappára vagy a breadcrumb-ra,
   a meglévő move endpointokra és `MoveToFolderDialog`/`BulkActionBar`
   komponensekre építve.
4. Mappáknak saját Details/Share/Audit panelje legyen, ugyanúgy elérhető
   menüből, mint fájloknál.
5. Grid nézet ikon-elrendezésének javítása, hogy széles arányban se legyen
   csúnya, üres sáv.
6. Mobilon (`<768px`) a lista nézet ne legyen választható, csak grid.

## Nem célok

- Nincs új backend endpoint bevezetése — csak a meglévő `file-api.md`-ben
  dokumentált végpontokra építünk.
- Mappák másolása (nincs `POST /v1/folders/copy` endpoint) — kimarad.
- Teljes körű multi-select drag-and-drop reorder (pl. sorrend perzisztálás)
  — csak mappák közötti áthelyezés, nem sorrendezés.
- Keresés/full-text — nem témája ennek a spec-nek.

## Explicit döntések

Ezeket a felhasználó jóváhagyta; implementáció közben nem kérdőjelezzük meg.

- Kattintásra fájlon: **Preview** nyílik meg, ha a típus támogatott
  (jelenleg: kép); egyébként **Details** sheet nyílik (metaadat fallback).
- A jobbklikk context menu, a kebab dropdown és a mobil long-press
  bottom sheet **ugyanazt az akciólistát** rendereli — egy közös
  builder-függvényből, csak a megjelenítési forma tér el.
- Mobilon long-press ugyanazt a bottom sheetet nyitja meg, mint a kebab
  gomb — **nem** lép be egy külön többes-kijelölés módba.
- Drag-and-drop hatóköre: fájl/mappa húzása másik mappa sorára/kártyájára
  **és** a breadcrumb korábbi szintjeire; többes kijelölés esetén az összes
  kijelölt elem együtt mozog.
- Mappa "jogkörök" menüpontja a **teljes `FolderDetailSheet` kiépítését**
  jelenti (Metadata + Share + Audit tab, a `FileDetailSheet` mintájára),
  nem csak egy közvetlen Share-gombot.
- Implementáció **funkcióról funkcióra** halad, az alábbi öt fázisban, a
  fázisok sorrendjében, egymástól függetlenül tesztelhető/leszállítható
  egységekben.

## Architektúra

### Közös akciólista-builder

A jelenlegi `FilesFeed.buildActionItems` (`FilesFeed.tsx:208-242`) alapján
egy bővített `buildEntryActions(entry, context)` függvény jön létre, ami
egy `ActionItem[]`-et ad vissza (`{ id, label, icon, onSelect, disabled?,
destructive? }` alakban — ugyanaz a forma, amit az `EntryActionsMenu` már
ma is fogyaszt). A lista tartalma típus- és jogosultság-függő:

| Akció | Fájl | Mappa | Feltétel |
|---|---|---|---|
| Preview | ✓ | – | támogatott típus |
| Details | ✓ | ✓ | mindig |
| Megnyitás | – | ✓ | mindig (navigáció a mappába) |
| Megosztás/Jogosultságok | ✓ | ✓ | `is_owner` vagy `can_share` |
| Áthelyezés | ✓ | ✓ | `can_edit` a forráson |
| Átnevezés | ✓ | ✓ | `can_edit` |
| Csillagozás | ✓ | ✓ | mindig |
| Letöltés | ✓ | – | `can_download` |
| Törlés | ✓ | ✓ | `can_delete` |

Ez a builder egyetlen helyen (`components/files/entryActions.ts`, új fájl)
él, és mindhárom felület (`ContextMenu`, `EntryActionsMenu` dropdown,
`SideSheet` bottom sheet) ugyanazt a listát fogyasztja el, csak eltérő
Radix primitívekkel rendereli.

### Komponensek

- **`components/ui/ContextMenu.tsx`** (új) — Radix
  `@radix-ui/react-context-menu` wrapper, a meglévő `DropdownMenu.tsx`
  stílus-konvencióit követve.
- **`components/files/useLongPress.ts`** (új) — hook, ami `onTouchStart`/
  `onTouchEnd`/`onTouchMove` alapján ~500ms threshold és mozgástűrés
  (elmozdulás > ~10px esetén megszakítás, hogy scrollnál ne triggerelődjön)
  után hívja a callback-et.
- **`FileGrid.tsx`** — az ikon-blokk átalakítása: kisebb, fix méretű ikon a
  szöveg mellett/felett, kompaktabb `aspect`-arány-független elrendezéssel.
- **`FilesFeed.tsx`** — `useMediaQuery('(min-width: 768px)')`-cel a nézet
  gomb csoport elrejtése/`view` kényszerítése `'grid'`-re mobilon; a
  `DndContext` bevezetése; a `BulkActionBar` tényleges renderelése.
- **`FolderDetailSheet.tsx`** — kiépítés `FileDetailSheet.tsx` mintájára:
  Metadata tab (név, méret — rekurzív elem-szám, létrehozás dátuma,
  tulajdonos), Share tab (a meglévő `ShareModal`/`ShareUserTab`/
  `ShareGroupTab` `kind: 'folder'` módban), Audit tab (ha van hozzá
  végpont — ellenőrizendő `file-api.md`-ben implementáció közben).

### Drag-and-drop adatfolyam

`@dnd-kit/core` `DndContext` a `FilesFeed`-ben:

1. Minden `FileTable` sor / `FileGrid` kártya `useDraggable({ id: entry.id,
   data: { entry } })`.
2. Minden mappa-sor/kártya és minden breadcrumb-elem `useDroppable({ id:
   folderId })`.
3. `onDragEnd`: ha `over` egy mappa és `active` nem ugyanaz a mappa és nem
   annak leszármazottja (kliensoldali guard, a backend úgyis 409-et ad
   önmagába/leszármazottba mozgatásnál), akkor a kijelölt elemek (vagy csak
   a húzott elem, ha nincs kijelölés) `moveFile`/`moveFolder` hívást kapnak,
   `Promise.allSettled`-del, majd toast összegzés (`N elem áthelyezve, M
   sikertelen`) és lista-refresh.
4. Vizuális visszajelzés: húzás közben a droppable mappa kiemelése
   (`ring`/`bg` állapot `isOver`-re), a húzott elem félig átlátszó overlay-e
   (`DragOverlay`).

### Adatfolyam — Preview/Details

`onOpenFile` szétválik: ha `isPreviewable(entry)` (jelenleg: kép MIME-ek),
`setPreviewFileId(entry.id)` (közvetlenül nyitja a `PreviewModal`-t, a
Details sheet megkerülésével); egyébként a jelenlegi `setSelectedFileId`
út marad (Details sheet). A `PreviewModal`-on belüli "Info" gomb továbbra
is átvált Details-re, változatlanul.

## Hibakezelés

- DnD move hiba (403/409/hálózati): toast hibaüzenet, a lista nem
  frissül optimistán — csak sikeres backend-válasz után hívjuk újra a
  `listFolder`-t, így nincs inkonzisztens UI-állapot.
- Context menu / long-press: ha egy akció (pl. Megosztás) nem elérhető a
  jogosultság miatt, az adott menüpont `disabled`, nem tűnik el teljesen —
  konzisztens azzal, ahogy a mai `EntryActionsMenu` a Download-ot kezeli.
- Preview fallback: ha a kép betöltése hibázik, a `PreviewModal` már ma is
  kezel egy hibaállapotot (`noPreview` i18n kulcs) — ezt nem kell
  módosítani.

## Fázisok (funkcióról funkcióra, ebben a sorrendben)

### 1. fázis — Layout javítások
- `FileGrid.tsx` ikon-elrendezés javítása (nincs többé önálló `h-16`
  teljes szélességű sáv).
- `FilesFeed.tsx`: `<768px` alatt a lista nézet gomb eltűnik, `view`
  kényszerítve `'grid'`-re (a munkamenet idejére emlékezett `'list'`
  választás mobilon figyelmen kívül marad, de asztalon visszaáll).
- Érintett fájlok: `components/files/FileGrid.tsx`,
  `components/files/FilesFeed.tsx`.

### 2. fázis — Preview alapértelmezett megnyitás + akciólista-builder
- `components/files/entryActions.ts` létrehozása, `buildActionItems`
  logikájának kiemelése/bővítése ide.
- `onOpenFile` szétválasztása Preview/Details között.
- Kebab menü bővítése Details/Preview/Megosztás menüpontokkal.
- Érintett fájlok: `components/files/entryActions.ts` (új),
  `FilesFeed.tsx`, `EntryActionsMenu.tsx`, `FileTable.tsx`, `FileGrid.tsx`.

### 3. fázis — Jobbklikk context menu + long-press
- `components/ui/ContextMenu.tsx` (új).
- `components/files/useLongPress.ts` (új).
- Bekötés `FileTable`/`FileGrid` sorokba/kártyákba, a 2. fázisban
  létrehozott `entryActions.ts`-t fogyasztva.
- Érintett fájlok: `components/ui/ContextMenu.tsx` (új),
  `components/files/useLongPress.ts` (új), `FileTable.tsx`, `FileGrid.tsx`.

### 4. fázis — Mappa jogkörök panel
- `FolderDetailSheet.tsx` kiépítése (Metadata + Share + Audit tab).
- Bekötés a mappa akciólistájába (`entryActions.ts` "Megosztás/
  Jogosultságok" és "Details" pontjai mappánál erre nyissanak).
- Érintett fájlok: `FolderDetailSheet.tsx`, `entryActions.ts`,
  `FilesFeed.tsx`.

### 5. fázis — Drag-and-drop mozgatás
- `DndContext` bevezetése, `useDraggable`/`useDroppable` bekötése.
- `BulkActionBar` tényleges renderelése (élő import már van, JSX hiányzik).
- Érintett fájlok: `FilesFeed.tsx`, `FileTable.tsx`, `FileGrid.tsx`,
  `FilesBreadcrumb.tsx`, `BulkActionBar.tsx` (bekötés).

## Tesztelés

Minden fázis végén manuális ellenőrzés böngészőben (asztali + mobil
viewport, Chrome DevTools device toolbar), az adott fázis funkcióira
fókuszálva:

- 1. fázis: grid nézet 16:9 ablakban, mobil viewportban lista nézet nem
  választható.
- 2. fázis: kép fájlra kattintás → Preview; nem-kép fájlra kattintás →
  Details; kebab menüben Details/Preview/Megosztás elérhető.
- 3. fázis: jobbklikk asztalon → context menu ugyanazokkal a
  menüpontokkal, mint a kebab; mobil emulációban long-press → bottom
  sheet.
- 4. fázis: mappa kebab/context menüből Details → Metadata/Share/Audit
  tabok működnek, jogosultság-vezérelt Share tab.
- 5. fázis: fájl/mappa húzása másik mappára és breadcrumb-ra, többes
  kijelöléssel is; hibás (pl. sajátmagába mozgatás) eset toast-tal.

Unit/komponens teszt a projektben jelenleg nincs kiterjedt lefedettséggel
a Files területen — ha van meglévő teszt-infrastruktúra
(`__tests__`/`*.test.tsx`), az érintett fázisokban a builder-logikát
(`entryActions.ts`) érdemes unit teszttel lefedni, mivel az tiszta
függvény jogosultság-alapú elágazásokkal.
