"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "@/components/Icons";
import { type Property, type Guest } from "@/data";
import { DICT, type Lang } from "@/i18n";
import { searchUsers } from "@/lib/api";
import { propertyUrl, pName, pLoc, pDesc, pShortName, formatDate, cleanPhone, waLink, waShare, type SearchState } from "../_lib";

export function PropertyDetail({
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
