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
- [ ] C2 Pitch kits editable in the Writer's Room (stored in Supabase, owner-only), with `content/pitches.ts` as the preview fallback.
- [ ] C3 Lineage and timeline editable in the Writer's Room (same pattern), keeping the file validators.
- [ ] C4 Owner preview of the reading room for unshared works without taking out a loan.
