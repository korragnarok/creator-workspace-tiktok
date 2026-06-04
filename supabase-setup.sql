-- ─── CREATOR HUB — Supabase Setup ───────────────────────────────────────────
-- Run this entire script in Supabase SQL Editor once.

-- ── 1. SALES ────────────────────────────────────────────────────────────────
create table if not exists sales (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  units integer default 0,
  gmv numeric(10,2) default 0,
  comm numeric(10,2) default 0,
  note text default '',
  created_at timestamptz default now(),
  unique(user_id, date)
);
alter table sales enable row level security;
create policy "Users manage own sales" on sales for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2. PRODUCTS ─────────────────────────────────────────────────────────────
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  brand text default '',
  tags text default '',
  link text default '',
  status text default 'active',
  notes text default '',
  created_at timestamptz default now()
);
alter table products enable row level security;
create policy "Users manage own products" on products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 3. VIDEOS ───────────────────────────────────────────────────────────────
create table if not exists videos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  brand text default '',
  date date,
  status text default 'live',
  views integer default 0,
  units integer default 0,
  notes text default '',
  link text default '',
  created_at timestamptz default now()
);
alter table videos enable row level security;
create policy "Users manage own videos" on videos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 4. HOOKS ────────────────────────────────────────────────────────────────
create table if not exists hooks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  cat text default 'curiosity',
  created_at timestamptz default now()
);
alter table hooks enable row level security;
create policy "Users manage own hooks" on hooks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 5. SCRIPTS ──────────────────────────────────────────────────────────────
create table if not exists scripts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  brand text default '',
  cat text default 'review',
  script text not null,
  notes text default '',
  created_at timestamptz default now()
);
alter table scripts enable row level security;
create policy "Users manage own scripts" on scripts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 6. QUEUE (daily to-do) ──────────────────────────────────────────────────
create table if not exists queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  prod_id uuid,
  name text not null,
  brand text default '',
  notes text default '',
  done boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);
alter table queue enable row level security;
create policy "Users manage own queue" on queue for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 7. IDEAS ────────────────────────────────────────────────────────────────
create table if not exists ideas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  created_at timestamptz default now()
);
alter table ideas enable row level security;
create policy "Users manage own ideas" on ideas for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
