// ─── Facebook + Instagram (Meta) — shared helpers for Settings & Content Tracker ───
// Needs supabase.js loaded first (uses its `db`).
const META_APP_ID = '1569299174362194';          // public — safe in browser code
const META_WORKER_URL = 'https://take24-scout.kortnycall5.workers.dev';
const META_GRAPH = 'https://graph.facebook.com/v23.0';
const META_SCOPES = ['pages_show_list','pages_read_engagement','pages_read_user_content','read_insights',
  'instagram_basic','instagram_manage_insights','business_management'].join(',');
const META_REDIRECT = location.origin + '/settings.html';

async function metaGraph(path, token, params = {}) {
  const u = new URL(META_GRAPH + path);
  Object.entries({ ...params, access_token: token }).forEach(([k, v]) => u.searchParams.set(k, v));
  const data = await (await fetch(u)).json();
  if (data.error) throw new Error(data.error.message);
  return data;
}
async function metaGraphAll(path, token, params = {}, max = 500) {
  let out = [], data = await metaGraph(path, token, { limit: 50, ...params });
  out.push(...(data.data || []));
  while (data.paging?.next && out.length < max) {
    data = await (await fetch(data.paging.next)).json();
    if (data.error) break;
    out.push(...(data.data || []));
  }
  return out;
}

// 1. Send you to Facebook to approve. `state` starts with "meta_" so Settings can tell it apart from TikTok.
function metaConnectStart() {
  const state = 'meta_' + crypto.randomUUID();
  sessionStorage.setItem('meta_oauth_state', state);
  location.href = 'https://www.facebook.com/v23.0/dialog/oauth?' + new URLSearchParams({
    client_id: META_APP_ID, redirect_uri: META_REDIRECT, state, scope: META_SCOPES, response_type: 'code'
  });
}

// 2. Back from Facebook: trade the code for a token, save every Page + linked Instagram account
async function metaFinishConnect(userId, code) {
  const tok = await (await fetch(`${META_WORKER_URL}/?service=meta&action=token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: META_REDIRECT })
  })).json();
  if (!tok.access_token) throw new Error(tok.error || 'Could not connect');
  const pages = await metaGraphAll('/me/accounts', tok.access_token, { fields: 'id,name,access_token,picture{url},followers_count,instagram_business_account{id,username,name,profile_picture_url,followers_count}' });
  if (!pages.length) throw new Error('No Facebook Pages found — select your Page when approving.');
  const rows = [];
  for (const p of pages) {
    rows.push({ user_id: userId, platform: 'facebook', account_id: p.id, name: p.name, username: p.name,
      avatar_url: p.picture?.data?.url || '', page_id: p.id, access_token: p.access_token, follower_count: p.followers_count || 0 });
    const ig = p.instagram_business_account;
    if (ig) rows.push({ user_id: userId, platform: 'instagram', account_id: ig.id, name: ig.name || ig.username, username: ig.username,
      avatar_url: ig.profile_picture_url || '', page_id: p.id, access_token: p.access_token, follower_count: ig.followers_count || 0 });
  }
  const { error } = await db.from('meta_accounts').upsert(rows, { onConflict: 'user_id,platform,account_id' });
  if (error) throw error;
  return rows.length;
}

// 3. Import / refresh videos + stats
async function metaIgStats(id, token) {
  try { const d = await metaGraph(`/${id}/insights`, token, { metric: 'views,shares,saved' });
    const v = k => d.data?.find(x => x.name === k)?.values?.[0]?.value || 0;
    return { views: v('views'), shares: v('shares'), saves: v('saved') };
  } catch { return {}; }
}
async function metaFbViews(id, token) {
  for (const metric of ['blue_reels_play_count','fb_reels_total_plays','total_video_views','total_video_impressions']) {
    try { const d = await metaGraph(`/${id}/video_insights`, token, { metric });
      const val = d.data?.[0]?.values?.[0]?.value; if (typeof val === 'number' && val > 0) return { views: val };
    } catch {}
  }
  try { const d = await metaGraph(`/${id}`, token, { fields: 'views' }); if (d.views) return { views: d.views }; } catch {}
  return {};
}
async function metaSyncAll(userId, onStatus = () => {}) {
  const { data: accts } = await db.from('meta_accounts').select('*').eq('user_id', userId);
  if (!accts?.length) throw new Error('Connect Facebook & Instagram in Settings first.');
  let total = 0;
  for (const a of accts) {
    onStatus(`Syncing ${a.username || a.name}…`);
    const rows = [], now = new Date().toISOString();
    if (a.platform === 'instagram') {
      const media = await metaGraphAll(`/${a.account_id}/media`, a.access_token, { fields: 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count' });
      for (const m of media.filter(m => m.media_type === 'VIDEO')) rows.push({ user_id: userId, platform: 'instagram', account_id: a.account_id, post_id: m.id,
        caption: m.caption || '', media_type: m.media_product_type || m.media_type, permalink: m.permalink,
        thumbnail_url: m.thumbnail_url || m.media_url || '', posted_at: m.timestamp,
        likes: m.like_count || 0, comments: m.comments_count || 0, ...(await metaIgStats(m.id, a.access_token)), stats_updated_at: now });
    } else {
      const vids = await metaGraphAll(`/${a.account_id}/videos`, a.access_token, { fields: 'id,description,title,permalink_url,picture,created_time' });
      for (const v of vids) rows.push({ user_id: userId, platform: 'facebook', account_id: a.account_id, post_id: v.id,
        caption: v.description || v.title || '', media_type: 'VIDEO',
        permalink: v.permalink_url ? 'https://www.facebook.com' + v.permalink_url : '',
        thumbnail_url: v.picture || '', posted_at: v.created_time, ...(await metaFbViews(v.id, a.access_token)), stats_updated_at: now });
    }
    if (rows.length) { const { error } = await db.from('meta_posts').upsert(rows, { onConflict: 'user_id,platform,post_id' }); if (error) throw error; }
    total += rows.length;
  }
  try { localStorage.setItem('take24meta:lastSync', String(Date.now())); } catch {}
  return total;
}
// Default account per platform: House of Ko, else the first one
function metaDefaultAccount(accts, platform) {
  const l = (accts || []).filter(a => a.platform === platform);
  return l.find(a => /house\s*of\s*ko/i.test(`${a.name} ${a.username}`)) || l[0] || null;
}
