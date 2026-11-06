-- The loan desk. Dates are stamped by the library, never by the reader:
-- borrowing sets borrowed_at/due_at from the period, renewing extends by one
-- period (at most 3 times, never once expired), and an expired loan that was
-- never returned goes back to the shelf on its own (returned_at = due_at).
-- Rules apply to API roles (anon/authenticated); the SQL editor stays free for repairs.

create or replace function public.loan_period_interval(p text) returns interval
  language sql immutable as
$$ select case p
     when 'hour'       then interval '1 hour'
     when 'evening'    then interval '4 hours'
     when 'three_days' then interval '3 days'
     when 'two_weeks'  then interval '14 days'
   end $$;

create or replace function public._is_api_role() returns boolean
  language sql stable as
$$ select current_user in ('anon', 'authenticated') $$;

-- Borrowing: stamp the dates, settle any expired loan of the same book,
-- and carry the bookmark forward from the last loan.
create or replace function public.loan_desk_borrow() returns trigger
  language plpgsql as
$$ declare prev record;
begin
  if not public._is_api_role() then return new; end if;
  new.borrowed_at := now();
  new.due_at      := now() + public.loan_period_interval(new.period);
  new.renewals    := 0;
  new.returned_at := null;

  update public.loans set returned_at = due_at
    where reader_id = new.reader_id and work_id = new.work_id
      and returned_at is null and due_at <= now();

  if new.bookmark_chapter is null and new.bookmark_offset = 0 then
    select bookmark_chapter, bookmark_offset into prev from public.loans
      where reader_id = new.reader_id and work_id = new.work_id
      order by borrowed_at desc limit 1;
    if found then
      new.bookmark_chapter := prev.bookmark_chapter;
      new.bookmark_offset  := prev.bookmark_offset;
    end if;
  end if;
  return new;
end $$;

create trigger loans_desk_borrow before insert on public.loans
  for each row execute function public.loan_desk_borrow();

-- Updating: only renew (renewals + 1), return, or move the bookmark.
create or replace function public.loan_desk_update() returns trigger
  language plpgsql as
$$ begin
  if not public._is_api_role() then return new; end if;
  if new.reader_id is distinct from old.reader_id or new.work_id is distinct from old.work_id
     or new.period is distinct from old.period or new.borrowed_at is distinct from old.borrowed_at then
    raise exception 'the loan desk keeps the slip as it was issued';
  end if;

  if old.returned_at is not null then
    if new.returned_at is distinct from old.returned_at or new.due_at is distinct from old.due_at
       or new.renewals is distinct from old.renewals then
      raise exception 'this book has been returned — borrow it again';
    end if;
    return new;
  end if;

  if new.renewals is distinct from old.renewals then
    if new.renewals <> old.renewals + 1 then raise exception 'renew one period at a time'; end if;
    if old.due_at <= now() then raise exception 'this loan has expired — the book is back on the shelf'; end if;
    if old.renewals >= 3 then raise exception 'renewal limit reached (3)'; end if;
    new.due_at := old.due_at + public.loan_period_interval(old.period);
  elsif new.due_at is distinct from old.due_at then
    raise exception 'due dates are stamped by the desk';
  end if;

  if new.returned_at is not null then
    new.returned_at := least(now(), new.due_at);
  end if;
  return new;
end $$;

create trigger loans_desk_update before update on public.loans
  for each row execute function public.loan_desk_update();

-- "Return to shelf": settle the caller's expired loans. Returns how many went back.
create or replace function public.return_expired_loans() returns integer
  language plpgsql as
$$ declare n integer;
begin
  update public.loans set returned_at = due_at
    where reader_id = auth.uid() and returned_at is null and due_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.loan_period_interval(text), public._is_api_role(),
  public.return_expired_loans() to authenticated;
