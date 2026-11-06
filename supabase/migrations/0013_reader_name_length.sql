-- QA3: cap a reader's display name in the database, not only in the form (≤ 60 in the app,
-- ≤ 80 at redeem). NOT VALID: existing rows are left exactly as they are (no reader data
-- is changed); every new insert or update is checked.
alter table public.readers
  add constraint readers_display_name_length check (length(display_name) <= 80) not valid;
