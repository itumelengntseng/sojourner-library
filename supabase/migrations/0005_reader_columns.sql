-- QA (B11): a reader may rename themselves or set their pace, but a card's number and
-- issue date are stamped once by the desk. Role changes stay owner-only (trigger in 0001).
revoke update on public.readers from authenticated;
grant update (display_name, wpm_override, role) on public.readers to authenticated;
