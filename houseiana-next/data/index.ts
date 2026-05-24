export type Country = "egypt";

export const SITE_URL = "https://houseiana.com";

export interface Owner {
  name: string;
  phone: string;
  whatsapp: string;
  responseTime: string;
  email?: string;
}

export type Amenities = Record<string, boolean | undefined>;

export interface Extra {
  id: string;
  name: string;
  desc: string;
  price: number;
  currency: string;
  unit: string;
}

export interface Room {
  name: string;
  info: string;
}

export interface Property {
  id: string;
  name: string;
  nameAr: string;
  loc: string;
  locAr: string;
  descAr: string;
  country: Country;
  type: string;
  tier: "luxury" | "standard";
  price: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  capacity: number;
  area: number;
  rating: number;
  reviews: number;
  instantBook: boolean;
  superhost: boolean;
  verified: boolean;
  freeCancel: boolean;
  desc: string;
  rooms: Room[];
  amenities: Amenities;
  extras: Extra[];
  fees: { cleaning: number; utilities: number; bookingFeePct: number; deposit: number };
  policies: { checkin: string; checkout: string; minNights: number; cancel: string };
  owner: Owner;
  photos?: string[];
  coverPhoto?: string; // URL of single cover photo, promoted to photos[0] by normalizeProperty
  /** Backend-computed pricing breakdown — present on the detail endpoint
   * (and any other endpoint that takes checkin/checkout). Prefer these
   * values for display; they reflect the canonical totals. */
  pricing?: {
    nightlyRate: number;
    nights: number;
    subtotal: number;
    cleaningFee: number;
    waterFee: number;
    electricityFee: number;
    serviceFee: number;
    total: number;
  };
}

export interface Guest {
  id: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  nat: string;
  bookings: number;
  ltv: string;
  /** ISO date — last stay check-in, when known. */
  lastStay?: string;
  isNew?: boolean;
}

export type BookingChannel = "wa" | "call" | "web" | "direct";
export type PaymentStatus = "paid" | "partial" | "pending";
export type RefundStatus = "none" | "requested" | "processed";

export interface Booking {
  /** Server-assigned identifier — used by /booking/confirm. */
  id?: string;
  ref: string;
  guest: Guest;
  property: Property;
  checkin: string;
  checkout: string;
  nights: number;
  total: string;
  totalAmount: number;
  paidAmount: number;
  status: "confirmed" | "pending" | "checkedin" | "checkedout" | "cancelled";
  channel: BookingChannel;
  paymentStatus: PaymentStatus;
  refundAmount: number;       // amount owed back to guest (0 if none)
  refundStatus: RefundStatus; // none / agent has requested from Accounts / processed
  holdUntil?: string | null;  // ISO datetime — while in future + status=pending, the unit is on hold
  notes?: string;
}

export interface AmenityDef {
  id: string;
  label: string;
  icon: string;
}

export const ESSENTIAL_AMENITIES: AmenityDef[] = [
  { id: "ac", label: "Air conditioning", icon: "M5 11h14M5 15h14M9 7l-2 4M15 7l-2 4M11 19l-2-4M17 19l-2-4" },
  { id: "wifi", label: "Wi-Fi", icon: "M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" },
  { id: "kitchen", label: "Kitchen", icon: "M3 21V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v14M3 11h18M8 7v.01M16 7v.01" },
  { id: "washer", label: "Washer", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 19a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" },
  { id: "tv", label: "TV", icon: "M2 6h20v12H2zM7 22h10" },
  { id: "parking", label: "Free parking", icon: "M9 17V7h4a3 3 0 0 1 0 6H9" },
  { id: "elevator", label: "Elevator", icon: "M9 4l-4 4 4 4M9 16l-4 4 4 4M15 4l4 4-4 4M15 16l4 4-4 4" },
  { id: "workspace", label: "Workspace", icon: "M3 12h18M3 12v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6M5 12V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M9 6V4M15 6V4" },
];

export const FEATURE_AMENITIES: AmenityDef[] = [
  { id: "pool", label: "Pool", icon: "M2 20s2-2 5-2 5 2 8 2 5-2 5-2M2 14s2-2 5-2 5 2 8 2 5-2 5-2M9 12V4M15 12V6" },
  { id: "gym", label: "Gym", icon: "M6 6l-2 2 4 4-4 4 2 2 4-4 4 4 2-2-4-4 4-4-2-2-4 4z" },
  { id: "balcony", label: "Balcony", icon: "M3 21h18M5 21V11h4v10M15 21V11h4v10M3 11h18M9 7h6v4H9z" },
  { id: "seaview", label: "Sea view", icon: "M2 12s2 2 5 2 5-2 5-2 2 2 5 2 5-2 5-2M2 17s2 2 5 2 5-2 5-2 2 2 5 2 5-2 5-2M2 7s2 2 5 2 5-2 5-2 2 2 5 2 5-2 5-2" },
  { id: "beachAccess", label: "Beach access", icon: "M2 22h20M3 18l9-12 9 12M9 14l3-4 3 4" },
  { id: "garden", label: "Private garden", icon: "M12 22V8M5 12s2-3 7-3 7 3 7 3M3 8s4-4 9-4 9 4 9 4" },
  { id: "jacuzzi", label: "Jacuzzi", icon: "M2 12h20v5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-5zM8 12V7a3 3 0 0 1 6 0M14 7l2-2" },
  { id: "bbq", label: "BBQ", icon: "M5 8h14l-2 13H7zM7 8c0-3 2-5 5-5s5 2 5 5" },
  { id: "pets", label: "Pets allowed", icon: "M11 14c0-3-3-5-5-5s-3 2-3 4 1 4 4 4M21 11c0-2-1-4-3-4s-5 2-5 5M11 14h2v6" },
  { id: "events", label: "Events allowed", icon: "M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-7.6-3.8L3 21l1.9-1.9C4 17.6 3 15.6 3 13.5a8.5 8.5 0 0 1 17 0z" },
];

export const EXTRA_FILTERS: { id: string; label: string }[] = [
  { id: "beach", label: "Beach access fee" },
  { id: "pickup", label: "Airport pickup" },
  { id: "cleaning", label: "Daily housekeeping" },
  { id: "breakfast", label: "Breakfast delivery" },
  { id: "chef", label: "Private chef" },
  { id: "driver", label: "Private driver" },
  { id: "tour", label: "Tours & activities" },
];

// Anchored to a fixed "today" of 2026-05-13 so urgency states are predictable in the demo.
export const TODAY_STR = "2026-05-13";
// Default hold duration when sending a payment link (1 hour in ms)
export const HOLD_DURATION_MS = 60 * 60 * 1000;

export interface Destination {
  name: string;
  nameAr: string;
  meta: string;
  metaAr: string;
}

export const DESTINATIONS: Destination[] = [
  { name: "Zamalek, Cairo", nameAr: "الزمالك، القاهرة", meta: "Egypt · 12 properties", metaAr: "مصر · 12 عقار" },
  { name: "Garden City, Cairo", nameAr: "جاردن سيتي، القاهرة", meta: "Egypt · 7 properties", metaAr: "مصر · 7 عقار" },
  { name: "Maadi, Cairo", nameAr: "المعادي، القاهرة", meta: "Egypt · 10 properties", metaAr: "مصر · 10 عقار" },
  { name: "New Cairo", nameAr: "القاهرة الجديدة", meta: "Egypt · 9 properties", metaAr: "مصر · 9 عقار" },
  { name: "Heliopolis, Cairo", nameAr: "مصر الجديدة، القاهرة", meta: "Egypt · 6 properties", metaAr: "مصر · 6 عقار" },
  { name: "Alexandria", nameAr: "الإسكندرية", meta: "Egypt · 5 properties", metaAr: "مصر · 5 عقار" },
  { name: "North Coast (Sahel)", nameAr: "الساحل الشمالي", meta: "Egypt · 7 properties", metaAr: "مصر · 7 عقار" },
  { name: "Hurghada", nameAr: "الغردقة", meta: "Egypt · 4 properties", metaAr: "مصر · 4 عقار" },
];

export interface InboxItem {
  id: number;
  type: "wa" | "call" | "missed";
  from: string;
  avatar: string;
  phone: string;
  preview: string;
  time: string;
  unread: boolean;
  status: "qualified" | "quoted" | "booked" | "lost" | "new";
  knownGuest: boolean;
  duration?: string;
}

export const INBOX: InboxItem[] = [
  { id: 1, type: "wa", from: "Fatima Hassan", avatar: "FH", phone: "+20 100 234 5678", preview: "Are the dates Aug 12-19 still available for Sahel Sapphire?", time: "2 min", unread: true, status: "qualified", knownGuest: true },
  { id: 2, type: "call", from: "Ahmed Khalifa", avatar: "AK", phone: "+20 102 555 0142", preview: "Voice call · 4m 32s · asked about Nile Plaza extras", time: "18 min", unread: true, status: "quoted", knownGuest: true, duration: "4:32" },
  { id: 3, type: "wa", from: "Unknown", avatar: "?", phone: "+20 101 887 4421", preview: "Hi, do you have a 3-bedroom apartment in Zamalek for next weekend?", time: "34 min", unread: true, status: "new", knownGuest: false },
  { id: 4, type: "missed", from: "Layla Mostafa", avatar: "LM", phone: "+20 109 778 2245", preview: "Missed call · returned at 14:22", time: "1h", unread: false, status: "booked", knownGuest: true },
  { id: 5, type: "wa", from: "Omar Mahmoud", avatar: "OM", phone: "+20 122 555 8899", preview: "Thanks! I'll confirm with my wife and get back to you.", time: "2h", unread: false, status: "quoted", knownGuest: true },
  { id: 6, type: "call", from: "Sara Ibrahim", avatar: "SI", phone: "+20 106 882 4419", preview: "Voice call · 7m 12s · booked Maadi Studio for Aug 5-9", time: "3h", unread: false, status: "booked", knownGuest: true, duration: "7:12" },
  { id: 7, type: "wa", from: "Unknown", avatar: "?", phone: "+20 109 442 1156", preview: "Salam, I saw your villa on Instagram, what's the price?", time: "5h", unread: false, status: "qualified", knownGuest: false },
  { id: 8, type: "missed", from: "Unknown", avatar: "?", phone: "+20 111 442 8830", preview: "Missed call · no callback yet", time: "6h", unread: false, status: "new", knownGuest: false },
  { id: 9, type: "wa", from: "Hossam El-Sayed", avatar: "HE", phone: "+20 100 887 4422", preview: "Cancellation confirmed, refund processed.", time: "yesterday", unread: false, status: "lost", knownGuest: true },
];

export interface IncomingCaller {
  avatar: string;
  name: string;
  phone: string;
  tag: string;
  context: string;
  channel: "call" | "wa";
}

export const INCOMING_CALLERS: IncomingCaller[] = [
  { avatar: "FH", name: "Fatima Hassan", phone: "+20 100 234 5678", tag: "Returning guest · 4 bookings", context: 'Last booking: <b style="color:var(--text)">Zamalek Heights</b> · checked out 3 days ago. Asked about North Coast availability via WhatsApp last week.', channel: "call" },
  { avatar: "?", name: "Unknown caller", phone: "+20 101 887 4421", tag: "New lead · first contact", context: 'Number not in CRM. Inbound from <b style="color:var(--text)">Houseiana hotline</b>. Source: Instagram ad campaign #IG-EG-Aug.', channel: "call" },
  { avatar: "AK", name: "Ahmed Khalifa", phone: "+20 102 555 0142", tag: "VIP · 7 bookings · EGP 124,500 LTV", context: 'Active booking: <b style="color:var(--text)">Nile Plaza Tower</b> · checks in tomorrow 15:00. Likely calling about early check-in.', channel: "wa" },
  { avatar: "LM", name: "Layla Mostafa", phone: "+20 109 778 2245", tag: "VIP · 11 bookings", context: 'Browsing <b style="color:var(--text)">Cairo Festival City Penthouse</b> · spent 18 min on listing this morning.', channel: "call" },
];

export const PD_AMENITY_LIST: { key: string; label: string; icon: string }[] = [
  { key: "ac", label: "Air conditioning", icon: "M5 11h14M5 15h14" },
  { key: "heating", label: "Heating", icon: "M12 2v8M5 9l7 7 7-7" },
  { key: "wifi", label: "High-speed Wi-Fi", icon: "M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" },
  { key: "kitchen", label: "Fully equipped kitchen", icon: "M3 21V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v14" },
  { key: "washer", label: "Washing machine", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 19a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" },
  { key: "dryer", label: "Dryer", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h8M16 12h.01M12 12h.01M8 12h.01M8 16h.01M12 16h.01M16 16h.01" },
  { key: "tv", label: "Smart TV", icon: "M2 6h20v12H2zM7 22h10" },
  { key: "parking", label: "Free parking", icon: "M9 17V7h4a3 3 0 0 1 0 6H9" },
  { key: "pool", label: "Swimming pool", icon: "M2 20s2-2 5-2 5 2 8 2 5-2 5-2" },
  { key: "gym", label: "Gym access", icon: "M6 6l-2 2 4 4-4 4 2 2 4-4 4 4 2-2-4-4 4-4-2-2-4 4z" },
  { key: "elevator", label: "Elevator", icon: "M9 4l-4 4 4 4M15 4l4 4-4 4" },
  { key: "balcony", label: "Private balcony", icon: "M3 21h18M5 21V11h4v10M15 21V11h4v10" },
  { key: "seaview", label: "Sea view", icon: "M2 12s2 2 5 2 5-2 5-2 2 2 5 2 5-2 5-2" },
  { key: "beachAccess", label: "Direct beach access", icon: "M2 22h20M3 18l9-12 9 12" },
  { key: "jacuzzi", label: "Jacuzzi", icon: "M2 12h20v5a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-5z" },
  { key: "bbq", label: "BBQ", icon: "M5 8h14l-2 13H7zM7 8c0-3 2-5 5-5s5 2 5 5" },
  { key: "garden", label: "Private garden", icon: "M12 22V8M5 12s2-3 7-3 7 3 7 3" },
  { key: "workspace", label: "Dedicated workspace", icon: "M3 12h18M3 12v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" },
  { key: "hairdryer", label: "Hair dryer", icon: "M3 8a4 4 0 0 1 4-4h12l-4 8H7a4 4 0 0 1-4-4zM10 12v8" },
  { key: "iron", label: "Iron", icon: "M5 8h14l-2 6H7zM7 14v6h10v-6" },
  { key: "safe", label: "In-room safe", icon: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" },
  { key: "pets", label: "Pets allowed", icon: "M11 14c0-3-3-5-5-5s-3 2-3 4" },
  { key: "smoking", label: "Smoking allowed", icon: "M3 12h18v3H3z" },
  { key: "events", label: "Events allowed", icon: "M21 11.5a8.38 8.38 0 0 1-9 8.5" },
];

export const MONTHLY_CHART_DATA = [
  { month: "Dec", bookings: 21, amount: 142 },
  { month: "Jan", bookings: 26, amount: 178 },
  { month: "Feb", bookings: 24, amount: 165 },
  { month: "Mar", bookings: 31, amount: 218 },
  { month: "Apr", bookings: 33, amount: 241 },
  { month: "May", bookings: 38, amount: 287, current: true },
];

export const GUEST_TAGS: Record<string, { c: string; l: string }[]> = {
  "G-1042": [{ c: "repeat", l: "Repeat" }],
  "G-2018": [{ c: "repeat", l: "Repeat" }],
  "G-0892": [],
  "G-1577": [{ c: "vip", l: "VIP" }, { c: "repeat", l: "Repeat" }],
  "G-2204": [],
  "G-0331": [{ c: "new", l: "New" }],
};

export const GUEST_LAST_STAY: Record<string, string> = {
  "G-1042": "2 weeks ago",
  "G-2018": "3 days ago",
  "G-0892": "last month",
  "G-1577": "5 days ago",
  "G-2204": "2 months ago",
  "G-0331": "today",
};
