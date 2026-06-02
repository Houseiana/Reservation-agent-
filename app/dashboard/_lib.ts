// Shared helpers and types for the dashboard route. Pure utilities and type
// definitions only — extracted verbatim from page.tsx so the components can be
// split into their own files without changing any behaviour.
import { SITE_URL, type Property, type Guest, type Booking } from "@/data";
import { DICT, type Lang } from "@/i18n";

/* ---------- Property display helpers ---------- */
export function pName(p: Property, lang: Lang) { return lang === "ar" ? p.nameAr : p.name; }
export function pLoc(p: Property, lang: Lang) { return lang === "ar" ? p.locAr : p.loc; }
export function pDesc(p: Property, lang: Lang) { return lang === "ar" ? p.descAr : p.desc; }
export function pShortName(p: Property, lang: Lang) { return pName(p, lang).split("—")[0].trim(); }

/* ---------- Page / nav types ---------- */
export type PageKey = "search" | "bookings" | "guests" | "kpis";
export type InboxTab = "all" | "calls" | "whatsapp" | "missed";

export interface FiltersState {
  /** Property type ID from /lookup/property-types. `null` = All. */
  type: number | null;
  priceMin: number;
  priceMax: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  capacity: number;
  areaMin: number;
  areaMax: number;
  /** Amenity IDs from /lookup/amenities. */
  amenities: Set<number>;
  flags: Set<string>;
  extras: Set<string>;
}

export interface SearchState {
  where: string;
  checkin: string;
  checkout: string;
  guests: number;
  nights: number;
}

export interface BookingState {
  step: number;
  guest: Guest | null;
  selectedExtras: Set<string>;
  /** Lookup ID from /reservation-agent-lookup/payment-methods. Null until selected. */
  payment: number | null;
  paymentSent: boolean;
  paymentVerified: boolean;
}

/* ---------- Date / format helpers ---------- */
export function formatDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
export function formatDateShort(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function propertyUrl(p: Property) { return `${SITE_URL}/property/${p.id}`; }
export function cleanPhone(phone: string) { return phone.replace(/[^\d]/g, ""); }
export function fmtTimeLeft(ms: number): string {
  if (ms <= 0) return "0m";
  const m = Math.floor(ms / 60000);
  if (m >= 60) {
    const h = Math.floor(m / 60); const rem = m % 60;
    return `${h}h ${rem}m`;
  }
  if (m >= 1) return `${m}m`;
  return `${Math.max(1, Math.floor(ms / 1000))}s`;
}
export function waLink(phone: string, text: string) {
  return `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(text)}`;
}
export function waShare(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Build a compact page-number list with ellipsis around the current page.
 * Examples (current=5):
 *   total=4  → [1, 2, 3, 4]
 *   total=10 → [1, 2, 3, 4, 5, 6, 7, "...", 10]
 *   total=34 → [1, "...", 3, 4, 5, 6, 7, "...", 34]
 */
export function pageNumbers(current: number, total: number): Array<number | "..."> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | "..."> = [1];
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  if (start > 2) out.push("...");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("...");
  out.push(total);
  return out;
}

/* ---------- Booking / guest helpers ---------- */
export type BookingFilter = "all" | "today" | "tomorrow" | "inHouse" | "pendingPay" | string;

export interface Totals {
  subtotal: number; cleaning: number; utilities: number; bookingFee: number;
  extrasTotal: number; total: number; commission: number;
}

/** Map a backend status lookup name (e.g. "Upcoming", "Checked-in") to the
 * local Booking.status enum value. Mirrors mapStatus() in lib/api/resources/bookings.ts. */
export function statusNameToEnum(name: string): Booking["status"] {
  const k = name.toLowerCase().replace(/[\s-_]/g, "");
  if (k.startsWith("checkedout")) return "checkedout";
  if (k.startsWith("checkedin")) return "checkedin";
  if (k === "cancelled" || k === "canceled") return "cancelled";
  if (k === "pending" || k === "requested" || k === "draft") return "pending";
  // "Upcoming" and anything else fall back to "confirmed".
  return "confirmed";
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function urgencyOf(b: Booking, today: string): { key: keyof typeof DICT["en"]["bookingsPage"]["urgency"] | "upcoming" | "past" | null; days: number } {
  if (b.status === "cancelled" || b.status === "checkedout") return { key: null, days: 0 };
  const dIn = daysBetween(today, b.checkin);
  const dOut = daysBetween(today, b.checkout);
  if (b.status === "checkedin") {
    if (dOut < 0) return { key: "lateCheckout", days: dOut };
    if (dOut === 0) return { key: "checkoutToday", days: 0 };
    return { key: "inHouse", days: dOut };
  }
  if (dIn === 0) return { key: "today", days: 0 };
  if (dIn === 1) return { key: "tomorrow", days: 1 };
  if (dIn > 1 && dIn <= 7) return { key: "inDays", days: dIn };
  return { key: null, days: dIn };
}

export function tierOf(g: Guest): "vip" | "repeat" | "new" {
  if (g.bookings >= 5) return "vip";
  if (g.bookings >= 2) return "repeat";
  return "new";
}

export function freeCancelDeadline(checkin: string, policyText: string): { date: string; type: "flexible" | "moderate" | "strict" } | null {
  const lo = policyText.toLowerCase();
  let days = 5;
  let type: "flexible" | "moderate" | "strict" = "moderate";
  if (lo.includes("flexible") || lo.includes("24h")) { days = 1; type = "flexible"; }
  else if (lo.includes("strict")) { days = 7; type = "strict"; }
  const d = new Date(checkin); d.setDate(d.getDate() - days);
  return { date: d.toISOString().slice(0, 10), type };
}
