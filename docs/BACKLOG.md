# BACKLOG (top = next)

- [x] E1 Reading-time engine + tests
- [x] E2 Checkout engine + tests
- [x] E3 Librarian desk (question parser) + tests
- [x] B1 Next.js (App Router, TS, Tailwind) scaffold; move engine into `lib/`; tests still green
- [x] B2 Supabase schema + RLS: readers, works, chapters, loans, sessions, notes, highlights
- [x] B3 Sign-in as a membership card (invite-only; owner + guest roles)
- [x] B4 Front hall: animated covers (layered CSS/JS scene transitions — Harlem streets into Free State plains)
- [x] B5 Halls & shelves → work detail page (word count, reading time, canon toggle)
- [x] B6 Checkout flow UI: due-date slip, renew, return-to-shelf on expiry
- [x] B7 Reader view: paged/scroll, dark/sepia/light, bookmarks, margin notes, highlights
- [x] B8 Session tracking feeding personal speed
- [x] B9 "Ask the librarian" box on every book
- [x] B10 Reading ledger: history, hours per book, streaks, notes export
- [x] B11 QA pass: accessibility, 375px mobile, performance, RLS security check

## NEXT ITERATION (after backlog)
a. ~~Lineage Explorer~~ (done 2026-11-06) · ~~b. Canon Switcher~~ (done 2026-11-06) · ~~c. Harlem Timeline Map~~ (done 2026-11-06) · ~~d. Writer's Room~~ (done 2026-11-06) · ~~e. Pitch Room~~ (done 2026-11-06)

## FOLLOW-UPS (proposed by the build team, in order — unblocked)
- [x] C1 Catalogue from Supabase: when connected, the front hall, halls, work page, lineage/timeline titles and librarian read `works`/`chapters` (not the static placeholder catalogue), so Writer's Room imports appear on the shelves. Keep the static catalogue for preview mode.
- [x] C2 Pitch kits editable in the Writer's Room (stored in Supabase, owner-only), with `content/pitches.ts` as the preview fallback.
- [x] C3 Lineage and timeline editable in the Writer's Room (same pattern), keeping the file validators.
- [x] C4 Owner preview of the reading room for unshared works without taking out a loan.
- [x] C5 Form-based editor for the family wall and timeline (add/edit one person, place or event at a time), on top of the C3 JSON store.
- [x] QA2 Second QA pass over C1–C5: axe/mobile sweep incl. owner pages, RLS audit of 0008–0010 added to `tests/security.test.ts`, performance check.
- [x] C6 Work descriptions: an owner-only "description" field per work in the Writer's Room (replaces "The author hasn't written a description…"), stored on `works`.
- [x] C7 Hall names editable in the Writer's Room (owner-only `halls` table: id, name, note, order) and a "Hall" choice per work; `lib/catalogue.ts` HALLS stays as the preview fallback.
- [x] C8 Library-mode end-to-end smoke script (Playwright) ready to run against a real Supabase project once NEEDS ITU 1 is done: sign in → redeem → borrow → read → note → ledger export → import → pitch link → proof.
- [x] C9 "Newly shelved" on the front hall: the few works most recently shared or updated, with a stamped date (library mode; preview shows none).
- [x] C10 Archive a work from the Writer's Room (sets `archived_at`; hidden from shelves, never deleted; can be restored).
- [x] C11 Reader card page shows "On loan now" (title, due-date stamp, link to the reading room) so readers can resume from the front desk.
- [x] C12 Reading-room "Contents" drawer: jump to any chapter, with words / minutes per chapter and a mark on the bookmarked one.
- [x] C13 Ledger: per-book "finished" stamp when a reader reaches the end of the last chapter (from sessions), shown in the ledger and on the work page.
- [x] C14 Work page: "You finished this on …" stamp (reuse `finishedAt()`; reader's own sessions for that work only).
- [x] C15 Reader preferences on the card page: display name and a fixed reading pace (`readers.display_name`, `wpm_override` — already writable by the reader under RLS), with "let the library learn my pace" to clear the override.
- [x] C16 Print-friendly pitch sheet: a print stylesheet for `/pitch-room/<slug>` and `/p/<token>` (paper colours, no nav, page breaks), so "Print → Save as PDF" gives a clean one-pager.
