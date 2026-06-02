"use client";

import type React from "react";
import { Icon } from "@/components/Icons";
import { TODAY_STR, type Guest, type Booking } from "@/data";
import { DICT, type Lang } from "@/i18n";
import { tierOf, pShortName, pLoc, formatDate, formatDateShort, waLink, cleanPhone, daysBetween } from "../_lib";
import { CHANNEL_ICON } from "./ChannelIcon";

export function GuestDetailDrawer({
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
