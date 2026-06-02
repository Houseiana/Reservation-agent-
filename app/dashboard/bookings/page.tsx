"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type Booking } from "@/data";
import { listBookings, getBookingStatuses } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useDashboard } from "../dashboard-context";
import { BookingsPage } from "../components/BookingsPage";
import { BookingDetailDrawer } from "../components/BookingDetailDrawer";

export default function BookingsRoute() {
  const { lang, t, toast, now } = useDashboard();
  const router = useRouter();

  // Bookings live in local state so edits/cancels/notes persist across the drawer.
  const [bookings, setBookings] = useState<Booking[]>([]);
  const bookingsResult = useAsync((signal) => listBookings({ page: 1, limit: 100 }, signal), []);
  useEffect(() => {
    if (bookingsResult.data) setBookings(bookingsResult.data.items);
  }, [bookingsResult.data]);

  const statusesLookup = useAsync((signal) => getBookingStatuses(signal), []);

  const [selectedBookingRef, setSelectedBookingRef] = useState<string | null>(null);
  const selectedBooking = bookings.find((b) => b.ref === selectedBookingRef) ?? null;

  return (
    <main className="main">
      <div className="content">
        <section className="page active" id="page-bookings" style={{ padding: 16, flexDirection: "column", overflowY: "auto", height: "100%", flex: 1, minHeight: 0 }}>
          <BookingsPage
            goToSearch={() => router.push("/dashboard")}
            t={t}
            lang={lang}
            bookings={bookings}
            loading={bookingsResult.loading}
            bookingStatuses={statusesLookup.data ?? []}
            onOpenBooking={(ref) => setSelectedBookingRef(ref)}
          />
        </section>
      </div>

      {/* BOOKING DETAIL DRAWER */}
      <div className={`drawer-overlay ${selectedBooking ? "show" : ""}`} onClick={() => setSelectedBookingRef(null)} />
      <div className={`drawer ${selectedBooking ? "show" : ""}`}>
        {selectedBooking && (
          <BookingDetailDrawer
            booking={selectedBooking}
            setBookings={setBookings}
            close={() => setSelectedBookingRef(null)}
            t={t}
            lang={lang}
            toast={toast}
            now={now}
          />
        )}
      </div>
    </main>
  );
}
