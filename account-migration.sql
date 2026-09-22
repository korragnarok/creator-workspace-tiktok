-- Run this in Supabase → SQL Editor before uploading the updated pages.
-- Adds tiktok_account_id to videos and products so data can be
-- scoped per connected TikTok account.

alter table public.videos
  add column if not exists tiktok_account_id text default '';

alter table public.products
  add column if not exists tiktok_account_id text default '';

-- Indexes for fast per-account filtering
create index if not exists videos_tiktok_account_id_idx
  on public.videos (user_id, tiktok_account_id);

create index if not exists products_tiktok_account_id_idx
  on public.products (user_id, tiktok_account_id);
