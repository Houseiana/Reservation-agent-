"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DESTINATIONS,
  INBOX,
  INCOMING_CALLERS,
  MONTHLY_CHART_DATA,
  SITE_URL,
  TODAY_STR,
  HOLD_DURATION_MS,
  type Property,
  type Guest,
  type Booking,
} from "@/data";
import { DICT, type Lang } from "@/i18n";
import { Icon } from "@/components/Icons";
import {
  listBookings,
  listProperties,
  listGuests,
  createBooking,
  confirmBooking as confirmBookingApi,
  createUser,
  searchUsers,
  getProperty,
  getPropertyTypes,
  getAmenities,
  getSortOptions,
  getBookingStatuses,
  getPaymentMethods,
  ApiError,
  type LookupItem,
} from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useSubmitting } from "@/hooks/useSubmitting";
import { useUser, UserButton } from "@clerk/nextjs";

function pName(p: Property, lang: Lang) { return lang === "ar" ? p.nameAr : p.name; }
function pLoc(p: Property, lang: Lang) { return lang === "ar" ? p.locAr : p.loc; }
function pDesc(p: Property, lang: Lang) { return lang === "ar" ? p.descAr : p.desc; }
function pShortName(p: Property, lang: Lang) { return pName(p, lang).split("—")[0].trim(); }

type PageKey = "search" | "bookings" | "guests" | "kpis";
type InboxTab = "all" | "calls" | "whatsapp" | "missed";

interface FiltersState {
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

interface SearchState {
  where: string;
  checkin: string;
  checkout: string;
  guests: number;
  nights: number;
}

interface BookingState {
  step: number;
  guest: Guest | null;
  selectedExtras: Set<string>;
  /** Lookup ID from /reservation-agent-lookup/payment-methods. Null until selected. */
  payment: number | null;
  paymentSent: boolean;
  paymentVerified: boolean;
}

function formatDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function formatDateShort(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function propertyUrl(p: Property) { return `${SITE_URL}/property/${p.id}`; }
function cleanPhone(phone: string) { return phone.replace(/[^\d]/g, ""); }
function fmtTimeLeft(ms: number): string {
  if (ms <= 0) return "0m";
  const m = Math.floor(ms / 60000);
  if (m >= 60) {
    const h = Math.floor(m / 60); const rem = m % 60;
    return `${h}h ${rem}m`;
  }
  if (m >= 1) return `${m}m`;
  return `${Math.max(1, Math.floor(ms / 1000))}s`;
}
function waLink(phone: string, text: string) {
  return `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(text)}`;
}
function waShare(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Build a compact page-number list with ellipsis around the current page.
 * Examples (current=5):
 *   total=4  → [1, 2, 3, 4]
 *   total=10 → [1, 2, 3, 4, 5, 6, 7, "...", 10]
 *   total=34 → [1, "...", 3, 4, 5, 6, 7, "...", 34]
 */
function pageNumbers(current: number, total: number): Array<number | "..."> {
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

export default function Page() {
  const { user } = useUser();
  const adminId = user?.id ?? "";

  const [page, setPage] = useState<PageKey>("search");
  const [search, setSearch] = useState<SearchState>({
    where: "",
    checkin: "",
    checkout: "",
    guests: 0,
    nights: 0,
  });
  const [filters, setFilters] = useState<FiltersState>({
    type: null,
    priceMin: 20,
    priceMax: 200000,
    currency: "EGP",
    bedrooms: 0,
    bathrooms: 0,
    beds: 0,
    capacity: 0,
    areaMin: 0,
    areaMax: 0,
    amenities: new Set<number>(),
    flags: new Set(),
    extras: new Set(),
  });
  const [sort, setSort] = useState<number | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  // Bookings live in Page state so edits/cancels/notes persist across the drawer.
  // Initial load goes through lib/api (mock-backed today, real API once
  // NEXT_PUBLIC_USE_MOCK=false). Mutations still update local state.
  const [bookings, setBookings] = useState<Booking[]>([]);
  // Bookings only load once the user opens the Bookings tab. Avoids a
  // wasted network round-trip on the home/search view.
  const bookingsResult = useAsync(
    (signal) => listBookings({ page: 1, limit: 100 }, signal),
    [],
    { enabled: page === "bookings" },
  );
  useEffect(() => {
    if (bookingsResult.data) setBookings(bookingsResult.data.items);
  }, [bookingsResult.data]);
  const [selectedBookingRef, setSelectedBookingRef] = useState<string | null>(null);
  const selectedBooking = bookings.find((b) => b.ref === selectedBookingRef) ?? null;
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  // Live clock so hold countdowns tick (re-renders every 30s).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  // Helpers shared with drawers/cards
  function activeHoldFor(propertyId: string): Booking | null {
    return bookings.find(
      (b) => b.property.id === propertyId
        && b.status === "pending"
        && !!b.holdUntil
        && new Date(b.holdUntil).getTime() > now
    ) ?? null;
  }
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(["booking"]));
  const [whereDropdown, setWhereDropdown] = useState(false);
  const [rtl, setRtl] = useState(false);
  const lang: Lang = rtl ? "ar" : "en";
  const t = DICT[lang];

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [drawerView, setDrawerView] = useState<"detail" | "booking">("detail");
  // Fetch the full property record (with availability for the selected
  // dates) from /api/reservation-agent/property/{id}. The list response
  // is used as an instant fallback so the drawer never blinks.
  const propertyDetailResult = useAsync(
    (signal) =>
      getProperty(
        selectedProperty!.id,
        { checkin: search.checkin || undefined, checkout: search.checkout || undefined },
        signal,
      ),
    [selectedProperty?.id, search.checkin, search.checkout],
    { enabled: selectedProperty !== null },
  );
  // Use only the data returned by the detail API — never the
  // list-version fallback, because the list payload is missing fields
  // like photos. While the fetch is in flight we render a skeleton.
  const propertyDetail: Property | null =
    propertyDetailResult.data && propertyDetailResult.data.id === selectedProperty?.id
      ? propertyDetailResult.data
      : null;
  // Guests load on the Guests tab and whenever a property drawer is
  // open (the booking flow + quote dialog search guests by name).
  const guestsResult = useAsync(
    (signal) => listGuests({ page: 1, limit: 100 }, signal),
    [],
    { enabled: page === "guests" || selectedProperty !== null },
  );
  const guests = guestsResult.data?.items ?? [];
  const selectedGuest = guests.find((g) => g.id === selectedGuestId) ?? null;
  const [booking, setBooking] = useState<BookingState>({
    step: 1,
    guest: null,
    selectedExtras: new Set(),
    payment: null,
    paymentSent: false,
    paymentVerified: false,
  });
  const [guestSearchQ, setGuestSearchQ] = useState("");
  const [newGuestForm, setNewGuestForm] = useState({ first: "", last: "", email: "", countryCode: "20", phone: "" });
  const [confRef, setConfRef] = useState("");

  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<InboxTab>("all");
  const [callOpen, setCallOpen] = useState(false);
  const [callerIdx, setCallerIdx] = useState(0);

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function toast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  // Seed check-in / check-out with today and tomorrow on first mount so
  // the booking flow always has valid dates, even if the user never opens
  // the date pickers. Runs in a client effect (not in useState init) to
  // avoid SSR hydration mismatches on the date string.
  useEffect(() => {
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    setSearch((s) => {
      if (s.checkin && s.checkout) return s;
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 86_400_000);
      return {
        ...s,
        checkin: s.checkin || fmt(today),
        checkout: s.checkout || fmt(tomorrow),
      };
    });
  }, []);

  useEffect(() => {
    if (search.checkin && search.checkout) {
      const nights = Math.max(0, Math.round((new Date(search.checkout).getTime() - new Date(search.checkin).getTime()) / 86400000));
      if (nights !== search.nights) setSearch((s) => ({ ...s, nights }));
    }
  }, [search.checkin, search.checkout, search.nights]);

  useEffect(() => {
    document.documentElement.lang = rtl ? "ar" : "en";
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("rtl", rtl);
  }, [rtl]);

  // Lookups (property types / amenities / sort) come from
  // /api/reservation-agent-lookup/*. We keep them in state so the page
  // Lookups (property types / amenities / sort / booking statuses) come
  // from /api/reservation-agent-lookup/*. Selections store integer IDs
  // directly so we hand them to the search API with no slug translation.
  const propertyTypesLookup = useAsync((signal) => getPropertyTypes(signal), []);
  const amenitiesLookup = useAsync((signal) => getAmenities(signal), []);
  const sortLookup = useAsync((signal) => getSortOptions(signal), []);
  const bookingStatusesLookup = useAsync((signal) => getBookingStatuses(signal), []);
  const paymentMethodsLookup = useAsync((signal) => getPaymentMethods(signal), []);
  // Seed booking.payment with the first available method once the lookup
  // arrives, so the user lands on Step 2 with a sensible default selected.
  useEffect(() => {
    const first = paymentMethodsLookup.data?.[0];
    if (first && booking.payment === null) {
      setBooking((b) => ({ ...b, payment: first.id }));
    }
  }, [paymentMethodsLookup.data, booking.payment]);

  const amenityIds = useMemo<number[] | undefined>(() => {
    const ids = Array.from(filters.amenities);
    return ids.length ? ids : undefined;
  }, [filters.amenities]);

  const [searchPage, setSearchPage] = useState(1);
  const PAGE_SIZE = 20;
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
  function goToPage(p: number) {
    setSearchPage(p);
    resultsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // Reset to first page whenever filters or the search query change so the
  // user doesn't end up on an empty page N of a freshly-narrowed search.
  useEffect(() => {
    setSearchPage(1);
  }, [
    search.where,
    search.checkin,
    search.checkout,
    search.guests,
    filters.priceMin,
    filters.priceMax,
    filters.bedrooms,
    filters.bathrooms,
    filters.beds,
    filters.areaMin,
    filters.areaMax,
    filters.flags,
    filters.type,
    amenityIds,
    sort,
  ]);

  const searchResult = useAsync(
    (signal) =>
      listProperties(
        {
          location: search.where || undefined,
          checkin: search.checkin || undefined,
          checkout: search.checkout || undefined,
          guests: search.guests || undefined,
          propertyType: filters.type !== null ? [filters.type] : undefined,
          bedrooms: filters.bedrooms || undefined,
          bathrooms: filters.bathrooms || undefined,
          beds: filters.beds || undefined,
          minPrice: filters.priceMin || undefined,
          maxPrice: filters.priceMax || undefined,
          minAreaSize: filters.areaMin || undefined,
          maxAreaSize: filters.areaMax || undefined,
          amenities: amenityIds,
          instantBook: filters.flags.has("instantBook") || undefined,
          sortBy: sort ?? undefined,
          page: searchPage,
          limit: PAGE_SIZE,
        },
        signal,
      ),
    [
      search.where,
      search.checkin,
      search.checkout,
      search.guests,
      filters.priceMin,
      filters.priceMax,
      filters.bedrooms,
      filters.bathrooms,
      filters.beds,
      filters.areaMin,
      filters.areaMax,
      filters.flags,
      filters.type,
      amenityIds,
      sort,
      searchPage,
    ],
  );

  const filtered = searchResult.data?.items ?? [];
  const totalResults = searchResult.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));

  function toggleGroup(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }
  function isCollapsed(name: string) { return collapsedGroups.has(name); }

  function setCounter(k: "bedrooms" | "bathrooms" | "beds" | "capacity", dir: number) {
    setFilters((f) => ({ ...f, [k]: Math.max(0, Math.min(10, f[k] + dir)) }));
  }

  function toggleAmenity(id: number) {
    setFilters((f) => {
      const next = new Set(f.amenities);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...f, amenities: next };
    });
  }

  function toggleFlag(value: string) {
    setFilters((f) => {
      const next = new Set(f.flags);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...f, flags: next };
    });
  }

  function clearFilters() {
    setFilters({
      type: null, priceMin: 0, priceMax: 200000, currency: "EGP",
      bedrooms: 0, bathrooms: 0, beds: 0, capacity: 0,
      areaMin: 30, areaMax: 500,
      amenities: new Set<number>(), flags: new Set(), extras: new Set(),
    });
    toast(t.toast.filtersCleared);
  }

  function openPropertyDrawer(p: Property) {
    setSelectedProperty(p);
    setDrawerView("detail");
    setBooking({
      step: 1, guest: null, selectedExtras: new Set(),
      payment: null, paymentSent: false, paymentVerified: false,
    });
    setGuestSearchQ("");
    setNewGuestForm({ first: "", last: "", email: "", countryCode: "20", phone: "" });
  }
  function closeDrawer() { setSelectedProperty(null); }

  function startBooking() { setDrawerView("booking"); setBooking((b) => ({ ...b, step: 1 })); }

  function toggleFav(id: string) {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast(t.toast.favRemoved); }
      else { next.add(id); toast(t.toast.favSaved); }
      return next;
    });
  }

  function selectExtra(id: string) {
    setBooking((b) => {
      const next = new Set(b.selectedExtras);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...b, selectedExtras: next };
    });
  }

  function selectExistingGuest(g: Guest) {
    setBooking((b) => ({ ...b, guest: g }));
    toast(t.toast.selectedGuest(`${g.first} ${g.last}`));
  }

  useEffect(() => {
    const { first, last, email, countryCode, phone } = newGuestForm;
    if (first && last && email && countryCode && phone) {
      setBooking((b) => ({
        ...b,
        guest: { id: "G-NEW", first, last, email, phone, nat: countryCode, bookings: 0, ltv: "—", isNew: true },
      }));
    }
  }, [newGuestForm]);

  // Two-phase booking: POST /bookings fires in the background when the
  // user leaves Step 1 (guest selected); POST /booking/confirm fires when
  // the user finalizes the booking in Step 2. The draft is keyed on the
  // guest id so changing guest mid-flow correctly creates a fresh draft.
  const [bookingDraft, setBookingDraft] = useState<{ id: string; ref: string; guestId: string } | null>(null);
  const draftInFlightRef = useRef(false);

  function describeError(e: unknown, fallback: string): string {
    if (e instanceof ApiError) return `${e.status ? `${e.status} · ` : ""}${e.message}`;
    return (e as Error).message || fallback;
  }

  async function ensureBookingDraft(explicitGuest?: Guest): Promise<string | null> {
    // The explicit argument lets callers pass a freshly-created guest before
    // setBooking has propagated to a re-render (otherwise booking.guest is stale).
    const guest = explicitGuest ?? booking.guest;
    if (!propertyDetail || !guest) return null;
    // Guard against empty/invalid dates from the search bar — without this,
    // `new Date("").toISOString()` below throws "Invalid time value".
    const checkInMs = search.checkin ? new Date(search.checkin).getTime() : NaN;
    const checkOutMs = search.checkout ? new Date(search.checkout).getTime() : NaN;
    if (!Number.isFinite(checkInMs) || !Number.isFinite(checkOutMs)) {
      toast("Please pick check-in and check-out dates first");
      return null;
    }
    if (bookingDraft && bookingDraft.guestId === guest.id) return bookingDraft.id;
    if (draftInFlightRef.current) return null;
    draftInFlightRef.current = true;
    try {
      const created = await createBooking({
        input: {
          propertyId: propertyDetail.id,
          guestId: guest.id,
          checkIn: new Date(search.checkin).toISOString(),
          checkOut: new Date(search.checkout).toISOString(),
          guests: search.guests,
          adminId,
        },
        property: propertyDetail,
        guest,
        total: totals?.total ?? 0,
        totalDisplay: `${propertyDetail.currency} ${(totals?.total ?? 0).toLocaleString()}`,
        pending: true,
      });
      const id = created.id ?? created.ref;
      setBookingDraft({ id, ref: created.ref ?? "", guestId: guest.id });
      return id;
    } catch (e) {
      toast(describeError(e, "Failed to start booking"));
      return null;
    } finally {
      draftInFlightRef.current = false;
    }
  }

  async function goStep(s: number, explicitGuest?: Guest) {
    if (s < 1 || s > 3) return;
    const guest = explicitGuest ?? booking.guest;
    if (s === 2 && booking.step === 1 && !guest) { toast(t.toast.selectGuestFirst); return; }
    // Entering Step 2 from Step 1: create the draft FIRST and block the
    // transition if the API call fails. The user stays on Step 1 with a
    // toast and can fix their input / retry.
    if (s === 2 && booking.step === 1 && guest) {
      const id = await ensureBookingDraft(guest);
      if (!id) return;
    }
    setBooking((b) => ({ ...b, step: s }));
  }

  async function confirmBooking(asPending: boolean = false) {
    if (!propertyDetail || !booking.guest || !totals) return;
    try {
      const bookingId = await ensureBookingDraft();
      if (!bookingId) return;
      if (asPending) {
        // The draft already exists on the server; no /confirm call needed.
        // Prefer the human-readable booking code (R-XXXX) over the UUID.
        setConfRef(bookingDraft?.ref || bookingId);
        setBooking((b) => ({ ...b, step: 3 }));
        toast(t.booking.savedAsPendingToast);
        return;
      }
      if (booking.payment === null) {
        toast("Select a payment method");
        return;
      }
      const confirmed = await confirmBookingApi({
        input: {
          bookingId,
          paymentMethod: booking.payment,
          adminId,
        },
        property: propertyDetail,
        guest: booking.guest,
        total: totals.total,
        totalDisplay: `${propertyDetail.currency} ${totals.total.toLocaleString()}`,
      });
      setBookings((prev) => [confirmed, ...prev]);
      // Prefer the human-readable booking code (R-XXXX) — the UUID is
      // shown only as a last resort if neither response carries a code.
      setConfRef(confirmed.ref || bookingDraft?.ref || bookingId);
      setBooking((b) => ({ ...b, step: 3 }));
      toast(t.toast.bookingConfirmed);
    } catch (e) {
      toast(describeError(e, "Failed to confirm booking"));
    }
  }

  function simulateIncomingCall() {
    setCallerIdx((i) => i + 1);
    setCallOpen(true);
    setInboxOpen(false);
  }
  const caller = INCOMING_CALLERS[callerIdx % INCOMING_CALLERS.length];

  function acceptCall() { setCallOpen(false); toast(t.toast.callAccepted); }
  function declineCall() { setCallOpen(false); toast(t.toast.callDeclined); }

  const inboxItems = useMemo(() => {
    if (inboxTab === "calls") return INBOX.filter((x) => x.type === "call" || x.type === "missed");
    if (inboxTab === "whatsapp") return INBOX.filter((x) => x.type === "wa");
    if (inboxTab === "missed") return INBOX.filter((x) => x.type === "missed");
    return INBOX;
  }, [inboxTab]);

  // Booking totals
  const totals = useMemo(() => {
    if (!propertyDetail) return null;
    const p = propertyDetail;
    const nights = Math.max(1, search.nights);
    const subtotal = p.price * nights;
    const cleaning = p.fees.cleaning;
    const utilities = p.fees.utilities;
    const bookingFee = Math.round((subtotal * p.fees.bookingFeePct) / 100);
    const extrasTotal = Array.from(booking.selectedExtras).reduce((sum, id) => {
      const e = p.extras.find((x) => x.id === id);
      if (!e) return sum;
      if (e.unit.includes("per day") || e.unit.includes("per night")) return sum + e.price * nights;
      if (e.unit.includes("per person/day")) return sum + e.price * nights * search.guests;
      return sum + e.price;
    }, 0);
    const total = subtotal + cleaning + utilities + bookingFee + extrasTotal;
    const commission = Math.round(total * 0.05);
    return { subtotal, cleaning, utilities, bookingFee, extrasTotal, total, commission };
  }, [propertyDetail, search.nights, search.guests, booking.selectedExtras]);

  // Live results from /api/reservation-agent/users?query=… The debounce
  // avoids firing a request on every keystroke.
  const [guestMatches, setGuestMatches] = useState<Guest[]>([]);
  useEffect(() => {
    const q = guestSearchQ.trim();
    if (!q) { setGuestMatches([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      searchUsers(q, ctrl.signal)
        .then((rows) => setGuestMatches(rows))
        .catch((err: Error) => { if (err.name !== "AbortError") setGuestMatches([]); });
    }, 250);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [guestSearchQ]);

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} simulateCall={simulateIncomingCall} t={t} />
      <main className="main">
        {page === "search" && (
          <Topbar
            search={search}
            setSearch={setSearch}
            whereDropdown={whereDropdown}
            setWhereDropdown={setWhereDropdown}
            rtl={rtl}
            setRtl={setRtl}
            openInbox={(tab) => { setInboxOpen(true); setInboxTab(tab); }}
            onSearch={() => toast(t.toast.searchUpdated)}
            t={t}
            lang={lang}
          />
        )}
        <div className="content">
          <section className={`page ${page === "search" ? "active" : ""}`} id="page-search">
            <Filters
              filters={filters}
              setFilters={setFilters}
              clearFilters={clearFilters}
              toggleGroup={toggleGroup}
              isCollapsed={isCollapsed}
              setCounter={setCounter}
              toggleAmenity={toggleAmenity}
              toggleFlag={toggleFlag}
              propertyTypes={propertyTypesLookup.data ?? []}
              amenities={amenitiesLookup.data ?? []}
              t={t}
            />
            <div className="results">
              <div className="results-head" ref={resultsTopRef}>
                <div>
                  <div className="results-title">{search.where ? t.results.staysIn(search.where) : t.results.all}</div>
                  <div className="results-meta">
                    {t.results.meta(totalResults || filtered.length, `${formatDateShort(search.checkin)} → ${formatDateShort(search.checkout)}`, search.guests)}
                  </div>
                </div>
                <div className="results-tools">
                  <select
                    className="sort-select"
                    value={sort ?? ""}
                    onChange={(e) => setSort(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                  >
                    <option value="">{t.results.sortRecommended}</option>
                    {(sortLookup.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <div className="view-toggle">
                    <button className="view-btn active" title="Grid"><Icon.Grid /></button>
                    <button className="view-btn" title="List"><Icon.List /></button>
                  </div>
                </div>
              </div>
              {searchResult.loading && filtered.length === 0 ? (
                <div className="property-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="property-card-skel" key={i}>
                      <div className="pd-skel img" />
                      <div className="body">
                        <div className="pd-skel line long" />
                        <div className="pd-skel line medium" />
                        <div className="pd-skel line short" style={{ marginBottom: 0 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
                  <Icon.Search size={44} style={{ marginBottom: 12, strokeWidth: 1.5 }} />
                  <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>{t.results.noResults}</div>
                  <div style={{ fontSize: 13 }}>{t.results.tryRemoving}</div>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={clearFilters}>{t.results.clearFilters}</button>
                </div>
              ) : (
                <div className="property-grid">
                  {filtered.map((p) => {
                    const hold = activeHoldFor(p.id);
                    const holdMsLeft = hold && hold.holdUntil ? Math.max(0, new Date(hold.holdUntil).getTime() - now) : 0;
                    return (
                      <PropertyCard
                        key={p.id}
                        p={p}
                        isFav={favs.has(p.id)}
                        onFav={() => toggleFav(p.id)}
                        onOpen={() => openPropertyDrawer(p)}
                        t={t}
                        lang={lang}
                        holdMsLeft={holdMsLeft}
                      />
                    );
                  })}
                </div>
              )}
              {totalPages > 1 && (
                <div className="pagination" aria-label="Property search pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => goToPage(Math.max(1, searchPage - 1))}
                    disabled={searchPage === 1 || searchResult.loading}
                    aria-label="Previous page"
                  >←</button>
                  {pageNumbers(searchPage, totalPages).map((p, i) =>
                    p === "..." ? (
                      <span key={`gap-${i}`} className="pagination-ellipsis">…</span>
                    ) : (
                      <button
                        key={p}
                        className={`pagination-btn ${p === searchPage ? "active" : ""}`}
                        onClick={() => p !== searchPage && goToPage(p)}
                        disabled={searchResult.loading}
                        aria-current={p === searchPage ? "page" : undefined}
                      >{p}</button>
                    )
                  )}
                  <button
                    className="pagination-btn"
                    onClick={() => goToPage(Math.min(totalPages, searchPage + 1))}
                    disabled={searchPage === totalPages || searchResult.loading}
                    aria-label="Next page"
                  >→</button>
                </div>
              )}
            </div>
          </section>

          <section className={`page ${page === "bookings" ? "active" : ""}`} id="page-bookings" style={{ padding: 24, flexDirection: "column", overflowY: "auto", height: "100%", flex: 1, minHeight: 0 }}>
            <BookingsPage
              goToSearch={() => setPage("search")}
              t={t}
              lang={lang}
              bookings={bookings}
              loading={bookingsResult.loading}
              bookingStatuses={bookingStatusesLookup.data ?? []}
              onOpenBooking={(ref) => setSelectedBookingRef(ref)}
            />
          </section>

          <section className={`page ${page === "kpis" ? "active" : ""}`} id="page-kpis" style={{ padding: 24, flexDirection: "column", overflowY: "auto", height: "100%", flex: 1, minHeight: 0 }}>
            <KpisPage t={t} />
          </section>

          <section className={`page ${page === "guests" ? "active" : ""}`} id="page-guests" style={{ padding: 24, flexDirection: "column", overflowY: "auto", height: "100%", flex: 1, minHeight: 0 }}>
            <GuestsPage t={t} guests={guests} loading={guestsResult.loading} onOpenGuest={(id) => setSelectedGuestId(id)} />
          </section>
        </div>
      </main>

      {/* DRAWER */}
      <div className={`drawer-overlay ${selectedProperty ? "show" : ""}`} onClick={closeDrawer} />
      <div className={`drawer ${selectedProperty ? "show" : ""}`}>
        <div className="drawer-head">
          <button className="drawer-close" onClick={closeDrawer}><Icon.X /></button>
          <div className="drawer-title">
            {drawerView === "detail" ? t.detail.title : propertyDetail ? t.booking.bookHeading(pShortName(propertyDetail, lang)) : ""}
          </div>
          <div className="drawer-share">
            <button className="icon-btn" title={t.common.share}><Icon.Share /></button>
            <button className="icon-btn" title={t.common.save}><Icon.Heart size={16} /></button>
          </div>
        </div>
        <div className="drawer-body">
          {selectedProperty && !propertyDetail && <PropertyDetailSkeleton />}
          {propertyDetail && drawerView === "detail" && (
            <PropertyDetail p={propertyDetail} nights={Math.max(1, search.nights)} toast={toast} t={t} lang={lang} search={search} guests={guests} />
          )}
          {propertyDetail && drawerView === "booking" && (
            <BookingFlow
              p={propertyDetail}
              booking={booking}
              setBooking={setBooking}
              search={search}
              guestSearchQ={guestSearchQ}
              setGuestSearchQ={setGuestSearchQ}
              guestMatches={guestMatches}
              selectExistingGuest={selectExistingGuest}
              newGuestForm={newGuestForm}
              setNewGuestForm={setNewGuestForm}
              selectExtra={selectExtra}
              totals={totals!}
              goStep={goStep}
              confirmBooking={confirmBooking}
              confRef={confRef}
              closeDrawer={closeDrawer}
              paymentMethods={paymentMethodsLookup.data ?? []}
              t={t}
              lang={lang}
              toast={toast}
            />
          )}
        </div>
        {propertyDetail && drawerView === "detail" && totals && (
          <div className="drawer-foot" style={{ display: "flex" }}>
            <div className="drawer-foot-price">
              <b>{propertyDetail.currency} {totals.total.toLocaleString()}</b>
              <span>{t.detail.nightsTotal}</span>
              <small>{t.detail.inclusive(propertyDetail.currency, propertyDetail.price.toLocaleString(), Math.max(1, search.nights))}</small>
            </div>
            <button className="btn btn-primary btn-lg" onClick={startBooking}>{t.common.continueBooking}</button>
          </div>
        )}
      </div>

      {/* BOOKING DETAIL DRAWER */}
      <div className={`drawer-overlay ${selectedBooking ? "show" : ""}`} onClick={() => setSelectedBookingRef(null)} />
      <div className={`drawer ${selectedBooking ? "show" : ""}`}>
        {selectedBooking && (
          <BookingDetailDrawer
            booking={selectedBooking}
            setBookings={setBookings}
            close={() => setSelectedBookingRef(null)}
            t={t}
            lang={lang}
            toast={toast}
            now={now}
          />
        )}
      </div>

      {/* GUEST DETAIL DRAWER */}
      <div className={`drawer-overlay ${selectedGuest ? "show" : ""}`} onClick={() => setSelectedGuestId(null)} />
      <div className={`drawer ${selectedGuest ? "show" : ""}`}>
        {selectedGuest && (
          <GuestDetailDrawer
            guest={selectedGuest}
            bookings={bookings}
            setBookings={setBookings}
            close={() => setSelectedGuestId(null)}
            openBooking={(ref) => { setSelectedGuestId(null); setSelectedBookingRef(ref); }}
            t={t}
            lang={lang}
            toast={toast}
          />
        )}
      </div>

      {/* INBOX */}
      <div className={`drawer-overlay ${inboxOpen ? "show" : ""}`} onClick={() => setInboxOpen(false)} />
      <div className={`inbox-panel ${inboxOpen ? "show" : ""}`}>
        <div className="drawer-head">
          <button className="drawer-close" onClick={() => setInboxOpen(false)}><Icon.X /></button>
          <div className="drawer-title">{t.inbox.title}</div>
          <button className="btn btn-secondary btn-sm" onClick={simulateIncomingCall}>
            <Icon.Play /> {t.inbox.demoCall}
          </button>
        </div>
        <div className="inbox-tabs">
          {(["all", "calls", "whatsapp", "missed"] as InboxTab[]).map((tab) => (
            <button key={tab} className={`inbox-tab ${inboxTab === tab ? "active" : ""}`} onClick={() => setInboxTab(tab)}>
              {t.inbox.tabs[tab]}{" "}
              <span style={tab === "missed" ? { background: "var(--red)", color: "#fff" } : undefined}>
                {tab === "all" ? 9 : tab === "calls" ? 4 : tab === "whatsapp" ? 5 : 2}
              </span>
            </button>
          ))}
        </div>
        <div className="inbox-list">
          {inboxItems.map((i) => (
            <div key={i.id} className={`inbox-row ${i.unread ? "unread" : ""}`}>
              <div className={`inbox-avatar ${i.knownGuest ? "" : "unknown"}`}>
                {i.avatar}
                <span className={`inbox-channel-badge ${i.type === "wa" ? "wa" : i.type === "missed" ? "missed" : "call"}`}>
                  {i.type === "wa" && <Icon.WhatsApp size={9} style={{ color: "#fff" }} />}
                  {i.type === "missed" && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /></svg>
                  )}
                  {i.type === "call" && <Icon.Phone size={9} style={{ color: "#fff" }} />}
                </span>
              </div>
              <div className="inbox-info">
                <div className="inbox-row-top">
                  <div className="inbox-name">
                    {i.from}{" "}
                    {!i.knownGuest && (
                      <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 400 }}>{i.phone}</span>
                    )}
                  </div>
                  <div className="inbox-time">{i.time}</div>
                </div>
                <div className="inbox-preview">{i.preview}</div>
                <div className="inbox-meta">
                  <span className={`inbox-status ${i.status}`}>{t.inbox.statuses[i.status]}</span>
                  {i.duration && <span className="inbox-duration">⏱ {i.duration}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--line)", padding: "14px 18px", background: "var(--ghost)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10 }}>
            {t.inbox.connectedChannels}
          </div>
          <div className="channel-item">
            <div className="channel-icon" style={{ background: "#25D366" }}><Icon.WhatsApp size={14} style={{ color: "#fff" }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.inbox.waBusiness}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.inbox.waMeta}</div>
            </div>
            <span className="ch-status">{t.inbox.live}</span>
          </div>
          <div className="channel-item">
            <div className="channel-icon" style={{ background: "var(--charcoal)" }}><Icon.Phone size={14} style={{ color: "#fff" }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.inbox.voice}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.inbox.voiceMeta}</div>
            </div>
            <span className="ch-status">{t.inbox.live}</span>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ width: "100%", marginTop: 10, justifyContent: "center" }}>{t.inbox.addChannel}</button>
        </div>
      </div>

      {/* INCOMING CALL */}
      <div className={`call-overlay ${callOpen ? "show" : ""}`} onClick={declineCall} />
      <div className={`call-modal ${callOpen ? "show" : ""}`}>
        <div className={`call-channel ${caller.channel === "wa" ? "whatsapp" : ""}`}>
          <Icon.Phone size={13} />
          <span>{caller.channel === "wa" ? t.call.waInc : t.call.voiceInc}</span>
        </div>
        <div className="call-avatar-wrap">
          <div className="call-pulse" />
          <div className="call-pulse" style={{ animationDelay: ".7s" }} />
          <div
            className="call-avatar"
            style={
              caller.avatar === "?"
                ? { background: "var(--ghost)", color: "var(--muted)" }
                : undefined
            }
          >
            {caller.avatar}
          </div>
        </div>
        <div className="call-name">{caller.name}</div>
        <div className="call-phone">{caller.phone}</div>
        <div className="call-meta"><span className="call-tag">{caller.tag}</span></div>
        <div className="call-context">
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6, fontWeight: 500 }}>{t.call.context}</div>
          <div
            style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}
            dangerouslySetInnerHTML={{ __html: caller.context }}
          />
        </div>
        <div className="call-actions">
          <button className="call-btn decline" onClick={declineCall} title={t.call.decline}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: "rotate(135deg)" }}>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button className="call-btn accept" onClick={acceptCall} title={t.call.accept}>
            <Icon.Phone size={22} />
          </button>
        </div>
        <div className="call-actions-labels"><span>{t.call.decline}</span><span>{t.call.accept}</span></div>
      </div>

      {/* TOAST */}
      <div className={`toast ${toastVisible ? "show" : ""}`}>
        <div className="toast-ico"><Icon.Check /></div>
        <span>{toastMsg}</span>
      </div>

      {/* Where dropdown - mounted above topbar via portal-ish absolute */}
      {whereDropdown && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 25 }}
          onClick={() => setWhereDropdown(false)}
        />
      )}
    </div>
  );
}

/* ============================================================
   SIGNED-IN AGENT CARD
============================================================ */
function SignedInAgentCard({ t }: { t: typeof DICT["en"] }) {
  const { user, isLoaded } = useUser();
  const name = user?.fullName
    ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ")
    ?? user?.username
    ?? user?.primaryEmailAddress?.emailAddress
    ?? "—";
  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  return (
    <div className="agent-card">
      <div className="agent-avatar">{initials || name.slice(0, 2).toUpperCase()}</div>
      <div className="agent-info">
        <div className="agent-name">{isLoaded ? name : "…"}</div>
        <div className="agent-role">{t.nav.role}</div>
      </div>
      <UserButton afterSignOutUrl="/sign-in" />
    </div>
  );
}

/* ============================================================
   SIDEBAR
============================================================ */
function Sidebar({
  page,
  setPage,
  simulateCall,
  t,
}: {
  page: PageKey;
  setPage: (p: PageKey) => void;
  simulateCall: () => void;
  t: typeof DICT["en"];
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">H</div>
        <div>
          <div className="brand-name">Houseiana</div>
          <div className="brand-sub">{t.kpis.subtitle.includes("·") ? "Agent Console" : "Agent Console"}</div>
        </div>
      </div>
      <SignedInAgentCard t={t} />
      <div style={{ margin: "0 14px 6px", display: "flex", gap: 6 }}>
        <div className="ch-pill" title="WhatsApp Business connected">
          <Icon.WhatsApp size={11} />
          {t.nav.waPill}
          <span className="ch-dot" />
        </div>
        <div className="ch-pill" title="Voice line connected">
          <Icon.Phone size={11} />
          {t.nav.callPill}
          <span className="ch-dot" />
        </div>
        <button
          className="ch-pill"
          style={{ cursor: "pointer", background: "var(--yellow)", color: "var(--charcoal)", borderColor: "var(--yellow)", fontWeight: 600 }}
          onClick={simulateCall}
          title="Simulate incoming call"
        >
          <Icon.Play size={10} />
          {t.nav.demoPill}
        </button>
      </div>
      <nav className="nav">
        <div className="nav-section">{t.nav.workspace}</div>
        <button className={`nav-item ${page === "search" ? "active" : ""}`} onClick={() => setPage("search")}>
          <Icon.Search className="nav-icon" />
          {t.nav.search}
        </button>
        <button className={`nav-item ${page === "bookings" ? "active" : ""}`} onClick={() => setPage("bookings")}>
          <Icon.Calendar className="nav-icon" />
          {t.nav.bookings} <span className="nav-badge">42</span>
        </button>
        <button className={`nav-item ${page === "guests" ? "active" : ""}`} onClick={() => setPage("guests")}>
          <Icon.Users className="nav-icon" />
          {t.nav.guests}
        </button>
        {/* Temporarily hidden — KPIs page WIP
        <button className={`nav-item ${page === "kpis" ? "active" : ""}`} onClick={() => setPage("kpis")}>
          <Icon.Chart className="nav-icon" />
          {t.nav.kpis}
        </button>
        */}
      </nav>
      <div className="sidebar-foot">v2.4.1 · © Houseiana 2026</div>
    </aside>
  );
}

/* ============================================================
   TOPBAR
============================================================ */
function Topbar({
  search,
  setSearch,
  whereDropdown,
  setWhereDropdown,
  rtl,
  setRtl,
  openInbox,
  onSearch,
  t,
  lang,
}: {
  search: SearchState;
  setSearch: React.Dispatch<React.SetStateAction<SearchState>>;
  whereDropdown: boolean;
  setWhereDropdown: (b: boolean) => void;
  rtl: boolean;
  setRtl: (b: boolean) => void;
  openInbox: (tab: InboxTab) => void;
  onSearch: () => void;
  t: typeof DICT["en"];
  lang: Lang;
}) {
  const [guestsDropdown, setGuestsDropdown] = useState(false);
  function adjustGuests(delta: number) {
    setSearch((s) => ({ ...s, guests: Math.max(0, Math.min(20, s.guests + delta)) }));
  }
  return (
    <div className="topbar">
      <div className="search-pill" style={{ position: "relative" }}>
        <div className="search-field" id="whereField">
          <div className="search-field-label">{t.topbar.where}</div>
          <input
            type="text"
            className="search-field-input"
            placeholder={t.topbar.searchPlaceholder}
            autoComplete="off"
            value={search.where}
            onFocus={() => setWhereDropdown(true)}
            onChange={(e) => setSearch((s) => ({ ...s, where: e.target.value }))}
          />
          {whereDropdown && (
            <div className="search-dropdown show" onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".6px", padding: "6px 11px 8px" }}>
                {t.topbar.suggested}
              </div>
              {DESTINATIONS.map((d) => {
                const name = lang === "ar" ? d.nameAr : d.name;
                const meta = lang === "ar" ? d.metaAr : d.meta;
                return (
                  <div
                    key={d.name}
                    className="search-suggest"
                    onClick={() => {
                      setSearch((s) => ({ ...s, where: name }));
                      setWhereDropdown(false);
                      onSearch();
                    }}
                  >
                    <div className="search-suggest-icon"><Icon.MapPin size={14} /></div>
                    <div>
                      <div className="search-suggest-name">{name}</div>
                      <div className="search-suggest-meta">{meta}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="search-field">
          <div className="search-field-label">{t.topbar.checkin}</div>
          <input
            type="date"
            className="search-field-input"
            value={search.checkin}
            onChange={(e) => setSearch((s) => ({ ...s, checkin: e.target.value }))}
          />
        </div>
        <div className="search-field">
          <div className="search-field-label">{t.topbar.checkout}</div>
          <input
            type="date"
            className="search-field-input"
            value={search.checkout}
            onChange={(e) => setSearch((s) => ({ ...s, checkout: e.target.value }))}
          />
        </div>
        <div className="search-field" style={{ position: "relative" }}>
          <div className="search-field-label">{t.topbar.who}</div>
          <input
            type="text"
            className="search-field-input"
            placeholder={t.topbar.whoPlaceholder}
            readOnly
            style={{ cursor: "pointer" }}
            value={search.guests > 0 ? t.topbar.addGuests(search.guests) : ""}
            onClick={() => setGuestsDropdown((v) => !v)}
          />
          {guestsDropdown && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 24 }}
                onClick={() => setGuestsDropdown(false)}
              />
              <div
                className="search-dropdown show"
                style={{ minWidth: 240, padding: 14, zIndex: 26 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="counter-row">
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{t.topbar.who}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {t.topbar.whoPlaceholder}
                    </div>
                  </div>
                  <div className="counter-controls">
                    <button
                      type="button"
                      className="counter-btn"
                      onClick={() => adjustGuests(-1)}
                      disabled={search.guests <= 0}
                    >−</button>
                    <span className="counter-val">{search.guests}</span>
                    <button
                      type="button"
                      className="counter-btn"
                      onClick={() => adjustGuests(1)}
                      disabled={search.guests >= 20}
                    >+</button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <button className="search-go" onClick={onSearch} title={t.results.sortRecommended}>
          <Icon.Search size={16} style={{ strokeWidth: 2.5 }} />
        </button>
      </div>
      <div className="topbar-right">
        <button className="lang-btn" onClick={() => setRtl(!rtl)}>{rtl ? "English" : "العربية"}</button>
        <button className="icon-btn" title={t.inbox.tabs.calls} onClick={() => openInbox("calls")}>
          <Icon.Phone />
          <span className="dot" style={{ background: "var(--orange)" }} />
        </button>
        <button className="icon-btn" title={t.inbox.tabs.whatsapp} onClick={() => openInbox("whatsapp")}>
          <Icon.WhatsApp style={{ color: "#25D366" }} />
          <span className="badge-num">3</span>
        </button>
        <button className="icon-btn" title={t.inbox.title} onClick={() => openInbox("all")}>
          <Icon.Bell />
          <span className="dot" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   FILTERS
============================================================ */
function Filters({
  filters,
  setFilters,
  clearFilters,
  toggleGroup,
  isCollapsed,
  setCounter,
  toggleAmenity,
  toggleFlag,
  propertyTypes,
  amenities,
  t,
}: {
  filters: FiltersState;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  clearFilters: () => void;
  toggleGroup: (n: string) => void;
  isCollapsed: (n: string) => boolean;
  setCounter: (k: "bedrooms" | "bathrooms" | "beds" | "capacity", dir: number) => void;
  toggleAmenity: (id: number) => void;
  toggleFlag: (v: string) => void;
  propertyTypes: LookupItem[];
  amenities: LookupItem[];
  t: typeof DICT["en"];
}) {
  const counterLabel = {
    bedrooms: t.filters.bedrooms, bathrooms: t.filters.bathrooms, beds: t.filters.beds, capacity: t.filters.capacity,
  };
  const cnt = (k: "bedrooms" | "bathrooms" | "beds" | "capacity") => {
    const v = filters[k];
    return v === 0 ? t.common.any : v + (v >= 10 ? "+" : "");
  };

  return (
    <aside className="filters">
      <div className="filters-head">
        <div className="filters-title"><Icon.Filter /> {t.filters.title}</div>
        <button className="filters-clear" onClick={clearFilters}>{t.filters.clearAll}</button>
      </div>

      <div className={`filter-group ${isCollapsed("price") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("price")}>
          <span>{t.filters.price}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          <div className="price-range">
            <input
              type="number"
              className="price-input"
              placeholder={t.filters.min}
              value={filters.priceMin}
              onChange={(e) => setFilters((f) => ({ ...f, priceMin: parseInt(e.target.value) || 0 }))}
            />
            <span className="price-dash">—</span>
            <input
              type="number"
              className="price-input"
              placeholder={t.filters.max}
              value={filters.priceMax}
              onChange={(e) => setFilters((f) => ({ ...f, priceMax: parseInt(e.target.value) || 200000 }))}
            />
          </div>
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("type") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("type")}>
          <span>{t.filters.type}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          <div className="type-grid">
            <button
              className={`type-pill ${filters.type === null ? "active" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, type: null }))}
            >
              {t.filters.types.all}
            </button>
            {propertyTypes.map((opt) => (
              <button
                key={opt.id}
                className={`type-pill ${filters.type === opt.id ? "active" : ""}`}
                onClick={() => setFilters((f) => ({ ...f, type: opt.id }))}
              >
                {opt.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("rooms") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("rooms")}>
          <span>{t.filters.rooms}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          {(["bedrooms", "bathrooms", "beds", "capacity"] as const).map((k) => (
            <div className="counter-row" key={k}>
              <span>{counterLabel[k]}</span>
              <div className="counter-controls">
                <button className="counter-btn" onClick={() => setCounter(k, -1)}>−</button>
                <span className="counter-val">{cnt(k)}</span>
                <button className="counter-btn" onClick={() => setCounter(k, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("area") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("area")}>
          <span>{t.filters.area}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          <div className="area-display"><b>{filters.areaMin}</b> m² — <b>{filters.areaMax}</b> m²</div>
          <input
            type="range"
            min={30}
            max={500}
            step={10}
            value={filters.areaMax}
            onChange={(e) => setFilters((f) => ({ ...f, areaMax: parseInt(e.target.value) }))}
          />
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("amenities") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("amenities")}>
          <span>{t.filters.essentials}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          {amenities.map((a) => (
            <label className="check-row" key={a.id}>
              <input
                type="checkbox"
                checked={filters.amenities.has(a.id)}
                onChange={() => toggleAmenity(a.id)}
              />
              <span className="check-box"><Icon.Check /></span>
              {a.name}
            </label>
          ))}
        </div>
      </div>

      <div className={`filter-group ${isCollapsed("booking") ? "collapsed" : ""}`}>
        <div className="filter-group-head" onClick={() => toggleGroup("booking")}>
          <span>{t.filters.bookingOpts}</span><Icon.ChevronDown />
        </div>
        <div className="filter-group-body">
          {(["instantBook"] as const).map((f) => (
            <label className="check-row" key={f}>
              <input
                type="checkbox"
                checked={filters.flags.has(f)}
                onChange={() => toggleFlag(f)}
              />
              <span className="check-box"><Icon.Check /></span>
              {t.filters.flags[f]}
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   PROPERTY CARD
============================================================ */
function PropertyCard({
  p,
  isFav,
  onFav,
  onOpen,
  t,
  lang,
  holdMsLeft,
}: {
  p: Property;
  isFav: boolean;
  onFav: () => void;
  onOpen: () => void;
  t: typeof DICT["en"];
  lang: Lang;
  holdMsLeft: number; // 0 = no hold
}) {
  const chips: { id: string; label: string }[] = [
    p.amenities.ac ? { id: "ac", label: t.amenities.ac } : null!,
    p.amenities.kitchen ? { id: "kitchen", label: t.amenities.kitchen } : null!,
    p.amenities.pool ? { id: "pool", label: t.amenities.pool } : null!,
    p.amenities.beachAccess ? { id: "beachAccess", label: t.amenities.beachAccess } : null!,
    p.amenities.parking ? { id: "parking", label: t.amenities.parking } : null!,
    p.amenities.gym ? { id: "gym", label: t.amenities.gym } : null!,
  ].filter(Boolean).slice(0, 4);
  const onHold = holdMsLeft > 0;

  return (
    <div className={`property ${p.country}`} onClick={onOpen}>
      <div className="property-img">
        {p.coverPhoto && (
          <img className="property-img-cover" src={p.coverPhoto} alt={pName(p, lang)} />
        )}
        <span className="property-tag">{p.tier === "luxury" ? t.common.luxury : t.common.standard}</span>
        <span
          className={`property-fav ${isFav ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onFav(); }}
        >
          <Icon.Heart size={13} />
        </span>
        {onHold && (
          <div className="property-hold">
            <div>
              <div className="property-hold-badge">⏱ {t.common.onHold}</div>
              <div className="property-hold-time">{fmtTimeLeft(holdMsLeft)}</div>
            </div>
          </div>
        )}
        {p.instantBook && (
          <span className="property-instant"><Icon.Bolt /> {t.common.instantBook}</span>
        )}
        <div style={{ fontSize: 11, fontWeight: 500 }}>{t.common.egypt}</div>
      </div>
      <div className="property-body">
        <div className="property-loc"><Icon.MapPin /> {pLoc(p, lang)}</div>
        <div className="property-name">{pName(p, lang)}</div>
        <div className="property-meta">
          <span><Icon.Bed /> {t.card.br(p.bedrooms)}</span>
          <span><Icon.Bath /> {t.card.bath(p.bathrooms)}</span>
          <span><Icon.Person /> {p.capacity}</span>
          <span><Icon.Area /> {p.area} m²</span>
        </div>
        <div className="property-amenities">
          {chips.map((c) => (
            <span className="amenity-chip" key={c.id}>{c.label}</span>
          ))}
        </div>
        <div className="property-foot">
          <div className="property-price">
            <b>{p.currency} {p.price.toLocaleString()}</b>
            <span>{t.card.perNight}</span>
          </div>
          <div className="property-rating">
            <Icon.Star style={{ color: "var(--yellow-deep)" }} /> {p.rating} <span style={{ color: "var(--muted)" }}>({p.reviews})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PROPERTY DETAIL
============================================================ */
function PropertyDetailSkeleton() {
  return (
    <>
      <div className="pd-skel hero" />
      <div className="pd-section">
        <div className="pd-skel line medium" />
        <div className="pd-skel line short" />
        <div className="pd-skel line long" style={{ marginTop: 14 }} />
      </div>
      <div className="pd-section">
        <div className="pd-skel line long" />
        <div className="pd-skel line long" />
        <div className="pd-skel line medium" />
      </div>
      <div className="pd-section">
        <div className="pd-skel line short" />
        <div className="pd-skel line medium" />
      </div>
    </>
  );
}

function PropertyDetail({
  p, nights, toast, t, lang, search, guests,
}: {
  p: Property; nights: number; toast: (msg: string) => void; t: typeof DICT["en"]; lang: Lang;
  search: SearchState;
  guests: Guest[];
}) {
  const url = propertyUrl(p);
  const shareText = t.detail.shareMsg(pName(p, lang), pLoc(p, lang), p.currency, p.price.toLocaleString(), url);
  const ownerInitials = p.owner.name.split(" ").map((s) => s[0]).slice(0, 2).join("");
  const ownerFirst = p.owner.name.split(" ")[0];
  const ownerMessage = t.detail.waMsg(ownerFirst, pName(p, lang));

  const photos = p.photos ?? [];
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  useEffect(() => { setActivePhotoIdx(0); }, [p.id]);
  const activePhoto = photos[activePhotoIdx] ?? photos[0];
  const thumbsRef = useRef<HTMLDivElement | null>(null);
  // Keep the active thumbnail in view when the user pages with the arrows.
  useEffect(() => {
    const el = thumbsRef.current?.children[activePhotoIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activePhotoIdx]);
  function nextPhoto() { if (photos.length) setActivePhotoIdx((i) => (i + 1) % photos.length); }
  function prevPhoto() { if (photos.length) setActivePhotoIdx((i) => (i - 1 + photos.length) % photos.length); }

  // ---- Quote dialog state ----
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteGuestSearch, setQuoteGuestSearch] = useState("");
  const [quoteFirstName, setQuoteFirstName] = useState("");
  const [quotePhone, setQuotePhone] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const quoteRef = useMemo(
    () => `QTE-${p.id}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    [p.id, quoteOpen],
  );
  const [quoteGuestMatches, setQuoteGuestMatches] = useState<Guest[]>([]);
  useEffect(() => {
    const q = quoteGuestSearch.trim();
    if (!q) { setQuoteGuestMatches([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      searchUsers(q, ctrl.signal)
        .then((rows) => setQuoteGuestMatches(rows))
        .catch((err: Error) => { if (err.name !== "AbortError") setQuoteGuestMatches([]); });
    }, 250);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [quoteGuestSearch]);

  // Quote calculations (same fee structure as booking)
  const qSubtotal = p.price * nights;
  const qCleaning = p.fees.cleaning;
  const qUtilities = p.fees.utilities;
  const qBookingFee = Math.round((qSubtotal * p.fees.bookingFeePct) / 100);
  const qTotal = qSubtotal + qCleaning + qUtilities + qBookingFee;
  const quoteMsg = t.detail.quoteMsg(
    quoteFirstName || "there",
    quoteRef,
    pName(p, lang),
    pLoc(p, lang),
    formatDate(search.checkin),
    formatDate(search.checkout),
    nights,
    `${p.currency} ${p.price.toLocaleString()} × ${nights} = ${p.currency} ${qSubtotal.toLocaleString()}`,
    `${p.currency} ${qCleaning}`,
    `${p.currency} ${qUtilities}`,
    `${p.currency} ${qBookingFee.toLocaleString()}`,
    qTotal.toLocaleString(),
    p.currency,
  );

  function pickQuoteGuest(g: Guest) {
    setQuoteFirstName(g.first);
    setQuotePhone(g.phone);
    setQuoteEmail(g.email);
    setQuoteGuestSearch("");
  }

  function sendQuoteWA() {
    if (!quotePhone.trim()) { toast(t.detail.quoteMissingPhone); return; }
    window.open(waLink(quotePhone, quoteMsg), "_blank", "noopener");
    toast(t.detail.quoteSentToast);
    setQuoteOpen(false);
  }
  function sendQuoteEmail() {
    if (!quoteEmail.trim()) return;
    const subj = `${t.detail.quoteTitle} — ${pShortName(p, lang)} (${quoteRef})`;
    window.location.href = `mailto:${quoteEmail}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(quoteMsg)}`;
    toast(t.detail.quoteSentToast);
    setQuoteOpen(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(url).then(
      () => toast(t.toast.linkCopied),
      () => toast(t.toast.linkCopyFail),
    );
  }

  return (
    <>
      <div className={`pd-hero ${p.country === "egypt" ? "egypt" : ""}`}>
        {activePhoto ? (
          <img className="pd-hero-img" src={activePhoto} alt={pName(p, lang)} />
        ) : (
          <div style={{ fontSize: 13 }}>{pName(p, lang)}</div>
        )}
        {photos.length > 1 && (
          <>
            <button className="pd-hero-nav prev" onClick={prevPhoto} aria-label="Previous photo">
              <Icon.ChevronDown style={{ transform: "rotate(90deg)" }} />
            </button>
            <button className="pd-hero-nav next" onClick={nextPhoto} aria-label="Next photo">
              <Icon.ChevronDown style={{ transform: "rotate(-90deg)" }} />
            </button>
          </>
        )}
        {photos.length > 0 && (
          <div className="pd-photo-count">
            <Icon.Image /> {activePhotoIdx + 1} / {photos.length}
          </div>
        )}
        {photos.length > 1 && (
          <div className="pd-hero-thumbs" ref={thumbsRef}>
            {photos.map((src, idx) => (
              <button
                key={src + idx}
                className={`pd-thumb ${idx === activePhotoIdx ? "active" : ""}`}
                style={{ backgroundImage: `url(${src})` }}
                onClick={() => setActivePhotoIdx(idx)}
                aria-label={`Photo ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {!p.instantBook ? (
        <div className="owner-banner warn">
          <div className="owner-banner-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="owner-banner-title">{t.detail.ownerWarn}</div>
            <div className="owner-banner-text">{t.detail.ownerWarnDesc}</div>
            <div className="owner-info">
              <div className="owner-avatar">{ownerInitials}</div>
              <div className="owner-meta">
                <div className="owner-name">{p.owner.name}</div>
                <div className="owner-phone">{p.owner.phone}</div>
                <div className="owner-response">{p.owner.responseTime}</div>
              </div>
              <div className="owner-actions">
                <a className="owner-btn call" href={`tel:${cleanPhone(p.owner.phone)}`} title={t.owner.callOwner}>
                  <Icon.Phone size={16} />
                </a>
                <a
                  className="owner-btn wa"
                  href={waLink(p.owner.whatsapp, ownerMessage)}
                  target="_blank"
                  rel="noreferrer"
                  title={t.owner.waOwner}
                >
                  <Icon.WhatsApp size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="owner-banner ok">
          <div className="owner-banner-icon"><Icon.Bolt size={16} /></div>
          <div style={{ flex: 1 }}>
            <div className="owner-banner-title">{t.detail.instantOk}</div>
            <div className="owner-banner-text">
              {t.detail.instantOkDesc(p.owner.name, p.owner.phone)}
            </div>
          </div>
        </div>
      )}

      <div className="pd-section">
        <div className="pd-name">{pName(p, lang)}</div>
        <div className="pd-loc"><Icon.MapPin size={13} /> {pLoc(p, lang)}</div>
        <div className="pd-rating-row">
          <span className="star"><Icon.Star size={13} /> {p.rating}</span>
          <span className="reviews">{p.reviews} {t.common.reviews}</span>
          {p.superhost && <span className="verified"><Icon.Check size={13} />{t.detail.superhost}</span>}
          {p.verified && <span className="verified"><Icon.Verified />{t.detail.verified}</span>}
        </div>
      </div>

      <div className="pd-section">
        <h3>{t.detail.shareTitle}</h3>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{t.detail.shareHelp}</div>
        <div className="share-link-box">
          <Icon.Share size={13} style={{ color: "var(--muted)", flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{url}</span>
        </div>
        <div className="share-row">
          <button className="share-btn" onClick={copyLink}>
            <Icon.Share size={13} /> {t.detail.copyLink}
          </button>
          <a className="share-btn wa" href={waShare(shareText)} target="_blank" rel="noreferrer">
            <Icon.WhatsApp size={13} /> {t.detail.shareWA}
          </a>
          <a className="share-btn" href={`mailto:?subject=${encodeURIComponent(pName(p, lang))}&body=${encodeURIComponent(shareText)}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
            {t.detail.shareEmail}
          </a>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setQuoteOpen(true)}>
            <Icon.Sparkle size={14} /> {t.detail.quoteOpenBtn}
          </button>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{t.detail.quoteSubtitle}</div>
        </div>
      </div>

      {/* QUOTE DIALOG */}
      {quoteOpen && (
        <div className="quote-overlay" onClick={(e) => { if (e.target === e.currentTarget) setQuoteOpen(false); }}>
          <div className="quote-dialog">
            <div className="quote-dialog-head">
              <div className="quote-dialog-title">
                <Icon.Sparkle size={16} /> {t.detail.quoteDialogTitle}
              </div>
              <button className="drawer-close" onClick={() => setQuoteOpen(false)}><Icon.X /></button>
            </div>
            <div className="quote-dialog-body">
              <div className="quote-section">
                <div className="quote-section-title">{t.detail.quoteGuestPicker}</div>
                <input
                  type="text"
                  className="input"
                  placeholder={t.detail.quoteGuestPickerPlaceholder}
                  value={quoteGuestSearch}
                  onChange={(e) => setQuoteGuestSearch(e.target.value)}
                />
                {quoteGuestSearch && quoteGuestMatches.length > 0 && (
                  <div className="quote-guest-pick">
                    {quoteGuestMatches.map((g) => (
                      <div key={g.id} className="guest-row" onClick={() => pickQuoteGuest(g)}>
                        <div className="guest-avatar-sm">{g.first[0]}{g.last[0]}</div>
                        <div className="guest-row-info">
                          <div className="guest-row-name">{g.first} {g.last}</div>
                          <div className="guest-row-meta">{g.phone} · {g.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="quote-or">— {t.detail.quoteOrType} —</div>

              <div className="field-row col-2">
                <div>
                  <label className="label">{t.detail.quoteNameLabel}</label>
                  <input className="input" placeholder={t.detail.quoteNamePlaceholder}
                    value={quoteFirstName} onChange={(e) => setQuoteFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="label">{t.detail.quotePhoneLabel} <span className="req">*</span></label>
                  <input className="input" placeholder={t.detail.quotePhonePlaceholder}
                    value={quotePhone} onChange={(e) => setQuotePhone(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label className="label">{t.detail.quoteEmailLabel}</label>
                <input className="input" placeholder={t.detail.quoteEmailPlaceholder}
                  value={quoteEmail} onChange={(e) => setQuoteEmail(e.target.value)} />
              </div>

              <div className="quote-section">
                <div className="quote-section-title">{t.detail.quotePreviewLabel}</div>
                <div className="quote-preview">{quoteMsg}</div>
                <div className="quote-meta">
                  <span>{t.detail.quoteValidLabel}</span>
                  <span className="ref">{t.detail.quoteRefLabel}: {quoteRef}</span>
                </div>
              </div>
            </div>
            <div className="quote-dialog-foot">
              <button className="btn btn-secondary btn-sm" onClick={() => setQuoteOpen(false)}>{t.detail.quoteCancel}</button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={sendQuoteEmail}
                disabled={!quoteEmail.trim()}
              >
                {t.detail.quoteSendEmail}
              </button>
              <button className="btn btn-primary btn-sm" onClick={sendQuoteWA}>
                <Icon.WhatsApp size={12} /> {t.detail.quoteSendWA}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pd-section">
        <div className="pd-quickfacts">
          <div className="pd-fact">
            <div className="pd-fact-icon"><Icon.Person size={16} /></div>
            <div className="pd-fact-val">{p.capacity}</div>
            <div className="pd-fact-label">{t.common.guests}</div>
          </div>
          <div className="pd-fact">
            <div className="pd-fact-icon"><Icon.Bed size={16} /></div>
            <div className="pd-fact-val">{p.bedrooms}</div>
            <div className="pd-fact-label">{t.detail.bedrooms}</div>
          </div>
          <div className="pd-fact">
            <div className="pd-fact-icon"><Icon.Bath size={16} /></div>
            <div className="pd-fact-val">{p.bathrooms}</div>
            <div className="pd-fact-label">{t.detail.bathrooms}</div>
          </div>
          <div className="pd-fact">
            <div className="pd-fact-icon"><Icon.Area size={16} /></div>
            <div className="pd-fact-val">{p.area}</div>
            <div className="pd-fact-label">{t.detail.areaM2}</div>
          </div>
        </div>
      </div>

      <div className="pd-section">
        <h3>{t.detail.about}</h3>
        <div className="pd-desc">{pDesc(p, lang)}</div>
      </div>

      <div className="pd-section">
        <h3>
          {t.detail.sleep}
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>{t.detail.bedsTotal(p.beds)}</span>
        </h3>
        <div className="pd-rooms">
          {p.rooms.map((r) => (
            <div className="pd-room" key={r.name}>
              <div className="pd-room-name">{r.name}</div>
              <div className="pd-room-info"><Icon.Sleep /> {r.info}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pd-section">
        <h3>{t.detail.offers}</h3>
        <div className="pd-amenities">
          {Object.entries(p.amenities)
            .filter(([, has]) => has)
            .map(([key]) => (
              <div className="pd-amenity" key={key}>
                <Icon.Check />
                {key}
              </div>
            ))}
        </div>
      </div>

      <div className="pd-section">
        <h3>{t.detail.pricing}</h3>
        <div className="sum-row">
          <span>{p.currency} {p.price.toLocaleString()} × {nights} {t.common.nights}</span>
          <b>{p.currency} {(p.price * nights).toLocaleString()}</b>
        </div>
        <div className="sum-row"><span>{t.detail.cleaning}</span><b>{p.currency} {p.fees.cleaning}</b></div>
        <div className="sum-row"><span>{t.detail.utilities}</span><b>{p.currency} {p.fees.utilities}</b></div>
        <div className="sum-row">
          <span>{t.detail.bookingFee} ({p.fees.bookingFeePct}%)</span>
          <b>{p.currency} {Math.round((p.price * nights * p.fees.bookingFeePct) / 100).toLocaleString()}</b>
        </div>
        <div className="sum-row" style={{ color: "var(--muted)", fontSize: 11.5 }}>
          <span>{t.detail.deposit}</span>
          <span>{p.currency} {p.fees.deposit.toLocaleString()}</span>
        </div>
      </div>

      <div className="pd-section">
        <h3>{t.detail.rules}</h3>
        <div className="pd-policy">
          <Icon.Clock />
          <div><b>{t.detail.checkInOut}</b><span>{p.policies.checkin} → {p.policies.checkout}</span></div>
        </div>
        <div className="pd-policy">
          <Icon.Calendar size={15} />
          <div><b>{t.detail.minStay}</b><span>{p.policies.minNights} {t.common.nights}</span></div>
        </div>
        <div className="pd-policy">
          <Icon.Refresh />
          <div><b>{t.detail.cancellation}</b><span>{p.policies.cancel}</span></div>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   BOOKING FLOW
============================================================ */
interface Totals {
  subtotal: number; cleaning: number; utilities: number; bookingFee: number;
  extrasTotal: number; total: number; commission: number;
}

function BookingFlow({
  p, booking, setBooking, search,
  guestSearchQ, setGuestSearchQ, guestMatches, selectExistingGuest,
  newGuestForm, setNewGuestForm,
  selectExtra, totals, goStep,
  confirmBooking, confRef, closeDrawer, paymentMethods, t, lang, toast,
}: {
  p: Property;
  booking: BookingState;
  setBooking: React.Dispatch<React.SetStateAction<BookingState>>;
  search: SearchState;
  guestSearchQ: string;
  setGuestSearchQ: (s: string) => void;
  guestMatches: Guest[];
  selectExistingGuest: (g: Guest) => void;
  newGuestForm: { first: string; last: string; email: string; countryCode: string; phone: string };
  setNewGuestForm: React.Dispatch<React.SetStateAction<{ first: string; last: string; email: string; countryCode: string; phone: string }>>;
  selectExtra: (id: string) => void;
  totals: Totals;
  goStep: (s: number, explicitGuest?: Guest) => Promise<void>;
  confirmBooking: (asPending?: boolean) => Promise<void>;
  confRef: string;
  closeDrawer: () => void;
  paymentMethods: LookupItem[];
  t: typeof DICT["en"];
  lang: Lang;
  toast: (msg: string) => void;
}) {
  const s = booking.step;
  const stepLabels = [t.booking.steps.guest, t.booking.steps.payment, t.booking.steps.confirm];
  // Single submit gate for the 3 API-driven buttons in this flow.
  // `kind` lets each button show its own spinner while sharing the lock.
  const { submitting, submit } = useSubmitting<"continue" | "confirm" | "saveAsPending">();

  const selectedMethod = paymentMethods.find((m) => m.id === booking.payment) ?? null;
  // The InstaPay flow shows a handle for manual transfer; everything else
  // is treated as a hosted payment-link gateway (Paymob, etc.).
  const isInstapay = (selectedMethod?.name ?? "").toLowerCase().includes("instapay");

  // When the user clicks Next on the Guest step, if they typed a new
  // guest in the "OR CREATE NEW" form (placeholder id "G-NEW"), create
  // them via POST /api/reservation-agent/users first, then advance.
  async function proceedFromGuest() {
    if (!booking.guest) {
      toast(t.toast.selectGuestFirst);
      return;
    }
    if (booking.guest.id !== "G-NEW") {
      goStep(2);
      return;
    }
    const f = newGuestForm;
    // The CountryCode field has its own input now; just strip a leading "+"
    // and any whitespace. The phone field is the local number only.
    const countryCode = f.countryCode.replace(/[^\d]/g, "");
    const phoneNumber = f.phone.replace(/\s+/g, "");
    if (!countryCode) {
      toast("Country code is required");
      return;
    }
    try {
      const created = await createUser({
        createByPhone: true,
        email: f.email,
        firstName: f.first,
        lastName: f.last,
        countryCode,
        phone: phoneNumber,
      });
      setBooking((b) => ({ ...b, guest: created }));
      // Pass the just-created guest explicitly — booking.guest in the parent
      // is still stale (G-NEW) at this point until React flushes setBooking.
      await goStep(2, created);
    } catch (e) {
      const msg = e instanceof ApiError
        ? `${e.status ? `${e.status} · ` : ""}${e.message}`
        : (e as Error).message || "Failed to create guest";
      toast(msg);
    }
  }

  // Build a draft booking reference for payment links
  const draftRef = `HSI-${p.id}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const gatewayLink = `https://pay.paymob.com/houseiana/${draftRef}`;

  function selectMethod(id: number) {
    setBooking((b) => ({ ...b, payment: id, paymentSent: false, paymentVerified: false }));
  }

  function buildWAMessage(): string {
    const g = booking.guest!;
    const amount = totals.total.toLocaleString();
    if (isInstapay) {
      return t.booking.waInstapayMsg(g.first, pShortName(p, lang), p.currency, amount, t.booking.instapayHandle);
    }
    return t.booking.waPaylinkMsg(g.first, pShortName(p, lang), p.currency, amount, gatewayLink);
  }

  function sendPaymentWA() {
    if (!booking.guest?.phone) return;
    const msg = buildWAMessage();
    const url = waLink(booking.guest.phone, msg);
    window.open(url, "_blank", "noopener");
    setBooking((b) => ({ ...b, paymentSent: true }));
    toast(t.booking.sentSuccess);
  }
  function sendPaymentEmail() {
    if (!booking.guest?.email) return;
    const msg = buildWAMessage();
    const subj = `Houseiana — ${pShortName(p, lang)}`;
    window.location.href = `mailto:${booking.guest.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(msg)}`;
    setBooking((b) => ({ ...b, paymentSent: true }));
  }
  function toggleVerified() {
    const next = !booking.paymentVerified;
    if (next) toast(t.booking.verifyDoneToast);
    setBooking((b) => ({ ...b, paymentVerified: next }));
  }
  const hasPhone = !!booking.guest?.phone;
  const hasEmail = !!booking.guest?.email;
  const helpText = isInstapay ? t.booking.instapayHelp : t.booking.paylinkHelp;
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div className="steps-bar">
        {stepLabels.map((label, i) => {
          const n = i + 1;
          const done = s > n;
          return (
            <span key={n} style={{ display: "contents" }}>
              <div className={`step-item ${s === n ? "active" : done ? "done" : ""}`}>
                <div className="step-num">
                  {done ? <Icon.Check size={14} /> : n}
                </div>
                <span>{label}</span>
              </div>
              {i < 2 && <div className="step-line" />}
            </span>
          );
        })}
      </div>

      <div className={`booking-step ${s === 1 ? "active" : ""}`}>
        <div className="pd-section">
          <h3>{t.booking.searchGuest}</h3>
          <input
            type="text"
            className="input"
            placeholder={t.booking.searchGuestPlaceholder}
            value={guestSearchQ}
            onChange={(e) => setGuestSearchQ(e.target.value)}
          />
          {guestSearchQ && (
            <div className="guest-search-list">
              {guestMatches.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
                  {t.booking.noMatches}
                </div>
              ) : (
                guestMatches.map((g) => (
                  <div
                    key={g.id}
                    className={`guest-row ${booking.guest?.id === g.id ? "selected" : ""}`}
                    onClick={() => selectExistingGuest(g)}
                  >
                    <div className="guest-avatar-sm">{g.first[0]}{g.last[0]}</div>
                    <div className="guest-row-info">
                      <div className="guest-row-name">{g.first} {g.last}</div>
                      <div className="guest-row-meta">{g.email} · {g.phone}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="or-divider">{t.booking.orNew}</div>
          <div className="field-row col-1">
            <div>
              <label className="label">{t.booking.firstName} <span className="req">*</span></label>
              <input type="text" className="input"
                value={newGuestForm.first}
                onChange={(e) => setNewGuestForm((f) => ({ ...f, first: e.target.value }))}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">{t.booking.lastName} <span className="req">*</span></label>
              <input type="text" className="input"
                value={newGuestForm.last}
                onChange={(e) => setNewGuestForm((f) => ({ ...f, last: e.target.value }))}
              />
            </div>
          </div>
          <div className="field-row col-1">
            <div>
              <label className="label">{t.booking.email} <span className="req">*</span></label>
              <input type="email" className="input" placeholder="guest@email.com"
                value={newGuestForm.email}
                onChange={(e) => setNewGuestForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">{t.booking.phone} <span className="req">*</span></label>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ position: "relative", flex: "0 0 90px" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 13, pointerEvents: "none" }}>+</span>
                  <input
                    type="tel"
                    className="input"
                    placeholder="20"
                    style={{ paddingLeft: 20 }}
                    value={newGuestForm.countryCode}
                    onChange={(e) => setNewGuestForm((f) => ({ ...f, countryCode: e.target.value.replace(/[^\d]/g, "") }))}
                  />
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  className="input"
                  placeholder="1xx xxx xxxx"
                  style={{ flex: 1 }}
                  value={newGuestForm.phone}
                  onChange={(e) => {
                    // Digits only; cap at 11 if it starts with 0, otherwise 10.
                    const digits = e.target.value.replace(/\D/g, "");
                    const max = digits.startsWith("0") ? 11 : 10;
                    setNewGuestForm((f) => ({ ...f, phone: digits.slice(0, max) }));
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`booking-step ${s === 2 ? "active" : ""}`}>
        <div className="pd-section">
          {/* SECURITY WARNING */}
          <div className="security-warn">
            <div className="security-warn-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7v5c0 5 4 9 10 10 6-1 10-5 10-10V7l-10-5z" />
                <line x1="12" y1="8" x2="12" y2="13" />
                <line x1="12" y1="16" x2="12" y2="16.01" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="security-warn-title">⚠ {t.booking.securityTitle}</div>
              <div className="security-warn-text">{t.booking.securityDesc}</div>
            </div>
          </div>

          <h3>{t.booking.paymentMethod}</h3>
          {paymentMethods.length === 0 ? (
            <div style={{ padding: 12, color: "var(--muted)", fontSize: 12 }}>Loading payment methods…</div>
          ) : (
            paymentMethods.map((m) => (
              <div
                key={m.id}
                className={`pay-method ${booking.payment === m.id ? "selected" : ""}`}
                onClick={() => selectMethod(m.id)}
              >
                <div className="pay-radio" />
                <div className="pay-info">
                  <div className="pay-name">{m.name}</div>
                </div>
                <div className="pay-logo">{m.name.toUpperCase()}</div>
              </div>
            ))
          )}

          {/* ACTION PANEL */}
          <div className="pay-actions">
            <div className="pay-actions-head">
              <span style={{ color: "var(--muted)", fontWeight: 500 }}>{t.booking.amountDue}</span>
              <span className="pay-amount">
                {p.currency} {totals.total.toLocaleString()}
                {booking.paymentSent && (
                  <span className="sent-badge" style={{ marginLeft: 10 }}>
                    <Icon.Check size={10} /> {t.booking.sentSuccess}
                  </span>
                )}
              </span>
            </div>

            <div className="pay-help">{helpText}</div>

            {isInstapay && (
              <div className="instapay-box">
                <div style={{ flex: 1 }}>
                  <small>{t.booking.instapayHandleLabel}</small>
                  <div className="instapay-handle">{t.booking.instapayHandle}</div>
                </div>
                <div className="pay-logo" style={{ background: "#fff" }}>INSTAPAY</div>
              </div>
            )}

            <div className="send-row">
              <button
                className="send-btn"
                onClick={sendPaymentWA}
                disabled={!hasPhone}
                title={!hasPhone ? t.booking.sendWADisabled : ""}
              >
                <Icon.WhatsApp size={14} /> {t.booking.sendWA}
              </button>
              <button
                className="send-btn email"
                onClick={sendPaymentEmail}
                disabled={!hasEmail}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                {t.booking.sendEmail}
              </button>
            </div>

            {/* VERIFY CHECKBOX */}
            <label className={`verify-row ${booking.paymentVerified ? "verified" : ""}`}>
              <input type="checkbox" checked={booking.paymentVerified} onChange={toggleVerified} />
              <div className="verify-text">
                <div className="verify-title">{t.booking.verifyCheck}</div>
                <div className="verify-hint">{t.booking.verifyHint}</div>
              </div>
            </label>
          </div>

          <div className="summary-box">
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".6px", color: "var(--text)", marginBottom: 8 }}>
              {t.booking.summary}
            </div>
            <div className="sum-row"><span>{p.currency} {p.price.toLocaleString()} × {Math.max(1, search.nights)} {t.common.nights}</span><b>{p.currency} {totals.subtotal.toLocaleString()}</b></div>
            <div className="sum-row"><span>{t.detail.cleaning}</span><b>{p.currency} {totals.cleaning}</b></div>
            <div className="sum-row"><span>{t.detail.utilities}</span><b>{p.currency} {totals.utilities}</b></div>
            <div className="sum-row"><span>{t.detail.bookingFee} ({p.fees.bookingFeePct}%)</span><b>{p.currency} {totals.bookingFee.toLocaleString()}</b></div>
            {totals.extrasTotal > 0 && (
              <div className="sum-row"><span>{t.booking.extras} ({booking.selectedExtras.size})</span><b>{p.currency} {totals.extrasTotal.toLocaleString()}</b></div>
            )}
            <div className="sum-divider" />
            <div className="sum-total">
              <div className="sum-total-row">
                <span>{t.booking.paymentMethod}</span>
                <b>{selectedMethod?.name ?? "—"}</b>
              </div>
              <div className="sum-total-row">
                <span>{t.booking.commission}</span>
                <b>{p.currency} {totals.commission.toLocaleString()}</b>
              </div>
              <div className="sum-total-row big"><span>{t.detail.nightsTotal}</span><b>{p.currency} {totals.total.toLocaleString()}</b></div>
            </div>
          </div>
        </div>
      </div>

      <div className={`booking-step ${s === 3 ? "active" : ""}`}>
        <div className="conf-wrap">
          <div className="conf-icon" style={!booking.paymentVerified ? { background: "var(--orange-soft)", color: "var(--orange)" } : undefined}>
            {booking.paymentVerified ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>
          <div className="conf-title">{booking.paymentVerified ? t.booking.confirmed : t.booking.savedPendingHeadline}</div>
          <div className="conf-sub">{booking.paymentVerified ? t.booking.confirmedSub : t.booking.savedPendingSub("1h")}</div>
          <div className="conf-ref">{confRef || "HSI-—————"}</div>
          <div className="conf-details">
            {booking.guest && (
              <>
                <div><div className="conf-detail-label">{t.booking.confDetails.guest}</div><div className="conf-detail-value">{booking.guest.first} {booking.guest.last}</div></div>
                <div><div className="conf-detail-label">{t.booking.confDetails.property}</div><div className="conf-detail-value">{pShortName(p, lang)}</div></div>
                <div><div className="conf-detail-label">{t.booking.confDetails.checkin}</div><div className="conf-detail-value">{formatDate(search.checkin)}</div></div>
                <div><div className="conf-detail-label">{t.booking.confDetails.checkout}</div><div className="conf-detail-value">{formatDate(search.checkout)}</div></div>
                <div><div className="conf-detail-label">{t.booking.confDetails.guests}</div><div className="conf-detail-value">{search.guests}</div></div>
                <div><div className="conf-detail-label">{t.booking.confDetails.nights}</div><div className="conf-detail-value">{search.nights}</div></div>
              </>
            )}
          </div>

          {booking.guest && confRef && (() => {
            const amountStr = totals.total.toLocaleString();
            const nights = Math.max(1, search.nights);
            const guestMsg = t.booking.waGuestConfirmMsg(
              booking.guest.first, confRef, pShortName(p, lang), pLoc(p, lang),
              formatDate(search.checkin), formatDate(search.checkout),
              nights, search.guests, p.currency, amountStr,
              p.policies.checkin, p.policies.checkout,
            );
            const ownerFirst = p.owner.name.split(" ")[0];
            const guestFull = `${booking.guest.first} ${booking.guest.last}`;
            const ownerMsg = t.booking.waOwnerNotifyMsg(
              ownerFirst, pShortName(p, lang),
              formatDate(search.checkin), formatDate(search.checkout),
              nights, guestFull, booking.guest.phone, search.guests,
              p.currency, amountStr, confRef, "",
            );
            return (
              <div className="conf-actions">
                <a
                  className="conf-share-btn guest"
                  href={waLink(booking.guest.phone, guestMsg)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="conf-share-btn-icon">
                    <Icon.WhatsApp size={16} style={{ color: "#fff" }} />
                  </div>
                  <div className="conf-share-btn-info">
                    <div className="conf-share-btn-title">{t.booking.shareGuestConfirm}</div>
                    <div className="conf-share-btn-meta">{booking.guest.phone}</div>
                  </div>
                </a>
                <a
                  className="conf-share-btn owner"
                  href={waLink(p.owner.whatsapp, ownerMsg)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="conf-share-btn-icon">
                    <Icon.WhatsApp size={16} style={{ color: "#fff" }} />
                  </div>
                  <div className="conf-share-btn-info">
                    <div className="conf-share-btn-title">{t.booking.notifyOwner}</div>
                    <div className="conf-share-btn-meta">{p.owner.name} · {p.owner.phone}</div>
                  </div>
                </a>
              </div>
            );
          })()}

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>{t.common.print}</button>
            <button className="btn btn-primary btn-sm" onClick={closeDrawer}>{t.common.done}</button>
          </div>
        </div>
      </div>

      {s !== 3 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderTop: "1px solid var(--line)", background: "#fff", position: "sticky", bottom: 0, marginTop: "auto", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" disabled={s === 1} onClick={() => goStep(s - 1)}>{t.common.back}</button>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {t.common.step} <b>{s}</b> {t.common.of} 3
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {s === 2 && booking.paymentSent && !booking.paymentVerified && (
              <button
                className="btn btn-secondary"
                disabled={!!submitting}
                onClick={() => void submit("saveAsPending", () => confirmBooking(true))}
                title={t.booking.saveAndHoldBtn}
              >
                {submitting === "saveAsPending"
                  ? <><span className="spinner-sm" />&nbsp;{t.booking.saveAndHoldBtn}</>
                  : <>⏱ {t.booking.saveAndHoldBtn}</>}
              </button>
            )}
            <button
              className="btn btn-primary"
              disabled={(s === 2 && !booking.paymentVerified) || !!submitting}
              onClick={() => {
                if (s === 2) { void submit("confirm", () => confirmBooking(false)); return; }
                if (s === 1) { void submit("continue", proceedFromGuest); return; }
                void goStep(s + 1);
              }}
            >
              {submitting === "continue" || submitting === "confirm"
                ? <><span className="spinner-sm" />&nbsp;{s === 2 ? t.common.confirmBooking : t.common.next}</>
                : (s === 2 ? t.common.confirmBooking : t.common.next)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   BOOKINGS PAGE
============================================================ */
/** Non-status filters are literal keys; status filters are `status:<enum>`
 * (e.g. `status:pending`) so they can be generated from the lookup API. */
type BookingFilter = "all" | "today" | "tomorrow" | "inHouse" | "pendingPay" | string;

/** Map a backend status lookup name (e.g. "Upcoming", "Checked-in") to the
 * local Booking.status enum value. Mirrors mapStatus() in lib/api/resources/bookings.ts. */
function statusNameToEnum(name: string): Booking["status"] {
  const k = name.toLowerCase().replace(/[\s-_]/g, "");
  if (k.startsWith("checkedout")) return "checkedout";
  if (k.startsWith("checkedin")) return "checkedin";
  if (k === "cancelled" || k === "canceled") return "cancelled";
  if (k === "pending" || k === "requested" || k === "draft") return "pending";
  // "Upcoming" and anything else fall back to "confirmed".
  return "confirmed";
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function urgencyOf(b: Booking, today: string): { key: keyof typeof DICT["en"]["bookingsPage"]["urgency"] | "upcoming" | "past" | null; days: number } {
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

function tierOf(g: Guest): "vip" | "repeat" | "new" {
  if (g.bookings >= 5) return "vip";
  if (g.bookings >= 2) return "repeat";
  return "new";
}

const CHANNEL_ICON = {
  wa: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z" />
    </svg>
  ),
  call: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  web: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>,
  direct: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21V12h6v9" /></svg>,
};

function BookingsPage({
  goToSearch, t, lang, bookings, loading, bookingStatuses, onOpenBooking,
}: {
  goToSearch: () => void;
  t: typeof DICT["en"];
  lang: Lang;
  bookings: Booking[];
  loading: boolean;
  bookingStatuses: LookupItem[];
  onOpenBooking: (ref: string) => void;
}) {
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [notePopover, setNotePopover] = useState<string | null>(null);
  const today = TODAY_STR;

  // Pre-compute urgency for each booking
  const annotated = useMemo(
    () => bookings.map((b) => ({ b, urgency: urgencyOf(b, today), tier: tierOf(b.guest) })),
    [bookings, today]
  );

  const filtered = useMemo(() => {
    return annotated.filter(({ b }) => {
      if (filter === "all") return true;
      if (filter.startsWith("status:")) return b.status === filter.slice(7);
      return false;
    });
  }, [annotated, filter]);

  const statusColor: Record<string, string> = {
    confirmed: "var(--green)", pending: "var(--orange)", checkedin: "var(--blue)",
    checkedout: "var(--muted)", cancelled: "var(--red)",
  };
  const statusBg: Record<string, string> = {
    confirmed: "var(--green-soft)", pending: "var(--orange-soft)", checkedin: "var(--blue-soft)",
    checkedout: "#EEF1F4", cancelled: "var(--red-soft)",
  };

  const pills: { k: BookingFilter; lbl: string; count?: number }[] = [
    { k: "all", lbl: t.bookingsPage.filters.all, count: bookings.length },
    // Status pills come from /reservation-agent-lookup/booking-statuses
    // — the backend is the single source of truth for which statuses
    // exist (today: Upcoming / Pending / Checked-in / Cancelled).
    ...bookingStatuses.map((s) => {
      const enumVal = statusNameToEnum(s.name);
      return {
        k: `status:${enumVal}`,
        lbl: s.name,
        count: bookings.filter((b) => b.status === enumVal).length,
      };
    }),
  ];

  function urgencyBadge(u: { key: ReturnType<typeof urgencyOf>["key"]; days: number }) {
    if (!u.key) return null;
    if (u.key === "today") return <span className="bk-urgency today">⚠ {t.bookingsPage.urgency.today}</span>;
    if (u.key === "tomorrow") return <span className="bk-urgency tomorrow">{t.bookingsPage.urgency.tomorrow}</span>;
    if (u.key === "inDays") return <span className="bk-urgency upcoming">{t.bookingsPage.urgency.inDays(u.days)}</span>;
    if (u.key === "inHouse") return <span className="bk-urgency inhouse">● {t.bookingsPage.urgency.inHouse}</span>;
    if (u.key === "checkoutToday") return <span className="bk-urgency checkout-today">{t.bookingsPage.urgency.checkoutToday}</span>;
    if (u.key === "lateCheckout") return <span className="bk-urgency late">⚠ {t.bookingsPage.urgency.lateCheckout}</span>;
    return null;
  }

  function paymentBadge(b: Booking) {
    if (b.paymentStatus === "paid") return <span className="bk-pay paid">{t.bookingsPage.paymentLabel.paid}</span>;
    if (b.paymentStatus === "partial") {
      const pct = Math.round((b.paidAmount / b.totalAmount) * 100);
      return <span className="bk-pay partial">{t.bookingsPage.paymentPartial(pct)}</span>;
    }
    return <span className="bk-pay pending">{t.bookingsPage.paymentLabel.pending}</span>;
  }

  function cleanPhoneForLink(phone: string) {
    return phone.replace(/[^\d]/g, "");
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.2px" }}>{t.bookingsPage.title}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>{t.bookingsPage.subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm">{t.bookingsPage.exportCsv}</button>
          <button className="btn btn-primary btn-sm" onClick={goToSearch}>{t.bookingsPage.newBooking}</button>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div className="bk-pills">
        {pills.map((p) => (
          <button
            key={p.k}
            className={`bk-pill ${filter === p.k ? "active" : ""}`}
            onClick={() => setFilter(p.k)}
          >
            {p.lbl}
            {p.count !== undefined && <span className="count">{p.count}</span>}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div className="bk-table">
        <table>
          <thead>
            <tr>
              <th>{t.bookingsPage.headers.ref}</th>
              <th>{t.bookingsPage.headers.guest}</th>
              <th>{t.bookingsPage.headers.property}</th>
              <th>{t.bookingsPage.headers.dates}</th>
              <th>{t.bookingsPage.headers.total}</th>
              <th>{t.bookingsPage.headers.status}</th>
              <th style={{ textAlign: "end" }}>{t.bookingsPage.headers.actions}</th>
            </tr>
          </thead>
          <tbody>
            {loading && filtered.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} style={{ padding: "13px 16px" }}>
                      <div className="pd-skel line" style={{ width: j === 6 ? "30%" : "70%", marginBottom: 0 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="bk-empty">{t.bookingsPage.noBookings}</div>
                </td>
              </tr>
            ) : filtered.map(({ b, urgency, tier }) => (
              <tr key={b.ref} onClick={() => onOpenBooking(b.ref)}>
                <td>
                  <div className="bk-ref-row">
                    <div className={`bk-channel ${b.channel}`} title={t.bookingsPage.channels[b.channel]}>
                      {CHANNEL_ICON[b.channel]}
                    </div>
                    <div>
                      <div className="bk-ref">{b.ref}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="bk-guest">
                    <div className="guest-avatar-sm">{b.guest.first[0]}{b.guest.last[0]}</div>
                    <div className="bk-guest-info">
                      <div className="bk-guest-name">{b.guest.first} {b.guest.last}</div>
                      <div className="bk-guest-id">{b.guest.id}</div>
                      <span className={`bk-tier ${tier}`}>{t.bookingsPage.tier[tier]}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="bk-prop-name">{pShortName(b.property, lang)}</div>
                  <div className="bk-prop-sub">
                    <span>{pLoc(b.property, lang)}</span>
                    <span>·</span>
                    <span className="bk-prop-guests"><Icon.Person size={10} /> {t.bookingsPage.guestsCount(b.guest.bookings > 0 ? Math.min(b.property.capacity, 2 + (b.nights % 3)) : 2)}</span>
                  </div>
                </td>
                <td>
                  <div className="bk-dates">{formatDateShort(b.checkin)} → {formatDateShort(b.checkout)}</div>
                  <div className="bk-nights">{t.bookingsPage.nightsLbl(b.nights)}</div>
                  {urgencyBadge(urgency)}
                </td>
                <td>
                  <div className="bk-total">{b.total}</div>
                  {paymentBadge(b)}
                </td>
                <td>
                  <span className="bk-status" style={{ background: statusBg[b.status], color: statusColor[b.status] }}>
                    {t.bookingsPage.statuses[b.status]}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="bk-actions">
                    <a
                      className="bk-act call"
                      href={`tel:${cleanPhoneForLink(b.guest.phone)}`}
                      title={t.bookingsPage.actions.call}
                    >
                      <Icon.Phone size={14} />
                    </a>
                    <a
                      className="bk-act wa"
                      href={`https://wa.me/${cleanPhoneForLink(b.guest.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      title={t.bookingsPage.actions.whatsapp}
                    >
                      <Icon.WhatsApp size={14} />
                    </a>
                    {b.notes && (
                      <button
                        className="bk-act note"
                        title={t.bookingsPage.actions.viewNotes}
                        onClick={() => setNotePopover((cur) => (cur === b.ref ? null : b.ref))}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="8" y1="13" x2="16" y2="13" />
                          <line x1="8" y1="17" x2="13" y2="17" />
                        </svg>
                        <span className="dot-note" />
                      </button>
                    )}
                  </div>
                  {notePopover === b.ref && b.notes && (
                    <div
                      className="bk-note-popover"
                      style={{ marginTop: 6 }}
                      onClick={(e) => { e.stopPropagation(); setNotePopover(null); }}
                    >
                      <b>{t.bookingsPage.actions.viewNotes}</b>
                      {b.notes}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============================================================
   BOOKING DETAIL DRAWER
============================================================ */

// derive "free cancel until" date from policy text
function freeCancelDeadline(checkin: string, policyText: string): { date: string; type: "flexible" | "moderate" | "strict" } | null {
  const lo = policyText.toLowerCase();
  let days = 5;
  let type: "flexible" | "moderate" | "strict" = "moderate";
  if (lo.includes("flexible") || lo.includes("24h")) { days = 1; type = "flexible"; }
  else if (lo.includes("strict")) { days = 7; type = "strict"; }
  const d = new Date(checkin); d.setDate(d.getDate() - days);
  return { date: d.toISOString().slice(0, 10), type };
}

function BookingDetailDrawer({
  booking, setBookings, close, t, lang, toast, now,
}: {
  booking: Booking;
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  close: () => void;
  t: typeof DICT["en"];
  lang: Lang;
  toast: (msg: string) => void;
  now: number;
}) {
  const tBD = t.bookingDetail;
  const tBP = t.bookingsPage;
  const p = booking.property;
  const g = booking.guest;
  const tier = tierOf(g);
  const urgency = urgencyOf(booking, TODAY_STR);

  // hold info
  const holdActive = booking.status === "pending" && !!booking.holdUntil && new Date(booking.holdUntil).getTime() > now;
  const holdExpired = booking.status === "pending" && !!booking.holdUntil && new Date(booking.holdUntil).getTime() <= now;
  const holdMsLeft = booking.holdUntil ? Math.max(0, new Date(booking.holdUntil).getTime() - now) : 0;

  function confirmPaymentReceived() {
    setBookings((prev) =>
      prev.map((b) =>
        b.ref === booking.ref
          ? { ...b, status: "confirmed" as const, paymentStatus: "paid" as const, paidAmount: b.totalAmount, holdUntil: null }
          : b
      )
    );
    toast(tBD.hold.confirmedToast);
  }
  function releaseHold() {
    setBookings((prev) =>
      prev.map((b) =>
        b.ref === booking.ref
          ? { ...b, holdUntil: null }
          : b
      )
    );
    toast(tBD.hold.releasedToast);
  }

  // edit state
  const [editMode, setEditMode] = useState(false);
  const [edit, setEdit] = useState({
    first: g.first, last: g.last, checkin: booking.checkin, checkout: booking.checkout,
  });
  useEffect(() => {
    // re-sync if user switches booking while drawer was open
    setEdit({ first: g.first, last: g.last, checkin: booking.checkin, checkout: booking.checkout });
    setEditMode(false);
  }, [booking.ref, g.first, g.last, booking.checkin, booking.checkout]);

  const [noteDraft, setNoteDraft] = useState("");
  const [cancelDialog, setCancelDialog] = useState(false);

  // derived numbers
  const balance = booking.totalAmount - booking.paidAmount;
  const nights = Math.max(1, booking.nights);
  const subtotal = p.price * nights;
  const cleaning = p.fees.cleaning;
  const utilities = p.fees.utilities;
  const bookingFee = Math.round((subtotal * p.fees.bookingFeePct) / 100);

  // policy
  const fcd = freeCancelDeadline(booking.checkin, p.policies.cancel);
  const fcWindowOpen = fcd ? new Date(TODAY_STR) <= new Date(fcd.date) : false;
  const refundIfCancelled = fcWindowOpen ? booking.paidAmount : Math.round(booking.paidAmount * 0.5);

  function shortName() { return pShortName(p, lang); }

  function saveEdits() {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.ref !== booking.ref) return b;
        const newNights = Math.max(1, Math.round((new Date(edit.checkout).getTime() - new Date(edit.checkin).getTime()) / 86400000));
        return {
          ...b,
          checkin: edit.checkin,
          checkout: edit.checkout,
          nights: newNights,
          guest: { ...b.guest, first: edit.first.trim() || b.guest.first, last: edit.last.trim() || b.guest.last },
        };
      })
    );
    setEditMode(false);
    toast(tBD.edit.savedToast);
  }

  function addNote() {
    const text = noteDraft.trim();
    if (!text) return;
    const stamped = `[${formatDate(TODAY_STR)}] ${text}`;
    setBookings((prev) =>
      prev.map((b) =>
        b.ref === booking.ref ? { ...b, notes: b.notes ? `${b.notes}\n${stamped}` : stamped } : b
      )
    );
    setNoteDraft("");
    toast(tBD.notes.addedToast);
  }

  function confirmCancel() {
    // mark booking as cancelled. If a refund is owed, auto-send the refund
    // request to the Accounts team in the same step (refundStatus = "requested").
    const willRefund = refundIfCancelled > 0;
    setBookings((prev) =>
      prev.map((b) =>
        b.ref === booking.ref
          ? {
              ...b,
              status: "cancelled" as const,
              refundAmount: refundIfCancelled,
              refundStatus: willRefund ? ("requested" as const) : ("none" as const),
            }
          : b
      )
    );
    setCancelDialog(false);
    toast(
      willRefund
        ? tBD.cancelDialog.cancelledWithRefundToast(`${p.currency} ${refundIfCancelled.toLocaleString()}`)
        : tBD.cancelDialog.cancelledToast
    );
  }

  // share messages — reuse existing templates
  const amountStr = booking.totalAmount.toLocaleString();
  const guestMsg = t.booking.waGuestConfirmMsg(
    g.first, booking.ref, shortName(), pLoc(p, lang),
    formatDate(booking.checkin), formatDate(booking.checkout),
    nights, 2, p.currency, amountStr,
    p.policies.checkin, p.policies.checkout,
  );
  const ownerFirst = p.owner.name.split(" ")[0];
  const guestFull = `${g.first} ${g.last}`;
  const ownerMsg = t.booking.waOwnerNotifyMsg(
    ownerFirst, shortName(),
    formatDate(booking.checkin), formatDate(booking.checkout),
    nights, guestFull, g.phone, 2,
    p.currency, amountStr, booking.ref, booking.notes ?? "",
  );

  const statusColor: Record<string, string> = {
    confirmed: "var(--green)", pending: "var(--orange)", checkedin: "var(--blue)",
    checkedout: "var(--muted)", cancelled: "var(--red)",
  };
  const statusBg: Record<string, string> = {
    confirmed: "var(--green-soft)", pending: "var(--orange-soft)", checkedin: "var(--blue-soft)",
    checkedout: "#EEF1F4", cancelled: "var(--red-soft)",
  };

  return (
    <>
      <div className="bk-drawer-head">
        <button className="drawer-close" onClick={close} title={tBD.closeBtn}><Icon.X /></button>
        <div className="bk-drawer-head-info">
          <div className="bk-drawer-head-title">{tBD.title}</div>
          <div className="bk-drawer-head-ref">{booking.ref}</div>
          <div className="bk-drawer-head-badges">
            <span className="bk-status" style={{ background: statusBg[booking.status], color: statusColor[booking.status] }}>
              {tBP.statuses[booking.status]}
            </span>
            {urgency.key && (() => {
              if (urgency.key === "today") return <span className="bk-urgency today">⚠ {tBP.urgency.today}</span>;
              if (urgency.key === "tomorrow") return <span className="bk-urgency tomorrow">{tBP.urgency.tomorrow}</span>;
              if (urgency.key === "inDays") return <span className="bk-urgency upcoming">{tBP.urgency.inDays(urgency.days)}</span>;
              if (urgency.key === "inHouse") return <span className="bk-urgency inhouse">● {tBP.urgency.inHouse}</span>;
              if (urgency.key === "checkoutToday") return <span className="bk-urgency checkout-today">{tBP.urgency.checkoutToday}</span>;
              if (urgency.key === "lateCheckout") return <span className="bk-urgency late">⚠ {tBP.urgency.lateCheckout}</span>;
              return null;
            })()}
            <span className={`bk-pay ${booking.paymentStatus}`}>
              {booking.paymentStatus === "partial"
                ? tBP.paymentPartial(Math.round((booking.paidAmount / booking.totalAmount) * 100))
                : tBP.paymentLabel[booking.paymentStatus]}
            </span>
          </div>
        </div>
      </div>

      <div className="bk-toolbar">
        <button
          className={`bk-tool ${editMode ? "primary" : ""}`}
          onClick={() => (editMode ? saveEdits() : setEditMode(true))}
          disabled={booking.status === "cancelled" || booking.status === "checkedout"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          {editMode ? tBD.toolbar.doneEdit : tBD.toolbar.edit}
        </button>
        <a className="bk-tool wa" href={waLink(g.phone, guestMsg)} target="_blank" rel="noreferrer">
          <Icon.WhatsApp size={13} /> {tBD.toolbar.shareGuest}
        </a>
        <a className="bk-tool wa" href={waLink(p.owner.whatsapp, ownerMsg)} target="_blank" rel="noreferrer">
          <Icon.WhatsApp size={13} /> {tBD.toolbar.shareOwner}
        </a>
        <button
          className="bk-tool danger"
          onClick={() => setCancelDialog(true)}
          disabled={booking.status === "cancelled"}
        >
          <Icon.X size={13} /> {tBD.toolbar.cancel}
        </button>
      </div>

      {editMode && (
        <div className="bk-edit-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12" y2="16.01" />
          </svg>
          {tBD.edit.hint}
        </div>
      )}

      <div className="drawer-body">
        {(holdActive || holdExpired) && (
          <div className="bd-section" style={{ borderBottom: 0, paddingBottom: 0 }}>
            <div className={`hold-banner ${holdExpired ? "expired" : ""}`}>
              <div className="hold-banner-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="hold-banner-body">
                <div className="hold-banner-title">{tBD.hold.heading}</div>
                <div className="hold-banner-text">{holdActive ? tBD.hold.activeHint : tBD.hold.expiredHint}</div>
                <div className="hold-timer">
                  <span className="hold-timer-lbl">{tBD.hold.timeLeftLabel}</span>
                  <span className="hold-timer-val">{holdActive ? fmtTimeLeft(holdMsLeft) : tBD.hold.expiredLabel}</span>
                </div>
                <div className="hold-banner-actions">
                  <button className="btn btn-primary btn-sm" onClick={confirmPaymentReceived}>
                    ✓ {tBD.hold.confirmPaymentBtn}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={releaseHold}>
                    {tBD.hold.releaseHoldBtn}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAY */}
        <div className="bd-section">
          <h4><Icon.Calendar size={13} /> {tBD.sections.stay}</h4>
          {editMode ? (
            <>
              <div className="bd-edit-row">
                <div>
                  <label>{tBD.edit.checkinLabel}</label>
                  <input type="date" value={edit.checkin} onChange={(e) => setEdit((s) => ({ ...s, checkin: e.target.value }))} />
                </div>
                <div>
                  <label>{tBD.edit.checkoutLabel}</label>
                  <input type="date" value={edit.checkout} onChange={(e) => setEdit((s) => ({ ...s, checkout: e.target.value }))} />
                </div>
              </div>
              <div className="bd-edit-row">
                <div>
                  <label>{tBD.edit.firstNameLabel}</label>
                  <input type="text" value={edit.first} onChange={(e) => setEdit((s) => ({ ...s, first: e.target.value }))} />
                </div>
                <div>
                  <label>{tBD.edit.lastNameLabel}</label>
                  <input type="text" value={edit.last} onChange={(e) => setEdit((s) => ({ ...s, last: e.target.value }))} />
                </div>
              </div>
            </>
          ) : (
            <div className="bd-stay-grid">
              <div className="bd-stay-cell">
                <div className="bd-stay-lbl">{tBD.stay.checkin}</div>
                <div className="bd-stay-val">{formatDate(booking.checkin)}</div>
                <div className="bd-stay-sub">{tBD.stay.after} {p.policies.checkin}</div>
              </div>
              <div className="bd-stay-cell">
                <div className="bd-stay-lbl">{tBD.stay.checkout}</div>
                <div className="bd-stay-val">{formatDate(booking.checkout)}</div>
                <div className="bd-stay-sub">{tBD.stay.before} {p.policies.checkout}</div>
              </div>
              <div className="bd-stay-cell">
                <div className="bd-stay-lbl">{tBD.stay.nights}</div>
                <div className="bd-stay-val">{booking.nights}</div>
                <div className="bd-stay-sub">{tBD.stay.minStay}: {p.policies.minNights}</div>
              </div>
              <div className="bd-stay-cell">
                <div className="bd-stay-lbl">{tBD.stay.guests}</div>
                <div className="bd-stay-val">{Math.min(p.capacity, 2)}</div>
                <div className="bd-stay-sub">{tBD.property.capacityLine(p.capacity)}</div>
              </div>
            </div>
          )}
        </div>

        {/* GUEST */}
        <div className="bd-section">
          <h4><Icon.Person size={13} /> {tBD.sections.guest}</h4>
          <div className="bd-people">
            <div className="bd-people-avatar">{g.first[0]}{g.last[0]}</div>
            <div className="bd-people-info">
              <div className="bd-people-name">{g.first} {g.last}</div>
              <div className="bd-people-sub">{tBD.guest.tierLine(tBP.tier[tier], g.bookings)}</div>
            </div>
            <div className="bd-people-actions">
              <a className="bd-act-btn call" href={`tel:${cleanPhone(g.phone)}`} title={tBD.guest.callBtn}><Icon.Phone size={16} /></a>
              <a className="bd-act-btn wa" href={waLink(g.phone, "")} target="_blank" rel="noreferrer" title={tBD.guest.waBtn}><Icon.WhatsApp size={16} /></a>
            </div>
          </div>
          <dl className="bd-kv">
            <dt>{tBD.guest.phoneLabel}</dt><dd className="mono">{g.phone}</dd>
            <dt>{tBD.guest.emailLabel}</dt><dd className="mono">{g.email}</dd>
            <dt>{tBD.guest.natLabel}</dt><dd>{g.nat}</dd>
            <dt>{tBD.guest.ltvLabel}</dt><dd>{g.ltv}</dd>
          </dl>
        </div>

        {/* PROPERTY */}
        <div className="bd-section">
          <h4><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21V12h6v9" /></svg> {tBD.sections.property}</h4>
          <div className="bd-prop">
            <div className="bd-prop-name">{shortName()}</div>
            <div className="bd-prop-meta">
              {pLoc(p, lang)} · {tBD.property.typeLine(t.filters.types[p.type as keyof typeof t.filters.types] ?? p.type, p.bedrooms, p.bathrooms, p.area)}
            </div>
            <div className="bd-prop-price">
              {p.currency} {p.price.toLocaleString()}
              <small>/ {tBD.property.perNight}</small>
            </div>
            <a className="bd-prop-link" href={propertyUrl(p)} target="_blank" rel="noreferrer">{tBD.property.viewOnSite}</a>
          </div>
          <dl className="bd-kv">
            <dt>{tBD.property.idLabel}</dt><dd className="mono">{p.id}</dd>
          </dl>
        </div>

        {/* OWNER */}
        <div className="bd-section">
          <h4><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" /></svg> {tBD.sections.owner}</h4>
          <div className="bd-people">
            <div className="bd-people-avatar">{p.owner.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}</div>
            <div className="bd-people-info">
              <div className="bd-people-name">{p.owner.name}</div>
              <div className="bd-people-sub">{tBD.owner.responseLabel}: {p.owner.responseTime}</div>
            </div>
            <div className="bd-people-actions">
              <a className="bd-act-btn call" href={`tel:${cleanPhone(p.owner.phone)}`} title={tBD.owner.callBtn}><Icon.Phone size={16} /></a>
              <a className="bd-act-btn wa" href={waLink(p.owner.whatsapp, ownerMsg)} target="_blank" rel="noreferrer" title={tBD.owner.waBtn}><Icon.WhatsApp size={16} /></a>
            </div>
          </div>
          <dl className="bd-kv">
            <dt>{tBD.guest.phoneLabel}</dt><dd className="mono">{p.owner.phone}</dd>
          </dl>
        </div>

        {/* PAYMENT */}
        <div className="bd-section">
          <h4><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg> {tBD.sections.payment}</h4>
          <div className="bd-pay-rows">
            <div className="bd-pay-row"><span>{p.currency} {p.price.toLocaleString()} × {nights}</span><b>{p.currency} {subtotal.toLocaleString()}</b></div>
            <div className="bd-pay-row"><span>{tBD.payment.cleaning}</span><b>{p.currency} {cleaning}</b></div>
            <div className="bd-pay-row"><span>{tBD.payment.utilities}</span><b>{p.currency} {utilities}</b></div>
            <div className="bd-pay-row"><span>{tBD.payment.bookingFee}</span><b>{p.currency} {bookingFee.toLocaleString()}</b></div>
            <div className="bd-pay-row total"><span>{tBD.payment.total}</span><b>{p.currency} {booking.totalAmount.toLocaleString()}</b></div>
          </div>
          <div className="bd-pay-summary">
            <div className="bd-pay-card paid">
              <div className="bd-pay-card-lbl">{tBD.payment.paid}</div>
              <div className="bd-pay-card-val">{p.currency} {booking.paidAmount.toLocaleString()}</div>
            </div>
            <div className={`bd-pay-card ${balance > 0 ? "balance" : "paid"}`}>
              <div className="bd-pay-card-lbl">{tBD.payment.balance}</div>
              <div className="bd-pay-card-val">{p.currency} {balance.toLocaleString()}</div>
            </div>
          </div>
          <dl className="bd-kv" style={{ marginTop: 10 }}>
            <dt>{tBD.payment.channel}</dt><dd>{tBP.channels[booking.channel]}</dd>
            <dt>{tBD.payment.paymentStatus}</dt><dd>{tBP.paymentLabel[booking.paymentStatus]}</dd>
          </dl>
        </div>

        {/* POLICY */}
        <div className="bd-section">
          <h4><Icon.Refresh size={13} /> {tBD.sections.policy}</h4>
          <div className="bd-policy-box">
            <b>{tBD.policy.cancelPolicy}</b>
            {p.policies.cancel}
            {fcd && (
              <div style={{ marginTop: 6 }}>
                <b>{tBD.policy.freeCancelUntil}</b>
                {formatDate(fcd.date)}
              </div>
            )}
            {fcd ? (
              <div className={`bd-policy-status ${fcWindowOpen ? "ok" : "late"}`}>
                {fcWindowOpen ? tBD.policy.freeCancelOk : tBD.policy.freeCancelPast}
              </div>
            ) : (
              <div className="bd-policy-status late">{tBD.policy.nonRefundable}</div>
            )}
          </div>
        </div>

        {/* REFUND (only when there's an amount to refund) */}
        {booking.refundAmount > 0 && (
          <div className="bd-section">
            <h4>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
              {tBD.refund.heading}
              {booking.refundStatus !== "none" && (
                <span className={`refund-status-badge ${booking.refundStatus}`}>
                  ✓ {booking.refundStatus === "requested" ? tBD.refund.requestedBadge : tBD.refund.processedBadge}
                </span>
              )}
            </h4>
            <div className={`refund-banner ${booking.refundStatus}`}>
              <div className="refund-banner-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </div>
              <div className="refund-banner-body">
                <div className="refund-banner-text">
                  {booking.refundStatus === "requested" ? tBD.refund.requestedHint
                    : booking.refundStatus === "processed" ? tBD.refund.processedHint
                    : tBD.refund.pendingHint}
                </div>
                <div className="refund-amount-line">
                  <span className="lbl">{tBD.refund.amountLabel}</span>
                  <span className="val">{p.currency} {booking.refundAmount.toLocaleString()}</span>
                </div>
                {booking.refundStatus === "none" && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      setBookings((prev) =>
                        prev.map((b) => (b.ref === booking.ref ? { ...b, refundStatus: "requested" as const } : b))
                      );
                      toast(tBD.refund.requestedToast);
                    }}
                  >
                    {tBD.refund.requestBtn}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* NOTES */}
        <div className="bd-section">
          <h4>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            {tBD.sections.notes}
          </h4>
          <div className={`bd-notes-existing ${!booking.notes ? "empty" : ""}`}>
            {booking.notes || tBD.notes.noneYet}
          </div>
          <div>
            <textarea
              className="textarea"
              placeholder={tBD.notes.addPlaceholder}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              style={{ width: "100%" }}
            />
            <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary btn-sm" onClick={addNote} disabled={!noteDraft.trim()}>
                {tBD.notes.saveBtn}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bd-footer">
        {editMode ? (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditMode(false); setEdit({ first: g.first, last: g.last, checkin: booking.checkin, checkout: booking.checkout }); }}>
              {tBD.edit.discardBtn}
            </button>
            <button className="btn btn-primary btn-sm" onClick={saveEdits}>{tBD.edit.saveBtn}</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{p.currency} {booking.totalAmount.toLocaleString()} · {booking.nights} {t.common.nights}</span>
            <button className="btn btn-secondary btn-sm" onClick={close}>{tBD.closeBtn}</button>
          </>
        )}
      </div>

      {/* CANCEL CONFIRMATION DIALOG */}
      {cancelDialog && (
        <div className="bd-cancel-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCancelDialog(false); }}>
          <div className="bd-cancel-dialog">
            <div className="bd-cancel-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="bd-cancel-title">{tBD.cancelDialog.title}</div>
            {booking.status === "cancelled" ? (
              <>
                <div className={`bd-cancel-headline late`}>{tBD.cancelDialog.cancelledHeadline}</div>
                <div className="bd-cancel-body">{tBD.cancelDialog.noRefund}</div>
              </>
            ) : fcWindowOpen ? (
              <>
                <div className="bd-cancel-headline ok">{tBD.cancelDialog.freeWindowHeadline}</div>
                <div className="bd-cancel-body">{tBD.cancelDialog.freeWindowBody(`${p.currency} ${refundIfCancelled.toLocaleString()}`)}</div>
                {refundIfCancelled > 0 && (
                  <div style={{ fontSize: 11.5, color: "var(--green)", fontWeight: 500, marginTop: -8, marginBottom: 14 }}>
                    {tBD.cancelDialog.autoRequestNote}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="bd-cancel-headline late">{tBD.cancelDialog.lateWindowHeadline}</div>
                <div className="bd-cancel-body">
                  {refundIfCancelled > 0
                    ? tBD.cancelDialog.lateWindowBody(`${p.currency} ${refundIfCancelled.toLocaleString()}`)
                    : tBD.cancelDialog.noRefund}
                </div>
                {refundIfCancelled > 0 && (
                  <div style={{ fontSize: 11.5, color: "var(--orange)", fontWeight: 500, marginTop: -8, marginBottom: 14 }}>
                    {tBD.cancelDialog.autoRequestNote}
                  </div>
                )}
              </>
            )}
            <div className="bd-cancel-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setCancelDialog(false)}>{tBD.cancelDialog.keepBtn}</button>
              <button
                className="btn btn-sm"
                style={{ background: "var(--red)", color: "#fff" }}
                onClick={confirmCancel}
                disabled={booking.status === "cancelled"}
              >
                {tBD.cancelDialog.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   GUEST DETAIL DRAWER
============================================================ */
function GuestDetailDrawer({
  guest, bookings, setBookings, close, openBooking, t, lang, toast,
}: {
  guest: Guest;
  bookings: Booking[];
  setBookings: React.Dispatch<React.SetStateAction<Booking[]>>;
  close: () => void;
  openBooking: (ref: string) => void;
  t: typeof DICT["en"];
  lang: Lang;
  toast: (msg: string) => void;
}) {
  const tGD = t.guestDetail;
  const tBP = t.bookingsPage;
  const today = TODAY_STR;
  const tier = tierOf(guest);

  // Partition this guest's bookings
  const mine = bookings.filter((b) => b.guest.id === guest.id);
  const refundsPending = mine.filter((b) => b.refundAmount > 0 && b.refundStatus !== "processed");
  const totalRefundOwed = refundsPending.reduce((s, b) => s + b.refundAmount, 0);

  const isCurrent = (b: Booking) =>
    b.status === "checkedin" ||
    (b.status === "confirmed" && b.checkin <= today && b.checkout >= today) ||
    (b.status === "pending" && b.checkin <= today && b.checkout >= today);
  const isFuture = (b: Booking) =>
    (b.status === "confirmed" || b.status === "pending") && b.checkin > today;
  const isPast = (b: Booking) =>
    b.status === "checkedout" || b.status === "cancelled" || (b.status === "confirmed" && b.checkout < today);

  const current = mine.filter(isCurrent);
  const upcoming = mine.filter(isFuture).sort((a, b) => a.checkin.localeCompare(b.checkin));
  const past = mine.filter(isPast).sort((a, b) => b.checkin.localeCompare(a.checkin));

  function requestRefund(ref: string) {
    setBookings((prev) =>
      prev.map((b) => (b.ref === ref ? { ...b, refundStatus: "requested" as const } : b))
    );
    toast(t.bookingDetail.refund.requestedToast);
  }

  function shareUpcoming(b: Booking) {
    const nights = Math.max(1, b.nights);
    const msg = t.booking.waGuestConfirmMsg(
      guest.first, b.ref, pShortName(b.property, lang), pLoc(b.property, lang),
      formatDate(b.checkin), formatDate(b.checkout),
      nights, 2, b.property.currency, b.totalAmount.toLocaleString(),
      b.property.policies.checkin, b.property.policies.checkout,
    );
    window.open(waLink(guest.phone, msg), "_blank", "noopener");
  }

  const statusColor: Record<string, string> = {
    confirmed: "var(--green)", pending: "var(--orange)", checkedin: "var(--blue)",
    checkedout: "var(--muted)", cancelled: "var(--red)",
  };
  const statusBg: Record<string, string> = {
    confirmed: "var(--green-soft)", pending: "var(--orange-soft)", checkedin: "var(--blue-soft)",
    checkedout: "#EEF1F4", cancelled: "var(--red-soft)",
  };

  function renderBkItem(b: Booking, when: "future" | "now" | "past") {
    const diff = daysBetween(today, b.checkin);
    const whenLbl =
      when === "now" ? tBP.urgency.inHouse :
      when === "future" ? tGD.daysAway(Math.max(0, diff)) :
      tGD.daysAgo(Math.max(0, -diff));
    const whenClass = b.status === "cancelled" ? "cancel" : when;
    return (
      <div key={b.ref} className="gd-bk">
        <div className="gd-bk-head">
          <span className="gd-bk-ref">{b.ref}</span>
          <div className={`bk-channel ${b.channel}`} title={tBP.channels[b.channel]}>
            {CHANNEL_ICON[b.channel]}
          </div>
          <span className="bk-status gd-bk-status" style={{ background: statusBg[b.status], color: statusColor[b.status] }}>
            {tBP.statuses[b.status]}
          </span>
        </div>
        <div className="gd-bk-prop">{pShortName(b.property, lang)}</div>
        <div className="gd-bk-loc">{pLoc(b.property, lang)}</div>
        <div className="gd-bk-meta">
          <div className="gd-bk-dates">
            <span>{formatDateShort(b.checkin)} → {formatDateShort(b.checkout)}</span>
            <span>·</span>
            <span>{tGD.nightsLine(b.nights)}</span>
            <span className={`gd-bk-when ${whenClass}`}>{whenLbl}</span>
          </div>
          <div className="gd-bk-total">{b.total}</div>
        </div>
        <div className="gd-bk-actions">
          <button className="open" onClick={() => openBooking(b.ref)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17l9.2-9.2M17 17V7H7" /></svg>
            {tGD.openBookingBtn}
          </button>
          {when === "future" && b.status !== "cancelled" && (
            <a
              className="wa"
              href="#"
              onClick={(e) => { e.preventDefault(); shareUpcoming(b); }}
            >
              <Icon.WhatsApp size={12} />
              {tGD.shareBtn}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="gd-head">
        <button className="drawer-close" onClick={close} title={tGD.closeBtn}><Icon.X /></button>
        <div className="gd-head-avatar">{guest.first[0]}{guest.last[0]}</div>
        <div className="gd-head-info">
          <div className="gd-head-name">{guest.first} {guest.last}</div>
          <div className="gd-head-sub">{guest.id} · {guest.nat}</div>
        </div>
        <div className="bd-people-actions">
          <a className="bd-act-btn call" href={`tel:${cleanPhone(guest.phone)}`} title={tGD.actions.call}><Icon.Phone size={16} /></a>
          <a className="bd-act-btn wa" href={waLink(guest.phone, "")} target="_blank" rel="noreferrer" title={tGD.actions.whatsapp}><Icon.WhatsApp size={16} /></a>
        </div>
      </div>

      <div className="gd-stats">
        <div className="gd-stat">
          <div className="gd-stat-val">{guest.bookings}</div>
          <div className="gd-stat-lbl">{tGD.stats.totalBookings}</div>
        </div>
        <div className="gd-stat">
          <div className="gd-stat-val" style={{ color: "var(--green)" }}>{guest.ltv}</div>
          <div className="gd-stat-lbl">{tGD.stats.ltv}</div>
        </div>
        <div className="gd-stat">
          <div className="gd-stat-val"><span className={`bk-tier ${tier}`} style={{ marginTop: 0 }}>{tBP.tier[tier]}</span></div>
          <div className="gd-stat-lbl">{tGD.stats.tier}</div>
        </div>
        <div className="gd-stat">
          <div className="gd-stat-val" style={{ fontSize: 13 }}>{t.guestsPage.lastStays[guest.id] || "—"}</div>
          <div className="gd-stat-lbl">{tGD.stats.lastStay}</div>
        </div>
      </div>

      <div className="gd-contact">
        <div className="gd-contact-line">
          <div>📞 {guest.phone}</div>
          <div>✉ {guest.email}</div>
        </div>
      </div>

      <div className="drawer-body">
        {/* REFUNDS PENDING */}
        {refundsPending.length > 0 && (
          <div className="gd-section">
            <h4 className="refund-h">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
              {tGD.refundsTitle}
              <span className="count">{refundsPending.length}</span>
            </h4>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>
              {tGD.refundsSubtitle(refundsPending.length)} · <b>{refundsPending[0].property.currency} {totalRefundOwed.toLocaleString()}</b>
            </div>
            {refundsPending.map((b) => (
              <div key={b.ref} className={`refund-banner ${b.refundStatus}`}>
                <div className="refund-banner-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </div>
                <div className="refund-banner-body">
                  <div className="refund-banner-title">{b.ref} · {pShortName(b.property, lang)}</div>
                  <div className="refund-banner-text">
                    {formatDateShort(b.checkin)} → {formatDateShort(b.checkout)} ·{" "}
                    {b.refundStatus === "requested" ? t.bookingDetail.refund.requestedHint : t.bookingDetail.refund.pendingHint}
                  </div>
                  <div className="refund-amount-line">
                    <span className="lbl">{t.bookingDetail.refund.amountLabel}</span>
                    <span className="val">{b.property.currency} {b.refundAmount.toLocaleString()}</span>
                  </div>
                  {b.refundStatus === "none" ? (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => requestRefund(b.ref)}
                    >
                      {tGD.requestRefundBtn}
                    </button>
                  ) : (
                    <span className="refund-status-badge requested">✓ {t.bookingDetail.refund.requestedBadge}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CURRENT STAYS */}
        <div className="gd-section">
          <h4>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)" }} />
            {tGD.sections.current}
            <span className="count">{current.length}</span>
          </h4>
          {current.length === 0
            ? <div className="gd-empty">{tGD.emptyCurrent}</div>
            : current.map((b) => renderBkItem(b, "now"))}
        </div>

        {/* UPCOMING */}
        <div className="gd-section">
          <h4>
            <Icon.Calendar size={13} />
            {tGD.sections.upcoming}
            <span className="count">{upcoming.length}</span>
          </h4>
          {upcoming.length === 0
            ? <div className="gd-empty">{tGD.emptyUpcoming}</div>
            : upcoming.map((b) => renderBkItem(b, "future"))}
        </div>

        {/* PAST */}
        <div className="gd-section">
          <h4>
            <Icon.Refresh size={13} />
            {tGD.sections.past}
            <span className="count">{past.length}</span>
          </h4>
          {past.length === 0
            ? <div className="gd-empty">{tGD.emptyPast}</div>
            : past.map((b) => renderBkItem(b, "past"))}
        </div>
      </div>

      <div className="bd-footer">
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {mine.length} {mine.length === 1 ? "booking" : "bookings"} · {guest.ltv}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={close}>{tGD.closeBtn}</button>
      </div>
    </>
  );
}

/* ============================================================
   GUESTS PAGE
============================================================ */
function GuestsPage({
  t,
  guests,
  loading,
  onOpenGuest,
}: {
  t: typeof DICT["en"];
  guests: Guest[];
  loading: boolean;
  onOpenGuest: (id: string) => void;
}) {
  const headers = [t.guestsPage.headers.guest, t.guestsPage.headers.contact, t.guestsPage.headers.nationality, t.guestsPage.headers.bookings, t.guestsPage.headers.ltv, t.guestsPage.headers.lastStay];
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.2px" }}>{t.guestsPage.title}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>{t.guestsPage.subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Icon.Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input type="text" className="input" placeholder={t.guestsPage.searchPlaceholder} style={{ paddingLeft: 34, width: 240 }} />
          </div>
          <button className="btn btn-primary btn-sm">{t.guestsPage.addGuest}</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        <div className="stat-card sm"><div className="stat-card-label">{t.guestsPage.stats.total}</div><div className="stat-card-value sm">2,847</div><div className="stat-card-meta"><span className="trend up">↑ 142</span><span>{t.guestsPage.stats.thisMonth}</span></div></div>
        <div className="stat-card sm"><div className="stat-card-label">{t.guestsPage.stats.repeat}</div><div className="stat-card-value sm">31%</div><div className="stat-card-meta"><span className="trend up">↑ 4 pts</span></div></div>
        <div className="stat-card sm"><div className="stat-card-label">{t.guestsPage.stats.avgLtv}</div><div className="stat-card-value sm">EGP 62,400</div><div className="stat-card-meta"><span className="trend up">↑ 8%</span></div></div>
        <div className="stat-card sm"><div className="stat-card-label">{t.guestsPage.stats.vip}</div><div className="stat-card-value sm">84</div><div className="stat-card-meta"><span style={{ color: "var(--muted)" }}>{t.guestsPage.stats.vipNote}</span></div></div>
      </div>
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14}}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--ghost)" }}>
              {headers.map((h) => (
                <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".6px", padding: "11px 16px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && guests.length === 0 && Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skel-${i}`}>
                {headers.map((__, j) => (
                  <td key={j} style={{ padding: "13px 16px" }}>
                    <div className="pd-skel line" style={{ width: j === 0 ? "80%" : "60%", marginBottom: 0 }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && guests.length === 0 && (
              <tr>
                <td colSpan={headers.length} style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  —
                </td>
              </tr>
            )}
            {guests.map((g) => (
              <tr key={g.id} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => onOpenGuest(g.id)}>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="guest-avatar-sm">{(g.first[0] ?? "").toUpperCase()}{(g.last[0] ?? "").toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{g.first} {g.last}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{g.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ fontSize: 12.5 }}>{g.email}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{g.phone}</div>
                </td>
                <td style={{ padding: "13px 16px", fontSize: 13 }}>{g.nat}</td>
                <td style={{ padding: "13px 16px", fontWeight: 600 }}>{g.bookings}</td>
                <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--green)" }}>{g.ltv}</td>
                <td style={{ padding: "13px 16px", fontSize: 12.5, color: "var(--text-2)" }}>{g.lastStay || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============================================================
   KPIs PAGE
============================================================ */
function KpisPage({ t }: { t: typeof DICT["en"] }) {
  const max = 45;
  const u = t.kpis.units;
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.2px" }}>{t.kpis.title}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>{t.kpis.subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="sort-select">
            <option value="mtd">{t.kpis.periods.mtd}</option>
            <option value="last">{t.kpis.periods.last}</option>
            <option value="qtd">{t.kpis.periods.qtd}</option>
            <option value="ytd">{t.kpis.periods.ytd}</option>
            <option value="all">{t.kpis.periods.all}</option>
          </select>
          <button className="btn btn-secondary btn-sm"><Icon.Download /> {t.kpis.exportBtn}</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginTop: 20 }}>
        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--blue-soft)", color: "var(--blue)", display: "grid", placeItems: "center" }}>
              <Icon.Phone size={15} />
            </div>
            <div className="stat-card-label" style={{ margin: 0 }}>{t.kpis.callsReceived}</div>
          </div>
          <div className="stat-card-value">124</div>
          <div className="stat-card-meta"><span className="trend up">↑ 18</span><span>{t.kpis.vsLast}</span></div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--green-soft)", color: "var(--green)", display: "grid", placeItems: "center" }}>
              <Icon.Check size={15} />
            </div>
            <div className="stat-card-label" style={{ margin: 0 }}>{t.kpis.callsConverted}</div>
          </div>
          <div className="stat-card-value">38</div>
          <div className="stat-card-meta"><span className="trend up">↑ 14%</span><span>{t.kpis.bookedFromCalls}</span></div>
        </div>

        <div className="stat-card" style={{ background: "linear-gradient(135deg,var(--charcoal) 0%,var(--charcoal-2) 100%)", color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "var(--yellow)", opacity: 0.12 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(252,197,25,.2)", color: "var(--yellow)", display: "grid", placeItems: "center" }}>
              <Icon.Verified />
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: ".7px", fontWeight: 500 }}>{t.kpis.conversionRate}</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 6, letterSpacing: "-.4px", color: "var(--yellow)" }}>30.6%</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 11.5 }}>
            <span style={{ background: "rgba(34,197,94,.18)", color: "#86EFAC", padding: "2px 7px", borderRadius: 5, fontWeight: 500 }}>↑ 4 pts</span>
            <span style={{ color: "rgba(255,255,255,.6)" }}>{t.kpis.teamAvg}</span>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--yellow-soft)", color: "var(--charcoal)", display: "grid", placeItems: "center" }}>
              <Icon.Calendar size={15} />
            </div>
            <div className="stat-card-label" style={{ margin: 0 }}>{t.kpis.bookingsMine}</div>
          </div>
          <div className="stat-card-value">38</div>
          <div className="stat-card-meta"><span style={{ color: "var(--muted)" }}>{t.kpis.allTime142}</span></div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--green-soft)", color: "var(--green)", display: "grid", placeItems: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
            <div className="stat-card-label" style={{ margin: 0 }}>{t.kpis.totalAmount}</div>
          </div>
          <div className="stat-card-value" style={{ color: "var(--green)" }}>EGP 287K</div>
          <div className="stat-card-meta"><span className="trend up">↑ 22%</span><span>{t.kpis.commission144}</span></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginTop: 20 }}>
        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.monthlyTitle}</div>
              <div className="kpi-card-sub">{t.kpis.monthlySub}</div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-2)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--yellow)" }} />
                {t.kpis.egyptBookings}
              </span>
            </div>
          </div>
          <div style={{ padding: "18px 20px 14px" }}>
            <div className="chart-bars">
              {MONTHLY_CHART_DATA.map((d) => {
                const h = (d.bookings / max) * 150;
                return (
                  <div className={`chart-month ${d.current ? "current" : ""}`} key={d.month}>
                    <div className="chart-month-val">{d.bookings}</div>
                    <div className="chart-bar-stack" style={{ height: h }}>
                      <div className="chart-bar-e" style={{ height: "100%" }} />
                    </div>
                    <div className="chart-month-label">{t.kpis.months[d.month] ?? d.month}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>EGP {d.amount}K</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.statusTitle}</div>
              <div className="kpi-card-sub">{t.kpis.statusSub}</div>
            </div>
          </div>
          <div style={{ padding: "18px 20px 18px" }}>
            {([
              { dot: "var(--green)", key: "confirmed", w: 55, val: 21 },
              { dot: "var(--blue)", key: "checkedin", w: 21, val: 8 },
              { dot: "var(--orange)", key: "pending", w: 13, val: 5 },
              { dot: "var(--muted)", key: "checkedout", w: 8, val: 3 },
              { dot: "var(--red)", key: "cancelled", w: 3, val: 1 },
            ] as const).map((r) => (
              <div className="status-row" key={r.key}>
                <span className="status-dot" style={{ background: r.dot }} />
                <span className="status-name">{t.kpis.statuses[r.key]}</span>
                <div className="status-bar"><div style={{ width: `${r.w}%`, background: r.dot }} /></div>
                <b>{r.val}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.funnelTitle}</div>
              <div className="kpi-card-sub">{t.kpis.funnelSub}</div>
            </div>
          </div>
          <div style={{ padding: "14px 20px 18px" }}>
            <div className="funnel-row"><div className="funnel-label"><span>{t.kpis.funnel.received}</span><span className="funnel-num">124</span></div><div className="funnel-bar" style={{ width: "100%" }}><span>100%</span></div></div>
            <div className="funnel-row"><div className="funnel-label"><span>{t.kpis.funnel.qualified}</span><span className="funnel-num">98</span></div><div className="funnel-bar" style={{ width: "80%", background: "linear-gradient(90deg,var(--yellow-deep),var(--yellow))" }}><span>79%</span></div></div>
            <div className="funnel-row"><div className="funnel-label"><span>{t.kpis.funnel.quoted}</span><span className="funnel-num">71</span></div><div className="funnel-bar" style={{ width: "60%", background: "linear-gradient(90deg,#D97706,#FBA94A)" }}><span>57%</span></div></div>
            <div className="funnel-row"><div className="funnel-label"><span>{t.kpis.funnel.confirmed}</span><span className="funnel-num">38</span></div><div className="funnel-bar" style={{ width: "38%", background: "linear-gradient(90deg,#0A8754,#22C55E)" }}><span>30.6%</span></div></div>
            <div style={{ marginTop: 14, padding: "11px 13px", background: "var(--yellow-soft)", borderRadius: 8, fontSize: 12, color: "var(--charcoal)", display: "flex", gap: 9, alignItems: "flex-start" }}>
              <Icon.Lightning style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{t.kpis.funnelInsight}</div>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.catsTitle}</div>
              <div className="kpi-card-sub">{t.kpis.catsSub}</div>
            </div>
          </div>
          <div style={{ padding: "8px 0" }}>
            {([
              { color: "var(--charcoal)", bg: "#FFF3CC", key: "apartments", val: 22, w: 78, amount: "EGP 158,400" },
              { color: "var(--blue)", bg: "#E5EEFE", key: "villas", val: 8, w: 65, amount: "EGP 84,000" },
              { color: "var(--orange)", bg: "#FEF1E1", key: "penthouses", val: 2, w: 35, amount: "EGP 19,800" },
              { color: "var(--green)", bg: "#E3F4EC", key: "studios", val: 5, w: 22, amount: "EGP 18,500" },
              { color: "var(--red)", bg: "#FBE8E6", key: "chalets", val: 1, w: 12, amount: "EGP 6,800" },
            ] as const).map((c) => (
              <div className="cat-row" key={c.key}>
                <div className="cat-icon" style={{ background: c.bg, color: c.color }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21V12h6v9" />
                  </svg>
                </div>
                <div className="cat-info">
                  <div className="cat-name">{t.kpis.cats[c.key]}</div>
                  <div className="cat-meta"><b>{c.val}</b> {t.kpis.catsBookings}</div>
                </div>
                <div className="cat-bar"><div style={{ width: `${c.w}%`, background: c.color }} /></div>
                <div className="cat-amount">{c.amount}</div>
              </div>
            ))}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", background: "var(--ghost)", display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
              <span>{t.kpis.totalBookings}</span>
              <span style={{ color: "var(--green)" }}>EGP 287,500</span>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-card" style={{ marginTop: 16 }}>
        <div className="kpi-card-head">
          <div>
            <div className="kpi-card-title">{t.kpis.topTitle}</div>
            <div className="kpi-card-sub">{t.kpis.topSub}</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--ghost)" }}>
              {[t.kpis.topHeaders.rank, t.kpis.topHeaders.property, t.kpis.topHeaders.category, t.kpis.topHeaders.bookings, t.kpis.topHeaders.amount, t.kpis.topHeaders.commission].map((h, i) => (
                <th key={h + i} style={{ textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".6px", padding: "10px 16px", width: h === "#" ? 40 : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { rank: 1, name: "Zamalek Heights — Nile View", loc: "Zamalek, Cairo", cat: t.filters.types.apartment, bk: 9, am: "EGP 81,000", com: "EGP 4,050", topRank: true },
              { rank: 2, name: "Sahel Sapphire Villa", loc: "North Coast", cat: t.filters.types.villa, bk: 5, am: "EGP 87,500", com: "EGP 4,375" },
              { rank: 3, name: "New Cairo Garden Suite", loc: "New Cairo", cat: t.filters.types.apartment, bk: 7, am: "EGP 38,500", com: "EGP 1,925" },
              { rank: 4, name: "Alexandria Corniche Apartment", loc: "Alexandria", cat: t.filters.types.apartment, bk: 6, am: "EGP 28,500", com: "EGP 1,425" },
              { rank: 5, name: "Sheikh Zayed Family Villa", loc: "6th of October", cat: t.filters.types.villa, bk: 3, am: "EGP 21,000", com: "EGP 1,050" },
              { rank: 6, name: "Hurghada Marina Studio", loc: "Hurghada", cat: t.filters.types.studio, bk: 4, am: "EGP 14,800", com: "EGP 740" },
              { rank: 7, name: "Maadi Riverside Penthouse", loc: "Maadi, Cairo", cat: t.filters.types.penthouse, bk: 2, am: "EGP 19,800", com: "EGP 990" },
              { rank: 8, name: "Ain Sokhna Beach Chalet", loc: "Ain Sokhna", cat: t.filters.types.chalet, bk: 1, am: "EGP 6,800", com: "EGP 340" },
            ].map((r) => (
              <tr className="top-row" key={r.rank}>
                <td style={{ fontWeight: 600, color: r.topRank ? "var(--yellow-deep)" : "var(--text-2)" }}>{r.rank}</td>
                <td><div style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{r.loc}</div></td>
                <td><span className="guest-tag">{r.cat}</span></td>
                <td><b>{r.bk}</b></td>
                <td>{r.am}</td>
                <td style={{ color: "var(--green)", fontWeight: 500 }}>{r.com}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.goalTitle}</div>
              <div className="kpi-card-sub">{t.kpis.goalSub}</div>
            </div>
          </div>
          <div style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.5px" }}>38</span>
                <span style={{ color: "var(--muted)", fontSize: 14 }}> / 45</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 500, background: "var(--green-soft)", padding: "3px 9px", borderRadius: 5 }}>{t.kpis.onTrack}</span>
            </div>
            <div style={{ height: 10, background: "var(--ghost)", borderRadius: 5, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: "84%", height: "100%", background: "linear-gradient(90deg,var(--yellow-deep),var(--yellow))" }} />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.kpis.goalNote}</div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>{t.kpis.otherGoals}</div>
              {[
                { l: t.kpis.goalRows.amount, w: 82, b: "82%" },
                { l: t.kpis.goalRows.calls, w: 87, b: "87%" },
                { l: t.kpis.goalRows.repeat, w: 88, b: "88%" },
              ].map((g) => (
                <div className="goal-row" key={g.l}>
                  <span>{g.l}</span>
                  <div className="goal-bar"><div style={{ width: `${g.w}%` }} /></div>
                  <b>{g.b}</b>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.leaderboardTitle}</div>
              <div className="kpi-card-sub">{t.kpis.leaderboardSub}</div>
            </div>
          </div>
          <div style={{ padding: "6px 0" }}>
            {[
              { r: 1, a: "SA", n: "Sara Al-Mansoori", loc: `Cairo · 38 ${u}`, v: "EGP 287K", you: true },
              { r: 2, a: "YH", n: "Youssef Hamdan", loc: `Cairo · 34 ${u}`, v: "EGP 248K" },
              { r: 3, a: "MR", n: "Mariam Ramy", loc: `Alexandria · 29 ${u}`, v: "EGP 192K" },
              { r: 4, a: "OK", n: "Omar Kamal", loc: `North Coast · 24 ${u}`, v: "EGP 168K" },
              { r: 5, a: "NF", n: "Nour Farouk", loc: `Hurghada · 21 ${u}`, v: "EGP 134K" },
            ].map((row) => (
              <div className="lb-row" key={row.r}>
                <span className="lb-rank">{row.r}</span>
                <div className="guest-avatar-sm" style={row.you ? { background: "var(--yellow)", color: "var(--charcoal)" } : undefined}>{row.a}</div>
                <div className="lb-info">
                  <div className="lb-name">
                    {row.n}
                    {row.you && <span style={{ fontSize: 10, background: "var(--yellow)", color: "var(--charcoal)", padding: "1px 6px", borderRadius: 4, marginLeft: 5, fontWeight: 600 }}>{t.common.youBadge}</span>}
                  </div>
                  <div className="lb-meta">{row.loc}</div>
                </div>
                <div className="lb-val">{row.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
