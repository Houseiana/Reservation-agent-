"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { DICT } from "@/i18n";

export function SignedInAgentCard({ t }: { t: typeof DICT["en"] }) {
  const { user, isLoaded } = useUser();
  const name = user?.fullName
    ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ")
    ?? user?.username
    ?? user?.primaryEmailAddress?.emailAddress
    ?? "—";

  return (
    <div className="agent-card">
      <img className="agent-avatar" src="/logo.png" alt="" />
      <div className="agent-info">
        <div className="agent-name">{isLoaded ? name : "…"}</div>
        <div className="agent-role">{t.nav.role}</div>
      </div>
      <UserButton afterSignOutUrl="/sign-in" />
    </div>
  );
}
