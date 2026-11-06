# STATE — The Sojourner Library

_Last updated: 2026-11-06 (scheduled build run)._

## Done & verified
- Engine (`lib/engine/`): reading time, checkout, librarian desk — unchanged, still green.
- B1 Next.js 16 App Router + Tailwind 4 scaffold. `npm run build` passes; front hall placeholder page with stone/lamplight theme tokens in `app/globals.css`; authorship footer on every page; `noindex` (private library).
- B2 Supabase schema + RLS (`supabase/migrations/0001_init.sql`). Verified against in-memory Postgres (PGlite) with stubbed Supabase auth: anon sees nothing, guests see only shared works, chapter text needs an active loan, notes/highlights private to their reader, no manuscript deletes, guests can't self-promote.
- B3 Invite-only membership cards (`supabase/migrations/0002_invites.sql`, `app/card/`): hashed invite codes, owner-only `create_invite`, `mint_owner_invite()` callable only from the SQL editor, `redeem_invite` issues a guest card; magic-link sign-in; card rendered as a stamped library card.
- B4 Front hall living covers (`components/SceneCover.tsx`): layered Harlem street → Free State plains scenes, pauses on hover/focus, static under reduced motion.
- B5 Halls with timber shelves (`app/halls`), canon toggle (`?canon=all`), work detail page (`app/works/[slug]`) with word count and reading time per chapter. Catalogue is placeholder-only (`lib/catalogue.ts`).
- B6 Loan desk (`supabase/migrations/0003_loan_desk.sql`, `lib/loanDesk.ts`, `lib/loanStore.ts`, `components/LoanDesk.tsx`, `components/DueDateSlip.tsx`): borrow for an hour / evening / three days / two weeks; date-due slip stamped in SA time; renew (max 3, never once expired); return to shelf. DB triggers stamp dates server-side (readers can't forge due dates), auto-return expired loans on re-borrow and via `return_expired_loans()`, and carry the bookmark forward. Without Supabase the page runs a "preview desk" kept in a browser cookie. Smoke-tested in Chromium at 375px: borrow → renew → reload → return.
- B7 Reading room (`app/works/[slug]/read`, `components/ReaderView.tsx`, `lib/reader.ts`, `lib/readingRoom.ts`): gated by an open loan; scroll or paged (CSS columns, arrow keys, page buttons); dark / sepia / light; text size A−/A+; "Bookmark here" saves to the loan and the reading room resumes there; select text → highlight in lamplight / ochre / sky; margin notes beside paragraphs (in the margin on wide screens, under the paragraph on phones); remove either. Library mode writes notes/highlights to Supabase (RLS: private to the reader); preview mode keeps them in the browser. Smoke-tested in Chromium at 375px: gate → borrow → highlight → note → bookmark → sepia → reload persists → paged turn, no sideways page scroll, no console errors.
- B8 Reading sessions → personal pace (`components/useSessionTracker.ts`, `app/api/sessions`, `lib/sessions.ts`, `lib/sessionStore.ts`, `supabase/migrations/0004_sessions.sql`): the reading room logs activity (throttled to one mark per 5 s) and the paragraphs read past, heartbeats every 60 s and sends a final beacon on leaving. Server validates everything (recent timestamps only, words capped at chapter length, same-site only, open loan required — also enforced by RLS). Pace = engine's recency-weighted wpm (idle gaps > 2 min ignored, < 150-word or outside 60–900 wpm sessions ignored); `readers.wpm_override` wins if set. Work page and reading room ("About N min left in this chapter") use it. Smoke-tested: session recorded, cross-site POST → 403, junk → 400.
- B9 Ask the librarian (`components/AskLibrarian.tsx`, `lib/librarian.ts`): on every work page and at the foot of the reading room. Plain-language questions answered by the engine from the reader's pace, bookmark (or live position in the reading room) and usual minutes a day (learned from sessions; 30 min default). Suggested-question chips; last 3 replies kept as paper slips (aria-live). Smoke-tested at 375px.
- Tests: 133 passing (`npm test`). Typecheck clean; `npm run build` passes.

## Next task
B10 — Reading ledger: history, hours per book, streaks, notes export.

## Known issues
- TypeScript pinned to 6.0.3: Next 16 can't use TypeScript 7 (no JS compiler API).

- Work page, halls and the librarian read chapter word counts from the static placeholder catalogue (`lib/catalogue.ts`), while library-mode loans/reading use Supabase. When real manuscripts are loaded into Supabase, switch the catalogue to read from the `works`/`chapters` tables (slugs must match).

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
- Loan slips are stamped in Africa/Johannesburg time.
- Expired loans cannot be renewed; they return to the shelf and the reader borrows again (bookmark carried).
- Until Supabase is connected, the loan desk works as a per-browser preview (cookie), clearly labelled.
- Highlight and note offsets are character offsets into the chapter text; bookmarks are word offsets into the whole work.
- Reader settings (theme, layout, size) are per-browser (localStorage), not per-account.
- Words count as read only once the reader has moved past a paragraph (or the chapter end is on screen) — conservative on purpose.
- Preview mode keeps up to 40 session summaries in a cookie; library mode keeps full sessions (last 90 days used for pace).
- The librarian assumes 30 minutes of reading a day until sessions show the reader's habit.
- System serif font stack (no web-font download) to keep builds offline-safe.
