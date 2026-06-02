"use client";

import type React from "react";
import { Icon } from "@/components/Icons";
import { type Property, type Guest } from "@/data";
import { DICT, type Lang } from "@/i18n";
import { createUser, ApiError, type LookupItem } from "@/lib/api";
import { useSubmitting } from "@/hooks/useSubmitting";
import { pLoc, pShortName, formatDate, waLink, type BookingState, type SearchState, type Totals } from "../_lib";

export function BookingFlow({
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
