-- Proof copies: the Keeper may read any chapter text without a loan (the words are theirs).
-- Readers still need an active loan on a shared work (texts_select, unchanged).
create policy texts_owner_select on public.chapter_texts for select using (public.is_owner());
