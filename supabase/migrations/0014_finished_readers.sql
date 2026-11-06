-- C45: how many guest readers have read each work to the end — counts only, never who.
-- "The end" uses the library's one rule (C13): a reader's sessions in the work's last
-- shelved chapter add up to at least 90% of its words. Owner-only; changes no data.
create or replace function public.finished_readers() returns table (work_id uuid, finished bigint)
  language sql stable security definer set search_path = public as
$$ select w.id,
          (select count(*) from (
              select s.reader_id
                from public.sessions s
                join public.readers r on r.id = s.reader_id and r.role = 'guest'
               where s.chapter_id = lc.id
               group by s.reader_id
              having sum(s.words_read) >= 0.9 * lc.word_count) f)
     from public.works w
     cross join lateral (
       select c.id, c.word_count from public.chapters c
        where c.work_id = w.id and c.archived_at is null
        order by c.position desc limit 1) lc
    where public.is_owner() and lc.word_count > 0 $$;
revoke all on function public.finished_readers() from public;
grant execute on function public.finished_readers() to authenticated;
