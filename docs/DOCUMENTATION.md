# SafarSathi: Project Documentation

**One AI copilot that fixes the whole journey, not just one leg of it.**

SafarSathi ("travel companion") is a mobile app that plans door-to-door journeys across India using walking, auto-rickshaws, bike taxis, cabs, metro, city buses, trains, flights, intercity buses and the user's own EV. It books every leg in one place, finds EV chargers and parking, and replans automatically when something is delayed. Users can type or speak to it in 11 Indian languages.

It was built for the iQOO Grand Finale hackathon (Mobility theme), starting from the build specification in [`SPEC.md`](../SPEC.md). This document covers the whole project: what it does, how it is built, how to run it, everything that was changed after the original eight build phases, the problems found along the way, and what is still open.

Related files:

- [`SPEC.md`](../SPEC.md): the original build specification.
- [`DECISIONS.md`](../DECISIONS.md): every design choice made during the eight build phases.
- [`README.md`](../README.md): the short run guide.

---

## Contents

1. [Status at a glance](#1-status-at-a-glance)
2. [The product](#2-the-product)
3. [Features](#3-features)
4. [Architecture and tech stack](#4-architecture-and-tech-stack)
5. [Repository layout](#5-repository-layout)
6. [Backend](#6-backend)
7. [Mobile app](#7-mobile-app)
8. [Data](#8-data)
9. [Configuration](#9-configuration)
10. [Running the project](#10-running-the-project)
11. [Demo script](#11-demo-script)
12. [Testing and measurements](#12-testing-and-measurements)
13. [Project history](#13-project-history)
14. [Troubleshooting](#14-troubleshooting)
15. [Security notes](#15-security-notes)
16. [Open items and next steps](#16-open-items-and-next-steps)

---

## 1. Status at a glance

| Area | Status |
| --- | --- |
| All eight spec phases (planner, copilot, EV, parking, bookings, replanning, polish) | Done |
| AI chat | Runs on **Google Gemini** (`gemini-3.5-flash-lite`); falls back to Sarvam, then an offline assistant |
| Voice in and out, 11 languages | Done (Sarvam AI) |
| Trips anywhere in India | Done (OpenStreetMap place search + hub-and-cab routing) |
| EV chargers and parking across India | Done (OpenStreetMap; 600 chargers, 2,419 parking lots in 44 cities, plus live lookups) |
| Accounts (email + password), saved trips per user | Done |
| Maps (Leaflet + CARTO tiles), current location | Done |
| Full-screen loading animations, a different scene per screen | Done |
| Account menu with Light / Dark / System theme | Done |
| Tested on a real Android phone | The app was opened and used on the developer's phone over a hotspot. The latest UI changes have not yet been checked on a phone. |
| Database on MongoDB Atlas | **Prepared, not active.** Blocked on the Atlas database-user password (see [section 16](#16-open-items-and-next-steps)). The app runs on a local SQLite database. |
| App usable from any phone, anywhere | **Not yet.** Free tunnels were blocked on this network; needs ngrok or a cloud deployment (see [section 16](#16-open-items-and-next-steps)). |
| "Continue with Google" sign-in | **Not done.** Needs a Google OAuth client ID and a custom app build (see [section 16](#16-open-items-and-next-steps)). |

---

## 2. The product

### Problems it solves

| Problem | SafarSathi's answer |
| --- | --- |
| Many public EV chargers in India don't work (only 6,645 of 9,332 FAME-II chargers were operational in March 2026) | Charger map with working status and crowd reports |
| Too few chargers for the EVs on the road | Range-aware EV trip planning that adds charging stops |
| Poor first- and last-mile connectivity | Door-to-door routes combining metro, bus, auto and bike taxi |
| No parking information | Parking finder with predicted free spots and reservations |
| Bookings spread across many apps | One itinerary and one booking flow for every leg |
| Delays break connections | Automatic disruption alerts and AI replanning |
| Language barriers | Voice and text chat in 11 Indian languages |

### Target users

Daily metro and bus commuters, intercity travellers combining trains, flights and buses, EV owners, and first-time or elderly travellers who prefer speaking in their own language.

---

## 3. Features

### Journey planning

- Ask in Chat ("Kothrud to Connaught Place, Delhi by 8 PM tomorrow"), or use the Home quick chips (Home, Office, Airport, Station).
- Returns up to three options. Each option carries honest badges for what it truly wins: **Fastest**, **Cheapest** or **Greenest**. One route that wins several metrics shows all its badges once.
- Combines walking, auto, bike taxi, cab, Pune Metro and Delhi Metro, PMPML buses, trains, flights, intercity buses and EV drives, with boarding buffers, peak-hour speeds and India time.
- **Anywhere in India:** names the demo data doesn't know (for example "Bikaner") are looked up on OpenStreetMap. Long trips chain a real timetabled service to a hub city with an outstation cab, for example *Pune → Delhi flight, then a cab to Bikaner*. Door-to-door outstation cabs are offered up to 1,500 km.
- Trips start from the user's **current location** when they don't name a start point.
- Every journey card shows a **green score**: CO₂ saved compared with driving alone.

### Bookings and trips

- **Book all** books every bookable leg of a trip through mock providers. Trains get 10-digit PNRs, flights 6-letter PNRs, and metro, cab and intercity-bus legs get booking references.
- The **Trips** tab lists Upcoming, Saved plans and Past trips per account.

### Disruptions and replanning

- A simulated delay (long-press the trip title on the Journey screen) is pushed to the phone over Server-Sent Events. A red alert banner appears within milliseconds.
- **Fix my trip** opens Chat. The copilot explains the impact in one sentence and offers new plans from the user's current point, keeping the original deadline and excluding the delayed service.
- Accepting a new plan marks the old trip **Replaced**.

### EV chargers

- Map and list of chargers, colour-coded **Working / Busy / Broken / Unknown**, with connector and power filters.
- The charger detail screen shows power, price, the last-verified time and recent crowd reports. Reporting **Broken** turns the pin red immediately.
- **Coverage:** 40 curated Pune and highway chargers, plus 600 chargers across India from OpenStreetMap. More are looked up live for any new area within a 300 km search radius.
- EV trips use the car's current battery level and add charging stops near the route.

### Parking

- Lots within 15 km of the user, or of a searched destination. If none are in range, the nearest five are shown with a clear note.
- Predicted free spots for the chosen arrival time (now, in 1 hour, in 3 hours), based on each lot's hourly occupancy pattern.
- Mock **Reserve** with a booking reference.
- **Coverage:** 25 curated Pune lots, plus 2,419 OpenStreetMap lots in 44 major cities, plus live lookups elsewhere. Counts for OpenStreetMap lots are marked as estimates. An unknown rate shows "Rate n/a", and the user pays at the lot.

### AI copilot

- Tool-using agent: the language model decides which backend tools to call (plan, replan, chargers, parking, book, trip details, place lookup, memory). **It never invents trains, flights, prices or chargers**; every fact comes from a tool result.
- Providers in order: **Claude → Gemini → Sarvam → offline assistant**. The first one with a working key answers. Today that is Gemini, because the Anthropic account has no API credits.
- **Long-term memory** (Cognee plus a local copy) of saved places, preferences and booked trips.
- Knows the user's current location, so "parking near me" works.

### Voice and languages

- The UI is translated into **11 languages**: English, Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Punjabi and Odia. Each language can be chosen on Home, in Chat or in the account menu.
- Mic input is transcribed by Sarvam `saaras:v4`. Replies are read aloud by Sarvam `bulbul:v3`, or by the phone's own voice when Sarvam isn't configured.

### Accounts

- Email and password **sign-up / log-in**. Each account has its own trips, alerts and memories.
- Sessions survive app restarts (the token is kept in the phone's secure storage). Logging out ends the session on the server.
- A seeded demo account exists for presentations: `demo@safarsathi.app` / `demo1234`.

### Look and feel

- **Startup screen:** a bus drives in and keeps running until the backend responds, then drives off into the app.
- **A different full-screen loading scene for each screen** (see [section 7](#loading-animations)).
- **Account menu** (☰ button on Home): profile and trip counts, **Light / Dark / System** appearance, language, home address and EV details, shortcuts, and log out.
- Teal accent colour, dark mode, large touch targets, fade-in lists, skeleton cards, and empty and error states.

---

## 4. Architecture and tech stack

```
┌──────────────────────────┐   HTTPS/HTTP (JSON, Bearer token)   ┌──────────────────────────────┐
│  Mobile app (Expo Go)    │ ───────────────────────────────────▶ │  Backend (Node.js + Express) │
│  React Native, TypeScript│ ◀─────────────── SSE alerts ──────── │  TypeScript, Zod, Prisma     │
│  Leaflet map in WebView  │                                      │                              │
└──────────────────────────┘                                      │  services: planner, replanner│
           │ map tiles                                            │  ai: agent + tools           │
           ▼                                                      │  adapters: one per source    │
   CARTO / OpenStreetMap                                          └──────────────┬───────────────┘
                                                                                 │
     ┌───────────────────┬─────────────────────┬──────────────────┬──────────────┼──────────────────┐
     ▼                   ▼                     ▼                  ▼              ▼                  ▼
 SQLite (Prisma)   Gemini / Claude /      Sarvam AI         Cognee         OpenStreetMap      Open Charge Map
 (MongoDB Atlas    Sarvam LLMs            speech to text,   long-term      Nominatim (places) (optional key)
  prepared)        (chat tool use)        text to speech    memory         Overpass (chargers,
                                                                           parking)
```

The backend owns all data and the AI agent. The app only renders data and sends what the user types or says.

### Request flow for a chat question

1. The user types or speaks: "Kothrud to Pune Airport by 6 PM".
2. The app sends `POST /api/chat` with the conversation, language and current location, plus the login token.
3. The backend builds the prompt (rules, user profile, recent memories, current time and location) and calls the first available LLM with the tool definitions.
4. The LLM calls tools such as `plan_journey`. The backend runs each tool and returns the results, for up to 5 rounds.
5. The LLM writes a short reply. The backend returns `{ reply, cards }`, and the app renders the reply with itinerary, charger or parking cards.

### Tech stack

| Layer | Choice |
| --- | --- |
| Mobile | Expo SDK 57, React Native 0.86, TypeScript, Expo Router (file-based routes in `mobile/src/app`) |
| Maps | Leaflet 1.9.4 inside `react-native-webview`, CARTO basemap tiles (with key), OpenStreetMap tiles as fallback |
| Location, storage, audio | `expo-location`, `expo-secure-store`, `expo-audio` |
| Backend | Node.js 20+ (developed on Node 24), Express 5, TypeScript run through `tsx` |
| Validation | Zod 4 (API inputs and LLM tool arguments) |
| Database | Prisma 6 with SQLite (`backend/prisma/dev.db`); a MongoDB Atlas schema is prepared |
| AI | Gemini (OpenAI-compatible endpoint), Anthropic Claude (`@anthropic-ai/sdk`), Sarvam chat, offline rule-based assistant |
| Speech | Sarvam AI `saaras:v4` (speech to text) and `bulbul:v3` (text to speech) |
| Memory | Cognee (cloud tenant) plus local `Memory` table |
| Real-time | Server-Sent Events (`GET /api/alerts/stream`) |
| Open data | OpenStreetMap Nominatim (place search) and Overpass (chargers, parking) |
| Tests | Vitest (backend) |
| Quality | ESLint, Prettier, `tsc --noEmit` on both apps |

---

## 5. Repository layout

```
Mobility/
├── SPEC.md, DECISIONS.md, README.md
├── docs/DOCUMENTATION.md        ← this file
├── tools/                       local binaries (cloudflared), not committed
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        active schema (SQLite)
│   │   ├── mongodb/schema.prisma prepared MongoDB Atlas schema
│   │   └── seed.ts              resets the demo: demo user, Pune + India data, memories
│   ├── data/                    seed and lookup data (see section 8)
│   ├── scripts/
│   │   ├── generate-data.ts     regenerates the Pune mock data (seeded RNG)
│   │   ├── plan.ts              prints planner output from the command line
│   │   ├── fetch-osm-india.ts   downloads all-India chargers and city parking from OpenStreetMap
│   │   └── import-osm-india.ts  loads that data into the database without touching accounts
│   ├── src/
│   │   ├── index.ts             Express app: open routes, then requireAuth, then the rest
│   │   ├── routes/              alerts, auth, bookings, chargers, chat, health, journeys, parking, profile
│   │   ├── services/            planner, replanner, bookings, trips, parkingPredictor, greenScore
│   │   ├── ai/                  agent (provider chain), claudeAgent, geminiAgent, sarvamAgent,
│   │   │                        openaiCompat (shared tool loop), tools, systemPrompt, offline,
│   │   │                        planCache, requestContext
│   │   ├── adapters/            booking, chargers (mock / OSM / Open Charge Map), geocode, memory
│   │   │                        (Cognee), parking (mock / OSM), schedules, speech (Sarvam), transit
│   │   └── lib/                 auth, db, geo, http, languages, osm, sse, time, data
│   └── tests/                   planner, replanner and booking tests
└── mobile/
    └── src/
        ├── app/                 screens: (tabs)/index, chat, ev, parking, trips; plan;
        │                        journey/[id]; charger/[id]; _layout (boot → login → app)
        ├── components/          UI kit, maps, scenes, loaders, account sheet, auth screen, cards…
        ├── constants/theme.ts   colours (light/dark), spacing, radii
        └── lib/                 api client, auth, alerts (SSE), location, i18n, theme preference,
                                 secure storage, voice, formatting
```

---

## 6. Backend

### 6.1 API reference

All routes are under `/api`, return JSON, and validate input with Zod. Errors return `{ "error": "message" }` with a proper HTTP status.

**Open routes (no login):**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | `{ ok: true }` |
| POST | `/auth/signup` | `{ name, email, password, language? }` → `{ token, user }` (409 if the email exists) |
| POST | `/auth/login` | `{ email, password }` → `{ token, user }` (401 on a wrong email or password) |

**Logged-in routes** (send `Authorization: Bearer <token>`; 401 otherwise):

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/logout` | Ends the current session |
| GET / PATCH | `/me` | Profile (name, email, language, EV details, home, office, live services) / update language or battery % |
| GET | `/places?q=` | Place search: demo places first, then OpenStreetMap |
| GET | `/places/nearest?lat&lng` | Nearest demo place and its distance |
| POST | `/chat` | `{ messages, language, location? }` → `{ reply, cards, mode, provider }` |
| POST | `/speech/transcribe` | Audio (base64) → text and detected language |
| POST | `/speech/synthesize` | Text → spoken audio (cached on disk) |
| POST | `/journeys/plan` | `{ from, to, arriveBy?, departAt?, preference?, useEv? }` → up to 3 itineraries. `from` and `to` can be names or `{ name, lat, lng }` |
| POST | `/journeys/:tripId/replan` | New options after a disruption |
| GET | `/chargers?lat&lng&radiusKm&connector?&minKw?` | Chargers near a point (radius up to 500 km) |
| GET | `/chargers/:id` | Charger detail with recent reports |
| POST | `/chargers/:id/report` | `{ status, note? }` crowd report; becomes the live status |
| GET | `/parking?lat&lng&radiusKm&arriveAt?` | Lots with `predictedFreeSpots` (radius up to 500 km) |
| POST | `/parking/:id/reserve` | `{ arriveAt, hours }` → `{ reservationId, amount }` |
| GET / POST | `/trips` | List the user's trips / save an itinerary as a trip |
| GET | `/trips/:id` | Trip detail |
| POST | `/trips/:id/book-all` | Book every bookable leg |
| POST | `/bookings` | `{ tripId, legId }` → book one leg |
| POST | `/demo/disrupt` | `{ tripId, legId, delayMins }` simulate a delay (demo) |
| GET | `/alerts/stream` | Server-Sent Events: this user's disruption alerts |
| GET | `/alerts/active` | Current alerts (fallback poll) |
| POST | `/alerts/:tripId/dismiss` | Dismiss an alert |

### 6.2 Data model (Prisma)

| Model | Key fields |
| --- | --- |
| `User` | name, `email` (unique, lower-cased), `passwordHash` (scrypt), language (BCP-47, e.g. `mr-IN`), EV details (hasEv, range, connector, battery %), home/office place ids |
| `Session` | `token` (random, 32 bytes), userId, createdAt. Deleted on logout or when a user is removed |
| `Trip` | userId, title, status (PLANNED, BOOKED, IN_PROGRESS, DISRUPTED, DONE, REPLACED), option, `legs` (JSON), totals, CO₂ saved, `arriveBy`, `alertMessage` |
| `Charger` / `ChargerReport` | location, power, connectors (JSON), status, price, last verified / crowd reports |
| `ParkingLot` / `ParkingReservation` | location, spots, rate (−1 = unknown), type, 24-hour occupancy pattern / reservations |
| `Memory` | local copy of everything sent to Cognee |

Arrays and nested objects are stored as JSON strings (a SQLite limitation, kept for the MongoDB schema too). IDs that start with `osm-` come from OpenStreetMap.

### 6.3 Journey planner (`services/planner.ts`)

- **City trips:** walk, auto, bike taxi and cab, metro with line changes, and PMPML buses, with first- and last-mile legs. There are no bike taxis to or from airports and stations, because of luggage.
- **Intercity trips:** city leg → train, flight or intercity bus → city leg, using the timetables for yesterday, today and tomorrow. Buffers: 60 min before a flight, 20 min before a train, 15 min before an intercity bus.
- **Hub routes (anywhere in India):** when no timetabled service reaches the destination's city, the planner uses a service to a hub that is on the way. The cab from the hub must be at most 800 km and cover less than 60 % of the trip. Example: Pune → Delhi flight, then a cab to Bikaner.
- **Outstation cabs** door to door, up to 1,500 km.
- **EV trips:** use the current battery level, add stops at chargers within 15 km of the route (WORKING preferred), charge to 80 % and keep a 10 % reserve.
- **Speeds and fares:** road speeds halve in peak hours (8–11 AM, 5–9 PM), and cars over 40 km use 50 km/h. Fare formulas are in `DECISIONS.md` (Phase 4). Road distance is the straight-line distance × 1.3.
- **Place resolution:** a saved place (home, office), then a close match against the 54 demo places, then OpenStreetMap Nominatim (India only), then a loose demo match. Demo places only match on their name or an alias, so "Jaipur Airport" no longer resolves to Pune Airport.

### 6.4 Replanner (`services/replanner.ts`)

Applies a delay or cancellation, re-times the following legs, and checks every connection and the deadline. A broken trip becomes DISRUPTED. The alert goes only to that user's phones over SSE. Replanning starts from the first leg that hasn't departed, excludes the delayed service, keeps the original deadline, and ranks on-time options first, then by cost.

### 6.5 AI copilot (`src/ai`)

| File | Role |
| --- | --- |
| `agent.ts` | Provider chain Claude → Gemini → Sarvam → offline. `LLM_PROVIDER` picks the first; any failure falls through. Claude is skipped for 10 minutes after a "no credits" or "bad key" error. |
| `claudeAgent.ts` | Anthropic Messages API tool loop (`claude-sonnet-5-5`, prompt caching) |
| `openaiCompat.ts` | Shared OpenAI-style tool loop used by Gemini and Sarvam (up to 5 tool rounds; Gemini's thought signatures are passed back unchanged) |
| `geminiAgent.ts` | Gemini through `generativelanguage.googleapis.com/v1beta/openai`, model `gemini-3.5-flash-lite` |
| `sarvamAgent.ts` | Sarvam `sarvam-105b-conversations` |
| `tools.ts` | `plan_journey`, `replan_trip`, `find_chargers` (default 25 km), `find_parking` (15 km), `book_leg`, `get_trip`, `geocode_place`, `remember`, `recall_memory` |
| `systemPrompt.ts` | Rules (tools only, reply in the user's language, 2–4 sentences, confirm before booking), plus a context block with profile, memories, time and location |
| `offline.ts` | Rule-based assistant for the demo's requests in English, Hindi and Marathi |
| `requestContext.ts` | Passes the user's live location to tools without threading it through every call |
| `planCache.ts` | Remembers itineraries shown in chat so "book the fastest one" works in a later turn |

**Why Gemini:** Claude needs prepaid API credits, which the account doesn't have. Sarvam worked but used the same credits as voice. Measured Gemini models (one tool call each): `gemini-3.5-flash-lite` about 1.1 s, `gemini-3.5-flash` about 5 s, `gemini-3.8-flash` about 50 s, and `gemini-2.5-flash` is no longer available to new users.

### 6.6 Adapters (data sources)

Every external source sits behind an interface in `adapters/types.ts`. The active implementation is chosen in `adapters/index.ts`:

| Data | Active source | Alternatives |
| --- | --- | --- |
| Places | 54 demo places + OpenStreetMap Nominatim | Google Places later |
| Chargers | `OsmChargerAdapter` (Pune data + OpenStreetMap) | `OpenChargeMapAdapter` if `OPEN_CHARGE_MAP_KEY` is set; mock only if `DEMO_OFFLINE=true` |
| Parking | `OsmParkingAdapter` (Pune data + OpenStreetMap) | mock only if `DEMO_OFFLINE=true` |
| City transit, trains, flights, buses | mock JSON | GTFS feeds, IRCTC partner and airline APIs later |
| Bookings | mock (fake PNRs) | real providers later |
| Speech | Sarvam | phone text-to-speech and keyboard dictation |
| Memory | Cognee + local table | local table only |

### 6.7 OpenStreetMap pipeline (`lib/osm.ts`)

- **Nominatim** place search: limited to India, at most one request per second (OpenStreetMap's policy), with results cached. A result within 40 km of a demo place takes that place's city, so local transit still applies.
- **Overpass** for chargers (`amenity=charging_station`) and parking (`amenity=parking`): one request at a time (the public servers allow two per IP), two mirror servers, a 6-hour cache, and a 3-minute "recently failed" memory.
- **Database first:** if at least 3 saved results exist for an area, the API answers at once (about 0.2 s) and refreshes from OpenStreetMap in the background. For a new area it waits at most 6 s.
- New results are batch-inserted. Existing chargers keep their crowd-reported status.
- Unknown values are never invented: power 0 shows as "Power n/a", price 0 as "Price n/a", parking rate −1 as "Rate n/a", and parking capacity is an estimate by type, marked as such.
- **Bulk data:** `scripts/fetch-osm-india.ts` downloaded every charger in India (600) and public parking within 8 km of 44 city centres (2,419 lots). The download is resumable. `scripts/import-osm-india.ts` and the seed load it.

### 6.8 Accounts and security (`lib/auth.ts`, `routes/auth.ts`)

- Passwords are hashed with **scrypt** (16-byte salt) and compared in constant time.
- Sessions are random 32-byte tokens stored server-side, so logging out revokes them.
- `requireAuth` middleware runs each request inside an AsyncLocalStorage context. Services call `currentUserId()` instead of using a fixed demo user, so every trip, booking, report, reservation, memory and alert is per user.

---

## 7. Mobile app

### 7.1 App flow

```
Boot screen (bus animation)  ──backend answers──▶  Logged in?  ──no──▶  Login / Create account
                                                        │yes
                                                        ▼
                         Tabs: Home · Chat · EV · Parking · Trips   (+ Plan, Journey, Charger screens)
```

- The **boot screen** polls `GET /api/health` every 2 s. After 8 s it explains which server address it is waiting for.
- The **login screen** has a Log in / Create account switch, a "New to SafarSathi? Create an account" link, and show/hide password. When the keyboard opens, the large animation hides and the form scrolls above the keyboard.
- App state (profile, alerts, location) is created per account, so nothing carries over between users.

### 7.2 Screens

| Screen | What's on it |
| --- | --- |
| **Home** | Logo and "SafarSathi" title, language pill, ☰ menu button, alert banners, "Where to?" search with mic, quick chips, next trip card, and an offline card if the backend is unreachable |
| **Chat** | Message bubbles, inline cards, language picker, mic and speaker buttons; full-screen "thinking" scene while it works |
| **EV** | Map or list of chargers, connector and power filters, status legend with counts, bottom sheet for the selected charger |
| **Parking** | Destination search, "Parking within 15 km of …" with a **Near me** chip, arrival-time chips, map, lot cards with free-spot bar and **Reserve** |
| **Trips** | Upcoming, Saved plans and Past, with pull to refresh |
| **Plan** | Up to three route options for a destination |
| **Journey detail** | Map of the route, leg timeline, Book / Book all, green score, alert banner; long-press the title to simulate a delay |
| **Charger detail** | Status, power, price, reports, and Working / Busy / Broken buttons |
| **Account menu** (☰) | Name, email, trip / booked / upcoming counts; Appearance (System / Light / Dark); language; home; EV; shortcuts (Home, My trips, EV, Parking); Log out |

### 7.3 Maps (`components/leaflet-map.tsx`)

`react-native-maps` showed a **black map** in Expo Go on Android, which also hid the charger and parking pins. It was replaced by **Leaflet in a WebView**:

- **Tiles:** CARTO `voyager` (light) and `dark_all` (dark) with the CARTO key; plain OpenStreetMap tiles without a key. Switching the theme swaps tiles live.
- **Content:** pins coloured by status, labels (free spots), route polylines, and a blue dot for the user.
- **Behaviour:** "fit" zooms to a route, and "focus" zooms to the nearest results. Pin taps go back to the app.
- **Loading:** a pin-drop animation covers the map until the first tiles load. Without internet, the map says so.

### 7.4 Location (`lib/location.tsx`)

The app asks for location once, uses the phone's last known position first and then a fresh one, and treats anywhere in India as covered. It is used to centre the EV and Parking maps, as the default trip start, and in chat.

### 7.5 Loading animations

| Where | Scene |
| --- | --- |
| App start | Bus drives in on a road with trees and buildings, keeps running, drives off when ready |
| Login screen | Vehicle carousel: bus → auto → train → plane → EV |
| Route planning | Start pin and finish flag; the route draws itself while an auto, bus, train or plane travels it (the plane flies an arc) |
| Chat (thinking) | Pulsing assistant icon with bus, train, plane and charger orbiting, and ripple rings. After 2.5 s: "Checking live schedules and prices…" |
| EV | EV plugged into a charger: power flows along the cable, a battery fills, a lightning bolt pulses |
| Parking | Blue **P** sign; a car reverses into a marked bay |
| Trips | Train, plane and bus tickets fan out, then a **BOOKED** stamp lands |
| Map | A pin drops with ripples |

All are built with React Native `Animated` (native driver) in `components/scenes.tsx`, `travel-loader.tsx` and `boot-screen.tsx`, and fade in and out over the screen.

### 7.6 Connecting to the backend (`lib/api.ts`)

1. If `EXPO_PUBLIC_API_URL` is an `https://` address (tunnel or cloud), it is used.
2. Otherwise, in Expo Go, the app uses the address it was loaded from, on port 4000. This follows the laptop when its IP changes between Wi-Fi and hotspot.
3. Otherwise, `EXPO_PUBLIC_API_URL`, then `http://localhost:4000`.

A timeout and an unreachable server give different error messages. A 401 response signs the user out.

### 7.7 Theme

`lib/theme-preference.tsx` saves System / Light / Dark and calls React Native's `Appearance.setColorScheme`, so every screen, the map tiles and the navigation bar follow it together.

---

## 8. Data

| File (`backend/data`) | Contents |
| --- | --- |
| `places.json` | 54 named places (Pune areas, stations, airports; Delhi, Mumbai, Bengaluru, Hyderabad, Goa…) |
| `transit.json` | Pune Metro (Purple, Aqua), 10 PMPML bus routes, Delhi Airport Express and Yellow Line subset |
| `trains.json` | 8 trains Pune → Delhi / Mumbai |
| `flights.json` | 11 flights Pune → Delhi (8) / Bengaluru (3) |
| `buses.json` | 6 intercity bus routes from Pune |
| `chargers.pune.json` | 40 chargers (33 Pune + 7 highway), 28 working, 6 busy, 6 broken |
| `parking.pune.json` | 25 lots with hourly occupancy patterns |
| `chargers.india.json` | 600 chargers across India from OpenStreetMap |
| `parking.india.json` | 2,419 public parking lots in 44 cities from OpenStreetMap |

The timetables, prices, PNRs and Pune charger statuses are **demo data** (the app shows a demo-data footer). OpenStreetMap data is real but often incomplete.

The seeded demo user is Aarav: EV owner, CCS2 connector, 300 km range, battery at 30 %, home in Kothrud, office in Hinjewadi Phase 1, plus starter memories.

---

## 9. Configuration

Secrets live only in the `.env` files, which git ignores. **Never commit them.**

### `backend/.env`

| Variable | Purpose | Current setup |
| --- | --- | --- |
| `LLM_PROVIDER` | First LLM to try: `claude`, `gemini`, `sarvam`, `offline` | `gemini` |
| `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL` | Gemini chat | Key set; `gemini-3.5-flash-lite` |
| `ANTHROPIC_API_KEY` | Claude chat (needs credits) | Key set, no credits, so it's skipped |
| `SARVAM_API_KEY`, `SARVAM_CHAT_MODEL` | Voice and Sarvam chat | Key set |
| `COGNEE_API_URL`, `COGNEE_API_KEY` | Long-term memory | Set |
| `OPEN_CHARGE_MAP_KEY` | Better charger coverage | Not set (OpenStreetMap is used) |
| `DEMO_OFFLINE` | `true` = offline assistant and Pune-only data, no internet calls | `false` |
| `DATABASE_URL` | Database | `file:./dev.db` (SQLite). The Atlas URL is kept commented below it |
| `PORT` | API port | 4000 |

### `mobile/.env`

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Fallback backend address; an `https://` value always wins (tunnel or cloud) |
| `EXPO_PUBLIC_CARTO_KEY` | CARTO basemap key (without it, OpenStreetMap tiles are used) |

---

## 10. Running the project

### First-time setup

```bash
cd backend
npm install
npm run db:setup          # creates the database and seeds demo data (incl. India chargers/parking)
cd ../mobile
npm install
```

### Every time

Terminal 1:

```bash
cd backend
npm run dev               # wait for "SafarSathi backend listening on http://0.0.0.0:4000"
```

Terminal 2:

```bash
cd mobile
npx expo start -c
```

**On the phone:**

1. Install **Expo Go** from the Play Store.
2. Connect the phone and laptop to the **same network**. The phone can share its own hotspot with the laptop.
3. In Expo Go, scan the QR code **from inside Expo Go**, or tap **Enter URL manually** and type `exp://<laptop-IP>:8081`. Find the IP with `ipconfig`, under the Wi-Fi adapter's IPv4 address. Scanning with the camera or Google Lens opens the web version instead.
4. Allow location, then log in or create an account.

### Commands

| Where | Command | What it does |
| --- | --- | --- |
| backend | `npm run dev` | API with auto-reload |
| backend | `npm run db:seed` | Reset the demo. **Deletes all accounts and trips**; recreates the demo account |
| backend | `npx tsx scripts/fetch-osm-india.ts [chargers\|parking]` | Re-download OpenStreetMap data (slow, resumable) |
| backend | `npx tsx scripts/import-osm-india.ts` | Load the downloaded data without touching accounts |
| backend | `npm test` | Vitest: planner, replanner, booking |
| backend | `npm run plan -- Kothrud "Connaught Place" 20:00 [--ev]` | Print planner output |
| both | `npm run typecheck`, `npm run lint`, `npm run format` | Checks |

---

## 11. Demo script

Before you start: run `npm run db:seed`, start both servers, open the app and log in as `demo@safarsathi.app` / `demo1234`.

1. **Hook (30 s).** "Nearly 3 in 10 government-approved EV chargers in India don't work, and our metros are underused because nobody solves the last mile. Meet SafarSathi."
2. **Plan (60 s).** In Chat, say or type "Kothrud to Connaught Place, Delhi by 8 PM tomorrow". Open an option with a flight and tap **Book all**; the tickets appear in Trips.
3. **Anywhere in India (20 s).** Ask "Plan a trip from Pune to Bikaner": a flight to Delhi plus a cab, or a train plus a cab.
4. **Disruption (60 s).** On the journey screen, long-press the title, pick the flight and 90 minutes, and tap Delay. A red alert appears. Tap **Fix my trip** and accept the new plan.
5. **EV (40 s).** In the EV tab, report a charger **Broken** and watch the pin turn red. Ask "Plan an EV trip to Mahabaleshwar"; the plan includes a charging stop.
6. **Language (20 s).** Switch to मराठी, ask "जवळचे पार्किंग कुठे आहे?" and tap the speaker.
7. **Close (30 s).** Every data source sits behind an adapter, ready for IRCTC partner APIs, Open Charge Map, GTFS feeds and parking operators.

"By 8 PM today" only has on-time options before about 2 PM. Later in the day, say "tomorrow".

**Backup:** set `DEMO_OFFLINE=true` and restart the backend. The offline assistant answers the demo's requests without any LLM or internet.

---

## 12. Testing and measurements

- **Automated:** 10 Vitest tests (planner, replanner, bookings); `tsc` and ESLint on both apps; an Android bundle export after every change.
- **Checked over HTTP during development:** every endpoint, sign-up / log-in / log-out, per-user trip isolation, and duplicate-email and wrong-password errors.

| Measurement | Result |
| --- | --- |
| Chat on Gemini (plan, chargers, Marathi, Hindi) | 2.4–3.9 s |
| Chat on Sarvam (earlier) | 1.0–1.8 s |
| Chat "Pune to Bikaner" (includes online place lookup) | 12.9 s |
| Disruption alert over SSE | 14 ms after the delay |
| Chargers / parking from the database | about 0.2 s (was up to 14 s before the "database first" change) |
| Chargers / parking for a brand-new area | at most about 6 s |
| Sarvam text-to-speech | about 9 s fresh, about 10 ms cached |

---

## 13. Project history

All dates are 2–3 October 2026. Commit hashes are in brackets.

### Build phases (from SPEC.md)

| Phase | What was built |
| --- | --- |
| 1 [a1630cb] | Monorepo, Express + Prisma + SQLite backend, Expo app, health check, lint and format |
| 2 [57bbd35] | Prisma schema, all mock data (generated with a seeded RNG), seed, adapter interfaces |
| 3 [592c23b] | EV charger map and parking finder with predictions and reservations |
| 4 [90259ab] | Multimodal journey planner with honest Fastest / Cheapest / Greenest badges and tests |
| 5 [379d7c6] | AI copilot chat with tools, Sarvam voice, Cognee memory and the offline assistant |
| 6 [1927006] | Mock bookings with PNRs and the Trips tab |
| 7 [d693931] | Disruption alerts over SSE and replanning |
| 8 [cf9654e] | Polish, app icon, splash, demo footer; then all 11 UI languages [f80a316] |

### Changes after the build

| # | Request or problem | What was done |
| --- | --- | --- |
| 1 | Claude API has no free tier; no credits on the account | Copilot made provider-independent; ran on Sarvam [ee65adf] |
| 2 | Expo showed "Something went wrong" | It had been opened as a web page (QR scanned with the camera), where `react-native-maps` crashes. Added a web fallback [526160e] and explained scanning from inside Expo Go |
| 3 | Phone couldn't reach the laptop ("site can't be reached") | **McAfee and AVG firewalls** were blocking incoming connections; the user turned them off |
| 4 | Black map, no chargers, parking not working; wanted current location | Replaced `react-native-maps` with Leaflet in a WebView; added `expo-location`; Parking search fixes [e6fff6d] |
| 5 | "API KEY REQUIRED" on the map | CARTO basemaps now need a key; added `EXPO_PUBLIC_CARTO_KEY`, with OpenStreetMap tiles as fallback [f96c111] |
| 6 | Chat not working; switch to Gemini; parking spots not visible; wider radius | Gemini provider with a shared tool loop; parking 3 → 15 km with nearest-lot fallback; EV 150 → 300 km; maps zoom to the results; place-search taps fixed on Android; voice MIME fix (`audio/m4a` → `audio/mp4`) [e489437] |
| 7 | Chat said "connect to the same Wi-Fi" after switching to the hotspot | The app now finds the backend from Expo Go's own address; first loading animations [0b917ce] |
| 8 | Pune → Bikaner failed; add login; all-India chargers and parking; bus loading screen | OpenStreetMap place search and hub routing; Overpass adapters and the India data download; email + password accounts; boot screen [32b2781, 3e68540] |
| 9 | Remove the demo button, add create account, more animations; Google key provided | Create-account link; vehicle loaders. The key was an **API key**, not an OAuth client ID, so Google sign-in was not added [3167b10] |
| 10 | MongoDB Atlas connection string provided | Schema converted to MongoDB; blocked first by Atlas Network Access, then by AVG certificate interception, then by the password (see section 16) |
| 11 | Animations too small; theme switch; more account options; "Connected" pill; Reserve button hidden | Full-screen loaders; account sheet with Light / Dark / System; title fixed; Reserve layout fixed; charger and parking requests sped up from 14 s to 0.2 s [8fcebfa] |
| 12 | Login hidden by the keyboard; a different animation per screen; hamburger menu | Keyboard-aware login and chat; six distinct scenes; ☰ button with a Home shortcut [109cbd4] |
| 13 | Run on every device, not only the hotspot phone | The app accepts a public `https://` backend address [38be6d9]. Cloudflare tunnels were blocked (port 7844) and localhost.run addresses are blocked by AVG as "malicious", so public access still needs ngrok or the cloud |

### Problems hit along the way

| Problem | Cause | Fix |
| --- | --- | --- |
| Claude Code session failed with "SSL certificate verification failed" | AVG re-signs HTTPS traffic with its own certificate | Turn off AVG HTTPS scanning (recommended), or trust AVG's root certificate |
| `npm install` TLS handshake errors | Same cause | `NODE_OPTIONS=--use-system-ca` |
| Phone couldn't reach the laptop | McAfee and AVG firewalls | Turned off during development (Windows Firewall stays on) |
| Black map in Expo Go | `react-native-maps` on Expo Go SDK 57 Android | Leaflet in a WebView |
| Sarvam rejected voice recordings | Android labels recordings `audio/m4a` | Sent as `audio/mp4` |
| Charger and parking requests took up to 14 s | Waiting for overloaded OpenStreetMap servers | Database first, background refresh |
| `prisma generate` failed with EPERM | Old backend watchers held the engine file | Stopped stale `tsx watch` processes |
| Atlas: "tls handshake eof" | IP not on the Atlas access list | User added `0.0.0.0/0` |
| Atlas: "invalid peer certificate" | AVG intercepting the database connection | Local certificate bundle (`backend/certs`, not committed) via `tlsCAFile` |
| Atlas: "bad auth" | Database-user password differs from the one provided | **Open:** reset it in Atlas → Database Access |

---

## 14. Troubleshooting

| Symptom | What to do |
| --- | --- |
| Boot screen keeps showing "Connecting…" or Home shows the offline card | Start the backend (`npm run dev`). The phone and laptop must share a network. If the phone can't open `http://<laptop-IP>:8081/status`, turn off the McAfee/AVG firewalls or allow Node.js |
| Expo Go "Something went wrong" | Scan the QR code from inside Expo Go, not with the camera; restart with `npx expo start -c` |
| Map is blank or shows "API key required" | Check `EXPO_PUBLIC_CARTO_KEY`, or remove it to use OpenStreetMap tiles; restart Expo with `-c` |
| Chat replies are tagged "Offline assistant" | No LLM reachable: check `GEMINI_API_KEY` and the backend log |
| "Please log in again" | The session ended, for example after `npm run db:seed`; log in again |
| No chargers or parking in a new area | First lookups can take up to about 6 s; OpenStreetMap may have no data there |
| `prisma generate` EPERM on Windows | Stop every running backend (`npm run dev`) and retry |
| SSL or certificate errors anywhere on this laptop | AVG HTTPS scanning; turn it off in AVG → Web Shield |

---

## 15. Security notes

- **Rotate every key that was pasted into the chat** during development: Anthropic, Sarvam, Cognee, Gemini, CARTO, the Google API key, and the **MongoDB password**. They are only in `.env` files (git-ignored), but they appeared in conversation transcripts.
- **Atlas access list `0.0.0.0/0`** lets any IP try to connect, so the database password is the only protection. Narrow it once the backend has a fixed address (for example a cloud host).
- **Turn the McAfee/AVG firewalls back on** after the demo, and consider keeping only one antivirus.
- Passwords are hashed with scrypt and never stored or logged in plain text. Sessions can be revoked.
- The certificate bundle in `backend/certs` contains AVG's root certificate. It is local to this laptop and not committed.

---

## 16. Open items and next steps

### MongoDB Atlas (needs the user)

Done so far: the schema is converted (`backend/prisma/mongodb/schema.prisma`), the access list has `0.0.0.0/0`, the AVG certificate is handled, and the connection string is in `backend/.env` (commented).

Blocked: Atlas rejects the password for `sk39648215_db_user`.

To finish:

1. In Atlas, go to Database Access → Edit `sk39648215_db_user` → Edit Password, and set a password.
2. Put it in the commented `DATABASE_URL` in `backend/.env` (URL-encode special characters; `#` becomes `%23`) and make that line the active one.
3. Stop the backend, copy `prisma/mongodb/schema.prisma` over `prisma/schema.prisma`, then run `npx prisma db push` and `npm run db:seed`.

### Use from any phone

The phone currently needs to be on the same network as the laptop. Options:

- **Quick:** an ngrok tunnel (port 443 works on this network). It needs a free ngrok account and authtoken, and the laptop must stay on.
- **Permanent (recommended):** host the backend on a cloud service such as Render with MongoDB Atlas, and build an installable Android APK with Expo EAS. It needs GitHub, Render and Expo accounts, and the Atlas password fixed.

### Google sign-in

It needs an OAuth **client ID** (`…apps.googleusercontent.com`) from Google Cloud Console. The `AIza…` API key that was provided can't sign users in, and its project has no APIs enabled. Google sign-in also doesn't work inside Expo Go; it needs an EAS development build.

### Other improvements

- Get an Open Charge Map key for much better charger coverage. OpenStreetMap has only about 600 chargers in India.
- Have native speakers review the translations; the offline assistant only has English, Hindi and Marathi templates.
- Real provider integrations (IRCTC partner APIs, airlines, GTFS feeds, parking operators), real payments, and live trip tracking.
- Run the full demo on the phone after the latest UI changes.
