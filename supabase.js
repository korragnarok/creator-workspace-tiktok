// ─── Supabase Config ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mlsckxjksxmavzzhcdfs.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sc2NreGprc3htYXZ6emhjZGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTQzMzgsImV4cCI6MjA5NjE3MDMzOH0.tQpHwJcTraZjK8TUkeGbnUZWTAQ8cJ5TL6eZt0TSHT0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

// Get current session user, redirect to auth if not logged in
async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'auth.html';
    return null;
  }
  return session.user;
}

// Get current user without redirect
async function getUser() {
  const { data: { session } } = await db.auth.getSession();
  return session?.user || null;
}

// Sign out
async function signOut() {
  await db.auth.signOut();
  window.location.href = 'auth.html';
}

// Show a toast message
function showToast(msg, type = 'success') {
  let toast = document.getElementById('_toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '_toast';
    toast.style.cssText = `position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 20px;border-radius:100px;font-family:'Stack Sans Notch',sans-serif;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;z-index:9999;opacity:0;transition:opacity 0.2s;pointer-events:none;white-space:nowrap;`;
    document.body.appendChild(toast);
  }
  if (type === 'error') toast.style.background = 'var(--rust)';
  else toast.style.background = 'var(--ink)';
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}
