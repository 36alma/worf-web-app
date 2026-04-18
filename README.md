# WORF Frontend Calendar Integration

Teljes, production-ready naptár modul Next.js + React + TypeScript alapon, a Worf Calendar API endpointokra építve.

## Telepítés

```bash
npm install
npm run dev
```

## Konfiguráció

`.env.local`:

```env
WORF_API_URL=https://your-backend.example.com
NEXT_PUBLIC_API_PROXY_URL=/api/proxy
```

Megjegyzések:
- A kliens a `Bearer` tokent JSON body-ba injektálja.
- Minden kéréshez `x-forwarded-for` header kerül.
- A proxy route szintén átadja a tokent és az IP-t.

## Mappaszerkezet

```text
src/
  types/
    calendar.types.ts
    ui.types.ts
  api/
    client.ts
    calendarApi.ts
  services/
    calendarService.ts
  hooks/
    useCalendars.ts
    useCalendar.ts
    useEvents.ts
    useCreateEvent.ts
    useUpdateEvent.ts
    useDeleteEvent.ts
  contexts/
    CalendarContext.tsx
  components/
    calendar/
      CalendarLayout.tsx
      CalendarList.tsx
      CalendarView.tsx
      EventModal.tsx
      EventList.tsx
      RecurringEventHandler.tsx
    ui/
      Button.tsx
      Modal.tsx
      Toast.tsx
      ErrorBoundary.tsx
  utils/
    dateUtils.ts
    errorHandler.ts
    rateLimiter.ts
  __tests__/
    api.test.ts
    hooks.test.tsx
    components.test.tsx
    integration.test.ts
```

## Használat meglévő appban

```tsx
import { CalendarProvider } from '@/src/contexts/CalendarContext';
import CalendarLayout from '@/src/components/calendar/CalendarLayout';

function App() {
  return (
    <CalendarProvider groupId="group-123" token="bearer-token">
      <CalendarLayout groupId="group-123" />
    </CalendarProvider>
  );
}
```

## API Rate Limit kezelés

- `calendar_mutate`: 35 kérés / 5 perc
- `calendar_get`: 90 kérés / 2 perc
- `event_mutate`: 50 kérés / 5 perc
- `event_get`: 120 kérés / 2 perc

Mit csinál a kliens:
- Lokális rolling-window limiter minden kategóriára.
- 429 esetén automatikus retry (exponential backoff, max 3 próbálkozás).
- Rate limit hibáknál egységes hibaosztály + toast.

## Tesztek

```bash
npm run test
```

Fő tesztterületek:
- API/service metódusok
- Dátum utility-k
- Hook/provider alapműködés
- Komponens render + validáció
- Integrációs flow (event create, calendar delete cache invalidáció)

## Troubleshooting

1. `401 Authentication failed`:
- Ellenőrizd, hogy a cookie token elérhető-e és a `Bearer` mező bekerül-e a body-ba.
- Ellenőrizd az `x-forwarded-for` header továbbítását.

2. `429 Too Many Requests`:
- Várd meg a visszaállási ablakot.
- Ellenőrizd a lokális limiter státuszát a `CalendarService.getRateLimitStatus` metódussal.

3. Nincs adat a naptár oldalon:
- Ellenőrizd a `WORF_API_URL` és `NEXT_PUBLIC_API_PROXY_URL` értékeket.
- Nézd meg a proxy route logokat: `app/api/proxy/[...path]/route.ts`.
