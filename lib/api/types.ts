/**
 * Shared API response shapes. Domain types (Property, Booking, Guest, ...)
 * live in data/index.ts and are reused here so the UI and the API speak
 * the same language. When the real backend differs in shape, add mapper
 * functions in each resource module rather than leaking server fields up.
 */
export type {
  Property,
  Guest,
  Booking,
  BookingChannel,
  PaymentStatus,
  RefundStatus,
  InboxItem,
} from "@/data";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
}
