# Files UI – 1. fázis: Layout javítások Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `FileGrid` kártyák ikon-elrendezésének javítása (ne hagyjon üres
sávot széles/16:9 elrendezésnél), és a lista nézet elrejtése mobil
viewportban (`<768px`), ahol csak a grid nézet legyen választható.

**Architecture:** Tiszta CSS/JSX átalakítás, nincs új állapotkezelés vagy
API-hívás. A `FileGrid.tsx` kártya belső elrendezése vízszintes
ikon+szöveg elrendezésre vált a jelenlegi "ikon felül, teljes szélességű
sáv" helyett. A `FilesFeed.tsx`-ben a már meglévő `hooks/useMediaQuery.ts`
hook-kal detektáljuk a `<768px` viewportot, és ez alapján kényszerítjük a
`view` state-et `'grid'`-re, illetve rejtjük el a lista nézet gombot.

**Tech Stack:** Next.js (App Router), React, Tailwind CSS (inline
`className`, projekt CSS-változókkal, pl. `var(--text-tertiary)`),
`next-intl` (i18n), meglévő `hooks/useMediaQuery.ts` hook.

**Spec:** `docs/superpowers/specs/2026-09-02-files-ui-interactions-design.md`
(1. fázis szakasz)

## Global Constraints

- Ne törj hydration-t: a viewport-alapú state-nek szerver-oldalon a jelenlegi
  fallback-hoz (`'list'` induló state, majd client-only effekt igazítja) kell
  igazodnia — ugyanaz a minta, mint amit a `hooks/useMediaQuery.ts` már
  alkalmaz (lásd a fájl tetején lévő kommentet).
- A meglévő CSS-változó-alapú színezést (`var(--text-tertiary)`,
  `var(--bg-elevated)` stb.) és a 44px minimum touch-target konvenciót
  (`min-h-11 min-w-11`) meg kell tartani minden módosított elemen.
- Ne változtass a `renderActions`, `onOpenFile`, `onOpenFolder`,
  `onToggleStar`, `onToggleSelect` prop-interfészeken — ezekre a következő
  fázisok épülnek.
- Ne vezess be új i18n kulcsot ebben a fázisban, kivéve, ha egy step
  kifejezetten kéri (jelen fázisban nincs ilyen).

---

## Fájlstruktúra

- **Módosítva:** `components/files/FileGrid.tsx` — a kártya belső
  elrendezése (ikon + szöveg-blokk) vízszintes elrendezésre vált.
- **Módosítva:** `components/files/FilesFeed.tsx` — mobil viewportban a
  lista nézet gomb elrejtése és a `view` state kényszerítése `'grid'`-re.

Nincs új fájl ebben a fázisban.

---

### Task 1: `FileGrid` kártya ikon-elrendezésének javítása

**Files:**
- Modify: `components/files/FileGrid.tsx:93-101`

**Interfaces:**
- Consumes: `EntryListProps` (`entryTypes.ts`) — nem változik.
- Produces: nincs új export, a komponens publikus API-ja (props) változatlan.

A jelenlegi kód egy önálló, teljes szélességű `h-16` sávban jeleníti meg az
ikont/thumbnailt, a szöveg-blokk pedig alatta, külön sorokban:

```tsx
<div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]">
  {entry.kind === 'folder' ? (
    <Folder size={28} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
  ) : entry.mime_type?.startsWith('image/') ? (
    <ThumbnailImage fileId={entry.id} mimeType={entry.mime_type} alt={entry.original_name} />
  ) : (
    <FileTypeIcon mimeType={entry.mime_type} size={28} />
  )}
</div>

<span className="w-full truncate text-sm font-medium text-[var(--text-primary)]" title={getEntryName(entry)}>
  {getEntryName(entry)}
</span>
<span className="text-xs text-[var(--text-tertiary)]">
  {entry.kind === 'folder' ? t('table.folderType') : `${formatMimeType(entry.mime_type)} · ${formatFileSize(entry.size_bytes)}`}
</span>
{dateIso && <span className="text-xs text-[var(--text-tertiary)]">{formatUploadedAt(dateIso)}</span>}
```

Ez ad egy nagy, üres sávot a kártya tetején, ha a kártya széles (kevés
oszlop, széles ablak — pl. 16:9 monitoron kevesebb kártya fér el egy sorba
relatíve nagyobb szélességgel).

Cél elrendezés: az ikon egy kisebb, fix méretű (`h-10 w-10`) blokkban a bal
oldalon, a szöveg-blokk (név + típus/méret + dátum) tőle jobbra, egy sorban
("flex-row" a kártya belső wrapperén, ahelyett hogy minden elem "flex-col"
lenne egymás alatt). Mivel a kártya `grid` cellái amúgy is korlátozott
szélességűek (`grid-cols-2` … `lg:grid-cols-5`), ez az elrendezés nem lesz
zsúfolt, és nem hagy üres sávot.

- [ ] **Step 1: Írd át a kártya belső JSX-ét vízszintes elrendezésre**

`components/files/FileGrid.tsx` — a teljes kártya `<div key={entry.id} ...>`
gyermek-JSX-ét (a checkbox/star gombok kivételével, azok maradnak
változatlanul, abszolút pozicionálva) cseréld erre:

```tsx
            <div className="flex w-full items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg-elevated)]">
                {entry.kind === 'folder' ? (
                  <Folder size={20} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
                ) : entry.mime_type?.startsWith('image/') ? (
                  <ThumbnailImage fileId={entry.id} mimeType={entry.mime_type} alt={entry.original_name} />
                ) : (
                  <FileTypeIcon mimeType={entry.mime_type} size={20} />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="w-full truncate text-sm font-medium text-[var(--text-primary)]" title={getEntryName(entry)}>
                  {getEntryName(entry)}
                </span>
                <span className="truncate text-xs text-[var(--text-tertiary)]">
                  {entry.kind === 'folder' ? t('table.folderType') : `${formatMimeType(entry.mime_type)} · ${formatFileSize(entry.size_bytes)}`}
                </span>
              </div>
            </div>
            {dateIso && <span className="text-xs text-[var(--text-tertiary)]">{formatUploadedAt(dateIso)}</span>}
```

A `dateIso` sort szándékosan a vízszintes blokkon kívül, a kártya alján
hagyjuk (külön sorban) — ez fér el a legjobban, és nem zsúfolja a
cím/típus sort.

- [ ] **Step 2: Ellenőrizd a teljes módosított fájlt**

Olvasd vissza `components/files/FileGrid.tsx`-et, és győződj meg róla, hogy
a `Folder`, `ThumbnailImage`, `FileTypeIcon` importok továbbra is
használatban vannak (nem lett belőlük unused import), és a checkbox/star
abszolút pozicionált blokkjai (`absolute left-2 top-2 ...`,
`absolute right-2 top-2 ...`) és az actions blokk (`absolute bottom-2
right-2 ...`) változatlanok maradtak.

- [ ] **Step 3: Indítsd el a dev szervert és nézd meg böngészőben**

Run: `npm run dev` (ha még nem fut), majd nyisd meg a Files nézetet grid
módban, széles (pl. 1920×1080, 16:9) böngészőablakban.

Expected: az ikon és a fájlnév egy sorban jelenik meg, nincs nagy üres sáv
a kártya tetején; a kártyák nem zsúfoltak keskeny (mobil szimulált)
nézetben sem (Chrome DevTools device toolbar, pl. iPhone 12 profil).

- [ ] **Step 4: TypeScript és lint ellenőrzés**

Run: `npx tsc --noEmit` és `npm run lint` (vagy a projektben konfigurált
egyenértékű parancsok — ellenőrizd `package.json` `scripts` szekcióját, ha
ezek a nevek nem egyeznek).

Expected: nincs új hiba a `FileGrid.tsx`-hez kapcsolódóan.

- [ ] **Step 5: Commit**

```bash
git add components/files/FileGrid.tsx
git commit -m "fix(files): grid card icon layout for wide viewports"
```

---

### Task 2: Lista nézet elrejtése mobil viewportban

**Files:**
- Modify: `components/files/FilesFeed.tsx:1-42` (import + típus/state), `components/files/FilesFeed.tsx:292-299` (toolbar gombok), `components/files/FilesFeed.tsx:315-341` (nézet-választás renderelése)

**Interfaces:**
- Consumes: `useMediaQuery(query: string): boolean` a `hooks/useMediaQuery.ts`-ből (már létező, exportált hook — nincs módosítás rajta).
- Produces: nincs új export a `FilesFeed`-ből.

A jelenlegi kód (`FilesFeed.tsx:68`) egy sima `useState<ViewMode>('list')`-et
tart karban, amit a felhasználó a 293-298. sorbeli két gombbal vált. Nincs
semmilyen viewport-alapú kényszerítés. A cél: `<768px` alatt a lista nézet
gomb ne jelenjen meg, és a `view` automatikusan `'grid'`-re álljon (akkor is,
ha a felhasználó korábban `'list'`-et választott asztali nézetben — a
mobil nézet mindig grid).

- [ ] **Step 1: Importáld a `useMediaQuery` hookot**

`components/files/FilesFeed.tsx` tetején, a többi hook-import mellé
(`usePagedDualList`, `useUploadQueue` mellé, kb. 15-16. sor környékén):

```tsx
import { useMediaQuery } from '@/hooks/useMediaQuery';
```

- [ ] **Step 2: Vezesd be az `isMobile` flaget és igazítsd hozzá a `view`-t**

A `view` state deklarációja után (`FilesFeed.tsx:68` körül), adj hozzá egy
`isMobile` konstanst és egy effektust, ami mobilon kényszeríti a
`'grid'`-et:

```tsx
  const [view, setView] = useState<ViewMode>('list');
  const isMobile = useMediaQuery('(max-width: 767px)');
  const effectiveView: ViewMode = isMobile ? 'grid' : view;
```

Megjegyzés: szándékosan nem magát a `view` state-et írjuk felül
`setView`-vel egy `useEffect`-ben (az extra re-rendert és a
"felhasználó visszaváltott asztalira, de a state már felülíródott"
problémát elkerülendő) — helyette egy származtatott `effectiveView`
értéket használunk mindenhol, ahol eddig `view`-t olvastunk ki
(a `view === 'grid' ? ... : ...` elágazásban), a `view` state maga
csak a gombok saját, asztali választását tárolja tovább.

- [ ] **Step 3: Rejtsd el a lista nézet gombot mobilon**

`FilesFeed.tsx:292-299` (a nézetváltó gombpár) cseréld erre:

```tsx
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] p-1">
            {!isMobile && (
              <button type="button" aria-label={t('toolbar.view.list')} onClick={() => setView('list')} className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${effectiveView === 'list' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
                <List size={15} strokeWidth={1.75} />
              </button>
            )}
            <button type="button" aria-label={t('toolbar.view.grid')} onClick={() => setView('grid')} className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] ${effectiveView === 'grid' ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
              <LayoutGrid size={15} strokeWidth={1.75} />
            </button>
          </div>
```

- [ ] **Step 4: Használd az `effectiveView`-t a nézet-választásnál**

`FilesFeed.tsx:321` (`) : view === 'grid' ? (`) cseréld:

```tsx
      ) : effectiveView === 'grid' ? (
```

- [ ] **Step 5: Ellenőrizd, hogy nincs más helyen `view` közvetlen olvasás**

Futtasd:

```bash
grep -n "view ===" components/files/FilesFeed.tsx
```

Expected: csak az `effectiveView === 'grid'` sor (Step 4) és a két gomb
`effectiveView === 'list'` / `effectiveView === 'grid'` className-kifejezése
(Step 3) maradt — nincs más hely, ahol a nyers `view`-t olvasnánk ki
megjelenítési döntéshez.

- [ ] **Step 6: Indítsd el a dev szervert és teszteld mindkét viewportban**

Run: `npm run dev`, majd Chrome DevTools device toolbar-ral szimulálj egy
`<768px` széles nézetet (pl. iPhone 12, 390px).

Expected: mobil nézetben csak a grid-ikon gomb látszik a toolbar-on, a
lista nézet gomb nincs ott, és a tartalom grid nézetben jelenik meg
függetlenül attól, mit választott korábban a felhasználó asztali nézetben.
Ablakot desktop szélességre (`>=768px`) visszaméretezve mindkét gomb újra
megjelenik, és a `view` state (lista/grid) visszaáll arra, amit korábban
választott.

- [ ] **Step 7: TypeScript és lint ellenőrzés**

Run: `npx tsc --noEmit` és `npm run lint`.

Expected: nincs új hiba.

- [ ] **Step 8: Commit**

```bash
git add components/files/FilesFeed.tsx
git commit -m "fix(files): force grid view and hide list toggle on mobile"
```

---

## Self-Review (elvégezve a terv írásakor)

1. **Spec-lefedettség:** a spec 1. fázisának mindkét pontja (`FileGrid`
   ikon-elrendezés, mobil lista-nézet elrejtés) lefedve Task 1 / Task 2
   által.
2. **Placeholder-ellenőrzés:** nincs "TODO"/"implement later" jellegű
   lépés, minden step konkrét kódot vagy konkrét parancsot tartalmaz.
3. **Típus-konzisztencia:** `ViewMode` típus (`'list' | 'grid'`)
   változatlan; az új `effectiveView` ugyanezt a típust veszi fel; a
   `useMediaQuery` hook szignatúrája (`(query: string) => boolean`)
   megegyezik a `hooks/useMediaQuery.ts`-ben már létezővel.
