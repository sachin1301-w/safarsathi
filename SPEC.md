# SafarSathi — AI Mobility Copilot: Build Specification

Oct 2, 2026 · @Master

## How to use this document with Claude Code

This is the single source of truth for building SafarSathi. Export it as Markdown, save it in the project root as `SPEC.md`, and give Claude Code the prompt below.

```
Read SPEC.md fully. It is the build specification for a hackathon app.
Follow the Phased build plan section in order, one phase at a time.
After each phase: run the app, fix errors, commit with a clear message,
then tell me what was built and wait for me to say "next".
Use mock data where the spec says mock. Never hardcode API keys; use .env.
```

Rules for Claude Code while building:

- Build phase by phase. Do not jump ahead or add features outside the MVP scope.
- Keep everything in TypeScript. Prefer simple, readable code over clever abstractions.
- Every external data source sits behind an adapter interface, so mock data can be swapped for a real API later.
- If something in this spec is ambiguous, choose the simplest option and note it in `DECISIONS.md`.
- The demo must run fully offline from the internet except for the LLM call, using seeded mock data.

## Product overview

SafarSathi ("travel companion") is a mobile app that plans an entire door-to-door journey across metro, bus, train, flight, cab and EV, then replans it automatically when something goes wrong. It is built for the iQOO Grand Finale under the Mobility theme: navigation, EVs, public transport, parking and travel experiences.

**One-line pitch:** One AI copilot that fixes the whole journey, not just one leg of it.

### Problems it solves

| Problem | Evidence | SafarSathi feature |
| --- | --- | --- |
| Many public EV chargers don't work | Only 6,645 of 9,332 FAME-II chargers were operational in March 2026 (Bolt.Earth) | Charger map with live working status and crowd reports |
| Too few chargers for EVs on the road | About one public station per 190 registered EVs (Outlook Business) | Range-aware EV trip planning with charger stops |
| Poor first and last-mile connectivity | Cited as a key barrier to metro and bus use (Storyboard18) | Door-to-door routes combining metro, bus, auto and bike taxi |
| No parking information | Illegal and double parking clog commercial areas (PW Only IAS) | Parking finder with predicted availability and pre-booking |
| Booking spread across many apps | Train, flight and bus each need separate apps | One itinerary for every leg |
| Delays break connections | Travellers replan manually | AI chatbot that detects delays and replans |
| Language barriers | Many first-time travellers struggle with English-only apps | Voice chat in English, Hindi and Marathi |

### Target users

- Daily commuters using metro and buses in cities like Pune.
- Intercity travellers combining trains, flights and buses.
- EV owners planning city or highway trips.
- First-time and elderly travellers who prefer voice in their own language.

## MVP scope

The MVP has six features, and the AI journey planner with automatic replanning is the hero feature for the demo.

| # | Feature | Priority | What it does |
| --- | --- | --- | --- |
| F1 | AI journey planner | Must | User types or speaks a trip; app returns 3 options (Fastest, Cheapest, Greenest) as multi-leg itineraries |
| F2 | Disruption replanning | Must | Simulated delay on any leg triggers an alert and a new plan from the chatbot |
| F3 | EV charger map | Must | Map of chargers with status (Working, Busy, Broken), power in kW, connector type and crowd reports |
| F4 | Parking finder | Must | Map of parking lots near a destination with predicted availability and a mock reserve button |
| F5 | Unified bookings | Should | Book train, flight and bus legs through mock providers; all tickets show in one Trips screen |
| F6 | Multilingual voice chat | Should | Chatbot answers in English, Hindi or Marathi; text-to-speech reads replies aloud |
| F7 | Green score | Could | CO2 saved per trip compared with driving alone, shown on the trip card |
| F8 | Safe-trip sharing | Could | Share live trip link with a contact; alert on route deviation |

### Out of scope for the hackathon

- Real payments. Bookings are mock and return a fake PNR or booking ID.
- Real IRCTC, airline or bus integrations. These need authorized partner access; the adapter layer is built so they can be plugged in later.
- User accounts with passwords. Use a single demo user seeded in the database.
- Live GPS tracking during travel. Simulate progress with a timer.

## Tech stack

The app is a React Native (Expo) mobile client talking to a Node.js backend, chosen so it can be demoed live on an iQOO phone.

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile app | React Native with Expo SDK (latest), TypeScript, Expo Router | Runs on Android phones via Expo Go; fast to build |
| UI | React Native Paper or NativeWind | Ready-made components, dark mode |
| Maps | react-native-maps (Google provider on Android) | Charger and parking maps, route polylines |
| Voice | expo-speech for text-to-speech; device keyboard dictation for speech input | No extra API needed |
| Backend | Node.js 20, Express, TypeScript | Simple REST API |
| Database | SQLite with Prisma ORM | Zero setup; easy seeding |
| AI | Anthropic Claude API (Messages API with tool use) | Chatbot calls backend tools to plan and replan |
| Validation | Zod | Validates API inputs and LLM tool arguments |
| Real-time | Server-Sent Events (SSE) | Push disruption alerts to the app |
| Testing | Vitest for backend | Unit tests for the route planner |

### Environment variables (`backend/.env`)

```
ANTHROPIC_API_KEY=
OPEN_CHARGE_MAP_KEY=      # optional; mock data used if empty
DATABASE_URL="file:./dev.db"
PORT=4000
```

Mobile app config (`mobile/.env`):

```
EXPO_PUBLIC_API_URL=http://<your-laptop-LAN-IP>:4000
```

## Architecture and folder structure

The project is a monorepo with two apps: `mobile/` (Expo) and `backend/` (Express). The backend owns all data and the AI agent; the mobile app only renders and sends user input.

### Request flow for a journey query

1. User types or speaks "Kothrud to Pune airport by 6 pm, cheapest" in the Chat screen.
2. Mobile app sends `POST /api/chat` with the message and conversation history.
3. Backend sends the message to Claude with the tool definitions from the AI chatbot design section.
4. Claude calls tools such as `plan_journey`, `find_chargers` or `find_parking`; the backend runs each tool against the adapters and returns results.
5. Claude writes a short reply; the backend returns the reply plus structured cards (itineraries, chargers, parking) to the app.
6. The app renders the reply and the cards. Tapping a card opens its detail screen.
7. If a disruption is simulated, the backend pushes an alert over SSE and the chatbot proposes a new plan.

### Folder structure

```
safarsathi/
├── SPEC.md
├── DECISIONS.md
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── data/                    # mock JSON seed files
│   │   ├── chargers.pune.json
│   │   ├── parking.pune.json
│   │   ├── transit.pune.json   # metro + bus stops, lines, timings
│   │   ├── trains.json
│   │   ├── flights.json
│   │   └── buses.json
│   ├── src/
│   │   ├── index.ts             # Express app
│   │   ├── routes/              # chat, journeys, chargers, parking, bookings, trips, alerts
│   │   ├── adapters/            # one interface per data source
│   │   │   ├── types.ts
│   │   │   ├── chargers.mock.ts
│   │   │   ├── chargers.openchargemap.ts
│   │   │   ├── parking.mock.ts
│   │   │   ├── transit.mock.ts
│   │   │   └── booking.mock.ts  # trains, flights, buses
│   │   ├── services/
│   │   │   ├── planner.ts       # multimodal route builder
│   │   │   ├── replanner.ts     # handles disruptions
│   │   │   ├── parkingPredictor.ts
│   │   │   └── greenScore.ts
│   │   ├── ai/
│   │   │   ├── agent.ts         # Claude tool-use loop
│   │   │   ├── tools.ts         # tool schemas + handlers
│   │   │   └── systemPrompt.ts
│   │   └── lib/                 # geo utils, time utils, sse
│   └── tests/
└── mobile/
    ├── app/                     # Expo Router screens
    │   ├── (tabs)/
    │   │   ├── index.tsx        # Home
    │   │   ├── chat.tsx
    │   │   ├── ev.tsx
    │   │   ├── parking.tsx
    │   │   └── trips.tsx
    │   ├── journey/[id].tsx
    │   └── charger/[id].tsx
    ├── components/              # JourneyCard, LegRow, ChargerPin, AlertBanner...
    ├── lib/api.ts               # typed API client
    └── lib/i18n.ts              # en, hi, mr strings
```

## Data models

Use this Prisma schema as the starting point. Arrays and nested objects are stored as JSON strings because SQLite has no native JSON column.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"  url = env("DATABASE_URL") }

model User {
  id          String   @id @default(cuid())
  name        String
  language    String   @default("en")   // en | hi | mr
  hasEv       Boolean  @default(false)
  evRangeKm   Int?                       // full-battery range
  evConnector String?                    // CCS2 | Type2 | GBT | Bharat AC001
  trips       Trip[]
  reports     ChargerReport[]
}

model Charger {
  id          String  @id
  name        String
  operator    String
  lat         Float
  lng         Float
  powerKw     Float
  connectors  String  // JSON array of connector types
  status      String  // WORKING | BUSY | BROKEN | UNKNOWN
  pricePerKwh Float
  lastVerified DateTime
  reports     ChargerReport[]
}

model ChargerReport {
  id        String   @id @default(cuid())
  chargerId String
  userId    String
  status    String   // WORKING | BUSY | BROKEN
  note      String?
  createdAt DateTime @default(now())
  charger   Charger  @relation(fields: [chargerId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
}

model ParkingLot {
  id            String @id
  name          String
  lat           Float
  lng           Float
  totalSpots    Int
  ratePerHour   Float
  type          String // MALL | STATION | AIRPORT | STREET | MULTILEVEL
  hourlyPattern String // JSON: 24 numbers, typical occupancy 0..1 per hour
  hasEvCharging Boolean @default(false)
}

model Trip {
  id          String   @id @default(cuid())
  userId      String
  title       String
  status      String   // PLANNED | BOOKED | IN_PROGRESS | DISRUPTED | DONE
  option      String   // FASTEST | CHEAPEST | GREENEST
  legs        String   // JSON array of Leg
  totalMins   Int
  totalCost   Float
  co2SavedKg  Float
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}
```

### Leg type (shared TypeScript, stored inside `Trip.legs`)

```ts
type Mode = "WALK" | "METRO" | "BUS" | "AUTO" | "BIKE_TAXI" | "CAB"
          | "TRAIN" | "FLIGHT" | "INTERCITY_BUS" | "EV_DRIVE";

interface Leg {
  id: string;
  mode: Mode;
  from: { name: string; lat: number; lng: number };
  to:   { name: string; lat: number; lng: number };
  departAt: string;      // ISO time
  arriveAt: string;
  durationMins: number;
  cost: number;          // INR
  provider?: string;     // "Pune Metro", "IndiGo", "IRCTC (mock)"
  serviceNo?: string;    // train no, flight no, bus route
  bookingRef?: string;   // mock PNR / booking id
  chargerStopId?: string;// for EV_DRIVE legs
  status: "ON_TIME" | "DELAYED" | "CANCELLED";
  delayMins?: number;
}
```

## Backend API endpoints

All endpoints are under `/api`, return JSON and validate input with Zod. Errors return `{ error: string }` with a proper HTTP status.

| Method | Path | Purpose | Key input | Returns |
| --- | --- | --- | --- | --- |
| POST | /chat | Talk to the AI copilot | `{ messages, language }` | `{ reply, cards[] }` |
| POST | /journeys/plan | Plan a trip without the chatbot | `{ from, to, arriveBy?, departAt?, preference?, useEv? }` | `{ options: Itinerary[3] }` |
| POST | /journeys/:tripId/replan | Replan after a disruption | `{ disruptedLegId }` | `{ options: Itinerary[] }` |
| GET | /chargers | Chargers near a point | `lat, lng, radiusKm, connector?, minKw?` | `Charger[]` with status |
| POST | /chargers/:id/report | Crowd report on a charger | `{ status, note? }` | updated `Charger` |
| GET | /parking | Parking near a point | `lat, lng, radiusKm, arriveAt?` | `ParkingLot[]` with `predictedFreeSpots` |
| POST | /parking/:id/reserve | Mock reservation | `{ arriveAt, hours }` | `{ reservationId }` |
| POST | /bookings | Book a leg via mock provider | `{ tripId, legId }` | `{ bookingRef }` |
| GET | /trips | List user's trips | none | `Trip[]` |
| GET | /trips/:id | Trip detail | none | `Trip` |
| POST | /demo/disrupt | Simulate a delay for the demo | `{ tripId, legId, delayMins }` | `{ ok: true }` |
| GET | /alerts/stream | SSE stream of disruption alerts | none | events `{ tripId, legId, message }` |

### Card format returned by `/chat`

```ts
type Card =
  | { type: "itinerary"; data: Itinerary }
  | { type: "chargers";  data: Charger[] }
  | { type: "parking";   data: ParkingLot[] }
  | { type: "booking";   data: { tripId: string; bookingRef: string } };

interface Itinerary {
  label: "FASTEST" | "CHEAPEST" | "GREENEST";
  legs: Leg[];
  totalMins: number;
  totalCost: number;
  co2SavedKg: number;
}
```

## Screens and UI flow

The app has five bottom tabs plus two detail screens. Design should be clean, high-contrast, large-touch-target and dark-mode ready, with a single accent colour (suggested: electric teal `#00BFA6`).

| Screen | Route | Contents |
| --- | --- | --- |
| Home | `(tabs)/index` | Greeting, big "Where to?" input with mic button, quick chips (Home, Office, Airport, Station), active trip card, alert banner if disrupted |
| Chat | `(tabs)/chat` | Chat bubbles, language toggle (EN / हिं / मरा), mic button, speaker icon to read replies, cards rendered inline under replies |
| EV | `(tabs)/ev` | Map with colour-coded charger pins (green Working, amber Busy, red Broken, grey Unknown), filters for connector and kW, list view toggle |
| Parking | `(tabs)/parking` | Search destination, map of lots with predicted free spots badge, rate per hour, Reserve button |
| Trips | `(tabs)/trips` | Upcoming and past trips, booking refs, status chips |
| Journey detail | `journey/[id]` | Vertical timeline of legs with mode icons, times, costs, booking buttons, map with route, green score, "Simulate delay" button (demo only) |
| Charger detail | `charger/[id]` | Info, last verified time, recent crowd reports, "Report status" buttons, Navigate button |

### Key interactions

1. **Plan a trip.** Home input or Chat → three itinerary cards (Fastest, Cheapest, Greenest) → tap one → Journey detail → "Book all" books every bookable leg.
2. **Disruption.** SSE alert arrives → red banner on Home and Journey detail → tap "Fix my trip" → Chat opens with the AI's replan message and new itinerary cards → tap to accept.
3. **Report a charger.** Charger detail → tap Working / Busy / Broken → pin colour updates immediately.

### Journey card layout

```
┌────────────────────────────────────────┐
│ FASTEST                       ₹1,840   │
│ 🚶 → 🚇 → ✈️ → 🚇                        │
│ Leave 2:10 PM · Arrive 7:45 PM · 5h35m │
│ 🌱 Saves 12 kg CO2                      │
└────────────────────────────────────────┘
```

Use icons from `@expo/vector-icons` (MaterialCommunityIcons) for modes in the real UI, not emoji.

## AI chatbot design

The chatbot is an agent: Claude decides which backend tools to call, the backend runs them, and Claude summarizes the results. Claude never invents trains, flights, chargers or prices; every fact comes from a tool result.

### Agent loop (`ai/agent.ts`)

1. Build the request: system prompt + conversation history + tool schemas. Use model `claude-sonnet-5-5` (check Anthropic docs for the latest model name).
2. Call the Messages API. If the response contains `tool_use` blocks, run each tool handler, append `tool_result` blocks and call again.
3. Stop after the model returns plain text or after 5 tool rounds.
4. Collect structured results from tool calls into `cards[]` so the app can render them; return `{ reply, cards }`.

### Tools (`ai/tools.ts`)

| Tool | Input | Backed by |
| --- | --- | --- |
| `plan_journey` | from, to, arriveBy?, departAt?, preference?, useEv? | `services/planner.ts` |
| `replan_trip` | tripId, disruptedLegId | `services/replanner.ts` |
| `find_chargers` | lat, lng, radiusKm, connector?, minKw? | charger adapter |
| `find_parking` | lat, lng, arriveAt? | parking adapter + predictor |
| `book_leg` | tripId, legId | booking adapter (mock) |
| `get_trip` | tripId | database |
| `geocode_place` | query | small lookup table of Pune and major Indian places in seed data |

### System prompt (`ai/systemPrompt.ts`)

```
You are SafarSathi, a friendly travel copilot for India.
You help users plan door-to-door journeys using metro, bus, auto,
bike taxi, cab, train, flight, intercity bus and EV.

Rules:
- Always use tools for routes, prices, timings, chargers and parking.
  Never make up a train number, flight, price or charger.
- Reply in the user's language: {language} (en = English,
  hi = Hindi in Devanagari, mr = Marathi in Devanagari).
- Keep replies short: 2-4 sentences. The app shows details as cards.
- When planning, return three options: fastest, cheapest, greenest.
- If the user has an EV, check range and add charger stops for
  trips longer than 80% of range. Prefer chargers marked WORKING.
- When a disruption happens, explain the impact in one sentence,
  then offer the best new plan.
- Before booking anything, confirm with the user.
- User profile: {userProfileJson}
- Current time: {nowIso}
```

### Replanning logic (`services/replanner.ts`)

1. Mark the disrupted leg DELAYED with `delayMins`, or CANCELLED.
2. Recompute arrival times for later legs. If any connection now has less than its minimum buffer (metro 5 min, train 20 min, flight 60 min), the trip is broken.
3. If broken, call the planner from the user's current point (the start of the disrupted leg) to the final destination with the original `arriveBy`.
4. Rank new options by on-time arrival first, then cost.
5. Push an SSE alert: "Your flight 6E-512 is 90 min late. You will miss your 7:30 PM meeting. Tap to see a faster option."

## Data sources and mock data

Every source has a mock adapter that works offline, and real adapters are optional. Pune is the demo city, with Delhi as the intercity destination.

| Data | MVP source | Real source later |
| --- | --- | --- |
| EV chargers | `chargers.pune.json`, about 40 chargers across Pune | Open Charge Map API (free key), CPO partner APIs |
| Parking | `parking.pune.json`, about 25 lots (malls, Pune station, Pune airport, multilevel) | Municipal parking APIs, operator partnerships |
| City transit | `transit.pune.json`: Pune Metro Purple and Aqua lines, 10 PMPML bus routes, stops with lat/lng and frequency | GTFS feeds where published |
| Trains | `trains.json`: 8 Pune to Delhi / Mumbai trains with times, classes, fares | Authorized IRCTC partner or aggregator API |
| Flights | `flights.json`: 8 Pune to Delhi / Bengaluru flights | Airline or aggregator API |
| Intercity buses | `buses.json`: 6 routes from Pune | Bus aggregator API |
| Autos, bike taxis, cabs | Formula: fare = base + per-km × distance; speed by time of day | Ride-hailing partner APIs |
| Geocoding | Lookup table of 50 named places (Kothrud, Hinjewadi, Pune Airport, Shivajinagar, Connaught Place, IGI T1...) | Google Places or Nominatim |

### Mock data rules for Claude Code

- Generate realistic seed data with plausible Pune coordinates, names and INR prices. Mark everything as demo data in the UI footer.
- Charger statuses: 70% WORKING, 15% BUSY, 15% BROKEN, roughly matching the real-world finding that about 71% of approved public chargers work.
- Parking `hourlyPattern`: malls peak 6–9 PM, offices peak 10 AM–6 PM, station and airport busy all day.
- Predicted free spots = `totalSpots × (1 − hourlyPattern[hour])`, rounded, with ±10% random noise.
- Distances use the haversine formula. City travel speeds: walk 5 km/h, metro 35 km/h, bus 18 km/h, auto 22 km/h, cab 25 km/h (halve during 8–11 AM and 5–9 PM).
- CO2 per passenger-km for green score: car 0.17 kg, auto 0.07, bus 0.03, metro 0.02, train 0.02, flight 0.15, EV 0.05. Green score compares against driving the whole distance alone by car.

## Phased build plan

Build in eight phases, in order. Each phase ends with something that runs, so the team always has a demoable app if time runs out.

### Phase 1: Project setup

- [ ] Create monorepo with `backend/` (Express + TypeScript + Prisma + SQLite) and `mobile/` (Expo + TypeScript + Expo Router).
- [ ] Add `.env.example` files, ESLint, Prettier and a root README with run commands.
- [ ] `GET /api/health` returns `{ ok: true }`; mobile Home screen calls it and shows "Connected".

### Phase 2: Data and adapters

- [ ] Write the Prisma schema and generate all mock JSON files per the data rules.
- [ ] Write `seed.ts` and one demo user (EV owner, CCS2, 300 km range, language en).
- [ ] Define adapter interfaces in `adapters/types.ts` and implement the mock adapters.

### Phase 3: EV and parking features

- [ ] Implement `/chargers`, `/chargers/:id/report`, `/parking`, `/parking/:id/reserve`.
- [ ] Build EV tab with map, coloured pins, filters and charger detail screen.
- [ ] Build Parking tab with destination search and predicted free spots.

### Phase 4: Journey planner

- [ ] Implement `services/planner.ts`: build candidate chains (city leg → intercity leg → city leg, or city-only multimodal, or EV drive with charger stops), score them and return Fastest, Cheapest, Greenest.
- [ ] Unit test the planner with three fixed scenarios in `tests/`.
- [ ] Implement `/journeys/plan`, Journey detail screen and journey cards.

### Phase 5: AI chatbot

- [ ] Implement `ai/tools.ts`, `ai/systemPrompt.ts`, `ai/agent.ts` and `POST /api/chat`.
- [ ] Build Chat screen with bubbles, inline cards, language toggle and text-to-speech.
- [ ] Wire Home "Where to?" input to open Chat with the query pre-filled.

### Phase 6: Bookings and trips

- [ ] Implement mock booking adapter returning fake PNRs (format: 10 digits for trains, 6 letters for flights).
- [ ] Implement `/bookings`, `/trips`, `/trips/:id`; build Trips tab and "Book all" button.

### Phase 7: Disruption and replanning

- [ ] Implement `services/replanner.ts`, `/journeys/:tripId/replan`, `/demo/disrupt` and SSE `/alerts/stream`.
- [ ] Show alert banner on Home and Journey detail; "Fix my trip" opens Chat with replan result.
- [ ] Add hidden "Simulate delay" button on Journey detail (long-press the title).

### Phase 8: Polish

- [ ] Hindi and Marathi UI strings in `lib/i18n.ts`.
- [ ] Green score on cards; loading skeletons; empty and error states.
- [ ] App icon, splash screen and a demo-data footer.
- [ ] Test the full demo script below end to end on a real Android phone.

## Acceptance criteria and demo script

The build is done when the 4-minute demo below runs end to end on an Android phone without errors.

### Acceptance criteria

- [ ] A journey query returns three itineraries in under 8 seconds.
- [ ] Every train, flight, price and charger in a chatbot reply exists in the seed data.
- [ ] Chatbot replies correctly in English, Hindi and Marathi.
- [ ] Reporting a charger as Broken changes its pin colour without restarting the app.
- [ ] A simulated delay shows an alert within 3 seconds and the replan offers an option that still arrives on time.
- [ ] Booked trips show booking references in the Trips tab.
- [ ] App works on a phone over the same Wi-Fi as the laptop running the backend.

### Demo script (4 minutes)

1. **Hook (30 s).** "Nearly 3 in 10 government-approved EV chargers in India don't work, and our metros are underused because nobody solves the last mile. Meet SafarSathi."
2. **Plan (60 s).** Tap mic, say: "I need to reach Connaught Place, Delhi by 8 PM today from Kothrud." Show three options; open Fastest: auto → metro → flight → Delhi Metro. Tap "Book all".
3. **Disruption (60 s).** Long-press to simulate a 90-minute flight delay. Red alert appears. Tap "Fix my trip"; the copilot explains the impact and offers an earlier flight plus a cab. Accept it.
4. **EV (40 s).** Switch to EV tab, show colour-coded chargers, report one as Broken and watch the pin turn red. Ask the chatbot: "Plan an EV trip to Mahabaleshwar" and show the charger stop it adds.
5. **Language (20 s).** Toggle to Marathi, ask "जवळचे पार्किंग कुठे आहे?" (Where is the nearest parking?) and let the app speak the answer.
6. **Close (30 s).** Show the scalability slide: adapters ready for IRCTC partner APIs, Open Charge Map, GTFS feeds and parking operators.

### Backup plan

- Record a screen video of the full demo the night before in case the network fails.
- Keep a cached chatbot response for the main demo query, switchable with `DEMO_OFFLINE=true` in `.env`.
