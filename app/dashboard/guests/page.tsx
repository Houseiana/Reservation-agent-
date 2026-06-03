"use client";

import { useEffect, useState } from "react";
import { type Guest, type Booking } from "@/data";
import { listGuests, listBookings } from "@/lib/api";
import { useAsync } from "@/hooks/useAsync";
import { useDashboard } from "../dashboard-context";
import { GuestsPage } from "../components/GuestsPage";
import { GuestDetailDrawer } from "../components/GuestDetailDrawer";
import { BookingDetailDrawer } from "../components/BookingDetailDrawer";

export default function GuestsRoute() {
  const { lang, t, toast, now } = useDashboard();

  const guestsResult = useAsync((signal) => listGuests({ page: 1, limit: 100 }, signal), []);
  const guests = guestsResult.data?.items ?? [];

  // Bookings power the guest drawer's stay history + refund actions.
  const [bookings, setBookings] = useState<Booking[]>([]);
  const bookingsResult = useAsync((signal) => listBookings({ page: 1, limit: 100 }, signal), []);
  useEffect(() => {
    if (bookingsResult.data) setBookings(bookingsResult.data.items);
  }, [bookingsResult.data]);

  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const selectedGuest = guests.find((g) => g.id === selectedGuestId) ?? null;

  const [selectedBookingRef, setSelectedBookingRef] = useState<string | null>(null);
  const selectedBooking = bookings.find((b) => b.ref === selectedBookingRef) ?? null;

  return (
    <main className="main">
      <div className="content">
        <section className="page active" id="page-guests" style={{ padding: 16, flexDirection: "column", overflowY: "auto", height: "100%", flex: 1, minHeight: 0 }}>
          <GuestsPage
            t={t}
            guests={guests}
            loading={guestsResult.loading}
            onOpenGuest={(id) => setSelectedGuestId(id)}
            toast={toast}
            onCreated={guestsResult.refetch}
          />
        </section>
      </div>

      {/* GUEST DETAIL DRAWER */}
      <div className={`drawer-overlay ${selectedGuest ? "show" : ""}`} onClick={() => setSelectedGuestId(null)} />
      <div className={`drawer ${selectedGuest ? "show" : ""}`}>
        {selectedGuest && (
          <GuestDetailDrawer
            guest={selectedGuest}
            bookings={bookings}
            setBookings={setBookings}
            close={() => setSelectedGuestId(null)}
            openBooking={(ref) => { setSelectedGuestId(null); setSelectedBookingRef(ref); }}
            t={t}
            lang={lang}
            toast={toast}
          />
        )}
      </div>

      {/* BOOKING DETAIL DRAWER (opened from a guest's stay history) */}
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
