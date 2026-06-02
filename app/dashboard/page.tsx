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
import { Filters } from "./components/Filters";
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

