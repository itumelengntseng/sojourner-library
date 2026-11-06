-- Pitch kits stored in the library so the Keeper can edit them in the Writer's Room.
-- Owner-only: guests and anon never read kits directly. A live share link reveals one
-- kit through open_pitch_link(). Kits are never deleted (no delete grant).
create table public.pitch_kits (
  work_slug      text primary key check (work_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_placeholder boolean not null default true,
  logline        text not null default '' check (length(logline) <= 600),
  synopsis       text not null default '' check (length(synopsis) <= 6000),
  themes         text[] not null default '{}' check (cardinality(themes) <= 12),
  comparables    text[] not null default '{}' check (cardinality(comparables) <= 12),
  audience       text not null default '' check (length(audience) <= 600),
  formats        text[] not null default '{}' check (cardinality(formats) <= 12),
  sample         text not null default '' check (length(sample) <= 8000),
  author_note    text not null default '' check (length(author_note) <= 3000),
  contact        text not null default '' check (length(contact) <= 300),
  updated_at     timestamptz not null default now()
);
alter table public.pitch_kits enable row level security;
create policy pitch_kits_owner_select on public.pitch_kits for select using (public.is_owner());
create policy pitch_kits_owner_insert on public.pitch_kits for insert with check (public.is_owner());
create policy pitch_kits_owner_update on public.pitch_kits for update using (public.is_owner()) with check (public.is_owner());
grant select, insert, update on public.pitch_kits to authenticated;

create or replace function public.touch_pitch_kit() returns trigger
  language plpgsql set search_path = public as
$$ begin new.updated_at := now(); return new; end $$;
create trigger pitch_kits_touch before update on public.pitch_kits
  for each row execute function public.touch_pitch_kit();

-- open_pitch_link now also returns the stored kit (has_kit = false → use the file kit).
drop function public.open_pitch_link(text);
create function public.open_pitch_link(p_token text)
  returns table (work_slug text, title text, author text, word_count integer,
                 has_kit boolean, is_placeholder boolean, logline text, synopsis text, themes text[],
                 comparables text[], audience text, formats text[], sample text, author_note text, contact text)
  language plpgsql security definer set search_path = public as
$$ declare s text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32}$' then return; end if;
  update public.pitch_links l set views = l.views + 1, last_viewed_at = now()
    where l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      and l.revoked_at is null and l.expires_at > now()
    returning l.work_slug into s;
  if s is null then return; end if;
  return query select s, w.title, w.author, w.word_count,
      k.work_slug is not null, k.is_placeholder, k.logline, k.synopsis, k.themes,
      k.comparables, k.audience, k.formats, k.sample, k.author_note, k.contact
    from (select 1) one
    left join public.works w on w.slug = s and w.archived_at is null
    left join public.pitch_kits k on k.work_slug = s;
end $$;
revoke all on function public.open_pitch_link(text) from public;
grant execute on function public.open_pitch_link(text) to anon, authenticated;
