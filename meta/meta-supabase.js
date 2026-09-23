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
