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
- B10 Reading ledger (`app/ledger`, `lib/ledger.ts`, `lib/ledgerStore.ts`, `components/PreviewNotesExport.tsx`): current and longest run of reading days (a day counts after 1 min of reading; days roll over at midnight SAST), days read, total time, hours and words per book, borrowing history with stamped dates and renewals, and a Markdown export of notes and highlights (`/ledger/notes` in library mode — highlight text included only for books currently on loan, per RLS; built in the browser in preview mode). Linked from the front hall. Smoke-tested at 375px incl. the download.
- B11 QA pass (2026-11-06):
  - Accessibility: `npm run qa` (scripts/qa.mjs) runs axe-core (WCAG 2.1 AA + best practice) on every route at 375px and 1280px, plus the reading room in sepia, light and paged modes with highlights and notes present; also fails on sideways page scroll or console errors. Fixed: slip author line contrast; reading-room meta text and the librarian box on sepia/light pages. Result: all clear.
  - Mobile 375px: no route scrolls sideways (checked by the sweep).
  - Performance (local prod build): every page loads < 200 ms; ~135–143 KB gzipped JS per page (framework baseline), HTML ≤ 9 KB.
  - RLS security: new standing audit `tests/security.test.ts` — RLS on every public table, anon has no grants, only notes/highlights deletable by readers, all security-definer functions pin search_path, bootstrap functions not callable from the API, signed-in strangers see nothing, authorship check holds. Found and fixed: readers could rewrite their own card number / issue date → `0005_reader_columns.sql` limits updates to name, pace and (owner-guarded) role.
- NEXT ITERATION a — Lineage Explorer (`app/lineage`, `components/LineageWall.tsx`, `lib/lineage.ts`, data in `content/lineage.ts`): "The family wall" — stone plaques in generation rows; select a person to see parents, partners, siblings, children and the works they appear in; "How are they connected?" traces the shortest family tie between any two people; respects the canon toggle. Data is 7 clearly-labelled placeholder people only. `npm test` validates the lineage file (unknown ids, duplicates, >2 parents, self-reference, ancestry loops, unknown works) so Itu's real file is checked on entry. In the axe sweep; all clear.
- Tests: 161 passing (`npm test`). Typecheck clean; `npm run build` passes; `npm run qa` all clear.

## Next task
NEXT ITERATION b — Canon Switcher.

## Known issues
- TypeScript pinned to 6.0.3: Next 16 can't use TypeScript 7 (no JS compiler API).

- Work page, halls and the librarian read chapter word counts from the static placeholder catalogue (`lib/catalogue.ts`), while library-mode loans/reading use Supabase. When real manuscripts are loaded into Supabase, switch the catalogue to read from the `works`/`chapters` tables (slugs must match).
- Minor: the final session beacon can arrive just after you navigate straight to the ledger, so the newest few seconds of reading may appear only on the next load.

## NEEDS ITU
1. **Supabase project** (not created — may involve billing). Steps: supabase.com → New project (name `sojourner-library`, region nearest Johannesburg/your readers) → Project Settings → API: copy the URL and anon key into Vercel env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (never into the repo). Then `supabase link` + `supabase db push` (see `supabase/README.md`), or ask the build team to apply migrations via the Supabase connector once it exists.
3. **Real lineage (when ready, no rush)**: replace the placeholder people in `content/lineage.ts` (instructions at the top of the file), or send the family tree in any form and the build team will enter it. Nothing about the real families has been invented.
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
- The ledger shows only your own reading; an owner-wide ledger across readers is not built (would need Itu's call on privacy).
- System serif font stack (no web-font download) to keep builds offline-safe.
