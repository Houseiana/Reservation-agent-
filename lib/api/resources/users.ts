import { api } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Guest } from "../types";

/**
 * Backend user row from GET /api/reservation-agent/users.
 *   { success, data: [{ id, name, email, phone }] }
 *
 * Mapped onto our local Guest shape so the existing booking-flow UI
 * keeps working unchanged.
 */
export interface UsersSearchEnvelope {
  success: boolean;
  data: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  }>;
}

export interface CreateUserInput {
  createByPhone: boolean;
  email: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  phone: string;
}

/**
 * Search users by name/email/phone. Returns local Guest shapes so the
 * existing UI can render the results without changes.
 */
export async function searchUsers(query: string, signal?: AbortSignal): Promise<Guest[]> {
  if (!query.trim()) return [];
  const raw = await api.get<unknown>(ENDPOINTS.users.search, {
    query: { query },
    signal,
  });
  return parseUsersResponse(raw);
}

/**
 * Create a new guest user. Backend assigns the real ID; the response
 * is normalized into our local Guest shape so the booking flow can
 * immediately use it as the selected guest.
 */
export async function createUser(input: CreateUserInput): Promise<Guest> {
  const raw = await api.post<unknown>(
    ENDPOINTS.users.create,
    input as unknown as Record<string, unknown>,
  );
  // Some endpoints return the created object directly, others wrap it
  // in { success, data }. Try both.
  const obj = unwrapSingle(raw) ?? raw;
  return mapUser(obj);
}

function parseUsersResponse(raw: unknown): Guest[] {
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data)) arr = r.data;
    else if (Array.isArray(r.items)) arr = r.items;
    else if (Array.isArray(r.result)) arr = r.result;
  }
  return arr.map(mapUser);
}

function unwrapSingle(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) return r.data;
  return null;
}

function mapUser(raw: unknown): Guest {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const id = String(r.id ?? r._id ?? Math.random().toString(36).slice(2, 8));
  const name = typeof r.name === "string" ? r.name : `${str(r, "firstName")} ${str(r, "lastName")}`.trim();
  const [first = "—", ...rest] = name.split(" ");
  return {
    id,
    first,
    last: rest.join(" "),
    email: str(r, "email"),
    phone: str(r, "phone"),
    nat: str(r, "countryCode") || str(r, "nationality") || "—",
    bookings: 0,
    ltv: "—",
    isNew: false,
  };
}

function str(r: Record<string, unknown>, k: string): string {
  return typeof r[k] === "string" ? (r[k] as string) : "";
}
