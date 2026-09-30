import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Guest, Paginated } from "../types";

export interface GuestListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface GuestCreateInput {
  first: string;
  last: string;
  email: string;
  phone: string;
  nat?: string;
  lang?: string;
}

export async function listGuests(
  params: GuestListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Guest>> {
  const raw = await api.get<unknown>(ENDPOINTS.guests.list, {
    query: {
      search: params.search,
      page: params.page,
      limit: params.limit,
    },
    signal,
  });
  return normalizeListResponse(raw, params);
}

export async function getGuest(id: string, signal?: AbortSignal): Promise<Guest> {
  const raw = await api.get<unknown>(ENDPOINTS.guests.detail(id), { signal });
  return mapGuest(raw);
}

export async function createGuest(input: GuestCreateInput): Promise<Guest> {
  const raw = await api.post<unknown>(
    ENDPOINTS.guests.create,
    input as unknown as Record<string, unknown>,
  );
  return mapGuest(raw);
}

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Backend response envelope (real):
 *   { guests: [...], totalCount, page, limit }
 */
function normalizeListResponse(raw: unknown, params: GuestListParams): Paginated<Guest> {
  let arr: unknown[] = [];
  let total = 0;
  let page = params.page ?? 1;
  let pageSize = params.limit ?? 20;

  if (Array.isArray(raw)) {
    arr = raw;
    total = raw.length;
  } else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const list = (Array.isArray(r.guests) ? r.guests
                : Array.isArray(r.items) ? r.items
                : Array.isArray(r.data) ? r.data
                : Array.isArray(r.results) ? r.results
                : []) as unknown[];
    arr = list;
    total = typeof r.totalCount === "number" ? (r.totalCount as number)
          : typeof r.total === "number" ? (r.total as number)
          : list.length;
    page = typeof r.page === "number" ? r.page : page;
    pageSize = typeof r.limit === "number" ? (r.limit as number)
             : typeof r.pageSize === "number" ? (r.pageSize as number)
             : pageSize;
  }

  return {
    items: arr.map(mapGuest),
    total,
    page,
    pageSize,
  };
}

/**
 * Backend guest shape:
 *   id, name, email, phone, nationality, bookingsCount, lifetimeValue, lastStay
 */
function mapGuest(raw: unknown): Guest {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string, fallback = "") => (typeof r[k] === "string" ? (r[k] as string) : fallback);
  const num = (k: string, fallback = 0) => (typeof r[k] === "number" ? (r[k] as number) : fallback);

  const id = String(r.id ?? r._id ?? Math.random().toString(36).slice(2, 8));
  const fullName = str("name") || `${str("firstName")} ${str("lastName")}`.trim() || "—";
  const [first = "—", ...rest] = fullName.split(" ");
  const last = rest.join(" ");

  const ltvNum = num("lifetimeValue") || num("ltv");
  const ltv = ltvNum ? formatLtv(ltvNum) : "—";

  const lastStay = str("lastStay") ? str("lastStay").slice(0, 10) : undefined;

  return {
    id,
    first,
    last,
    email: str("email"),
    phone: str("phone"),
    nat: str("nationality") || str("nat") || "—",
    bookings: num("bookingsCount") || num("bookings"),
    ltv,
    lastStay,
  };
}

function formatLtv(n: number): string {
  return Math.round(n).toLocaleString();
}
