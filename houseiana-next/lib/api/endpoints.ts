/**
 * Single source of truth for backend paths. Update these once the real
 * API contract lands; resource modules import from here so callers don't
 * change.
 */
export const ENDPOINTS = {
  properties: {
    list: "/api/reservation-agent/property-search",
    detail: (id: string) => `/api/reservation-agent/property/${id}`,
    availability: (id: string) => `/api/reservation-agent/property-search/${id}/availability`,
  },
  lookups: {
    propertyTypes: "/api/reservation-agent-lookup/property-types",
    amenities: "/api/reservation-agent-lookup/amenities",
    sortBy: "/api/reservation-agent-lookup/sort-by",
    bookingStatuses: "/api/reservation-agent-lookup/booking-statuses",
    paymentMethods: "/api/reservation-agent-lookup/payment-methods",
  },
  guests: {
    list: "/api/reservation-agent/guests",
    detail: (id: string) => `/api/reservation-agent/guests/${id}`,
    create: "/api/reservation-agent/guests",
    update: (id: string) => `/api/reservation-agent/guests/${id}`,
  },
  users: {
    search: "/api/reservation-agent/users",
    create: "/api/reservation-agent/users",
  },
  bookings: {
    list: "/api/reservation-agent/bookings",
    detail: (ref: string) => `/api/reservation-agent/bookings/${ref}`,
    create: "/api/reservation-agent/bookings",
    confirm: "/api/reservation-agent/booking/confirm",
    update: (ref: string) => `/api/reservation-agent/bookings/${ref}`,
    cancel: (ref: string) => `/api/reservation-agent/bookings/${ref}/cancel`,
    refund: (ref: string) => `/api/reservation-agent/bookings/${ref}/refund`,
    hold: (ref: string) => `/api/reservation-agent/bookings/${ref}/hold`,
    quote: "/api/reservation-agent/bookings/quote",
  },
  inbox: {
    list: "/inbox",
    markRead: (id: string) => `/inbox/${id}/read`,
  },
  payments: {
    sendLink: (bookingRef: string) => `/bookings/${bookingRef}/payment-link`,
    verify: (bookingRef: string) => `/bookings/${bookingRef}/payment/verify`,
  },
  kpis: {
    summary: "/kpis/summary",
    monthly: "/kpis/monthly",
  },
} as const;
