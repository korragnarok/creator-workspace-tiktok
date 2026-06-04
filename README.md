# Creator Hub — TikTok Shop Creator Workspace

A cloud-synced creator hub for TikTok Shop affiliates. Backed by Supabase — your data follows you across devices and browsers.

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Home — stats, 30-day commission/GMV chart, level ladder |
| `sales-calendar.html` | Log units sold, GMV, and commissions by day |
| `daily-todo.html` | Daily video queue — plan what to film, check off when done |
| `products.html` | Product database with talking points and units sold |
| `video-tracker.html` | Track posted videos and performance |
| `hooks.html` | Hook swipe file by category |
| `scripts.html` | Save and search scripts by product or brand |

## Setup

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full contents of `supabase-setup.sql`
3. Copy your project URL and anon key into `supabase.js`

### 2. Deploy
**Option A — GitHub Pages:**
1. Create a new GitHub repo named `creator-workspace-tiktok`
2. Upload all files
3. Go to Settings → Pages → Deploy from main branch
4. Your hub will be at `https://yourusername.github.io/creator-workspace-tiktok/`

**Option B — Anywhere:**
Drop the files on Netlify, Vercel, Cloudflare Pages, etc.

**Option C — Local:**
Open `index.html` directly in your browser. Auth redirects and magic links won't work locally, but everything else does.

## Auth
- Sign up with email + password, or use a **Magic Link** (one-click sign-in from your email)
- Each user's data is completely separate — RLS (Row Level Security) enforced in Supabase
- Sign out from any page via the nav

## Data storage

All data lives in **Supabase** — your account, your data:
- Works across all devices and browsers
- Display name and Core 5 brands sync automatically
- Clearing browser data won't affect anything

## Color Palette

| Variable | Hex |
|----------|-----|
| Background | `#F8F5F1` |
| Surface | `#FCFAF8` |
| Sage | `#7A816C` |
| Rose | `#D1A9A5` |
| Rust (accent) | `#AE6965` |
| Tan | `#A58B71` |
| Sand | `#E5DFD6` |
| Ink | `#2A2725` |
