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
- [x] QA3 Full QA pass after C6–C16: axe/mobile sweep (incl. the pitch sheet in print), RLS audit of descriptions/halls/archive/reader privacy, performance, preview e2e.
- [x] C17 Search the shelves: a search box on `/halls` filtering by title, series, hall and description (client-side over what the reader can already see; respects the canon switch; no new data).
- [x] C18 Reading-room keyboard help: "?" (and a toolbar link) opens a small card listing the shortcuts (page turn, contents, bookmark, size), closable with Esc.
- [x] C19 Ledger "Reading by month": minutes read per month for the last 12 months as timber bars (SA time), from the reader's own sessions; preview mode from the cookie summaries.
- [x] C20 Pitch links "last opened": stamp the time a share link was last opened and show it in the Pitch Room list (owner-only; no visitor data beyond the time).
- [x] QA4 QA pass after C17–C20: axe/mobile sweep incl. search results, the keys card open and the monthly chart; preview e2e; performance.
- [x] C21 Re-import preview in the Writer's Room: before saving a manuscript that's already on the shelves, show which chapters are new, changed (word count differs), unchanged, or will be archived — so Itu sees what a re-import will do.
- [x] C22 "The library at a glance" in the Writer's Room: works (shared / only me / set aside), total words, card holders, loans open now — counts only, never who read what.
- [x] C23 Due-soon notice on the front hall: if one of the reader's loans is due within 24 hours, a small slip "Due back soon: <title> · <time>" linking to the card.
- [~] C24 (blocked → NEEDS ITU 1: the live-database change was refused by this session's safety check as a production change; Itu applies it) Apply `0013_reader_name_length.sql` to the live Supabase project (with the Supabase connector, as earlier runs did) and record it in STATE → NEEDS ITU 1; if the connector asks for approval, leave it listed for Itu.
- [x] C25 Reading room "end of chapter" card: at the foot of each chapter, the next chapter's title and minutes at the reader's pace, with a Continue link (last chapter: "The end of <title>" + link to the ledger). No invented text.
- [x] C26 Card page: "Recently returned" — the reader's last 5 returned loans with stamped dates and a Borrow again link (own loans only).
- [x] QA5 QA pass after C21–C26 (axe/mobile incl. the Writer's Room tiles and re-import preview with a matching title; RLS audit if any migration lands; preview e2e).
- [x] C27 Manuscript backup: "Download Markdown" per work in the Writer's Room (owner-only route `/writers-room/export/<slug>`), in the import's own shape so it re-imports unchanged; set-aside chapters in a separate file; set-aside works included. Read-only.
- [x] C28 Work page chapter list: a small "read" tick on chapters the reader has finished (≥ 90% of its words, from their own sessions — same rule as C13), and "you're here" on the bookmarked one.
- [x] C29 Ledger notes export per book: a "Notes for this book" download on each row of Hours per book (same Markdown as the full export, filtered to one work; own notes only).
- [x] C30 Reading room "Skip to the text" link (first focusable item, visible on focus) and a visible focus ring check on the toolbar buttons in all three themes.
- [x] QA6 QA pass after C27–C30 (axe/mobile incl. the work page with ticks and the Writer's Room backup links; preview e2e; performance; RLS unchanged unless a migration lands).
- [x] C31 Writer's Room "Back up everything": one download with every work (shelved + set-aside, each as its own Markdown file inside a .zip, no new dependency — a stored-only zip writer), plus the family-wall/timeline JSON. Owner-only, read-only.
- [x] C32 Reading room "chapter progress" line under the title: a thin timber rule filling with the reader's progress through the chapter (from the paragraphs read past — same data as the "min left" line), with a spoken label; hidden in the proof copy.
- [x] C33 Halls: sort shelves by "Recently shared" or "Title" (GET param, works without JavaScript; default stays series order).
- [x] QA7 QA pass after C31–C33.
- [x] C34 Front hall "Continue reading": the reader's most recently read open loan (from their own sessions) as a single lamplit card — title, chapter, minutes left in it at their pace, Resume. Nothing open → nothing shown.
- [x] C35 Writer's Room: "Last backed up" line beside the backup button (a per-browser note of the last download time — no new table), with a gentle reminder after 30 days.
- [x] C36 Ledger: "Words read" total tile and per-month words on the month bars' spoken labels (no new data).
- [ ] QA8 QA pass after C34–C36.
