# Decisions

Choices made where SPEC.md was ambiguous or where the tooling has moved on. Simplest option wins.

## Phase 1

- **Own git repo.** The folder sat inside a git repo rooted at the user's home directory, so `git init` was run in the project root to keep commits scoped to SafarSathi.
- **Project root is this folder** (`Mobility/`), not a nested `safarsathi/` folder. The layout below it matches the spec.
- **Expo SDK 57 puts routes in `mobile/src/app/`** (not `mobile/app/`). Components and lib live in `mobile/src/components/` and `mobile/src/lib/`. Same structure as the spec, one level down.
- **Standard Expo Router `Tabs`** (JS bottom tabs) instead of the template's `unstable-native-tabs`, so all five tabs can use `@expo/vector-icons` and look the same on every platform.
- **Prisma 6, not 7.** Prisma 7 drops `url = env(...)` from the schema and needs driver adapters; Prisma 6 runs the spec's schema as written.
- **Backend runs through `tsx`** (no build step). `npm run typecheck` runs `tsc --noEmit`.
- **Node version.** Spec says Node 20; the code targets ES2022 and runs on Node 20+ (developed on Node 24).
- **Prettier config is shared at the root.** ESLint is configured per app: `typescript-eslint` flat config in the backend, `eslint-config-expo` (via `expo lint`) in mobile.
- **Added `DEMO_OFFLINE=false`** to `backend/.env.example` now, since the spec's backup plan uses it (wired up in Phase 5).
- **`npm audit` reports 3 high-severity issues** in `deepmerge-ts`, pulled in by the dev-only Prisma 6 CLI. The only fix is a breaking Prisma downgrade, and the CLI never handles untrusted input here, so it's accepted for the hackathon.

## Scope changes requested by the user (Oct 2, 2026)

These extend SPEC.md and take precedence over it where they conflict.

- **All Indian languages, not just English, Hindi and Marathi.** The language toggle becomes a picker covering every language the Sarvam AI models support (English plus Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi, Odia, and more if supported). `User.language` stores a BCP-47 code such as `ta-IN`.
- **Sarvam AI for Indian-language NLP.** Speech-to-text for the mic button (replacing keyboard dictation), natural text-to-speech for replies (replacing on-device `expo-speech` where the key is set), and translation where needed. It sits behind a `SpeechAdapter`/`TranslateAdapter`; with no `SARVAM_API_KEY` it falls back to `expo-speech` and keyboard dictation so the demo still runs.
- **Cognee as the copilot's long-term memory.** Saved places ("home", "office"), travel preferences and past trips are added to Cognee and searched before planning, exposed to Claude as `remember` / `recall_memory` tools. It sits behind a `MemoryAdapter`; with no `COGNEE_API_KEY` it falls back to a local in-database memory. Tenant URL: `COGNEE_API_URL` in `backend/.env`.
- **Higher UI polish** than the spec's minimum: consistent design tokens, teal accent, dark mode, large touch targets.
