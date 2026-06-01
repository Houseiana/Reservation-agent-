# API Layer

Central, typed access to the backend. All resource modules live in `resources/`, the fetch wrapper in `client.ts`, and paths in `endpoints.ts`.

## How to use

```ts
import { listBookings, createBooking, ApiError } from "@/lib/api";

const page = await listBookings({ page: 1, pageSize: 20 });
```

In React components, prefer the hook:

```ts
import { useAsync } from "@/hooks/useAsync";
import { listBookings } from "@/lib/api";

const { data, loading, error, refetch } = useAsync(
  (signal) => listBookings({ page: 1 }, signal),
  [],
);
```

## Switching from mock to real backend

1. Fill `.env.local`:
   ```
   # Empty = same-origin (Next.js proxy or unified host).
   # Or set to https://api.houseiana.com.eg when the backend is on a different host.
   NEXT_PUBLIC_API_BASE_URL=

   NEXT_PUBLIC_USE_MOCK=false
   NEXT_PUBLIC_API_TOKEN=…   # dev only
   ```
2. Update paths in `endpoints.ts` if the backend uses different routes.
3. If response shapes don't match local types (`Property`, `Booking`, …), add mappers inside the relevant `resources/*.ts` — don't push server-shaped data into components.
4. Restart `next dev`.

## Wired endpoints (Search & Book page)

| Local function | Backend path |
|---|---|
| `listProperties()` | `GET /api/reservation-agent/property-search` |
| `getPropertyTypes()` | `GET /api/reservation-agent-lookup/property-types` |
| `getAmenities()` | `GET /api/reservation-agent-lookup/amenities` |
| `getSortOptions()` | `GET /api/reservation-agent-lookup/sort-by` |

`listProperties()` accepts the full `PropertySearchParams` shape — `propertyType`, `bedrooms`, `bathrooms`, `beds`, `guests`, `minAreaSize`, `maxAreaSize`, `minPrice`, `maxPrice`, `amenities`, `checkin`, `checkout`, `location`, `instantBook`, `sortBy`, `page`, `limit`. Array params (`propertyType`, `amenities`) are repeated in the query string (`?propertyType=1&propertyType=2`).

The page maps the user's slug-based selections (e.g. `"villa"`, `"wifi"`, `"priceAsc"`) to integer IDs from the lookup endpoints before each call. If a lookup response uses different `name`/`slug` values than the static UI labels, the mapping falls through and that filter is omitted. Adjust the lookup labels or the static UI strings to match.

### Response shape — what the page assumes

`property-search` is parsed by `normalizeListResponse` in `resources/properties.ts`. It accepts any of:

```jsonc
// plain array
[ {...}, {...} ]

// envelope variants
{ "items":   [...], "total": 42, "page": 1, "pageSize": 20 }
{ "data":    [...], "total": 42, "page": 1, "limit": 20 }
{ "result":  [...], "totalCount": 42 }
{ "results": [...], "count": 42 }
```

Each property is normalized via `mapProperty()`, which fills in safe defaults for missing fields. To tighten this once a real response sample is in hand, edit `mapProperty()` in `lib/api/resources/properties.ts`.

## Auth

Default token comes from `NEXT_PUBLIC_API_TOKEN` (dev only). For production, call once at app boot:

```ts
import { setAuthTokenProvider } from "@/lib/api";
setAuthTokenProvider(() => sessionStore.getToken());
```

## What we need from the backend team

Send back the following so we can wire it in one pass:

| Question | Example answer |
|---|---|
| Base URL (staging + prod) | `https://api-staging.houseiana.com.eg/v1` |
| Auth scheme | `Bearer JWT in Authorization header` |
| Pagination shape | `{ items, total, page, pageSize }` or `{ data, meta }`? |
| Error envelope | `{ message, code, details }` |
| Date/time format | ISO 8601 UTC? Or local timezone? |
| Field naming | `camelCase` or `snake_case`? |
| Endpoint paths | Either confirm the list in `endpoints.ts`, or send your own |
| Response samples | One JSON example per endpoint (list + detail) |

If field names differ (e.g. backend sends `check_in` but UI uses `checkin`), we map them inside the resource module — no UI changes needed.
