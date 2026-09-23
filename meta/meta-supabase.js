// ─── Take24 Meta — Supabase (same project + login as the TikTok side) ───────
const SUPABASE_URL = 'https://mlsckxjksxmavzzhcdfs.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sc2NreGprc3htYXZ6emhjZGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTQzMzgsImV4cCI6MjA5NjE3MDMzOH0.tQpHwJcTraZjK8TUkeGbnUZWTAQ8cJ5TL6eZt0TSHT0';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

async function requireMetaAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = '../auth.html'; return null; }
  try { localStorage.setItem('take24:workspace', 'meta'); } catch (e) {}
  return session.user;
}
function switchToTikTok() {
  try { localStorage.setItem('take24:workspace', 'tiktok'); } catch (e) {}
  window.location.href = '../index.html';
}
async function signOut() {
  await db.auth.signOut();
  window.location.href = '../auth.html';
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}));
}

// ─── Meta (Facebook + Instagram) ─────────────────────────────────────────
const META_APP_ID = '1569299174362194';          // public — safe to be in browser code
const META_WORKER_URL = 'https://take24-scout.kortnycall5.workers.dev';
const GRAPH = 'https://graph.facebook.com/v23.0';
const META_SCOPES = [
  'pages_show_list', 'pages_read_engagement', 'pages_read_user_content', 'read_insights',
  'business_management'
  // Instagram comes later: add 'instagram_basic', 'instagram_manage_insights' back here
  // once those permissions are enabled in the Meta app.
].join(',');

async function graph(path, token, params = {}) {
  const u = new URL(GRAPH + path);
  Object.entries({ ...params, access_token: token }).forEach(([k, v]) => u.searchParams.set(k, v));
  const res = await fetch(u);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}
async function graphAll(path, token, params = {}, max = 500) {
  let out = [], data = await graph(path, token, { limit: 50, ...params });
  out.push(...(data.data || []));
  while (data.paging?.next && out.length < max) {
    data = await (await fetch(data.paging.next)).json();
    if (data.error) break;
    out.push(...(data.data || []));
  }
  return out;
}
