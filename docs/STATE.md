# STATE — The Sojourner Library

_Last updated: 2026-11-05 (scheduled build run)._

## Done & verified
- Engine (`lib/engine/`): reading time, checkout, librarian desk — unchanged, still green.
- B1 Next.js 16 App Router + Tailwind 4 scaffold. `npm run build` passes; front hall placeholder page with stone/lamplight theme tokens in `app/globals.css`; authorship footer on every page; `noindex` (private library).
- B2 Supabase schema + RLS (`supabase/migrations/0001_init.sql`). Verified against in-memory Postgres (PGlite) with stubbed Supabase auth: anon sees nothing, guests see only shared works, chapter text needs an active loan, notes/highlights private to their reader, no manuscript deletes, guests can't self-promote.
- Tests: 42 passing (`npm test`). Typecheck clean (`npm run typecheck`).

## Next task
B3 — Sign-in as a membership card (invite-only; owner + guest roles).

## Known issues
- An expired loan that was never returned still blocks a new loan of the same book (unique open-loan index). B6 must auto-return expired loans ("return to shelf").
- TypeScript pinned to 6.0.3: Next 16 can't use TypeScript 7 (no JS compiler API).

## NEEDS ITU
1. **Supabase project** (not created — may involve billing). Steps: supabase.com → New project (name `sojourner-library`, region nearest Johannesburg/your readers) → Project Settings → API: copy the URL and anon key into Vercel env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (never into the repo). Then `supabase link` + `supabase db push` (see `supabase/README.md`), or ask the build team to apply migrations via the Supabase connector once it exists.
2. **Vercel project** for preview deploys: vercel.com → Add New → Project → import `itumelengntseng/sojourner-library`. Production domain/DNS stays with Itu.

## DECISIONS (reversible)
- Default speed 230 wpm; personal speed half-life 14 days.
- "Evening" loan = 4 hours.
- Weekday deadlines roll forward ("by Thursday" on a Thursday = next Thursday).
- Engine lives in `lib/engine/`; app in root `app/`; `@/` path alias.
- Chapter text stored apart from chapter metadata (`chapter_texts`) so shelves show titles/word counts without a loan.
- Notes and highlights are private even from the owner; loans and sessions are visible to the owner (for the ledger).
- Works default to `visibility = 'owner'` and `is_placeholder = true`; Itu shares a work by switching to `members`.
- System serif font stack (no web-font download) to keep builds offline-safe.
