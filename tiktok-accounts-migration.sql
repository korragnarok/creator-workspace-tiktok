-- Run this in Supabase → SQL Editor once, before uploading the updated settings.html.
-- Replaces the flat tiktok_* columns on user_prefs with a proper multi-account table.

-- ── 1. New tiktok_accounts table ────────────────────────────────────────────
create table if not exists public.tiktok_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  tiktok_open_id text not null,
  username text default '',
  display_name text default '',
  avatar_url text default '',
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz,
  follower_count integer default 0,
  following_count integer default 0,
  likes_count integer default 0,
  video_count integer default 0,
  stats_updated_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, tiktok_open_id)
);

alter table public.tiktok_accounts enable row level security;

create policy "Users manage own tiktok accounts" on public.tiktok_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Index for fast per-user lookups
create index if not exists tiktok_accounts_user_id_idx
  on public.tiktok_accounts (user_id);

-- ── 2. Migrate any existing single-account data ──────────────────────────────
-- If you already ran tiktok-migration.sql and have connected accounts,
-- this copies each user's existing token into the new table before we drop
-- the old columns. Safe to run even if no one has connected yet.
insert into public.tiktok_accounts (
  user_id, tiktok_open_id, username, display_name,
  access_token, refresh_token, token_expires_at,
  follower_count, following_count, likes_count, video_count, stats_updated_at
)
select
  user_id,
  coalesce(tiktok_open_id, ''),
  coalesce(tiktok_username, ''),
  coalesce(tiktok_username, ''),
  coalesce(tiktok_access_token, ''),
  coalesce(tiktok_refresh_token, ''),
  tiktok_token_expires_at,
  coalesce(tiktok_follower_count, 0),
  coalesce(tiktok_following_count, 0),
  coalesce(tiktok_likes_count, 0),
  coalesce(tiktok_video_count, 0),
  tiktok_stats_updated_at
from public.user_prefs
where tiktok_connected = true
  and tiktok_open_id is not null
  and tiktok_open_id <> ''
  and tiktok_access_token is not null
  and tiktok_access_token <> ''
on conflict (user_id, tiktok_open_id) do nothing;

-- ── 3. Drop the old flat columns from user_prefs ─────────────────────────────
-- Comment these out if you want to keep them as a temporary backup.
alter table public.user_prefs drop column if exists tiktok_connected;
alter table public.user_prefs drop column if exists tiktok_open_id;
alter table public.user_prefs drop column if exists tiktok_username;
alter table public.user_prefs drop column if exists tiktok_access_token;
alter table public.user_prefs drop column if exists tiktok_refresh_token;
alter table public.user_prefs drop column if exists tiktok_token_expires_at;
alter table public.user_prefs drop column if exists tiktok_follower_count;
alter table public.user_prefs drop column if exists tiktok_following_count;
alter table public.user_prefs drop column if exists tiktok_likes_count;
alter table public.user_prefs drop column if exists tiktok_video_count;
alter table public.user_prefs drop column if exists tiktok_stats_updated_at;
