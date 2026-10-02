# SafarSathi — AI Mobility Copilot

One AI copilot that fixes the whole journey, not just one leg of it. See [SPEC.md](SPEC.md) for the full build specification and [DECISIONS.md](DECISIONS.md) for choices made along the way.

```
backend/   Express + TypeScript + Prisma (SQLite) REST API and AI agent
mobile/    Expo (React Native) + TypeScript + Expo Router app
```

## Prerequisites

- Node.js 20+
- An Android phone with **Expo Go** installed, on the same Wi-Fi as your laptop

## Backend

```bash
cd backend
cp .env.example .env        # then fill in ANTHROPIC_API_KEY
npm install
npm run dev                 # http://localhost:4000/api/health -> { "ok": true }
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the API with auto-reload |
| `npm start` | Start the API |
| `npm run typecheck` | Type-check with `tsc` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest unit tests |

## Mobile

```bash
cd mobile
cp .env.example .env        # set EXPO_PUBLIC_API_URL to http://<your-laptop-LAN-IP>:4000
npm install
npx expo start              # scan the QR code with Expo Go
```

Find your LAN IP with `ipconfig` (Windows) or `ipconfig getifaddr en0` (macOS). If the phone can't reach the backend, allow Node.js through the Windows firewall on private networks.

| Command | What it does |
| --- | --- |
| `npx expo start` | Start the Expo dev server |
| `npm run lint` | ESLint (`expo lint`) |
| `npm run typecheck` | Type-check with `tsc` |
| `npm run format` | Prettier |
