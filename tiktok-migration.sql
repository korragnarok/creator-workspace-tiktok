-- Run this in Supabase → SQL Editor once, before uploading the updated pages.
-- Adds TikTok OAuth token storage + cached profile stats to user_prefs.
-- Tokens are protected by the same RLS policy already on user_prefs
-- ("Users manage own prefs" — auth.uid() = user_id), so this stays scoped
-- to each user's own row.

alter table public.user_prefs add column if not exists tiktok_connected boolean default false;
alter table public.user_prefs add column if not exists tiktok_open_id text default '';
alter table public.user_prefs add column if not exists tiktok_username text default '';
alter table public.user_prefs add column if not exists tiktok_access_token text default '';
alter table public.user_prefs add column if not exists tiktok_refresh_token text default '';
alter table public.user_prefs add column if not exists tiktok_token_expires_at timestamptz;
alter table public.user_prefs add column if not exists tiktok_follower_count integer default 0;
alter table public.user_prefs add column if not exists tiktok_following_count integer default 0;
alter table public.user_prefs add column if not exists tiktok_likes_count integer default 0;
alter table public.user_prefs add column if not exists tiktok_video_count integer default 0;
alter table public.user_prefs add column if not exists tiktok_stats_updated_at timestamptz;
