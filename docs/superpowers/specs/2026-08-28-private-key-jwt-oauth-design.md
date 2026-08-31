# private_key_jwt kliens-hitelesítés bevezetése az OAuth-redirect login flow-ba

Dátum: 2026-08-28
Státusz: jóváhagyva, implementációs tervre vár

## Kontextus

A Worf API (`https://worf.vaultdrive.eu`) mostantól a `POST /oauth/token`
végponton támogatja a `private_key_jwt` kliens-hitelesítést (RFC 7523 +
RFC 7521) a statikus `client_id`+`client_secret` mellett. Ez a végpont az
RFC-kompatibilis, PKCE-alapú `/oauth/authorize` + `/oauth/token` flow
része, ami **különbözik** a worf-app jelenleg használt, legacy
`/v1/oauth/*` + `/v1/auth/token` flow-jától (más kliens-namespace, más
token-issue logika).

A cél: a worf-app "Bejelentkezés"-gombhoz tartozó OAuth-redirect flow-ját
átállítani az új `/oauth/authorize` + `/oauth/token` végpontokra, kizárólag
`private_key_jwt` kliens-hitelesítéssel. A privát kulcs soha nem hagyja el
a szervert (Next.js route handler / szerver oldal).

**Explicit döntések (a felhasználóval tisztázva, ne kérdőjelezzük meg
implementáció közben):**

- Az `/oauth/authorize` GET **backend-hosted HTML oldalakat** renderel
  (login/mfa/consent), pontosan úgy, mint a jelenlegi
  `/v1/oauth/login`. A frontendnek **nem** kell saját login/mfa/consent
  UI-t építenie, sem ezeket a step-végpontokat (`/oauth/authorize/authenticate`,
  `/verify-mfa`, `/consent`) fetch/XHR-rel hívnia. Egyszerű böngésző-redirect
  a `GET /oauth/authorize`-ra, majd a backend 303-mal visszairányít a mi
  `redirect_uri`-nkra `?code=...&state=...`-tal.
- A jelenlegi közvetlen email+jelszavas login (`/v1/auth/login`,
  `/v1/auth/multi-factor-authentication`) **nem** változik, változatlanul
  `client_id`+`client_secret`-tel megy. Csak az OAuth-redirect flow áll át.
- A `/v1/auth/token` (legacy refresh) és a `/oauth/token` refresh grantja
  **ugyanazt** az `oauth_refresh_tokens`/`oauth_access_tokens` táblát
  használja, de a legacy `Token_Class` nem viszi át a `scope`-ot és a
  `client_id`-t az új tokenre (nem néz `client_id`-t sem az ellenőrzésnél),
  míg az `/oauth/token` refresh grantja explicit ellenőrzi és megőrzi
  ezeket. Egy OAuth-redirectből (private_key_jwt) származó session
  legacy `/v1/auth/token`-en történő frissítése **nem hibázna**, hanem
  csendben elveszítené a scope-ot és átíródna a legacy first-party
  kliensre. Emiatt a session eredetét meg kell jelölni, és a refresh-nek
  a kibocsátó rendszerhez kell mennie.

## Architektúra

Új komponensek:

1. **`scripts/register-oauth-client.mjs`** — one-off, manuálisan futtatott
   setup script. Kulcspárt generál (EC P-256 / ES256, Web Crypto), kiszámol
   egy RFC 7638 JWK-thumbprint `kid`-et, és `POST /oauth/register`-t hív a
   publikus JWK-val. Kiírja a konzolra az új `client_id`-t és a privát
   kulcs PEM-jét — ezeket a felhasználó másolja be az `.env`-be. A script
   nem ír titkot fájlba.
2. **`lib/server/oauth-client-assertion.ts`** — `jose`-alapú
   `buildClientAssertion()`: minden `/oauth/token` híváshoz friss,
   ≤300s élettartamú, egyedi `jti`-jű, ES256-tal aláírt JWT-t állít elő
   (`iss`/`sub`=client_id, `aud`=`${WORF_API_URL}/oauth/token`, `kid` a
   fejlécben).
3. **PKCE helper** (`lib/server/pkce.ts` vagy az `oauth-client-assertion.ts`
   melletti kis modul) — `code_verifier` generálás (43-128 char
   base64url) és `code_challenge` számítás (SHA-256, S256).

Módosuló komponensek:

- `app/api/auth/oauth/login/route.ts`
- `app/api/auth/oauth/callback/route.ts`
- `app/api/auth/token/route.ts`
- `lib/utils/constants.ts` (új cookie-nevek)
- `.env`, `.env.local.example`

## Adatfolyam

### Login indítása

`GET /api/auth/oauth/login`:

1. Generál `code_verifier` + `code_challenge` (S256) + `state`-et.
2. `httpOnly`, rövid élettartamú (pl. 10 perc) cookie-kban eltárolja a
   `code_verifier`-t és a `state`-et (külön, PKCE-specifikus cookie-k,
   nem a session cookie-k).
3. Böngésző-redirect: `GET {WORF_API_URL}/oauth/authorize` a szokásos
   query paraméterekkel (`response_type=code`, `client_id`, `redirect_uri`,
   `code_challenge`, `code_challenge_method=S256`, `scope`, `state`).
   Nincs `client_secret` az URL-ben.

### Callback

`GET /api/auth/oauth/callback`:

1. Kiolvassa a query-ből `code`, `state`, `error`, `error_description`-t.
2. Hiba esetén (ahogy eddig) redirect a login oldalra a hibaüzenettel.
3. Ellenőrzi, hogy a kapott `state` egyezik a cookie-ban tárolttal (ha
   nem: elutasítás, hibaoldal — CSRF-védelem).
4. `POST {WORF_API_URL}/oauth/token`
   (`application/x-www-form-urlencoded`):
   `grant_type=authorization_code`, `code`, `redirect_uri`,
   `code_verifier` (a cookie-ból), `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`,
   `client_assertion` (`buildClientAssertion()`).
5. Siker: `setAuthCookies({access_token, refresh_token})` + beállítja a
   `worf_auth_origin=oauth` cookie-t (ugyanazokkal az options-ökkel, mint
   a refresh token, azaz kb. 30 napos lejárat). Törli a PKCE/state
   cookie-kat. Redirect a dashboardra.
6. Hiba: törli a PKCE/state cookie-kat, redirect a login oldalra a
   szabványos `error`/`error_description` üzenettel.

### Refresh

`app/api/auth/token/route.ts` `refreshAccessToken()`:

1. Beolvassa a `worf_auth_origin` cookie-t.
2. **`oauth`**: `POST {WORF_API_URL}/oauth/token`
   (`grant_type=refresh_token`, `refresh_token`,
   `client_assertion_type`, `client_assertion`). *Nem* küld
   `client_id`/`client_secret`-et (a szerver a JWT `sub`-jából olvassa ki
   a klienst).
3. **hiányzik / más érték** (legacy jelszavas session): változatlanul
   `POST /v1/auth/token` `client_id`+`client_secret`-tel, ahogy most.
4. Sikeres rotáció után újra beállítja a `worf_auth_origin` cookie-t
   (lejárat frissítése). 401/403 esetén `clearAuthCookies()` +
   `worf_auth_origin` cookie törlése.

## Cookie-k

Új konstansok a `lib/utils/constants.ts`-ben:

- `PKCE_VERIFIER_COOKIE` — `worf_pkce_verifier`, `httpOnly`, `maxAge` ~600s.
- `PKCE_STATE_COOKIE` — `worf_pkce_state`, `httpOnly`, `maxAge` ~600s.
- `AUTH_ORIGIN_COOKIE` — `worf_auth_origin`, `httpOnly`, értéke `"oauth"`,
  élettartama a refresh cookie-val megegyező.

Mindhárom a meglévő `AUTH_COOKIE_OPTIONS`-t használja (`secure` prod-ban,
`sameSite: strict`, `path: '/'`), csak a `maxAge` tér el a PKCE cookie-knál.

## Konfiguráció

`.env` / `.env.local.example` új kulcsai:

```
WORF_OAUTH_CLIENT_ID=     # az új, private_key_jwt móddal regisztrált kliens UUID-ja
WORF_OAUTH_PRIVATE_KEY=   # PEM, PKCS8, \n-escapelt egysoros érték
WORF_OAUTH_KID=           # a regisztrált JWK kid-je (RFC 7638 thumbprint)
```

**Fontos:** a `WORF_CLIENT_ID`+`WORF_CLIENT_SECRET` párost a legacy
jelszavas login (`getAuthClientPayload()`, `/v1/auth/login`,
`/v1/auth/multi-factor-authentication`, legacy refresh) használja, és
ez **nem** változik. Az új, `private_key_jwt` móddal regisztrált
kliens egy **külön** `client_id`-t kap (más kliens, más
hitelesítési mód a szerveren) — ezt **nem** a meglévő `WORF_CLIENT_ID`
env varba írjuk, hanem egy új `WORF_OAUTH_CLIENT_ID` env varba, hogy a
két flow ne írja felül egymás konfigurációját.

## Hibakezelés

A `/oauth/token` szabványos `{"error": "...", "error_description": "..."}`
JSON-t ad vissza 401-gyel érvénytelen bemenetre (rossz aláírás, lejárt
vagy 300s-nél hosszabb életű assertion, ismételt `jti`, ismeretlen
`client_id`/`kid`). A callback és a refresh route ezt továbbadja a
hívónak / a login oldal hibaparaméterének, ugyanúgy, ahogy a jelenlegi
kód a legacy hibaválaszokat kezeli — nincs szükség új hibaformátum-
leképezésre.

## Tesztelés

- Unit teszt (vitest): `buildClientAssertion()` — dekódolható a kimenet,
  helyes claim-ek (`iss`/`sub`/`aud`/`kid`), `exp - iat <= 300`, minden
  hívás egyedi `jti`-t ad.
- Unit teszt: PKCE `code_verifier`/`code_challenge` generálás (hossz,
  base64url karakterkészlet, a challenge helyesen számolt SHA-256-ból).
- A teljes redirect-flow-t (login → backend-hosted authorize/mfa/consent
  → callback → token-csere) manuálisan teszteljük `next dev`-ben, a
  valós backend ellen — a backend-hosted HTML lépések miatt ez nem
  mockolható értelmesen egységtesztként.
- Regresszió: a legacy jelszavas login + refresh (`/v1/auth/login`,
  `/v1/auth/token`) továbbra is működik, változatlanul.

## Nem célja ennek a munkának

- A legacy jelszavas login (`/v1/auth/login`) átállítása.
- A régi, `client_secret_basic` móddal regisztrált Worf Frontend kliens
  törlése vagy migrálása a szerveren.
- A legacy `/v1/auth/token` `client_secret`-ellenőrzésének javítása
  (megfigyelt hiányosság, külön feladat, nem ennek a specnek a része).
