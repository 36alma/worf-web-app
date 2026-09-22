# Dashboard végpontok — összefoglaló frontendnek

> Forrás: a backend által átadott dokumentum (2026-09-20). A dashboard **csoportokon átívelő** végpontjait írja le: mit adnak vissza, milyen jogosultsággal, hogyan kell hívni és megjeleníteni őket. Teljes API-referencia: `api_endpoind.md` (az új végpontok még nincsenek benne), jogosultságok: `permission.md`.
>
> **Frontend megjegyzés:** a hívások a `/api/proxy`-n mennek át (`lib/api/client.ts`), a proxy teszi a `Bearer` tokent a body-ba — a kliensnek nem kell küldenie. A csoportokon átívelő oldal nincs, ezért a KPI kártyák a dashboard saját widgetjeire görgetnek.

## 1. Miért van rájuk szükség

Eddig a dashboard élő adatait csoportonkénti hívásokból kellett összerakni (N csoport = N kérés, közben a 120 kérés / 2 perc rate limit is fenyeget). Az alábbi négy új végpont **user-scope-os**: nem kapnak `group_id`-t, hanem a token tulajdonosának **összes csoportjából** adják vissza az adatot, egyetlen kéréssel — ugyanúgy, ahogy a `POST /v1/minutes/witness/pending/all` már működött.

| Végpont | Widget |
|---|---|
| `POST /v1/dashboard/summary` | 3 KPI kártya + Welcome kártya döntése |
| `POST /v1/task/panel/all` | "Hozzám rendelt feladatok" |
| `POST /v1/group/calendar/upcoming/all` | "Közelgő események" |
| `POST /v1/dashboard/activity` | "Legutóbbi tevékenységek" |
| `POST /v1/minutes/witness/pending/all` *(meglévő)* | PendingWitnessCard — mostantól `group_name`-mel |

> A tervben `/v1/calendar/upcoming/all` és `/v1/activity/feed` szerepelt; a meglévő útvonal-szerkezetbe illesztve a naptár a `/v1/group/calendar/...` alá, a feed a `/v1/dashboard/...` alá került.

## 2. Közös szabályok (mind a négyre igaz)

### 2.1 Hívás
- Mindegyik **POST**, JSON body, a token a body-ban: `{ "Bearer": "<access_token>", ... }`.
- **Ismeretlen mező tiltott** (`extra = forbid`): a body-ban csak a dokumentált mezők szerepelhetnek, különben `422`.
- A mezők közül csak a `Bearer` kötelező, mindegyiknek van alapértéke.

### 2.2 Jogosultság: csendes kihagyás, nincs 403
A csoportonkénti jogot a **szerver** ellenőrzi a lekérdezésben. Ahol a usernek nincs meg a szükséges csoportjoga (vagy már nem tag), onnan **egyszerűen nem jön adat** — nem kell kezelni, és nem kap 403-at az egész kérés.

| Végpont | Szükséges csoportjog(ok) csoportonként |
|---|---|
| `task/panel/all` | `group.task.read` |
| `group/calendar/upcoming/all` | `group.calendar.read` **és** `group.calendar.event.read` |
| `dashboard/activity` | task-események: `group.task.read`; jegyzőkönyv-események: `group.minutes.read` |
| `dashboard/summary` | a fentiek mindegyike a saját számához; `group_count` jogtól független |
| `minutes/witness/pending/all` | `group.minutes.read` **és** `group.minutes.approve` |

Inaktív user nem lát semmit. Egy csoport, ahonnan a user kilépett, azonnal eltűnik az összes válaszból.

### 2.3 Elemenként `group_id` és `group_name`
Minden visszaadott elem tartalmazza:
- `group_id` — **titkosított** csoportazonosító (ugyanaz a formátum, mint a `getusergroups`-ban),
- `group_name` — a csoport neve.

Így **nincs szükség külön `getusergroups` hívásra** a csoportnév kiírásához (a witness kártyánál sem).

### 2.4 Titkosított azonosítók: NEM determinisztikusak
Minden opaque azonosító (`group_id`, task `id`, user `user_id`, jegyzőkönyv `id`) **hívásonként más stringet ad ugyanarra az entitásra** (véletlen nonce a titkosításban). Ennek következményei:
- ✅ A kapott azonosító **bármikor visszaküldhető** a többi végpontnak (`task/get`, `task/modify`, `event/modify`, `minutes/get`, a `dashboard/activity` `group_id` szűrője…), mindig ugyanarra az entitásra mutat.
- ❌ **Ne hasonlítsd össze stringként** két azonosítót ("ugyanaz-e a csoport?"), és ne csoportosíts `group_id` string szerint. Megjelenítéshez használd a `group_name`-et; szűrőhöz küldd vissza a kiválasztott elem `group_id`-ját.
- Listakulcshoz (React `key`) stabil érték kell: task → `issue_key`; esemény → `group_calendar_event_id` + `occurrence_start_at` (a `group_calendar_event_id` sima UUID, nem titkosított); feed → az `entity.id` a fentiek miatt **nem** használható kulcsnak, használj `occurred_at` + sorszám kombinációt.

> **Frontend megjegyzés:** az `issue_key` az űrlapon szabadon beírható, csoportok között ütközhet — task-kulcsnak `group_name + issue_key + created_at` kompozitot használunk.

### 2.5 Időbélyegek
- Az **új** mezők (`occurred_at`, `occurrence_start_at/end_at`, `next_event_at`) **ISO 8601 UTC, `Z` végződéssel**: `2026-09-21T12:00:00Z`. Helyi időre a böngésző alakítja.
- A **meglévő** task-mezők (`due_at`, `created_at`, …) változatlanok: időzónás ISO string (pl. `+00:00` eltolással) — a `new Date(...)` mindkettőt jól értelmezi.
- Kivétel az esemény "eredeti" időmezői, ld. 5.3.

### 2.6 Lapozás
- **Offset-lapozás** (`task/panel/all`, `upcoming/all`, witness): kérésben `page_number` (1-től), `load_number`; válaszban `total_*`, `total_pages`, `current_page`. A nevek a witness végponttal egyeznek. (A régi `task/panel` `load_task_number`-t használ — az új végpontnál `load_number`.)
- **Kurzor-lapozás** (`dashboard/activity`): kérésben `before`, válaszban `next_before` (ld. 6.).
- Ha egy oldal a tartományon kívül esik, az eredmény **200 és üres lista**, nem hiba.

### 2.7 Üres állapot
Nincs találat → **200 és üres lista** (`tasks: []`, `events: []`, `items: []`). A régi `task/panel` 404-et adott üres találatnál, az új nem — nincs `catch`-elni való "üres" hiba.

### 2.8 Hibák és rate limit
| Státusz | Mikor |
|---|---|
| `401` | hiányzó/lejárt/visszavont token |
| `422` | hibás kérés (ismeretlen mező, tartományon kívüli szám, hibás dátum/kurzor/típus) |
| `429` | rate limit túllépve — `{"detail":"Too Many Requests"}` |
| `500` | szerverhiba (`{"detail":"Database error."}`) |

A hibatest formátuma: `{ "detail": "<üzenet>" }`.

**Saját rate limitjük van** (kliens-IP + útvonal szerint számolva, tehát a régi csoportonkénti hívásoktól független vödör):

| Végpont | Limit |
|---|---|
| `dashboard/summary` | 60 kérés / 2 perc |
| `task/panel/all` | 120 kérés / 2 perc |
| `group/calendar/upcoming/all` | 60 kérés / 2 perc |
| `dashboard/activity` | 120 kérés / 2 perc |

Egy dashboard-betöltés **4–5 kérés** (a 4 új + witness), függetlenül a csoportok számától. A számlálás IP-alapú, ezért egy közös (pl. iskolai) NAT mögötti userek osztoznak a vödrön — ne pollozz sűrűn; a refresh csak mentés után vagy felhasználói kérésre történjen.

## 3. `POST /v1/dashboard/summary`

**Kérés**
```json
{ "Bearer": "<token>" }
```

**Válasz**
```json
{
  "group_count": 3,
  "open_tasks_count": 7,
  "overdue_tasks_count": 2,
  "upcoming_events_count": 4,
  "next_event_at": "2026-09-21T12:00:00Z",
  "pending_witness_count": 1
}
```

| Mező | Jelentés |
|---|---|
| `group_count` | Hány csoportnak tagja a user (jogoktól független). **`0` → mutasd a Welcome kártyát.** Kiváltja a `getusergroups` válaszának bejárását ("objs:" kulcs, traverse heurisztika). |
| `open_tasks_count` | Hozzám rendelt, **nem DONE**, nem archivált feladatok (csak `group.task.read` csoportokban). |
| `overdue_tasks_count` | Az előbbiből azok, amelyeknek van határideje és az a múltban van. |
| `upcoming_events_count` | A **következő 7 napban** kezdődő **vagy épp tartó** események (kibontott előfordulások száma). |
| `next_event_at` | A következő, **még el nem kezdődött** előfordulás kezdete (UTC), vagy `null`, ha 7 napon belül nincs. Az épp tartó esemény nem számít "következőnek". |
| `pending_witness_count` | Rám váró jegyzőkönyv-hitelesítések száma. |

### Valódi alcímek a hamis "előző hónaphoz képest" helyett
Történeti adat nem kell, az alcímek a jelenlegi állapotból jönnek:
- Feladatok kártya: `"{overdue_tasks_count} lejárt"` (ha `> 0`), különben pl. `"Nincs lejárt"`.
- Események kártya: `"Következő: ma 14:00"` — a `next_event_at`-ből, helyi időre alakítva ("ma" / "holnap" / nap neve). `null` esetén `"Nincs közelgő"`.
- Csoportok kártya: `"{group_count} csoport"`.

### A szám és a mögötte lévő lista mindig egyezik
A KPI kártyára kattintva ugyanezzel a szűréssel nyílik a lista, ezért a szám garantáltan megegyezik a lista `total_*` értékével:

| Kártya | Navigáció | A lista hívása |
|---|---|---|
| Csoportok | `/groups` | — |
| Nyitott feladatok | szűrt feladatlista | `task/panel/all` `{ "scope": "assigned_to_me", "exclude_done": true }` → `total_tasks == open_tasks_count` |
| Lejárt feladatok | szűrt feladatlista | `task/panel/all` `{ "scope": "assigned_to_me", "overdue_only": true }` → `total_tasks == overdue_tasks_count` |
| Közelgő események | naptár | `upcoming/all` `{ "to": <most+7 nap> }` → `total_events == upcoming_events_count` |
| Hitelesítésre vár | witness lista | `minutes/witness/pending/all` → `total_minutes == pending_witness_count` |

> A számok a kérés pillanatában érvényesek; két hívás között változhatnak (pl. közben lejár egy határidő).

## 4. `POST /v1/task/panel/all`

A csoportonkénti `task/panel` csoportokon átívelő változata.

**Kérés**
```json
{
  "Bearer": "<token>",
  "page_number": 1,
  "load_number": 20,
  "scope": "assigned_to_me",
  "exclude_done": false,
  "overdue_only": false,
  "include_archived": false
}
```

| Mező | Típus / tartomány | Alap | Megjegyzés |
|---|---|---|---|
| `page_number` | int ≥ 1 | `1` | |
| `load_number` | int 1–**50** | `20` | A régi panel 100-at engedett; itt a taskonkénti részletes adat miatt 50 a plafon. |
| `scope` | `assigned_to_me` \| `all` \| `reported_by_me` | **`assigned_to_me`** | `all`: minden task az olvasható csoportokban. |
| `exclude_done` | bool | `false` | `DONE` státuszú taskok kihagyása. |
| `overdue_only` | bool | `false` | Csak a lejártak (határidő a múltban **és** nem DONE). Az `exclude_done`-t magában foglalja. |
| `include_archived` | bool | `false` | Archivált taskok is. |

A `sprint_id` és `backlog_only` itt **nincs** (csoport-specifikusak).

**Rendezés** (fix):
1. lejárt (nem DONE, határidő a múltban) — a legrégebbi határidő elöl,
2. majd `due_at` növekvő, a határidő nélküliek a végén,
3. végül a legfrissebben létrehozott.

Egy múltbeli határidejű, de `DONE` task **nem** számít lejártnak.

**Válasz**
```json
{
  "tasks": [
    {
      "id": "<titkosított task id>",
      "issue_key": "WORF-42",
      "summary": "Plakát elkészítése",
      "description": "…",
      "task_type": "TASK",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "story_points": 3,
      "due_at": "2026-09-19T15:00:00+00:00",
      "started_at": null,
      "completed_at": null,
      "is_archived": false,
      "sprint_id": "…",
      "location": "SPRINT",
      "reporter": { "reporter_email": "…", "reporter_fulname": "…" },
      "assigneer_id": { "assigneer_email": "…", "assigneer_fullname": "…" },
      "subtasks_total": 2,
      "created_at": "…",
      "updated_at": "…",
      "group_id": "<titkosított csoport id>",
      "group_name": "Diákönkormányzat"
    }
  ],
  "total_tasks": 7,
  "total_pages": 1,
  "current_page": 1
}
```

- Az elem a **meglévő Task alak** (ugyanaz, mint a `task/get` és a `task/panel` elemei — beleértve a meglévő elnevezési furcsaságokat, pl. `reporter_fulname`, `assigneer_id` objektum) **plusz** `group_id` és `group_name`. Ezért a **`TaskDetailModal` változtatás nélkül megnyílik** az elemmel.
- Modal / szerkesztés: a `task/modify` és `task/get` hívásokhoz a `group_id` (az elemé) és a `task_id` (az elem `id`-ja) kell.
- Optimista frissítés: `task/modify` (pl. státusz átállítás) után frissítsd a sort helyben; siker után töltsd újra a `summary`-t és a listát (a lejárt/nyitott számok változhatnak). Hiba esetén állítsd vissza a sort.

> **Frontend megjegyzés:** a `TaskDetailModal` a `permissions`, `groupUsers` és `sprints` propokat csoportonként igényli — ezeket a dashboard az első megnyitáskor tölti be, csoportonként cache-elve.

## 5. `POST /v1/group/calendar/upcoming/all`

Közelgő események **minden olvasható csoport minden naptárából**, az ismétlődéseket a **szerver bontja előfordulásokra**. Nincs szükség előzetes naptárlistára és naptárankénti lekérésre.

**Kérés**
```json
{
  "Bearer": "<token>",
  "from": "2026-09-20T00:00:00Z",
  "to": "2026-10-04T00:00:00Z",
  "page_number": 1,
  "load_number": 20
}
```

| Mező | Alap | Megjegyzés |
|---|---|---|
| `from` | most | ISO 8601. Időzóna nélküli érték **UTC-nek** számít. A JSON kulcs `from` / `to` (nem `from_at`). |
| `to` | `from` + 14 nap | Legyen `from` után; a teljes ablak **legfeljebb 92 nap**, különben `422`. |
| `page_number`, `load_number` | `1`, `20` | `load_number` 1–100. |

Egy esemény akkor szerepel, ha az ablakkal **átfed** — tehát az épp tartó esemény is bekerül. Sorrend: kezdés szerint növekvő.

**Válasz**
```json
{
  "events": [
    {
      "group_calendar_event_id": "…",
      "group_calendar_id": "…",
      "kind": "SERIES",
      "name": "Heti DÖK-gyűlés",
      "parent_id": null,
      "location": "Aula",
      "all_day": false,
      "start_at": "2026-06-01T18:00:00",
      "end_at": "2026-06-01T19:00:00",
      "rrule": "FREQ=WEEKLY;BYDAY=MO",
      "until_at": null,
      "count_n": null,
      "original_start_at": null,
      "is_cancelled": false,
      "is_global": false,
      "timezone": "Europe/Budapest",

      "group_id": "<titkosított csoport id>",
      "group_name": "Diákönkormányzat",
      "calendar_name": "DÖK naptár",
      "occurrence_start_at": "2026-09-21T16:00:00Z",
      "occurrence_end_at": "2026-09-21T17:00:00Z"
    }
  ],
  "total_events": 4,
  "total_pages": 1,
  "current_page": 1
}
```

### 5.1 Alak
Az elem a **meglévő `GroupCalendarEvent` alak** (a `group/calendar/event/get` elemei), így az **`EventDetailModal` és az `EventFormModal` változtatás nélkül megnyílik**. Új mezők: `group_id`, `group_name`, `calendar_name`, `occurrence_start_at`, `occurrence_end_at`.

> **Frontend megjegyzés:** a repóban az `EventDetailModal` neve `EventViewModal`; a naptár oldal propjaira épül (`copy`, `GroupCalendarEventItem`, `canManageEvents`), ezért az `upcoming/all` elemhez mapper kell.

### 5.2 Mit jelent egy elem (előfordulás)
- **Egyszeri esemény** (`kind: "SINGLE"`): egy elem, `occurrence_*` = a saját ideje UTC-ben.
- **Ismétlődő sorozat** (`kind: "SERIES"`): **minden előfordulás külön elem** ugyanazzal az eseményadattal, csak az `occurrence_start_at/end_at` különbözik. Egy előfordulás azonosítója: `group_calendar_event_id` + `occurrence_start_at`.
- **Kivétel** (`kind: "EXCEPTION"`): az áthelyezett/átnevezett alkalom, saját adatokkal (`name`, `location`, …); a sorozat eredeti alkalma helyette **nem** jelenik meg. A **törölt** (`is_cancelled`) alkalom sem jelenik meg.

A megjelenítéshez (lista, dátum, "ma 14:00") mindig az **`occurrence_start_at/end_at`**-ot használd. A szerkesztő űrlaphoz a meglévő `start_at`/`end_at` mezők kellenek (ld. 5.3).

### 5.3 Időmezők — fontos különbség
| Mezők | Formátum |
|---|---|
| `occurrence_start_at`, `occurrence_end_at` (**új**) | UTC, `Z` végződéssel — közvetlenül `new Date(...)`-elhető |
| `start_at`, `end_at`, `until_at`, `original_start_at` (**meglévő**, változatlan) | **időzóna nélküli falióra-idő az esemény `timezone` mezőjében** (pl. `2026-06-01T18:00:00` + `Europe/Budapest`) — ne értelmezd UTC-ként |

A szerver a kibontást helyi falióra-időben végzi, ezért a "hetente 18:00" a nyári/téli időszámítás váltásán is 18:00 marad helyi idő szerint (az `occurrence_*` UTC értéke ilyenkor 1 órát eltolódik).

Egyetlen előfordulás **kivételként** történő szerkesztéséhez az `original_start_at` az előfordulás helyi (a sorozat `timezone`-jában értelmezett) falióra-ideje: az `occurrence_start_at`-ból a `timezone` mező szerint kell visszaszámolni (`Intl.DateTimeFormat` a `timeZone` opcióval).

### 5.4 Korlátok
- Az ablak legfeljebb **92 nap**.
- Sorozatonként legfeljebb **200**, összesen legfeljebb **1000** előfordulás kerül a számításba (a legkorábbiak).
- A **`FREQ=SECONDLY|MINUTELY|HOURLY`** szabályú sorozatokat nem bontja ki (túl sűrű), és az érvénytelen `rrule`-ú sorozat is **csendben kimarad** — hiba nélkül.
- Ha az esemény `timezone` mezője ismeretlen, a szerver `Europe/Budapest`-et használ.

## 6. `POST /v1/dashboard/activity`

Csoportokon átívelő "Legutóbbi tevékenységek" folyam, **legújabb elöl**, **kurzor-lapozással**.

**Kérés**
```json
{
  "Bearer": "<token>",
  "before": null,
  "load_number": 20,
  "group_id": null,
  "types": ["task", "minutes.approved"]
}
```

| Mező | Alap | Megjegyzés |
|---|---|---|
| `before` | `null` | Az előző válasz `next_before` értéke. Az első oldalhoz hagyd el / `null`. **Opak** — ne értelmezd, ne módosítsd. Hibás érték → `422`. |
| `load_number` | `20` | 1–**50**. |
| `group_id` | `null` | Csak ebből a csoportból. Egy oldalról kapott `group_id` visszaküldhető. Ha a user ehhez a csoporthoz nem fér hozzá, az eredmény **üres** (nem 403). |
| `types` | `null` (mind) | Max. 20 elem. Egy token vagy **entitás** (`"task"`, `"minutes"` → az entitás összes eseménye), vagy **entitás.művelet** (`"task.status_changed"`). Ismeretlen token → `422`. |

**Válasz**
```json
{
  "items": [
    {
      "type": "task.status_changed",
      "actor": { "user_id": "<titkosított user id>", "fullname": "Nagy Béla" },
      "occurred_at": "2026-09-20T09:12:00Z",
      "entity": {
        "type": "task",
        "id": "<titkosított task id>",
        "title": "Plakát elkészítése",
        "key": "WORF-42"
      },
      "group_id": "<titkosított csoport id>",
      "group_name": "Diákönkormányzat",
      "old_value": "IN_PROGRESS",
      "new_value": "DONE"
    }
  ],
  "next_before": "MjAyNi0wOS0yMFQwOToxMjowMFp8…"
}
```

- `next_before` **`null`**, ha nincs több elem — ilyenkor a "több betöltése" gomb tűnjön el. Ha nem `null`, a következő oldal: ugyanazokkal a szűrőkkel, `before = next_before`.
- **Nincs `total_*`**: kurzor-lapozásnál nem értelmezhető. Végtelen görgetéshez / "Több betöltése" gombhoz használd.
- A lapozás **stabil**: azonos időbélyegű elemeknél sem marad ki és nem duplázódik semmi.
- Szűrőváltáskor (típus / csoport) **dobd el a `before`-t** és kezdd elölről.
- `actor`: `null`, ha a művelet végrehajtó usere már nem létezik. `entity.key`: task esetén az `issue_key`, jegyzőkönyvnél `null`.

### 6.1 Típusok (`type` és a `types` szűrő)

**Task** (`task.<művelet>`): `created`, `status_changed`, `assignee_changed`, `reporter_changed`, `summary_changed`, `description_changed`, `type_changed`, `priority_changed`, `story_points_changed`, `due_at_changed`, `started_at_changed`, `completed_at_changed`, `archive_changed`, `sprint_changed`.

**Jegyzőkönyv** (`minutes.<művelet>`) — csak a mérföldkövek: `finalized`, `witness_approved`, `witness_rejected`, `approved`.

Megjegyzések:
- A jegyzőkönyv **mezőszintű szerkesztései**, résztvevő-/napirendi-módosítások nem szerepelnek (zaj).
- **Vázlat** (`DRAFT`) állapotú és **kukába tett** jegyzőkönyv eseményei nem jelennek meg.
- **Naptáresemények és fájlműveletek jelenleg nincsenek a folyamban** (a naptárnak nincs előzménye; a fájl audit log később kerülhet be).

### 6.2 `old_value` / `new_value`
Opcionális, `null` lehet. Az érték szöveg, legfeljebb 200 karakter (hosszabb csonkolva, `…`-tal). **Mindig `null`** az `assignee_changed`, `reporter_changed`, `sprint_changed`, `description_changed` eseményeknél (belső azonosító, illetve hosszú szöveg) és a jegyzőkönyv-eseményeknél — ezeknél a szöveg a `type`-ból építhető ("X módosította a felelőst").

### 6.3 Deep link
Minden elem az entitásra mutat: az `entity.type` + `entity.id` + `group_id` elég a megnyitásához:
- `task` → `task/get { group_id, task_id: entity.id }` → `TaskDetailModal`,
- `minutes` → `minutes/get { group_id, minutes_id: entity.id }` → jegyzőkönyv nézet.

## 7. Meglévő végpont változása: witness lista

`POST /v1/minutes/witness/pending/all` **és** `POST /v1/minutes/witness/pending`: a `minutes[]` elemei kiegészültek `group_name` mezővel (a `group_id` már eddig is benne volt). A PendingWitnessCard ezért **nem hív többé `getusergroups`-t** a csoportnév feloldására. Egyéb változás nincs.

## 8. Widget → adatforrás → frissítés mentés után

| Widget | Adatforrás | Ha ez történik… | …ezeket töltsd újra |
|---|---|---|---|
| Welcome kártya | `summary.group_count == 0` | csoportot hoz létre / csatlakozik | `summary` |
| KPI kártyák | `summary` | bármely alábbi mentés | `summary` |
| Feladatok | `task/panel/all` | feladat létrehozva / módosítva | `task/panel/all`, `summary`, `activity` |
| Közelgő események | `group/calendar/upcoming/all` | esemény létrehozva / módosítva | `upcoming/all`, `summary` |
| Legutóbbi tevékenységek | `dashboard/activity` | feladat / jegyzőkönyv változott | `activity` (elölről, `before` nélkül) |
| Hitelesítésre vár | `minutes/witness/pending/all` | szavazás leadva | witness, `summary` |

**Betöltés:** minden widget **külön kérést** indít, saját skeletonnal és hibaállapottal (mint a PendingWitnessCard). Egy lassú vagy hibás végpont (pl. `429`, `500`) így csak a saját widgetjét viszi le; a többi kérés párhuzamosan futhat.

**Quick actions:** a meglévő modalokat nyitják (`TaskFormModal`, `EventFormModal`, poszt-szerkesztő). Csoportfüggő műveleteknél előtte csoportválasztó kell — a szerver a mentésnél úgyis ellenőrzi a jogot (403 esetén jelezd a usernek), a választó listája maradhat a `getusergroups`.

## 9. TypeScript típusok

```ts
type ISOUtc = string;        // "2026-09-21T12:00:00Z"
type OpaqueId = string;      // titkosított azonosító — hívásonként más; csak visszaküldeni szabad

interface DashboardSummary {
  group_count: number;
  open_tasks_count: number;
  overdue_tasks_count: number;
  upcoming_events_count: number;
  next_event_at: ISOUtc | null;
  pending_witness_count: number;
}

interface Paged {
  total_pages: number;
  current_page: number;
}

interface TaskPanelAllResponse extends Paged {
  tasks: Array<Task & { group_id: OpaqueId; group_name: string | null }>; // Task = a meglévő task alak
  total_tasks: number;
}

interface UpcomingEventsResponse extends Paged {
  events: Array<GroupCalendarEvent & {                                   // GroupCalendarEvent = a meglévő event alak
    group_id: OpaqueId;
    group_name: string | null;
    calendar_name: string;
    occurrence_start_at: ISOUtc;
    occurrence_end_at: ISOUtc;
  }>;
  total_events: number;
}

interface ActivityItem {
  type: string;                                    // pl. "task.status_changed"
  actor: { user_id: OpaqueId; fullname: string | null } | null;
  occurred_at: ISOUtc;
  entity: { type: "task" | "minutes"; id: OpaqueId; title: string; key: string | null };
  group_id: OpaqueId;
  group_name: string | null;
  old_value: string | null;
  new_value: string | null;
}

interface ActivityResponse {
  items: ActivityItem[];
  next_before: string | null;                      // null = nincs több
}
```

Hívási példa:

```ts
const res = await fetch("/v1/task/panel/all", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ Bearer: token, scope: "assigned_to_me", exclude_done: true, load_number: 10 }),
});
if (res.status === 429) { /* saját widget: "Túl sok kérés, próbáld később" */ }
const data: TaskPanelAllResponse = await res.json();
```

## 10. Ismert korlátok, jó tudni

- **Task lista teljesítménye:** minden elemhez a teljes task-adat (felelős, előzmény-alapú mezők) külön összeáll, ezért a lapméret max. 50, javasolt 10–20. Egy dashboard-listához elég a 10.
- **Időzóna-feltevés az eseményeknél:** a szerver a naiv `start_at`/`end_at` értéket az esemény `timezone` mezőjében értelmezett falióra-időnek veszi (így írja le a létrehozó szolgáltatás is). Ha az eseményűrlap UTC-ben küld időzóna nélküli értéket, az `occurrence_*` eltolódna — ezt a meglévő események egy-két példáján érdemes ellenőrizni.
- **A `getusergroups` válaszkulcsa `"objs:"`** (kettősponttal) — ezt nem javítottuk, mert a meglévő kód erre épít; a dashboardnak már nem kell rá.
- **Visszamenőleges kompatibilitás:** a meglévő végpontok (`task/panel`, `group/calendar/event/get`, `task/history/get`, …) változatlanok, kivéve a witness listák új `group_name` mezőjét.
