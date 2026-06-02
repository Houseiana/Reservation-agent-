"use client";

import { Icon } from "@/components/Icons";
import { MONTHLY_CHART_DATA } from "@/data";
import { DICT } from "@/i18n";

export function KpisPage({ t }: { t: typeof DICT["en"] }) {
  const max = 45;
  const u = t.kpis.units;
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.2px" }}>{t.kpis.title}</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>{t.kpis.subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="sort-select">
            <option value="mtd">{t.kpis.periods.mtd}</option>
            <option value="last">{t.kpis.periods.last}</option>
            <option value="qtd">{t.kpis.periods.qtd}</option>
            <option value="ytd">{t.kpis.periods.ytd}</option>
            <option value="all">{t.kpis.periods.all}</option>
          </select>
          <button className="btn btn-secondary btn-sm"><Icon.Download /> {t.kpis.exportBtn}</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginTop: 20 }}>
        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--blue-soft)", color: "var(--blue)", display: "grid", placeItems: "center" }}>
              <Icon.Phone size={15} />
            </div>
            <div className="stat-card-label" style={{ margin: 0 }}>{t.kpis.callsReceived}</div>
          </div>
          <div className="stat-card-value">124</div>
          <div className="stat-card-meta"><span className="trend up">↑ 18</span><span>{t.kpis.vsLast}</span></div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--green-soft)", color: "var(--green)", display: "grid", placeItems: "center" }}>
              <Icon.Check size={15} />
            </div>
            <div className="stat-card-label" style={{ margin: 0 }}>{t.kpis.callsConverted}</div>
          </div>
          <div className="stat-card-value">38</div>
          <div className="stat-card-meta"><span className="trend up">↑ 14%</span><span>{t.kpis.bookedFromCalls}</span></div>
        </div>

        <div className="stat-card" style={{ background: "linear-gradient(135deg,var(--charcoal) 0%,var(--charcoal-2) 100%)", color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "var(--yellow)", opacity: 0.12 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(252,197,25,.2)", color: "var(--yellow)", display: "grid", placeItems: "center" }}>
              <Icon.Verified />
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: ".7px", fontWeight: 500 }}>{t.kpis.conversionRate}</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, marginTop: 6, letterSpacing: "-.4px", color: "var(--yellow)" }}>30.6%</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 11.5 }}>
            <span style={{ background: "rgba(34,197,94,.18)", color: "#86EFAC", padding: "2px 7px", borderRadius: 5, fontWeight: 500 }}>↑ 4 pts</span>
            <span style={{ color: "rgba(255,255,255,.6)" }}>{t.kpis.teamAvg}</span>
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--yellow-soft)", color: "var(--charcoal)", display: "grid", placeItems: "center" }}>
              <Icon.Calendar size={15} />
            </div>
            <div className="stat-card-label" style={{ margin: 0 }}>{t.kpis.bookingsMine}</div>
          </div>
          <div className="stat-card-value">38</div>
          <div className="stat-card-meta"><span style={{ color: "var(--muted)" }}>{t.kpis.allTime142}</span></div>
        </div>

        <div className="stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--green-soft)", color: "var(--green)", display: "grid", placeItems: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </div>
            <div className="stat-card-label" style={{ margin: 0 }}>{t.kpis.totalAmount}</div>
          </div>
          <div className="stat-card-value" style={{ color: "var(--green)" }}>EGP 287K</div>
          <div className="stat-card-meta"><span className="trend up">↑ 22%</span><span>{t.kpis.commission144}</span></div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginTop: 20 }}>
        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.monthlyTitle}</div>
              <div className="kpi-card-sub">{t.kpis.monthlySub}</div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-2)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--yellow)" }} />
                {t.kpis.egyptBookings}
              </span>
            </div>
          </div>
          <div style={{ padding: "18px 20px 14px" }}>
            <div className="chart-bars">
              {MONTHLY_CHART_DATA.map((d) => {
                const h = (d.bookings / max) * 150;
                return (
                  <div className={`chart-month ${d.current ? "current" : ""}`} key={d.month}>
                    <div className="chart-month-val">{d.bookings}</div>
                    <div className="chart-bar-stack" style={{ height: h }}>
                      <div className="chart-bar-e" style={{ height: "100%" }} />
                    </div>
                    <div className="chart-month-label">{t.kpis.months[d.month] ?? d.month}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>EGP {d.amount}K</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.statusTitle}</div>
              <div className="kpi-card-sub">{t.kpis.statusSub}</div>
            </div>
          </div>
          <div style={{ padding: "18px 20px 18px" }}>
            {([
              { dot: "var(--green)", key: "confirmed", w: 55, val: 21 },
              { dot: "var(--blue)", key: "checkedin", w: 21, val: 8 },
              { dot: "var(--orange)", key: "pending", w: 13, val: 5 },
              { dot: "var(--muted)", key: "checkedout", w: 8, val: 3 },
              { dot: "var(--red)", key: "cancelled", w: 3, val: 1 },
            ] as const).map((r) => (
              <div className="status-row" key={r.key}>
                <span className="status-dot" style={{ background: r.dot }} />
                <span className="status-name">{t.kpis.statuses[r.key]}</span>
                <div className="status-bar"><div style={{ width: `${r.w}%`, background: r.dot }} /></div>
                <b>{r.val}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.funnelTitle}</div>
              <div className="kpi-card-sub">{t.kpis.funnelSub}</div>
            </div>
          </div>
          <div style={{ padding: "14px 20px 18px" }}>
            <div className="funnel-row"><div className="funnel-label"><span>{t.kpis.funnel.received}</span><span className="funnel-num">124</span></div><div className="funnel-bar" style={{ width: "100%" }}><span>100%</span></div></div>
            <div className="funnel-row"><div className="funnel-label"><span>{t.kpis.funnel.qualified}</span><span className="funnel-num">98</span></div><div className="funnel-bar" style={{ width: "80%", background: "linear-gradient(90deg,var(--yellow-deep),var(--yellow))" }}><span>79%</span></div></div>
            <div className="funnel-row"><div className="funnel-label"><span>{t.kpis.funnel.quoted}</span><span className="funnel-num">71</span></div><div className="funnel-bar" style={{ width: "60%", background: "linear-gradient(90deg,#D97706,#FBA94A)" }}><span>57%</span></div></div>
            <div className="funnel-row"><div className="funnel-label"><span>{t.kpis.funnel.confirmed}</span><span className="funnel-num">38</span></div><div className="funnel-bar" style={{ width: "38%", background: "linear-gradient(90deg,#0A8754,#22C55E)" }}><span>30.6%</span></div></div>
            <div style={{ marginTop: 14, padding: "11px 13px", background: "var(--yellow-soft)", borderRadius: 8, fontSize: 12, color: "var(--charcoal)", display: "flex", gap: 9, alignItems: "flex-start" }}>
              <Icon.Lightning style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{t.kpis.funnelInsight}</div>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.catsTitle}</div>
              <div className="kpi-card-sub">{t.kpis.catsSub}</div>
            </div>
          </div>
          <div style={{ padding: "8px 0" }}>
            {([
              { color: "var(--charcoal)", bg: "#FFF3CC", key: "apartments", val: 22, w: 78, amount: "EGP 158,400" },
              { color: "var(--blue)", bg: "#E5EEFE", key: "villas", val: 8, w: 65, amount: "EGP 84,000" },
              { color: "var(--orange)", bg: "#FEF1E1", key: "penthouses", val: 2, w: 35, amount: "EGP 19,800" },
              { color: "var(--green)", bg: "#E3F4EC", key: "studios", val: 5, w: 22, amount: "EGP 18,500" },
              { color: "var(--red)", bg: "#FBE8E6", key: "chalets", val: 1, w: 12, amount: "EGP 6,800" },
            ] as const).map((c) => (
              <div className="cat-row" key={c.key}>
                <div className="cat-icon" style={{ background: c.bg, color: c.color }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21V12h6v9" />
                  </svg>
                </div>
                <div className="cat-info">
                  <div className="cat-name">{t.kpis.cats[c.key]}</div>
                  <div className="cat-meta"><b>{c.val}</b> {t.kpis.catsBookings}</div>
                </div>
                <div className="cat-bar"><div style={{ width: `${c.w}%`, background: c.color }} /></div>
                <div className="cat-amount">{c.amount}</div>
              </div>
            ))}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", background: "var(--ghost)", display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
              <span>{t.kpis.totalBookings}</span>
              <span style={{ color: "var(--green)" }}>EGP 287,500</span>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-card" style={{ marginTop: 16 }}>
        <div className="kpi-card-head">
          <div>
            <div className="kpi-card-title">{t.kpis.topTitle}</div>
            <div className="kpi-card-sub">{t.kpis.topSub}</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--ghost)" }}>
              {[t.kpis.topHeaders.rank, t.kpis.topHeaders.property, t.kpis.topHeaders.category, t.kpis.topHeaders.bookings, t.kpis.topHeaders.amount, t.kpis.topHeaders.commission].map((h, i) => (
                <th key={h + i} style={{ textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".6px", padding: "10px 16px", width: h === "#" ? 40 : undefined }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { rank: 1, name: "Zamalek Heights — Nile View", loc: "Zamalek, Cairo", cat: t.filters.types.apartment, bk: 9, am: "EGP 81,000", com: "EGP 4,050", topRank: true },
              { rank: 2, name: "Sahel Sapphire Villa", loc: "North Coast", cat: t.filters.types.villa, bk: 5, am: "EGP 87,500", com: "EGP 4,375" },
              { rank: 3, name: "New Cairo Garden Suite", loc: "New Cairo", cat: t.filters.types.apartment, bk: 7, am: "EGP 38,500", com: "EGP 1,925" },
              { rank: 4, name: "Alexandria Corniche Apartment", loc: "Alexandria", cat: t.filters.types.apartment, bk: 6, am: "EGP 28,500", com: "EGP 1,425" },
              { rank: 5, name: "Sheikh Zayed Family Villa", loc: "6th of October", cat: t.filters.types.villa, bk: 3, am: "EGP 21,000", com: "EGP 1,050" },
              { rank: 6, name: "Hurghada Marina Studio", loc: "Hurghada", cat: t.filters.types.studio, bk: 4, am: "EGP 14,800", com: "EGP 740" },
              { rank: 7, name: "Maadi Riverside Penthouse", loc: "Maadi, Cairo", cat: t.filters.types.penthouse, bk: 2, am: "EGP 19,800", com: "EGP 990" },
              { rank: 8, name: "Ain Sokhna Beach Chalet", loc: "Ain Sokhna", cat: t.filters.types.chalet, bk: 1, am: "EGP 6,800", com: "EGP 340" },
            ].map((r) => (
              <tr className="top-row" key={r.rank}>
                <td style={{ fontWeight: 600, color: r.topRank ? "var(--yellow-deep)" : "var(--text-2)" }}>{r.rank}</td>
                <td><div style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{r.loc}</div></td>
                <td><span className="guest-tag">{r.cat}</span></td>
                <td><b>{r.bk}</b></td>
                <td>{r.am}</td>
                <td style={{ color: "var(--green)", fontWeight: 500 }}>{r.com}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.goalTitle}</div>
              <div className="kpi-card-sub">{t.kpis.goalSub}</div>
            </div>
          </div>
          <div style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-.5px" }}>38</span>
                <span style={{ color: "var(--muted)", fontSize: 14 }}> / 45</span>
              </div>
              <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 500, background: "var(--green-soft)", padding: "3px 9px", borderRadius: 5 }}>{t.kpis.onTrack}</span>
            </div>
            <div style={{ height: 10, background: "var(--ghost)", borderRadius: 5, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: "84%", height: "100%", background: "linear-gradient(90deg,var(--yellow-deep),var(--yellow))" }} />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{t.kpis.goalNote}</div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>{t.kpis.otherGoals}</div>
              {[
                { l: t.kpis.goalRows.amount, w: 82, b: "82%" },
                { l: t.kpis.goalRows.calls, w: 87, b: "87%" },
                { l: t.kpis.goalRows.repeat, w: 88, b: "88%" },
              ].map((g) => (
                <div className="goal-row" key={g.l}>
                  <span>{g.l}</span>
                  <div className="goal-bar"><div style={{ width: `${g.w}%` }} /></div>
                  <b>{g.b}</b>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <div>
              <div className="kpi-card-title">{t.kpis.leaderboardTitle}</div>
              <div className="kpi-card-sub">{t.kpis.leaderboardSub}</div>
            </div>
          </div>
          <div style={{ padding: "6px 0" }}>
            {[
              { r: 1, a: "SA", n: "Sara Al-Mansoori", loc: `Cairo · 38 ${u}`, v: "EGP 287K", you: true },
              { r: 2, a: "YH", n: "Youssef Hamdan", loc: `Cairo · 34 ${u}`, v: "EGP 248K" },
              { r: 3, a: "MR", n: "Mariam Ramy", loc: `Alexandria · 29 ${u}`, v: "EGP 192K" },
              { r: 4, a: "OK", n: "Omar Kamal", loc: `North Coast · 24 ${u}`, v: "EGP 168K" },
              { r: 5, a: "NF", n: "Nour Farouk", loc: `Hurghada · 21 ${u}`, v: "EGP 134K" },
            ].map((row) => (
              <div className="lb-row" key={row.r}>
                <span className="lb-rank">{row.r}</span>
                <div className="guest-avatar-sm" style={row.you ? { background: "var(--yellow)", color: "var(--charcoal)" } : undefined}>{row.a}</div>
                <div className="lb-info">
                  <div className="lb-name">
                    {row.n}
                    {row.you && <span style={{ fontSize: 10, background: "var(--yellow)", color: "var(--charcoal)", padding: "1px 6px", borderRadius: 4, marginLeft: 5, fontWeight: 600 }}>{t.common.youBadge}</span>}
                  </div>
                  <div className="lb-meta">{row.loc}</div>
                </div>
                <div className="lb-val">{row.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
