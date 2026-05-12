# API Dokumentáció

Az alábbi dokumentáció endpointonként ugyanazt a szerkezetet használja, mint a `docs/api_v1_task_modify_hu.md`.

Megjegyzés: a `/v1/mobil/*` route-ok jelenleg a kódban szerepelnek, de a `main.py` nem mountolja őket.

---

## Endpoint

- **Név:** Auth forget password
- **Metódus:** `POST`
- **Útvonal:** `/v1/auth/forget-password`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/auth/forget-password`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 5 perc`
- **Body/Model:** `UserForgetPassword`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `grant_type` | `string` | Nem | Kérésparaméter. |
| `client_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `client_secret` | `string` | Igen | Kérésparaméter. |
| `device_type` | `string` | Igen | Kérésparaméter. |
| `email` | `string (email)` | Igen | Email alapú mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group admin get users not in group
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/getusers/notingroup`
- **Leírás:** A kiválasztott csoportba még be nem lépett userek lekérdezése lapozással.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.get.users.notingroup.admin.panel`.

3. **Token kezelés**
   - A kérésmodell `Bearer` tokent használ.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (`group_id`, `page_number`, `load_user_number`).
3. Globális jogosultság-ellenőrzés fut le.
4. A rendszer lekérdezi azokat a usereket, akik **nem** tagjai a megadott csoportnak.
5. A válasz paginált formában érkezik (`total`, `page_number`, `load_user_number`, `users`).

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/getusers/notingroup`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetGroupMissingUsersAdmin`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token a hitelesítéshez. |
| `group_id` | `string` | Igen | Csoport azonosító (titkosított vagy UUID). |
| `page_number` | `integer` | Nem | Oldalszám, minimum `1`, alapértelmezett: `1`. |
| `load_user_number` | `integer` | Nem | Oldalméret, minimum `1`, maximum `200`, alapértelmezett: `20`. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `group_id` | `string` | A lekérdezett csoport azonosítója. |
| `page_number` | `integer` | Aktuális oldalszám. |
| `load_user_number` | `integer` | Oldalméret. |
| `total` | `integer` | Összes találat száma (csoporton kívüli userek). |
| `users` | `array<object>` | Felhasználó lista (`user_id`, `name`, `email`, `is_active`). |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Hiányzik a `group.get.users.notingroup.admin.panel` jogosultság. |
| `404` | `Group not found.` / `Record not found.` | A megadott csoport nem található. |
| `422` | `Validation failed.` | Bemeneti validációs hiba (pl. hibás `page_number`). |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Global post category create
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/post/category/create`
- **Leírás:** Új post kategória létrehozása.

## Jogosultságok (Permissions)

1. **Kötelező hálózati fejléc**
   - `x-forwarded-for` kötelező.
2. **Jogosultságkezelés**
   - Kötelező permission: `post.category.create.global`.
3. **Token kezelés**
   - Kötelező `Bearer` token.

## Használat

- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `CreatePostCategory`

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token. |
| `name` | `string` | Igen | Kategória neve. |
| `description` | `string` | Igen | Kategória leírása. |
| `created_by` | `string (UUID)` | Nem | Létrehozó user azonosító. |

---

## Endpoint

- **Név:** Global post category get
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/post/category/get`
- **Leírás:** Post kategóriák lekérdezése.

## Jogosultságok (Permissions)

1. **Kötelező hálózati fejléc**
   - `x-forwarded-for` kötelező.
2. **Jogosultságkezelés**
   - Kötelező permission: `post.category.get.global`.
3. **Token kezelés**
   - Kötelező `Bearer` token.

## Használat

- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetPostCategory`

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token. |
| `post_category_id` | `string (UUID)` | Nem | Konkrét kategória azonosító. |
| `name` | `string` | Nem | Név alapú szűrés. |
| `description` | `string` | Nem | Leírás alapú szűrés. |
| `created_by` | `string (UUID)` | Nem | Létrehozó alapján szűrés. |
| `limit` | `integer` | Nem | Maximum elemszám. |

---

## Endpoint

- **Név:** Global post category modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/post/category/modify`
- **Leírás:** Post kategória módosítása.

## Jogosultságok (Permissions)

1. **Kötelező hálózati fejléc**
   - `x-forwarded-for` kötelező.
2. **Jogosultságkezelés**
   - Kötelező permission: `post.category.modify.global`.
3. **Token kezelés**
   - Kötelező `Bearer` token.

## Használat

- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `ModifyPostCategory`

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token. |
| `post_category_id` | `string (UUID)` | Igen | Módosítandó kategória azonosítója. |
| `name` | `string` | Nem | Új név. |
| `description` | `string` | Nem | Új leírás. |
| `created_by` | `string (UUID)` | Nem | Új létrehozó azonosító. |

---

## Endpoint

- **Név:** Global post category delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/post/category/delete`
- **Leírás:** Post kategória törlése.

## Jogosultságok (Permissions)

1. **Kötelező hálózati fejléc**
   - `x-forwarded-for` kötelező.
2. **Jogosultságkezelés**
   - Kötelező permission: `post.category.delete.global`.
3. **Token kezelés**
   - Kötelező `Bearer` token.

## Használat

- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `DeletePostCategory`

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token. |
| `post_category_id` | `string (UUID)` | Igen | Törlendő kategória azonosítója. |

---

## Endpoint

- **Név:** Group post category create
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/post/category/create`
- **Leírás:** Új post kategória létrehozása csoport jogosultsággal.

## Jogosultságok (Permissions)

1. **Kötelező hálózati fejléc**
   - `x-forwarded-for` kötelező.
2. **Jogosultságkezelés**
   - Kötelező csoport permission: `group.post.category.create`.
3. **Token kezelés**
   - Kötelező `Bearer` token.

## Használat

- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `CreatePostCategory`

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token. |
| `group_id` | `string` | Igen | Group ID (titkosított vagy UUID) az RBAC ellenőrzéshez. |
| `name` | `string` | Igen | Kategória neve. |
| `description` | `string` | Igen | Kategória leírása. |
| `created_by` | `string (UUID)` | Nem | Létrehozó user azonosító. |

---

## Endpoint

- **Név:** Group post category get
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/post/category/get`
- **Leírás:** Post kategóriák lekérdezése csoport jogosultsággal.

## Jogosultságok (Permissions)

1. **Kötelező hálózati fejléc**
   - `x-forwarded-for` kötelező.
2. **Jogosultságkezelés**
   - Kötelező csoport permission: `group.post.category.read`.
3. **Token kezelés**
   - Kötelező `Bearer` token.

## Használat

- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetPostCategory`

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token. |
| `group_id` | `string` | Igen | Group ID (titkosított vagy UUID) az RBAC ellenőrzéshez. |
| `post_category_id` | `string (UUID)` | Nem | Konkrét kategória azonosító. |
| `name` | `string` | Nem | Név alapú szűrés. |
| `description` | `string` | Nem | Leírás alapú szűrés. |
| `created_by` | `string (UUID)` | Nem | Létrehozó alapján szűrés. |
| `limit` | `integer` | Nem | Maximum elemszám. |

---

## Endpoint

- **Név:** Group post category modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/post/category/modify`
- **Leírás:** Post kategória módosítása csoport jogosultsággal.

## Jogosultságok (Permissions)

1. **Kötelező hálózati fejléc**
   - `x-forwarded-for` kötelező.
2. **Jogosultságkezelés**
   - Kötelező csoport permission: `group.post.category.modify`.
3. **Token kezelés**
   - Kötelező `Bearer` token.

## Használat

- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `ModifyPostCategory`

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token. |
| `group_id` | `string` | Igen | Group ID (titkosított vagy UUID) az RBAC ellenőrzéshez. |
| `post_category_id` | `string (UUID)` | Igen | Módosítandó kategória azonosítója. |
| `name` | `string` | Nem | Új név. |
| `description` | `string` | Nem | Új leírás. |
| `created_by` | `string (UUID)` | Nem | Új létrehozó azonosító. |

---

## Endpoint

- **Név:** Group post category delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/post/category/delete`
- **Leírás:** Post kategória törlése csoport jogosultsággal.

## Jogosultságok (Permissions)

1. **Kötelező hálózati fejléc**
   - `x-forwarded-for` kötelező.
2. **Jogosultságkezelés**
   - Kötelező csoport permission: `group.post.category.delete`.
3. **Token kezelés**
   - Kötelező `Bearer` token.

## Használat

- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `DeletePostCategory`

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token. |
| `group_id` | `string` | Igen | Group ID (titkosított vagy UUID) az RBAC ellenőrzéshez. |
| `post_category_id` | `string (UUID)` | Igen | Törlendő kategória azonosítója. |

---

## Endpoint

- **Név:** Auth login
- **Metódus:** `POST`
- **Útvonal:** `/v1/auth/login`
- **Leírás:** Bejelentkezési folyamat végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/auth/login`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 5 perc`
- **Body/Model:** `UserLogin`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `grant_type` | `string` | Nem | Kérésparaméter. |
| `client_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `client_secret` | `string` | Igen | Kérésparaméter. |
| `device_type` | `string` | Igen | Kérésparaméter. |
| `email` | `string (email)` | Igen | Email alapú mező. |
| `password` | `string` | Igen | Jelszó mező. |
| `redirect` | `string` | Nem | Kérésparaméter. |
| `safe_device` | `boolean` | Nem | Kérésparaméter. |
| `device_token` | `string` | Nem | Token érték a folyamathoz. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `access_token` | `string` | Hozzáférési token. |
| `refresh_token` | `string` | Frissítő token. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Auth logout
- **Metódus:** `POST`
- **Útvonal:** `/v1/auth/logout`
- **Leírás:** Kijelentkezési folyamat végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/auth/logout`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 5 perc`
- **Body/Model:** `UserLogout`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `grant_type` | `string` | Nem | Kérésparaméter. |
| `client_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `client_secret` | `string` | Igen | Kérésparaméter. |
| `device_type` | `string` | Igen | Kérésparaméter. |
| `access_token` | `string` | Nem | Token érték a folyamathoz. |
| `refresh_token` | `string` | Nem | Token érték a folyamathoz. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Auth multi factor authentication
- **Metódus:** `POST`
- **Útvonal:** `/v1/auth/multi-factor-authentication`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/auth/multi-factor-authentication`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 5 perc`
- **Body/Model:** `UserMultiFactorAuthentication`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `grant_type` | `string` | Nem | Kérésparaméter. |
| `client_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `client_secret` | `string` | Igen | Kérésparaméter. |
| `device_type` | `string` | Igen | Kérésparaméter. |
| `multi_factor_token` | `string` | Nem | Token érték a folyamathoz. |
| `multi_factor_type` | `string (enum)` | Nem | Kérésparaméter. |
| `totp_number` | `string` | Nem | Lapozási vagy mennyiségi paraméter. |
| `email_code` | `string` | Nem | Email alapú mező. |
| `safe_device` | `boolean` | Nem | Kérésparaméter. |
| `device_token` | `string` | Nem | Token érték a folyamathoz. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Auth register
- **Metódus:** `POST`
- **Útvonal:** `/v1/auth/register`
- **Leírás:** Regisztrációs folyamat végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/auth/register`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 10 perc`
- **Body/Model:** `User`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `grant_type` | `string` | Nem | Kérésparaméter. |
| `client_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `client_secret` | `string` | Igen | Kérésparaméter. |
| `device_type` | `string` | Igen | Kérésparaméter. |
| `password` | `string` | Igen | Jelszó mező. |
| `fullname` | `string` | Igen | Kérésparaméter. |
| `email` | `string (email)` | Igen | Email alapú mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Auth reset password
- **Metódus:** `POST`
- **Útvonal:** `/v1/auth/reset-password`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/auth/reset-password`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 5 perc`
- **Body/Model:** `UserResetPassword`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `reset_token` | `string` | Igen | Token érték a folyamathoz. |
| `newpassword` | `string` | Igen | Jelszó mező. |
| `newpassword_rep` | `string` | Igen | Jelszó mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Auth send email verification
- **Metódus:** `POST`
- **Útvonal:** `/v1/auth/send-email-verification`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/auth/send-email-verification`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `10 kérés / 5 perc`
- **Body/Model:** `Bearer`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Auth token
- **Metódus:** `POST`
- **Útvonal:** `/v1/auth/token`
- **Leírás:** Token művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/auth/token`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `10 kérés / 1 perc`
- **Body/Model:** `UserTokenCreate`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `grant_type` | `string` | Nem | Kérésparaméter. |
| `client_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `client_secret` | `string` | Igen | Kérésparaméter. |
| `device_type` | `string` | Igen | Kérésparaméter. |
| `refresh_token` | `string` | Igen | Token érték a folyamathoz. |
| `scopes` | `array[string]` | Igen | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `access_token` | `string` | Hozzáférési token. |
| `refresh_token` | `string` | Frissítő token. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Auth verify email {email verification token}
- **Metódus:** `POST`
- **Útvonal:** `/v1/auth/verify-email/{email_verification_token}`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/auth/verify-email/{email_verification_token}`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 5 perc`
- **Body/Model:** `UserVerifyEmail`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Path paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `email_verification_token` | `string` | Igen | Útvonalparaméter. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `grant_type` | `string` | Nem | Kérésparaméter. |
| `client_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `client_secret` | `string` | Igen | Kérésparaméter. |
| `device_type` | `string` | Igen | Kérésparaméter. |
| `email_verification_token` | `string` | Nem | Token érték a folyamathoz. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Global calendar event create
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/calendar/event/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `global.calendar.event.create`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/global/calendar/event/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Body/Model:** `CreateGroupCalendarEvent`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_calendar_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `kind` | `string` | Igen | Kérésparaméter. |
| `name` | `string` | Igen | Kérésparaméter. |
| `parent_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `location` | `string` | Nem | Kérésparaméter. |
| `all_day` | `boolean` | Nem | Kérésparaméter. |
| `start_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `end_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `rrule` | `string` | Nem | Kérésparaméter. |
| `until_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `count_n` | `integer` | Nem | Kérésparaméter. |
| `original_start_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `is_cancelled` | `boolean` | Nem | Logikai jelzőmező. |
| `timezone` | `string` | Nem | Kérésparaméter. |
| `is_global` | `boolean` | Nem | Logikai jelzőmező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` / `*_id` | `string` | Létrehozott erőforrás azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Global calendar event delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/calendar/event/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `global.calendar.event.delete`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/global/calendar/event/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Body/Model:** `DeleteGlobalGroupCalendarEvent`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_calendar_event_id` | `string` | Igen | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Global calendar event modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/calendar/event/modify`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `global.calendar.event.modify`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/global/calendar/event/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Body/Model:** `ModifyGroupCalendarEvent`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_calendar_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `group_calendar_event_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `calendar_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `kind` | `string` | Nem | Kérésparaméter. |
| `name` | `string` | Nem | Kérésparaméter. |
| `parent_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `location` | `string` | Nem | Kérésparaméter. |
| `all_day` | `boolean` | Nem | Kérésparaméter. |
| `start_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `end_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `rrule` | `string` | Nem | Kérésparaméter. |
| `until_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `count_n` | `integer` | Nem | Kérésparaméter. |
| `original_start_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `is_cancelled` | `boolean` | Nem | Logikai jelzőmező. |
| `timezone` | `string` | Nem | Kérésparaméter. |
| `is_global` | `boolean` | Nem | Logikai jelzőmező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Global post create
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/post/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `post.create.global`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/global/post/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `CreatePost`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `title` | `string` | Igen | Kérésparaméter. |
| `content` | `string` | Igen | Kérésparaméter. |
| `is_global` | `boolean` | Nem | Logikai jelzőmező. |
| `group_id` | `string` | Nem | Csoport azonosító. |
| `category_id` | `string` | Nem | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` / `*_id` | `string` | Létrehozott erőforrás azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Global post delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/post/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `post.delete.global`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/global/post/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `DeletePost`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Nem | Csoport azonosító. |
| `post_id` | `array[string]` | Igen | Titkosított post azonosítók listája. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Global post get
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/post/get`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `post.get.global`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/global/post/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetPost`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Nem | Csoport azonosító. |
| `post_id` | `string` | Igen | Titkosított post azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` | `string (UUID)` | Task azonosító. |
| `issue_key` | `string` | Task kulcs. |
| `summary` | `string` | Rövid összefoglaló. |
| `description` | `string/null` | Részletes leírás. |
| `task_type` | `string` | Task típus (`STORY`, `TASK`, `BUG`, `EPIC`, `SUBTASK`). |
| `status` | `string` | Task státusz (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `BLOCKED`). |
| `priority` | `string` | Prioritás. |
| `parent_task_id` | `string (UUID)/null` | Szülő task azonosító (ha alfeladat). |
| `subtasks_total` | `integer` | A taskhoz tartozó közvetlen alfeladatok száma. |
| `subtasks_completed` | `integer` | A lezárt (vagy `completed_at`-tal rendelkező) alfeladatok száma. |
| `created_at` | `string (ISO-8601 datetime)` | Létrehozási idő. |
| `updated_at` | `string (ISO-8601 datetime)` | Utolsó módosítás ideje. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Global post modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/post/modify`
- **Leírás:** Meglévő globális post részleges módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `post.modify.global`.
   - Más felhasználó postjának módosításához kiegészítő jogosultság kell: `post.modify.other.global`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A `post_id` titkosított értékét dekódolja.
3. Globális jogosultság-ellenőrzés fut le.
4. A kérésben megadott mezők (`title`, `content`, `is_global`, `category_id`, `author_id`) részlegesen frissülnek.
5. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/global/post/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `ModifyPost`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `post_id` | `string` | Igen | Titkosított post azonosító. |
| `title` | `string` | Nem | Új cím. |
| `content` | `string` | Nem | Új tartalom. |
| `is_global` | `boolean` | Nem | Globális jelző módosítása (global endpointon `false` nem engedett). |
| `category_id` | `string` | Nem | Titkosított post kategória azonosító. |
| `author_id` | `string` | Nem | Titkosított user azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `post_id` | `string` | A módosított post titkosított azonosítója. |
| `changes` | `array[string] \| null` | A ténylegesen módosított mezők listája, vagy `null`. |
| `scope` | `string` | Módosítási scope: `global`. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság hiánya, különösen más user postjának módosításánál. |
| `404` | `Record not found.` | A post nem található. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Global post panel
- **Metódus:** `POST`
- **Útvonal:** `/v1/global/post/panel`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `post.get.global`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/global/post/panel`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetPostPanel`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Nem | Csoport azonosító. |
| `page_number` | `integer` | Igen | Lapozási vagy mennyiségi paraméter. |
| `load_post_number` | `integer` | Igen | Lapozási vagy mennyiségi paraméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `tasks` | `array[object]` | A lekért task lista. |
| `total_tasks` | `integer` | A feltételnek megfelelő taskok teljes száma. |
| `total_pages` | `integer` | Összes oldalszám. |
| `current_page` | `integer` | Aktuális oldalszám. |
| `tasks[].id` | `string (UUID)` | Task azonosító. |
| `tasks[].summary` | `string` | Rövid összefoglaló. |
| `tasks[].status` | `string` | Task státusz. |
| `tasks[].parent_task_id` | `string (UUID)/null` | Szülő task azonosító. |
| `tasks[].subtasks_total` | `integer` | A taskhoz tartozó közvetlen alfeladatok száma. |
| `tasks[].subtasks_completed` | `integer` | A lezárt (vagy `completed_at`-tal rendelkező) alfeladatok száma. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group calendar create
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/calendar/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.calendar.write`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/calendar/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `35 kérés / 5 perc`
- **Body/Model:** `CreateGroupCalendar`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `calendar_name` | `string` | Igen | Kérésparaméter. |
| `calendar_description` | `string` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` / `*_id` | `string` | Létrehozott erőforrás azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group calendar delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/calendar/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.calendar.write`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/calendar/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `30 kérés / 5 perc`
- **Body/Model:** `DeleteGroupCalendar`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `group_calendar_id` | `string` | Igen | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group calendar event create
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/calendar/event/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.calendar.event.write`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/calendar/event/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `CreateGroupCalendarEvent`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `group_calendar_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `kind` | `string` | Igen | Kérésparaméter. |
| `name` | `string` | Igen | Kérésparaméter. |
| `parent_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `location` | `string` | Nem | Kérésparaméter. |
| `all_day` | `boolean` | Nem | Kérésparaméter. |
| `start_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `end_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `rrule` | `string` | Nem | Kérésparaméter. |
| `until_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `count_n` | `integer` | Nem | Kérésparaméter. |
| `original_start_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `is_cancelled` | `boolean` | Nem | Logikai jelzőmező. |
| `timezone` | `string` | Nem | Kérésparaméter. |
| `is_global` | `boolean` | Nem | Logikai jelzőmező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` / `*_id` | `string` | Létrehozott erőforrás azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group calendar event delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/calendar/event/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.calendar.event.write`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/calendar/event/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `45 kérés / 5 perc`
- **Body/Model:** `DeleteGroupCalendarEvent`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `group_calendar_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `group_calendar_event_id` | `string` | Igen | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group calendar event get
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/calendar/event/get`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.calendar.event.read`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/calendar/event/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetGroupCalendarEvent`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `group_calendar_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `include_cancelled` | `boolean` | Nem | Kérésparaméter. |
| `only_global` | `boolean` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` | `string (UUID)` | Task azonosító. |
| `issue_key` | `string` | Task kulcs. |
| `summary` | `string` | Rövid összefoglaló. |
| `description` | `string/null` | Részletes leírás. |
| `task_type` | `string` | Task típus (`STORY`, `TASK`, `BUG`, `EPIC`, `SUBTASK`). |
| `status` | `string` | Task státusz (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `BLOCKED`). |
| `priority` | `string` | Prioritás. |
| `parent_task_id` | `string (UUID)/null` | Szülő task azonosító (ha alfeladat). |
| `subtasks_total` | `integer` | A taskhoz tartozó közvetlen alfeladatok száma. |
| `subtasks_completed` | `integer` | A lezárt (vagy `completed_at`-tal rendelkező) alfeladatok száma. |
| `created_at` | `string (ISO-8601 datetime)` | Létrehozási idő. |
| `updated_at` | `string (ISO-8601 datetime)` | Utolsó módosítás ideje. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group calendar event modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/calendar/event/modify`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.calendar.event.write`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/calendar/event/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `45 kérés / 5 perc`
- **Body/Model:** `ModifyGroupCalendarEvent`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `group_calendar_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `group_calendar_event_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `calendar_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `kind` | `string` | Nem | Kérésparaméter. |
| `name` | `string` | Nem | Kérésparaméter. |
| `parent_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `location` | `string` | Nem | Kérésparaméter. |
| `all_day` | `boolean` | Nem | Kérésparaméter. |
| `start_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `end_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `rrule` | `string` | Nem | Kérésparaméter. |
| `until_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `count_n` | `integer` | Nem | Kérésparaméter. |
| `original_start_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `is_cancelled` | `boolean` | Nem | Logikai jelzőmező. |
| `timezone` | `string` | Nem | Kérésparaméter. |
| `is_global` | `boolean` | Nem | Logikai jelzőmező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group calendar get
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/calendar/get`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.calendar.read`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/calendar/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `90 kérés / 2 perc`
- **Body/Model:** `GetGroupCalendar`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Nem | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group calendar modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/calendar/modify`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.calendar.write`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/calendar/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `35 kérés / 5 perc`
- **Body/Model:** `ModifyGroupCalendar`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Nem | Az adott erőforrás azonosítója. |
| `group_calendar_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `calendar_name` | `string` | Nem | Kérésparaméter. |
| `calendar_description` | `string` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group create
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.create`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 5 perc`
- **Body/Model:** `CreateGroup`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `name` | `string` | Igen | Kérésparaméter. |
| `description` | `string` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` / `*_id` | `string` | Létrehozott erőforrás azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group create add usertogroup
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/create/add/usertogroup`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.create.add.usertogroup`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/create/add/usertogroup`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 4 perc`
- **Body/Model:** `CreateAddUserToGroup`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `user_id` | `string` | Igen | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` / `*_id` | `string` | Létrehozott erőforrás azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.delete.group`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 4 perc`
- **Body/Model:** `DeleteGroup`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group delete remove userfromgroup
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/delete/remove/userfromgroup`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.delete.remove.userfromgroup`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/delete/remove/userfromgroup`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 4 perc`
- **Body/Model:** `DeleteRemoveUserFromGroup`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `user_id` | `string` | Igen | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group getgroup
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/getgroup`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.get.group`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/getgroup`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 4 perc`
- **Body/Model:** `GetGroup`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group getgroups
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/getgroups`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.get.all.group`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/getgroups`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `70 kérés / 1 perc`
- **Body/Model:** `GetGroups`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group getusergroups
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/getusergroups`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.get.user`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/getusergroups`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 1 perc`
- **Body/Model:** `GetUserGroup`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group modifygroupbase
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/modifygroupbase`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.modify.base`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/modifygroupbase`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 4 perc`
- **Body/Model:** `ModifyGroupBase`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_name` | `string` | Nem | Kérésparaméter. |
| `group_description` | `string` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group permission
- **Metódus:** `GET`
- **Útvonal:** `/v1/group/permission`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/permission`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** `GetUserGroupPermission`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group permission get all
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/permission/get/all`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.permission.get.all`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/permission/get/all`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `90 kérés / 2 perc`
- **Body/Model:** `GetAllGroupPermission`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group post create
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/post/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.post.create`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/post/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `CreatePost`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `title` | `string` | Igen | Kérésparaméter. |
| `content` | `string` | Igen | Kérésparaméter. |
| `is_global` | `boolean` | Nem | Logikai jelzőmező. |
| `group_id` | `string` | Nem | Csoport azonosító. |
| `category_id` | `string` | Nem | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` / `*_id` | `string` | Létrehozott erőforrás azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group post delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/post/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.post.delete`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/post/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `DeletePost`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Nem | Csoport azonosító. |
| `post_id` | `array[string]` | Igen | Titkosított post azonosítók listája. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group post get
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/post/get`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.post.read`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/post/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetPost`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Nem | Csoport azonosító. |
| `post_id` | `string` | Igen | Titkosított post azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group post modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/post/modify`
- **Leírás:** Meglévő csoportos post részleges módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.post.modify`.
   - Más felhasználó postjának módosításához kiegészítő csoport jogosultság kell: `group.post.modify.other`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A `group_id` és `post_id` titkosított értékeit dekódolja.
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. A kérésben megadott mezők (`title`, `content`, `is_global`, `group_id`, `category_id`, `author_id`) részlegesen frissülnek.
5. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/post/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `ModifyPost`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Titkosított group azonosító (RBAC és post-csoport ellenőrzéshez). |
| `post_id` | `string` | Igen | Titkosított post azonosító. |
| `title` | `string` | Nem | Új cím. |
| `content` | `string` | Nem | Új tartalom. |
| `is_global` | `boolean` | Nem | Globális jelző módosítása (group endpointon `true` nem engedett). |
| `category_id` | `string` | Nem | Titkosított post kategória azonosító. |
| `author_id` | `string` | Nem | Titkosított user azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `post_id` | `string` | A módosított post titkosított azonosítója. |
| `changes` | `array[string] \| null` | A ténylegesen módosított mezők listája, vagy `null`. |
| `scope` | `string` | Módosítási scope: `group`. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság/csoporttagság hiánya, vagy más user postjának módosítása megfelelő jog nélkül. |
| `404` | `Record not found.` | A post nem található. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group post panel
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/post/panel`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.post.read`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/post/panel`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetPostPanel`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Nem | Csoport azonosító. |
| `page_number` | `integer` | Igen | Lapozási vagy mennyiségi paraméter. |
| `load_post_number` | `integer` | Igen | Lapozási vagy mennyiségi paraméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `tasks` | `array[object]` | A lekért task lista. |
| `total_tasks` | `integer` | A feltételnek megfelelő taskok teljes száma. |
| `total_pages` | `integer` | Összes oldalszám. |
| `current_page` | `integer` | Aktuális oldalszám. |
| `tasks[].id` | `string (UUID)` | Task azonosító. |
| `tasks[].summary` | `string` | Rövid összefoglaló. |
| `tasks[].status` | `string` | Task státusz. |
| `tasks[].parent_task_id` | `string (UUID)/null` | Szülő task azonosító. |
| `tasks[].subtasks_total` | `integer` | A taskhoz tartozó közvetlen alfeladatok száma. |
| `tasks[].subtasks_completed` | `integer` | A lezárt (vagy `completed_at`-tal rendelkező) alfeladatok száma. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group role create
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/role/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.role.create`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/role/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `30 kérés / 5 perc`
- **Body/Model:** `CreateGroupRole`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_name` | `string` | Igen | Kérésparaméter. |
| `group_role_description` | `string` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` / `*_id` | `string` | Létrehozott erőforrás azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group role delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/role/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.role.delete`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/role/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 5 perc`
- **Body/Model:** `DeleteGroupRole`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Igen | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group role get
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/role/get`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.role.get`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/role/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `80 kérés / 2 perc`
- **Body/Model:** `GetGroupRole`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group role modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/role/modify`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.role.modify`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/role/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `30 kérés / 5 perc`
- **Body/Model:** `ModifyGroupRole`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `group_role_name` | `string` | Nem | Kérésparaméter. |
| `group_role_description` | `string` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group role permission set fixed
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/role/permission/set/fixed`
- **Leírás:** Csoportszerepkör fix jogosultságainak beállítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.role.permission.set.fixed`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/role/permission/set/fixed`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `25 kérés / 5 perc`
- **Body/Model:** `SetGroupRoleFixedPermission`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `group_permission_ids` | `array[string]` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Group admin role create
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/role/create`
- **Leírás:** Admin jogosultsággal csoportszerepkör létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.admin.role.management`.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/role/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `30 kérés / 5 perc`
- **Body/Model:** `CreateGroupRole`

## Paraméterek

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_name` | `string` | Igen | Új csoportszerepkör neve. |
| `group_role_description` | `string` | Nem | Új csoportszerepkör leírása. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` / `group_role_id` | `string` | Létrehozott szerepkör azonosítója. |

---

## Endpoint

- **Név:** Group admin role get
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/role/get`
- **Leírás:** Admin jogosultsággal csoportszerepkör(ök) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.admin.role.management`.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/role/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `80 kérés / 2 perc`
- **Body/Model:** `GetGroupRole`

## Paraméterek

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `group_id` | `string` | Igen | Csoport azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `group_roles` | `array` | A csoporthoz tartozó szerepkörök listája. |

---

## Endpoint

- **Név:** Group admin role modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/role/modify`
- **Leírás:** Admin jogosultsággal csoportszerepkör módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.admin.role.management`.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/role/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `30 kérés / 5 perc`
- **Body/Model:** `ModifyGroupRole`

## Paraméterek

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Igen | Módosítandó szerepkör azonosítója. |
| `group_role_name` | `string` | Nem | Új szerepkör név. |
| `group_role_description` | `string` | Nem | Új szerepkör leírás. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Módosítás eredménye. |

---

## Endpoint

- **Név:** Group admin role delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/role/delete`
- **Leírás:** Admin jogosultsággal csoportszerepkör törlése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.admin.role.management`.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/role/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 5 perc`
- **Body/Model:** `DeleteGroupRole`

## Paraméterek

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Igen | Törlendő szerepkör azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési eredmény. |

---

## Endpoint

- **Név:** Group admin permission get all
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/permission/get/all`
- **Leírás:** Admin jogosultsággal csoport permission lista lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.admin.role.management`.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/permission/get/all`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `90 kérés / 2 perc`
- **Body/Model:** `GetAllGroupPermission`

## Paraméterek

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `group_permissions` | `array` | Elérhető csoport permission elemek listája. |

---

## Endpoint

- **Név:** Group admin member role add
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/member/role/add`
- **Leírás:** Admin jogosultsággal csoporttaghoz csoportszerepkör hozzárendelése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.admin.role.management`.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/member/role/add`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `40 kérés / 5 perc`
- **Body/Model:** `AddGroupMemberRole`

## Paraméterek

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `user_id` | `string` | Igen | Felhasználó azonosító. |
| `group_role_id` | `string` | Igen | Hozzárendelendő csoportszerepkör azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string` | Művelet eredménye. |
| `group_id` | `string` | Csoport azonosítója. |
| `user_id` | `string` | Felhasználó azonosítója. |
| `group_role_id` | `string` | Beállított csoportszerepkör azonosítója. |

---

## Endpoint

- **Név:** Group admin member role modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/member/role/modify`
- **Leírás:** Admin jogosultsággal csoporttagon lévő csoportszerepkör módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.admin.role.management`.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/member/role/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `40 kérés / 5 perc`
- **Body/Model:** `ModifyGroupMemberRole`

## Paraméterek

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `user_id` | `string` | Igen | Felhasználó azonosító. |
| `group_role_id` | `string` | Igen | Új csoportszerepkör azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string` | Művelet eredménye. |
| `group_id` | `string` | Csoport azonosítója. |
| `user_id` | `string` | Felhasználó azonosítója. |
| `previous_group_role_id` | `string`/`null` | Előző csoportszerepkör azonosítója. |
| `group_role_id` | `string` | Új csoportszerepkör azonosítója. |

---

## Endpoint

- **Név:** Group admin member role remove
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/member/role/remove`
- **Leírás:** Admin jogosultsággal csoporttagról csoportszerepkör eltávolítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.admin.role.management`.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/member/role/remove`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `40 kérés / 5 perc`
- **Body/Model:** `RemoveGroupMemberRole`

## Paraméterek

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `user_id` | `string` | Igen | Felhasználó azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string` | Művelet eredménye. |
| `group_id` | `string` | Csoport azonosítója. |
| `user_id` | `string` | Felhasználó azonosítója. |
| `removed_group_role_id` | `string` | Eltávolított csoportszerepkör azonosítója. |

---

## Endpoint

- **Név:** Group admin role permission set fixed
- **Metódus:** `POST`
- **Útvonal:** `/v1/group/admin/role/permission/set/fixed`
- **Leírás:** Admin jogosultsággal fix permission lista beállítása egy csoportszerepkörre.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `group.admin.role.management`.

## Használat

### Kérés formátuma

- **URL:** `/v1/group/admin/role/permission/set/fixed`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `25 kérés / 5 perc`
- **Body/Model:** `SetGroupRoleFixedPermission`

## Paraméterek

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `group_role_id` | `string` | Igen | Módosítandó szerepkör azonosítója. |
| `group_permission_ids` | `array[string]` | Nem | Beállítandó fix permission azonosítók. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Route-függő üzleti válasz. |

---

## Endpoint

- **Név:** Mobil  deative
- **Metódus:** `POST`
- **Útvonal:** `/v1/mobil//deative`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/mobil//deative`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Body/Model:** `DeactiveTokenRequest`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `token` | `string` | Igen | Token érték a folyamathoz. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Mobil  register
- **Metódus:** `POST`
- **Útvonal:** `/v1/mobil//register`
- **Leírás:** Regisztrációs folyamat végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/mobil//register`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Body/Model:** `RegisterTokenRequest`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `token` | `string` | Igen | Token érték a folyamathoz. |
| `device_type` | `string` | Igen | Kérésparaméter. |
| `device_name` | `string` | Igen | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Oauth forgot password
- **Metódus:** `GET`
- **Útvonal:** `/v1/oauth/forgot-password`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/oauth/forgot-password`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** nincs dedikált request modell

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Oauth login
- **Metódus:** `GET`
- **Útvonal:** `/v1/oauth/login`
- **Leírás:** Bejelentkezési folyamat végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/oauth/login`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** nincs dedikált request modell

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `access_token` | `string` | Hozzáférési token. |
| `refresh_token` | `string` | Frissítő token. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Oauth multi factor authentication
- **Metódus:** `GET`
- **Útvonal:** `/v1/oauth/multi-factor-authentication`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/oauth/multi-factor-authentication`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** nincs dedikált request modell

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Query paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `multi_factor_token` | `string` | Igen | MFA token. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Oauth privacypolicy
- **Metódus:** `GET`
- **Útvonal:** `/v1/oauth/privacypolicy`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/oauth/privacypolicy`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** nincs dedikált request modell

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Oauth register
- **Metódus:** `GET`
- **Útvonal:** `/v1/oauth/register`
- **Leírás:** Regisztrációs folyamat végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/oauth/register`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** nincs dedikált request modell

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Oauth reset password
- **Metódus:** `GET`
- **Útvonal:** `/v1/oauth/reset-password`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/oauth/reset-password`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** nincs dedikált request modell

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Query paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `reset_token` | `string` | Igen | Password reset token (43 karakter). |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Oauth termsandconditions
- **Metódus:** `GET`
- **Útvonal:** `/v1/oauth/termsandconditions`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/oauth/termsandconditions`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** nincs dedikált request modell

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Oauth verify email {email verification token}
- **Metódus:** `GET`
- **Útvonal:** `/v1/oauth/verify-email/{email_verification_token}`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/oauth/verify-email/{email_verification_token}`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** nincs dedikált request modell

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Path paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `email_verification_token` | `string` | Igen | Útvonalparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Role allroles
- **Metódus:** `GET`
- **Útvonal:** `/v1/role/allroles`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `role.get.all.role`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/role/allroles`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Rate limit:** `600 kérés / 5 perc`
- **Body/Model:** `GetAllRole`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task category create
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/category/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.category.create`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/category/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `CreateTaskCategory`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `name` | `string` | Igen | Kérésparaméter. |
| `description` | `string` | Nem | Kérésparaméter. |
| `color` | `string` | Nem | Kérésparaméter. |
| `is_global` | `boolean` | Nem | Logikai jelzőmező. |
| `created_by` | `string` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `task_category_id` | `string` | Létrehozott task kategória titkosított azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task category delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/category/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.category.delete`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/category/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `DeleteTaskCategory`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_category_id` | `string` | Igen | Titkosított task kategória azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task category get
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/category/get`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.category.read`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/category/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetTaskCategory`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_category_id` | `string` | Nem | Titkosított task kategória azonosító. |
| `is_global` | `boolean` | Nem | Logikai jelzőmező. |
| `limit` | `integer` | Nem | Lapozási vagy mennyiségi paraméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `task_categories` | `array[object]` | Lekérdezett task kategóriák listája. |
| `task_categories[].id` | `string` | Task kategória titkosított azonosítója. |
| `task_categories[].name` | `string` | Kategória neve. |
| `task_categories[].description` | `string/null` | Kategória leírása. |
| `task_categories[].color` | `string` | Kategória színkódja (hex). |
| `task_categories[].is_global` | `boolean` | Globális láthatóság jelző. |
| `task_categories[].group_id` | `string (UUID)` | Kategóriát birtokló csoport UUID-ja. |
| `task_categories[].created_by` | `string (UUID)/null` | Létrehozó felhasználó UUID-ja. |
| `task_categories[].created_at` | `string (ISO-8601 datetime)` | Létrehozási idő. |
| `task_categories[].updated_at` | `string (ISO-8601 datetime)` | Utolsó módosítás ideje. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task category modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/category/modify`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.category.modify`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/category/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `ModifyTaskCategory`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_category_id` | `string` | Igen | Titkosított task kategória azonosító. |
| `name` | `string` | Nem | Kérésparaméter. |
| `description` | `string` | Nem | Kérésparaméter. |
| `color` | `string` | Nem | Kérésparaméter. |
| `is_global` | `boolean` | Nem | Logikai jelzőmező. |
| `task_group_id` | `string (UUID)` | Nem | Cél csoport UUID (ha a kategória csoportját át kell helyezni). |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `task_category_id` | `string` | A módosított task kategória titkosított azonosítója. |
| `changes` | `array[string]/null` | A ténylegesen módosított mezők listája. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task comment create
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/comment/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.comment.create`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/comment/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `90 kérés / 2 perc`
- **Body/Model:** `CreateTaskComment`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_id` | `string` | Igen | Titkosított task azonosító. |
| `author_id` | `string` | Nem | Opcionális mező; a backend a komment szerzőjét a `Bearer` tokenből állítja be. |
| `comment` | `string` | Igen | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `task_comment_id` | `string` | Létrehozott task komment titkosított azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task comment delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/comment/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.comment.delete`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/comment/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `90 kérés / 2 perc`
- **Body/Model:** `DeleteTaskComment`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_comment_id` | `string` | Igen | Titkosított task komment azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task comment get
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/comment/get`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.comment.read`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/comment/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetTaskComments`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_id` | `string` | Igen | Titkosított task azonosító. |
| `limit` | `integer` | Nem | Lapozási vagy mennyiségi paraméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `task_comments` | `array[object]` | A task kommentek időrendben (`created_at ASC`). |
| `task_comments[].id` | `string` | Task komment titkosított azonosítója. |
| `task_comments[].task_id` | `string` | A kommenthez tartozó task titkosított azonosítója. |
| `task_comments[].comment` | `string` | Komment szövege. |
| `task_comments[].author` | `object/null` | Komment szerző adatai (ha elérhető). |
| `task_comments[].author.author_email` | `string` | Szerző email címe. |
| `task_comments[].author.author_fullname` | `string` | Szerző teljes neve. |
| `task_comments[].created_at` | `string (ISO-8601 datetime)` | Létrehozási idő. |
| `task_comments[].updated_at` | `string (ISO-8601 datetime)` | Utolsó módosítás ideje. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task comment modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/comment/modify`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.comment.modify`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/comment/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `90 kérés / 2 perc`
- **Body/Model:** `ModifyTaskComment`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_comment_id` | `string` | Igen | Titkosított task komment azonosító. |
| `comment` | `string` | Igen | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `task_comment_id` | `string` | A módosított task komment titkosított azonosítója. |
| `changes` | `array[string]/null` | A ténylegesen módosított mezők listája. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task create
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/create`
- **Leírás:** Új erőforrás létrehozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.create`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `60 kérés / 5 perc`
- **Body/Model:** `CreateTask`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `issue_key` | `string` | Igen | Kérésparaméter. |
| `summary` | `string` | Igen | Kérésparaméter. |
| `description` | `string` | Nem | Kérésparaméter. |
| `task_type` | `string` | Nem | Kérésparaméter. |
| `status` | `string` | Nem | Kérésparaméter. |
| `priority` | `string` | Nem | Kérésparaméter. |
| `reporter_id` | `string (UUID)` | Nem | Riporter user UUID. |
| `assignee_id` | `string (UUID)` | Nem | Felelős user UUID. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `parent_task_id` | `string` | Nem | Titkosított szülő task azonosító. |
| `story_points` | `integer` | Nem | Kérésparaméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `task_id` | `string` | Létrehozott task titkosított azonosítója. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/delete`
- **Leírás:** Erőforrás törlése vagy deaktiválása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.delete`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `DeleteTask`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_id` | `array[string]` | Igen | Titkosított task azonosítók listája. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `deleted` | `boolean`/`object` | Törlési vagy deaktiválási eredmény. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task get
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/get`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.read`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetTask`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_id` | `string` | Igen | Titkosított task azonosító. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `id` | `string` | Titkosított task azonosító. |
| `issue_key` | `string` | Task kulcs. |
| `summary` | `string` | Rövid összefoglaló. |
| `description` | `string/null` | Részletes leírás. |
| `task_type` | `string` | Task típus (`STORY`, `TASK`, `BUG`, `EPIC`, `SUBTASK`). |
| `status` | `string` | Task státusz (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `BLOCKED`). |
| `priority` | `string` | Prioritás. |
| `story_points` | `integer/null` | Story pont érték. |
| `due_at` | `string (ISO-8601 datetime)/null` | Tervezett határidő. |
| `started_at` | `string (ISO-8601 datetime)/null` | Kezdési idő. |
| `completed_at` | `string (ISO-8601 datetime)/null` | Befejezési idő. |
| `is_archived` | `boolean` | Archiváltsági állapot. |
| `reporter` | `object/null` | Riporter adatai (ha van). |
| `reporter.reporter_email` | `string` | Riporter email címe. |
| `reporter.reporter_fulname` | `string` | Riporter teljes neve. |
| `assigneer_id` | `object/null` | Hozzárendelt felhasználó adatai (ha van). |
| `assigneer_id.assigneer_email` | `string` | Hozzárendelt user email címe. |
| `assigneer_id.assigneer_fullname` | `string` | Hozzárendelt user teljes neve. |
| `parent_task_id` | `string/null` | Titkosított szülő task azonosító (ha alfeladat). |
| `subtasks_total` | `integer` | A taskhoz tartozó közvetlen alfeladatok száma. |
| `created_at` | `string (ISO-8601 datetime)` | Létrehozási idő. |
| `updated_at` | `string (ISO-8601 datetime)` | Utolsó módosítás ideje. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task modify
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/modify`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.modify`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/modify`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `60 kérés / 5 perc`
- **Body/Model:** `ModifyTask`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_id` | `string` | Igen | Titkosított task azonosító. |
| `summary` | `string` | Nem | Kérésparaméter. |
| `description` | `string` | Nem | Kérésparaméter. |
| `task_type` | `string` | Nem | Kérésparaméter. |
| `status` | `string` | Nem | Kérésparaméter. |
| `priority` | `string` | Nem | Kérésparaméter. |
| `assignee_id` | `string` | Nem | Titkosított felhasználó azonosító. |
| `reporter_id` | `string` | Nem | Titkosított felhasználó azonosító. |
| `story_points` | `integer` | Nem | Kérésparaméter. |
| `due_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `started_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `completed_at` | `string (ISO-8601 datetime)` | Nem | Dátum/idő mező. |
| `is_archived` | `boolean` | Nem | Logikai jelzőmező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `task_id` | `string` | A módosított task titkosított azonosítója. |
| `changes` | `array[string]/null` | A ténylegesen módosított mezők listája. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task panel
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/panel`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.read`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/panel`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetTaskPanel`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `page_number` | `integer` | Igen | Lapozási vagy mennyiségi paraméter. |
| `load_task_number` | `integer` | Igen | Lapozási vagy mennyiségi paraméter. |
| `scope` | `string` | Nem | Szűrési mód: `all`, `assigned_to_me`, `reported_by_me`. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `tasks` | `array[object]` | A lekért task lista. |
| `total_tasks` | `integer` | A feltételnek megfelelő taskok teljes száma. |
| `total_pages` | `integer` | Összes oldalszám. |
| `current_page` | `integer` | Aktuális oldalszám. |
| `tasks[].id` | `string` | Titkosított task azonosító. |
| `tasks[].summary` | `string` | Rövid összefoglaló. |
| `tasks[].status` | `string` | Task státusz. |
| `tasks[].story_points` | `integer/null` | Story pont érték. |
| `tasks[].due_at` | `string (ISO-8601 datetime)/null` | Tervezett határidő. |
| `tasks[].started_at` | `string (ISO-8601 datetime)/null` | Kezdési idő. |
| `tasks[].completed_at` | `string (ISO-8601 datetime)/null` | Befejezési idő. |
| `tasks[].is_archived` | `boolean` | Archiváltsági állapot. |
| `tasks[].reporter` | `object/null` | Riporter adatai (ha van). |
| `tasks[].assigneer_id` | `object/null` | Hozzárendelt felhasználó adatai (ha van). |
| `tasks[].parent_task_id` | `string/null` | Titkosított szülő task azonosító. |
| `tasks[].subtasks_total` | `integer` | A taskhoz tartozó közvetlen alfeladatok száma. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Task history get
- **Metódus:** `POST`
- **Útvonal:** `/v1/task/history/get`
- **Leírás:** Egy task aktivitási/történeti naplójának lekérdezése, legújabb elemekkel elöl.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Csoportszintű jogosultság**
   - Kötelező csoport permission: `group.task.read`.
   - Kötelező csoporttagság és tokenből feloldható csoportszerepkör.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Csoportszintű jogosultság-ellenőrzés fut le.
4. A task-csoport kapcsolat ellenőrzése után a history rekordokat `created_at DESC` sorrendben adja vissza.

## Használat

### Kérés formátuma

- **URL:** `/v1/task/history/get`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Rate limit:** `120 kérés / 2 perc`
- **Body/Model:** `GetTaskHistory`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `group_id` | `string` | Igen | Csoport azonosító. |
| `task_id` | `string` | Igen | A vizsgált task titkosított azonosítója. |
| `limit` | `integer` | Nem | Visszaadott history elemek maximális száma (alapértelmezés: 50). |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `array[object]` | A task history elemek listája (legújabb elöl). |
| `data[].id` | `string` | Titkosított history rekord azonosító. |
| `data[].task_id` | `string` | Érintett task titkosított azonosítója. |
| `data[].user` | `object/null` | A módosítást végző user alap adatai (ha elérhető). |
| `data[].user.username` | `string` | Felhasználónév. |
| `data[].user.email` | `string` | Email cím. |
| `data[].action_type` | `string` | Művelettípus (`CREATED`, `STATUS_CHANGED`, `ASSIGNEE_CHANGED`, `REPORTER_CHANGED`, `SUMMARY_CHANGED`, `DESCRIPTION_CHANGED`, `TYPE_CHANGED`, `PRIORITY_CHANGED`, `STORY_POINTS_CHANGED`, `DUE_AT_CHANGED`, `STARTED_AT_CHANGED`, `COMPLETED_AT_CHANGED`, `ARCHIVE_CHANGED`). |
| `data[].old_value` | `string/null` | Korábbi érték (ha értelmezett). |
| `data[].new_value` | `string/null` | Új érték (ha értelmezett). |
| `data[].created_at` | `string (ISO-8601 datetime)` | Esemény időpontja. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található task vagy nincs hozzáférés a csoporton belül. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** Telegram webhook
- **Metódus:** `POST`
- **Útvonal:** `/v1/telegram/webhook`
- **Leírás:** Webhook payload fogadása és feldolgozása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/telegram/webhook`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Body/Model:** nincs dedikált request modell

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** User admin editprofile
- **Metódus:** `GET`
- **Útvonal:** `/v1/user/admin/editprofile`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `user.get.edit.admin.userprofil`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/user/admin/editprofile`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** `GetUserEditProfilAdmin`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `user_id` | `string` | Igen | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** User admin editprofile
- **Metódus:** `POST`
- **Útvonal:** `/v1/user/admin/editprofile`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `user.post.edit.admin.userprofil`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/user/admin/editprofile`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Body/Model:** `UserEditProfileAdmin`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `username` | `string` | Nem | Kérésparaméter. |
| `email` | `string (email)` | Nem | Email alapú mező. |
| `full_name` | `string` | Nem | Kérésparaméter. |
| `is_2fa_enable` | `boolean` | Nem | Logikai jelzőmező. |
| `totp_type` | `string (enum)` | Nem | Kérésparaméter. |
| `telegram_id` | `integer` | Nem | Az adott erőforrás azonosítója. |
| `user_id` | `string` | Igen | Az adott erőforrás azonosítója. |
| `password` | `string` | Nem | Jelszó mező. |
| `is_active` | `boolean` | Nem | Logikai jelzőmező. |
| `email_verified` | `boolean` | Nem | Email alapú mező. |
| `role_id` | `string` | Nem | Az adott erőforrás azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** User admin create
- **Metódus:** `POST`
- **Útvonal:** `/v1/user/admin/create`
- **Leírás:** Új felhasználó létrehozása admin jogosultsággal.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `user.post.create.admin.user`.

3. **Token kezelés**
   - A kérésmodell `Bearer` tokent használ.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (`Bearer`, `email`, `full_name`, `password`, opcionálisan `role_id` és státusz mezők).
3. Globális jogosultság-ellenőrzés fut le.
4. Ha érkezik `role_id`, a backend ellenőrzi, hogy a megadott szerepkör létezik-e.
5. A rendszer új felhasználót hoz létre generált `username` mezővel.
6. Siker esetén a route létrehozási visszajelzést és a létrehozott felhasználó azonosítóját adja vissza.

## Használat

### Kérés formátuma

- **URL:** `/v1/user/admin/create`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Body/Model:** `CreateUserAdmin`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `username` | `string` | Nem | Opcionális mező a request modellben, a létrehozás során a backend jelenleg saját `username` értéket generál. |
| `email` | `string (email)` | Igen | A létrehozandó felhasználó email címe. |
| `full_name` | `string` | Igen | A létrehozandó felhasználó teljes neve. |
| `is_2fa_enable` | `boolean` | Nem | Opcionális mező a request modellben, létrehozáskor jelenleg nincs külön felhasználva. |
| `totp_type` | `string (enum)` | Nem | Opcionális mező a request modellben, létrehozáskor jelenleg nincs külön felhasználva. |
| `telegram_id` | `integer` | Nem | Opcionális mező a request modellben, létrehozáskor jelenleg nincs külön felhasználva. |
| `password` | `string` | Igen | A létrehozandó felhasználó jelszava. |
| `is_active` | `boolean` | Nem | Aktív állapot. Hiányában az alapértelmezett érték `true`. |
| `email_verified` | `boolean` | Nem | Email megerősítettség. Hiányában az alapértelmezett érték `false`. |
| `role_id` | `string` | Nem | Titkosított szerepkör azonosító. Ha meg van adva, létező role-ra kell mutasson. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string` | Sikeres létrehozás esetén tipikusan: `Felhasznalo letrehozva.` |
| `user_id` | `string` | A létrehozott felhasználó UUID azonosítója. |
| `email_verified` | `boolean` | A létrehozott rekord email megerősítettségi állapota. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token, hiányzó IP fejléc vagy érvénytelen létrehozási adatok. |
| `403` | `Permission denied.` | A hívó nem rendelkezik a szükséges globális jogosultsággal. |
| `404` | `Record not found.` | A megadott szerepkör nem található. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `500` | `Application error occurred.` | Váratlan szerveroldali vagy adatbázis hiba. |

---

## Endpoint

- **Név:** User admin delete
- **Metódus:** `POST`
- **Útvonal:** `/v1/user/admin/delete`
- **Leírás:** Felhasználó törlése admin jogosultsággal.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `user.delete.user`.

3. **Token kezelés**
   - A kérésmodell `Bearer` tokent használ.

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (`Bearer`, `content-type`, `user_id`).
3. Globális jogosultság-ellenőrzés fut le.
4. A backend dekódolja a titkosított `user_id` értékét.
5. A rendszer törli a megadott felhasználót az adatbázisból.
6. Siker esetén a route `True` értékkel tér vissza.

## Használat

### Kérés formátuma

- **URL:** `/v1/user/admin/delete`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező)
  - `Content-Type: application/json`
- **Rate limit:** `20 kérés / 4 perc`
- **Body/Model:** `DeleteUser`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Igen | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `user_id` | `string` | Igen | A törlendő felhasználó titkosított azonosítója. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `success` | `boolean` | `True`, ha a felhasználó sikeresen törölve lett. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Hiányzik a `user.delete.user` jogosultság. |
| `404` | `Record not found.` | A megadott felhasználó nem található. |
| `422` | `Validation failed.` | Bemeneti validációs hiba vagy hibás `user_id`. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Database error.` / `Application error occurred.` | Váratlan adatbázis- vagy szerveroldali hiba. |

---

## Endpoint

- **Név:** User editprofile
- **Metódus:** `GET`
- **Útvonal:** `/v1/user/editprofile`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `user.post.post.userprofil`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/user/editprofile`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** `GetUserProfil`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** User editprofile
- **Metódus:** `POST`
- **Útvonal:** `/v1/user/editprofile`
- **Leírás:** Meglévő erőforrás módosítása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `user.post.post.userprofil`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/user/editprofile`
- **Metódus:** `POST`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
  - `Content-Type: application/json`
- **Body/Model:** `UserEditProfil`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `username` | `string` | Nem | Kérésparaméter. |
| `email` | `string (email)` | Nem | Email alapú mező. |
| `full_name` | `string` | Nem | Kérésparaméter. |
| `is_2fa_enable` | `boolean` | Nem | Logikai jelzőmező. |
| `totp_type` | `string (enum)` | Nem | Kérésparaméter. |
| `telegram_id` | `integer` | Nem | Az adott erőforrás azonosítója. |
| `newpassword` | `string` | Nem | Jelszó mező. |
| `newpassword_rep` | `string` | Nem | Jelszó mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** User permission
- **Metódus:** `GET`
- **Útvonal:** `/v1/user/permission`
- **Leírás:** Erőforrás(ok) lekérdezése.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Jogosultságkezelés**
   - Ezen route-on nincs külön RBAC dekorátor, de token/üzleti validáció lehet.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/user/permission`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Body/Model:** `GetUserPermission`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `data` | `object`/`array` | Lekérdezett adatok. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |

---

## Endpoint

- **Név:** User prealluser
- **Metódus:** `GET`
- **Útvonal:** `/v1/user/prealluser`
- **Leírás:** API művelet végrehajtása.

## Jogosultságok (Permissions)

Az endpoint sikeres hívásához az alábbi feltételeknek egyszerre kell teljesülniük:

1. **Kötelező hálózati fejléc**
   - A route implementációja jellemzően elvárja az `x-forwarded-for` fejlécet.

2. **Globális jogosultság**
   - Kötelező permission: `user.get.prealluser`.

3. **Token kezelés**
   - A kérésmodell tokenes mezőt használhat (`Bearer` vagy auth token mezők).

## Működés

Az endpoint működése lépésenként:

1. A rendszer beolvassa az `x-forwarded-for` fejlécet.
2. A request mezőit validálja (ha van modell).
3. Globális jogosultság-ellenőrzés fut le.
4. Az üzleti logika lefut és route-függő válasz készül.

## Használat

### Kérés formátuma

- **URL:** `/v1/user/prealluser`
- **Metódus:** `GET`
- **Header:**
  - `x-forwarded-for: <client-ip>` (kötelező/ajánlott)
- **Rate limit:** `50 kérés / 5 perc`
- **Body/Model:** `UserPre`

## Paraméterek

### Header paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `x-forwarded-for` | `string` | Igen | A kliens IP címe. |

### Body paraméterek

| Név | Típus | Kötelező | Leírás |
|---|---|---|---|
| `Bearer` | `string` | Nem | Access token a hitelesítéshez. |
| `content-type` | `string` | Nem | Technikai tartalomtípus mező. |
| `limit` | `integer` | Nem | Lapozási vagy mennyiségi paraméter. |

## Válasz szerkezet

| Név | Típus | Leírás |
|---|---|---|
| `message` | `string`/`object` | Route-függő sikeres válasz. |

## Tipikus hibák

| HTTP kód | `detail` | Mikor fordul elő |
|---|---|---|
| `401` | `Authentication failed.` | Hiányzó/hibás token vagy hiányzó IP fejléc. |
| `403` | `Permission denied.` | Jogosultság vagy csoporttagság hiánya. |
| `404` | `Record not found.` | Nem található rekord. |
| `422` | `Validation failed.` | Bemeneti validációs hiba. |
| `429` | `Too Many Requests` | Rate limit túllépése. |
| `500` | `Application error occurred.` | Váratlan szerveroldali hiba. |
