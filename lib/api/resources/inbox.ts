import { api, USE_MOCK } from "../client";
import { ENDPOINTS } from "../endpoints";
import type { InboxItem } from "../types";
import { INBOX } from "@/data";

export type InboxFilter = "all" | "calls" | "whatsapp" | "missed";

export async function listInbox(filter: InboxFilter = "all", signal?: AbortSignal): Promise<InboxItem[]> {
  if (USE_MOCK) {
    if (filter === "calls") return INBOX.filter((x) => x.type === "call" || x.type === "missed");
    if (filter === "whatsapp") return INBOX.filter((x) => x.type === "wa");
    if (filter === "missed") return INBOX.filter((x) => x.type === "missed");
    return INBOX;
  }
  return api.get<InboxItem[]>(ENDPOINTS.inbox.list, { query: { filter }, signal });
}

export async function markInboxRead(id: string): Promise<void> {
  if (USE_MOCK) return;
  await api.post<void>(ENDPOINTS.inbox.markRead(id));
}
