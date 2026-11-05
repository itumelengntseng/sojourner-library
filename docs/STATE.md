# STATE — The Sojourner Library

## Done & verified
- Reading-time engine (`src/engine/readingTime.ts`): exact word counts from Markdown, personal reading speed learned from sessions (idle gaps > 2 min ignored, recent sessions weighted more), minutes-per-day plans, finish-by-deadline checks.
- Checkout engine (`src/engine/checkout.ts`): loans of 1 hour / evening / 3 days / 2 weeks, due-soon warning, expiry, up to 3 renewals, bookmark carried across loans.
- Librarian desk (`src/engine/ask.ts`): answers "how long to finish", "can I finish by Friday", "how much a day to finish in 2 weeks", "time left in this chapter".
- Tests: 24 passing (`npm test`).

## Next task
B1 — Scaffold the Next.js app around the engine (see BACKLOG.md).

## NEEDS ITU
- (done) GitHub repo created.
1. Later: Supabase project + Vercel project (Claude can create both once the repo exists).

## DECISIONS (reversible)
- Default speed 230 wpm; personal speed half-life 14 days.
- "Evening" loan = 4 hours.
- Weekday deadlines roll forward ("by Thursday" on a Thursday = next Thursday).
