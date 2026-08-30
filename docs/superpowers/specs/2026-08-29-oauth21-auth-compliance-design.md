# A worf-app auth rétegének OAuth 2.1 megfelelőségi átállása

Dátum: 2026-08-29
Státusz: jóváhagyva, implementációra vár
Felváltja: `2026-08-28-private-key-jwt-oauth-design.md` (annak tartalmát magába
foglalja és kiterjeszti — az a spec önmagában már nem teljes)

## Kontextus

A worf-app „Bejelentkezés" gombja ma egy nem szabványos, implicit jellegű
flow-t indít:

- `app/api/auth/oauth/login/route.ts` a `client_secret`-et a redirect URL
  **fragmentjében** adja át a böngészőnek (`loginUrl.hash`), és a legacy
  `GET /v1/oauth/login` végpontra irányít;
- `app/api/auth/oauth/callback/route.ts` a kész `access_token`/`refresh_token`
  párt a **query stringből** olvassa ki;
- nincs `code`, nincs PKCE, nincs `state`, nincs `iss`-ellenőrzés;
- a token-frissítés a legacy `POST /v1/auth/token`-en megy JSON body-val.

A Worf backend 2026-08-28-i megfelelőségi köre után az RFC-kompatibilis flow
(`GET /oauth/authorize` + `POST /oauth/token`) áll rendelkezésre, kötelező
PKCE S256-tal, `iss` visszaadással (RFC 9207), `offline_access`-hez kötött
refresh tokennel, rotáló refresh tokennel és szabványos
`insufficient_scope` hibákkal.

### Mért tények (2026-08-29, `https://worf.vaultdrive.eu` ellen)

| Megfigyelés | Érték |
|---|---|
| `GET /.well-known/oauth-authorization-server` | 200, `issuer=https://worf.vaultdrive.eu` |
| `authorization_endpoint` / `token_endpoint` | `/oauth/authorize` / `/oauth/token` |
| `registration_endpoint` | `/oauth/register` (DCR engedélyezve) |
| `code_challenge_methods_supported` | `["S256"]` |
| `token_endpoint_auth_methods_supported` | `["none","client_secret_post","client_secret_basic","private_key_jwt"]` |
| `token_endpoint_auth_signing_alg_values_supported` | `["RS256","ES256"]` |
| `scopes_supported` | 36 permission-scope; a pszeudo-scope-ok (`openid`, `profile`, `email`, `offline_access`, `read`, `write`) **nincsenek** benne |
| `GET /.well-known/oauth-protected-resource` | 200, `bearer_methods_supported: ["header"]` |
| `/oauth/authorize` a jelenlegi `WORF_CLIENT_ID`-val | hibaoldal: „Érvénytelen vagy nem regisztrált redirect_uri" |
| `/oauth/authorize` ismeretlen `client_id`-val | hibaoldal: „Ismeretlen vagy visszavont kliens" |

A két különböző hibaüzenetből következik: a meglévő kliens **létezik és nem
visszavont**, csak a `http://localhost:3000/api/auth/oauth/callback` nincs
felvéve a `redirect_uris` közé. Ezért új klienst regisztrálunk (DCR),
a meglévőt nem bántjuk.

## Célok

1. Az OAuth-redirect login flow átállítása `authorization_code` + PKCE (S256)
   grantre, `private_key_jwt` kliens-hitelesítéssel.
2. A 2026-08-28-i megfelelőségi kör kliensoldali követelményeinek teljesítése:
   `iss` validáció, `offline_access`, `resource`-konzisztencia,
   `insufficient_scope` kezelés, refresh-rotáció.
3. A `client_secret` böngészőbe szivárgásának megszüntetése.
4. A holt legacy auth route-ok eltávolítása.

## Explicit döntések

Ezeket a felhasználó jóváhagyta; implementáció közben nem kérdőjelezzük meg.

- **A backend rendereli a login/MFA/consent HTML-t.** A frontend csak egy
  teljes böngésző-navigációt indít a `GET /oauth/authorize`-ra, és a
  `redirect_uri`-n várja vissza a felhasználót. Nem építünk saját
  login/MFA/consent UI-t, és nem hívjuk fetch-csel a
  `/oauth/authorize/authenticate|verify-mfa|consent` lépés-végpontokat.
- **Kliens-hitelesítés: `private_key_jwt` (ES256).** A privát kulcs csak
  szerveroldali env-változóban él, kizárólag `lib/server/*` fájlok olvassák,
  soha nem kerül a böngészőbe és nem logoljuk.
- **Scope-stratégia: dinamikus.** A discovery `scopes_supported` listája plusz
  `openid profile offline_access`. A szerver a consent-nél úgyis leszűkíti a
  felhasználó tényleges jogaira.
- **`resource` paramétert sehol nem küldünk** — sem az `/oauth/authorize`,
  sem az `/oauth/token` hívásban. Így a szerver mindkét oldalon az
  alapértelmezett `OAUTH_RESOURCE_URI`-t használja, és az `invalid_target`
  hibaosztály kizárt.
- **Redirect URI: egyelőre csak `http://localhost:3000/api/auth/oauth/callback`.**
  Prod domain regisztrációja külön feladat.
- **A legacy jelszavas backend-végpontok (`/v1/auth/login`,
  `/v1/auth/multi-factor-authentication`) érintetlenek**, a `WORF_CLIENT_ID` /
  `WORF_CLIENT_SECRET` pár megmarad a még használt route-oknak (logout).

## Architektúra

### Új szerveroldali modulok

| Modul | Felelősség | Függ |
|---|---|---|
| `lib/server/pkce.ts` | `createPkcePair()`: `code_verifier` (43–128 base64url) és `code_challenge` (S256) előállítása | `node:crypto` |
| `lib/server/oauth-client-assertion.ts` | `buildClientAssertion()`: friss, egyedi `jti`-jű, ES256-tal aláírt JWT minden `/oauth/token` híváshoz | `jose`, env |
| `lib/server/oauth-discovery.ts` | `getAuthServerMetadata()`: a `/.well-known/oauth-authorization-server` letöltése és folyamat-szintű gyorsítótárazása; `buildAuthorizeScope()`: a kért scope-string összeállítása | `fetch`, env |
| `lib/server/oauth-token.ts` | `requestToken()`: `application/x-www-form-urlencoded` POST a `token_endpoint`-ra, client assertionnel; a válasz és a szabványos hibaformátum értelmezése | a fenti kettő |
| `scripts/register-oauth-client.mjs` | Egyszeri setup: ES256 kulcspár + RFC 7638 `kid`, `POST /oauth/register` a publikus JWK-val; a `client_id`-t és a privát kulcsot a konzolra írja | `node:crypto` |

Egyik modul sem importálható kliens-komponensből: mind a `lib/server/`
névtérben él, és csak route handlerek használják.

### Módosuló komponensek

- `app/api/auth/oauth/login/route.ts` — PKCE-alapú authorize-redirect
- `app/api/auth/oauth/callback/route.ts` — `iss`/`state` ellenőrzés + code-csere
- `app/api/auth/token/route.ts` — refresh a session eredete szerint
- `app/api/proxy/[...path]/route.ts` — Bearer header + `insufficient_scope`
- `lib/utils/constants.ts` — új cookie-konstansok
- `lib/api/client.ts` — refresh-hiba kezelése retry nélkül
- `lib/api/auth.ts` — a holt exportok törlése
- `.env` / `.env.local.example` — új kulcsok

### Törlendő holt kód

A `lib/api/auth.ts` exportjai közül csak a `logout` van használatban
(`components/layout/Header.tsx:42`). A többi export és a mögöttük álló route
egyetlen hívóval sem rendelkezik, a megfelelő UI-t pedig a backend rendereli
az OAuth flow-ban (`/v1/oauth/register`, `/v1/oauth/forgot-password`,
`/v1/oauth/reset-password`, `/v1/oauth/verify-email`).

Törlendő route-ok:

- `app/api/auth/login/` (a legacy jelszavas login proxy — nincs UI-ja)
- `app/api/auth/mfa/`
- `app/api/auth/register/`
- `app/api/auth/forget-password/`
- `app/api/auth/reset-password/`
- `app/api/auth/verify-email/`
- `app/api/auth/send-verification/`

Törlendő exportok a `lib/api/auth.ts`-ből: `register`, `verifyMfa`,
`forgetPassword`, `resetPassword`, `verifyEmail`, `sendEmailVerification`.
A `logout` marad.

`lib/server/auth-client.ts` **változatlan marad**: mindkét grant típusára
szükség van — a logout route `'password'`-öt kér, a refresh route legacy ága
`'refresh_token'`-t.

## Adatfolyam

### 1. Login indítása — `GET /api/auth/oauth/login`

1. `createPkcePair()` → `verifier`, `challenge`.
2. `state` = 32 bájt véletlen, base64url.
3. Mindkettő HttpOnly cookie-ba, 600 s élettartammal
   (`worf_pkce_verifier`, `worf_pkce_state`).
4. `getAuthServerMetadata()` → `authorization_endpoint`, `scopes_supported`.
5. `buildAuthorizeScope()` → `"openid profile offline_access " + scopes_supported.join(' ')`
   (duplikátumok kiszűrve, stabil sorrendben).
6. 302 redirect az `authorization_endpoint`-ra ezekkel a query paraméterekkel:
   `response_type=code`, `client_id`, `redirect_uri`, `code_challenge`,
   `code_challenge_method=S256`, `scope`, `state`. **Nincs `client_secret`,
   nincs `resource`.**

Ha a discovery nem érhető el, a route a login oldalra irányít vissza
`?error=...` paraméterrel; nem esik vissza hardcode-olt endpointra.

### 2. Callback — `GET /api/auth/oauth/callback`

A lépések sorrendje kötött, mert az `iss` ellenőrzésének **meg kell előznie**
a `code` és a `state` feldolgozását:

1. `iss` kiolvasása a query-ből; összevetés a discovery `issuer`-jével.
   Eltérés vagy hiány → a válasz eldobása, redirect a login oldalra
   `?error=invalid_issuer`-rel, PKCE cookie-k törlése. (Az `iss` a
   hibaágon is jön, ezért az ellenőrzés a hiba-feldolgozás előtt fut.)
2. `error` paraméter esetén → redirect a login oldalra az
   `error_description ?? error` üzenettel, cookie-k törölve.
3. `state` összevetése a cookie-val időállandó összehasonlítással; eltérés →
   `?error=invalid_state`.
4. `code_verifier` kiolvasása a cookie-ból; hiánya → `?error=expired_request`
   (a felhasználó túllépte a 10 percet).
5. `requestToken({grant_type: 'authorization_code', code, redirect_uri, code_verifier})`.
6. Siker esetén:
   - `access_token` cookie-ba a válasz `expires_in`-jéből számolt `maxAge`-dzsel
     (fallback 900 s);
   - `refresh_token` cookie-ba, ha jött. Ha **nem** jött, azt naplózzuk
     figyelmeztetésként (az `offline_access` scope-ot kértük, tehát ez
     szerveroldali eltérést jelez), de a bejelentkezés érvényes marad;
   - `worf_auth_origin=oauth` cookie beállítása;
   - PKCE cookie-k törlése; redirect a dashboardra.
7. Hiba esetén: PKCE cookie-k törlése, redirect a login oldalra a szabványos
   `error` / `error_description` üzenettel.

### 3. Token-frissítés — `POST|GET /api/auth/token`

1. `worf_auth_origin` cookie olvasása.
2. `"oauth"` → `requestToken({grant_type: 'refresh_token', refresh_token})`
   client assertionnel. Nem küldünk `scope`-ot (nem akarunk szűkíteni) és nem
   küldünk `resource`-t.
3. Egyéb/hiányzó érték → változatlanul a legacy `POST /v1/auth/token`
   (`client_id` + `client_secret` + `scopes`), hogy a már bejelentkezett
   legacy session-ök ne szakadjanak meg.
4. Siker: a rotált `refresh_token` **mindig** felülírja a régit a cookie-ban,
   és az `worf_auth_origin` lejárata frissül.
5. `invalid_grant` vagy 401/403 → az összes auth cookie törlése. **Nincs
   újrapróbálkozás** ugyanazzal a refresh tokennel: a backend reuse esetén az
   egész rotációs láncot visszavonja.

### 4. API-hívás — `app/api/proxy/[...path]`

- Az access token **két helyen** megy fel: `Authorization: Bearer <token>`
  headerben és — a natív végpontok konvenciója miatt — a JSON body `Bearer`
  mezőjében. A protected-resource metadata `bearer_methods_supported:
  ["header"]`, a natív REST végpontok viszont a body-mezőt olvassák; a kettős
  küldés mindkettőt kiszolgálja és nem tör el meglévő hívást.
- 401 válasz esetén a `WWW-Authenticate` headert változatlanul továbbadjuk a
  kliensnek (a meglévő 401-refresh-retry logika ettől nem változik).
- 403 válasz esetén, ha a `WWW-Authenticate` header `error="insufficient_scope"`-ot
  tartalmaz, a headert továbbadjuk, és a válasz body-jába egy
  `{"error": "insufficient_scope", "required_scope": "<a header scope értéke>"}`
  mezőt teszünk, hogy a UI meg tudja különböztetni a scope-hiányt a
  szerepkör-alapú jogosultsági hibától.

### 5. Kijelentkezés

Változatlan: `POST /api/auth/logout` best-effort meghívja a legacy
`/v1/auth/logout`-ot, majd minden auth cookie-t töröl (beleértve az új
`worf_auth_origin`-t is). Az OAuth AS-nek nincs publikált revocation
endpointja a discovery-ben, ezért a helyi cookie-törlés a mérvadó lépés.

## Cookie-k

| Konstans | Név | Élettartam | Megjegyzés |
|---|---|---|---|
| `ACCESS_COOKIE` | `worf_access_token` | a válasz `expires_in`-je (fallback 900 s) | eddig fixen 3600 s volt |
| `REFRESH_COOKIE` | `worf_refresh_token` | 30 nap | változatlan |
| `MFA_COOKIE` | `worf_mfa_token` | 600 s | változatlan |
| `PKCE_VERIFIER_COOKIE` | `worf_pkce_verifier` | 600 s | új |
| `PKCE_STATE_COOKIE` | `worf_pkce_state` | 600 s | új |
| `PKCE_LOCALE_COOKIE` | `worf_pkce_locale` | 600 s | új, a `redirect_uri` nem hordozhatja |
| `AUTH_ORIGIN_COOKIE` | `worf_auth_origin` | a refresh cookie-val megegyező | új, értéke `"oauth"` |

Mind a meglévő `AUTH_COOKIE_OPTIONS`-t használja (`httpOnly`, `secure`
prodban, `sameSite: 'lax'`, `path: '/'`).

**`sameSite` — javítva `strict`-ről `lax`-ra (2026-08-30).** A spec eredetileg
abból indult ki, hogy a strict cookie-k átjönnek a callback top-level
navigációján; ez téves. A `SameSite=Strict` cookie-t a böngésző **minden**
cross-site kérésnél visszatartja, a top-level navigációt is beleértve — a
callback pedig a `worf.vaultdrive.eu`-ról érkezik, tehát a PKCE verifier és
state nem érkezne meg (`invalid_state` / `expired_request`). Ugyanez érinti a
callback válaszában beállított session cookie-kat: a rájuk következő
`/{locale}/dashboard` redirect még a cross-site redirect-lánc része, így az
első dashboard-kérés sem vinné őket. Ezért **az összes auth cookie `lax`** — a
`lax` továbbra is visszatartja a cookie-t cross-site POST-nál és
subresource-kérésnél, a CSRF-védelmet pedig elsődlegesen a `state` paraméter
adja.

## Konfiguráció

Új env-kulcsok (`.env`, `.env.local.example`):

```
WORF_OAUTH_CLIENT_ID=      # a private_key_jwt módban regisztrált kliens UUID-ja
WORF_OAUTH_PRIVATE_KEY=    # PKCS8 PEM, \n-escapelt egysoros érték
WORF_OAUTH_KID=            # a regisztrált JWK RFC 7638 thumbprint kid-je
WORF_OAUTH_REDIRECT_URI=   # már létezik; a DCR-nél és az authorize/token hívásban is ez megy
```

Megmarad: `WORF_API_URL`, `WORF_CLIENT_ID`, `WORF_CLIENT_SECRET` (logout),
`WORF_DEVICE_TYPE`, `NEXT_PUBLIC_*`.

A `WORF_SCOPES` env-változó megmarad, de **kizárólag a legacy refresh-ág**
(`POST /v1/auth/token`) használja, változatlan viselkedéssel — ma sincs
beállítva, tehát ott üres `scopes` tömb megy fel, ahogy eddig is. Az OAuth-ág
soha nem olvassa: annak scope-listáját a discovery adja.

A `WORF_OAUTH_*` kulcsok hiányában az OAuth login route 500-zal és beszédes
üzenettel áll meg, nem csendes fallbackkel — a hibás konfiguráció ne
látszódjon működő bejelentkezésnek.

## Hibakezelés

Két különböző hibaformátummal kell számolni:

- **OAuth végpontok** (`/oauth/token`): `{"error": "...", "error_description": "..."}`.
  A `lib/server/oauth-token.ts` ezt egységes `OAuthError` alakra hozza, és a
  route-ok ezt fordítják felhasználói üzenetre.
- **Natív REST végpontok**: `{"detail": "..."}` vagy `{"message": "..."}`.
  Ezt a meglévő proxy- és hibakezelés érintetlenül viszi tovább.

A `/oauth/authorize`-ról a `redirect_uri`-ra érkező hibák
(`unsupported_response_type`, `unauthorized_client`, `invalid_request`,
`access_denied`) a callback 2. lépésében kerülnek feldolgozásra, az `iss`
ellenőrzése után.

Ismeretlen `client_id` vagy nem regisztrált `redirect_uri` esetén a backend
saját hibaoldalt renderel, és soha nem redirectel — ezt a frontend
programozottan nem látja. Ez a konfiguráció hibája, és a setup-script
futtatásával, illetve a `WORF_OAUTH_REDIRECT_URI` pontos egyeztetésével
előzhető meg.

## Tesztelés

Automatizált (vitest, `npm test`):

- `pkce.ts`: a `code_verifier` hossza 43–128, csak `[A-Za-z0-9-._~]`
  karakterekből áll; a `code_challenge` a verifier SHA-256-ának base64url
  alakja; két hívás különböző párt ad.
- `oauth-client-assertion.ts`: a kimenet dekódolható; `iss` és `sub` a
  `client_id`; `aud` pontosan a `token_endpoint`; a fejlécben a `kid` és
  `alg: ES256`; `exp - iat <= 300`; két hívás `jti`-je különbözik.
- `oauth-discovery.ts`: a scope-string tartalmazza az `openid profile
  offline_access` hármast és a `scopes_supported` minden elemét, duplikátum
  nélkül; a metadata a második híváskor cache-ből jön (egy fetch).
- `oauth-token.ts`: form-urlencoded body-t küld a helyes mezőkkel; a
  `resource` mező soha nincs benne; a szabványos hibaválaszból `OAuthError`-t
  képez; a `refresh_token` hiányát nem kezeli hibaként.
- Proxy: 403 + `WWW-Authenticate: Bearer error="insufficient_scope", scope="x"`
  esetén a válasz body-ja tartalmazza a `required_scope: "x"` mezőt, és a
  header átmegy.

Kézi (a valós backend ellen, `npm run dev`):

1. A setup-script lefuttatása, az env kitöltése.
2. Teljes bejelentkezési kör: gomb → backend login → (MFA, ha aktív) →
   consent → dashboard. Ellenőrizendő: a címsorban **nincs** `client_secret`,
   a callback `code`+`state`+`iss` paraméterekkel jön, és a PKCE cookie-k
   megérkeznek a callbackbe (`sameSite: 'lax'` viselkedés).
3. A dashboard adatai betöltenek (a scope elég az API-hívásokhoz).
4. Access token lejárta utáni néma refresh (a 900 s kivárható, vagy az access
   cookie kézi törlésével kikényszeríthető).
5. Kijelentkezés → minden auth cookie eltűnik.
6. Regresszió: a `logout` route és a REST proxy hívásai változatlanul
   működnek.

## Nem célja ennek a munkának

- Prod/preview redirect URI regisztrálása (külön feladat, ha lesz domain).
- Step-up authorization (a szerveren sincs implementálva): 403
  `insufficient_scope` esetén jelzünk, de nem indítunk automatikusan új
  authorize kört.
- CIMD (`OAUTH_CIMD_ENABLED=false` a szerveren).
- A `/v1/oauth/admin/clients` admin felület kliensoldali megjelenítése.
- A natív jelszavas bejelentkezés újbóli bevezetése saját UI-val.
