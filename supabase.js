// ─── Supabase Config ─────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mlsckxjksxmavzzhcdfs.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sc2NreGprc3htYXZ6emhjZGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTQzMzgsImV4cCI6MjA5NjE3MDMzOH0.tQpHwJcTraZjK8TUkeGbnUZWTAQ8cJ5TL6eZt0TSHT0';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);
const DEFAULT_STREAK_GOAL = 1;
const DEFAULT_AI_TONE = 'Realistic and conversational, with lazy mom energy. Not extremely salesy, not too bubbly or upbeat. Sound like a normal person talking through what works and why.';

function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(e => console.warn('SW:', e));
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const key = 'creatorHub:swReloaded';
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch(e) {}
    console.info('Creator Hub updated in the background. Refresh when you are ready to load the newest cached files.');
  });
}

registerAppServiceWorker();

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
    row.tiktok_account_id || '',
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
    .select('id,prod_id,name,brand,notes,sort_order,done,tiktok_account_id')
    .eq('user_id', userId)
    .eq('done', false)
    .lt('date', targetDate);
  if (error || !overdue?.length) return 0;

  const { data: todayRows } = await db.from('queue')
    .select('id,prod_id,name,brand,notes,sort_order,done,tiktok_account_id')
    .eq('user_id', userId)
    .eq('date', targetDate);
  const existing = new Map((todayRows || []).map(row => [queueCarryKey(row), row]));
  const toMove = [];
  const duplicateIds = [];
  const doneDuplicateIds = [];

  overdue.forEach(row => {
    const key = queueCarryKey(row);
    const existingRow = existing.get(key);
    if (existingRow) {
      duplicateIds.push(row.id);
      if (row.done && !existingRow.done) doneDuplicateIds.push(existingRow.id);
    }
    else {
      existing.set(key, row);
      toMove.push(row.id);
    }
  });

  if (toMove.length) {
    await db.from('queue').update({ date: targetDate }).in('id', toMove).eq('user_id', userId);
  }
  if (doneDuplicateIds.length) {
    await db.from('queue').update({ done: true }).in('id', doneDuplicateIds).eq('user_id', userId);
  }
  if (duplicateIds.length) {
    await db.from('queue').delete().in('id', duplicateIds).eq('user_id', userId);
  }
  return toMove.length;
}

// ─── Themes ──────────────────────────────────────────────────────────────────

const THEMES = {
  grove: {
    label: 'Grove',
    swatch: ['#E3DCD2','#F0EBE3','#3D2314'],
    vars: {
      '--bg':          '#E3DCD2',
      '--bg-lift':     '#F5F0E8',
      '--surface':     '#F0EBE3',
      '--surface-2':   '#C8BFB0',
      '--border':      'rgba(1,51,40,0.1)',
      '--border-mid':  'rgba(1,51,40,0.16)',
      '--text':        '#2A2420',
      '--text-mid':    '#5A4A3A',
      '--text-muted':  '#7A6B54',
      '--ink':         '#1A1410',
      '--sage':        '#CC8B65',
      '--rose':        '#CC8B65',
      '--rust':        '#013328',
      '--tan':         '#CC8B65',
      '--sand':        '#013328',
      '--shadow-sm':   '0 1px 4px rgba(1,51,40,0.08)',
      '--shadow-md':   '0 4px 20px rgba(1,51,40,0.12)',
    }
  },
  // Rust · tan · charcoal · black — matches the Meta side
  espresso: {
    label: 'Espresso',
    swatch: ['#1F1F1E','#373635','#955B3B','#C4A083'],
    vars: {
      '--bg':          '#1F1F1E',
      '--bg-lift':     '#262524',
      '--surface':     '#2B2A29',
      '--surface-2':   '#373635',
      '--border':      'rgba(196,160,131,0.12)',
      '--border-mid':  'rgba(196,160,131,0.20)',
      '--text':        '#EDE3D8',
      '--text-mid':    '#C4A083',
      '--text-muted':  '#A08D7C',
      '--ink':         '#F3EADF',
      '--sage':        '#C4A083',
      '--rose':        '#C4A083',
      '--rust':        '#955B3B',
      '--tan':         '#C4A083',
      '--sand':        '#373635',
      '--shadow-sm':   '0 1px 4px rgba(0,0,0,0.35)',
      '--shadow-md':   '0 10px 30px rgba(0,0,0,0.35)',
    }
  }
};
// Themes without their own icon folder borrow one.
const THEME_ICON_FOLDER = { espresso: 'dusk' };

const DEFAULT_THEME = 'espresso';
const DEFAULT_PROFILE_ICON = 'avatar';
const THEME_ICON_NAMES = new Set(['home','todo','video','videos','hooks','products','scripts','sales','gmv','commissions','comission','comissions','commissins','move-up','move-down','duplicate','delete','workshop']);
const THEME_ICON_FILES = {
  grove: { video:'video.png', videos:'video.png', commissions:'commissions.png', comission:'commissions.png', comissions:'commissions.png', commissins:'commissions.png' }
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


// ── Grove theme CSS overrides ─────────────────────────────────────────────────
const GROVE_STYLE_ID = 'grove-theme-overrides';

function _injectGroveStyle() {
  if (document.getElementById(GROVE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = GROVE_STYLE_ID;
  style.textContent = `
    /* Sidebar strip — dark green only */
    [data-theme="grove"] .desktop-sidebar.sidebar {
      background: #3D2314 !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .side-link {
      color: rgba(245,240,232,0.65) !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .side-link:hover {
      background: rgba(245,240,232,0.07) !important;
      color: #F5F0E8 !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .side-link.active {
      background: rgba(204,139,101,0.18) !important;
      color: #CC8B65 !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .nav-icon {
      background: rgba(245,240,232,0.07) !important;
      border-color: rgba(245,240,232,0.1) !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .core-sidebar {
      background: rgba(245,240,232,0.05) !important;
      border-color: rgba(245,240,232,0.1) !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .core-sidebar-head {
      color: #CC8B65 !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .core-pill {
      background: rgba(245,240,232,0.07) !important;
      border-color: rgba(245,240,232,0.14) !important;
      color: #F5F0E8 !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .core-pill-text {
      color: #F5F0E8 !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .core-pill-empty .core-pill-text {
      color: rgba(245,240,232,0.35) !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .side-profile {
      background: rgba(245,240,232,0.05) !important;
      border-color: rgba(245,240,232,0.1) !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .profile-name {
      color: #F5F0E8 !important;
    }
    [data-theme="grove"] .desktop-sidebar.sidebar .profile-role {
      color: rgba(245,240,232,0.45) !important;
    }
    /* Buttons on the page — dark green */
    [data-theme="grove"] .btn-primary,
    [data-theme="grove"] button.btn-primary,
    [data-theme="grove"] a.btn-primary,
    [data-theme="grove"] .add-bar,
    [data-theme="grove"] .sched-open-link,
    [data-theme="grove"] .mini-action,
    [data-theme="grove"] #viewAllProductsBtn,
    [data-theme="grove"] .chart-period-btn.active,
    [data-theme="grove"] .chart-pill.active {
      background: #3D2314 !important;
      border-color: #3D2314 !important;
      color: #F5F0E8 !important;
    }
    [data-theme="grove"] .btn-primary:hover,
    [data-theme="grove"] button.btn-primary:hover,
    [data-theme="grove"] a.btn-primary:hover {
      background: #4e2e1a !important;
      border-color: #4e2e1a !important;
    }
    /* Hero Brands pill text and Edit button — light on sidebar */
    [data-theme="grove"] .core-pill { color: #F5F0E8 !important; }
    [data-theme="grove"] .core5-edit-btn { color: #CC8B65 !important; }
    [data-theme="grove"] .core-sidebar-head { color: #CC8B65 !important; }
    /* Location tags */
    [data-theme="grove"] .sched-location-tag.bedroom { background: rgba(107,70,128,0.15) !important; border-color: rgba(107,70,128,0.3) !important; color: #5a3a6e !important; }
    [data-theme="grove"] .sched-location-tag.outside { background: rgba(30,80,100,0.12) !important; border-color: rgba(30,80,100,0.28) !important; color: #1e5064 !important; }
    [data-theme="grove"] .sched-location-tag.kitchen { background: rgba(180,60,80,0.12) !important; border-color: rgba(180,60,80,0.28) !important; color: #b43c50 !important; }
    [data-theme="grove"] .sched-location-tag.living-room { background: rgba(80,50,140,0.12) !important; border-color: rgba(80,50,140,0.28) !important; color: #50328c !important; }
    [data-theme="grove"] .sched-location-tag.studio { background: rgba(20,100,80,0.12) !important; border-color: rgba(20,100,80,0.28) !important; color: #146450 !important; }
    [data-theme="grove"] .sched-location-tag.office { background: rgba(140,80,20,0.12) !important; border-color: rgba(140,80,20,0.28) !important; color: #8c5014 !important; }
    [data-theme="grove"] select.sched-location-tag { color: #2A2420 !important; }
    /* Level ladder */
    [data-theme="grove"] .level-feature {
      background: linear-gradient(135deg, color-mix(in srgb, #CC8B65 18%, #F5F0E8 82%), #F0EBE3) !important;
      border-color: rgba(204,139,101,0.3) !important;
    }
  `;
  document.head.appendChild(style);
}

function _removeGroveStyle() {
  document.getElementById(GROVE_STYLE_ID)?.remove();
}

function applyTheme(themeKey) {
  const resolvedKey = THEMES[themeKey] ? themeKey : DEFAULT_THEME;
  const theme = THEMES[resolvedKey];
  const root = document.documentElement;
  root.dataset.theme = resolvedKey;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.vars['--bg']);
  if (resolvedKey === 'grove') _injectGroveStyle(); else _removeGroveStyle();
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
  if (saved === 'grove') saved = 'espresso';
  applyTheme(saved);
}
applyThemeImmediate();

function _themeIconNameFromSrc(src) {
  const match = String(src || '').match(/(?:^|\/)icons\/(?:(dusk|warm|noir|forest|grove|espresso)\/)?([^/?#]+)\.png(?:[?#].*)?$/i);
  if (!match) return '';
  const raw = match[2].toLowerCase();
  if (raw === 'videos') return 'video';
  if (raw === 'comission' || raw === 'comissions' || raw === 'commissins') return 'commissions';
  return THEME_ICON_NAMES.has(raw) ? raw : '';
}

function _themeIconSrc(themeKey, iconName) {
  const normalized = iconName === 'videos' ? 'video' : iconName;
  const aliases = {};
  const file = aliases[normalized] || `${normalized}.png`;
  return `icons/${file}`;   // one theme now — icons live directly in /icons
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

document.addEventListener('DOMContentLoaded', () => {
  const t = _cachedTheme() || DEFAULT_THEME;
  applyThemeIcons(t);
  if (t === 'grove') _injectGroveStyle();
});

// ─── User Prefs ───────────────────────────────────────────────────────────────

async function loadUserPrefs(userId) {
  const theme = _cachedTheme() || DEFAULT_THEME;
  const { data, error } = await db.from('user_prefs')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.warn('Preference load failed', error);
  const row = data || null;
  if (row) {
    const merged = {
      display_name: '',
      core5: [],
      theme,
      profile_icon: '',
      streak_goal: _cachedStreakGoal(userId),
      _isNewPrefs: false
    };
    if ((row.display_name || '').trim()) merged.display_name = row.display_name;
    if (Array.isArray(row.core5) && row.core5.some(value => String(value || '').trim())) merged.core5 = row.core5;
    if (THEMES[row.theme]) merged.theme = row.theme;
    if (row.profile_icon) merged.profile_icon = row.profile_icon;
    merged.streak_goal = _normalizeStreakGoal(row.streak_goal, merged.streak_goal);
    return { ...merged, core5: _resolveCore5(userId, merged.core5) };
  }
  const cachedCore5 = _cachedCore5(userId, (typeof getActiveAccountId === 'function' ? getActiveAccountId() : null) || 'default');
  const streakGoal = _cachedStreakGoal(userId);
  return { display_name: null, core5: cachedCore5, theme, profile_icon: _cachedAvatarUrl(userId) || _cachedProfileIcon(userId), streak_goal: streakGoal, _isNewPrefs: true };
}

async function saveUserPrefs(userId, patch) {
  if (!userId) return { error: new Error('Missing user id') };
  const cleanPatch = { ...patch };
  if ('core5' in cleanPatch) cleanPatch.core5 = _normalizeCore5(cleanPatch.core5);
  if ('streak_goal' in cleanPatch) cleanPatch.streak_goal = _normalizeStreakGoal(cleanPatch.streak_goal);
  const { error } = await db.from('user_prefs')
    .upsert({
      user_id: userId,
      updated_at: new Date().toISOString(),
      ...cleanPatch
    }, { onConflict: 'user_id' });
  if (error) console.warn('Preference save failed', error);
  return { error: error || null };
}

function _streakGoalKey(userId) {
  return `creatorHub:streakGoal:${userId || 'local'}`;
}

function _aiToneKey(userId) {
  return `creatorHub:aiTone:${userId || 'local'}`;
}

function _normalizeAiTone(value) {
  return String(value || '').trim();
}

function _cachedAiTone(userId) {
  try { return _normalizeAiTone(localStorage.getItem(_aiToneKey(userId))); }
  catch(e) { return ''; }
}

function resolveAiTone(user, prefs = null) {
  return _normalizeAiTone(user?.user_metadata?.ai_tone)
    || _normalizeAiTone(prefs?.ai_tone)
    || _cachedAiTone(user?.id)
    || '';
}

async function saveAiTone(userId, value) {
  const tone = _normalizeAiTone(value);
  if (!tone) return { tone: '', error: new Error('Missing tone') };
  try { localStorage.setItem(_aiToneKey(userId), tone); } catch(e) {}
  let error = null;
  try {
    const result = await db.auth.updateUser({ data: { ai_tone: tone } });
    error = result.error || null;
  } catch(e) {
    error = e;
  }
  return { tone, error };
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
  if (!prefs?._isNewPrefs && _hasStreakGoalValue(prefs?.streak_goal)) return _normalizeStreakGoal(prefs.streak_goal);
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

  // Show active TikTok handle in the profile role slot
  const activeAccount = await getActiveAccount(user.id);
  if (activeAccount) {
    const handle = '@' + (activeAccount.display_name || activeAccount.username || 'account');
    document.querySelectorAll('.profile-role').forEach(el => el.textContent = handle);
  }

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

function _core5Key(userId, accountId) {
  const acct = accountId || (typeof getActiveAccountId === 'function' ? getActiveAccountId() : null) || 'default';
  return `creatorHub:core5:${userId || 'local'}:${acct}`;
}

function _normalizeCore5(values) {
  const arr = Array.isArray(values) ? values : [];
  return Array.from({ length: 7 }, (_, i) => String(arr[i] || '').trim());
}

function _cachedCore5(userId, accountId) {
  try {
    return _normalizeCore5(JSON.parse(localStorage.getItem(_core5Key(userId, accountId)) || '[]'));
  } catch(e) { return []; }
}

function _metadataCore5(user) {
  return _normalizeCore5(user?.user_metadata?.core5);
}

function _cacheCore5(userId, values, accountId) {
  try { localStorage.setItem(_core5Key(userId, accountId), JSON.stringify(_normalizeCore5(values))); } catch(e) {}
}

function _resolveCore5(userId, savedValues, accountId) {
  const acctId = accountId || (typeof getActiveAccountId === 'function' ? getActiveAccountId() : null) || 'default';
  const byAccount = (savedValues && typeof savedValues === 'object' && !Array.isArray(savedValues)) ? null : null;
  const cached = _cachedCore5(userId, acctId);
  if (cached.some(Boolean)) return cached;
  const saved = _normalizeCore5(savedValues);
  return saved.some(Boolean) ? saved : [];
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
  const acctId = (typeof getActiveAccountId === 'function' ? getActiveAccountId() : null) || 'default';
  const byAccountMap = prefs?.core5_by_account || {};
  const acctValues = byAccountMap[acctId] ? _normalizeCore5(byAccountMap[acctId]) : null;
  const user = await getUser();
  const metaValues = _metadataCore5(user);
  const cachedValues = _cachedCore5(userId, acctId);
  const prefValues = _normalizeCore5(prefs.core5);
  const values = (acctValues && acctValues.some(Boolean))
    ? acctValues
    : (cachedValues.some(Boolean) ? cachedValues : (prefValues.some(Boolean) ? prefValues : metaValues));
  _cacheCore5(userId, values, acctId);
  _renderCore5Pills(values);

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
  const acctId = (typeof getActiveAccountId === 'function' ? getActiveAccountId() : null) || 'default';
  const values = _cachedCore5(window._core5UserId, acctId);
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
  const acctId = (typeof getActiveAccountId === 'function' ? getActiveAccountId() : null) || 'default';
  const values = [0,1,2,3,4,5,6].map(i => (document.getElementById(`_c5input${i}`)?.value || '').trim());
  _cacheCore5(userId, values, acctId);
  _renderCore5Pills(values);
  closeCore5Modal();
  try {
    // Load existing by-account map and update this account's slot
    const { data } = await db.from('user_prefs').select('core5_by_account').eq('user_id', userId).maybeSingle();
    const existing = data?.core5_by_account || {};
    const updated = { ...existing, [acctId]: _normalizeCore5(values) };
    await saveUserPrefs(userId, { core5_by_account: updated });
    showToast('Hero Brands saved');
  } catch(e) {
    showToast('Hero Brands saved locally', 'error');
  }
}

// ─── Active TikTok Account ────────────────────────────────────────────────────
// Global account switcher — stored in localStorage, read by any page.

const ACTIVE_ACCOUNT_KEY = 'take24:active_tiktok_account';

function getActiveAccountId() {
  try { return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || null; } catch(e) { return null; }
}

function setActiveAccountId(openId) {
  try { localStorage.setItem(ACTIVE_ACCOUNT_KEY, openId); } catch(e) {}
  window.dispatchEvent(new CustomEvent('take24:account-change', { detail: { openId } }));
}

// Returns the full row from tiktok_accounts for the active account,
// or the first account if nothing is explicitly selected yet.
async function getActiveAccount(userId) {
  const { data, error } = await db
    .from('tiktok_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error || !data?.length) return null;
  const savedId = getActiveAccountId();
  const match = data.find(a => a.tiktok_open_id === savedId);
  if (!match) setActiveAccountId(data[0].tiktok_open_id);
  return match || data[0];
}

// ─── Profile Popover ─────────────────────────────────────────────────────────
// Injected into every page. Click avatar/profile name to open.
// Loads connected TikTok accounts and renders them as a switcher.

function initProfilePopover(userId) {
  if (document.getElementById('_profilePopover')) return;

  const pop = document.createElement('div');
  pop.id = '_profilePopover';
  pop.style.cssText = `
    display:none;position:fixed;z-index:800;
    background:var(--surface);border:1px solid var(--border-mid);
    border-radius:14px;box-shadow:var(--shadow-md);
    padding:8px;min-width:210px;max-width:260px;
    font-family:'Stack Sans Notch',sans-serif;
  `;

  // Static bottom section — accounts section injected above it
  const bottomHTML = `
    <div id="_popAccountsSection"></div>
    <div style="height:1px;background:var(--border);margin:4px 0;"></div>
    <a href="meta/index.html" onclick="try{localStorage.setItem('take24:workspace','meta')}catch(e){}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;color:var(--text);text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;transition:background 0.12s;" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      Switch to Meta
    </a>
    <div style="height:1px;background:var(--border);margin:4px 0;"></div>
    <a href="settings.html" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;color:var(--text);text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;transition:background 0.12s;" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      Settings
    </a>
    <div style="height:1px;background:var(--border);margin:4px 0;"></div>
    <button onclick="signOut()" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:8px;border:none;background:none;color:var(--rust);cursor:pointer;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;font-family:'Stack Sans Notch',sans-serif;transition:background 0.12s;" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Sign Out
    </button>
  `;
  pop.innerHTML = bottomHTML;
  document.body.appendChild(pop);

  // Load accounts and render the switcher section
  async function renderAccountSwitcher() {
    const section = document.getElementById('_popAccountsSection');
    if (!section) return;
    const { data, error } = await db
      .from('tiktok_accounts')
      .select('tiktok_open_id, display_name, avatar_url, username')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error || !data?.length) {
      section.innerHTML = '';
      return;
    }
    const activeId = getActiveAccountId() || data[0].tiktok_open_id;
    // Auto-save the first account if nothing was set yet
    if (!getActiveAccountId()) setActiveAccountId(data[0].tiktok_open_id);

    section.innerHTML = `
      <div style="padding:6px 12px 4px;font-size:9px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:var(--text-muted);">Viewing as</div>
      ${data.map(acc => {
        const isActive = acc.tiktok_open_id === activeId;
        const name = acc.display_name || acc.username || 'TikTok Account';
        const avatarHtml = acc.avatar_url
          ? `<img src="${acc.avatar_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
          : `<div style="width:28px;height:28px;border-radius:50%;background:var(--sand);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">♪</div>`;
        return `
          <button
            onclick="switchTikTokAccount('${acc.tiktok_open_id}')"
            style="display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;border-radius:8px;border:none;cursor:pointer;font-family:'Stack Sans Notch',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;transition:background 0.12s;
              background:${isActive ? 'color-mix(in srgb,var(--rust) 12%,var(--surface) 88%)' : 'none'};
              color:${isActive ? 'var(--ink)' : 'var(--text-mid)'};"
            onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background='${isActive ? 'color-mix(in srgb,var(--rust) 12%,var(--surface) 88%)' : 'none'}'">
            ${avatarHtml}
            <span style="flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">@${name}</span>
            ${isActive ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--rust)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </button>`;
      }).join('')}
      <div style="height:1px;background:var(--border);margin:4px 0;"></div>
    `;
  }

  // Switch account and reload the page so all data refreshes
  window.switchTikTokAccount = function(openId) {
    setActiveAccountId(openId);
    pop.style.display = 'none';
    window.location.reload();
  };

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
          renderAccountSwitcher(); // refresh on each open
          const spaceBelow = window.innerHeight - rect.bottom;
          if (spaceBelow < 180) {
            pop.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
            pop.style.top = 'auto';
          } else {
            pop.style.top = (rect.bottom + 8) + 'px';
            pop.style.bottom = 'auto';
          }
          pop.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
        }
      });
    });
  }
  wireProfileTriggers();
  const obs = new MutationObserver(wireProfileTriggers);
  obs.observe(document.body, { childList: true, subtree: true });
}

// ─── Init Theme from Prefs ────────────────────────────────────────────────────

async function initTheme(userId, prefs) {
  const user = await getUser();
  const metaTheme = _metadataTheme(user);
  const cachedTheme = _cachedTheme();
  const prefTheme = THEMES[prefs.theme] ? prefs.theme : '';
  let themeKey = prefs?._isNewPrefs
    ? (metaTheme || cachedTheme || prefTheme || DEFAULT_THEME)
    : (prefTheme || metaTheme || cachedTheme || DEFAULT_THEME);
  if (themeKey === 'grove') themeKey = 'espresso';   // Grove is retired — Espresso replaces it
  try { localStorage.setItem('creatorHub:theme', themeKey); } catch(e) {}
  applyTheme(themeKey);
  if (userId && prefs.theme !== themeKey) await saveUserPrefs(userId, { theme: themeKey });
  if (userId && metaTheme !== themeKey) await db.auth.updateUser({ data: { theme: themeKey } });
}

// ─── TikTok Integration ───────────────────────────────────────────────────────
// Token exchange/refresh happens through the Cloudflare Worker (client_secret
// never touches the browser). Tokens + cached stats live on user_prefs,
// protected by the same RLS policy as the rest of that table.

const TIKTOK_WORKER_URL = 'https://take24-scout.kortnycall5.workers.dev';

async function loadTikTokPrefs(userId) {
  const { data, error } = await db.from('user_prefs')
    .select('tiktok_connected,tiktok_open_id,tiktok_username,tiktok_access_token,tiktok_refresh_token,tiktok_token_expires_at,tiktok_follower_count,tiktok_following_count,tiktok_likes_count,tiktok_video_count,tiktok_stats_updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.warn('TikTok prefs load failed', error);
  return data || null;
}

async function saveTikTokConnection(userId, tokenData, userInfo) {
  // Only include fields we actually have fresh data for — this function is
  // also called after a silent token refresh (no userInfo), and we don't
  // want that to blank out the cached username/stats.
  const patch = { tiktok_connected: true };
  if (tokenData.open_id || userInfo?.open_id) patch.tiktok_open_id = tokenData.open_id || userInfo.open_id;
  if (tokenData.access_token) patch.tiktok_access_token = tokenData.access_token;
  if (tokenData.refresh_token) patch.tiktok_refresh_token = tokenData.refresh_token;
  if (tokenData.expires_in) {
    patch.tiktok_token_expires_at = new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString();
  }
  if (userInfo) {
    patch.tiktok_username = userInfo.display_name || '';
    patch.tiktok_follower_count = userInfo.follower_count ?? 0;
    patch.tiktok_following_count = userInfo.following_count ?? 0;
    patch.tiktok_likes_count = userInfo.likes_count ?? 0;
    patch.tiktok_video_count = userInfo.video_count ?? 0;
    patch.tiktok_stats_updated_at = new Date().toISOString();
  }
  const { error } = await saveUserPrefs(userId, patch);
  if (!error && userInfo?.avatar_url) {
    await saveProfileIcon(userId, userInfo.avatar_url);
  }
  return { error };
}

async function disconnectTikTok(userId) {
  return saveUserPrefs(userId, {
    tiktok_connected: false,
    tiktok_open_id: '',
    tiktok_username: '',
    tiktok_access_token: '',
    tiktok_refresh_token: '',
    tiktok_token_expires_at: null,
  });
}

// Exchanges an OAuth `code` for tokens, fetches the TikTok profile, and saves
// everything. Returns { error, userInfo }.
async function exchangeTikTokCode(userId, code, redirectUri) {
  try {
    const tokenRes = await fetch(`${TIKTOK_WORKER_URL}/?service=tiktok&action=token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
      return { error: new Error(tokenData.error?.message || tokenData.error || 'Token exchange failed') };
    }
    const userInfo = await fetchTikTokUserInfo(tokenData.access_token);
    const { error } = await saveTikTokConnection(userId, tokenData, userInfo);
    return { error: error || null, userInfo };
  } catch (e) {
    return { error: e };
  }
}

async function fetchTikTokUserInfo(accessToken) {
  const res = await fetch(`${TIKTOK_WORKER_URL}/?service=tiktok&action=user_info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  // TikTok always includes an "error" object, even on success (error.code === "ok").
  // Only treat it as a real failure when the code says otherwise.
  if (!res.ok || (data.error && data.error.code && data.error.code !== 'ok')) {
    throw new Error(data.error?.message || 'Failed to fetch TikTok user info');
  }
  return data.data?.user || null;
}

// Returns a currently-valid access token for the active TikTok account,
// silently refreshing it first if expired. Returns null if not connected.
async function getValidTikTokAccessToken(userId) {
  const account = await getActiveAccount(userId);
  if (!account?.access_token) return null;

  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : 0;
  const stillValid = expiresAt && (expiresAt - Date.now() > 5 * 60 * 1000);
  if (stillValid) return account.access_token;

  if (!account.refresh_token) return account.access_token || null;

  try {
    const res = await fetch(`${TIKTOK_WORKER_URL}/?service=tiktok&action=refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: account.refresh_token }),
    });
    const data = await res.json();
    if (!res.ok || data.error || !data.access_token) return account.access_token || null;
    // Save refreshed token back to tiktok_accounts
    await db.from('tiktok_accounts').update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || account.refresh_token,
      token_expires_at: data.expires_in
        ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
        : null
    }).eq('tiktok_open_id', account.tiktok_open_id).eq('user_id', userId);
    return data.access_token;
  } catch (e) {
    console.warn('TikTok token refresh failed', e);
    return account.access_token || null;
  }
}

// Refreshes cached follower/like/video stats from TikTok for the active account.
async function refreshTikTokStats(userId) {
  const accessToken = await getValidTikTokAccessToken(userId);
  if (!accessToken) return null;
  try {
    const userInfo = await fetchTikTokUserInfo(accessToken);
    if (!userInfo) return null;
    const account = await getActiveAccount(userId);
    if (account) {
      await db.from('tiktok_accounts').update({
        follower_count: userInfo.follower_count ?? 0,
        following_count: userInfo.following_count ?? 0,
        likes_count: userInfo.likes_count ?? 0,
        video_count: userInfo.video_count ?? 0,
        avatar_url: userInfo.avatar_url || account.avatar_url,
        stats_updated_at: new Date().toISOString()
      }).eq('tiktok_open_id', account.tiktok_open_id).eq('user_id', userId);
    }
    return userInfo;
  } catch (e) {
    console.warn('TikTok stats refresh failed', e);
    return null;
  }
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
