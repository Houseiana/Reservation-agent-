import { api, USE_MOCK } from "../client";
import { ENDPOINTS } from "../endpoints";

/**
 * Generic lookup row. The backend likely returns more fields; this
 * minimum is what the UI needs to render and map selections to IDs.
 */
export interface LookupItem {
  id: number;
  name: string;
  /** Sent by some backends; safe to ignore when absent. */
  slug?: string;
  nameAr?: string;
}

export async function getPropertyTypes(signal?: AbortSignal): Promise<LookupItem[]> {
  if (USE_MOCK) {
    return [
      { id: 1, name: "Apartment", slug: "apartment" },
      { id: 2, name: "Villa", slug: "villa" },
      { id: 3, name: "Studio", slug: "studio" },
      { id: 4, name: "Penthouse", slug: "penthouse" },
      { id: 5, name: "Chalet", slug: "chalet" },
    ];
  }
  return normalizeList(await api.get<unknown>(ENDPOINTS.lookups.propertyTypes, { signal }));
}

export async function getAmenities(signal?: AbortSignal): Promise<LookupItem[]> {
  if (USE_MOCK) {
    return [
      { id: 1, name: "WiFi", slug: "wifi" },
      { id: 2, name: "Air conditioning", slug: "ac" },
      { id: 3, name: "Kitchen", slug: "kitchen" },
      { id: 4, name: "Pool", slug: "pool" },
      { id: 5, name: "Free parking", slug: "parking" },
      { id: 6, name: "Washer", slug: "washer" },
    ];
  }
  return normalizeList(await api.get<unknown>(ENDPOINTS.lookups.amenities, { signal }));
}

export async function getBookingStatuses(signal?: AbortSignal): Promise<LookupItem[]> {
  if (USE_MOCK) {
    return [
      { id: 1, name: "Upcoming", slug: "upcoming" },
      { id: 2, name: "Pending", slug: "pending" },
      { id: 3, name: "Checked-in", slug: "checkedin" },
      { id: 4, name: "Cancelled", slug: "cancelled" },
    ];
  }
  return normalizeList(await api.get<unknown>(ENDPOINTS.lookups.bookingStatuses, { signal }));
}

export async function getSortOptions(signal?: AbortSignal): Promise<LookupItem[]> {
  if (USE_MOCK) {
    return [
      { id: 0, name: "Recommended", slug: "recommended" },
      { id: 1, name: "Price: low to high", slug: "priceAsc" },
      { id: 2, name: "Price: high to low", slug: "priceDesc" },
      { id: 3, name: "Top rated", slug: "rating" },
      { id: 4, name: "Largest area", slug: "area" },
    ];
  }
  return normalizeList(await api.get<unknown>(ENDPOINTS.lookups.sortBy, { signal }));
}

/**
 * Backends differ in their list envelope. Accept any of:
 *   - [{id, name}]
 *   - { items: [...] }
 *   - { data: [...] }
 *   - { result: [...] }
 * And coerce common field aliases (label/title → name).
 */
function normalizeList(raw: unknown): LookupItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.items)) arr = r.items;
    else if (Array.isArray(r.data)) arr = r.data;
    else if (Array.isArray(r.result)) arr = r.result;
  }
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const id = (x.id ?? x.value ?? x.key) as number | string | undefined;
      const name = (x.name ?? x.label ?? x.title ?? x.displayName) as string | undefined;
      return {
        id: typeof id === "number" ? id : Number(id),
        name: String(name ?? ""),
        slug: typeof x.slug === "string" ? x.slug : undefined,
        nameAr: typeof x.nameAr === "string" ? x.nameAr
              : typeof x.name_ar === "string" ? (x.name_ar as string)
              : undefined,
      };
    })
    .filter((x) => Number.isFinite(x.id) && x.name);
}
