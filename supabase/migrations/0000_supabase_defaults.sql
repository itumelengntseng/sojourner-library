-- Supabase grants every new table, sequence and function in `public` to the API roles
-- (anon, authenticated) by default. This library is private and grants access table by
-- table, so switch those defaults off before anything is created. Later migrations then
-- grant exactly what each table and function needs, and RLS does the rest.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
