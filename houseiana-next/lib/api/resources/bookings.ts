import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Booking, Guest, Property, Paginated } from "../types";

export interface BookingListParams {
  /** Integer ID from /api/reservation-agent-lookup/booking-statuses. */
  status?: number;
  page?: number;
  limit?: number;
}

export interface BookingCreateInput {
  propertyId: string;
  guestId: string;
  /** ISO 8601 datetime (UTC). */
  checkIn: string;
  checkOut: string;
  guests: number;
  adminId: string;
}

export interface BookingQuoteInput {
  propertyId: string;
  checkin: string;
  checkout: string;
  guests: number;
  extras?: string[];
  promoCode?: string;
  agentDiscountPct?: number;
}

export interface BookingQuote {
  subtotal: number;
  cleaning: number;
  utilities: number;
  bookingFee: number;
  extrasTotal: number;
  before: number;
  discPct: number;
  disc: number;
  total: number;
  commission: number;
  currency: string;
}

export interface CancelInput {
  refundAmount: number;
  reason?: string;
}

export interface BookingConfirmInput {
  bookingId: string;
  paymentMethod: number;
  adminId: string;
}

export async function listBookings(
  params: BookingListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Booking>> {
  const raw = await api.get<unknown>(ENDPOINTS.bookings.list, {
    query: {
      status: params.status,
      page: params.page,
      limit: params.limit,
    },
    signal,
  });
  return normalizeListResponse(raw, params);
}

export async function getBooking(ref: string, signal?: AbortSignal): Promise<Booking> {
  const raw = await api.get<unknown>(ENDPOINTS.bookings.detail(ref), { signal });
  return mapBooking(raw);
}

export async function quoteBooking(input: BookingQuoteInput): Promise<BookingQuote> {
  return api.post<BookingQuote>(ENDPOINTS.bookings.quote, input as unknown as Record<string, unknown>);
}

/**
 * Create a confirmed booking via POST /api/reservation-agent/bookings.
 * Server payload shape matches the API contract exactly. The optional
 * `property` / `guest` / `total` hydrate the returned Booking when the
 * backend response only carries an id/ref.
 */
export async function createBooking(args: {
  input: BookingCreateInput;
  property?: Property;
  guest?: Guest;
  total?: number;
  totalDisplay?: string;
  pending?: boolean;
}): Promise<Booking> {
  const raw = await api.post<unknown>(
    ENDPOINTS.bookings.create,
    args.input as unknown as Record<string, unknown>,
  );
  // Some backends return only the new id/ref. Hydrate with the local
  // property/guest objects so the confirmation screen has everything it
  // needs without an extra GET.
  const mapped = mapBooking(unwrapBookingEnvelope(raw));
  if (args.property && (!mapped.property || !mapped.property.id)) mapped.property = args.property;
  if (args.guest && (!mapped.guest || !mapped.guest.id)) mapped.guest = args.guest;
  if (args.total && !mapped.totalAmount) {
    mapped.totalAmount = args.total;
    mapped.total = args.totalDisplay ?? `${mapped.property.currency} ${args.total.toLocaleString()}`;
  }
  return mapped;
}

/**
 * Backend wraps single-booking responses in `{ success, data: {...} }`.
 * Reach into `data` (and a few common aliases) before mapping.
 */
function unwrapBookingEnvelope(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const r = raw as Record<string, unknown>;
  if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) return r.data;
  if (r.result && typeof r.result === "object" && !Array.isArray(r.result)) return r.result;
  if (r.booking && typeof r.booking === "object" && !Array.isArray(r.booking)) return r.booking;
  return raw;
}

/**
 * Confirm a previously-created booking via POST /api/reservation-agent/booking/confirm.
 * The bookingId comes from the prior createBooking() response.
 */
export async function confirmBooking(args: {
  input: BookingConfirmInput;
  property?: Property;
  guest?: Guest;
  total?: number;
  totalDisplay?: string;
}): Promise<Booking> {
  const raw = await api.post<unknown>(
    ENDPOINTS.bookings.confirm,
    args.input as unknown as Record<string, unknown>,
  );
  const mapped = mapBooking(unwrapBookingEnvelope(raw));
  // The /confirm response may only carry the booking id/ref; hydrate the rest
  // from the locally-known property/guest so the success screen renders fully.
  if (args.property && (!mapped.property || !mapped.property.id)) mapped.property = args.property;
  if (args.guest && (!mapped.guest || !mapped.guest.id)) mapped.guest = args.guest;
  if (args.total && !mapped.totalAmount) {
    mapped.totalAmount = args.total;
    mapped.total = args.totalDisplay ?? `${mapped.property.currency} ${args.total.toLocaleString()}`;
  }
  if (!mapped.id) mapped.id = args.input.bookingId;
  return mapped;
}

export async function cancelBooking(ref: string, input: CancelInput): Promise<Booking> {
  const raw = await api.post<unknown>(
    ENDPOINTS.bookings.cancel(ref),
    input as unknown as Record<string, unknown>,
  );
  return mapBooking(raw);
}

export async function updateBookingNotes(ref: string, notes: string): Promise<Booking> {
  const raw = await api.patch<unknown>(ENDPOINTS.bookings.update(ref), { notes });
  return mapBooking(raw);
}

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Backend response envelope (real):
 *   { bookings: [...], totalCount, page, limit }
 * Falls back through common alternates so a contract tweak doesn't break us.
 */
function normalizeListResponse(raw: unknown, params: BookingListParams): Paginated<Booking> {
  let arr: unknown[] = [];
  let total = 0;
  let page = params.page ?? 1;
  let pageSize = params.limit ?? 20;

  if (Array.isArray(raw)) {
    arr = raw;
    total = raw.length;
  } else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const list = (Array.isArray(r.bookings) ? r.bookings
                : Array.isArray(r.items) ? r.items
                : Array.isArray(r.data) ? r.data
                : Array.isArray(r.results) ? r.results
                : []) as unknown[];
    arr = list;
    total = typeof r.totalCount === "number" ? (r.totalCount as number)
          : typeof r.total === "number" ? (r.total as number)
          : list.length;
    page = typeof r.page === "number" ? r.page : page;
    pageSize = typeof r.limit === "number" ? (r.limit as number)
             : typeof r.pageSize === "number" ? (r.pageSize as number)
             : pageSize;
  }

  return {
    items: arr.map(mapBooking),
    total,
    page,
    pageSize,
  };
}

/**
 * Backend booking shape:
 *   id, bookingCode, guestId, guestName, propertyId, propertyTitle,
 *   country, city, checkIn, checkOut, numberOfNights, totalPrice,
 *   currencyCode, status ("Upcoming" | "Pending" | "Checked-in" | "Cancelled" | ...).
 *
 * Maps into our local Booking shape with shallow Property/Guest stubs
 * (enough for the bookings list and drawer to render).
 */
function mapBooking(raw: unknown): Booking {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string, fallback = "") => (typeof r[k] === "string" ? (r[k] as string) : fallback);
  const num = (k: string, fallback = 0) => (typeof r[k] === "number" ? (r[k] as number) : fallback);

  const id = r.id != null ? String(r.id) : r.bookingId != null ? String(r.bookingId) : undefined;
  const ref = str("bookingCode") || str("reference") || str("ref") || id || "";
  const checkin = toDateOnly(str("checkIn") || str("checkin"));
  const checkout = toDateOnly(str("checkOut") || str("checkout"));
  const totalAmount = num("totalPrice") || num("totalAmount") || num("total");
  const currency = str("currencyCode") || str("currency") || "EGP";
  const nights = num("numberOfNights") || num("nights") || daysBetween(checkin, checkout) || 1;

  const guestName = str("guestName") || "—";
  const [firstName = "—", ...rest] = guestName.split(" ");
  const guest: Guest = {
    id: String(r.guestId ?? r.guest_id ?? ""),
    first: firstName,
    last: rest.join(" "),
    email: str("guestEmail"),
    phone: str("guestPhone"),
    nat: "—",
    bookings: 0,
    ltv: "—",
  };

  const propertyId = String(r.propertyId ?? r.property_id ?? "");
  const property: Property = {
    id: propertyId,
    name: str("propertyTitle") || str("propertyName") || "—",
    nameAr: str("propertyTitleAr") || str("propertyTitle") || "—",
    loc: [str("city"), str("country")].filter(Boolean).join(", ") || "—",
    locAr: [str("city"), str("country")].filter(Boolean).join(", ") || "—",
    descAr: "",
    country: "egypt",
    type: "apartment",
    tier: "standard",
    price: nights > 0 ? Math.round(totalAmount / nights) : 0,
    currency,
    bedrooms: 0,
    bathrooms: 0,
    beds: 0,
    capacity: 0,
    area: 0,
    rating: 0,
    reviews: 0,
    instantBook: false,
    superhost: false,
    verified: false,
    freeCancel: true,
    desc: "",
    rooms: [],
    amenities: {},
    extras: [],
    fees: { cleaning: 0, utilities: 0, bookingFeePct: 0, deposit: 0 },
    policies: { checkin: "—", checkout: "—", minNights: 1, cancel: "—" },
    owner: { name: "—", phone: "", whatsapp: "", responseTime: "—" },
  };

  return {
    id,
    ref,
    guest,
    property,
    checkin,
    checkout,
    nights,
    total: `${currency} ${totalAmount.toLocaleString()}`,
    totalAmount,
    paidAmount: totalAmount,
    status: mapStatus(str("status")),
    channel: "wa",
    paymentStatus: "paid",
    refundAmount: 0,
    refundStatus: "none",
    holdUntil: null,
  };
}

function mapStatus(s: string): Booking["status"] {
  const k = s.toLowerCase().replace(/[\s-_]/g, "");
  if (k.startsWith("checkedout")) return "checkedout";
  if (k.startsWith("checkedin")) return "checkedin";
  if (k === "cancelled" || k === "canceled") return "cancelled";
  if (k === "pending" || k === "requested" || k === "draft") return "pending";
  return "confirmed";
}

function toDateOnly(s: string): string {
  if (!s) return "";
  const i = s.indexOf("T");
  return i > 0 ? s.slice(0, i) : s;
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}
