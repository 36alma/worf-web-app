# Fájlkezelés API – teljes specifikáció (frontend implementációhoz)

Ez a dokumentum a Worf API teljes fájl- és mappakezelési felületét írja le
(`app/api/v1/files_route.py`, `app/api/v1/folders_route.py`), a mögöttes
üzleti szabályokkal együtt, hogy a frontend csapat ebből egyedül, backend-kód
olvasása nélkül tudja megvalósítani a Drive-szerű felületet.

> A `files_route`/`folders_route` router csak akkor regisztrálódik, ha a
> backend `STORAGE_PROVIDER` env-je `minio`/`s3`/`r2` egyike (`app/main.py`).
> Ha ezek az endpointok 404-et adnak, a fájlkezelés nincs bekapcsolva a
> szerveren.

---

## 1. Alapfogalmak

### 1.1 Autentikáció – **fontos, nem szokványos!**

A legtöbb végpont **POST**, és a `Bearer` access tokent **a JSON body**
tartalmazza, NEM az `Authorization` fejlécben:

```json
{ "Bearer": "<access_token>", ...egyéb mezők... }
```

Kivételek, ahol a token az `Authorization: Bearer <token>` fejlécben megy:

| Végpont | Auth mód |
|---|---|
| `GET /v1/files/trash` | `Authorization` fejléc |
| `GET /v1/folders/trash` | `Authorization` fejléc |
| `GET /v1/files/{file_id}/thumbnail` | `Authorization` fejléc |
| `GET /v1/files/{file_id}/preview` | `Authorization` fejléc |
| `GET /v1/files/dl/{download_token}` | **nincs** – a token maga hitelesít (lásd 3.3) |
| `GET /v1/files/shared/{token}` | **nincs** – publikus link (lásd 6) |

Minden más `POST` végpont a body-ban várja a `Bearer` mezőt (ugyanaz a minta,
mint a projekt más domainjeinél).

### 1.2 ID-k – titkosított stringek, sosem nyers UUID

A `file_id`, `folder_id`, `link_id` mezők egy AES-GCM-mel titkosított,
URL-safe string kódolást használnak (`FileID`/`FolderID` codec,
`services/files/utils/get/`). A frontend ezeket **opak stringként** kezelje:
soha ne próbálja parse-olni/generálni, csak a backend válaszaiból kapott
értékeket adja vissza későbbi hívásokban. Érvénytelen/hamis ID esetén a
backend `422 Validation failed.`-et ad vissza.

A `user_id`/`group_id` mezők (pl. megosztásnál) ugyanígy kódolt stringek,
amiket a user/csoport lista végpontokból kell beszerezni.

### 1.3 `scope`: `"private"` vs `"group"`

Minden fájlnak és mappának van egy `scope` mezője:

- **`private`** – a `owner_id` felhasználó személyes tárhelye. Listázáskor
  nincs szükség `group_id`-ra.
- **`group`** – egy csoporthoz (`group_id`) tartozik, a csoport minden tagja
  legalább VIEW+DOWNLOAD jogot kap rá automatikusan (lásd 1.4).

Egy mappán belüli fájl/almappa `scope`/`group_id`-jának **kötelezően meg kell
egyeznie** a szülőmappáéval – nincs "private mappa group fájllal" vegyes
állapot. Áthelyezés/másolás sem válthat scope-ot.

### 1.4 Jogkör-modell (Capability) – ez vezérli, mit lát/tehet a UI

A hozzáférés-ellenőrzés **objektum-szintű, additív ACL** (nem a globális
RBAC/`@RequiredPermissions`). Hat jogkör van:

| Capability | Jelentés |
|---|---|
| `can_view` | metaadat látása, listázásban megjelenés |
| `can_download` | letöltés/előnézet |
| `can_upload` | **csak mappán értelmezett** – lehet-e a mappába új fájlt/almappát tenni |
| `can_edit` | átnevezés, áthelyezés |
| `can_delete` | kukába dobás |
| `can_share` | user/csoport megosztás létrehozása/visszavonása, publikus link kezelése |

Az effektív jogkör-halmaz forrásai (unió, nincs tiltó szabály – ha bárhonnan
megvan egy jogkör, érvényes):

1. **Tulajdonos** (`owner_id == user_id`) → mind a 6 jogkör.
2. **`scope="group"` + a felhasználó tagja a csoportnak** → `can_view` +
   `can_download` automatikusan.
3. **Közvetlen user-share** (nem lejárt) → a share sorban beállított flagek.
4. **Csoport-share** bármely csoporton, aminek a user tagja (nem lejárt) →
   a share sorban beállított flagek.
5. **Mappa-öröklés**: ha a fájl/mappa egy mappában van, a fenti 1–4 pontok
   szerint számított jogkör **a teljes szülőlánc mentén** (max. 20 szintig,
   `MAX_FOLDER_DEPTH`) is hozzáadódik. Vagyis ha valakinek egy szülőmappán
   `can_edit`-je van, azt minden leszármazott fájlon/almappán is megkapja.

A UI-nak minden objektumnál (fájl/mappa lista, metadata válasz) van
`is_owner: bool` mezője, de **nincs** minden endponton explicit
`capabilities` mező a válaszban – a művelet-gombok (törlés/átnevezés/
megosztás) elérhetőségét a frontendnek a saját ismert szerepe alapján kell
eldöntenie, vagy próbálkozás után a hibaválaszból (403) következtetnie. Ha ez
UX szempontból gond, backend-oldali bővítés szükséges (jelenleg nincs
`GET .../my-capabilities` végpont).

**Megosztás-delegálás védelme:** valaki csak akkor oszthat meg egy
fájlt/mappát, ha maga tulajdonos, VAGY `can_share` jogköre van ÉS **csak
olyan flageket adhat tovább, amik neki magának is megvannak** (nincs
jogosultság-eszkaláció). Pl. ha valakinek csak `can_view`+`can_download` van
örökölve, nem oszthat meg `can_edit=true`-val.

### 1.5 Hibaformátum

Minden hiba szabványos FastAPI `HTTPException` JSON-t ad:

```json
{ "detail": "<üzenet>" }
```

| HTTP kód | Tipikus ok |
|---|---|
| 401 | hiányzó/érvénytelen bearer token |
| 403 | jogosultság hiánya (nem tag, nincs meg a capability, nem a tulajdonos) |
| 404 | fájl/mappa/csoport/user/link nem található (vagy törölve van) |
| 409 | üzleti szabály ütközés (pl. "már meg van osztva", scope/group_id eltérés, max. mappamélység) |
| 413 | tárhelykorlát elérve / túl nagy fájl / túl nagy kép |
| 415 | nem támogatott fájl-/MIME-típus |
| 422 | validációs hiba (érvénytelen ID, hibás fájlnév, hibás dátumformátum, érvénytelen kép) |
| 429 | rate limit túllépés |

### 1.6 Rate limit

Minden végpont `rate_limit(N, perc)` alatt fut, alapértelmezetten
**20 kérés / 5 perc** felhasználónként/IP-nként. Kivételek:
`POST /v1/files/list` (100/5perc), `GET /v1/files/{id}/thumbnail`/`preview`
(30/5perc), `GET /v1/files/dl/{token}` (5/1perc), `GET /v1/files/shared/{token}`
(10/1perc).

### 1.7 Dátumformátum

Minden dátum ISO-8601 string (`datetime.isoformat()`), pl.
`"2026-08-31T12:34:56.789012"`. Bemeneti dátumoknál (`expiration_date`,
`expires_at`) ugyanezt a formátumot várja a backend
(`datetime.fromisoformat`) – hibás formátum `422`-t ad.

---

## 2. Feltöltés / letöltés

### 2.1 Feltöltési folyamat (3 lépés)

A feltöltés **közvetlenül a tárolóba (MinIO/S3/R2) történik presigned POST
formmal**, a backend csak a metaadatot kezeli és validál a feltöltés után.

**1. lépés – `POST /v1/files/upload/start`**

Kérés (`UploadStart`):
```json
{
  "Bearer": "...",
  "filename": "kep.png",
  "mime_type": "image/png",
  "scope": "private",
  "group_id": null,
  "folder_id": null
}
```
- `filename`: 1–255 karakter, csak `[a-zA-Z0-9._\-\s()]`, nem tartalmazhat
  `..`, `/`, `\`-t (path traversal védelem).
- `scope`: `"private"` vagy `"group"`.
- `group_id`: kötelező, ha `scope="group"` (kódolt csoport-ID). A hívónak
  tagnak kell lennie a csoportban.
- `folder_id`: opcionális célmappa (kódolt). Ha meg van adva: a mappa
  `scope`/`group_id`-jának egyeznie kell a fájléval, és a hívónak `can_upload`
  jogköre kell legyen a mappán.
- Tárhelykorlát-ellenőrzés itt történik (lásd 8. pont) – `413` ha elfogyott.

Válasz (`UploadStartResponse`):
```json
{
  "upload_id": "uuid-string",
  "presigned_post_url": "https://minio.../bucket",
  "presigned_post_fields": { "key": "...", "policy": "...", "x-amz-...": "..." },
  "file_id": "<kódolt file_id>",
  "folder_id": "<kódolt folder_id> | null",
  "expires_in": 3600
}
```

**A frontend ezután közvetlenül `multipart/form-data` POST-ot küld a
`presigned_post_url`-re**, a `presigned_post_fields`-et mezőnként hozzáadva a
formhoz, a fájl tartalmát pedig egy `file` nevű mezőként (ez S3/MinIO
presigned POST szabvány – ugyanaz, mint egy sima S3 presigned POST upload).
Max fájlméret: **25 MB** (`MAX_FILE_SIZE_BYTES`), ezt a presigned POST
`content-length-range` feltétele is kikényszeríti tárolói szinten.

**2. lépés – `POST /v1/files/upload/complete`**

A sikeres objektum-feltöltés után kötelező meghívni, különben a fájl rekord
árva marad (metaadat nélkül, "használhatatlan" állapotban).

Kérés (`UploadComplete`):
```json
{ "Bearer": "...", "upload_id": "...", "file_id": "<kódolt file_id>", "original_name": "kep.png" }
```
- `original_name`: ugyanaz a validáció, mint `filename`-nél.
- A backend a **tényleges bájttartalomból** (`python-magic`) állapítja meg a
  MIME-típust, NEM a kliens állításából – ha nem egyezik egy engedélyezett
  típussal, a teljes feltöltést eldobja (objektum + DB sor törlve, `415`).

Engedélyezett MIME-típusok (`ALLOWED_MIME_TYPES`):
```
application/pdf, image/jpeg, image/png, image/webp, image/gif,
text/plain, text/csv, application/json,
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet   (.xlsx)
application/vnd.openxmlformats-officedocument.wordprocessingml.document (.docx)
```
(`application/octet-stream` explicit KI van zárva.)

Kép-fájloknál (`image/jpeg|png|webp|gif`) extra validáció:
- max. **20 MB** (`MAX_IMAGE_UPLOAD_BYTES`), különben `413`.
- Pillow-alapú tartalom-validáció (nem csak kiterjesztés) – sérült/hamis kép
  `422`-t ad, és a feltöltést eldobja.
- max. **40 megapixel** (`MAX_IMAGE_PIXELS`) – decompression-bomb védelem,
  `422` felette.
- Sikeres validáció után a backend **háttérben** legenerálja a
  thumbnailt/previewt (lásd 2.4), a `thumbnail_status` kezdetben `"pending"`.

Válasz (`UploadCompleteResponse`):
```json
{ "file_id": "<kódolt>", "original_name": "kep.png", "mime_type": "image/png", "size_bytes": 123456 }
```

### 2.2 Letöltés – token-alapú, két lépéses

**1. `POST /v1/files/download/request`** – `{ Bearer, file_id }` →
`DownloadRequestResponse`: `{ download_token, expires_in: 3600 }`. Ehhez
`can_download` jogkör kell. A token egy egyszer-használatos, Redis-ben tárolt,
**az igénylő IP-hez kötött** token (60 perc TTL, de a beváltásnál csak 60mp
érvényes presigned URL-t generál).

**2. `GET /v1/files/dl/{download_token}`** – hitelesítés **nélkül**, 302
redirect a tényleges (60mp érvényes) presigned GET URL-re. A token a
beváltás után azonnal törlődik (nem használható újra), és csak ugyanarról az
IP-ről váltható be, ahonnan igényelték. Érvénytelen/lejárt/más IP-ről
próbált token → `401 Invalid or expired download token.`

**Frontend minta:** a "Letöltés" gombra kattintva hívd meg a
`download/request`-et, majd navigálj (`window.location` vagy `<a href>`) a
kapott `download_token`-nel a `/v1/files/dl/{token}` URL-re – a böngésző
követi a redirectet és letölti a fájlt (a presigned URL
`Content-Disposition: attachment`-tel jön, sosem nyílik meg inline).

### 2.3 Metaadat, lista

**`POST /v1/files/metadata`** – `{ Bearer, file_id }` → `FileMetadataResponse`:
```json
{
  "file_id": "...", "original_name": "...", "mime_type": "image/png",
  "size_bytes": 123456, "uploaded_at": "iso", "scope": "private",
  "is_owner": true, "folder_id": "... | null",
  "thumbnail_status": "pending|ready|failed|null",
  "width": 1920, "height": 1080, "is_starred": false
}
```
`width`/`height`/`thumbnail_status` csak képeknél töltött.

**`POST /v1/files/list`** – `{ Bearer, scope, group_id?, folder_id?, offset=0, limit=20(max 100) }`
→ `FileListResponse { items: FileListEntry[], total, offset, limit }`.
`FileListEntry` mezői: `id, original_name, mime_type, size_bytes, scope,
uploaded_at, is_owner, folder_id, is_starred`. Rendezés: legújabb elöl
(`uploaded_at desc`). `scope="group"` esetén a lista a csoport
`scope="group"` fájljait ÉS a hívóval csoport-szinten megosztott fájlokat is
tartalmazza.

### 2.4 Kép-deriváltak (thumbnail / preview)

**`GET /v1/files/{file_id}/thumbnail`** és **`GET /v1/files/{file_id}/preview`**
– `Authorization: Bearer <token>` fejléccel, `can_view` jogkör kell.

- Ha kész: `200`, `image/webp` bájttartalom (thumbnail ~300×300, preview
  max. 1600px széles, WebP, EXIF eltávolítva – a képek eleve EXIF-mentesen
  vannak tárolva, GPS/eszközadat sosem szivárog ki).
- Ha még nincs kész: `202`, `{ "status": "pending" }`.
- Ha a generálás sikertelen volt (sérült aloldali formátum, timeout): `202`,
  `{ "status": "failed" }` – **az eredeti fájl ekkor is letölthető**, csak
  derivált nincs. A frontend ilyenkor essen vissza egy generikus fájl-ikonra.
- `Cache-Control: private, max-age=86400` fejléccel jön – böngésző-cache-elhető.

**Frontend polling-javaslat:** feltöltés után, ha `thumbnail_status ===
"pending"`, a UI 2–3 másodpercenként újra lekérheti a `metadata` vagy `list`
végpontot, amíg `ready`/`failed` nem lesz (nincs websocket/push értesítés
erre).

---

## 3. Fájlműveletek

| Endpoint | Payload | Válasz | Szükséges jogkör |
|---|---|---|---|
| `POST /v1/files/rename` | `{ Bearer, file_id, name }` | `{ file_id, original_name }` | `can_edit` |
| `POST /v1/files/move` | `{ Bearer, file_id, target_folder_id? }` | `{ file_id, folder_id }` | `can_edit` a fájlon + `can_upload` a célmappán |
| `POST /v1/files/copy` | `{ Bearer, file_id, target_folder_id? }` | `{ file_id (új), original_name, size_bytes, folder_id }` | `can_download` a forráson + `can_upload` a célmappán + tárhelykorlát ellenőrzés |
| `POST /v1/files/delete` | `{ Bearer, file_id }` | `{ file_id, message }` | `can_delete` (soft delete → kuka) |

Megjegyzések:
- `name` ugyanaz a validáció, mint `filename`-nél feltöltéskor.
- `target_folder_id: null` = gyökérbe mozgat/másol.
- Mozgatás/másolás **nem válthat scope-ot** – a célmappa scope/group_id-jának
  egyeznie kell a fájléval, különben `409 Folder scope/group_id must match...`.
- Másolásnál a másolat **az aktuális hívó lesz a tulajdonosa** (nem az eredeti
  owner), és tényleges tárolói bájt-másolás történik (nem csak DB-referencia).
- A törlés **soft delete** (`deleted_at` beállítása) – lásd 4. pont (kuka).

---

## 4. Kuka (trash) / véglegesítés / helyreállítás

| Endpoint | Payload | Válasz |
|---|---|---|
| `GET /v1/files/trash?offset=0&limit=20` | (Authorization fejléc) | `TrashListResponse { items: FileInTrashOut[], total, offset, limit }` |
| `POST /v1/files/restore` | `{ Bearer, file_id }` | `{ id, original_name, deleted_at: null }` |
| `POST /v1/files/permanent-delete` | `{ Bearer, file_id }` | `{ status: "permanently_deleted", file_id }` |

- A kuka **csak a saját tulajdonú** fájlokat listázza (`owner_id == user_id`)
  – megosztott fájlok kukájába más nem lát bele.
- `restore`/`permanent-delete` szintén csak a tulajdonosnak engedélyezett
  (nem elég a `can_delete` örökölt jogkör).
- Véglegesítés **visszavonhatatlan**: törli az objektumot a tárolóból ÉS a DB
  sort. Ha a tárolói törlés hibázik, a DB sor akkor is törlődik (a hiba csak
  logolva van – "cleanup scheduler" retry-ra számít, ez jelenleg nincs
  implementálva háttérfolyamatként, csak logolás).
- **Nincs automatikus lejárat** a kukára (nincs "30 nap után végleg törlődik"
  mechanizmus) – a UI-nak ezt kell kommunikálnia, ha ilyen elvárás van, vagy
  jelezni kell a backend csapatnak, hogy ez hiányzik.
- Ugyanez a minta mappákra: `GET /v1/folders/trash`, `POST
  /v1/folders/restore`, `POST /v1/folders/permanent-delete` (lásd 5.3).

### 4.1 Audit log (fájlonkénti tevékenységnapló)

**`POST /v1/files/audit/log`** – `{ Bearer, file_id, offset=0, limit=20 }` →
`FileAuditLogResponse { items: FileAuditLogEntry[], total, offset, limit }`.
Megtekintéshez `can_view` jogkör elég (nem csak tulajdonosnak).

`FileAuditLogEntry`: `{ id, file_id, user_id, action, ip_address, timestamp,
metadata: [{key, value}] }`.

Lehetséges `action` értékek fájloknál: `upload` (2× is logolva: indításkor és
befejezéskor, `metadata.status="completed"`-tel megkülönböztethető),
`download`, `delete`, `restore`, `rename`, `move`, `copy`, `share_group`,
`revoke_share_group`, `share_user`, `revoke_share_user`, `share_link_create`,
`share_link_revoke`, `share_link_access` (publikus link beváltás –
`metadata.actor="anonymous"`), `star`, `unstar`.

Mappákra ugyanez: `POST /v1/folders/audit/log`, action-ök:
`folder_create`, `folder_rename`, `folder_move`, `folder_delete`,
`folder_restore`, `folder_permanent_delete`, `folder_share_user`,
`folder_revoke_share_user`, `folder_share_group`, `folder_revoke_share_group`,
`folder_star`, `folder_unstar`.

---

## 5. Mappák (`/v1/folders/*`)

### 5.1 CRUD

| Endpoint | Payload | Válasz |
|---|---|---|
| `POST /v1/folders/create` | `{ Bearer, name, scope="private", group_id?, parent_folder_id? }` | `FolderCreateResponse { folder_id, name, scope, parent_folder_id, created_at }` |
| `POST /v1/folders/rename` | `{ Bearer, folder_id, name }` | `{ folder_id, name }` |
| `POST /v1/folders/move` | `{ Bearer, folder_id, new_parent_folder_id? }` | `{ folder_id, parent_folder_id }` |
| `POST /v1/folders/metadata` | `{ Bearer, folder_id }` | `FolderMetadataResponse { folder_id, name, scope, is_owner, parent_folder_id, created_at, is_starred }` |
| `POST /v1/folders/list` | `{ Bearer, folder_id?, scope="private", group_id?, offset=0, limit=20 }` | lásd lent |
| `POST /v1/folders/delete` | `{ Bearer, folder_id }` | `{ folder_id, message }` (kaszkád soft delete) |

**Mappa-létrehozás szabályai:**
- `name`: ugyanaz a validáció, mint fájlnévnél.
- `scope="group"` esetén `group_id` kötelező, és a hívónak tagnak kell lennie.
- Ha `parent_folder_id` meg van adva: a szülő `scope`/`group_id`-jának
  egyeznie kell, a hívónak `can_upload` jogköre kell legyen a szülőn, és a
  beágyazási mélység **max. 20 szint** (`MAX_FOLDER_DEPTH`) – felette `409`.

**Mappa-áthelyezés szabályai:**
- Nem helyezhető át önmaga alá vagy egy leszármazottja alá (ciklusvédelem) →
  `409 Cannot move a folder into itself or one of its descendants.`
- Ugyanaz a scope/group_id-egyezés + mélységkorlát + `can_upload` ellenőrzés,
  mint létrehozáskor.

**`POST /v1/folders/list` válasz** (`FolderListResponse`):
```json
{
  "folder_id": "... | null",
  "subfolders": [ { "id","name","scope","created_at","is_owner","is_starred" } ],
  "files": [ FileListEntry, ... ],
  "subfolder_total": 3,
  "file_total": 12,
  "offset": 0, "limit": 20
}
```
- `folder_id: null` = a gyökér tartalmát listázza (a `scope`/`group_id` mezők
  ekkor kötelezőek a body-ban, `scope="group"`-nál `group_id` is).
- Ha `folder_id` meg van adva, a `scope`/`group_id` body-mezőket a backend
  figyelmen kívül hagyja (a mappa saját scope/group_id-ját használja), csak
  `can_view` jogkör kell hozzá.
- **Egyben** adja vissza az almappákat és a bennük lévő fájlokat, külön
  lapozással/számlálóval (mindkettőn ugyanaz az `offset`/`limit` érvényesül –
  ha többet kell lapozni az egyikből, mint a másikból, két külön hívás
  szükséges eltérő szűréssel, ez a jelenlegi API korlátja).

### 5.2 Kuka és véglegesítés

Lásd 4. pont mintáját – `GET /v1/folders/trash`, `POST /v1/folders/restore`,
`POST /v1/folders/permanent-delete`.

**Fontos aszimmetria:** a **soft delete kaszkádol** (a mappa törlésekor
minden leszármazott almappa és fájl is `deleted_at`-et kap), de a **restore
NEM kaszkádol** – csak az adott mappasort állítja vissza, a vele együtt
törölt tartalmat egyenként kell visszaállítani a kukából. A **permanent
delete viszont rekurzívan** töröl mindent (leszármazott fájlok tárolói
objektumai + DB sorai + minden leszármazott mappasor).

### 5.3 Megosztás (user/csoport)

Ugyanaz a minta, mint fájloknál (6. pont), csak `folder_id`-vel és eggyel
több flaggel: **`can_upload`** is szerepel (mert egy megosztott mappába a
címzett tölthet-e fel új fájlt/almappát).

| Endpoint | Payload | Válasz |
|---|---|---|
| `POST /v1/folders/share/user` | `{ Bearer, folder_id, target_user_id, can_view=true, can_download=true, can_upload=false, can_edit=false, can_delete=false, can_share=false, expiration_date? }` | `FolderShareWithUserResponse` |
| `POST /v1/folders/share/user/revoke` | `{ Bearer, folder_id, target_user_id }` | `{ status, folder_id, target_user_id }` |
| `POST /v1/folders/share/user/list` | `{ Bearer, folder_id }` | `{ folder_id, users: FolderUserShareEntry[] }` |
| `POST /v1/folders/share/group` | ua. `group_id`-vel | `FolderShareWithGroupResponse` (tartalmazza `shared_with_count`-ot) |
| `POST /v1/folders/share/group/revoke` | `{ Bearer, folder_id, group_id }` | `{ status, folder_id, group_id }` |
| `POST /v1/folders/share/group/list` | `{ Bearer, folder_id }` | `{ folder_id, groups: FolderGroupShareEntry[] }` |

Duplikált megosztás (ugyanaz a user/csoport, ugyanaz a mappa) → `409 ...is
already shared with this user/group.` Ezeknek a listázó/kezelő végpontoknak
`can_share`-jogkör (vagy tulajdonos) kell.

---

## 6. Fájl megosztás – user / csoport / tömeges

| Endpoint | Payload | Válasz |
|---|---|---|
| `POST /v1/files/share/user` | `{ Bearer, file_id, target_user_id, can_view=true, can_download=true, can_edit=false, can_delete=false, can_share=false, expiration_date? }` | `FileShareWithUserResponse` |
| `POST /v1/files/share/user/revoke` | `{ Bearer, file_id, target_user_id }` | `{ status, file_id, target_user_id }` |
| `POST /v1/files/share/user/list` | `{ Bearer, file_id }` | `{ file_id, users: FileUserShareEntry[] }` |
| `POST /v1/files/share/group` | ua. `group_id`-vel | `FileShareWithGroupResponse` (+ `shared_with_count`) |
| `POST /v1/files/share/group/revoke` | `{ Bearer, file_id, group_id }` | `{ status, file_id, group_id }` |
| `POST /v1/files/share/group/list` | `{ Bearer, file_id }` | `{ file_id, groups: FileGroupShareEntry[] }` |
| `POST /v1/files/share/group/bulk` | `{ Bearer, file_ids: string[] (1–100), group_id, can_view=true, can_download=true, can_edit=false, can_delete=false, can_share=false, expiration_date? }` | `FileShareGroupBulkResponse { group_id, succeeded: string[], failed: [{file_id, reason}] }` |

Fájlnál **nincs** `can_upload` flag (értelmezhetetlen egy fájlon).

**Tömeges megosztás (`/bulk`) viselkedése – fontos a UI hibakezeléshez:**
nem tranzakciós "minden vagy semmi", hanem **best-effort, fájlonként**: belül
egyszerűen N-szer meghívja a sima `share/group`-ot, minden hibát elkap, és a
`failed` listába teszi `{file_id, reason}` alakban. A frontendnek a válasz
után **mindkét listát** (`succeeded`, `failed`) meg kell jelenítenie – pl.
"8/10 fájl megosztva, 2 sikertelen: ..." típusú visszajelzéssel.

**Megosztás-kezelés jogosultsága:** tulajdonos mindig kezelhet; nem-
tulajdonos csak akkor, ha `can_share` jogköre van (közvetlen/örökölt), és
csak olyan flaget adhat tovább, ami neki is megvan (lásd 1.4 vége).

---

## 7. Publikus megosztási linkek

Ezek **jelszóval és/vagy lejárattal védhető, hitelesítés nélkül beváltható**
letöltési/megtekintési linkek – pl. "külsősnek küldött link" funkcióhoz.

| Endpoint | Payload | Válasz |
|---|---|---|
| `POST /v1/files/share/link/create` | `{ Bearer, file_id, permission="download", expires_at?, password? }` | `ShareLinkCreateResponse { link_id, token, permission, expires_at, has_password }` |
| `POST /v1/files/share/link/revoke` | `{ Bearer, link_id }` | `{ status: "revoked", link_id }` |
| `POST /v1/files/share/link/list` | `{ Bearer, file_id }` | `{ file_id, links: ShareLinkEntry[] }` |
| `GET /v1/files/shared/{token}` | (opcionális `X-Share-Password` fejléc) | `302` redirect a fájlra, vagy `404` |

- `permission`: `"view"` vagy `"download"` (`"download"` esetén a presigned
  URL `Content-Disposition: attachment`-tel jön).
- `password`: 1–128 karakter, ha meg van adva Argon2-vel hash-elve tárolva
  (a jelszó maga soha nem kerül vissza a válaszban, csak a `has_password`
  boolean).
- A **teljes `token`-t** (ami `{lookup_id}.{secret}` formátum) csak a
  `create` válasz tartalmazza – ezt kell a frontendnek megjelenítenie/
  eltárolnia és a megosztandó URL-be illesztenie
  (`GET /v1/files/shared/{token}`). A `list` végpont csak a `link_id`-t és
  metaadatokat adja vissza, a titkos token-t NEM (nem lehet utólag
  visszanyerni – ha elveszett, új linket kell generálni és a régit revoke-olni).
- Jelszóval védett linknél a beváltáskor a jelszót az **`X-Share-Password`**
  HTTP fejlécben kell küldeni (nem query paraméterben – ne kerüljön logokba/
  historyba).
- **Egységes hibaválasz** minden érvénytelen esetre (nem létezik / lejárt /
  visszavont / hibás jelszó): `404 Link is no longer valid.` – szándékosan
  nem különböztethető meg, hogy melyik eset áll fenn (információszivárgás
  elleni védelem). A frontend ne próbáljon ebből finomabb hibaüzenetet
  gyártani, csak generikus "a link érvénytelen vagy lejárt" szöveget mutasson.
- A beváltás megnöveli a link `access_count`-ját és frissíti a
  `last_accessed_at`-et (látható a `list` végponton) – ez a link
  "hányszor nyitották meg" statisztikájának forrása.
- A link-kezelés (create/revoke/list) jogosultsága ugyanaz, mint a user/
  csoport megosztásé: tulajdonos vagy `can_share` jogkörrel rendelkező.
- Mappákra **nincs** publikus link funkció (csak fájlokra).

---

## 8. Tárhelykorlát és -használat

**`POST /v1/files/storage/usage`** – `{ Bearer, scope="private", group_id? }`
→ `StorageUsageResponse { scope, target_id, used_bytes, limit_bytes }`.
- `scope="group"` esetén a hívónak tagnak kell lennie a csoportban, különben
  `403`. `target_id` ilyenkor a `group_id`, `private`-nál `null`.
- `limit_bytes: null` = nincs beállított korlát (korlátlan).
- `used_bytes` a nem törölt (`deleted_at IS NULL`) fájlok `size_bytes`
  összege – a kukában lévő fájlok NEM számítanak bele a használatba.

**Korlát beállítása (admin/csoport-admin jogosultsághoz kötött):**

| Endpoint | Payload | Jogosultság |
|---|---|---|
| `POST /v1/files/storage/limit/user` | `{ Bearer, target_id, limit_bytes?, scope="user" }` | `@RequiredPermissions("files.storage.limit.user.set")` |
| `POST /v1/files/storage/limit/group` | `{ Bearer, target_id, limit_bytes?, scope="group" }` | `@RequiredPermissions("files.storage.limit.group.set")` |

`limit_bytes: null` küldése törli a korlátot (korlátlanra állítja). Ezek a
végpontok a globális RBAC-ot (`@RequiredPermissions`) használják, tehát a
hívó szerepének kell rendelkeznie a megfelelő jogosultsággal, függetlenül
attól, hogy tulajdonosa-e a célnak.

**Kvóta-ellenőrzés időzítése:** feltöltés indításakor (`upload/start`) és
fájlmásoláskor (`files/copy`) történik, `>=` összehasonlítással (tehát a
korlát elérésekor, nem csak túllépésekor, már elutasít) – `413`-at ad.
Feltöltés *befejezésekor* (`upload/complete`) nincs újra-ellenőrzés, tehát
egy versenyhelyzetben (két párhuzamos feltöltés indítása a korlát közelében)
technikailag kicsit túlléphető a limit – ez ismert, el nem hárított
él-eset, nem kell rá frontend logikát építeni.

---

## 9. Csillagozás (kedvencek)

| Endpoint | Payload | Válasz |
|---|---|---|
| `POST /v1/files/star` | `{ Bearer, file_id }` | `StarResponse { status: "starred", file_id, is_starred: true }` |
| `POST /v1/files/unstar` | `{ Bearer, file_id }` | `{ status: "unstarred", file_id, is_starred: false }` |
| `POST /v1/folders/star` | `{ Bearer, folder_id }` | `FolderStarResponse { status, folder_id, is_starred }` |
| `POST /v1/folders/unstar` | `{ Bearer, folder_id }` | ua. |
| `POST /v1/files/starred/list` | `{ Bearer, offset=0, limit=20 }` | `StarredListResponse { files: FileListEntry[], folders: FolderListEntry[], file_total, folder_total, offset, limit }` |

- Csillagozáshoz elég `can_view` jogkör (nem kell tulajdonosnak lenni).
- **Per-user** – a csillagozás nem osztott állapot, mindenki a saját
  csillagjait látja/kezeli ugyanazon a fájlon.
- Már csillagozott elem újra csillagozása → `422 File/Folder is already
  starred.` Nem csillagozott elem unstar-olása → `404 ... is not starred.`
  A frontend a "csillag" gombot **toggle**-ként kezelje: az `is_starred`
  mező alapján (ami minden lista/metadata válaszban benne van, lásd lent)
  döntse el, `star` vagy `unstar` hívás menjen.
- Az `is_starred` mező **minden releváns válaszban szerepel**, nem csak a
  dedikált `starred/list` végponton: `FileListEntry`, `FileMetadataResponse`,
  `FolderListEntry`, `FolderMetadataResponse` – tehát a sima `/v1/files/list`
  és `/v1/folders/list`/`metadata` válaszokból is kiolvasható, csillagozott-e
  az adott elem, nem kell külön lekérdezni.
- A `starred/list`-ben a mappák `name` szerint (ABC), a fájlok
  `uploaded_at desc` szerint rendezve jönnek – **ugyanaz az `offset`/`limit`
  érvényesül mindkét listára** (mint a `folders/list`-nél).

---

## 10. "Megosztva velem" nézet

**`POST /v1/files/shared-with-me/list`** – `{ Bearer, offset=0, limit=20 }` →
`SharedWithMeListResponse { files: FileListEntry[], folders: FolderListEntry[], file_total, folder_total, offset, limit }`.

- Aggregálja a bejelentkezett user **összes csoportján átívelve**, három
  forrásból: (1) közvetlen user-share, (2) csoport-share bármelyik tagolt
  csoporton keresztül, (3) `scope="group"` fájlok/mappák bármely tagolt
  csoportban.
- Lejárt (`expiration_date` elmúlt) share-ek automatikusan kiszűrve.
- **A saját tulajdonú elemek mindig kizárva** (`owner_id != user_id`), tehát
  ez tényleg csak azt mutatja, amit *mások* osztottak meg a userrel.
- Ebben a válaszban a `FileListEntry`/`FolderListEntry` `is_owner` mindig
  `false`, és **`is_starred` mező ide nincs kitöltve** (a `shared_view_service`
  nem számolja ki – ha a UI-nak itt is kellene a csillag-állapot, backend
  bővítés szükséges, jelenleg mindig `false`/hiányzó lesz).

---

## 11. Végpontok gyors áttekintő táblázata

### Fájlok (`/v1/files`)

```
POST /upload/start                     – feltöltés előkészítése (presigned POST)
POST /upload/complete                  – feltöltés lezárása, MIME/kép validáció
POST /download/request                 – letöltési token igénylése
GET  /dl/{download_token}              – 302 redirect, publikus (token hitelesít)
GET  /{file_id}/thumbnail              – kép-thumbnail (Authorization fejléc)
GET  /{file_id}/preview                – kép-preview (Authorization fejléc)
POST /list                             – fájllista (private/group, mappa szerint szűrhető)
POST /metadata                         – egy fájl metaadata
POST /rename                           – átnevezés
POST /move                             – áthelyezés (mappák közt)
POST /copy                             – másolás
POST /delete                           – kukába dobás (soft delete)
GET  /trash                            – kuka listázása (Authorization fejléc)
POST /restore                          – visszaállítás kukából
POST /permanent-delete                 – végleges törlés
POST /audit/log                        – fájl tevékenységnapló
POST /share/user                       – megosztás egy userrel
POST /share/user/revoke                – user-megosztás visszavonása
POST /share/user/list                  – user-megosztások listája
POST /share/group                      – megosztás csoporttal
POST /share/group/bulk                 – tömeges megosztás csoporttal (max 100 fájl)
POST /share/group/revoke               – csoport-megosztás visszavonása
POST /share/group/list                 – csoport-megosztások listája
POST /share/link/create                – publikus link létrehozása
POST /share/link/revoke                – publikus link visszavonása
POST /share/link/list                  – publikus linkek listája
GET  /shared/{token}                   – publikus link beváltása (302), hitelesítés nélkül
POST /star                             – csillagozás
POST /unstar                           – csillagozás törlése
POST /starred/list                     – csillagozott fájlok+mappák listája
POST /shared-with-me/list              – "megosztva velem" nézet
POST /storage/usage                    – tárhelyhasználat lekérdezése
POST /storage/limit/user               – [admin] user-tárhelykorlát beállítása
POST /storage/limit/group              – [admin] csoport-tárhelykorlát beállítása
```

### Mappák (`/v1/folders`)

```
POST /create                           – mappa létrehozása
POST /rename                           – átnevezés
POST /move                             – áthelyezés
POST /metadata                         – egy mappa metaadata
POST /list                             – mappa tartalma (almappák + fájlok egyben)
POST /delete                           – kukába dobás (kaszkád)
GET  /trash                            – kuka listázása (Authorization fejléc)
POST /restore                          – visszaállítás kukából (NEM kaszkádol)
POST /permanent-delete                 – végleges törlés (kaszkádol)
POST /audit/log                        – mappa tevékenységnapló
POST /share/user                       – megosztás egy userrel (can_upload flaggel is)
POST /share/user/revoke                – ua. visszavonás
POST /share/user/list                  – ua. lista
POST /share/group                      – megosztás csoporttal
POST /share/group/revoke               – ua. visszavonás
POST /share/group/list                 – ua. lista
POST /star                             – csillagozás
POST /unstar                           – csillagozás törlése
```

---

## 12. UI-implementációs javaslatok / ismert korlátok

- **Fájlnév-validáció tükrözése kliens oldalon**: 1–255 karakter, csak
  `a-zA-Z0-9._-()` és szóköz engedélyezett, nincs `..`/`/`/`\` – érdemes ezt
  már a feltöltési/átnevezési űrlapon kliens-oldalon is kikényszeríteni, hogy
  ne csak a szerver 422-je jelezze (pl. ékezetes fájlnevek jelenleg **el
  vannak utasítva** – ez FONTOS UX-döntés, amit érdemes tudatosan
  kommunikálni a felhasználó felé, vagy kérni a backend csapattól a minta
  bővítését, ha ékezetes fájlnevek kellenek).
- **Nincs kereső/full-text endpoint** a fájlok közt – csak lista + szűrés
  scope/mappa szerint. Ha kell keresés, az backend-bővítést igényel.
- **Nincs "capabilities" mező** a lista/metadata válaszokban – a frontendnek
  vagy ismernie kell a saját effektív szerepét (owner/share flagek alapján,
  amiket a share-lista végpontokból tud lekérni), vagy próbálkozás után 403
  alapján kell UI-t rejtenie/mutatnia.
- **A mappa-lista lapozása** (`offset`/`limit`) egyszerre vonatkozik az
  almappákra és a fájlokra is – ha az egyikből sokkal több van, mint a
  másikból, a UI-nak ezt kezelnie kell (pl. két külön "több betöltése" gomb,
  vagy nagyobb `limit` kérése és kliens-oldali vágás).
- **Thumbnail/preview generálás aszinkron** – feltöltés után rövid ideig
  `thumbnail_status="pending"`, a UI-nak polling vagy optimista placeholder
  ikon megjelenítés szükséges.
- **A kuka nem jár le automatikusan** – nincs "X nap után törlődik" jelenleg,
  csak explicit végleges törlés van.
