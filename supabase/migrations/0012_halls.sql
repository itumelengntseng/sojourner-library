-- Hall names, chosen by the author. Card holders read them; only the owner names,
-- renames or reorders them; halls are never deleted (works keep their hall id).
create table public.halls (
  id        text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 60),
  name      text not null check (length(trim(name)) between 1 and 80),
  note      text not null default '' check (length(note) <= 300),
  position  integer not null default 0
);
alter table public.halls enable row level security;
create policy halls_member_select on public.halls for select using (public.is_member());
create policy halls_owner_insert on public.halls for insert with check (public.is_owner());
create policy halls_owner_update on public.halls for update using (public.is_owner()) with check (public.is_owner());
grant select, insert, update on public.halls to authenticated;

-- Works may only be moved into halls that exist (or the default 'main').
alter table public.works add constraint works_hall_format check (hall ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
