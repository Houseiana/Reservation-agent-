export type Lang = "en" | "ar";

interface Dict {
  common: {
    egypt: string;
    night: string;
    nights: string;
    guest: string;
    guests: string;
    bookings: string;
    reviews: string;
    photos: string;
    luxury: string;
    standard: string;
    any: string;
    all: string;
    or: string;
    total: string;
    discount: string;
    youBadge: string;
    instantBook: string;
    save: string;
    share: string;
    print: string;
    resend: string;
    done: string;
    cancel: string;
    next: string;
    back: string;
    step: string;
    of: string;
    confirmBooking: string;
    continueBooking: string;
    livingNow: string;
  };
  nav: {
    workspace: string;
    search: string;
    bookings: string;
    guests: string;
    kpis: string;
    role: string;
    waPill: string;
    callPill: string;
    demoPill: string;
  };
  topbar: {
    where: string;
    checkin: string;
    checkout: string;
    who: string;
    searchPlaceholder: string;
    whoPlaceholder: string;
    suggested: string;
    addGuests: (n: number) => string;
  };
  filters: {
    title: string;
    clearAll: string;
    price: string;
    type: string;
    rooms: string;
    area: string;
    essentials: string;
    features: string;
    extrasAvail: string;
    bookingOpts: string;
    bedrooms: string;
    bathrooms: string;
    beds: string;
    capacity: string;
    min: string;
    max: string;
    types: { all: string; apartment: string; villa: string; studio: string; penthouse: string; chalet: string };
    flags: { instantBook: string; freeCancel: string; superhost: string; verified: string };
  };
  amenities: Record<string, string>;
  extras: Record<string, string>;
  results: {
    all: string;
    staysIn: (x: string) => string;
    meta: (n: number, dates: string, guests: number) => string;
    sortRecommended: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    sortRating: string;
    sortArea: string;
    noResults: string;
    tryRemoving: string;
    clearFilters: string;
  };
  card: {
    br: (n: number) => string;
    bath: (n: number) => string;
    perNight: string;
  };
  detail: {
    title: string;
    ownerWarn: string;
    ownerWarnDesc: string;
    instantOk: string;
    instantOkDesc: (name: string, phone: string) => string;
    shareTitle: string;
    shareHelp: string;
    copyLink: string;
    shareWA: string;
    shareEmail: string;
    about: string;
    sleep: string;
    bedsTotal: (n: number) => string;
    offers: string;
    addons: string;
    addonsHint: string;
    pricing: string;
    cleaning: string;
    utilities: string;
    bookingFee: string;
    deposit: string;
    rules: string;
    checkInOut: string;
    minStay: string;
    cancellation: string;
    bedrooms: string;
    bathrooms: string;
    areaM2: string;
    superhost: string;
    verified: string;
    nightsTotal: string;
    inclusive: (currency: string, price: string, nights: number) => string;
    waMsg: (ownerFirst: string, propertyName: string) => string;
    shareMsg: (name: string, loc: string, currency: string, price: string, url: string) => string;
  };
  booking: {
    bookHeading: (name: string) => string;
    steps: { guest: string; extras: string; payment: string; confirm: string };
    searchGuest: string;
    searchGuestPlaceholder: string;
    noMatches: string;
    orNew: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality: string;
    selectNat: string;
    nationalities: { egyptian: string; saudi: string; emirati: string; qatari: string; kuwaiti: string; british: string; american: string; other: string };
    prefLang: string;
    langs: { english: string; arabic: string };
    bookingsCount: (n: number) => string;
    addExtras: string;
    specialReqs: string;
    notesLabel: string;
    notesPlaceholder: string;
    promoLabel: string;
    promoPlaceholder: string;
    agentDiscount: string;
    agentDiscountHelp: string;
    paymentMethod: string;
    chargeTiming: string;
    chargeOptions: { full: string; half: string; atProperty: string };
    currency: string;
    summary: string;
    extras: string;
    commission: string;
    payments: Record<"card" | "paylink" | "instapay", { name: string; desc: string; logo: string }>;
    paymentLabel: Record<"card" | "paylink" | "instapay", string>;
    securityTitle: string;
    securityDesc: string;
    sendWA: string;
    sendEmail: string;
    sendWADisabled: string;
    sentSuccess: string;
    cardHelp: string;
    paylinkHelp: string;
    instapayHelp: string;
    instapayHandle: string;
    instapayHandleLabel: string;
    amountDue: string;
    verifyCheck: string;
    verifyHint: string;
    verifyDoneToast: string;
    waCardMsg: (first: string, name: string, checkin: string, checkout: string, nights: number, guests: number, currency: string, amount: string, link: string) => string;
    waPaylinkMsg: (first: string, name: string, currency: string, amount: string, link: string) => string;
    waInstapayMsg: (first: string, name: string, currency: string, amount: string, handle: string) => string;
    confirmed: string;
    confirmedSub: string;
    confDetails: { guest: string; property: string; checkin: string; checkout: string; guests: string; nights: string };
    shareGuestConfirm: string;
    notifyOwner: string;
    actionsTitle: string;
    waGuestConfirmMsg: (first: string, ref: string, name: string, loc: string, checkin: string, checkout: string, nights: number, guests: number, currency: string, amount: string, checkinTime: string, checkoutTime: string) => string;
    waOwnerNotifyMsg: (ownerFirst: string, name: string, checkin: string, checkout: string, nights: number, guestName: string, guestPhone: string, guests: number, currency: string, amount: string, ref: string, notes: string) => string;
  };
  owner: {
    title: string;
    callOwner: string;
    waOwner: string;
  };
  bookingsPage: {
    title: string;
    subtitle: string;
    exportCsv: string;
    newBooking: string;
    pillsAll: string;
    headers: { ref: string; guest: string; property: string; dates: string; total: string; status: string; actions: string };
    statuses: Record<"confirmed" | "pending" | "checkedin" | "checkedout" | "cancelled", string>;
    nightsLbl: (n: number) => string;
    stats: { todayIn: string; inHouse: string; todayOut: string; paymentPending: string; upcomingWeek: string };
    urgency: {
      today: string; tomorrow: string; inDays: (n: number) => string;
      inHouse: string; checkoutToday: string; lateCheckout: string;
    };
    tier: { vip: string; repeat: string; new: string };
    paymentLabel: { paid: string; partial: string; pending: string };
    paymentPartial: (pct: number) => string;
    channels: { wa: string; call: string; web: string; direct: string };
    actions: { call: string; whatsapp: string; viewNotes: string; more: string };
    filters: { all: string; today: string; tomorrow: string; inHouse: string; pendingPay: string; upcoming: string };
    guestsCount: (n: number) => string;
    noBookings: string;
  };
  guestsPage: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    addGuest: string;
    stats: { total: string; repeat: string; avgLtv: string; vip: string; thisMonth: string; vipNote: string };
    headers: { guest: string; contact: string; nationality: string; bookings: string; ltv: string; lastStay: string; tags: string };
    tags: { repeat: string; vip: string; new: string };
    lastStays: Record<string, string>;
  };
  kpis: {
    title: string;
    subtitle: string;
    periods: { mtd: string; last: string; qtd: string; ytd: string; all: string };
    exportBtn: string;
    callsReceived: string;
    callsConverted: string;
    conversionRate: string;
    bookingsMine: string;
    totalAmount: string;
    vsLast: string;
    bookedFromCalls: string;
    teamAvg: string;
    allTime142: string;
    commission144: string;
    monthlyTitle: string;
    monthlySub: string;
    egyptBookings: string;
    months: Record<string, string>;
    statusTitle: string;
    statusSub: string;
    statuses: Record<"confirmed" | "checkedin" | "pending" | "checkedout" | "cancelled", string>;
    funnelTitle: string;
    funnelSub: string;
    funnel: { received: string; qualified: string; quoted: string; confirmed: string };
    funnelInsight: string;
    catsTitle: string;
    catsSub: string;
    cats: { apartments: string; villas: string; penthouses: string; studios: string; chalets: string };
    catsBookings: string;
    totalBookings: string;
    topTitle: string;
    topSub: string;
    topHeaders: { rank: string; property: string; category: string; bookings: string; amount: string; commission: string };
    goalTitle: string;
    goalSub: string;
    onTrack: string;
    goalNote: string;
    otherGoals: string;
    goalRows: { amount: string; calls: string; repeat: string };
    leaderboardTitle: string;
    leaderboardSub: string;
    units: string;
  };
  inbox: {
    title: string;
    demoCall: string;
    tabs: { all: string; calls: string; whatsapp: string; missed: string };
    statuses: Record<"qualified" | "quoted" | "booked" | "lost" | "new", string>;
    connectedChannels: string;
    waBusiness: string;
    voice: string;
    waMeta: string;
    voiceMeta: string;
    live: string;
    addChannel: string;
  };
  call: {
    voiceInc: string;
    waInc: string;
    context: string;
    decline: string;
    accept: string;
  };
  toast: {
    favSaved: string;
    favRemoved: string;
    searchUpdated: string;
    filtersCleared: string;
    selectedGuest: (n: string) => string;
    promo: (n: number) => string;
    selectGuestFirst: string;
    bookingConfirmed: string;
    callAccepted: string;
    callDeclined: string;
    linkCopied: string;
    linkCopyFail: string;
  };
}

export const DICT: Record<Lang, Dict> = {
  en: {
    common: {
      egypt: "🇪🇬 Egypt", night: "night", nights: "nights", guest: "guest", guests: "guests",
      bookings: "bookings", reviews: "reviews", photos: "photos", luxury: "Luxury", standard: "Standard",
      any: "Any", all: "All", or: "OR CREATE NEW", total: "total", discount: "Discount",
      youBadge: "YOU", instantBook: "Instant book", save: "Save", share: "Share",
      print: "Print voucher", resend: "Resend email", done: "Done", cancel: "Cancel",
      next: "Continue →", back: "← Back", step: "Step", of: "of",
      confirmBooking: "Confirm booking →", continueBooking: "Continue to booking →",
      livingNow: "Online",
    },
    nav: {
      workspace: "Workspace", search: "Search & Book", bookings: "Bookings", guests: "Guests",
      kpis: "My KPIs", role: "Sr. Booking Agent", waPill: "WA", callPill: "Call", demoPill: "Demo",
    },
    topbar: {
      where: "Where", checkin: "Check-in", checkout: "Check-out", who: "Who",
      searchPlaceholder: "Search destinations", whoPlaceholder: "Add guests",
      suggested: "Suggested destinations",
      addGuests: (n) => `${n} ${n === 1 ? "guest" : "guests"}`,
    },
    filters: {
      title: "Filters", clearAll: "Clear all",
      price: "Price per night", type: "Property type", rooms: "Rooms & capacity",
      area: "Area size (m²)", essentials: "Essentials", features: "Features & spaces",
      extrasAvail: "Paid extras available", bookingOpts: "Booking options",
      bedrooms: "Bedrooms", bathrooms: "Bathrooms / toilets", beds: "Beds", capacity: "Guest capacity",
      min: "Min", max: "Max",
      types: { all: "All", apartment: "Apartment", villa: "Villa", studio: "Studio", penthouse: "Penthouse", chalet: "Chalet" },
      flags: { instantBook: "Instant book", freeCancel: "Free cancellation", superhost: "Superhost", verified: "Verified property" },
    },
    amenities: {
      ac: "Air conditioning", wifi: "Wi-Fi", kitchen: "Kitchen", washer: "Washer", tv: "TV",
      parking: "Free parking", elevator: "Elevator", workspace: "Workspace",
      pool: "Pool", gym: "Gym", balcony: "Balcony", seaview: "Sea view",
      beachAccess: "Beach access", garden: "Private garden", jacuzzi: "Jacuzzi", bbq: "BBQ",
      pets: "Pets allowed", events: "Events allowed",
      heating: "Heating", dryer: "Dryer", hairdryer: "Hair dryer", iron: "Iron", safe: "In-room safe", smoking: "Smoking allowed",
    },
    extras: {
      beach: "Beach access fee", pickup: "Airport pickup", cleaning: "Daily housekeeping",
      breakfast: "Breakfast delivery", chef: "Private chef", driver: "Private driver", tour: "Tours & activities",
    },
    results: {
      all: "All properties",
      staysIn: (x) => `Stays in ${x}`,
      meta: (n, dates, g) => `${n} ${n === 1 ? "property" : "properties"} · ${dates} · ${g} ${g === 1 ? "guest" : "guests"}`,
      sortRecommended: "Sort: Recommended",
      sortPriceAsc: "Price: low to high", sortPriceDesc: "Price: high to low",
      sortRating: "Top rated", sortArea: "Largest area",
      noResults: "No properties match your filters",
      tryRemoving: "Try removing some filters or expanding your search.",
      clearFilters: "Clear filters",
    },
    card: {
      br: (n) => `${n} BR`, bath: (n) => `${n} bath`, perNight: "/night",
    },
    detail: {
      title: "Property details",
      ownerWarn: "Owner approval needed before booking",
      ownerWarnDesc: "Call the owner now to confirm the unit is available before you quote or hold for the guest.",
      instantOk: "Instant book · no owner approval needed",
      instantOkDesc: (name, phone) => `You can confirm immediately. Owner on file: ${name} (${phone}).`,
      shareTitle: "Share with guest",
      shareHelp: "Send the guest a direct link to this unit on the website — they'll see photos, full description and the live price.",
      copyLink: "Copy link", shareWA: "Share on WhatsApp", shareEmail: "Send by email",
      about: "About this place", sleep: "Where you'll sleep",
      bedsTotal: (n) => `${n} beds total`,
      offers: "What this place offers",
      addons: "Add-ons available", addonsHint: "paid extras",
      pricing: "Pricing breakdown",
      cleaning: "Cleaning fee", utilities: "Utilities (water & electricity)", bookingFee: "Booking fee", deposit: "Refundable security deposit (returned at checkout)",
      rules: "House rules & policies",
      checkInOut: "Check-in / out", minStay: "Minimum stay", cancellation: "Cancellation",
      bedrooms: "bedrooms", bathrooms: "bathrooms", areaM2: "m² area",
      superhost: "Superhost", verified: "Verified",
      nightsTotal: "total",
      inclusive: (c, p, n) => `${c} ${p} × ${n} nights · all fees included`,
      waMsg: (first, name) => `Hi ${first}, this is Sara from Houseiana. A guest is interested in your "${name}" — could you confirm availability please?`,
      shareMsg: (name, loc, c, price, url) =>
        `Check out this property on Houseiana: ${name} — ${loc}\n${c} ${price}/night\n${url}`,
    },
    booking: {
      bookHeading: (name) => `Book — ${name}`,
      steps: { guest: "Guest", extras: "Notes", payment: "Payment", confirm: "Confirm" },
      searchGuest: "Search existing guest",
      searchGuestPlaceholder: "Name, email, phone, or guest ID...",
      noMatches: "No matches. Use form below to create new.",
      orNew: "OR CREATE NEW",
      firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone",
      nationality: "Nationality", selectNat: "— Select —",
      nationalities: { egyptian: "Egyptian", saudi: "Saudi", emirati: "Emirati", qatari: "Qatari", kuwaiti: "Kuwaiti", british: "British", american: "American", other: "Other" },
      prefLang: "Preferred language",
      langs: { english: "English", arabic: "Arabic" },
      bookingsCount: (n) => `${n} bookings`,
      addExtras: "Add paid extras",
      specialReqs: "Special requests & codes",
      notesLabel: "Notes for the host",
      notesPlaceholder: "e.g. Late check-in around midnight, early check-in if possible...",
      promoLabel: "Promo / discount code",
      promoPlaceholder: "WELCOME10, AGENT5...",
      agentDiscount: "Agent override discount (%)",
      agentDiscountHelp: "Max 20% · approval needed above 10%",
      paymentMethod: "Payment method",
      chargeTiming: "Charge timing",
      chargeOptions: { full: "Charge full amount now", half: "50% deposit now, balance on check-in", atProperty: "Pay at property (host approval)" },
      currency: "Currency",
      summary: "Booking summary",
      extras: "Extras",
      commission: "Your commission (5%)",
      payments: {
        card: { name: "Visa / Card payment link", desc: "Send the customer a secure WhatsApp link → they pay with their card on our gateway.", logo: "VISA" },
        paylink: { name: "Payment provider link (Paymob)", desc: "Send a payment link via WhatsApp. Customer pays with card / wallet / Fawry, then forwards the receipt.", logo: "PAYMOB" },
        instapay: { name: "InstaPay transfer", desc: "Customer transfers to our InstaPay handle and sends the receipt screenshot.", logo: "INSTAPAY" },
      },
      paymentLabel: { card: "Card link", paylink: "Paymob link", instapay: "InstaPay" },
      securityTitle: "Never ask the customer for card details",
      securityDesc: "Do NOT take card number, CVV, expiry, or PIN — under any circumstance. Only send a payment link via WhatsApp or email. The customer enters their card details directly on the secure payment page.",
      sendWA: "Send payment link via WhatsApp",
      sendEmail: "Send via email",
      sendWADisabled: "Pick or add a guest with a phone number first",
      sentSuccess: "Payment link sent via WhatsApp",
      cardHelp: "The customer pays directly on the Visa/Mastercard/Meeza secure page. Verify in the gateway dashboard before confirming the booking.",
      paylinkHelp: "After the customer pays, ask them to send the receipt screenshot on WhatsApp. Verify the receipt before confirming the booking.",
      instapayHelp: "Share the InstaPay handle and amount. After the customer transfers, they'll send a receipt screenshot — verify it before confirming.",
      instapayHandle: "houseiana@instapay",
      instapayHandleLabel: "InstaPay handle",
      amountDue: "Amount due",
      verifyCheck: "I verified the payment receipt from the customer",
      verifyHint: "Required before confirming the booking — review the WhatsApp receipt screenshot or the gateway dashboard.",
      verifyDoneToast: "Payment marked as verified",
      waCardMsg: (first, name, checkin, checkout, nights, guests, currency, amount, link) =>
        `Hi ${first}! Thanks for choosing Houseiana 🏡\n\nYour booking:\n• ${name}\n• Check-in: ${checkin}\n• Check-out: ${checkout}\n• ${nights} nights · ${guests} guests\n• Total: ${currency} ${amount}\n\nPay securely with your card here:\n${link}\n\n🔒 Houseiana will NEVER ask for your card number over chat — please enter it only on the secure page above.`,
      waPaylinkMsg: (first, name, currency, amount, link) =>
        `Hi ${first}, here's your payment link for "${name}":\n\nAmount: ${currency} ${amount}\nPay here: ${link}\n\nAfter you pay, please send us the receipt screenshot so we can confirm your booking. Thank you!`,
      waInstapayMsg: (first, name, currency, amount, handle) =>
        `Hi ${first}, please transfer the booking amount via InstaPay:\n\nInstaPay: ${handle}\nAmount: ${currency} ${amount}\nFor: ${name}\n\nAfter you transfer, send us a screenshot of the receipt and we'll confirm your booking right away.`,
      confirmed: "Booking confirmed",
      confirmedSub: "Send the confirmation to the guest and notify the property owner.",
      confDetails: { guest: "Guest", property: "Property", checkin: "Check-in", checkout: "Check-out", guests: "Guests", nights: "Nights" },
      shareGuestConfirm: "Share confirmation with guest",
      notifyOwner: "Notify property owner",
      actionsTitle: "Share with",
      waGuestConfirmMsg: (first, ref, name, loc, checkin, checkout, nights, guests, currency, amount, checkinTime, checkoutTime) =>
        `Hi ${first}! ✅ Your booking is confirmed.\n\nBooking ref: ${ref}\nProperty: ${name}\nLocation: ${loc}\nCheck-in: ${checkin} (after ${checkinTime})\nCheck-out: ${checkout} (before ${checkoutTime})\nStay: ${nights} nights · ${guests} guests\nTotal paid: ${currency} ${amount}\n\nWe look forward to hosting you! If you need anything, just reply to this message. — Houseiana`,
      waOwnerNotifyMsg: (ownerFirst, name, checkin, checkout, nights, guestName, guestPhone, guests, currency, amount, ref, notes) =>
        `Hi ${ownerFirst}, your unit "${name}" has just been booked ✅\n\nDates: ${checkin} → ${checkout} (${nights} nights)\nGuest: ${guestName} · ${guestPhone}\nGuests: ${guests}\nPayment: ✅ Received in full (${currency} ${amount})\n\nBooking ref: ${ref}${notes ? `\nGuest notes: ${notes}` : ""}\n\nPlease prepare the unit for the guest's arrival. Thank you! — Houseiana`,
    },
    owner: { title: "Owner", callOwner: "Call owner", waOwner: "WhatsApp owner" },
    bookingsPage: {
      title: "All Bookings",
      subtitle: "Manage reservations across all properties.",
      exportCsv: "Export CSV", newBooking: "+ New Booking",
      pillsAll: "All",
      headers: { ref: "Ref", guest: "Guest", property: "Property · Stay", dates: "Dates", total: "Total · Payment", status: "Status", actions: "Actions" },
      statuses: { confirmed: "Confirmed", pending: "Pending", checkedin: "Checked-in", checkedout: "Checked-out", cancelled: "Cancelled" },
      nightsLbl: (n) => `${n} ${n === 1 ? "night" : "nights"}`,
      stats: {
        todayIn: "Check-ins today",
        inHouse: "Guests in-house",
        todayOut: "Check-outs today",
        paymentPending: "Payment pending",
        upcomingWeek: "Next 7 days",
      },
      urgency: {
        today: "Today",
        tomorrow: "Tomorrow",
        inDays: (n) => `In ${n} days`,
        inHouse: "In-house",
        checkoutToday: "Out today",
        lateCheckout: "Late check-out",
      },
      tier: { vip: "VIP", repeat: "Repeat", new: "New" },
      paymentLabel: { paid: "Paid", partial: "Partial", pending: "Unpaid" },
      paymentPartial: (pct) => `Partial · ${pct}%`,
      channels: { wa: "WhatsApp", call: "Call", web: "Website", direct: "Direct" },
      actions: { call: "Call guest", whatsapp: "WhatsApp guest", viewNotes: "View notes", more: "More" },
      filters: {
        all: "All", today: "Today", tomorrow: "Tomorrow",
        inHouse: "In-house", pendingPay: "Unpaid", upcoming: "Upcoming",
      },
      guestsCount: (n) => `${n} ${n === 1 ? "guest" : "guests"}`,
      noBookings: "No bookings match this filter.",
    },
    guestsPage: {
      title: "Guests", subtitle: "Customer database & booking history.",
      searchPlaceholder: "Search guests...", addGuest: "+ Add guest",
      stats: { total: "Total guests", repeat: "Repeat guests", avgLtv: "Avg. lifetime value", vip: "VIP guests", thisMonth: "this month", vipNote: "5+ bookings" },
      headers: { guest: "Guest", contact: "Contact", nationality: "Nationality", bookings: "Bookings", ltv: "Lifetime value", lastStay: "Last stay", tags: "Tags" },
      tags: { repeat: "Repeat", vip: "VIP", new: "New" },
      lastStays: { "G-1042": "2 weeks ago", "G-2018": "3 days ago", "G-0892": "last month", "G-1577": "5 days ago", "G-2204": "2 months ago", "G-0331": "today" },
    },
    kpis: {
      title: "My Performance", subtitle: "Sara Al-Mansoori · Sr. Booking Agent",
      periods: { mtd: "This month", last: "Last 30 days", qtd: "This quarter", ytd: "Year to date", all: "All time" },
      exportBtn: "Export",
      callsReceived: "Calls received", callsConverted: "Calls converted", conversionRate: "Conversion rate",
      bookingsMine: "Bookings (my account)", totalAmount: "Total amount",
      vsLast: "vs last month", bookedFromCalls: "booked from calls",
      teamAvg: "team avg 22%", allTime142: "142 all-time", commission144: "commission EGP 14.4K",
      monthlyTitle: "Monthly bookings — Egypt", monthlySub: "Units booked over the last 6 months",
      egyptBookings: "Egypt bookings",
      months: { Dec: "Dec", Jan: "Jan", Feb: "Feb", Mar: "Mar", Apr: "Apr", May: "May" },
      statusTitle: "Booking status", statusSub: "This month · 38 total",
      statuses: { confirmed: "Confirmed", checkedin: "Checked-in", pending: "Pending", checkedout: "Checked-out", cancelled: "Cancelled" },
      funnelTitle: "Calls → Bookings funnel", funnelSub: "Where calls drop off",
      funnel: { received: "Calls received", qualified: "Qualified leads", quoted: "Quote sent", confirmed: "Booking confirmed" },
      funnelInsight: "Quote → confirmed: 54%. Biggest drop-off is at the quote stage — try faster quote turnaround.",
      catsTitle: "Bookings by unit category", catsSub: "Count & amount per category · this month",
      cats: { apartments: "Apartments", villas: "Villas", penthouses: "Penthouses", studios: "Studios", chalets: "Chalets" },
      catsBookings: "bookings",
      totalBookings: "Total · 38 bookings",
      topTitle: "Top properties I've booked — Egypt", topSub: "Ranked by bookings this month",
      topHeaders: { rank: "#", property: "Property", category: "Category", bookings: "Bookings", amount: "Amount", commission: "My commission" },
      goalTitle: "Monthly goal", goalSub: "Target: 45 units · 84% to goal",
      onTrack: "on track", goalNote: "Need 7 more bookings · 22 days remaining · ~0.3/day pace required",
      otherGoals: "Other goals",
      goalRows: { amount: "Amount · EGP 350K", calls: "Calls converted · 35%", repeat: "Repeat guests · 35%" },
      leaderboardTitle: "Team leaderboard — Egypt", leaderboardSub: "Booking agents · this month",
      units: "units",
    },
    inbox: {
      title: "Inbox", demoCall: "Demo call",
      tabs: { all: "All", calls: "Calls", whatsapp: "WhatsApp", missed: "Missed" },
      statuses: { qualified: "Qualified", quoted: "Quote sent", booked: "Booked", lost: "Lost", new: "New lead" },
      connectedChannels: "Connected channels",
      waBusiness: "WhatsApp Business", voice: "Voice — Twilio",
      waMeta: "+20 103 642 5474 · Connected via Meta Cloud API",
      voiceMeta: "+20 2 2480 5500 · Routing to web softphone",
      live: "Live", addChannel: "+ Add channel",
    },
    call: { voiceInc: "Incoming voice call · Twilio", waInc: "Incoming WhatsApp call", context: "Context", decline: "Decline", accept: "Accept" },
    toast: {
      favSaved: "Saved to wishlist", favRemoved: "Removed from wishlist",
      searchUpdated: "Search updated", filtersCleared: "Filters cleared",
      selectedGuest: (n) => `Selected ${n}`,
      promo: (n) => `Promo applied: -${n}%`,
      selectGuestFirst: "Please select or create a guest",
      bookingConfirmed: "Booking confirmed",
      callAccepted: "Call accepted · routing to softphone",
      callDeclined: "Call declined · added to missed",
      linkCopied: "Property link copied",
      linkCopyFail: "Could not copy — please copy manually",
    },
  },
  ar: {
    common: {
      egypt: "🇪🇬 مصر", night: "ليلة", nights: "ليالٍ", guest: "ضيف", guests: "ضيف",
      bookings: "حجز", reviews: "تقييم", photos: "صورة", luxury: "فاخر", standard: "عادي",
      any: "أي عدد", all: "الكل", or: "أو أضف عميل جديد", total: "إجمالي", discount: "خصم",
      youBadge: "أنت", instantBook: "حجز فوري", save: "حفظ", share: "مشاركة",
      print: "طباعة الفاوتشر", resend: "إعادة إرسال", done: "تم", cancel: "إلغاء",
      next: "متابعة ←", back: "→ رجوع", step: "الخطوة", of: "من",
      confirmBooking: "تأكيد الحجز ←", continueBooking: "متابعة للحجز ←",
      livingNow: "متصل",
    },
    nav: {
      workspace: "مساحة العمل", search: "بحث وحجز", bookings: "الحجوزات", guests: "العملاء",
      kpis: "أدائي", role: "كبير موظفي الحجز", waPill: "واتساب", callPill: "اتصال", demoPill: "تجربة",
    },
    topbar: {
      where: "إلى أين", checkin: "تاريخ الوصول", checkout: "تاريخ المغادرة", who: "عدد الضيوف",
      searchPlaceholder: "ابحث عن وجهة", whoPlaceholder: "أضف ضيوف",
      suggested: "وجهات مقترحة",
      addGuests: (n) => `${n} ضيف`,
    },
    filters: {
      title: "الفلاتر", clearAll: "مسح الكل",
      price: "السعر لكل ليلة", type: "نوع العقار", rooms: "الغرف والسعة",
      area: "المساحة (م²)", essentials: "الأساسيات", features: "المميزات والمساحات",
      extrasAvail: "إضافات مدفوعة متاحة", bookingOpts: "خيارات الحجز",
      bedrooms: "غرف النوم", bathrooms: "حمامات / دورات مياه", beds: "الأسرّة", capacity: "سعة الضيوف",
      min: "الأدنى", max: "الأقصى",
      types: { all: "الكل", apartment: "شقة", villa: "فيلا", studio: "استوديو", penthouse: "بنتهاوس", chalet: "شاليه" },
      flags: { instantBook: "حجز فوري", freeCancel: "إلغاء مجاني", superhost: "مضيف متميز", verified: "عقار موثق" },
    },
    amenities: {
      ac: "تكييف", wifi: "واي فاي", kitchen: "مطبخ", washer: "غسالة", tv: "تلفزيون",
      parking: "موقف سيارات مجاني", elevator: "مصعد", workspace: "مكان للعمل",
      pool: "حمام سباحة", gym: "جيم", balcony: "بلكونة", seaview: "إطلالة بحرية",
      beachAccess: "نزول مباشر للبحر", garden: "حديقة خاصة", jacuzzi: "جاكوزي", bbq: "شواية",
      pets: "يُسمح بالحيوانات", events: "يُسمح بالفعاليات",
      heating: "تدفئة", dryer: "نشّافة", hairdryer: "مجفف شعر", iron: "مكواة", safe: "خزنة بالغرفة", smoking: "يُسمح بالتدخين",
    },
    extras: {
      beach: "رسوم نزول البحر", pickup: "استقبال من المطار", cleaning: "تنظيف يومي",
      breakfast: "توصيل إفطار", chef: "شيف خاص", driver: "سائق خاص", tour: "جولات وأنشطة",
    },
    results: {
      all: "كل العقارات",
      staysIn: (x) => `إقامة في ${x}`,
      meta: (n, dates, g) => `${n} عقار · ${dates} · ${g} ضيف`,
      sortRecommended: "ترتيب: مقترح",
      sortPriceAsc: "السعر: من الأقل للأعلى", sortPriceDesc: "السعر: من الأعلى للأقل",
      sortRating: "الأعلى تقييماً", sortArea: "الأكبر مساحة",
      noResults: "لا توجد عقارات مطابقة للفلاتر",
      tryRemoving: "جرّب إزالة بعض الفلاتر أو توسيع البحث.",
      clearFilters: "مسح الفلاتر",
    },
    card: {
      br: (n) => `${n} غرفة`, bath: (n) => `${n} حمام`, perNight: "/ليلة",
    },
    detail: {
      title: "تفاصيل العقار",
      ownerWarn: "الوحدة تحتاج موافقة المالك قبل الحجز",
      ownerWarnDesc: "اتصل بالمالك دلوقتي للتأكد من توفّر الوحدة قبل ما تعرض السعر أو تحجزها للعميل.",
      instantOk: "حجز فوري · لا تحتاج موافقة المالك",
      instantOkDesc: (name, phone) => `تقدر تأكد الحجز فوراً. بيانات المالك المسجّلة: ${name} (${phone}).`,
      shareTitle: "شارك مع العميل",
      shareHelp: "ابعت للعميل لينك الوحدة على الموقع علشان يشوف الصور والوصف الكامل والسعر مباشرة.",
      copyLink: "نسخ اللينك", shareWA: "مشاركة عبر واتساب", shareEmail: "إرسال بالإيميل",
      about: "عن المكان", sleep: "أماكن النوم",
      bedsTotal: (n) => `${n} سرير إجمالي`,
      offers: "ما يوفّره المكان",
      addons: "خدمات إضافية متاحة", addonsHint: "إضافات مدفوعة",
      pricing: "تفاصيل السعر",
      cleaning: "رسوم نظافة", utilities: "مرافق (مياه وكهرباء)", bookingFee: "مصاريف حجز", deposit: "تأمين مسترد (يُرد عند المغادرة)",
      rules: "قواعد المنزل والسياسات",
      checkInOut: "وقت الدخول / الخروج", minStay: "أقل مدة إقامة", cancellation: "سياسة الإلغاء",
      bedrooms: "غرفة نوم", bathrooms: "حمام", areaM2: "م² مساحة",
      superhost: "مضيف متميز", verified: "موثّق",
      nightsTotal: "إجمالي",
      inclusive: (c, p, n) => `${p} ${c} × ${n} ليالٍ · شامل كل الرسوم`,
      waMsg: (first, name) => `أهلاً ${first}، أنا سارة من Houseiana. عميل مهتم بـ "${name}" — ممكن تأكدلي توفّرها؟`,
      shareMsg: (name, loc, c, price, url) =>
        `شوف العقار ده على Houseiana: ${name} — ${loc}\n${price} ${c}/ليلة\n${url}`,
    },
    booking: {
      bookHeading: (name) => `حجز — ${name}`,
      steps: { guest: "العميل", extras: "ملاحظات", payment: "الدفع", confirm: "التأكيد" },
      searchGuest: "ابحث عن عميل موجود",
      searchGuestPlaceholder: "اسم، إيميل، تليفون، أو رقم العميل...",
      noMatches: "لا توجد نتائج. استخدم النموذج بالأسفل لإضافة عميل جديد.",
      orNew: "أو أضف عميل جديد",
      firstName: "الاسم الأول", lastName: "اسم العائلة", email: "البريد الإلكتروني", phone: "رقم التليفون",
      nationality: "الجنسية", selectNat: "— اختر —",
      nationalities: { egyptian: "مصري", saudi: "سعودي", emirati: "إماراتي", qatari: "قطري", kuwaiti: "كويتي", british: "بريطاني", american: "أمريكي", other: "أخرى" },
      prefLang: "اللغة المفضّلة",
      langs: { english: "الإنجليزية", arabic: "العربية" },
      bookingsCount: (n) => `${n} حجز`,
      addExtras: "أضف إضافات مدفوعة",
      specialReqs: "طلبات خاصة وأكواد",
      notesLabel: "ملاحظات للمضيف",
      notesPlaceholder: "مثال: وصول متأخر بعد منتصف الليل، أو دخول مبكر إذا أمكن...",
      promoLabel: "كود خصم / برومو",
      promoPlaceholder: "WELCOME10, AGENT5...",
      agentDiscount: "خصم استثنائي من الموظف (%)",
      agentDiscountHelp: "أقصى 20% · يحتاج موافقة فوق 10%",
      paymentMethod: "طريقة الدفع",
      chargeTiming: "توقيت الدفع",
      chargeOptions: { full: "خصم المبلغ كاملاً الآن", half: "50% الآن، الباقي عند الوصول", atProperty: "دفع في العقار (بموافقة المضيف)" },
      currency: "العملة",
      summary: "ملخص الحجز",
      extras: "إضافات",
      commission: "عمولتك (5%)",
      payments: {
        card: { name: "لينك دفع فيزا", desc: "ابعت للعميل لينك آمن عبر واتساب → يضغط ويدخل بيانات البطاقة على صفحة الدفع بتاعتنا.", logo: "VISA" },
        paylink: { name: "لينك من شركة المدفوعات (Paymob)", desc: "ابعت لينك دفع عبر واتساب. العميل بيدفع ببطاقة / محفظة / فوري، وبعدين بيبعت إيصال الدفع.", logo: "PAYMOB" },
        instapay: { name: "تحويل InstaPay", desc: "العميل بيحوّل على حساب InstaPay بتاعنا ويبعت سكرين شوت من الإيصال.", logo: "INSTAPAY" },
      },
      paymentLabel: { card: "لينك فيزا", paylink: "لينك Paymob", instapay: "InstaPay" },
      securityTitle: "ممنوع تماماً تاخد رقم البطاقة من العميل",
      securityDesc: "ممنوع طلب رقم البطاقة أو CVV أو تاريخ الانتهاء أو الـ PIN تحت أي ظرف. ابعت فقط لينك الدفع عبر واتساب أو الإيميل، والعميل بيدخل بيانات بطاقته بنفسه على صفحة الدفع الآمنة.",
      sendWA: "إرسال لينك الدفع عبر واتساب",
      sendEmail: "إرسال بالإيميل",
      sendWADisabled: "اختر أو أضف عميل برقم تليفون أولاً",
      sentSuccess: "تم إرسال لينك الدفع عبر واتساب",
      cardHelp: "العميل بيدفع مباشرة على صفحة آمنة (فيزا/ماستركارد/ميزة). تأكد من الدفع من dashboard البوابة قبل تأكيد الحجز.",
      paylinkHelp: "بعد ما العميل يدفع، اطلب منه يبعت سكرين شوت من إيصال الدفع على واتساب. تأكد من الإيصال قبل تأكيد الحجز.",
      instapayHelp: "ابعت للعميل اسم الحساب والمبلغ. لما يحوّل، هيبعتلك سكرين شوت — راجعه قبل التأكيد.",
      instapayHandle: "houseiana@instapay",
      instapayHandleLabel: "اسم الحساب على InstaPay",
      amountDue: "المبلغ المطلوب",
      verifyCheck: "تم التأكد من إيصال الدفع من العميل",
      verifyHint: "إجباري قبل تأكيد الحجز — راجع سكرين شوت الإيصال على واتساب أو dashboard البوابة.",
      verifyDoneToast: "تم تأكيد استلام الدفع",
      waCardMsg: (first, name, checkin, checkout, nights, guests, currency, amount, link) =>
        `أهلاً ${first}! شكراً لاختيارك Houseiana 🏡\n\nتفاصيل حجزك:\n• ${name}\n• الوصول: ${checkin}\n• المغادرة: ${checkout}\n• ${nights} ليالٍ · ${guests} ضيف\n• الإجمالي: ${amount} ${currency}\n\nادفع بأمان بالبطاقة من هنا:\n${link}\n\n🔒 Houseiana مش هتطلب منك رقم البطاقة على الشات أبداً — ادخل البيانات فقط على الصفحة الآمنة فوق.`,
      waPaylinkMsg: (first, name, currency, amount, link) =>
        `أهلاً ${first}، ده لينك الدفع لـ "${name}":\n\nالمبلغ: ${amount} ${currency}\nادفع من هنا: ${link}\n\nبعد ما تدفع، ابعتلنا سكرين شوت من الإيصال علشان نأكد حجزك. شكراً!`,
      waInstapayMsg: (first, name, currency, amount, handle) =>
        `أهلاً ${first}، من فضلك حوّل مبلغ الحجز عبر InstaPay:\n\nالحساب: ${handle}\nالمبلغ: ${amount} ${currency}\nلـ: ${name}\n\nبعد التحويل، ابعتلنا سكرين شوت من الإيصال وهنأكد حجزك على طول.`,
      confirmed: "تم تأكيد الحجز",
      confirmedSub: "ابعت التأكيد للعميل، وأبلِغ مالك العقار بالحجز.",
      confDetails: { guest: "العميل", property: "العقار", checkin: "الوصول", checkout: "المغادرة", guests: "الضيوف", nights: "الليالي" },
      shareGuestConfirm: "إرسال تأكيد الحجز للعميل",
      notifyOwner: "إخطار مالك العقار",
      actionsTitle: "مشاركة مع",
      waGuestConfirmMsg: (first, ref, name, loc, checkin, checkout, nights, guests, currency, amount, checkinTime, checkoutTime) =>
        `أهلاً ${first}! ✅ تم تأكيد حجزك.\n\nرقم الحجز: ${ref}\nالعقار: ${name}\nالمكان: ${loc}\nالوصول: ${checkin} (بعد الساعة ${checkinTime})\nالمغادرة: ${checkout} (قبل الساعة ${checkoutTime})\nالإقامة: ${nights} ليالٍ · ${guests} ضيف\nالمدفوع: ${amount} ${currency}\n\nبنشكرك على ثقتك في Houseiana. لو محتاج أي حاجة، رد على الرسالة دي.`,
      waOwnerNotifyMsg: (ownerFirst, name, checkin, checkout, nights, guestName, guestPhone, guests, currency, amount, ref, notes) =>
        `أهلاً ${ownerFirst}، وحدتك "${name}" تم حجزها ✅\n\nالتواريخ: ${checkin} → ${checkout} (${nights} ليالٍ)\nالعميل: ${guestName} · ${guestPhone}\nعدد الضيوف: ${guests}\nالدفع: ✅ تم تحصيل المبلغ بالكامل (${amount} ${currency})\n\nرقم الحجز: ${ref}${notes ? `\nملاحظات العميل: ${notes}` : ""}\n\nبرجاء تجهيز الوحدة لاستقبال العميل. شكراً جزيلاً! — Houseiana`,
    },
    owner: { title: "المالك", callOwner: "اتصل بالمالك", waOwner: "واتساب المالك" },
    bookingsPage: {
      title: "كل الحجوزات",
      subtitle: "إدارة الحجوزات عبر كل العقارات.",
      exportCsv: "تصدير CSV", newBooking: "+ حجز جديد",
      pillsAll: "الكل",
      headers: { ref: "المرجع", guest: "العميل", property: "العقار · الإقامة", dates: "التواريخ", total: "الإجمالي · الدفع", status: "الحالة", actions: "إجراءات" },
      statuses: { confirmed: "مؤكد", pending: "معلّق", checkedin: "تم الوصول", checkedout: "تم المغادرة", cancelled: "ملغى" },
      nightsLbl: (n) => `${n} ${n === 1 ? "ليلة" : "ليالٍ"}`,
      stats: {
        todayIn: "وصول اليوم",
        inHouse: "ضيوف بالداخل",
        todayOut: "مغادرة اليوم",
        paymentPending: "دفع معلّق",
        upcomingWeek: "خلال 7 أيام",
      },
      urgency: {
        today: "اليوم",
        tomorrow: "بكرة",
        inDays: (n) => `خلال ${n} أيام`,
        inHouse: "داخل الوحدة",
        checkoutToday: "خروج اليوم",
        lateCheckout: "تأخر المغادرة",
      },
      tier: { vip: "VIP", repeat: "متكرر", new: "جديد" },
      paymentLabel: { paid: "مدفوع", partial: "جزئي", pending: "غير مدفوع" },
      paymentPartial: (pct) => `جزئي · ${pct}%`,
      channels: { wa: "واتساب", call: "اتصال", web: "موقع", direct: "مباشر" },
      actions: { call: "اتصل بالعميل", whatsapp: "واتساب العميل", viewNotes: "عرض الملاحظات", more: "المزيد" },
      filters: {
        all: "الكل", today: "اليوم", tomorrow: "بكرة",
        inHouse: "بالداخل", pendingPay: "غير مدفوع", upcoming: "قادمة",
      },
      guestsCount: (n) => `${n} ضيف`,
      noBookings: "لا توجد حجوزات مطابقة لهذا الفلتر.",
    },
    guestsPage: {
      title: "العملاء", subtitle: "قاعدة بيانات العملاء وسجل الحجوزات.",
      searchPlaceholder: "ابحث عن عميل...", addGuest: "+ إضافة عميل",
      stats: { total: "إجمالي العملاء", repeat: "عملاء متكررون", avgLtv: "متوسط قيمة العميل", vip: "عملاء VIP", thisMonth: "هذا الشهر", vipNote: "5+ حجوزات" },
      headers: { guest: "العميل", contact: "وسيلة التواصل", nationality: "الجنسية", bookings: "الحجوزات", ltv: "قيمة العميل", lastStay: "آخر إقامة", tags: "وسوم" },
      tags: { repeat: "متكرر", vip: "VIP", new: "جديد" },
      lastStays: { "G-1042": "منذ أسبوعين", "G-2018": "منذ 3 أيام", "G-0892": "الشهر الماضي", "G-1577": "منذ 5 أيام", "G-2204": "منذ شهرين", "G-0331": "اليوم" },
    },
    kpis: {
      title: "أدائي", subtitle: "سارة المنصوري · كبير موظفي الحجز",
      periods: { mtd: "هذا الشهر", last: "آخر 30 يوم", qtd: "هذا الربع", ytd: "منذ بداية السنة", all: "كل الفترات" },
      exportBtn: "تصدير",
      callsReceived: "المكالمات الواردة", callsConverted: "المكالمات المحوّلة", conversionRate: "نسبة التحويل",
      bookingsMine: "الحجوزات (حسابي)", totalAmount: "إجمالي المبلغ",
      vsLast: "مقارنةً بالشهر الماضي", bookedFromCalls: "محجوزة من المكالمات",
      teamAvg: "متوسط الفريق 22%", allTime142: "142 إجمالي", commission144: "العمولة 14.4 ألف ج.م",
      monthlyTitle: "الحجوزات الشهرية — مصر", monthlySub: "الوحدات المحجوزة خلال آخر 6 أشهر",
      egyptBookings: "حجوزات مصر",
      months: { Dec: "ديسمبر", Jan: "يناير", Feb: "فبراير", Mar: "مارس", Apr: "أبريل", May: "مايو" },
      statusTitle: "حالة الحجوزات", statusSub: "هذا الشهر · 38 إجمالي",
      statuses: { confirmed: "مؤكد", checkedin: "تم الوصول", pending: "معلّق", checkedout: "تم المغادرة", cancelled: "ملغى" },
      funnelTitle: "مسار المكالمات ← الحجوزات", funnelSub: "أين تتسرّب المكالمات",
      funnel: { received: "المكالمات الواردة", qualified: "عملاء مؤهّلون", quoted: "تم إرسال عرض", confirmed: "حجز مؤكد" },
      funnelInsight: "العرض ← التأكيد: 54%. أكبر تسرّب عند مرحلة العرض — حاول الرد على العملاء أسرع.",
      catsTitle: "الحجوزات حسب النوع", catsSub: "العدد والمبلغ لكل نوع · هذا الشهر",
      cats: { apartments: "شقق", villas: "فيلات", penthouses: "بنتهاوسات", studios: "استوديوهات", chalets: "شاليهات" },
      catsBookings: "حجز",
      totalBookings: "الإجمالي · 38 حجز",
      topTitle: "أعلى العقارات حجزتها — مصر", topSub: "ترتيب حسب الحجوزات هذا الشهر",
      topHeaders: { rank: "#", property: "العقار", category: "النوع", bookings: "الحجوزات", amount: "المبلغ", commission: "عمولتي" },
      goalTitle: "هدف الشهر", goalSub: "الهدف: 45 وحدة · 84% من الهدف",
      onTrack: "على المسار", goalNote: "تحتاج 7 حجوزات إضافية · 22 يوم متبقّي · بمعدل 0.3/يوم",
      otherGoals: "أهداف أخرى",
      goalRows: { amount: "المبلغ · 350 ألف ج.م", calls: "تحويل المكالمات · 35%", repeat: "عملاء متكررون · 35%" },
      leaderboardTitle: "ترتيب الفريق — مصر", leaderboardSub: "موظفو الحجز · هذا الشهر",
      units: "وحدة",
    },
    inbox: {
      title: "صندوق الرسائل", demoCall: "اتصال تجريبي",
      tabs: { all: "الكل", calls: "المكالمات", whatsapp: "واتساب", missed: "فائتة" },
      statuses: { qualified: "مؤهّل", quoted: "تم إرسال عرض", booked: "محجوز", lost: "ضائع", new: "عميل جديد" },
      connectedChannels: "القنوات المتصلة",
      waBusiness: "واتساب الأعمال", voice: "الصوت — Twilio",
      waMeta: "‎+20 103 642 5474‎ · متّصل عبر Meta Cloud API",
      voiceMeta: "‎+20 2 2480 5500‎ · موجَّه إلى السماعة عبر الويب",
      live: "نشط", addChannel: "+ إضافة قناة",
    },
    call: { voiceInc: "مكالمة صوتية واردة · Twilio", waInc: "مكالمة واتساب واردة", context: "السياق", decline: "رفض", accept: "قبول" },
    toast: {
      favSaved: "تمت الإضافة للمفضّلة", favRemoved: "تمت الإزالة من المفضّلة",
      searchUpdated: "تم تحديث البحث", filtersCleared: "تم مسح الفلاتر",
      selectedGuest: (n) => `تم اختيار ${n}`,
      promo: (n) => `تم تطبيق الخصم: -${n}%`,
      selectGuestFirst: "من فضلك اختر أو أضِف عميل أولاً",
      bookingConfirmed: "تم تأكيد الحجز",
      callAccepted: "تم قبول المكالمة · توجيه إلى السمّاعة",
      callDeclined: "تم رفض المكالمة · أُضيفت للفائتة",
      linkCopied: "تم نسخ لينك العقار",
      linkCopyFail: "تعذّر النسخ — انسخ يدوياً",
    },
  },
};
