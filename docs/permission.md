# Jogosultság mátrix frontendhez

Ez a dokumentum a backend jelenlegi kódja alapján készült (`app/api/v1/*`, `app/conf/default/*`, `app/services/post/post.py`).

## 1) Globális (system) jogosultságok és API-k

| Jogosultság | Mit nyithat / művelet | API (method + path) |
|---|---|---|
| `group.create` | Új csoport létrehozása | `POST /v1/group/create` |
| `group.get.user` | Felhasználó csoportjainak listázása | `POST /v1/group/getusergroups` |
| `group.get.all.group` | Összes csoport listázása | `POST /v1/group/getgroups` |
| `group.delete.group` | Csoport törlése | `POST /v1/group/delete` |
| `group.modify.base` | Csoport alapadatainak módosítása | `POST /v1/group/modifygroupbase` |
| `group.create.add.usertogroup` | Felhasználó hozzáadása csoporthoz | `POST /v1/group/create/add/usertogroup` |
| `group.delete.remove.userfromgroup` | Felhasználó eltávolítása csoportból | `POST /v1/group/delete/remove/userfromgroup` |
| `user.get.prealluser` | Admin user lista (limitált mezőkkel) | `GET /v1/user/prealluser` |
| `user.post.edit.admin.userprofil` | Admin user profil szerkesztés | `POST /v1/user/admin/editprofile` |
| `user.get.edit.admin.userprofil` | Admin user profil lekérdezés | `GET /v1/user/admin/editprofile` |
| `user.post.post.userprofil` | Saját profil szerkesztés + lekérdezés | `POST /v1/user/editprofile`, `GET /v1/user/editprofile` |
| `role.get.all.role` | Rendszer szerepkörök listázása | `GET /v1/role/allroles` |
| `global.calendar.event.create` | Globális naptár esemény létrehozás | `POST /v1/global/calendar/event/create` |
| `global.calendar.event.modify` | Globális naptár esemény módosítás | `POST /v1/global/calendar/event/modify` |
| `global.calendar.event.delete` | Globális naptár esemény törlés | `POST /v1/global/calendar/event/delete` |
| `post.create.global` | Globális poszt létrehozás | `POST /v1/global/post/create` |
| `post.get.global` | Globális poszt(ok) lekérdezés | `POST /v1/global/post/get`, `POST /v1/global/post/panel` |
| `post.delete.global` | Globális poszt törlés (alapjog) | `POST /v1/global/post/delete` |
| `post.delete.other.global` | Más felhasználó globális posztjának törlése (kiegészítő jog, service-szint) | Nincs külön endpoint dekorátor; `POST /v1/global/post/delete` belső ellenőrzésében használva |
| `group.get.group` | Egy csoport lekérdezése | Jelenleg nincs aktív endpoint (a route kommentelve van) |

## 2) Csoport jogosultságok és API-k

| Jogosultság | Mit nyithat / művelet | API (method + path) |
|---|---|---|
| `group.role.create` | Csoport szerepkör létrehozás | `POST /v1/group/role/create` |
| `group.role.get` | Csoport szerepkör(ök) lekérdezés | `POST /v1/group/role/get` |
| `group.role.modify` | Csoport szerepkör módosítás | `POST /v1/group/role/modify` |
| `group.role.delete` | Csoport szerepkör törlés | `POST /v1/group/role/delete` |
| `group.permission.get.all` | Összes csoport-jogosultság listázás | `POST /v1/group/permission/get/all` |
| `group.role.permission.set.fixed` | Csoport szerepkör fix jogosultságainak beállítása | `POST /v1/group/role/permission/set/fixed` |
| `group.calendar.read` | Csoport naptár lekérdezés | `POST /v1/group/calendar/get` |
| `group.calendar.write` | Csoport naptár létrehozás/módosítás/törlés | `POST /v1/group/calendar/create`, `POST /v1/group/calendar/modify`, `POST /v1/group/calendar/delete` |
| `group.calendar.event.read` | Csoport naptár esemény lekérdezés | `POST /v1/group/calendar/event/get` |
| `group.calendar.event.write` | Csoport naptár esemény létrehozás/módosítás/törlés | `POST /v1/group/calendar/event/create`, `POST /v1/group/calendar/event/modify`, `POST /v1/group/calendar/event/delete` |
| `group.post.create` | Csoport poszt létrehozás | `POST /v1/group/post/create` |
| `group.post.read` | Csoport poszt(ok) lekérdezés | `POST /v1/group/post/get`, `POST /v1/group/post/panel` |
| `group.post.delete` | Csoport poszt törlés (alapjog) | `POST /v1/group/post/delete` |
| `group.post.delete.other` | Más felhasználó csoportos posztjának törlése (kiegészítő jog, service-szint) | Nincs külön endpoint dekorátor; `POST /v1/group/post/delete` belső ellenőrzésében használva |
| `group.task.create` | Task létrehozás csoportban | `POST /v1/task/create` |
| `group.task.read` | Task lekérdezés + task panel | `POST /v1/task/get`, `POST /v1/task/panel` |
| `group.task.modify` | Task módosítás | `POST /v1/task/modify` |
| `group.task.delete` | Task törlés | `POST /v1/task/delete` |
| `group.task.category.create` | Task kategória létrehozás | `POST /v1/task/category/create` |
| `group.task.category.read` | Task kategória lekérdezés | `POST /v1/task/category/get` |
| `group.task.category.modify` | Task kategória módosítás | `POST /v1/task/category/modify` |
| `group.task.category.delete` | Task kategória törlés | `POST /v1/task/category/delete` |
| `group.task.comment.create` | Task komment létrehozás | `POST /v1/task/comment/create` |
| `group.task.comment.read` | Task komment(ek) lekérdezés | `POST /v1/task/comment/get` |
| `group.task.comment.modify` | Task komment módosítás | `POST /v1/task/comment/modify` |
| `group.task.comment.delete` | Task komment törlés | `POST /v1/task/comment/delete` |

## 3) Permission-lekérdező API-k frontendhez

Ezekkel a frontend dinamikusan fel tudja építeni, mit mutasson/gomboljon:

| Cél | API | Visszatérés |
|---|---|---|
| Felhasználó globális jogai | `GET /v1/user/permission` | `{"permission.name": true/false, ...}` |
| Felhasználó csoportjogai adott csoportban/szerepkörben | `GET /v1/group/permission` | `{"group.permission.name": true/false, ...}` |

### Kiemelt URL-ek

- `GET /v1/user/permission`
- `GET /v1/group/permission`

### Működés: `GET /v1/user/permission`

- Cél: az aktuális user összes globális/system jogosultságának lekérése.
- Szükséges input:
  - query/body modellben `Bearer` token (a backend ebből azonosítja a usert).
  - `x-forwarded-for` header.
- Backend logika:
  - tokenből user azonosítás,
  - user role meghatározás,
  - az összes permission névre boolean építése (`true` ha role-hoz linkelve van, különben `false`).
- Válasz formátum:
  - `{"group.create": true, "group.delete.group": false, ...}`

### Működés: `GET /v1/group/permission`

- Cél: az aktuális user csoportszintű jogosultságainak lekérése egy adott csoportban.
- Szükséges input:
  - `Bearer` token,
  - `group_id` (titkosított vagy UUID),
  - opcionálisan `group_role_id` (ha tokenből nem oldható fel),
  - `x-forwarded-for` header.
- Backend logika:
  - token validálás és user azonosítás,
  - csoporttagság ellenőrzés (ha nem tag, tiltás),
  - csoportszerepkör feloldás token claimből (`group_role_id` vagy `group_roles[group_id]`) vagy inputból,
  - adott csoport role összes group permission neve boolean mapként visszaadva.
- Válasz formátum:
  - `{"group.post.read": true, "group.post.delete": false, ...}`

## 4) Fontos működési szabályok (frontend szempont)

- A backend több route-ban kötelezően várja az `x-forwarded-for` fejlécet; ha hiányzik, `IP not found` hibát dob.
- A jogosultság ellenőrzések a request `user.Bearer` tokenjéből dolgoznak.
- A csoportszintű route-oknál (`RequiredGroupPermissions`) a usernek a csoport tagjának kell lennie.
- A csoportszintű route-oknál kell `group_id` a kérésben, és a tokenben érvényes csoport szerepkör claim (pl. `group_role_id` vagy `group_roles[group_id]`).
- Poszt törlésnél a `*.delete` jog önmagában nem elég más szerző posztjaira; ahhoz kell a megfelelő `*.delete.other` kiegészítő jog.

## 5) Frontend guard javaslat

- Route vagy UI elem megjelenítése előtt hívd:
  - globális képernyőkhöz: `GET /v1/user/permission`
  - csoport képernyőkhöz: `GET /v1/group/permission` (aktuális `group_id`-val)
- UI gombok tiltása:
  - törlés más szerző tartalmára: ellenőrizd külön a `post.delete.other.global` vagy `group.post.delete.other` jogot.

## 6) Integralt frontend szabalyok (aktualis implementacio)

Az alabbi szabalyok centralisan vannak kezelve a frontendben:

- `Sidebar` menupontok:
  - `groups`: csak ha `group.get.user` vagy `group.get.all.group` igaz
  - `posts`: csak ha `post.get.global` igaz
  - `dashboard`, `tasks`, `calendar`: jelenleg mindig latszik
- Route guard (`AppShell`):
  - `/groups` route-csalad: csak ha `group.get.user` vagy `group.get.all.group`
  - `/posts`: csak ha `post.get.global`
  - `/admin`: csak ha `role.get.all.role` vagy `group.get.all.group` vagy `user.get.prealluser`
  - tiltott route eseten redirect: `/{locale}/dashboard`
- Group route guard (`AppShell` + `GET /v1/group/permission`):
  - `/groups/{groupId}/calendar`: `group.calendar.read` vagy `group.calendar.write`
  - `/groups/{groupId}/posts`: `group.post.read`
  - `/groups/{groupId}/roles`: `group.role.get` vagy `group.permission.get.all`
  - tiltott group alroute eseten redirect: `/{locale}/groups/{groupId}`

Technikai megjegyzes:
- System jogmap betoltese: `GET /v1/user/permission` app bootstrapkor.
- Group jogmap betoltese: csak akkor, ha a user group route-ra lep.
- Admin aloldalak:
  - `users`: `user.get.prealluser` vagy `user.get.edit.admin.userprofil` vagy `user.post.edit.admin.userprofil`
  - `groups`: `group.get.all.group` vagy `group.create` vagy `group.modify.base` vagy `group.delete.group`
  - `roles`: `role.get.all.role`
