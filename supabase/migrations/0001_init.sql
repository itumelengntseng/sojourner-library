-- The Sojourner Library — core schema with row-level security.
-- Rules baked in: authorship "Itumeleng Ntseng" is enforced on every work;
-- manuscripts (works, chapters, chapter_texts) have no DELETE policy — archive instead.

-- gen_random_uuid() is built in (Postgres 13+); no extension needed.

-- ── Readers (membership cards) ─────────────────────────────────────────────
create table public.readers (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          text not null default 'guest' check (role in ('owner', 'guest')),
  display_name  text not null default '',
  card_number   text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  wpm_override  integer check (wpm_override between 50 and 1500),
  created_at    timestamptz not null default now()
);

-- Helpers run as definer so policies can consult readers without recursion.
create or replace function public.is_member() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.readers where id = auth.uid()) $$;

create or replace function public.is_owner() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.readers where id = auth.uid() and role = 'owner') $$;

-- ── Works & chapters ───────────────────────────────────────────────────────
create table public.works (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title         text not null,
  author        text not null default 'Itumeleng Ntseng'
                check (position('Itumeleng Ntseng' in author) > 0),
  hall          text not null default 'main',
  series        text,
  series_order  integer,
  canon_status  text not null default 'canon' check (canon_status in ('canon', 'draft', 'apocrypha')),
  visibility    text not null default 'owner' check (visibility in ('owner', 'members')),
  is_placeholder boolean not null default true,  -- true until a real manuscript arrives
  word_count    integer not null default 0 check (word_count >= 0),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.chapters (
  id            uuid primary key default gen_random_uuid(),
  work_id       uuid not null references public.works (id) on delete restrict,
  position      integer not null check (position >= 1),
  title         text not null,
  word_count    integer not null default 0 check (word_count >= 0),
  unique (work_id, position)
);

-- Text lives apart from chapter metadata so the shelf can show titles and
-- word counts while the words themselves require an active loan.
create table public.chapter_texts (
  chapter_id    uuid primary key references public.chapters (id) on delete restrict,
  body_md       text not null default '',
  updated_at    timestamptz not null default now()
);

create or replace function public.can_see_work(w uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select public.is_owner() or (public.is_member() and exists (
     select 1 from public.works where id = w and visibility = 'members' and archived_at is null)) $$;

-- ── Loans ──────────────────────────────────────────────────────────────────
create table public.loans (
  id              uuid primary key default gen_random_uuid(),
  reader_id       uuid not null default auth.uid() references public.readers (id) on delete cascade,
  work_id         uuid not null references public.works (id) on delete restrict,
  period          text not null check (period in ('hour', 'evening', 'three_days', 'two_weeks')),
  borrowed_at     timestamptz not null default now(),
  due_at          timestamptz not null,
  returned_at     timestamptz,
  renewals        integer not null default 0 check (renewals between 0 and 3),
  bookmark_chapter uuid references public.chapters (id),
  bookmark_offset integer not null default 0 check (bookmark_offset >= 0),
  check (due_at > borrowed_at)
);
-- One open loan per reader per work.
create unique index loans_one_open on public.loans (reader_id, work_id) where returned_at is null;

create or replace function public.has_active_loan(w uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.loans where reader_id = auth.uid() and work_id = w
                  and returned_at is null and due_at > now()) $$;

-- ── Reader data: sessions, notes, highlights ───────────────────────────────
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  reader_id   uuid not null default auth.uid() references public.readers (id) on delete cascade,
  work_id     uuid not null references public.works (id) on delete restrict,
  chapter_id  uuid references public.chapters (id),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  words_read  integer not null default 0 check (words_read >= 0),
  activity    timestamptz[] not null default '{}'
);

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  reader_id   uuid not null default auth.uid() references public.readers (id) on delete cascade,
  work_id     uuid not null references public.works (id) on delete restrict,
  chapter_id  uuid not null references public.chapters (id),
  anchor_offset integer not null default 0 check (anchor_offset >= 0),
  body        text not null check (length(body) between 1 and 10000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.highlights (
  id          uuid primary key default gen_random_uuid(),
  reader_id   uuid not null default auth.uid() references public.readers (id) on delete cascade,
  work_id     uuid not null references public.works (id) on delete restrict,
  chapter_id  uuid not null references public.chapters (id),
  start_offset integer not null check (start_offset >= 0),
  end_offset  integer not null,
  colour      text not null default 'lamplight' check (colour in ('lamplight', 'ochre', 'sky')),
  created_at  timestamptz not null default now(),
  check (end_offset > start_offset)
);

-- ── Row-level security ─────────────────────────────────────────────────────
alter table public.readers       enable row level security;
alter table public.works         enable row level security;
alter table public.chapters      enable row level security;
alter table public.chapter_texts enable row level security;
alter table public.loans         enable row level security;
alter table public.sessions      enable row level security;
alter table public.notes         enable row level security;
alter table public.highlights    enable row level security;

-- readers: see yourself; the owner sees every card. Only the owner issues cards
-- (invite redemption in B3 goes through a security-definer function).
create policy readers_select on public.readers for select using (id = auth.uid() or public.is_owner());
create policy readers_owner_insert on public.readers for insert with check (public.is_owner());
create policy readers_update_self on public.readers for update using (id = auth.uid()) with check (id = auth.uid());
create policy readers_owner_update on public.readers for update using (public.is_owner());
-- Guests may not promote themselves.
create or replace function public.guard_reader_role() returns trigger
  language plpgsql security definer set search_path = public as
$$ begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'only the owner can change roles';
  end if;
  return new;
end $$;
create trigger readers_role_guard before update on public.readers
  for each row execute function public.guard_reader_role();

-- works / chapters / texts: owner writes; members read what's shared. No DELETE policies.
create policy works_select on public.works for select using (public.can_see_work(id));
create policy works_owner_insert on public.works for insert with check (public.is_owner());
create policy works_owner_update on public.works for update using (public.is_owner());

create policy chapters_select on public.chapters for select using (public.can_see_work(work_id));
create policy chapters_owner_insert on public.chapters for insert with check (public.is_owner());
create policy chapters_owner_update on public.chapters for update using (public.is_owner());

create policy texts_select on public.chapter_texts for select using (
  public.is_owner() or exists (
    select 1 from public.chapters c where c.id = chapter_id
      and public.can_see_work(c.work_id) and public.has_active_loan(c.work_id)));
create policy texts_owner_insert on public.chapter_texts for insert with check (public.is_owner());
create policy texts_owner_update on public.chapter_texts for update using (public.is_owner());

-- loans & sessions: your own; the owner can read them for the ledger.
create policy loans_select on public.loans for select using (reader_id = auth.uid() or public.is_owner());
create policy loans_insert on public.loans for insert with check (reader_id = auth.uid() and public.can_see_work(work_id));
create policy loans_update on public.loans for update using (reader_id = auth.uid()) with check (reader_id = auth.uid());

create policy sessions_select on public.sessions for select using (reader_id = auth.uid() or public.is_owner());
create policy sessions_insert on public.sessions for insert with check (reader_id = auth.uid() and public.can_see_work(work_id));
create policy sessions_update on public.sessions for update using (reader_id = auth.uid()) with check (reader_id = auth.uid());

-- notes & highlights: private to the reader who made them (not even the owner reads them).
create policy notes_all on public.notes for all
  using (reader_id = auth.uid()) with check (reader_id = auth.uid() and public.can_see_work(work_id));
create policy highlights_all on public.highlights for all
  using (reader_id = auth.uid()) with check (reader_id = auth.uid() and public.can_see_work(work_id));

-- ── Grants (Supabase roles) ────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.readers, public.works, public.chapters, public.chapter_texts,
  public.loans, public.sessions to authenticated;
grant select, insert, update, delete on public.notes, public.highlights to authenticated;
grant execute on function public.is_member(), public.is_owner(), public.can_see_work(uuid),
  public.has_active_loan(uuid) to authenticated;
-- anon gets nothing: the library is private.
