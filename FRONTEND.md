# WORF Frontend Dokumentáció

Ez a dokumentum a **WORF** (Work Order & Resource Flow) projekt frontend architektúráját, technológiai választásait és fejlesztési irányelveit tartalmazza.

---

### 1. Rendszeráttekintés (System Overview)

A WORF frontendje egy modern, nagy teljesítményű webalkalmazás, amelynek célja a feladatkezelési és erőforrás-folyamatok vizualizálása és kezelése.

*   **Célja:** Felhasználói felület biztosítása a feladatok (tasks), naptáresemények, csoportok és adminisztrációs funkciók kezeléséhez.
*   **Rendering stratégia:** 
    *   **SSR (Server-Side Rendering):** A layout-ok és az alapvető oldalstruktúrák szerver oldalon renderelődnek a gyorsabb kezdeti betöltés és SEO érdekében.
    *   **CSR (Client-Side Rendering):** Az interaktív komponensek (pl. naptár, modalok, dashboard widgetek) kliens oldalon futnak.
*   **Kommunikáció:** A frontend egy központi API proxy-n keresztül kommunikál a backenddel, amely kezeli az autentikációt és a biztonsági fejléceket.

---

### 2. Technológiai stack

*   **Framework:** Next.js 15 (App Router)
*   **Nyelv:** TypeScript
*   **Stílus:** Tailwind CSS + CSS Variables (Design Tokens)
*   **Állapotkezelés:** Zustand (Globális és UI állapot) + React Context (Specifikus feature-ök, pl. Permissions)
*   **Adatlekérés:** Axios (alapértelmezett kliens) + Native Fetch (Proxy-ban)
*   **Naptár:** FullCalendar (React adapter, custom dark theme)
*   **i18n könyvtár:** `next-intl` (URL-alapú lokalizáció)
*   **UI komponens könyvtár:** Radix UI (primitive-ek) + Lucide React (ikonok) + Tailwind-alapú egyedi komponensek (shadcn/ui mintára)
*   **PWA:** Serwist (@serwist/next) a Progressive Web App funkciókhoz és offline támogatáshoz.
*   **Form kezelés:** React Hook Form + Zod (validáció)

---

### 3. Mappastruktúra (Directory Structure)

```
worf/
├── app/                        # Next.js App Router gyökér
│   ├── [locale]/               # i18n nyelvi wrapper (hu, en)
│   │   ├── layout.tsx          # Fő layout (Navigation, AppShell)
│   │   ├── page.tsx            # Landing / Dashboard redirect
│   │   ├── groups/             # Csoport-kezelés oldalai
│   │   │   ├── [groupId]/      # Dinamikus csoport szegmens
│   │   │   │   ├── tasks/      # Feladatlista
│   │   │   │   ├── calendar/   # Csoport naptár
│   │   │   │   ├── roles/      # Szerepkörök kezelése
│   │   │   │   ├── permissions/# Jogosultság mátrix
│   │   │   │   └── layout.tsx  # Csoport-specifikus context layout
│   │   ├── admin/              # Globális adminisztrációs felület
│   │   └── auth/               # Login, Register oldalak
│   ├── api/                    # Route Handlerek
│   │   ├── proxy/              # Backend API proxy ([...path])
│   │   └── auth/               # Kliens oldali auth segéd-endpointok
├── components/                 # UI komponensek kategóriánként
│   ├── ui/                     # Alapvető design elemek (Button, Input, etc.)
│   ├── layout/                 # Sidebar, Header, AppShell
│   ├── groups/                 # Csoport-specifikus komponensek
│   └── calendar/               # FullCalendar wrapper és eseménykezelők
├── hooks/                      # Custom React hookok
├── lib/                        # Üzleti logika és utility-k
│   ├── api/                    # API hívások (axios instance)
│   ├── store/                  # Zustand store-ok (auth, ui, permissions)
│   └── utils/                  # Formázók, ID normalizálók
├── messages/                   # i18n fordítási fájlok (hu.json, en.json)
├── public/                     # Statikus assetek, manifest.json
└── next.config.mjs             # Next.js konfiguráció (PWA, Proxy setup)
```

---

### 4. Routing architektúra

*   **App Router:** A Next.js 15 konvencióit követi (fájlrendszer alapú routing).
*   **Route Csoportok:** A `[locale]` dinamikus szegmens biztosítja az automatikus nyelvkezelést.
*   **Dinamikus Route-ok:** 
    *   `[groupId]`: Opaque (Base64) azonosítókat használ, melyeket a `lib/utils/groupId.ts` kezel.
*   **Védett route-ok:** Middleware és az `AppShell` komponens együttesen kezeli az autentikáció ellenőrzését és a jogosultság-alapú átirányításokat.
*   **PWA Offline:** A `~offline` route szolgál fallback-ként hálózati kapcsolat hiányában.

---

### 5. Komponens architektúra

*   **Server vs. Client Components:**
    *   Layout-ok és adat-előkészítő oldalak szerver oldaliak.
    *   `"use client"` direktíva minden olyan komponensen, ami state-et, hookot vagy böngésző API-t használ (pl. Sidebar, Calendar, Modals).
*   **Főbb kategóriák:**
    *   **AppShell:** A központi wrapper, ami összefogja a Sidebar-t, Header-t és a tartalom területet.
    *   **GroupPermissionProvider:** React Context, ami a csoport szintű jogosultságokat teszi elérhetővé a gyerek-komponensek számára.
    *   **Modal rendszer:** Radix UI alapú dialogok, melyek állapotát gyakran a `uiStore` (Zustand) vezérli.
    *   **Admin/Permissions:** Komplex táblázatok és toggle-ök a jogosultságok kezelésére.

---

### 6. API kommunikáció

A frontend kizárólag a saját `/api/proxy/` endpointján keresztül éri el a backendet.

*   **Proxy működése:**
    *   Injektálja a `Bearer` tokent a kérés body-jába (vagy headerbe, konfiguráció szerint).
    *   Kezeli a CORS problémákat.
    *   Normalizálja a backendtől érkező (néha hibás) JSON válaszokat.
    *   Támogatja a POST-alapú lekérdezéseket (Backend specifikum).
*   **Auth:** A tokenek HTTP-only cookie-kban és sessionStorage-ban (kliens oldali IP track-eléshez) tárolódnak.

```typescript
// Példa hívás az axios klienssel
import apiClient from '@/lib/api/client';

export const getTasks = async (groupId: string) => {
  const response = await apiClient.post('/group/task/list', {
    group_id: groupId
  });
  return response.data;
};
```

---

### 7. Internationalization (i18n)

*   **Könyvtár:** `next-intl`
*   **Konfiguráció:** `i18n/request.ts` és `i18n/config.ts`.
*   **Locale kezelés:** URL prefix alapú (`/hu/dashboard`, `/en/dashboard`).
*   **Fordítások:** A `messages/` mappában található strukturált JSON fájlokban.
*   **Encoding:** UTF-8 használata kötelező a speciális magyar karakterek miatt.

---

### 8. Állapotkezelés (State Management)

*   **Zustand Store-ok:**
    *   `authStore`: Felhasználói profil, autentikációs állapot.
    *   `uiStore`: Sidebar nyitva/zárva, aktív csoport ID, modal állapotok.
    *   `permissionStore`: Rendszerszintű és csoportszintű jogosultságok cache-elése.
*   **React Context:**
    *   `GroupPermissionContext`: Az aktuálisan megnyitott csoport jogosultságainak valós idejű elérése.

---

### 9. Stílus és téma (Styling & Theme)

A rendszer egy sötét tónusú, "premium" designt követ.

*   **Design Tokenek (CSS Variables):**
    *   `--background`: `#0a0a0a` (Mélyfekete)
    *   `--accent`: `#f97316` (Narancs)
    *   `--text-primary`: `#ededed`
    *   `--border-default`: `#262626`
*   **Tailwind:** Szigorúan a változókra építve (`bg-[var(--background)]`).
*   **FullCalendar:** Egyedi CSS override-ok a `globals.css`-ben a dark theme illesztéséhez.
*   **Reszponzivitás:** Mobile-first megközelítés, a Sidebar 1024px alatt Sheet-té (modal) alakul.

---

### 10. Környezeti változók (Environment Variables)

| Változó | Leírás | Példa érték |
|---|---|---|
| `WORF_API_URL` | Backend API címe (Szerver oldali proxy használja) | `https://api.worf.hu` |
| `NEXT_PUBLIC_APP_URL` | Frontend publikus URL | `https://app.worf.hu` |
| `NEXT_PUBLIC_API_URL` | Kliens oldali API prefix (általában `/api/proxy`) | `/api/proxy` |

---

### 11. Build és deployment

*   **Runtime:** Node.js 20+ (ajánlott: 22.x)
*   **Csomagkezelő:** `npm`
*   **Parancsok:**
    ```bash
    npm install       # Függőségek telepítése
    npm run dev       # Fejlesztői mód
    npm run build     # Production build generálás
    npm run start     # Buildelt alkalmazás indítása
    ```
*   **Speciális:** Shared hosting vagy PM2 használata esetén a standalone build ajánlott.

---

### 12. Teljesítmény és optimalizáció

*   **Code Splitting:** Automatikus (Next.js alapfunkció).
*   **Fontok:** `next/font/google` használata (Geist Sans/Mono).
*   **PWA Caching:** NetworkFirst stratégia a dinamikus tartalmakhoz, CacheFirst a statikus assetekhez.
*   **Bundle Optimization:** Webpack alapú build, optimalizált tree-shaking.

---

### 13. Ismert limitációk / TODO

*   **i18n:** Néhány hibaüzenet még direktben a backendtől érkezik (nyers szöveg).
*   **Mobile:** A Timeline nézet komplexitása miatt mobilon vízszintes görgetést igényel.
*   **Auth:** A token refresh logika finomhangolása folyamatban (race condition kezelés).
*   **Admin:** A globális admin panel bizonyos moduljai még fejlesztés alatt állnak.
