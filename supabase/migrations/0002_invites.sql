-- Invite-only membership. A reader card is issued only by redeeming an invite.
-- Codes are shown once and stored hashed.

create table public.invites (
  id           uuid primary key default gen_random_uuid(),
  code_hash    text not null unique,
  role         text not null default 'guest' check (role in ('owner', 'guest')),
  note         text not null default '',            -- who it's for, in Itu's words
  created_by   uuid references public.readers (id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  redeemed_by  uuid references public.readers (id),
  redeemed_at  timestamptz,
  revoked_at   timestamptz
);

alter table public.invites enable row level security;
create policy invites_owner_select on public.invites for select using (public.is_owner());
create policy invites_owner_update on public.invites for update using (public.is_owner());
grant select, update (revoked_at, note) on public.invites to authenticated;

-- Codes are compared after stripping everything but letters/digits, upper-cased.
create or replace function public.normalize_invite_code(code text) returns text
  language sql immutable as
$$ select upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')) $$;

create or replace function public.hash_invite_code(code text) returns text
  language sql immutable as
$$ select encode(sha256(convert_to(public.normalize_invite_code(code), 'UTF8')), 'hex') $$;

-- Internal: mint a code. Returns the plain code once (format SOJ-XXXX-XXXX-XXXX).
create or replace function public._mint_invite(p_role text, p_days integer, p_note text, p_by uuid)
  returns text language plpgsql security definer set search_path = public as
$$ declare
  raw text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  code text := 'SOJ-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
begin
  if p_days < 1 or p_days > 90 then raise exception 'invites last between 1 and 90 days'; end if;
  insert into public.invites (code_hash, role, note, created_by, expires_at)
    values (public.hash_invite_code(code), p_role, coalesce(p_note, ''), p_by, now() + make_interval(days => p_days));
  return code;
end $$;
revoke all on function public._mint_invite(text, integer, text, uuid) from public;

-- Owner-only: invite a guest reader.
create or replace function public.create_invite(p_note text default '', p_days integer default 14)
  returns text language plpgsql security definer set search_path = public as
$$ begin
  if not public.is_owner() then raise exception 'only the owner can issue invites'; end if;
  return public._mint_invite('guest', p_days, p_note, auth.uid());
end $$;
revoke all on function public.create_invite(text, integer) from public;
grant execute on function public.create_invite(text, integer) to authenticated;

-- Bootstrap: run once from the Supabase SQL editor (as postgres) to get Itu's own owner invite.
-- Not callable through the API.
create or replace function public.mint_owner_invite() returns text
  language sql security definer set search_path = public as
$$ select public._mint_invite('owner', 7, 'Owner card for Itumeleng Ntseng', null) $$;
revoke all on function public.mint_owner_invite() from public;

-- Signed-in user redeems a code and receives their reader card.
create or replace function public.redeem_invite(p_code text, p_display_name text default '')
  returns public.readers language plpgsql security definer set search_path = public as
$$ declare
  me uuid := auth.uid();
  inv public.invites;
  card public.readers;
begin
  if me is null then raise exception 'sign in before redeeming an invite'; end if;
  if exists (select 1 from public.readers where id = me) then
    raise exception 'you already hold a reader card';
  end if;
  select * into inv from public.invites
    where code_hash = public.hash_invite_code(p_code) for update;
  if not found or inv.revoked_at is not null then raise exception 'that invite code is not recognised'; end if;
  if inv.redeemed_at is not null then raise exception 'that invite has already been used'; end if;
  if inv.expires_at <= now() then raise exception 'that invite has expired'; end if;

  insert into public.readers (id, role, display_name)
    values (me, inv.role, left(trim(coalesce(p_display_name, '')), 80))
    returning * into card;
  update public.invites set redeemed_by = me, redeemed_at = now() where id = inv.id;
  return card;
end $$;
revoke all on function public.redeem_invite(text, text) from public;
grant execute on function public.redeem_invite(text, text) to authenticated;
