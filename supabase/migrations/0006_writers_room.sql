-- Writer's Room: the owner imports manuscripts. Chapters are never deleted —
-- a shorter re-import archives the chapters beyond the new end.
alter table public.chapters add column archived_at timestamptz;

create or replace function public.import_manuscript(
  p_slug text, p_title text, p_chapters jsonb, p_canon_status text default 'draft'
) returns uuid language plpgsql security definer set search_path = public as
$$ declare
  w uuid;
  ch jsonb;
  cid uuid;
  n integer := 0;
  total integer := 0;
begin
  if not public.is_owner() then raise exception 'only the owner can import manuscripts'; end if;
  if jsonb_typeof(p_chapters) <> 'array' or jsonb_array_length(p_chapters) = 0 then
    raise exception 'a manuscript needs at least one chapter';
  end if;
  if jsonb_array_length(p_chapters) > 400 then raise exception 'too many chapters (400 at most)'; end if;

  insert into public.works (slug, title, canon_status, is_placeholder)
    values (p_slug, left(trim(p_title), 200), p_canon_status, false)
    on conflict (slug) do update set title = excluded.title, is_placeholder = false, updated_at = now()
    returning id into w;

  for ch in select * from jsonb_array_elements(p_chapters) loop
    n := n + 1;
    insert into public.chapters (work_id, position, title, word_count)
      values (w, n, left(coalesce(ch->>'title', 'Chapter ' || n), 200), coalesce((ch->>'words')::integer, 0))
      on conflict (work_id, position) do update
        set title = excluded.title, word_count = excluded.word_count, archived_at = null
      returning id into cid;
    insert into public.chapter_texts (chapter_id, body_md) values (cid, coalesce(ch->>'body', ''))
      on conflict (chapter_id) do update set body_md = excluded.body_md, updated_at = now();
    total := total + coalesce((ch->>'words')::integer, 0);
  end loop;

  update public.chapters set archived_at = now() where work_id = w and position > n and archived_at is null;
  update public.works set word_count = total where id = w;
  return w;
end $$;
revoke all on function public.import_manuscript(text, text, jsonb, text) from public;
grant execute on function public.import_manuscript(text, text, jsonb, text) to authenticated;

-- Readers don't see archived chapters; the owner still does.
drop policy chapters_select on public.chapters;
create policy chapters_select on public.chapters for select
  using (public.is_owner() or (archived_at is null and public.can_see_work(work_id)));

-- Owner's view of who is reading what (counts only — never notes or highlights).
create or replace function public.readership() returns table (work_id uuid, readers bigint, open_loans bigint, minutes numeric)
  language sql stable security definer set search_path = public as
$$ select w.id,
          (select count(distinct reader_id) from public.loans l where l.work_id = w.id),
          (select count(*) from public.loans l where l.work_id = w.id and l.returned_at is null and l.due_at > now()),
          coalesce((select round(sum(extract(epoch from (s.ended_at - s.started_at))) / 60) from public.sessions s where s.work_id = w.id and s.ended_at is not null), 0)
     from public.works w
    where public.is_owner() $$;
revoke all on function public.readership() from public;
grant execute on function public.readership() to authenticated;
