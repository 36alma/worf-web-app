# Worf Desktop Auth Flow (Backend Spec)

Ez a dokumentum a Worf desktop kliens OAuth-jellegű bejelentkezési folyamatát írja le backend/API szemszögből, a kliens által elvárt endpointokkal és payloadokkal.

Fontos: ebben a web repo-ban desktop klienskód nem található, ezért a leírás a megadott kliensviselkedésre épül.

---

## 1. Külső rendszerböngészős flow (`BrowserAuthService`)

Ez a preferált desktop belépési útvonal.

### Lépések
1. A kliens helyi callback listenert indít: `http://localhost:{PORT}/callback/` (tipikusan 5000).
2. A kliens megnyitja a login URL-t a rendszerböngészőben:

```text
{API_URL}/v1/oauth/login?client_id={CLIENT_ID}#client_secret={CLIENT_SECRET}&redirect_uri={CALLBACK_URL}
```

3. A felhasználó bejelentkezik az OAuth UI-n.
4. Siker esetén az API redirectel a callback URL-re úgy, hogy a tokenek query paraméterben legyenek:

```text
http://localhost:{PORT}/callback/?access_token={JWT}&refresh_token={JWT}
```

5. Hiba esetén:

```text
http://localhost:{PORT}/callback/?error={ERROR_CODE}&error_description={DESCRIPTION}
```

6. A desktop kliens a callbackből eltárolja a tokeneket.

### Kritikus megjegyzés a `#fragment` részről
A `#client_secret=...&redirect_uri=...` fragmentet a böngésző **nem küldi el HTTP kérésben** a szervernek.

Ezért a backend közvetlenül csak ezt látja:
- path: `/v1/oauth/login`
- query: `client_id=...`

Ha a login UI-nak szüksége van `client_secret`/`redirect_uri` értékekre, azt kliensoldali JavaScriptből kell kiolvasnia a `window.location.hash`-ből, és onnan továbbküldeni.

---

## 2. Belső WebView2 flow (`AuthWindow`, `AuthenticationService`)

Ez egy authorization-code mintájú flow desktopon.

### Lépések
1. WebView2 navigál a login oldalra.
2. A kliens elkapja a `http://localhost:5000/callback*` navigációt és megszakítja (`Cancel = true`).
3. A kliens kiolvassa a callbackből:
- siker: `?code={AUTH_CODE}`
- hiba: `?error=...`

4. A kliens a code-ot becseréli tokenre:

```http
POST /v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={AUTH_CODE}&redirect_uri=http://localhost:5000/callback
```

5. Elvárt válasz:

```json
{
  "access_token": "...",
  "refresh_token": "..."
}
```

---

## 3. Refresh token flow

A desktop kliens külön endpointon kér új access tokent:

```http
POST /v1/auth/token
Content-Type: application/json
```

Body:

```json
{
  "content-type": "application/json",
  "grant_type": "refresh_token",
  "client_id": "{CLIENT_ID}",
  "client_secret": "{CLIENT_SECRET}",
  "refresh_token": "{STORED_REFRESH_TOKEN}"
}
```

Elvárt válasz:

```json
{
  "access_token": "...",
  "refresh_token": "..."
}
```

A `refresh_token` lehet rotált (új érték), ezt a kliensnek mentenie kell.

---

## 4. Backend kompatibilitási minimum

A desktop kliens teljes támogatásához az API oldalon ezek kellenek:

1. `GET /v1/oauth/login`
- UI megjelenítés
- sikeres auth után redirect desktop callbackre
- browser flow esetén tokeneket query paraméterben kell visszaadni

2. `POST /v1/oauth/token`
- `application/x-www-form-urlencoded` támogatás
- authorization code -> token csere

3. `POST /v1/auth/token`
- JSON refresh token grant támogatás

4. Hibatípusok egységesítése
- callback hibák: `error`, `error_description`
- token endpoint hibák: konzisztens JSON hibaforma

---

## 5. Jelenlegi OpenAPI állapot (ebben a repo-ban)

Az `openapi.json` szerint jelenleg:
- `GET /v1/oauth/login` létezik
- `POST /v1/auth/token` létezik
- `POST /v1/oauth/token` **nem szerepel**

Ha a desktop WebView2 code-exchange flow aktív, a `POST /v1/oauth/token` endpointot hozzá kell adni, vagy a desktop klienst át kell állítani egy már létező token endpoint használatára.
