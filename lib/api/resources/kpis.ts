import { api, USE_MOCK } from "../client";
import { ENDPOINTS } from "../endpoints";
import { MONTHLY_CHART_DATA } from "@/data";

export interface KpiSummary {
  bookings30d: number;
  occupancyPct: number;
  revenue30d: number;
  avgNightlyRate: number;
  currency: string;
}

export interface MonthlyKpiPoint {
  month: string;
  bookings: number;
  revenue: number;
}

export async function getKpiSummary(signal?: AbortSignal): Promise<KpiSummary> {
  if (USE_MOCK) {
    return {
      bookings30d: 42,
      occupancyPct: 78,
      revenue30d: 312_500,
      avgNightlyRate: 1_850,
      currency: "EGP",
    };
  }
  return api.get<KpiSummary>(ENDPOINTS.kpis.summary, { signal });
}

export async function getMonthlyKpis(signal?: AbortSignal): Promise<MonthlyKpiPoint[]> {
  if (USE_MOCK) {
    return MONTHLY_CHART_DATA as unknown as MonthlyKpiPoint[];
  }
  return api.get<MonthlyKpiPoint[]>(ENDPOINTS.kpis.monthly, { signal });
}
