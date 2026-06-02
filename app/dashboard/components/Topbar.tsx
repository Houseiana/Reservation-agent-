"use client";

import { useState } from "react";
import type React from "react";
import { Icon } from "@/components/Icons";
import { DESTINATIONS } from "@/data";
import { DICT, type Lang } from "@/i18n";
import { formatDateShort, type SearchState, type InboxTab } from "../_lib";

export function Topbar({
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
