"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DESTINATIONS,
  INBOX,
  INCOMING_CALLERS,
  MONTHLY_CHART_DATA,
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

import {
  pName, pLoc, pDesc, pShortName,
  formatDate, formatDateShort, propertyUrl, cleanPhone, fmtTimeLeft,
  waLink, waShare, pageNumbers,
  statusNameToEnum, daysBetween, urgencyOf, tierOf, freeCancelDeadline,
  type PageKey, type InboxTab, type FiltersState, type SearchState,
  type BookingState, type Totals, type BookingFilter,
} from "./_lib";
import { PropertyDetailSkeleton } from "./components/PropertyDetailSkeleton";
import { PropertyCard } from "./components/PropertyCard";
import { Sidebar } from "./components/Sidebar";
import { Filters } from "./components/Filters";
import { KpisPage } from "./components/KpisPage";
import { GuestsPage } from "./components/GuestsPage";
import { CHANNEL_ICON } from "./components/ChannelIcon";
import { GuestDetailDrawer } from "./components/GuestDetailDrawer";

export default function Page() {
  const { user } = useUser();
  const adminId = user?.id ?? "";

  const [page, setPage] = useState<PageKey>("search");
  const [search, setSearch] = useState<SearchState>({
    where: "",
    checkin: "",
    checkout: "",
    guests: 1,
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
  // Mobile drawer state — desktop ignores these because CSS shows sidebar/filters inline.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop-only: collapse the sidebar to widen the workspace. Ignored on
  // mobile, where the sidebar is a drawer driven by sidebarOpen.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    <div className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        page={page}
        setPage={(p) => { setPage(p); setSidebarOpen(false); }}
        simulateCall={simulateIncomingCall}
        bookingsCount={bookingsResult.data?.total}
        open={sidebarOpen}
        onCollapse={() => setSidebarCollapsed(true)}
        t={t}
      />
      {/* Desktop-only: re-open the collapsed sidebar. Hidden unless
          .app.sidebar-collapsed is set; CSS keeps it off on mobile. */}
      <button
        className="desktop-sidebar-reopen"
        onClick={() => setSidebarCollapsed(false)}
        aria-label="Open sidebar"
        title="Open sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      {/* Mobile-only floating buttons + backdrop. Hidden on desktop via CSS. */}
      <button
        className="mobile-toggle nav-toggle"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      {page === "search" && (
        <button
          className="mobile-toggle filter-toggle"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label="Open filters"
        >
          <Icon.Filter />
        </button>
      )}
      {(sidebarOpen || filtersOpen) && (
        <div
          className="mobile-backdrop"
          onClick={() => { setSidebarOpen(false); setFiltersOpen(false); }}
        />
      )}
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
              open={filtersOpen}
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

          <section className={`page ${page === "bookings" ? "active" : ""}`} id="page-bookings" style={{ padding: 16, flexDirection: "column", overflowY: "auto", height: "100%", flex: 1, minHeight: 0 }}>
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

          <section className={`page ${page === "kpis" ? "active" : ""}`} id="page-kpis" style={{ padding: 16, flexDirection: "column", overflowY: "auto", height: "100%", flex: 1, minHeight: 0 }}>
            <KpisPage t={t} />
          </section>

          <section className={`page ${page === "guests" ? "active" : ""}`} id="page-guests" style={{ padding: 16, flexDirection: "column", overflowY: "auto", height: "100%", flex: 1, minHeight: 0 }}>
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
        {propertyDetail && drawerView === "detail" && totals && (() => {
          // Prefer the backend's authoritative total when the detail
          // endpoint returned a pricing breakdown.
          const footerTotal = propertyDetail.pricing?.total ?? totals.total;
          const nightlyRate = propertyDetail.pricing?.nightlyRate ?? propertyDetail.price;
          const nightsCount = propertyDetail.pricing?.nights ?? Math.max(1, search.nights);
          return (
            <div className="drawer-foot" style={{ display: "flex" }}>
              <div className="drawer-foot-price">
                <b>{propertyDetail.currency} {footerTotal.toLocaleString()}</b>
                <span>{t.detail.nightsTotal}</span>
                <small>{t.detail.inclusive(propertyDetail.currency, nightlyRate.toLocaleString(), nightsCount)}</small>
              </div>
              <button className="btn btn-primary btn-lg" onClick={startBooking}>{t.common.continueBooking}</button>
            </div>
          );
        })()}
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
  // Mobile only: the multi-field pill collapses into a compact summary bar
  // that opens the full (stacked) search as a top sheet. Desktop ignores this.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  function adjustGuests(delta: number) {
    setSearch((s) => ({ ...s, guests: Math.max(1, Math.min(20, s.guests + delta)) }));
  }
  const searchSummary = [
    search.where || t.topbar.searchPlaceholder,
    `${formatDateShort(search.checkin)} – ${formatDateShort(search.checkout)}`,
    t.topbar.addGuests(search.guests),
  ].join(" · ");
  return (
    <div className="topbar">
      {/* Mobile-only brand mark, centred between the fixed menu + filter
          buttons; the search bar sits on the row below (see CSS). */}
      <img className="topbar-logo" src="/full_logo.png" alt="Houseiana" />
      <button
        type="button"
        className="mobile-search-summary"
        onClick={() => setMobileSearchOpen(true)}
      >
        <Icon.Search size={15} />
        <span className="mss-text">{searchSummary}</span>
      </button>
      {mobileSearchOpen && (
        <div className="mobile-search-backdrop" onClick={() => setMobileSearchOpen(false)} />
      )}
      <div className={`search-pill ${mobileSearchOpen ? "mobile-open" : ""}`}>
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
            value={t.topbar.addGuests(search.guests)}
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
                      disabled={search.guests <= 1}
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
        <button
          className="search-go"
          onClick={() => { onSearch(); setMobileSearchOpen(false); }}
          title={t.nav.search}
        >
          <Icon.Search size={16} style={{ strokeWidth: 2.5 }} />
          <span className="search-go-label">{t.nav.search}</span>
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
   PROPERTY DETAIL
============================================================ */

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

  // Quote calculations — prefer the backend pricing breakdown when it
  // exists (detail endpoint), fall back to local computation otherwise.
  const qNightly = p.pricing?.nightlyRate ?? p.price;
  const qNights = p.pricing?.nights ?? nights;
  const qSubtotal = p.pricing?.subtotal ?? qNightly * qNights;
  const qCleaning = p.pricing?.cleaningFee ?? p.fees.cleaning;
  const qUtilities = p.pricing ? p.pricing.waterFee + p.pricing.electricityFee : p.fees.utilities;
  const qServiceFee = p.pricing?.serviceFee ?? Math.round((qSubtotal * p.fees.bookingFeePct) / 100);
  const qTotal = p.pricing?.total ?? qSubtotal + qCleaning + qUtilities + qServiceFee;
  const quoteMsg = t.detail.quoteMsg(
    quoteFirstName || "there",
    quoteRef,
    pName(p, lang),
    pLoc(p, lang),
    formatDate(search.checkin),
    formatDate(search.checkout),
    qNights,
    `${p.currency} ${qNightly.toLocaleString()} × ${qNights} = ${p.currency} ${qSubtotal.toLocaleString()}`,
    `${p.currency} ${qCleaning.toLocaleString()}`,
    `${p.currency} ${qUtilities.toLocaleString()}`,
    `${p.currency} ${qServiceFee.toLocaleString()}`,
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
                <div className="owner-phone">{p.owner.phone || "—"}</div>
                {p.owner.email && (
                  <div className="owner-phone" style={{ fontSize: 11 }}>{p.owner.email}</div>
                )}
              </div>
              <div className="owner-actions">
                {p.owner.phone && (
                  <a className="owner-btn call" href={`tel:${cleanPhone(p.owner.phone)}`} title={t.owner.callOwner}>
                    <Icon.Phone size={16} />
                  </a>
                )}
                {(p.owner.whatsapp || p.owner.phone) && (
                  <a
                    className="owner-btn wa"
                    href={waLink(p.owner.whatsapp || p.owner.phone, ownerMessage)}
                    target="_blank"
                    rel="noreferrer"
                    title={t.owner.waOwner}
                  >
                    <Icon.WhatsApp size={16} />
                  </a>
                )}
                {p.owner.email && (
                  <a
                    className="owner-btn"
                    href={`mailto:${p.owner.email}?subject=${encodeURIComponent(pName(p, lang))}&body=${encodeURIComponent(ownerMessage)}`}
                    title="Email owner"
                    style={{ background: "var(--ghost)", color: "var(--text)" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </a>
                )}
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
        {(() => {
          // Prefer the backend's pricing breakdown when present (detail
          // endpoint returns it). Fall back to local computation otherwise.
          const pr = p.pricing;
          const nightlyRate = pr?.nightlyRate || p.price;
          const nightsCount = pr?.nights || nights;
          const subtotal = pr?.subtotal ?? nightlyRate * nightsCount;
          const cleaningFee = pr?.cleaningFee ?? p.fees.cleaning;
          const utilities = pr ? pr.waterFee + pr.electricityFee : p.fees.utilities;
          const serviceFee = pr?.serviceFee ?? Math.round((subtotal * p.fees.bookingFeePct) / 100);
          const total = pr?.total ?? subtotal + cleaningFee + utilities + serviceFee;
          return (
            <>
              <div className="sum-row">
                <span>{p.currency} {nightlyRate.toLocaleString()} × {nightsCount} {t.common.nights}</span>
                <b>{p.currency} {subtotal.toLocaleString()}</b>
              </div>
              {cleaningFee > 0 && (
                <div className="sum-row"><span>{t.detail.cleaning}</span><b>{p.currency} {cleaningFee.toLocaleString()}</b></div>
              )}
              {utilities > 0 && (
                <div className="sum-row"><span>{t.detail.utilities}</span><b>{p.currency} {utilities.toLocaleString()}</b></div>
              )}
              {serviceFee > 0 && (
                <div className="sum-row">
                  <span>Service fee</span>
                  <b>{p.currency} {serviceFee.toLocaleString()}</b>
                </div>
              )}
              <div className="sum-divider" />
              <div className="sum-row" style={{ fontWeight: 600, fontSize: 14 }}>
                <span>{t.detail.nightsTotal}</span>
                <b>{p.currency} {total.toLocaleString()}</b>
              </div>
              {p.fees.deposit > 0 && (
                <div className="sum-row" style={{ color: "var(--muted)", fontSize: 11.5 }}>
                  <span>{t.detail.deposit}</span>
                  <span>{p.currency} {p.fees.deposit.toLocaleString()}</span>
                </div>
              )}
            </>
          );
        })()}
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

