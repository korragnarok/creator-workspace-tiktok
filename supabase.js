// ─── Supabase Config ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mlsckxjksxmavzzhcdfs.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sc2NreGprc3htYXZ6emhjZGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTQzMzgsImV4cCI6MjA5NjE3MDMzOH0.tQpHwJcTraZjK8TUkeGbnUZWTAQ8cJ5TL6eZt0TSHT0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);
const DEFAULT_STREAK_GOAL = 1;

function enterSaves(e, saveFn) {
  if (!e || e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return false;
  const target = e.target;
  if (!target || !target.matches?.('input, textarea, select')) return false;
  if (target.type === 'file' || target.type === 'checkbox' || target.type === 'radio') return false;
  e.preventDefault();
  if (typeof saveFn === 'function') saveFn();
  return true;
}

window.enterSaves = enterSaves;

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

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function queueCarryKey(row) {
  return [
    row.prod_id || '',
    String(row.name || '').trim().toLowerCase(),
    String(row.brand || '').trim().toLowerCase(),
    String(row.notes || '').trim().toLowerCase(),
    Number(row.sort_order) || 0
  ].join('|');
}

async function carryForwardUnfinishedQueue(userId, targetDate = localDateKey()) {
  if (!userId || !targetDate) return 0;
  const { data: overdue, error } = await db.from('queue')
    .select('id,prod_id,name,brand,notes,sort_order')
    .eq('user_id', userId)
    .eq('done', false)
    .lt('date', targetDate);
  if (error || !overdue?.length) return 0;

  const { data: todayRows } = await db.from('queue')
    .select('prod_id,name,brand,notes,sort_order')
    .eq('user_id', userId)
    .eq('date', targetDate);
  const existing = new Set((todayRows || []).map(queueCarryKey));
  const toMove = [];
  const duplicateIds = [];

  overdue.forEach(row => {
    const key = queueCarryKey(row);
    if (existing.has(key)) duplicateIds.push(row.id);
    else {
      existing.add(key);
      toMove.push(row.id);
    }
  });

  if (toMove.length) {
    await db.from('queue').update({ date: targetDate, done: false }).in('id', toMove).eq('user_id', userId);
  }
  if (duplicateIds.length) {
    await db.from('queue').delete().in('id', duplicateIds).eq('user_id', userId);
  }
  return toMove.length;
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
const DEFAULT_PROFILE_ICON = 'avatar';
const THEME_ICON_NAMES = new Set(['home','todo','video','videos','hooks','products','scripts','sales','gmv','commissions','comission','comissions','commissins']);
const THEME_ICON_FILES = {
  dusk: { video:'video.png', videos:'video.png', commissions:'commissions.png', comission:'commissions.png', comissions:'commissions.png', commissins:'commissions.png' },
  warm: { video:'videos.png', videos:'videos.png', commissions:'commissions.png', comission:'commissions.png', comissions:'commissions.png', commissins:'commissions.png' },
  noir: { video:'video.png', videos:'video.png', commissions:'comissions.png', comission:'comissions.png', comissions:'comissions.png', commissins:'comissions.png' },
  forest: { video:'video.png', videos:'video.png', commissions:'commissins.png', comission:'commissins.png', comissions:'commissins.png', commissins:'commissins.png' }
};
const PROFILE_ICONS = [
  { key: 'avatar', label: 'Default', src: 'icons/users/avatar.png' }
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
  root.dataset.theme = resolvedKey;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.vars['--bg']);
  applyThemeIcons(resolvedKey);
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

function _themeIconNameFromSrc(src) {
  const match = String(src || '').match(/(?:^|\/)icons\/(?:(dusk|warm|noir|forest)\/)?([^/?#]+)\.png(?:[?#].*)?$/i);
  if (!match) return '';
  const raw = match[2].toLowerCase();
  if (raw === 'videos') return 'video';
  if (raw === 'comission' || raw === 'comissions' || raw === 'commissins') return 'commissions';
  return THEME_ICON_NAMES.has(raw) ? raw : '';
}

function _themeIconSrc(themeKey, iconName) {
  const normalized = iconName === 'videos' ? 'video' : iconName;
  const aliases = THEME_ICON_FILES[themeKey] || {};
  const file = aliases[normalized] || `${normalized}.png`;
  return `icons/${themeKey}/${file}`;
}

function applyThemeIcons(themeKey) {
  const resolvedKey = THEMES[themeKey] ? themeKey : DEFAULT_THEME;
  document.querySelectorAll('img').forEach(img => {
    if (img.closest('.avatar, .tab-profile-avatar, .icon-choice')) return;
    const iconName = img.dataset.iconName || _themeIconNameFromSrc(img.getAttribute('src'));
    if (!iconName || !THEME_ICON_NAMES.has(iconName)) return;
    img.dataset.iconName = iconName === 'videos' ? 'video' : iconName;
    img.dataset.themeIcon = 'true';
    img.src = _themeIconSrc(resolvedKey, img.dataset.iconName);
  });
}

document.addEventListener('DOMContentLoaded', () => applyThemeIcons(_cachedTheme() || DEFAULT_THEME));

// ─── User Prefs ───────────────────────────────────────────────────────────────

async function loadUserPrefs(userId) {
  const theme = _cachedTheme() || DEFAULT_THEME;
  const { data, error } = await db.from('user_prefs')
    .select('*')
    .eq('user_id', userId);
  if (error) console.warn('Preference load failed', error);
  const rows = data || [];
  if (rows.length) {
    const merged = {
      display_name: '',
      core5: [],
      theme,
      profile_icon: '',
      streak_goal: _cachedStreakGoal(userId),
      _isNewPrefs: false
    };
    rows.forEach(row => {
      if ((row.display_name || '').trim()) merged.display_name = row.display_name;
      if (Array.isArray(row.core5) && row.core5.some(value => String(value || '').trim())) merged.core5 = row.core5;
      if (THEMES[row.theme]) merged.theme = row.theme;
      if (row.profile_icon) merged.profile_icon = row.profile_icon;
      merged.streak_goal = _normalizeStreakGoal(row.streak_goal, merged.streak_goal);
    });
    return { ...merged, core5: _resolveCore5(userId, merged.core5) };
  }
  const cachedCore5 = _cachedCore5(userId);
  const streakGoal = _cachedStreakGoal(userId);
  await saveUserPrefs(userId, { display_name: '', core5: cachedCore5, theme, streak_goal: streakGoal });
  return { display_name: null, core5: cachedCore5, theme, profile_icon: _cachedAvatarUrl(userId) || _cachedProfileIcon(userId), streak_goal: streakGoal, _isNewPrefs: true };
}

async function saveUserPrefs(userId, patch) {
  if (!userId) return { error: new Error('Missing user id') };
  const cleanPatch = { ...patch };
  if ('core5' in cleanPatch) cleanPatch.core5 = _normalizeCore5(cleanPatch.core5);
  if ('streak_goal' in cleanPatch) cleanPatch.streak_goal = _normalizeStreakGoal(cleanPatch.streak_goal);
  const { data: updated, error: updateError } = await db.from('user_prefs')
    .update(cleanPatch)
    .eq('user_id', userId)
    .select('user_id');
  if (updateError) {
    console.warn('Preference update failed', updateError);
    return { error: updateError };
  }
  if (updated && updated.length) return { error: null };
  const { error: insertError } = await db.from('user_prefs')
    .insert({ user_id: userId, display_name: '', core5: [], theme: _cachedTheme() || DEFAULT_THEME, ...cleanPatch });
  if (insertError) console.warn('Preference insert failed', insertError);
  return { error: insertError || null };
}

function _streakGoalKey(userId) {
  return `creatorHub:streakGoal:${userId || 'local'}`;
}

function _normalizeStreakGoal(value, fallback = DEFAULT_STREAK_GOAL) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(50, Math.max(1, parsed));
}

function _hasStreakGoalValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function _cachedStreakGoal(userId) {
  try { return _normalizeStreakGoal(localStorage.getItem(_streakGoalKey(userId))); }
  catch(e) { return DEFAULT_STREAK_GOAL; }
}

function _metadataStreakGoal(user) {
  return _normalizeStreakGoal(user?.user_metadata?.streak_goal);
}

function resolveStreakGoal(user, prefs) {
  if (_hasStreakGoalValue(user?.user_metadata?.streak_goal)) return _normalizeStreakGoal(user.user_metadata.streak_goal);
  if (_hasStreakGoalValue(prefs?.streak_goal)) return _normalizeStreakGoal(prefs.streak_goal);
  return _cachedStreakGoal(user?.id);
}

async function saveStreakGoal(userId, value) {
  const goal = _normalizeStreakGoal(value);
  try { localStorage.setItem(_streakGoalKey(userId), String(goal)); } catch(e) {}
  const { error } = await saveUserPrefs(userId, { streak_goal: goal });
  try { await db.auth.updateUser({ data: { streak_goal: goal } }); } catch(e) {}
  return { goal, error };
}

// ─── Display Name ─────────────────────────────────────────────────────────────

function _applyDisplayName(name) {
  document.querySelectorAll('.profile-name').forEach(el => el.textContent = name);
  document.querySelectorAll('.avatar').forEach(el => {
    if (!el.querySelector('.avatar-img')) el.textContent = name.charAt(0).toUpperCase();
  });
  const wt = document.getElementById('welcomeTitle');
  if (wt) wt.textContent = `welcome back, ${name} 👋`;
}

function _profileIconByKey(key) {
  return PROFILE_ICONS.find(icon => icon.key === key) || PROFILE_ICONS[0];
}

function _isProfileImageSrc(value) {
  return /^(https?:|data:image\/|blob:)/i.test(String(value || ''));
}

function _avatarUrlKey(userId) {
  return `creatorHub:avatarUrl:${userId || 'local'}`;
}

function _cachedAvatarUrl(userId) {
  try { return localStorage.getItem(_avatarUrlKey(userId)) || ''; }
  catch(e) { return ''; }
}

function _cacheAvatarUrl(userId, url) {
  try { localStorage.setItem(_avatarUrlKey(userId), url); } catch(e) {}
}

function _profileIconCacheKey(userId) {
  return `creatorHub:profileIcon:${userId || 'local'}`;
}

function _cachedProfileIcon(userId) {
  try {
    const saved = localStorage.getItem(_profileIconCacheKey(userId)) || '';
    if (_isProfileImageSrc(saved)) return saved;
    return PROFILE_ICONS.some(icon => icon.key === saved) ? saved : '';
  } catch(e) { return ''; }
}

function _resolveProfileIcon(user, prefs) {
  const prefIcon = prefs?.profile_icon || '';
  const metaIcon = _metadataProfileIcon(user);
  const cachedAvatar = _cachedAvatarUrl(user?.id);
  const cachedIcon = _cachedProfileIcon(user?.id);
  const imageCandidates = [prefIcon, metaIcon, cachedAvatar, cachedIcon];
  const imageIcon = imageCandidates.find(value => _isProfileImageSrc(value));
  if (imageIcon) return imageIcon;
  const presetCandidates = [prefIcon, metaIcon, cachedIcon, DEFAULT_PROFILE_ICON];
  return presetCandidates.find(value => String(value || '').trim()) || DEFAULT_PROFILE_ICON;
}

function applyProfileIcon(key) {
  if (_isProfileImageSrc(key)) {
    document.querySelectorAll('.avatar-img').forEach(img => {
      img.src = key;
      img.alt = 'Profile photo';
    });
    document.querySelectorAll('[data-profile-icon]').forEach(el => el.classList.remove('active'));
    return key;
  }
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
  if (_isProfileImageSrc(iconKey)) _cacheAvatarUrl(userId, iconKey);
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

function _metadataDisplayName(user) {
  return String(user?.user_metadata?.display_name || '').trim();
}

function _metadataProfileIcon(user) {
  return String(user?.user_metadata?.profile_icon || '').trim();
}

function _metadataTheme(user) {
  const theme = String(user?.user_metadata?.theme || '').trim();
  return THEMES[theme] ? theme : '';
}

function _isFreshSignup(user) {
  const created = Date.parse(user?.created_at || '');
  if (!created) return false;
  return Date.now() - created < 30 * 60 * 1000;
}

async function initDisplayName(user, prefs) {
  const savedName = (prefs.display_name || '').trim() || _metadataDisplayName(user) || _cachedDisplayName(user.id);
  const name = savedName || _emailFallbackName(user.email);
  _applyDisplayName(name);
  applyProfileIcon(_resolveProfileIcon(user, prefs));
  const modal = document.getElementById('nameModal');
  if (modal && !savedName && prefs._isNewPrefs && _isFreshSignup(user)) {
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
  const { error } = await saveUserPrefs(userId, { display_name: name });
  const { error: metaError } = await db.auth.updateUser({ data: { display_name: name } });
  _applyDisplayName(name);
  document.getElementById('nameModal')?.classList.remove('open');
  if (error && metaError) showToast('Name saved on this browser only', 'error');
}

// ─── Core 5 ──────────────────────────────────────────────────────────────────

function _core5Key(userId) {
  return `creatorHub:core5:${userId || 'local'}`;
}

function _normalizeCore5(values) {
  const arr = Array.isArray(values) ? values : [];
  return Array.from({ length: 7 }, (_, i) => String(arr[i] || '').trim());
}

function _cachedCore5(userId) {
  try {
    return _normalizeCore5(JSON.parse(localStorage.getItem(_core5Key(userId)) || '[]'));
  } catch(e) { return []; }
}

function _metadataCore5(user) {
  return _normalizeCore5(user?.user_metadata?.core5);
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
  const el = document.getElementById('coreCount');
  if (!el) return;
  const items = document.querySelectorAll('.core-pill');
  const count = Array.from(items).filter(p => p.dataset.value).length;
  el.textContent = `${count}/7`;
}

function _renderCore5Pills(values) {
  document.querySelectorAll('.core-mini-item').forEach((item, i) => {
    const val = values[i] || '';
    const href = `products.html?brand=${encodeURIComponent(val)}`;
    if (val) {
      item.style.display = '';
      item.innerHTML = `<div class="core-pill" data-value="${val.replace(/"/g,'&quot;')}" title="View ${val} products" onclick="window.location.href='${href.replace(/'/g,"\'")}'">
          <span class="core-pill-text">${val}</span>
         </div>`;
    } else {
      item.style.display = 'none';
      item.innerHTML = '';
    }
  });
  _updateCoreCount();
}

async function initCore5(userId, prefs) {
  const user = await getUser();
  const prefValues = _normalizeCore5(prefs.core5);
  const metaValues = _metadataCore5(user);
  const cachedValues = _cachedCore5(userId);
  const values = metaValues.some(Boolean)
    ? metaValues
    : (prefValues.some(Boolean) ? prefValues : cachedValues);
  _cacheCore5(userId, values);
  _renderCore5Pills(values);
  if (userId && JSON.stringify(prefValues) !== JSON.stringify(values)) {
    await saveUserPrefs(userId, { core5: values });
  }
  if (userId && JSON.stringify(metaValues) !== JSON.stringify(values)) {
    await db.auth.updateUser({ data: { core5: values } });
  }

  // Add edit button to sidebar head if not already there
  const head = document.querySelector('.core-sidebar-head');
  if (head && !head.querySelector('.core5-edit-btn')) {
    const btn = document.createElement('button');
    btn.className = 'core5-edit-btn';
    btn.textContent = 'Edit';
    btn.style.cssText = 'background:none;border:none;font-family:"Stack Sans Notch",sans-serif;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--rust);cursor:pointer;padding:2px 6px;border-radius:4px;transition:background 0.12s;';
    btn.onmouseover = () => btn.style.background = 'color-mix(in srgb,var(--rust) 15%,transparent)';
    btn.onmouseout  = () => btn.style.background = 'none';
    btn.onclick = () => openCore5Modal();
    head.appendChild(btn);
  }

  // Build and inject Core 5 modal into body (once)
  if (!document.getElementById('_core5Modal')) {
    const overlay = document.createElement('div');
    overlay.id = '_core5Modal';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:600;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px);';
    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:16px;border:1px solid var(--border-mid);padding:24px;width:100%;max-width:420px;box-shadow:0 8px 40px rgba(0,0,0,0.3);">
        <div style="font-family:'IBM Plex Serif',serif;font-size:22px;font-weight:700;color:var(--ink);margin-bottom:4px;">Edit Hero Brands</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:18px;">Your top 5 products. Click any filled slot on the sidebar to go to that product.</div>
        <div id="_core5Inputs" style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;"></div>
        <div style="display:flex;gap:8px;">
          <button onclick="closeCore5Modal()" style="flex:1;padding:11px;border-radius:8px;border:1px solid var(--border-mid);background:transparent;color:var(--text-mid);font-family:'Stack Sans Notch',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;">Cancel</button>
          <button onclick="saveCore5Modal()" style="flex:2;padding:11px;border-radius:8px;border:none;background:var(--rust);color:#fff;font-family:'Stack Sans Notch',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;">Save</button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeCore5Modal(); });
    document.body.appendChild(overlay);
  }

  // Store userId on window for modal use
  window._core5UserId = userId;
}

function openCore5Modal() {
  const modal = document.getElementById('_core5Modal');
  if (!modal) return;
  const values = _cachedCore5(window._core5UserId);
  const container = document.getElementById('_core5Inputs');
  container.innerHTML = [0,1,2,3,4,5,6].map(i => `
    <div style="display:flex;gap:8px;align-items:center;">
      <span style="font-family:'Noto Sans Mono',sans-serif;font-size:11px;font-weight:800;color:var(--rust);width:16px;flex-shrink:0;">${i+1}</span>
      <input id="_c5input${i}" type="text" value="${(values[i]||'').replace(/"/g,'&quot;')}"
        placeholder="Brand name"
        style="flex:1;padding:9px 12px;border:1px solid var(--border-mid);border-radius:8px;background:var(--bg);color:var(--text);font-size:13px;font-family:'IBM Plex Serif',serif;outline:none;transition:border-color 0.15s;"
        onfocus="this.style.borderColor='var(--rust)'" onblur="this.style.borderColor='var(--border-mid)'"
        onkeydown="enterSaves(event, saveCore5Modal)">
      <button onclick="document.getElementById('_c5input${i}').value=''" title="Clear"
        style="background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer;padding:4px;line-height:1;transition:color 0.12s;"
        onmouseover="this.style.color='#c83c32'" onmouseout="this.style.color='var(--text-muted)'">×</button>
    </div>`).join('');
  modal.style.display = 'flex';
  document.getElementById('_c5input0')?.focus();
}

function closeCore5Modal() {
  const modal = document.getElementById('_core5Modal');
  if (modal) modal.style.display = 'none';
}

async function saveCore5Modal() {
  const userId = window._core5UserId;
  const values = [0,1,2,3,4,5,6].map(i => (document.getElementById(`_c5input${i}`)?.value || '').trim());
  _cacheCore5(userId, values);
  _renderCore5Pills(values);
  closeCore5Modal();
  const { error } = await saveUserPrefs(userId, { core5: values });
  const { error: metaError } = await db.auth.updateUser({ data: { core5: values } });
  showToast(error && metaError ? 'Hero Brands saved locally' : 'Hero Brands saved', error && metaError ? 'error' : 'success');
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
  const user = await getUser();
  const metaTheme = _metadataTheme(user);
  const cachedTheme = _cachedTheme();
  const prefTheme = THEMES[prefs.theme] ? prefs.theme : '';
  const themeKey = metaTheme || prefTheme || cachedTheme || DEFAULT_THEME;
  try { localStorage.setItem('creatorHub:theme', themeKey); } catch(e) {}
  applyTheme(themeKey);
  if (userId && prefs.theme !== themeKey) await saveUserPrefs(userId, { theme: themeKey });
  if (userId && metaTheme !== themeKey) await db.auth.updateUser({ data: { theme: themeKey } });
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
