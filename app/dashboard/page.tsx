"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Property, type Guest } from "@/data";
import { Icon } from "@/components/Icons";
import {
  listProperties,
  listGuests,
  createBooking,
  confirmBooking as confirmBookingApi,
  searchUsers,
  getProperty,
  getPropertyTypes,
  getAmenities,
  getSortOptions,
  getPaymentMethods,
  ApiError,
} from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useUser } from "@clerk/nextjs";

import {
  pShortName, formatDateShort, pageNumbers,
  type FiltersState, type SearchState, type BookingState,
} from "./_lib";
import { PropertyDetailSkeleton } from "./components/PropertyDetailSkeleton";
import { PropertyCard } from "./components/PropertyCard";
import { Filters } from "./components/Filters";
import { Topbar } from "./components/Topbar";
import { PropertyDetail } from "./components/PropertyDetail";
import { BookingFlow } from "./components/BookingFlow";
import { useDashboard } from "./dashboard-context";

export default function Page() {
  const { user } = useUser();
  const adminId = user?.id ?? "";
  const { lang, rtl, setRtl, t, toast, openInbox } = useDashboard();

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
  // Free-text "search by title" box in the results header. The raw input
  // updates on every keystroke; titleQuery is debounced and is what actually
  // feeds the property-search `search` param.
  const [titleInput, setTitleInput] = useState("");
  const [titleQuery, setTitleQuery] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setTitleQuery(titleInput.trim()), 300);
    return () => clearTimeout(id);
  }, [titleInput]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(["booking"]));
  const [whereDropdown, setWhereDropdown] = useState(false);
  // Mobile-only — controls the filters drawer slide. Desktop shows filters inline.
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    { enabled: selectedProperty !== null },
  );
  const guests = guestsResult.data?.items ?? [];
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

  // Lookups (property types / amenities / sort) come from
  // /api/reservation-agent-lookup/*. We keep them in state so the page
  // Lookups (property types / amenities / sort / booking statuses) come
  // from /api/reservation-agent-lookup/*. Selections store integer IDs
  // directly so we hand them to the search API with no slug translation.
  const propertyTypesLookup = useAsync((signal) => getPropertyTypes(signal), []);
  const amenitiesLookup = useAsync((signal) => getAmenities(signal), []);
  const sortLookup = useAsync((signal) => getSortOptions(signal), []);
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
  // The backend's property-search endpoint ignores any text query param, so
  // title search is done on the client. When a title query is active we pull
  // the full (server-filtered) result set in one page and filter/paginate it
  // locally. The dataset is small (~100 properties) so this is cheap.
  const TITLE_FETCH_LIMIT = 300;
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
    titleQuery,
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
          page: titleQuery ? 1 : searchPage,
          limit: titleQuery ? TITLE_FETCH_LIMIT : PAGE_SIZE,
        },
        signal,
      ),
    [
      search.where,
      titleQuery,
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

  const rawItems = searchResult.data?.items ?? [];
  // Client-side title filter (backend ignores text search — see TITLE_FETCH_LIMIT).
  const titleMatches = useMemo(() => {
    const needle = titleQuery.toLowerCase();
    if (!needle) return rawItems;
    return rawItems.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.nameAr.toLowerCase().includes(needle),
    );
  }, [rawItems, titleQuery]);
  // In title mode we fetched the full set, so slice it for the current page;
  // otherwise the server already returned just this page.
  const filtered = titleQuery
    ? titleMatches.slice((searchPage - 1) * PAGE_SIZE, searchPage * PAGE_SIZE)
    : titleMatches;
  const totalResults = titleQuery ? titleMatches.length : (searchResult.data?.total ?? 0);
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
      // Prefer the human-readable booking code (R-XXXX) — the UUID is
      // shown only as a last resort if neither response carries a code.
      setConfRef(confirmed.ref || bookingDraft?.ref || bookingId);
      setBooking((b) => ({ ...b, step: 3 }));
      toast(t.toast.bookingConfirmed);
    } catch (e) {
      toast(describeError(e, "Failed to confirm booking"));
    }
  }

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
    <>
      {/* Mobile-only filters button + backdrop. Hidden on desktop via CSS. */}
      <button
        className="mobile-toggle filter-toggle"
        onClick={() => setFiltersOpen((v) => !v)}
        aria-label="Open filters"
      >
        <Icon.Filter />
      </button>
      {filtersOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setFiltersOpen(false)}
        />
      )}
      <main className="main">
        <Topbar
          search={search}
          setSearch={setSearch}
          whereDropdown={whereDropdown}
          setWhereDropdown={setWhereDropdown}
          rtl={rtl}
          setRtl={setRtl}
          openInbox={openInbox}
          onSearch={() => toast(t.toast.searchUpdated)}
          t={t}
          lang={lang}
        />
        <div className="content">
          <section className="page active" id="page-search">
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
                  <input
                    type="search"
                    className="results-search"
                    placeholder={t.results.searchByTitle}
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    aria-label={t.results.searchByTitle}
                  />
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
                  {filtered.map((p) => (
                    <PropertyCard
                      key={p.id}
                      p={p}
                      isFav={favs.has(p.id)}
                      onFav={() => toggleFav(p.id)}
                      onOpen={() => openPropertyDrawer(p)}
                      t={t}
                      lang={lang}
                      holdMsLeft={0}
                    />
                  ))}
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

      {/* Where dropdown - mounted above topbar via portal-ish absolute */}
      {whereDropdown && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 25 }}
          onClick={() => setWhereDropdown(false)}
        />
      )}
    </>
  );
}

