"use client";

import { Icon } from "@/components/Icons";
import { DICT } from "@/i18n";
import { type PageKey } from "../_lib";
import { SignedInAgentCard } from "./SignedInAgentCard";

export function Sidebar({
  page,
  setPage,
  simulateCall,
  bookingsCount,
  open,
  onCollapse,
  t,
}: {
  page: PageKey;
  setPage: (p: PageKey) => void;
  simulateCall: () => void;
  /** Total bookings from the list API. Undefined until first fetch. */
  bookingsCount: number | undefined;
  /** Mobile-only — controls the drawer slide. Ignored on desktop layout. */
  open: boolean;
  /** Desktop-only — collapse the sidebar to widen the workspace. */
  onCollapse: () => void;
  t: typeof DICT["en"];
}) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <div className="brand-logo-wrap">
          <img className="brand-logo" src="/full_logo.png" alt="Houseiana" />
          <div className="brand-sub">Agent Console</div>
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>
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
          {t.nav.bookings}
          {bookingsCount !== undefined && <span className="nav-badge">{bookingsCount}</span>}
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
      <SignedInAgentCard t={t} />
      <div className="sidebar-foot">v2.4.1 · © Houseiana 2026</div>
    </aside>
  );
}
