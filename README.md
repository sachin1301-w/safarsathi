# SafarSathi — AI Mobility Copilot

One AI copilot that fixes the whole journey, not just one leg of it.

SafarSathi plans door-to-door trips across metro, bus, auto, bike taxi, cab, train, flight and your EV, books every leg in one place, and replans automatically when something is delayed. It speaks 11 Indian languages.

See [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) for the full project documentation, [SPEC.md](SPEC.md) for the build specification and [DECISIONS.md](DECISIONS.md) for every choice made along the way.

## What's inside

| Feature | Where |
| --- | --- |
| AI journey planner: Fastest, Cheapest and Greenest options with honest badges | Home, Chat, `POST /api/journeys/plan` |
| Disruption replanning with live alerts (SSE) and "Fix my trip" | Journey detail, Home banner, Chat |
| EV charger map with live status and crowd reports | EV tab, Charger detail |
| Parking finder with predicted free spots and mock reservations | Parking tab |
| Unified bookings (mock PNRs) and one Trips screen | Journey detail "Book all", Trips tab |
| Voice chat in 11 languages: Sarvam AI speech-to-text and text-to-speech | Chat mic and speaker buttons |
| Long-term memory of places, preferences and booked trips (Cognee) | Chat tools `remember` / `recall_memory` |
| Green score: CO₂ saved versus driving alone | Every journey card |

```
backend/   Express + TypeScript + Prisma (MongoDB Atlas): REST API, planner, AI agent, adapters
mobile/    Expo SDK 57 (React Native) + TypeScript + Expo Router
```

## Run it

You need Node.js 20+ and an Android phone with **Expo Go** on the same Wi-Fi as your laptop.

### 1. Backend

```bash
cd backend
cp .env.example .env        # then fill in the keys (see below)
npm install
npm run db:setup            # create the MongoDB collections and seed demo data
npm run dev                 # http://localhost:4000/api/health -> { "ok": true }
```

### 2. Mobile

```bash
cd mobile
cp .env.example .env        # EXPO_PUBLIC_API_URL=http://<your-laptop-LAN-IP>:4000
                            # EXPO_PUBLIC_CARTO_KEY=<key from carto.com/basemaps> (optional; nicer map tiles)
npm install
npx expo start              # scan the QR code with Expo Go; press w for the website
```

The **website** is the same app in a browser at http://localhost:8081 (sidebar layout, hover effects, live map). It reaches the backend through the Expo server, which forwards `/api`. **Continue with Google** appears there when `GOOGLE_CLIENT_ID` is set in `backend/.env`.

In Expo Go the app finds the backend on the same laptop by itself, so `EXPO_PUBLIC_API_URL` only matters for standalone builds. Create an account in the app, or log in with the seeded account `demo@safarsathi.app` / `demo1234` (created by `npm run db:seed`).

Find your LAN IP with `ipconfig` (Windows, the Wi-Fi adapter's IPv4 address) or `ipconfig getifaddr en0` (macOS).

### Environment variables (`backend/.env`)

| Variable | Needed for | Without it |
| --- | --- | --- |
| `LLM_PROVIDER` | Which LLM runs the chat: `claude`, `gemini`, `sarvam` or `offline` | The first of Claude, Gemini, Sarvam with a key, else offline |
| `ANTHROPIC_API_KEY` | The Claude copilot (needs prepaid API credits) | Gemini, Sarvam or the offline assistant |
| `GEMINI_API_KEY` | The Gemini copilot (key from aistudio.google.com/apikey) | Sarvam or the offline assistant |
| `GEMINI_CHAT_MODEL` | Override the Gemini chat model | `gemini-3.5-flash-lite` |
| `SARVAM_API_KEY` | Voice in and out, and the Sarvam copilot (`sarvam-105b-conversations`) | Keyboard dictation, the phone's own text-to-speech, and the offline assistant |
| `SARVAM_CHAT_MODEL` | Override the Sarvam chat model | `sarvam-105b-conversations` |
| `COGNEE_API_URL`, `COGNEE_API_KEY` | Long-term memory in Cognee | Memory is kept in the local database only |
| `OPEN_CHARGE_MAP_KEY` | Live chargers from Open Charge Map (better India coverage; free key at openchargemap.org) | OpenStreetMap chargers plus the seeded Pune ones |
| `DEMO_OFFLINE` | `true` forces the offline assistant and keeps chargers and parking to the seeded Pune data, with no internet calls (backup for the demo) | |
| `DATABASE_URL` | MongoDB Atlas connection string (see `.env.example`) | Use `file:./dev.db` with `prisma/sqlite/schema.prisma` to run offline on SQLite |
| `GOOGLE_CLIENT_ID` | "Continue with Google" on the website (OAuth **Web application** client id) | The Google button is hidden |
| `PORT` | API port | `4000` |

Never commit `.env`; both apps ignore it.

## Commands

| Where | Command | What it does |
| --- | --- | --- |
| backend | `npm run dev` | API with auto-reload |
| backend | `npm run db:seed` | **Reset the demo**: chargers, parking, demo user, memories; deletes all accounts and trips |
| backend | `npx tsx scripts/fetch-osm-india.ts` | Download all-India chargers and parking for major cities from OpenStreetMap into `backend/data` (slow; resumable) |
| backend | `npx tsx scripts/import-osm-india.ts` | Load that data into the database without touching accounts or trips |
| backend | `npm test` | Planner, replanner and booking tests (Vitest) |
| backend | `npm run plan -- Kothrud "Connaught Place" 20:00` | Print planner output (add `--ev` for an EV trip) |
| backend | `npm run data:generate` | Regenerate the mock JSON in `backend/data` |
| backend | `npm run typecheck` / `npm run lint` / `npm run format` | Checks |
| mobile | `npx expo start` | Expo dev server |
| mobile | `npm run typecheck` / `npm run lint` / `npm run format` | Checks |

## Demo script (4 minutes)

Before you start: `npm run db:seed` in `backend`, open the app, log in as `demo@safarsathi.app` / `demo1234`, and check that Home shows **Connected**.

1. **Hook (30 s).** "Nearly 3 in 10 government-approved EV chargers in India don't work, and our metros are underused because nobody solves the last mile. Meet SafarSathi."
2. **Plan (60 s).** On Home, tap the mic and say "I need to reach Connaught Place, Delhi by 8 PM today from Kothrud" (or type it). Chat shows three options. Open one with a flight, then tap **Book all**. The tickets appear in Trips.
3. **Disruption (60 s).** On the journey screen, **long-press the trip title**, pick the flight and 90 minutes, and tap Delay. A red alert appears. Tap **Fix my trip**: the copilot explains the impact and offers a new plan. Tap it to accept; the old trip is marked Replaced.
4. **EV (40 s).** Open the EV tab, tap a charger, report it **Broken** and go back: the pin is red. In Chat ask "Plan an EV trip to Mahabaleshwar"; the plan includes a charging stop (the demo user's battery is at 30%).
5. **Language (20 s).** Switch the language to मराठी (top of Home or Chat), ask "जवळचे पार्किंग कुठे आहे?" and tap the speaker to hear the answer.
6. **Close (30 s).** Every data source sits behind an adapter (`backend/src/adapters`), ready for IRCTC partner APIs, Open Charge Map, GTFS feeds and parking operators.

"By 8 PM today" only has on-time options if you run the demo before about 2 PM. Later in the day, ask for "tomorrow by 8 PM".

### Backup plan

- Set `DEMO_OFFLINE=true` in `backend/.env` and restart: the offline assistant answers the demo's requests in English, Hindi and Marathi without the Claude API.
- Record a screen video of the full demo the night before.

## Troubleshooting

- **Home says Offline.** The phone and laptop must be on the same Wi-Fi, and `EXPO_PUBLIC_API_URL` must use the laptop's LAN IP (not `localhost`). On Windows, allow Node.js through the firewall for private networks. Restart `npx expo start` after changing `mobile/.env`.
- **No voice input.** Voice needs `SARVAM_API_KEY` on the backend. Without it, use the keyboard's mic to dictate.
- **Chat replies are tagged "Offline assistant".** No LLM is reachable (no key, no credits, or `DEMO_OFFLINE=true`). The backend log says which provider failed and why.

## How it's built

- **Planner** (`backend/src/services/planner.ts`): builds candidate chains (walk/auto/bike taxi/cab, metro with line changes, PMPML bus, city leg → train/flight/bus → city leg, EV drive with charger stops), schedules them in India time with boarding buffers and peak-hour speeds, and picks Fastest, Cheapest and Greenest.
- **Replanner** (`backend/src/services/replanner.ts`): applies a delay, checks every connection and the deadline, pushes an SSE alert, and plans from the user's current point without the delayed service.
- **Copilot** (`backend/src/ai`): an LLM tool-use loop with tools for planning, replanning, chargers, parking, booking, trips, geocoding and memory; facts only come from tools. It runs on Claude Sonnet 5.5, Gemini (`gemini-3.5-flash-lite`) or Sarvam (`sarvam-105b-conversations`) and falls back Claude → Gemini → Sarvam → offline assistant if a provider fails.
- **Adapters** (`backend/src/adapters`): one interface per data source, with offline mocks plus Open Charge Map, Sarvam and Cognee implementations.

All prices, timings, PNRs and charger statuses are demo data.
