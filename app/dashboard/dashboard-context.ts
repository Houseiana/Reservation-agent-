"use client";

import { createContext, useContext } from "react";
import { DICT, type Lang } from "@/i18n";
import type { InboxTab } from "./_lib";

/** Shared dashboard chrome (sidebar, inbox, call, toast, language) provided by
 * the dashboard layout so every route (/dashboard, /bookings, /guests) reuses
 * the same surrounding UI and helpers. */
export interface DashboardCtx {
  lang: Lang;
  rtl: boolean;
  setRtl: (b: boolean) => void;
  t: typeof DICT["en"];
  /** Show a transient toast message. */
  toast: (msg: string) => void;
  /** Open the inbox panel on a given tab. */
  openInbox: (tab: InboxTab) => void;
  /** Trigger the incoming-call demo modal. */
  simulateCall: () => void;
  /** Live clock (ms) that ticks every 30s — used for hold countdowns. */
  now: number;
}

export const DashboardContext = createContext<DashboardCtx | null>(null);

export function useDashboard(): DashboardCtx {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within the dashboard layout");
  return ctx;
}
