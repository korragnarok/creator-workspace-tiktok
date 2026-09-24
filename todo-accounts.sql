-- ─── To Do per TikTok account — run once in Supabase → SQL Editor ─────────
-- 1. Add the account column to the to-do queue
alter table public.queue add column if not exists tiktok_account_id text;

-- 2. Existing to-dos: give each one the account of the product it's for
update public.queue q
set tiktok_account_id = p.tiktok_account_id
from public.products p
where q.prod_id = p.id
  and q.tiktok_account_id is null
  and p.tiktok_account_id is not null;

-- 3. Anything left (no linked product) goes to House of Ko
update public.queue
set tiktok_account_id = '-000KtCJ97-FMdyzKkpvBKbAdZgYhkkRNDAr'
where user_id = 'dd429d71-6ebd-4db5-8ee8-d64f044f9c72'
  and tiktok_account_id is null;

create index if not exists queue_user_account_date_idx
  on public.queue (user_id, tiktok_account_id, date);
