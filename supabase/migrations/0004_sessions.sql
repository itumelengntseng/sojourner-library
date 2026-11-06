-- Reading sessions feed each reader's personal pace.
-- Sessions are re-sent as heartbeats (same id), so they are upserted; keep them bounded.
alter table public.sessions
  add constraint sessions_activity_cap check (cardinality(activity) <= 2000),
  add constraint sessions_words_cap check (words_read <= 500000);

-- A session can only be recorded while the reader has the book on loan.
drop policy sessions_insert on public.sessions;
create policy sessions_insert on public.sessions for insert
  with check (reader_id = auth.uid() and public.can_see_work(work_id) and public.has_active_loan(work_id));

create index sessions_reader_recent on public.sessions (reader_id, started_at desc);
