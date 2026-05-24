import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Paginated, Property } from "../types";

/**
 * Query params for /api/reservation-agent/property-search.
 * Field names match the backend contract exactly.
 */
export interface PropertySearchParams {
  propertyType?: number[];
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  guests?: number;
  minAreaSize?: number;
  maxAreaSize?: number;
  minPrice?: number;
  maxPrice?: number;
  amenities?: number[];
  checkin?: string;       // YYYY-MM-DD
  checkout?: string;      // YYYY-MM-DD
  location?: string;
  instantBook?: boolean;
  sortBy?: number;
  page?: number;
  limit?: number;
}

export async function listProperties(
  params: PropertySearchParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Property>> {
  const raw = await api.get<unknown>(ENDPOINTS.properties.list, {
    query: flattenQuery(params),
    signal,
  });
  return normalizeListResponse(raw, params);
}

export interface PropertyDetailParams {
  checkin?: string;   // YYYY-MM-DD
  checkout?: string;  // YYYY-MM-DD
}

export async function getProperty(
  id: string,
  params: PropertyDetailParams = {},
  signal?: AbortSignal,
): Promise<Property> {
  const raw = await api.get<unknown>(ENDPOINTS.properties.detail(id), {
    query: { checkin: params.checkin, checkout: params.checkout },
    signal,
  });
  // Some backends wrap single resources in { data: {...} } or { result: {...} }.
  const unwrapped = unwrapDetail(raw);
  return mapProperty(unwrapped);
}

function unwrapDetail(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const r = raw as Record<string, unknown>;
  if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) return r.data;
  if (r.result && typeof r.result === "object" && !Array.isArray(r.result)) return r.result;
  return raw;
}

/**
 * Flatten params for the request layer. Array keys (propertyType, amenities)
 * are repeated by the URL builder, matching OpenAPI `style: form, explode: true`.
 */
function flattenQuery(p: PropertySearchParams) {
  return {
    propertyType: p.propertyType,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    beds: p.beds,
    guests: p.guests,
    minAreaSize: p.minAreaSize,
    maxAreaSize: p.maxAreaSize,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    amenities: p.amenities,
    checkin: p.checkin,
    checkout: p.checkout,
    location: p.location,
    instantBook: p.instantBook,
    sortBy: p.sortBy,
    page: p.page,
    limit: p.limit,
  };
}

/**
 * Normalize backend response into our local Paginated<Property> shape.
 * Tries common envelopes (items / data / result) and falls back to
 * treating the response itself as an array.
 */
function normalizeListResponse(raw: unknown, params: PropertySearchParams): Paginated<Property> {
  let items: unknown[] = [];
  let total = 0;
  let page = params.page ?? 1;
  let pageSize = params.limit ?? 20;

  if (Array.isArray(raw)) {
    items = raw;
    total = raw.length;
  } else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const list = (Array.isArray(r.items) ? r.items
                : Array.isArray(r.data) ? r.data
                : Array.isArray(r.result) ? r.result
                : Array.isArray(r.results) ? r.results
                : []) as unknown[];
    items = list;
    total = typeof r.total === "number" ? r.total
          : typeof r.totalCount === "number" ? (r.totalCount as number)
          : typeof r.count === "number" ? (r.count as number)
          : list.length;
    page = typeof r.page === "number" ? r.page : page;
    pageSize = typeof r.pageSize === "number" ? r.pageSize
             : typeof r.limit === "number" ? (r.limit as number)
             : pageSize;
  }

  return {
    items: items.map(mapProperty),
    total,
    page,
    pageSize,
  };
}

/**
 * Map a raw property object from /api/reservation-agent/property-search
 * to our local Property shape. Backend fields seen in production:
 *   id, title, propertyType, country, state, city, village,
 *   bedrooms, bathrooms, beds, guests, sizeOfProperty, coverPhoto,
 *   instantBook, pricePerNight, currencyCode, averageRating,
 *   ratingsCount, bookingCount, amenities.
 */
function mapProperty(raw: unknown): Property {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string, fallback = "") => (typeof r[k] === "string" ? (r[k] as string) : fallback);
  const num = (k: string, fallback = 0) => (typeof r[k] === "number" ? (r[k] as number) : fallback);
  const bool = (k: string, fallback = false) => (typeof r[k] === "boolean" ? (r[k] as boolean) : fallback);

  const id = String(r.id ?? r.propertyId ?? r._id ?? Math.random().toString(36).slice(2, 8));
  const name = str("title") || str("name") || `Property ${id}`;
  const nameAr = str("titleAr") || str("nameAr") || name;

  const locParts = [str("city"), str("state"), str("country")].filter(Boolean);
  const loc = str("location") || str("loc") || str("address") || locParts.join(", ") || "—";
  const locAr = str("locationAr") || str("locAr") || loc;

  const desc = str("description") || str("desc") || "";
  const descAr = str("descriptionAr") || str("descAr") || desc;

  const price = num("pricePerNight") || num("price") || num("nightlyRate");
  const currency = str("currencyCode") || str("currency") || "EGP";

  const type = str("propertyType") || str("type") || "apartment";
  const tier = (str("tier") || "standard") as Property["tier"];

  const rating = num("averageRating") || num("rating");
  const reviews = num("ratingsCount") || num("reviewsCount") || num("reviews");

  const bedrooms = num("bedrooms") || num("rooms");
  const bathrooms = num("bathrooms");
  const beds = num("beds");
  const capacity = num("guests") || num("capacity") || num("maxGuests");
  const area = num("sizeOfProperty") || num("area") || num("areaSize") || num("size");

  const amenities: Record<string, boolean> = {};
  if (Array.isArray(r.amenities)) {
    for (const a of r.amenities) {
      if (!a) continue;
      if (typeof a === "string") amenities[a] = true;
      else if (typeof a === "object") {
        const obj = a as Record<string, unknown>;
        const key = obj.slug ?? obj.name ?? obj.id;
        if (typeof key === "string" || typeof key === "number") amenities[String(key)] = true;
      }
    }
  } else if (r.amenities && typeof r.amenities === "object") {
    Object.assign(amenities, r.amenities as Record<string, boolean>);
  }

  const photos = extractPhotos(r);

  return {
    id,
    name,
    nameAr,
    loc,
    locAr,
    descAr,
    country: "egypt",
    type,
    tier,
    price,
    currency,
    bedrooms,
    bathrooms,
    beds,
    capacity,
    area,
    rating,
    reviews,
    instantBook: bool("instantBook"),
    superhost: bool("superhost"),
    verified: bool("verified"),
    freeCancel: bool("freeCancel", true),
    desc,
    rooms: Array.isArray(r.rooms) ? (r.rooms as Property["rooms"]) : [],
    amenities,
    extras: Array.isArray(r.extras) ? (r.extras as Property["extras"]) : [],
    fees: (r.fees as Property["fees"]) ?? { cleaning: 0, utilities: 0, bookingFeePct: 0, deposit: 0 },
    policies: (r.policies as Property["policies"]) ?? {
      checkin: "—",
      checkout: "—",
      minNights: 1,
      cancel: "—",
    },
    owner: extractOwner(r),
    photos,
  };
}

/**
 * Pull the image URLs out of a property payload. Backends vary on the
 * field name (coverPhoto / cover_photo / thumbnail / image / imageUrl)
 * and shape (plain string vs `{ url }` object vs array of either). The
 * list endpoint typically returns a single cover image; the detail
 * endpoint returns a full gallery.
 */
function extractPhotos(r: Record<string, unknown>): string[] {
  const toUrl = (v: unknown): string | null => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      for (const k of ["url", "src", "href", "path", "uri"]) {
        const inner = obj[k];
        if (typeof inner === "string" && inner.trim()) return inner.trim();
      }
    }
    return null;
  };

  const collect = (input: unknown): string[] => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.map(toUrl).filter((x): x is string => x !== null);
    }
    const one = toUrl(input);
    return one ? [one] : [];
  };

  // Try the most specific gallery field first, then fall back through
  // common single-cover names. Anything found at the first matching key
  // wins — later fields aren't merged in (avoids duplicates).
  const galleryKeys = ["photos", "images", "gallery", "media"];
  for (const k of galleryKeys) {
    const urls = collect(r[k]);
    if (urls.length) return urls;
  }
  const coverKeys = ["coverPhoto", "cover_photo", "coverImage", "cover_image", "thumbnailUrl", "thumbnail", "imageUrl", "image", "mainImage", "picture"];
  for (const k of coverKeys) {
    const urls = collect(r[k]);
    if (urls.length) return urls;
  }
  return [];
}

/**
 * Pull the host/owner contact info out of a property payload. Backends
 * vary a lot here — try a nested object first ({owner|host|landlord}),
 * then fall back to flat hostName/ownerPhone/etc. fields on the property
 * itself. Phone gets the country-code prefix when both pieces are
 * returned separately.
 */
function extractOwner(r: Record<string, unknown>): Property["owner"] {
  const nested =
    (r.owner && typeof r.owner === "object" ? (r.owner as Record<string, unknown>) : null) ??
    (r.host && typeof r.host === "object" ? (r.host as Record<string, unknown>) : null) ??
    (r.landlord && typeof r.landlord === "object" ? (r.landlord as Record<string, unknown>) : null);

  const src = nested ?? r;
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = src[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };

  const first = pick("firstName", "givenName");
  const last = pick("lastName", "familyName", "surname");
  const fullName =
    pick("name", "fullName", "displayName", "hostName", "ownerName") ||
    [first, last].filter(Boolean).join(" ") ||
    "—";

  const countryCode = pick("countryCode", "phoneCountryCode", "hostCountryCode");
  const rawPhone = pick("phone", "phoneNumber", "mobile", "hostPhone", "ownerPhone");
  const phone = countryCode && rawPhone && !rawPhone.startsWith("+")
    ? `+${countryCode.replace(/[^\d]/g, "")}${rawPhone}`
    : rawPhone;

  const whatsapp = pick("whatsapp", "whatsappNumber", "wa", "waNumber") || phone;
  const email = pick("email", "hostEmail", "ownerEmail");

  return {
    name: fullName,
    phone,
    whatsapp,
    responseTime: pick("responseTime", "averageResponseTime") || "—",
    email: email || undefined,
  };
}
