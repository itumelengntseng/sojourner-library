-- The family wall (lineage) and the Harlem timeline, stored as one checked JSON document
-- each so the Keeper can edit them in the Writer's Room. Card holders read; only the
-- owner writes; nothing is ever deleted (no delete grant). The app validates the shape
-- and relations before saving (same checks as content/lineage.ts and content/timeline.ts).
create table public.atlas_documents (
  kind        text primary key check (kind in ('lineage', 'timeline')),
  body        jsonb not null check (jsonb_typeof(body) = 'object' and octet_length(body::text) <= 600000),
  updated_at  timestamptz not null default now()
);
alter table public.atlas_documents enable row level security;
create policy atlas_member_select on public.atlas_documents for select using (public.is_member());
create policy atlas_owner_insert on public.atlas_documents for insert with check (public.is_owner());
create policy atlas_owner_update on public.atlas_documents for update using (public.is_owner()) with check (public.is_owner());
grant select, insert, update on public.atlas_documents to authenticated;

create or replace function public.touch_atlas_document() returns trigger
  language plpgsql set search_path = public as
$$ begin new.updated_at := now(); return new; end $$;
create trigger atlas_documents_touch before update on public.atlas_documents
  for each row execute function public.touch_atlas_document();
