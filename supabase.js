// ─── Supabase Config ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mlsckxjksxmavzzhcdfs.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sc2NreGprc3htYXZ6emhjZGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTQzMzgsImV4cCI6MjA5NjE3MDMzOH0.tQpHwJcTraZjK8TUkeGbnUZWTAQ8cJ5TL6eZt0TSHT0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'auth.html'; return null; }
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

// ─── Themes ──────────────────────────────────────────────────────────────────

const THEMES = {
  dusk: {
    label: 'Dusk',
    swatch: ['#1C2130','#3D4F63','#D47878'],
    vars: {
      '--bg':          '#1C2130',
      '--bg-lift':     '#222A3A',
      '--surface':     '#273044',
      '--surface-2':   '#2E3A50',
      '--border':      'rgba(255,255,255,0.07)',
      '--border-mid':  'rgba(255,255,255,0.12)',
      '--text':        '#F2C4C4',
      '--text-mid':    '#8A96A8',
      '--text-muted':  '#5E6C80',
      '--ink':         '#F2E8E8',
      '--sage':        '#8A96A8',
      '--rose':        '#E8A0A0',
      '--rust':        '#D47878',
      '--tan':         '#8A96A8',
      '--sand':        '#2E3A50',
      '--shadow-sm':   '0 1px 4px rgba(0,0,0,0.3)',
      '--shadow-md':   '0 4px 20px rgba(0,0,0,0.4)',
    }
  },
  warm: {
    label: 'Warm',
    swatch: ['#F8F5F1','#7A816C','#AE6965'],
    vars: {
      '--bg':          '#F8F5F1',
      '--bg-lift':     '#FCFAF8',
      '--surface':     '#FCFAF8',
      '--surface-2':   '#EDE8E1',
      '--border':      'rgba(42,39,37,0.1)',
      '--border-mid':  'rgba(42,39,37,0.15)',
      '--text':        '#2A2725',
      '--text-mid':    '#7A816C',
      '--text-muted':  '#A58B71',
      '--ink':         '#2A2725',
      '--sage':        '#7A816C',
      '--rose':        '#D1A9A5',
      '--rust':        '#AE6965',
      '--tan':         '#A58B71',
      '--sand':        '#E5DFD6',
      '--shadow-sm':   '0 1px 4px rgba(42,39,37,0.07)',
      '--shadow-md':   '0 4px 20px rgba(42,39,37,0.09)',
    }
  },
  noir: {
    label: 'Noir',
    swatch: ['#1A1A1A','#607070','#D63C2A'],
    vars: {
      '--bg':          '#1A1A1A',
      '--bg-lift':     '#222222',
      '--surface':     '#2A2A2A',
      '--surface-2':   '#333333',
      '--border':      'rgba(255,255,255,0.07)',
      '--border-mid':  'rgba(255,255,255,0.12)',
      '--text':        '#E8E0D8',
      '--text-mid':    '#9A9490',
      '--text-muted':  '#6A6460',
      '--ink':         '#F0EBE5',
      '--sage':        '#607070',
      '--rose':        '#C0A898',
      '--rust':        '#D63C2A',
      '--tan':         '#9A9490',
      '--sand':        '#333333',
      '--shadow-sm':   '0 1px 4px rgba(0,0,0,0.4)',
      '--shadow-md':   '0 4px 20px rgba(0,0,0,0.5)',
    }
  },
  forest: {
    label: 'Forest',
    swatch: ['#F5F0E8','#2D5A3D','#A0522D'],
    vars: {
      '--bg':          '#F5F0E8',
      '--bg-lift':     '#FAF7F2',
      '--surface':     '#FAF7F2',
      '--surface-2':   '#EDE6D8',
      '--border':      'rgba(30,50,30,0.1)',
      '--border-mid':  'rgba(30,50,30,0.16)',
      '--text':        '#1E2820',
      '--text-mid':    '#4A6650',
      '--text-muted':  '#7A8A72',
      '--ink':         '#1E2820',
      '--sage':        '#2D5A3D',
      '--rose':        '#C8A878',
      '--rust':        '#A0522D',
      '--tan':         '#7A8A72',
      '--sand':        '#DDD4C0',
      '--shadow-sm':   '0 1px 4px rgba(30,50,30,0.07)',
      '--shadow-md':   '0 4px 20px rgba(30,50,30,0.1)',
    }
  }
};

const DEFAULT_THEME = 'dusk';

function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  // Mark active on any theme switcher dots present
  document.querySelectorAll('[data-theme]').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === themeKey);
  });
  // Store locally so next page load applies before Supabase responds
  try { localStorage.setItem('creatorHub:theme', themeKey); } catch(e) {}
}

// Call immediately on load using localStorage cache (no flash)
function applyThemeImmediate() {
  let saved = DEFAULT_THEME;
  try { saved = localStorage.getItem('creatorHub:theme') || DEFAULT_THEME; } catch(e) {}
  applyTheme(saved);
}
applyThemeImmediate();

// ─── User Prefs ───────────────────────────────────────────────────────────────

async function loadUserPrefs(userId) {
  const { data } = await db.from('user_prefs')
    .select('display_name, core5, theme')
    .eq('user_id', userId)
    .maybeSingle();
  if (data) return data;
  // First login — create the row so future saves have somewhere to upsert into
  await db.from('user_prefs').upsert(
    { user_id: userId, display_name: '', core5: [], theme: DEFAULT_THEME },
    { onConflict: 'user_id' }
  );
  return { display_name: null, core5: [], theme: DEFAULT_THEME };
}

async function saveUserPrefs(userId, patch) {
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

function _displayNameKey(userId) {
  return `creatorHub:displayName:${userId || 'local'}`;
}

function _cachedDisplayName(userId) {
  try { return (localStorage.getItem(_displayNameKey(userId)) || '').trim(); }
  catch(e) { return ''; }
}

async function initDisplayName(user, prefs) {
  const savedName = (prefs.display_name || '').trim() || _cachedDisplayName(user.id);
  const name = savedName || _emailFallbackName(user.email);
  _applyDisplayName(name);
  const modal = document.getElementById('nameModal');
  if (modal && !savedName) {
    modal.classList.add('open');
    setTimeout(() => document.getElementById('displayNameInput')?.focus(), 80);
  }
  return name;
}

async function saveDisplayName(userId) {
  const input = document.getElementById('displayNameInput');
  const name = (input?.value || '').trim();
  if (!name) { input?.focus(); return; }
  if (!userId) {
    const user = await getUser();
    userId = user?.id;
  }
  if (!userId) { input?.focus(); return; }
  try { localStorage.setItem(_displayNameKey(userId), name); } catch(e) {}
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
      }, 600);
    });
  });
  _updateCoreCount();
}

// ─── Profile Popover ─────────────────────────────────────────────────────────
// Injected into every page. Click avatar/profile name to open.

function initProfilePopover(userId) {
  // Build the popover element once
  if (document.getElementById('_profilePopover')) return;
  const pop = document.createElement('div');
  pop.id = '_profilePopover';
  pop.style.cssText = `
    display:none;position:fixed;z-index:800;
    background:var(--surface);border:1px solid var(--border-mid);
    border-radius:14px;box-shadow:var(--shadow-md);
    padding:8px;min-width:180px;
    font-family:'Stack Sans Notch',sans-serif;
  `;
  pop.innerHTML = `
    <a href="settings.html" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;color:var(--text);text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;transition:background 0.12s;" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''" >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      Settings
    </a>
    <div style="height:1px;background:var(--border);margin:4px 0;"></div>
    <button onclick="signOut()" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:8px;border:none;background:none;color:var(--rust);cursor:pointer;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-family:'Stack Sans Notch',sans-serif;transition:background 0.12s;" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Sign Out
    </button>
  `;
  document.body.appendChild(pop);

  // Close on outside click
  document.addEventListener('click', e => {
    if (!pop.contains(e.target) && !e.target.closest('.side-profile, .profile-trigger')) {
      pop.style.display = 'none';
    }
  });

  // Wire up all profile trigger elements
  function wireProfileTriggers() {
    document.querySelectorAll('.side-profile, .profile-trigger').forEach(el => {
      if (el.dataset.popoverWired) return;
      el.dataset.popoverWired = 'true';
      el.style.cursor = 'pointer';
      el.addEventListener('click', e => {
        e.stopPropagation();
        const rect = el.getBoundingClientRect();
        const isVisible = pop.style.display === 'block';
        pop.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
          // Position above or below depending on space
          const spaceBelow = window.innerHeight - rect.bottom;
          if (spaceBelow < 120) {
            pop.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
            pop.style.top = 'auto';
          } else {
            pop.style.top = (rect.bottom + 8) + 'px';
            pop.style.bottom = 'auto';
          }
          pop.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
        }
      });
    });
  }
  wireProfileTriggers();
  // Re-wire after any dynamic render
  const obs = new MutationObserver(wireProfileTriggers);
  obs.observe(document.body, { childList: true, subtree: true });
}

// ─── Init Theme from Prefs ────────────────────────────────────────────────────

async function initTheme(userId, prefs) {
  const themeKey = prefs.theme || DEFAULT_THEME;
  try { localStorage.setItem('creatorHub:theme', themeKey); } catch(e) {}
  applyTheme(themeKey);
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
