/**
 * Barrel export. Components should import from "@/lib/api" only:
 *
 *   import { listBookings, createBooking, ApiError } from "@/lib/api";
 *
 * Switching to the real backend is a two-step change:
 *   1. Set NEXT_PUBLIC_API_BASE_URL in .env.local.
 *   2. Set NEXT_PUBLIC_USE_MOCK=false.
 * If response shapes differ from the local types, map them inside
 * lib/api/resources/* — never inside components.
 */
export { api, request, ApiError, API_BASE_URL, USE_MOCK, setAuthTokenProvider } from "./client";
export { ENDPOINTS } from "./endpoints";
export type { Paginated, ListParams } from "./types";

export * from "./resources/properties";
export * from "./resources/guests";
export * from "./resources/bookings";
export * from "./resources/inbox";
export * from "./resources/payments";
export * from "./resources/kpis";
export * from "./resources/lookups";
export * from "./resources/users";
