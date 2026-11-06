-- A short description per work, written by the author in the Writer's Room.
-- Empty until then: the shelves say so rather than inventing one.
alter table public.works add column description text not null default ''
  check (length(description) <= 2000);
