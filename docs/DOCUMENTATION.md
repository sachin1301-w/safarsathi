# SafarSathi: Complete Project Guide

**SafarSathi** ("travel companion") is an app that plans your whole trip across India, from your door to your destination. It uses autos, bike taxis, cabs, metro, city buses, trains, flights, intercity buses and your own electric car (EV). It books every part of the trip in one place, finds EV chargers and parking, plans whole holidays with real hotel prices, and makes a new plan for you if something is delayed. You can type or speak to it in 11 Indian languages.

We built it for the **iQOO Grand Finale hackathon** (Mobility theme). It runs as a **phone app** (Android, through Expo Go) and as a **website**.

This guide explains, in simple language:

- what the app does and how it works inside
- how to run it on your laptop, your phone, and any other device
- everything we built and changed, from the start until now
- the problems we ran into, and how we solved them
- what is still left to do

Other files in the project:

| File | What's in it |
| --- | --- |
| [`README.md`](../README.md) | The short "how to run it" page |
| [`SPEC.md`](../SPEC.md) | The original plan we built from |
| [`DECISIONS.md`](../DECISIONS.md) | Small design choices made during the first build |

---

## Contents

1. [Quick summary](#1-quick-summary)
2. [What problem it solves](#2-what-problem-it-solves)
3. [What the app can do](#3-what-the-app-can-do)
4. [The screens, one by one](#4-the-screens-one-by-one)
5. [How it works inside](#5-how-it-works-inside)
6. [Where the data comes from](#6-where-the-data-comes-from)
7. [Accounts and security](#7-accounts-and-security)
8. [Settings and keys](#8-settings-and-keys)
9. [How to run it](#9-how-to-run-it)
10. [Making it work on any device](#10-making-it-work-on-any-device)
11. [Demo script for the judges](#11-demo-script-for-the-judges)
12. [Testing and speed](#12-testing-and-speed)
13. [The full story: what we did, step by step](#13-the-full-story-what-we-did-step-by-step)
14. [Problems we hit and how we fixed them](#14-problems-we-hit-and-how-we-fixed-them)
15. [If something goes wrong](#15-if-something-goes-wrong)
16. [What is left to do](#16-what-is-left-to-do)
17. [Glossary](#17-glossary)

---

## 1. Quick summary

| Item | Status |
| --- | --- |
| Trip planning (fastest, cheapest, greenest) | ✅ Working, anywhere in India |
| AI chat assistant | ✅ Working (Google Gemini) |
| Voice in 11 languages | ✅ Working (Sarvam AI) |
| EV charger map | ✅ Working, all of India |
| Parking finder, reservations and **Navigate** | ✅ Working, all of India |
| Bookings and the Trips list | ✅ Working (demo tickets) |
| Holiday planner (places to see, real hotels, full budget, Budget / Comfort / Luxury) | ✅ Working, 337 tourist places across India |
| Delay alerts and automatic re-planning | ✅ Working |
| Login and sign-up (email and password) | ✅ Working |
| Website version | ✅ Working (desktop and phone browsers), 3D design, new login page |
| "Continue with Google" | ⚠️ Built; you must finish the Google Cloud setup (section 16) |
| Online database (MongoDB Atlas) | ✅ Working |
| Any phone, any network (through a tunnel) | ✅ Working while the laptop is on |
| Online without the laptop (Render) | ⏳ Code ready; deploy it from your Render account (section 10) |
| Code on GitHub | ✅ Private repository `sachin1301-w/safarsathi` |

---

## 2. What problem it solves

| Problem in India | How SafarSathi helps |
| --- | --- |
| Many public EV chargers don't work (only about 7 in 10 were working in March 2026) | A charger map with live status, plus "Working / Busy / Broken" reports from drivers |
| Too few chargers | EV trips that add a charging stop on the way, based on your battery |
| Getting to and from the metro or station is hard (the "last mile") | Door-to-door routes that mix metro, bus, auto and bike taxi |
| No information about parking | Parking near you, how many spaces will be free, a reserve button and directions |
| Every ticket needs a different app | One trip, one "Book all" button |
| A delay breaks the rest of your journey | Automatic alert and a new plan in one tap |
| Many apps are English-only | Text and voice in 11 Indian languages |
| Planning a holiday means checking many sites for places, hotels and tickets, and the total cost is a surprise | One page with the places to see, real hotels with today's prices, travel, and every cost added up, for Budget, Comfort and Luxury |

**Who it is for:** daily metro and bus users, people travelling between cities, EV owners, and first-time or older travellers who prefer speaking in their own language.

---

## 3. What the app can do

### Plan a trip

- Ask in chat, for example *"Kothrud to Connaught Place, Delhi by 8 PM tomorrow"*, or tap a quick button (Home, Office, Airport, Station).
- You get up to **3 options**, each marked **Fastest**, **Cheapest** or **Greenest**. If one option wins two of these, it shows both labels.
- **Anywhere in India:** if a place isn't in our list (for example Bikaner), the app looks it up on OpenStreetMap, a free world map. For long trips it combines a real train or flight with a cab, for example *"fly Pune → Delhi, then take a cab to Bikaner"*. Cab-only trips go up to 1,500 km.
- If you don't say where you're starting from, it uses **your current location**.
- Every option shows how much **CO₂ you save** compared with driving alone.

### Book and keep your trips

- **Book all** books every part of the trip in one go and gives demo ticket numbers: 10-digit train PNRs, 6-letter flight PNRs, and references for metro, cab and bus.
- The **Trips** tab shows Upcoming trips, Saved plans and Past trips. Each person's trips are saved to their own account.

### Delays and re-planning

- If a train or flight is delayed, a **red alert** appears in under a second.
- Tap **Fix my trip**. The assistant explains what went wrong in one sentence and offers a new plan that still gets you there on time if possible. Accept it, and the old trip is marked "Replaced".
- For the demo, you create a delay by **long-pressing the trip title** on the journey screen.

### EV chargers

- A map and list of chargers, coloured **green (Working)**, **amber (Busy)**, **red (Broken)** or **grey (Unknown)**.
- Filter by plug type (CCS2, Type2…) and power (22 kW and up, 50 kW and up).
- Tap a charger to see details and recent reports, report its status, or tap **Navigate** for directions.
- Covers all of India: 40 hand-made chargers around Pune and on the highways, about 600 from OpenStreetMap, plus new ones looked up whenever you search a new area.

### Parking

- Parking within **15 km** of you or of a place you search. If there's nothing that close, you see the nearest 5.
- How many spaces are **predicted to be free** when you arrive (now, in 1 hour, or in 3 hours).
- **Reserve** books a demo spot. **Navigate** opens Google Maps directions. This button is on every parking card and in chat results.
- Covers all of India: 25 hand-made lots in Pune and about 2,400 lots in 44 big cities from OpenStreetMap, plus live lookups elsewhere. For OpenStreetMap lots the number of spaces is an **estimate** and is marked that way. If the price isn't known, the card says "Rate n/a".

### Plan a holiday

Tell the app **where** you want to go, **for how many days** (1 to 14) and **how many people** (1 to 12). It plans the whole holiday and shows every cost.

**What you get:**

- **Places to see:** the most famous sights there, each with a photo and a short note. The most popular ones come first (based on how many people read about them on Wikipedia). Each has a **Navigate** button.
- **Day by day:** about 3 places a day. Places close to each other go on the same day, so you don't keep crossing the city.
- **Three styles: Budget, Comfort and Luxury.** Three cards show the total for each style, side by side. Tap a card, or a style button at the top of the page, and **everything changes at once**: the total, the hotels, the travel and the budget.
- **Hotels:** 3 real hotels for each style, with photo, star rating, number of reviews and distance from the city centre. "Reviews & photos" opens the hotel's TripAdvisor page.
- **Getting there:** how you travel there and back in that style, with a **Book travel** button.
- **Full budget:** travel, hotel, food, local travel, entry tickets, and 10% extra for shopping and surprises. You see the total and the cost per person. Pick a different hotel and the budget updates straight away.
- **Book hotel & save holiday** books the hotel (a demo: no money is taken) and gives you a booking number like `HTL-UZP7RM`. Saved holidays appear in **My trips** under "Holidays".

**How the three styles are different:**

| | Budget | Comfort | Luxury |
| --- | --- | --- | --- |
| Hotel, per night | under about ₹3,000 | about ₹3,000 to ₹8,000 | over about ₹8,000 |
| Route | cheapest | cheapest | fastest |
| Train | Sleeper | AC 3-tier | First AC |
| Bus | normal seat | AC sleeper | premium AC sleeper (Volvo type) |
| Flight | cheapest fare | flexible fare (seat and meal included) | business class |
| To the station or airport | metro, bus or auto | cab | cab |
| Long cab rides | small car | sedan | SUV (Innova type) |
| Food, per person per day | about ₹700 | about ₹1,500 | about ₹3,500 |
| Autos and cabs in the city, per day | about ₹600 | about ₹1,800 | about ₹4,000 |

**Example:** Jaipur, 3 days, 4 people, starting from Pune: Budget **₹41,384**, Comfort **₹90,895**, Luxury **₹2,72,334**. Hotel prices change every day, so your numbers will be a little different.

**Where the prices come from (honest numbers):**

- **Hotels: real prices.** We saved a list of about **23,000 hotels in 337 tourist places across India** (from TripAdvisor, through a free service called Xotelo). When you plan, the app asks booking sites such as Booking.com, Agoda and Trip.com for the price **on your dates**. Each hotel shows one of these labels:
  - **"Live · Booking.com"**: today's price for your dates, from that site. Prices from other sites are shown underneath.
  - **"Usual price"**: no site had a price for those dates, so we show what the hotel normally costs.
  - **"Estimate"**: there is no listed hotel nearby (a few small towns such as Thanjavur or Kohima). We show a real hotel from OpenStreetMap with a typical price.
- Only hotels with good reviews (3.5 stars or more, and at least 10 reviews) are suggested first.
- **Travel: from the trip planner.** When we know the real ticket price for a class (for example AC 3-tier), we use it. Other upgrades, such as business class, are worked out from the normal price difference between classes, and the app says "estimate".
- Train, bus and flight tickets are counted **per person**. A cab is **shared**: one car for up to 4 people.
- **Food, local travel and entry tickets** are estimates, and they are marked that way.

**How to open it:** **Holidays** in the website's top bar or left dock, the "Plan a holiday" card on Home, the ☰ menu, or just ask the chat: *"I have 5 days off, plan Goa for 2 people"*.

### AI assistant (chat)

- Understands normal sentences in many languages.
- **Never makes up** trains, flights, prices or chargers. It always fetches real data from the app first.
- Remembers things about you, such as your home, office, preferences and booked trips.
- Knows where you are, so "parking near me" works.

### Voice and languages

- The app's text is translated into **11 languages**: English, Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Punjabi and Odia.
- Tap the **mic** to speak. Replies can be **read aloud**.

### Look and feel

- **Startup:** a bus drives in and keeps running until the app is ready, then drives away.
- **Every loading screen has its own animation:**

  | Screen | Animation |
  | --- | --- |
  | Route planning | The route draws itself between two pins while a vehicle travels it |
  | Chat | Bus, train, plane and charger icons orbit a pulsing assistant icon |
  | EV | A battery fills while power flows from a charger |
  | Parking | A car reverses into a parking bay under a "P" sign |
  | Trips | Tickets fan out, then a "BOOKED" stamp lands |
  | Map | A pin drops with ripples |
  | Holidays | A plane, train, bus and car take turns |

- **Login page:** on the website, the same 3D city moves slowly behind a glass login box, with the glowing SAFARSATHI title and four feature cards. On the phone, glowing coloured lights drift and stars twinkle behind the form, with the vehicle animation on top.
- **Dark mode / light mode:** choose System, Light or Dark from the menu.
- **Website:** a 3D night city that moves as you scroll, a HUD top bar, left and right docks, a robot mascot that opens the chat, cards that tilt towards your mouse, and a Close button on every page.

---

## 4. The screens, one by one

| Screen | What you see |
| --- | --- |
| **Startup** | Bus animation while the app connects to the server |
| **Login** | Glowing title, moving background, and a glass box with Log in, Create account and "Continue with Google" (website). The form moves up when the keyboard opens |
| **Home** | "SafarSathi" title, language button, ☰ menu, alerts, "Where to?" search with mic, quick buttons, your next trip |
| **☰ Menu** | Your name and email; counts of trips, booked and upcoming; Appearance (System / Light / Dark); language; home; your EV; shortcuts (Home, Trips, EV, Parking); Log out |
| **Chat** | Messages, result cards, mic, speaker and language buttons |
| **Choose your route** | The three trip options |
| **Journey** | Route map, every step with times and prices, Book / Book all, CO₂ saved, alerts |
| **EV** | Charger map or list, filters, colour key with counts |
| **Charger** | Details, reports, Working / Busy / Broken buttons, Navigate |
| **Parking** | Search, "Near me", arrival time, map, cards with Navigate and Reserve. On the website the map and list sit side by side |
| **Holidays** | Destination, days, people and style; then a big photo with the total, the three style cards, the budget, places to see, the day-by-day plan, getting there, hotels and tips |
| **Trips** | Holidays, Upcoming, Saved plans, Past |

---

## 5. How it works inside

There are two parts:

1. **The app** (`mobile/` folder): what you see and touch. It's built with **Expo / React Native**, so the same code runs as the Android app and as the website.
2. **The server, or "backend"** (`backend/` folder): the brain. It stores the data, plans trips, talks to the AI and fetches maps and places. It's built with **Node.js and Express**.

```
   Phone app / Website  ──── asks questions ───▶  Backend server  ──▶  MongoDB Atlas (database)
         ▲                                            │
         └──── live delay alerts (instant) ◀──────────┤──▶  Gemini AI (chat)
                                                      ├──▶  Sarvam AI (voice)
                                                      ├──▶  Cognee (memory)
                                                      ├──▶  OpenStreetMap (places, chargers, parking)
                                                      ├──▶  Wikipedia (holiday places and photos)
                                                      └──▶  Xotelo (hotel prices for your dates)
```

**What happens when you ask the chat a question:**

1. The app sends your message, language and location to the backend.
2. The backend asks the AI (Gemini) what to do, and gives it a list of "tools" it can use: plan a trip, find chargers, find parking, book, remember things.
3. The AI picks the tools it needs, and the backend runs them on real data.
4. The AI writes a short answer, and the app shows it with cards (trip options, chargers, parking).

**Which AI is used:** the app tries **Claude → Gemini → Sarvam → offline helper**, in that order, and uses the first one that works. Claude needs paid credits, which the account doesn't have, so in practice **Gemini** answers. If every AI is down, a simple built-in helper still answers the demo questions.

**Main building blocks:**

| Part | Job |
| --- | --- |
| Trip planner (`backend/src/services/planner.ts`) | Builds and compares the trip options |
| Re-planner (`replanner.ts`) | Handles delays and makes new plans |
| Holiday planner (`holiday.ts`, `holidayTravel.ts`, `backend/src/lib/hotels.ts`) | Places to see, day-by-day plan, hotels and live prices, travel for each style, the budget |
| AI assistant (`backend/src/ai/`) | Chat, tools, prompts, the list of AIs to try |
| Data sources (`backend/src/adapters/`) | One module per source (chargers, parking, places, voice, memory…) |
| Login (`backend/src/lib/auth.ts`) | Passwords, sessions, Google sign-in |
| Maps (`mobile/src/components/leaflet-map*.tsx`) | The map on the phone and on the website |
| Animations (`scenes.tsx`, `travel-loader.tsx`, `boot-screen.tsx`) | All loading scenes |

---

## 6. Where the data comes from

| Data | Source |
| --- | --- |
| Pune metro, buses, trains, flights, intercity buses | Demo timetables we created (`backend/data/`). Real enough for a demo, not real bookings |
| Places in India | 54 known places, plus **OpenStreetMap** search for everything else |
| EV chargers | 40 demo chargers around Pune, plus about 600 from **OpenStreetMap**, plus live lookups |
| Parking | 25 demo lots in Pune, plus about 2,400 from **OpenStreetMap** in 44 cities, plus live lookups |
| Map pictures (tiles) | **CARTO** (with our key), or plain OpenStreetMap |
| AI chat | **Google Gemini** |
| Voice | **Sarvam AI** |
| Memory | **Cognee**, plus a copy in our database |
| Holiday sights and photos | **Wikipedia** (free, no key) |
| Holiday hotels | **TripAdvisor** hotel list and prices via **Xotelo** (free, no key), saved in `backend/data/hotels.india.json`; live rates for your dates from Xotelo; **OpenStreetMap** where there's no listing |

**Honest data:** if OpenStreetMap doesn't know a charger's power or price, or a parking lot's rate, the app shows "n/a" and never invents a number. Demo screens carry a small "Demo data" note.

**Speed trick:** chargers and parking are read from our own database first, which takes about 0.2 seconds. The app checks OpenStreetMap for new ones quietly in the background.

---

## 7. Accounts and security

- **Sign up** with name, email and password, or use **Continue with Google** on the website.
- Passwords are stored only as scrambled codes (the **scrypt** method), never as plain text.
- When you log in, the server gives the app a secret **session code**. The phone keeps it in secure storage, so you stay logged in, and **Log out** cancels it on the server.
- Each person sees only their own trips, alerts, reservations and memories.
- **Demo account** for presentations: `demo@safarsathi.app` / `demo1234`.
- **Google sign-in:** Google confirms who you are and sends a signed code. The server checks that code with Google, then logs into, or creates, the account for that email.

---

## 8. Settings and keys

Secret keys live only in two `.env` files on the laptop, which are **never uploaded** to GitHub.

### `backend/.env`

| Setting | What it's for | Our setup |
| --- | --- | --- |
| `DATABASE_URL` | Address of the MongoDB Atlas database | Cluster `cluster0.8ywplm8`, database `IQOO` |
| `LLM_PROVIDER` | Which AI to try first | `gemini` |
| `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL` | Gemini AI | key set, model `gemini-3.5-flash-lite` |
| `ANTHROPIC_API_KEY` | Claude AI (needs paid credits) | set, but has no credits |
| `SARVAM_API_KEY` | Voice | set |
| `COGNEE_API_URL`, `COGNEE_API_KEY` | Memory | set |
| `GOOGLE_CLIENT_ID` | "Continue with Google" | set |
| `OPEN_CHARGE_MAP_KEY` | Better charger coverage (optional) | not set |
| `DEMO_OFFLINE` | `true` = no internet needed (backup for the demo) | `false` |
| `PORT` | Server port | 4000 |
| `USD_INR` | Dollar-to-rupee rate for the hotels' usual prices (optional) | not set, so 88 is used |

On this laptop the database address ends with `&tlsCAFile=…`, because the AVG antivirus interferes with secure connections (see section 14). On Render, leave that part out.

### `mobile/.env`

| Setting | What it's for |
| --- | --- |
| `EXPO_PUBLIC_CARTO_KEY` | Nicer map pictures |
| `EXPO_PUBLIC_API_URL` | Only for special builds. Normally the app finds the server by itself |

---

## 9. How to run it

### First time only

```bash
cd backend
npm install
npm run db:setup      # creates the database tables and fills in the demo data
cd ../mobile
npm install
```

### Every time

**Window 1, the server:**

```bash
cd backend
npm run dev           # wait for "listening on ... 4000" and "Database connected"
```

**Window 2, the app:**

```bash
cd mobile
npx expo start        # shows a QR code
```

**On the phone (same Wi-Fi or hotspot as the laptop):**

1. Install **Expo Go** from the Play Store.
2. Open Expo Go → **Enter URL manually** → type `exp://<laptop IP>:8081`. To find the IP, run `ipconfig` on the laptop and look at the Wi-Fi "IPv4 Address". You can also scan the QR code **from inside Expo Go**; don't use the phone camera.
3. Allow location, then log in.

**Website:** there are two ways to open it.

- **While you are changing the code:** http://localhost:8081 (the Expo window). Changes show up straight away.
- **The finished website:** the backend serves it at **http://localhost:4000** on the laptop, and at **http://<laptop IP>:4000** on any phone or computer on the same Wi-Fi (for example `http://192.168.224.126:4000`). After changing the app, rebuild it with `npx expo export -p web` in the `mobile` folder.

### Useful commands

| Where | Command | What it does |
| --- | --- | --- |
| backend | `npm run dev` | Start the server |
| backend | `npm run db:seed` | **Reset everything** to demo data (deletes all accounts and trips) |
| backend | `npx tsx scripts/import-osm-india.ts` | Load the India chargers and parking without deleting accounts |
| backend | `npx tsx scripts/fetch-hotels-india.ts` | Download the hotel list for India's tourist places again (about 30 minutes) |
| backend | `npm test` | Run the automatic tests |
| mobile | `npx expo start` | Start the app server |
| mobile | `npx expo start --tunnel` | Start the app for **any device** (section 10) |
| mobile | `npx expo export -p web` | Build the website for the cloud |

**Note:** the server can also run in the background, writing to `logs/backend.log` and `logs/expo.log`. To stop it, end the **node.exe** processes in Task Manager.

---

## 10. Making it work on any device

By default the phone must be on the **same Wi-Fi or hotspot** as the laptop, because the app comes from the laptop. There are two ways around that.

### Way 1: tunnel (works now, laptop must stay on)

A **tunnel** gives the laptop a public internet address.

```bash
cd mobile
npx expo start --tunnel
```

- Expo prints an address like `exp://xxxxx-anonymous-8081.exp.direct`. **Any phone with Expo Go, on any network (Wi-Fi or mobile data)** can open it.
- The app's server requests go through the same address, because the Expo server passes `/api` on to the backend.
- **Tested:** app download, login and the API all work through the tunnel.
- **Limits:** the laptop must stay on and online. The first load takes about 25 seconds, and the website version is slow through the tunnel.
- **Network warning:** office or college Wi-Fi with a security firewall (for example the "ciscosb 22" network, which uses a **FortiGate** firewall) blocks the tunnel. The **phone hotspot** works, as long as AVG's HTTPS scanning doesn't interfere.

### Way 2: Render cloud (best, no laptop needed)

The code is ready to deploy. `render.yaml` describes the setup, and the backend also serves the website.

**Steps, in your Render account:**

1. Sign in to **render.com** with GitHub, then choose **New → Web Service** (or **New → Blueprint**) and pick `sachin1301-w/safarsathi`.
2. Fill in:
   - **Root Directory:** empty
   - **Build Command:** `cd backend && npm ci && npx prisma generate && cd ../mobile && npm ci && npx expo export -p web`
   - **Start Command:** `cd backend && npm start`
   - **Instance type:** **Free ($0)**, not $7
   - **Health Check Path:** `/api/health`
3. Add the environment variables:
   - `NODE_VERSION=22`
   - `LLM_PROVIDER=gemini`
   - `GEMINI_CHAT_MODEL=gemini-3.5-flash-lite`
   - `DEMO_OFFLINE=false`
   - `DATABASE_URL`: the Atlas address **without** `&tlsCAFile=…`
   - `GEMINI_API_KEY`, `SARVAM_API_KEY`, `COGNEE_API_URL`, `COGNEE_API_KEY`, `GOOGLE_CLIENT_ID`, `EXPO_PUBLIC_CARTO_KEY`
4. Click Deploy. The build takes 5–10 minutes. You get a link like `https://safarsathi-xxxx.onrender.com`.
5. In **MongoDB Atlas → Network Access**, allow `0.0.0.0/0`.
6. In **Google Cloud**, add the Render link to your OAuth client's Authorized JavaScript origins.

Then **anyone, on any device, can open the link in a browser.** The free plan "sleeps" after 15 minutes without visitors, so the next visit takes about 50 seconds to wake it, while the bus animation plays.

**Later:** an installable **Android APK** (needs a free Expo account) would let the phone app itself work anywhere without Expo Go.

---

## 11. Demo script for the judges

Before you start: start the server and the app, open the app, and log in as `demo@safarsathi.app` / `demo1234`.

1. **Hook (30 s).** "Nearly 3 in 10 government-approved EV chargers in India don't work, and our metros are underused because nobody solves the last mile. Meet SafarSathi."
2. **Plan (60 s).** In Chat, say or type *"Kothrud to Connaught Place, Delhi by 8 PM tomorrow"*. Open an option with a flight and tap **Book all**. The tickets appear in Trips.
3. **Anywhere in India (20 s).** Ask *"Plan a trip from Pune to Bikaner"*: a flight to Delhi plus a cab, or a train plus a cab.
4. **Delay (60 s).** On the journey screen, long-press the title, pick the flight and 90 minutes, and tap Delay. A red alert appears. Tap **Fix my trip** and accept the new plan.
5. **EV (40 s).** In the EV tab, report a charger **Broken** and watch the pin turn red. Ask *"Plan an EV trip to Mahabaleshwar"*; the plan adds a charging stop.
6. **Parking (20 s).** In the Parking tab, show the free-space estimates and tap **Navigate**.
7. **Holiday (40 s).** Open **Holidays**, tap the **Goa** tile (5 days). Show the places to see, then tap **Budget**, **Comfort** and **Luxury** and watch the total, hotels and travel change. Point out a "Live · Booking.com" price.
8. **Language (20 s).** Switch to मराठी, ask *"जवळचे पार्किंग कुठे आहे?"* and tap the speaker.
9. **Close (30 s).** Every data source plugs in separately, ready for real IRCTC, airline, charger and parking partners.

**Tips:**

- "By 8 PM today" only works before about 2 PM; later in the day, say "tomorrow".
- **Backup:** set `DEMO_OFFLINE=true` in `backend/.env` and restart. The demo then works without any AI or internet.
- Record a video of the demo the night before.

---

## 12. Testing and speed

**Checks we run after every change:**

- automatic tests (planner, re-planner, bookings)
- type checks and code-style checks for both parts
- an Android build
- a website build

**Website screens** were checked in a real Chrome browser with automatic screenshots.

| Measurement | Result |
| --- | --- |
| Chat answer (Gemini) | 2.4–3.9 seconds |
| Chat "Pune to Bikaner" (includes looking up Bikaner online) | about 13 seconds |
| Delay alert reaching the phone | 14 milliseconds |
| Chargers / parking (saved areas) | about 0.2–0.9 seconds (was up to 14 seconds before the fix) |
| Chargers / parking (a brand-new area) | up to about 6 seconds |
| Seeding the cloud database | 37 seconds |
| App download through the tunnel | about 25 seconds the first time |
| A full holiday plan (places, 9 hotels with live prices, travel, budget) | about 13 to 17 seconds |
| Downloading the hotel list for all of India (done once) | about 45 minutes |

---

## 13. The full story: what we did, step by step

All of this happened on 2–3 October 2026. The code in brackets is the save point (commit) in Git.

### Part A: the first build (8 phases)

| Phase | What we built |
| --- | --- |
| 1 [a1630cb] | Project set-up: server, app, health check |
| 2 [57bbd35] | Database design, demo data, data sources |
| 3 [592c23b] | EV charger map and parking finder |
| 4 [90259ab] | Trip planner with Fastest / Cheapest / Greenest |
| 5 [379d7c6] | AI chat with tools, voice and memory |
| 6 [1927006] | Bookings and the Trips tab |
| 7 [d693931] | Delay alerts and re-planning |
| 8 [cf9654e, f80a316] | Polish, app icon, all 11 languages |

### Part B: everything after

| # | What you asked for, or what went wrong | What we did |
| --- | --- | --- |
| 1 | Claude needs paid credits | Made the chat work with other AIs; used Sarvam first [ee65adf] |
| 2 | Expo showed "Something went wrong" | The app was opened as a web page by scanning with the camera. We fixed the web crash and explained scanning from inside Expo Go [526160e] |
| 3 | Phone couldn't reach the laptop | McAfee and AVG firewalls were blocking it; you turned them off |
| 4 | Black map, no chargers, parking broken, wanted current location | New map (Leaflet), location support, parking fixes [e6fff6d] |
| 5 | Map said "API KEY REQUIRED" | Added your CARTO map key [f96c111] |
| 6 | Switch chat to Gemini; parking not visible; bigger search areas | Gemini added; parking 15 km, EV 300 km; maps zoom to results; voice fix [e489437] |
| 7 | Chat said "connect to same Wi-Fi" after switching networks | The app now finds the server by itself; first loading animations [0b917ce] |
| 8 | Pune → Bikaner failed; add login; chargers and parking for all India; bus loading screen | Place search for all India, hub-plus-cab trips, accounts, OpenStreetMap data, bus screen [32b2781, 3e68540] |
| 9 | Remove demo button, add create account, more animations | Done [3167b10] |
| 10 | Bigger animations, dark/light mode, better menu, remove "Connected", fix Reserve button | Full-screen animations, account menu, theme switch, layout fixes, faster loading [8fcebfa] |
| 11 | Login hidden by keyboard; different animation per screen; hamburger menu | Done [109cbd4] |
| 12 | Detailed documentation | First version of this guide [7892265] |
| 13 | **Navigate to parking**; **website with hover effects**; public network; **Google login** | Navigate buttons; full website (sidebar, live map, hover); `/api` passed through Expo for tunnels; Google sign-in [9c52a61] |
| 14 | New MongoDB cluster | Switched to Atlas, moved existing accounts across, faster start-up [82cde7b] |
| 15 | Run on any device | Code pushed to private GitHub; backend serves the website; Render set-up file [e6e64b1, 28d29b0]; tunnel working on the hotspot |
| 16 | Home button in the menu did nothing; dull website; no light mode on website | Menu on every tab; 3D website; light mode fixed [d87ed9d] |
| 17 | Make it like techfest.org | Cinematic 3D city that moves as you scroll, HUD top bar and docks, robot mascot [6ffd6e0] |
| 18 | Tabs showed through each other; Close button on every page | Only the open tab is shown; Close button top-right [9f0d2f2] |
| 19 | **Holiday planner**: special places, budget, hotel booking | Holidays page, chat card, Home and website shortcuts, saved holidays in My trips [b0ba061, 33c06b0] |
| 20 | Login page looked dull | New login page in the website's style: 3D city, glowing title, glass box; moving lights and stars on the phone [3a73d66] |
| 21 | Run the website and share the link | Website at `http://localhost:4000` and `http://<laptop IP>:4000`; the public tunnel didn't connect on this network (section 10) |
| 22 | Separate Budget / Comfort / Luxury; real hotel prices, not random ones; hotel data for all tourist cities | Saved list of about 23,000 real hotels in 337 places; live prices for your dates; three styles side by side [43c1969] |
| 23 | Prices and travel must change with the style | Each style travels its own way (class, cabs, route); the style buttons switch the whole plan; cabs shared per car [f28d436] |

---

## 14. Problems we hit and how we fixed them

| Problem | Why it happened | Fix |
| --- | --- | --- |
| "SSL certificate" errors (in tools, npm, the database, tunnels) | **AVG antivirus** re-signs secure connections with its own certificate | Use a certificate file that includes AVG's (database), `--use-system-ca` (npm), or turn off AVG's HTTPS scanning |
| Phone couldn't reach the laptop | McAfee and AVG **firewalls** | Turned them off during development |
| Black map on Android | The old map library (`react-native-maps`) doesn't work in Expo Go | Switched to **Leaflet** |
| Voice recordings rejected | The phone labels audio `audio/m4a` | Send it as `audio/mp4` |
| Chargers and parking took 14 seconds | Waiting for busy OpenStreetMap servers | Read our database first, update in the background |
| Free tunnels failed | Cloudflare's port was blocked; localhost.run was flagged as unsafe by AVG; ngrok was broken by AVG and by the **FortiGate** firewall on office Wi-Fi | Expo's own tunnel works on the phone hotspot; the Render cloud avoids all of this |
| First Atlas database: "bad auth" | Wrong password for that database user | You created a new cluster (IQOO), which worked first time |
| First database request after start-up timed out | Slow first secure connection (AVG) | The server "warms up" the connection when it starts |
| Servers stopped by themselves | They were tied to the Claude session | They now run as independent background processes |
| Google: "Access blocked: no registered origin" | The website address isn't allowed in Google Cloud | Add the origins (section 16) |
| Wikipedia said "too many requests" | We asked it too many questions at once | Ask one question at a time, with a short pause, and remember the answers |
| TripAdvisor's own website blocks programs (error 403) | It only lets real people in browsers through | We used **Xotelo**, a free service that shares TripAdvisor hotel prices, and found each city from TripAdvisor's India-wide hotel lists |
| The same hotel was suggested twice | TripAdvisor lists some hotels under two areas | Keep only one copy of each hotel |
| A hotel with no reviews (★0) was suggested | Some listings are brand new or empty | Only hotels with a real rating are suggested; well-reviewed ones first |
| Hotel prices were too random | The first version guessed prices | Real prices: live rates for your dates, or the hotel's usual price |
| Budget and Comfort had the same travel cost | Both used the cheapest route as it was | Each style now rides in its own class, with cabs and cars to match |
| A cab was charged once per person | The trip planner prices one traveller | Tickets are per person; a cab is shared by up to 4 people |
| "Internal server error" when logging in, now and then | The online database (MongoDB Atlas) sometimes takes too long to answer | Try again after a few seconds |
| The Expo app server stopped by itself | Unknown; nothing in its log | Start it again (`npx expo start` in the `mobile` folder) |
| Holidays said "I couldn't find Udaipur" | The free OpenStreetMap place search was busy for a moment, and the app had no backup | It now tries twice, then looks in our own list of 337 tourist places, then on Wikipedia |
| The public tunnel said "took too long to connect" | This network blocks it (like the FortiGate Wi-Fi) | Use the laptop's Wi-Fi address on the same network, switch to the phone hotspot, or deploy to Render |

---

## 15. If something goes wrong

| What you see | What to do |
| --- | --- |
| Stuck on "Connecting to SafarSathi…" | Start the backend (`npm run dev`). Phone and laptop must be on the same network, unless you use the tunnel |
| Phone can't open `http://<laptop IP>:8081/status` | Turn off the McAfee/AVG firewalls, or try the phone hotspot |
| Expo Go "Something went wrong" | Open the link from inside Expo Go; restart with `npx expo start -c` |
| Chat answers are tagged "Offline assistant" | The AI isn't reachable; check `GEMINI_API_KEY` and the backend log |
| "Please log in again" | Your session ended (for example after `npm run db:seed`); log in again |
| Google "Access blocked" | See section 16 |
| Map is blank | Check the internet connection and `EXPO_PUBLIC_CARTO_KEY`; restart Expo with `-c` |
| No chargers or parking in a new area | Wait a few seconds; OpenStreetMap may have no data there |
| A holiday hotel says "Usual price", not "Live" | No booking site had a price for those dates, or the price service was busy. The usual price is still a real price; plan again later for live prices |
| A holiday shows "Estimate" hotels | That town has no listed hotels nearby; the plan uses OpenStreetMap hotels with typical prices |
| A holiday takes long to load | Normal: it checks 9 hotels on several booking sites. Wait up to about 20 seconds |
| The website doesn't open on another device | Both must be on the same Wi-Fi; use `http://<laptop IP>:4000`. If it still fails, the firewall (AVG) may be blocking port 4000 |

---

## 16. What is left to do

1. **Deploy to Render** (section 10, Way 2). Then the app works everywhere without the laptop.
2. **Finish Google sign-in.** In Google Cloud → Google Auth Platform → Clients → your client:
   - Type must be **Web application**.
   - Under **Authorized JavaScript origins**, add `http://localhost:8081`, `http://localhost`, and your Render link.
   - Under **Audience**, if the app is in "Testing", add your Gmail addresses as test users.
   - Changes can take 5 minutes to a few hours.
3. **Android APK** (optional), so the phone app works anywhere without Expo Go. Needs a free Expo account.
4. **Change every key and password** that was shared in chat while building: Anthropic, Sarvam, Cognee, Gemini, CARTO, the Google key, and both MongoDB passwords.
5. **Turn the McAfee/AVG firewalls back on** after the hackathon. Consider removing AVG; McAfee and Windows Defender are enough.
6. **Refresh the hotel list** every few months: `npx tsx scripts/fetch-hotels-india.ts` in the `backend` folder (about 45 minutes). Live prices are fetched every time anyway.
7. **Nice to have:**
   - an Open Charge Map key for many more chargers
   - a native speaker checking the translations
   - real booking partners (IRCTC, airlines, hotels), real payments, live trip tracking
   - real train, bus and flight timetables for all of India (today we have a few, all from Pune), so every style's travel price is real

---

## 17. Glossary

| Word | Meaning |
| --- | --- |
| **Backend / server** | The program on the laptop (or in the cloud) that stores data and does the thinking |
| **Expo / Expo Go** | The toolkit we used to build the app, and the Play Store app that runs it during development |
| **API** | The way the app talks to the server (for example "give me chargers near here") |
| **Database (MongoDB Atlas)** | Online storage for accounts, trips, chargers and parking |
| **Tunnel** | A temporary public internet address for a program running on your laptop |
| **Render** | A website that runs our server in the cloud for free |
| **OpenStreetMap** | A free world map made by volunteers; we use it for places, chargers and parking |
| **OAuth / Client ID** | Google's system for "Continue with Google", and the ID that identifies our app to Google |
| **Session** | Proof that you're logged in; ends when you log out |
| **Seed** | Filling the database with starting demo data |
| **Commit** | A saved checkpoint of the code in Git |
| **Style (Budget / Comfort / Luxury)** | How comfortable the holiday is: which hotels, which class of train or flight, and how much food and local travel cost |
| **Live price / live rate** | Today's price for your exact dates, straight from a booking site |
| **Usual price** | What a hotel normally costs per night, when no live price is available |
| **Xotelo** | A free service that shares TripAdvisor hotel lists and booking-site prices |
| **Class (SL, 3A, 1A…)** | Train ticket types: Sleeper (SL), AC 3-tier (3A), AC 2-tier (2A), First AC (1A) |
