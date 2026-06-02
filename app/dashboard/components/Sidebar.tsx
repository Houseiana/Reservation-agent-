"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icons";
import { DICT } from "@/i18n";
import { SignedInAgentCard } from "./SignedInAgentCard";

export function Sidebar({
  simulateCall,
  bookingsCount,
  open,
  onCollapse,
  onNavigate,
  t,
}: {
  simulateCall: () => void;
  /** Total bookings from the list API. Undefined until first fetch. */
  bookingsCount: number | undefined;
  /** Mobile-only — controls the drawer slide. Ignored on desktop layout. */
  open: boolean;
  /** Desktop-only — collapse the sidebar to widen the workspace. */
  onCollapse: () => void;
  /** Called after a nav link is followed (closes the mobile drawer). */
  onNavigate: () => void;
  t: typeof DICT["en"];
}) {
  const pathname = usePathname();
  const isSearch = pathname === "/dashboard";
  const isBookings = pathname.startsWith("/dashboard/bookings");
  const isGuests = pathname.startsWith("/dashboard/guests");
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
        <Link href="/dashboard" className={`nav-item ${isSearch ? "active" : ""}`} onClick={onNavigate}>
          <Icon.Search className="nav-icon" />
          {t.nav.search}
        </Link>
        <Link href="/dashboard/bookings" className={`nav-item ${isBookings ? "active" : ""}`} onClick={onNavigate}>
          <Icon.Calendar className="nav-icon" />
          {t.nav.bookings}
          {bookingsCount !== undefined && <span className="nav-badge">{bookingsCount}</span>}
        </Link>
        <Link href="/dashboard/guests" className={`nav-item ${isGuests ? "active" : ""}`} onClick={onNavigate}>
          <Icon.Users className="nav-icon" />
          {t.nav.guests}
        </Link>
      </nav>
      <SignedInAgentCard t={t} />
      <div className="sidebar-foot">v2.4.1 · © Houseiana 2026</div>
    </aside>
  );
}
