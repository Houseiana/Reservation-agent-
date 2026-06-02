"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { INBOX, INCOMING_CALLERS } from "@/data";
import { DICT, type Lang } from "@/i18n";
import { Icon } from "@/components/Icons";
import { listBookings } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { type InboxTab } from "./_lib";
import { DashboardContext, type DashboardCtx } from "./dashboard-context";
import { Sidebar } from "./components/Sidebar";

/** Shared chrome for every /dashboard route: sidebar, inbox, incoming-call
 * modal, toast and language state. Route pages render their own <main> as
 * children and read shared helpers from useDashboard(). */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [rtl, setRtl] = useState(false);
  const lang: Lang = rtl ? "ar" : "en";
  const t = DICT[lang];

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<InboxTab>("all");
  const [callOpen, setCallOpen] = useState(false);
  const [callerIdx, setCallerIdx] = useState(0);

  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function toast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  // Live clock so hold countdowns tick (re-renders every 30s).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.lang = rtl ? "ar" : "en";
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.body.classList.toggle("rtl", rtl);
  }, [rtl]);

  // Lightweight count for the sidebar badge.
  const bookingsResult = useAsync((signal) => listBookings({ page: 1, limit: 1 }, signal), []);

  function simulateIncomingCall() {
    setCallerIdx((i) => i + 1);
    setCallOpen(true);
    setInboxOpen(false);
  }
  const caller = INCOMING_CALLERS[callerIdx % INCOMING_CALLERS.length];
  function acceptCall() { setCallOpen(false); toast(t.toast.callAccepted); }
  function declineCall() { setCallOpen(false); toast(t.toast.callDeclined); }

  const inboxItems = useMemo(() => {
    if (inboxTab === "calls") return INBOX.filter((x) => x.type === "call" || x.type === "missed");
    if (inboxTab === "whatsapp") return INBOX.filter((x) => x.type === "wa");
    if (inboxTab === "missed") return INBOX.filter((x) => x.type === "missed");
    return INBOX;
  }, [inboxTab]);

  const ctx: DashboardCtx = {
    lang, rtl, setRtl, t, toast, now,
    openInbox: (tab) => { setInboxOpen(true); setInboxTab(tab); },
    simulateCall: simulateIncomingCall,
  };

  return (
    <DashboardContext.Provider value={ctx}>
      <div className={`app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Sidebar
          simulateCall={simulateIncomingCall}
          bookingsCount={bookingsResult.data?.total}
          open={sidebarOpen}
          onCollapse={() => setSidebarCollapsed(true)}
          onNavigate={() => setSidebarOpen(false)}
          t={t}
        />
        {/* Desktop-only: re-open the collapsed sidebar. */}
        <button
          className="desktop-sidebar-reopen"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {/* Mobile-only menu button + backdrop. */}
        <button
          className="mobile-toggle nav-toggle"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {sidebarOpen && (
          <div className="mobile-backdrop" onClick={() => setSidebarOpen(false)} />
        )}

        {children}

        {/* INBOX */}
        <div className={`drawer-overlay ${inboxOpen ? "show" : ""}`} onClick={() => setInboxOpen(false)} />
        <div className={`inbox-panel ${inboxOpen ? "show" : ""}`}>
          <div className="drawer-head">
            <button className="drawer-close" onClick={() => setInboxOpen(false)}><Icon.X /></button>
            <div className="drawer-title">{t.inbox.title}</div>
            <button className="btn btn-secondary btn-sm" onClick={simulateIncomingCall}>
              <Icon.Play /> {t.inbox.demoCall}
            </button>
          </div>
          <div className="inbox-tabs">
            {(["all", "calls", "whatsapp", "missed"] as InboxTab[]).map((tab) => (
              <button key={tab} className={`inbox-tab ${inboxTab === tab ? "active" : ""}`} onClick={() => setInboxTab(tab)}>
                {t.inbox.tabs[tab]}{" "}
                <span style={tab === "missed" ? { background: "var(--red)", color: "#fff" } : undefined}>
                  {tab === "all" ? 9 : tab === "calls" ? 4 : tab === "whatsapp" ? 5 : 2}
                </span>
              </button>
            ))}
          </div>
          <div className="inbox-list">
            {inboxItems.map((i) => (
              <div key={i.id} className={`inbox-row ${i.unread ? "unread" : ""}`}>
                <div className={`inbox-avatar ${i.knownGuest ? "" : "unknown"}`}>
                  {i.avatar}
                  <span className={`inbox-channel-badge ${i.type === "wa" ? "wa" : i.type === "missed" ? "missed" : "call"}`}>
                    {i.type === "wa" && <Icon.WhatsApp size={9} style={{ color: "#fff" }} />}
                    {i.type === "missed" && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /></svg>
                    )}
                    {i.type === "call" && <Icon.Phone size={9} style={{ color: "#fff" }} />}
                  </span>
                </div>
                <div className="inbox-info">
                  <div className="inbox-row-top">
                    <div className="inbox-name">
                      {i.from}{" "}
                      {!i.knownGuest && (
                        <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 400 }}>{i.phone}</span>
                      )}
                    </div>
                    <div className="inbox-time">{i.time}</div>
                  </div>
                  <div className="inbox-preview">{i.preview}</div>
                  <div className="inbox-meta">
                    <span className={`inbox-status ${i.status}`}>{t.inbox.statuses[i.status]}</span>
                    {i.duration && <span className="inbox-duration">⏱ {i.duration}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid var(--line)", padding: "14px 18px", background: "var(--ghost)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10 }}>
              {t.inbox.connectedChannels}
            </div>
            <div className="channel-item">
              <div className="channel-icon" style={{ background: "#25D366" }}><Icon.WhatsApp size={14} style={{ color: "#fff" }} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.inbox.waBusiness}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.inbox.waMeta}</div>
              </div>
              <span className="ch-status">{t.inbox.live}</span>
            </div>
            <div className="channel-item">
              <div className="channel-icon" style={{ background: "var(--charcoal)" }}><Icon.Phone size={14} style={{ color: "#fff" }} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t.inbox.voice}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.inbox.voiceMeta}</div>
              </div>
              <span className="ch-status">{t.inbox.live}</span>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ width: "100%", marginTop: 10, justifyContent: "center" }}>{t.inbox.addChannel}</button>
          </div>
        </div>

        {/* INCOMING CALL */}
        <div className={`call-overlay ${callOpen ? "show" : ""}`} onClick={declineCall} />
        <div className={`call-modal ${callOpen ? "show" : ""}`}>
          <div className={`call-channel ${caller.channel === "wa" ? "whatsapp" : ""}`}>
            <Icon.Phone size={13} />
            <span>{caller.channel === "wa" ? t.call.waInc : t.call.voiceInc}</span>
          </div>
          <div className="call-avatar-wrap">
            <div className="call-pulse" />
            <div className="call-pulse" style={{ animationDelay: ".7s" }} />
            <div
              className="call-avatar"
              style={
                caller.avatar === "?"
                  ? { background: "var(--ghost)", color: "var(--muted)" }
                  : undefined
              }
            >
              {caller.avatar}
            </div>
          </div>
          <div className="call-name">{caller.name}</div>
          <div className="call-phone">{caller.phone}</div>
          <div className="call-meta"><span className="call-tag">{caller.tag}</span></div>
          <div className="call-context">
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6, fontWeight: 500 }}>{t.call.context}</div>
            <div
              style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: caller.context }}
            />
          </div>
          <div className="call-actions">
            <button className="call-btn decline" onClick={declineCall} title={t.call.decline}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: "rotate(135deg)" }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
            <button className="call-btn accept" onClick={acceptCall} title={t.call.accept}>
              <Icon.Phone size={22} />
            </button>
          </div>
          <div className="call-actions-labels"><span>{t.call.decline}</span><span>{t.call.accept}</span></div>
        </div>

        {/* TOAST */}
        <div className={`toast ${toastVisible ? "show" : ""}`}>
          <div className="toast-ico"><Icon.Check /></div>
          <span>{toastMsg}</span>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
