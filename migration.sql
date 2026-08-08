-- Run this in Supabase → SQL Editor BEFORE uploading the new pages.
-- Adds per-video sales attribution to the sales table.

alter table public.sales
  add column if not exists video_sales jsonb not null default '[]'::jsonb;

-- Speeds up the tracker's per-video rollup once you have a lot of history.
create index if not exists sales_video_sales_idx
  on public.sales using gin (video_sales);
