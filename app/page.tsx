import { redirect } from "next/navigation";

export default function RootPage() {
  // The middleware enforces auth; signed-in users land on /dashboard,
  // signed-out users get bounced to /sign-in by Clerk.
  redirect("/dashboard");
}
