# Houseiana — Booking Agent Console (Next.js)

Frontend-only Next.js port of the original `houseiana_booking_agent.html` single-page app.
No backend, no database — all data lives in [data/index.ts](data/index.ts) as TypeScript constants.

## Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- Plain CSS (the original stylesheet, kept verbatim in [app/globals.css](app/globals.css))

## Run

```bash
npm install
npm run dev
```

Open http://localhost:4000.

## Build

```bash
npm run build
npm run start
```

## Project layout

```
app/
  globals.css     # all styling from the original HTML
  layout.tsx      # root layout, loads Readex Pro font
  page.tsx        # main client component — full UI + interactivity
components/
  Icons.tsx       # reusable inline SVG icons
data/
  index.ts        # PROPERTIES, GUESTS, BOOKINGS, DESTINATIONS, INBOX, etc.
```

## What was ported

- **Search & Book** page with filters (price, type, rooms, area, amenities, extras, booking flags), sort, and property grid
- **Property detail drawer** with hero, quick facts, description, amenities, add-ons, pricing breakdown and policies
- **4-step booking flow** (guest → extras → payment → confirmation) with promo / agent discounts and a live totals box
- **Bookings page** and **Guests page** with their tables and KPI strips
- **My KPIs page** with stat cards, monthly chart, funnel, category breakdown, top properties, monthly goal, and team leaderboard
- **Inbox panel** with tabs (all / calls / WhatsApp / missed) and channel setup
- **Incoming call modal** with a "Demo" button in the sidebar / inbox that cycles through sample callers
- **RTL toggle** (Arabic) wired to `<html dir>` and a `rtl` body class
- **Toast** notifications

Everything is client-side and reactive via React state — no localStorage, no API calls.
