# Supabase

Migrations live in `migrations/` and are applied in filename order.

- Tests run every migration against an in-memory Postgres (PGlite) with stubbed
  Supabase roles (`anon`, `authenticated`), `auth.users` and `auth.uid()` — see
  `tests/helpers/db.ts`. `npm test` checks the RLS rules end to end.
- To apply to a real project (once Itu has created one): install the Supabase CLI,
  `supabase link --project-ref <ref>`, then `supabase db push`.

Rules enforced in the schema:
- Every work's `author` must contain "Itumeleng Ntseng" (defaults to it).
- No DELETE policy or grant exists on works, chapters or chapter texts — archive with `archived_at`.
- Chapter text is readable only by the owner, or by a member holding an active loan.
- Notes and highlights are private to the reader who made them.
