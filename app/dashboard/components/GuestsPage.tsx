"use client";

import { Icon } from "@/components/Icons";
import { type Guest } from "@/data";
import { DICT } from "@/i18n";

export function GuestsPage({
  t,
  guests,
  loading,
  onOpenGuest,
}: {
  t: typeof DICT["en"];
  guests: Guest[];
  loading: boolean;
  onOpenGuest: (id: string) => void;
}) {
  const headers = [t.guestsPage.headers.guest, t.guestsPage.headers.contact, t.guestsPage.headers.nationality, t.guestsPage.headers.bookings, t.guestsPage.headers.ltv, t.guestsPage.headers.lastStay];
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.2px" }}>{t.guestsPage.title}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>{t.guestsPage.subtitle}</div>
        </div>
        <div className="guest-actions" style={{ display: "flex", gap: 8 }}>
          <div className="guest-search-box" style={{ position: "relative" }}>
            <Icon.Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input type="text" className="input" placeholder={t.guestsPage.searchPlaceholder} style={{ paddingLeft: 34, width: 240 }} />
          </div>
          <button className="btn btn-primary btn-sm">{t.guestsPage.addGuest}</button>
        </div>
      </div>
      <div className="guest-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        <div className="stat-card sm"><div className="stat-card-label">{t.guestsPage.stats.total}</div><div className="stat-card-value sm">2,847</div><div className="stat-card-meta"><span className="trend up">↑ 142</span><span>{t.guestsPage.stats.thisMonth}</span></div></div>
        <div className="stat-card sm"><div className="stat-card-label">{t.guestsPage.stats.repeat}</div><div className="stat-card-value sm">31%</div><div className="stat-card-meta"><span className="trend up">↑ 4 pts</span></div></div>
        <div className="stat-card sm"><div className="stat-card-label">{t.guestsPage.stats.avgLtv}</div><div className="stat-card-value sm">EGP 62,400</div><div className="stat-card-meta"><span className="trend up">↑ 8%</span></div></div>
        <div className="stat-card sm"><div className="stat-card-label">{t.guestsPage.stats.vip}</div><div className="stat-card-value sm">84</div><div className="stat-card-meta"><span style={{ color: "var(--muted)" }}>{t.guestsPage.stats.vipNote}</span></div></div>
      </div>
      <div className="guest-table-wrap" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14}}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--ghost)" }}>
              {headers.map((h) => (
                <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".6px", padding: "11px 16px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && guests.length === 0 && Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skel-${i}`}>
                {headers.map((__, j) => (
                  <td key={j} style={{ padding: "13px 16px" }}>
                    <div className="pd-skel line" style={{ width: j === 0 ? "80%" : "60%", marginBottom: 0 }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && guests.length === 0 && (
              <tr>
                <td colSpan={headers.length} style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                  —
                </td>
              </tr>
            )}
            {guests.map((g) => (
              <tr key={g.id} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => onOpenGuest(g.id)}>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="guest-avatar-sm">{(g.first[0] ?? "").toUpperCase()}{(g.last[0] ?? "").toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{g.first} {g.last}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{g.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "13px 16px" }}>
                  <div style={{ fontSize: 12.5 }}>{g.email}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{g.phone}</div>
                </td>
                <td style={{ padding: "13px 16px", fontSize: 13 }}>{g.nat}</td>
                <td style={{ padding: "13px 16px", fontWeight: 600 }}>{g.bookings}</td>
                <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--green)" }}>{g.ltv}</td>
                <td style={{ padding: "13px 16px", fontSize: 12.5, color: "var(--text-2)" }}>{g.lastStay || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
