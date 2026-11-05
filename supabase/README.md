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

## First owner card (one time, Itu only)
1. In the Supabase dashboard → Authentication → Providers, keep **Email** on (magic link) and turn **off** "Allow new users to sign up" only if you later want Supabase-side invites; our invite codes already gate reader cards.
2. Authentication → URL Configuration: set Site URL to the preview/production URL and add `<url>/auth/callback` to Redirect URLs.
3. SQL editor: `select public.mint_owner_invite();` — copy the `SOJ-…` code (shown once, valid 7 days).
4. Visit `/card`, sign in with your email link, enter the code. You now hold the Keeper's card and can issue guest invites with `select public.create_invite('for …', 14);` (an invite screen comes later).
