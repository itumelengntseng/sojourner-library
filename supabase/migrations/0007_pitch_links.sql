-- Pitch Room share links: let an agent or producer read one pitch kit without a reader card.
-- Tokens are shown once and stored hashed; links expire, can be revoked, and count their views.
-- A link opens the pitch kit only — never chapter text, notes or reader data.
create table public.pitch_links (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  work_slug   text not null,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  views       integer not null default 0,
  last_viewed_at timestamptz
);
alter table public.pitch_links enable row level security;
create policy pitch_links_owner_select on public.pitch_links for select using (public.is_owner());
create policy pitch_links_owner_update on public.pitch_links for update using (public.is_owner());
grant select, update (revoked_at, note) on public.pitch_links to authenticated;

create or replace function public.create_pitch_link(p_slug text, p_note text default '', p_days integer default 14)
  returns text language plpgsql security definer set search_path = public as
$$ declare tok text;
begin
  if not public.is_owner() then raise exception 'only the owner can share pitches'; end if;
  if p_days < 1 or p_days > 60 then raise exception 'pitch links last between 1 and 60 days'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'not a work address'; end if;
  tok := translate(encode(decode(replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), 'hex'), 'base64'), '+/=', '-_');
  tok := substr(tok, 1, 32);
  insert into public.pitch_links (token_hash, work_slug, note, expires_at)
    values (encode(sha256(convert_to(tok, 'UTF8')), 'hex'), p_slug, left(coalesce(p_note, ''), 200), now() + make_interval(days => p_days));
  return tok;
end $$;
revoke all on function public.create_pitch_link(text, text, integer) from public;
grant execute on function public.create_pitch_link(text, text, integer) to authenticated;

-- Callable without signing in: for a live link, counts the view and returns the work's slug
-- with its title, author and length (from works when it exists there). Nothing else.
create or replace function public.open_pitch_link(p_token text)
  returns table (work_slug text, title text, author text, word_count integer)
  language plpgsql security definer set search_path = public as
$$ declare s text;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32}$' then return; end if;
  update public.pitch_links l set views = l.views + 1, last_viewed_at = now()
    where l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
      and l.revoked_at is null and l.expires_at > now()
    returning l.work_slug into s;
  if s is null then return; end if;
  return query select s, w.title, w.author, w.word_count from (select 1) one
    left join public.works w on w.slug = s and w.archived_at is null;
end $$;
revoke all on function public.open_pitch_link(text) from public;
grant execute on function public.open_pitch_link(text) to anon, authenticated;
