"use client";

import { useState, useMemo } from "react";
import { Icon } from "@/components/Icons";
import { TODAY_STR, type Booking } from "@/data";
import { DICT, type Lang } from "@/i18n";
import { type LookupItem } from "@/lib/api";
import { urgencyOf, tierOf, statusNameToEnum, pShortName, pLoc, formatDateShort, type BookingFilter } from "../_lib";
import { CHANNEL_ICON } from "./ChannelIcon";

export function BookingsPage({
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
