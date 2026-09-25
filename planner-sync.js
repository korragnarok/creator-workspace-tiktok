// ─── Planner sync — Content Ideas, This Week notes, Monthly Goals ─────────────
// Saved to Supabase (user_planner table) so they match on your phone and computer.
// The first time, it merges whatever was saved on this device from BOTH the old
// TikTok and Meta sides, then uploads it. Needs supabase.js (`db`) first.
const PLANNER_LOCAL = {
  ideas: ['take24:ideas', 'take24meta:list:content'],
  week:  ['take24:week', 'take24meta:week'],
  goals: ['take24:goals', 'take24meta:goals'],
};
const _plannerCache = {};
function _readLocal(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } }

function _mergeLocal(key){
  const [a, b] = PLANNER_LOCAL[key].map(_readLocal);
  if (key === 'ideas') {
    const out = [], seen = new Set();
    [...(Array.isArray(b) ? b : []), ...(Array.isArray(a) ? a : [])].forEach(it => {
      if (!it || !(it.text || it.link)) return;
      const sig = (it.link || '') + '|' + String(it.text || '').trim().toLowerCase();
      if (seen.has(sig)) return; seen.add(sig); out.push(it);
    });
    return out;
  }
  if (key === 'week') {
    const out = { ...(b && typeof b === 'object' ? b : {}) };
    Object.entries(a && typeof a === 'object' ? a : {}).forEach(([d, t]) => {
      if (!t) return; out[d] = out[d] && out[d] !== t ? `${out[d]}\n${t}` : t;
    });
    return out;
  }
  if (key === 'goals') {
    const all = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter(g => String(g || '').trim());
    return [all[0] || '', all[1] || ''];
  }
  return null;
}

async function plannerGet(key, fallback){
  if (key in _plannerCache) return _plannerCache[key];
  let value = null;
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      const { data } = await db.from('user_planner').select('value').eq('user_id', session.user.id).eq('key', key).maybeSingle();
      if (data && data.value !== null) value = data.value;
      else { value = _mergeLocal(key); if (value && (Array.isArray(value) ? value.length : Object.keys(value).length)) plannerSet(key, value, true); }
    }
  } catch(e) { console.warn('Planner load failed, using this device', e); }
  if (value === null || value === undefined) value = _mergeLocal(key) ?? fallback;
  _plannerCache[key] = value ?? fallback;
  try { localStorage.setItem(PLANNER_LOCAL[key][0], JSON.stringify(_plannerCache[key])); } catch(e) {}
  return _plannerCache[key];
}

const _plannerTimers = {};
function plannerSet(key, value, immediate){
  _plannerCache[key] = value;
  try { localStorage.setItem(PLANNER_LOCAL[key][0], JSON.stringify(value)); } catch(e) {}   // offline backup
  clearTimeout(_plannerTimers[key]);
  _plannerTimers[key] = setTimeout(async () => {
    try {
      const { data: { session } } = await db.auth.getSession(); if (!session) return;
      await db.from('user_planner').upsert({ user_id: session.user.id, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
    } catch(e) { console.warn('Planner save failed', e); }
  }, immediate ? 0 : 600);   // waits for a pause in typing before saving
}
