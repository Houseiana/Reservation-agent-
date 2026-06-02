"use client";

import { useState, useEffect } from "react";
import type React from "react";
import { Icon } from "@/components/Icons";
import { TODAY_STR, type Booking } from "@/data";
import { DICT, type Lang } from "@/i18n";
import { tierOf, urgencyOf, freeCancelDeadline, pShortName, pLoc, formatDate, waLink, cleanPhone, propertyUrl, fmtTimeLeft } from "../_lib";

export // derive "free cancel until" date from policy text
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
