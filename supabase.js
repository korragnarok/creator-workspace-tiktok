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
    swatch: ['#2A1822','#5A2E42','#E17788'],
    vars: {
      '--bg':          '#2A1822',
      '--bg-lift':     '#341D2A',
      '--surface':     '#3C2431',
      '--surface-2':   '#4A2B3B',
      '--border':      'rgba(255,210,220,0.08)',
      '--border-mid':  'rgba(255,210,220,0.14)',
      '--text':        '#F3C7D0',
      '--text-mid':    '#B98A9A',
      '--text-muted':  '#8B6674',
      '--ink':         '#FFF0F3',
      '--sage':        '#A78C93',
      '--rose':        '#F0A8B6',
      '--rust':        '#E17788',
      '--tan':         '#C79CA7',
      '--sand':        '#4A2B3B',
      '--shadow-sm':   '0 1px 4px rgba(0,0,0,0.32)',
      '--shadow-md':   '0 4px 20px rgba(0,0,0,0.42)',
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
    swatch: ['#2B1F18','#F5F0E8','#6F8F6B'],
    vars: {
      '--bg':          '#2B1F18',
      '--bg-lift':     '#34261D',
      '--surface':     '#3C2C22',
      '--surface-2':   '#493529',
      '--border':      'rgba(245,240,232,0.09)',
      '--border-mid':  'rgba(245,240,232,0.15)',
      '--text':        '#F5F0E8',
      '--text-mid':    '#CBBDAA',
      '--text-muted':  '#9B8A78',
      '--ink':         '#FFF7EC',
      '--sage':        '#6F8F6B',
      '--rose':        '#C8A878',
      '--rust':        '#E9D7BE',
      '--tan':         '#F5F0E8',
      '--sand':        '#493529',
      '--shadow-sm':   '0 1px 4px rgba(0,0,0,0.26)',
      '--shadow-md':   '0 4px 20px rgba(0,0,0,0.36)',
    }
  }
};

const DEFAULT_THEME = 'dusk';
const DEFAULT_PROFILE_ICON = 'icon-1';
const PROFILE_ICONS = [
  { key: 'icon-1', label: 'Icon 1', src: 'icons/users/icon-1.png' },
  { key: 'icon-2', label: 'Icon 2', src: 'icons/users/icon-2.png' },
  { key: 'icon-3', label: 'Icon 3', src: 'icons/users/icon-3.png' },
  { key: 'icon-4', label: 'Icon 4', src: 'icons/users/icon-4.png' },
  { key: 'icon-5', label: 'Icon 5', src: 'icons/users/icon-5.png' },
  { key: 'icon-6', label: 'Icon 6', src: 'icons/users/icon-6.png' }
];

function _cachedTheme() {
  try {
    const saved = localStorage.getItem('creatorHub:theme') || '';
    return THEMES[saved] ? saved : '';
  } catch(e) { return ''; }
}

function applyTheme(themeKey) {
  const resolvedKey = THEMES[themeKey] ? themeKey : DEFAULT_THEME;
  const theme = THEMES[resolvedKey];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  // Mark active on any theme switcher dots present
  document.querySelectorAll('[data-theme]').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === resolvedKey);
  });
  // Store locally so next page load applies before Supabase responds
  try { localStorage.setItem('creatorHub:theme', resolvedKey); } catch(e) {}
  window.dispatchEvent(new CustomEvent('creator-theme-change', { detail: { theme: resolvedKey } }));
}

// Call immediately on load using localStorage cache (no flash)
function applyThemeImmediate() {
  let saved = DEFAULT_THEME;
  saved = _cachedTheme() || DEFAULT_THEME;
  applyTheme(saved);
}
applyThemeImmediate();

// ─── User Prefs ───────────────────────────────────────────────────────────────

async function loadUserPrefs(userId) {
  const theme = _cachedTheme() || DEFAULT_THEME;
  const { data } = await db.from('user_prefs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (data) return {
    ...data,
    core5: _resolveCore5(userId, data.core5),
    profile_icon: data.profile_icon || _cachedProfileIcon(userId)
  };
  // First login — create the row so future saves have somewhere to upsert into
  await db.from('user_prefs').upsert(
    { user_id: userId, display_name: '', core5: [], theme },
    { onConflict: 'user_id' }
  );
  return { display_name: null, core5: _cachedCore5(userId), theme, profile_icon: _cachedProfileIcon(userId) };
}

async function saveUserPrefs(userId, patch) {
  const { error } = await db.from('user_prefs')
    .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' });
  if (error) console.warn('Preference save failed', error);
  return { error };
}

// ─── Display Name ─────────────────────────────────────────────────────────────

function _applyDisplayName(name) {
  document.querySelectorAll('.profile-name').forEach(el => el.textContent = name);
  document.querySelectorAll('.avatar').forEach(el => {
    if (!el.querySelector('.avatar-img')) el.textContent = name.charAt(0).toUpperCase();
  });
  const wt = document.getElementById('welcomeTitle');
  if (wt) wt.textContent = `welcome back, ${name}`;
}

function _profileIconByKey(key) {
  return PROFILE_ICONS.find(icon => icon.key === key) || PROFILE_ICONS[0];
}

function _profileIconCacheKey(userId) {
  return `creatorHub:profileIcon:${userId || 'local'}`;
}

function _cachedProfileIcon(userId) {
  try {
    const saved = localStorage.getItem(_profileIconCacheKey(userId)) || DEFAULT_PROFILE_ICON;
    return PROFILE_ICONS.some(icon => icon.key === saved) ? saved : DEFAULT_PROFILE_ICON;
  } catch(e) { return DEFAULT_PROFILE_ICON; }
}

function applyProfileIcon(key) {
  const icon = _profileIconByKey(key);
  document.querySelectorAll('.avatar-img').forEach(img => {
    img.src = icon.src;
    img.alt = icon.label;
  });
  document.querySelectorAll('[data-profile-icon]').forEach(el => {
    el.classList.toggle('active', el.dataset.profileIcon === icon.key);
  });
  return icon.key;
}

async function saveProfileIcon(userId, key) {
  const iconKey = applyProfileIcon(key);
  try { localStorage.setItem(_profileIconCacheKey(userId), iconKey); } catch(e) {}
  if (userId) {
    try { await saveUserPrefs(userId, { profile_icon: iconKey }); } catch(e) {}
  }
  return iconKey;
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
  applyProfileIcon(prefs.profile_icon || DEFAULT_PROFILE_ICON);
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

function _core5Key(userId) {
  return `creatorHub:core5:${userId || 'local'}`;
}

function _normalizeCore5(values) {
  const arr = Array.isArray(values) ? values : [];
  return Array.from({ length: 5 }, (_, i) => String(arr[i] || '').trim());
}

function _cachedCore5(userId) {
  try {
    return _normalizeCore5(JSON.parse(localStorage.getItem(_core5Key(userId)) || '[]'));
  } catch(e) { return []; }
}

function _cacheCore5(userId, values) {
  try { localStorage.setItem(_core5Key(userId), JSON.stringify(_normalizeCore5(values))); } catch(e) {}
}

function _resolveCore5(userId, savedValues) {
  const saved = _normalizeCore5(savedValues);
  const cached = _cachedCore5(userId);
  return saved.some(Boolean) ? saved : cached;
}

function _updateCoreCount() {
  const count = Array.from(document.querySelectorAll('.core-mini-input'))
    .filter(i => i.value.trim()).length;
  const el = document.getElementById('coreCount');
  if (el) el.textContent = `${count}/5`;
}

async function initCore5(userId, prefs) {
  const values = _resolveCore5(userId, prefs.core5);
  _cacheCore5(userId, values);
  let saveTimer = null;
  let latestValues = values;
  async function persistCore5(valuesToSave) {
    latestValues = _normalizeCore5(valuesToSave);
    _cacheCore5(userId, latestValues);
    const { error } = await saveUserPrefs(userId, { core5: latestValues });
    if (error) console.warn('Core 5 save failed; using local cache', error);
  }
  document.querySelectorAll('.core-mini-input').forEach(input => {
    input.value = values[Number(input.dataset.coreIndex)] || '';
    input.addEventListener('input', () => {
      _updateCoreCount();
      latestValues = Array.from(document.querySelectorAll('.core-mini-input'))
        .map(i => i.value.trim());
      _cacheCore5(userId, latestValues);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => persistCore5(latestValues), 500);
    });
    input.addEventListener('blur', () => {
      clearTimeout(saveTimer);
      persistCore5(latestValues);
    });
  });
  window.addEventListener('beforeunload', () => _cacheCore5(userId, latestValues));
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
  const themeKey = _cachedTheme() || prefs.theme || DEFAULT_THEME;
  try { localStorage.setItem('creatorHub:theme', themeKey); } catch(e) {}
  applyTheme(themeKey);
  if (userId && prefs.theme !== themeKey) await saveUserPrefs(userId, { theme: themeKey });
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
