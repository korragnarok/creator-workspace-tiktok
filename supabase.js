// ─── Supabase Config ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mlsckxjksxmavzzhcdfs.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sc2NreGprc3htYXZ6emhjZGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTQzMzgsImV4cCI6MjA5NjE3MDMzOH0.tQpHwJcTraZjK8TUkeGbnUZWTAQ8cJ5TL6eZt0TSHT0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'auth.html';
    return null;
  }
  return session.user;
}

async function getUser() {
  const { data: { session } } = await db.auth.getSession();
  return session?.user || null;
}

async function signOut() {
  await db.auth.signOut();
  window.location.href = 'auth.html';
}

// ─── User Prefs (display name + Core 5) ──────────────────────────────────────
// Stored in Supabase user_prefs table, keyed by user_id.
// Falls back gracefully if the row doesn't exist yet.

async function loadUserPrefs(userId) {
  const { data } = await db.from('user_prefs')
    .select('display_name, core5')
    .eq('user_id', userId)
    .maybeSingle();
  return data || { display_name: null, core5: [] };
}

async function saveUserPrefs(userId, patch) {
  // patch = { display_name } or { core5 } or both
  await db.from('user_prefs')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
}

// ─── Display Name ─────────────────────────────────────────────────────────────

function _applyDisplayName(name) {
  document.querySelectorAll('.profile-name').forEach(el => el.textContent = name);
  document.querySelectorAll('.avatar').forEach(el => el.textContent = name.charAt(0).toUpperCase());
  const wt = document.getElementById('welcomeTitle');
  if (wt) wt.textContent = `welcome back, ${name}`;
}

function _emailFallbackName(email) {
  const raw = (email || 'Creator').split('@')[0].split(/[._-]/)[0] || 'Creator';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Call this on every inner page after requireAuth(). Handles name display
// and shows the name prompt modal on index.html if no name saved yet.
async function initDisplayName(user, prefs) {
  const name = prefs.display_name || _emailFallbackName(user.email);
  _applyDisplayName(name);
  // Show name-capture modal only on index.html (modal exists there)
  const modal = document.getElementById('nameModal');
  if (modal && !prefs.display_name) {
    modal.classList.add('open');
    setTimeout(() => document.getElementById('displayNameInput')?.focus(), 80);
  }
  return name;
}

// Called by the Save button inside the name modal (index.html)
async function saveDisplayName(userId) {
  const input = document.getElementById('displayNameInput');
  const name = input?.value.trim();
  if (!name) { input?.focus(); return; }
  await saveUserPrefs(userId, { display_name: name });
  _applyDisplayName(name);
  document.getElementById('nameModal')?.classList.remove('open');
}

// ─── Core 5 ──────────────────────────────────────────────────────────────────

function _updateCoreCount() {
  const count = Array.from(document.querySelectorAll('.core-mini-input'))
    .filter(i => i.value.trim()).length;
  const el = document.getElementById('coreCount');
  if (el) el.textContent = `${count}/5`;
}

async function initCore5(userId, prefs) {
  const values = Array.isArray(prefs.core5) ? prefs.core5 : [];
  let saveTimer = null;
  document.querySelectorAll('.core-mini-input').forEach(input => {
    input.value = values[Number(input.dataset.coreIndex)] || '';
    input.addEventListener('input', () => {
      _updateCoreCount();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const current = Array.from(document.querySelectorAll('.core-mini-input'))
          .map(i => i.value.trim());
        saveUserPrefs(userId, { core5: current });
      }, 600); // debounce 600ms so we don't spam on every keystroke
    });
  });
  _updateCoreCount();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'success') {
  let toast = document.getElementById('_toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '_toast';
    toast.style.cssText = `position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 20px;border-radius:100px;font-family:'Stack Sans Notch',sans-serif;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;z-index:9999;opacity:0;transition:opacity 0.2s;pointer-events:none;white-space:nowrap;`;
    document.body.appendChild(toast);
  }
  toast.style.background = type === 'error' ? 'var(--rust)' : 'var(--ink)';
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}
