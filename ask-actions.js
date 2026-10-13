// ─── Ask Take24: do things, not just answer ─────────────────────────────────────
// Log sales (video or showcase), sales-day notes, plan the Film Board, move a day,
// mark takes filmed, add a promo, add a product note. Every action shows a confirm card first.
// Needs supabase.js (db), planner-sync.js, promos-sync.js and ask.html's gemText/add/esc/ymd/addDays.

const ACT = { ctx: null, pendingNote: null, cards: {} };
const ACT_COLS_DEFAULT = { talking: '🗣 Talking head', vacuum: '🎬 Demo / voiceover', faceless: '✨ Aesthetic / faceless', car: '🚗 Car' };

// quick gate so plain questions skip the extra AI call
function actLooksLikeAction(t) {
  return /\b(made|sold|sale|sales|gmv|commission|comm\b|log|add|put|plan|film|filming|move|mark|filmed|promo|note|notes|schedule|takes?)\b/i.test(t);
}

async function actContext() {
  if (ACT.ctx && Date.now() - ACT.ctx.at < 60e3) return ACT.ctx;
  const { data: { session } } = await db.auth.getSession(); if (!session) throw new Error('Please sign in first.');
  const uid = session.user.id, since = ymd(addDays(new Date(), -180));
  const [{ data: accts }, { data: prods }, { data: vids }, colNames] = await Promise.all([
    db.from('tiktok_accounts').select('tiktok_open_id,username,display_name').eq('user_id', uid).order('created_at', { ascending: true }),
    db.from('products').select('id,name,brand,notes,tiktok_account_id').eq('user_id', uid).order('name'),
    db.from('videos').select('id,title,date,tiktok_account_id,views').eq('user_id', uid).gte('date', since).order('date', { ascending: false }).limit(800),
    plannerGet('filmColNames', {}).catch(() => ({}))
  ]);
  const cols = {}; Object.keys(ACT_COLS_DEFAULT).forEach(k => cols[k] = (colNames || {})[k]?.trim() || ACT_COLS_DEFAULT[k]);
  ACT.ctx = { at: Date.now(), uid, accts: accts || [], prods: prods || [], vids: vids || [], cols,
    acctName: id => { const a = (accts || []).find(x => x.tiktok_open_id === id); return a ? '@' + (a.username || a.display_name || 'account') : ''; },
    active: (typeof getActiveAccountId === 'function' && getActiveAccountId()) || accts?.[0]?.tiktok_open_id || '' };
  return ACT.ctx;
}

// ── fuzzy matching ──
const actNorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function actScore(hay, needle) {
  const h = actNorm(hay), n = actNorm(needle); if (!h || !n) return 0;
  if (h.includes(n)) return 100 + n.length;
  const words = n.split(' ').filter(w => w.length > 2); if (!words.length) return 0;
  const hit = words.filter(w => h.includes(w)).length;
  return Math.round(hit / words.length * 90);
}
function actFind(list, needle, field, min = 34) {
  return list.map(x => ({ x, s: actScore(typeof field === 'function' ? field(x) : x[field], needle) }))
    .filter(o => o.s >= min).sort((a, b) => b.s - a.s).slice(0, 6).map(o => o.x);
}
const actProd = (c, name) => actFind(c.prods, name, p => `${p.name} ${p.brand || ''}`);

// ── understand the message ──
const ACT_SCHEMA = { type: 'OBJECT', properties: {
  is_action: { type: 'BOOLEAN' },
  actions: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    type: { type: 'STRING', enum: ['log_sale', 'day_note', 'film_plan', 'move_day', 'mark_filmed', 'add_promo', 'product_note'] },
    date: { type: 'STRING' }, to_date: { type: 'STRING' },
    source: { type: 'STRING', enum: ['video', 'showcase'] },
    caption: { type: 'STRING' }, product: { type: 'STRING' }, account: { type: 'STRING' },
    units: { type: 'NUMBER' }, gmv: { type: 'NUMBER' }, comm: { type: 'NUMBER' },
    note: { type: 'STRING' }, count: { type: 'NUMBER' },
    columns: { type: 'ARRAY', items: { type: 'OBJECT', properties: { column: { type: 'STRING', enum: ['talking', 'vacuum', 'faceless', 'car'] }, takes: { type: 'NUMBER' } }, required: ['column', 'takes'] } },
    line: { type: 'STRING' }, deal: { type: 'STRING' }, start_date: { type: 'STRING' }, end_date: { type: 'STRING' }
  }, required: ['type'] } }
}, required: ['is_action', 'actions'] };

async function actParse(text) {
  const c = await actContext(), today = new Date();
  const prompt = `Kourtney is talking to her creator app. Decide if this message asks the app to RECORD or CHANGE something (log a sale, add notes, plan filming, move a day, mark filmed, add a promo, add a product note). Questions about her data ("why were sales down", "what should I film") are NOT actions → is_action=false, actions=[].

TODAY is ${ymd(today)} (${today.toLocaleDateString(undefined, { weekday: 'long' })}). "yesterday" = ${ymd(addDays(today, -1))}. If no date is said, use TODAY. Dates must be YYYY-MM-DD.
Her accounts: ${c.accts.map(a => '@' + (a.username || a.display_name)).join(', ')}.
Film Board columns (key = what she calls it): ${Object.entries(c.cols).map(([k, v]) => `${k} = "${v}"`).join('; ')}. "in the car" → car, "talking head" → talking, "voiceover/demo" → vacuum, "faceless/aesthetic" → faceless. Match her words to the closest column name.

Action types:
- log_sale: a sale. source "video" (from a video — put the caption/description words she gives in "caption", and the product if she says it) or "showcase" (from her showcase — put the product in "product"). units (default 1 if she says "a sale"), gmv and comm as plain numbers (no $). account only if she names one.
- day_note: a note for a sales day (note, date).
- film_plan: filming plan. product, date, columns = list of {column, takes}. "5 videos, 2 talking head and 3 in the car" → [{talking,2},{car,3}]. If she gives no style, use one entry with column "talking".
- move_day: move everything planned on "date" to "to_date".
- mark_filmed: mark takes filmed (product, date, count — 0 means all).
- add_promo: product, line (Shark / Ninja / Shark Beauty), deal (as she says it), start_date, end_date.
- product_note: product, note.
One message can have several actions. Never invent numbers she didn't say — leave them 0.

MESSAGE: ${text}`;
  const res = await fetch(`${WORKER}/?service=gemini&model=gemini-2.5-flash`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: ACT_SCHEMA } }) });
  const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.error?.message || `Gemini error (${res.status})`);
  try { return JSON.parse((data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')); } catch (e) { return { is_action: false, actions: [] }; }
}

// ── confirm cards ──
const dOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : ymd(new Date());
const prettyD = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const money = n => Number(n || 0).toFixed(2);
function actSel(id, opts, sel) { return `<select id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`; }
function actProdSel(c, id, name) {
  const m = actProd(c, name || '');
  const opts = [...m, ...c.prods.filter(p => !m.includes(p))].map(p => [p.id, `${p.name}${p.brand ? ' — ' + p.brand : ''}`]);
  return m.length ? actSel(id, opts, m[0].id) : actSel(id, [['', `— not found: "${name || ''}" — pick one —`], ...opts], '');
}
function actAcctSel(c, id, pref) { return actSel(id, c.accts.map(a => [a.tiktok_open_id, '@' + (a.username || a.display_name)]), pref || c.active); }
function actAcctGuess(c, name) { const n = actNorm(name).replace(/^@/, ''); return n ? c.accts.find(a => actNorm(`${a.username} ${a.display_name}`).includes(n))?.tiktok_open_id : null; }

function actCardHtml(a, i, c) {
  const k = `a${Date.now().toString(36)}${i}`; ACT.cards[k] = a;
  const row = (l, h) => `<div class="arow"><label>${l}</label>${h}</div>`;
  const date = dOk(a.date); let title = '', body = '';
  if (a.type === 'log_sale') {
    title = a.source === 'showcase' ? '💰 Log a showcase sale' : '💰 Log a video sale';
    if (a.source === 'showcase') {
      const p = actProd(c, a.product)[0];
      body = row('Product', actProdSel(c, k + '_p', a.product)) + row('Account', actAcctSel(c, k + '_acct', actAcctGuess(c, a.account) || p?.tiktok_account_id));
    } else {
      const m = actFind(c.vids, `${a.caption || ''} ${a.product || ''}`.trim(), 'title', 30);
      const opts = (m.length ? m : c.vids.slice(0, 40)).map(v => [v.id, `${String(v.title || 'Untitled').slice(0, 60)} · ${String(v.date || '').slice(5, 10)} · ${c.acctName(v.tiktok_account_id)}`]);
      body = row('Video', (m.length ? '' : `<div class="awarn">Couldn't find "${esc(a.caption || a.product || '')}" — pick it:</div>`) + actSel(k + '_v', opts, m[0]?.id));
    }
    body += row('Date', `<input type="date" id="${k}_d" value="${date}">`)
      + `<div class="arow3">${row('Units', `<input type="number" id="${k}_u" min="0" value="${a.units || 1}">`)}${row('GMV $', `<input type="number" step="0.01" id="${k}_g" value="${a.gmv || ''}">`)}${row('Comm $', `<input type="number" step="0.01" id="${k}_c" value="${a.comm || ''}">`)}</div>`;
  } else if (a.type === 'day_note') {
    title = '📝 Sales-day note';
    body = row('Date', `<input type="date" id="${k}_d" value="${date}">`) + row('Account', actAcctSel(c, k + '_acct', actAcctGuess(c, a.account))) + row('Note', `<textarea id="${k}_n" rows="2">${esc(a.note || '')}</textarea>`);
  } else if (a.type === 'film_plan') {
    title = '🎬 Add to Film Board';
    const cols = (a.columns && a.columns.length ? a.columns : [{ column: 'talking', takes: 1 }]);
    body = row('Product', actProdSel(c, k + '_p', a.product)) + row('Date', `<input type="date" id="${k}_d" value="${date}">`)
      + Object.keys(c.cols).map(col => { const n = cols.filter(x => x.column === col).reduce((s, x) => s + (+x.takes || 0), 0);
        return row(esc(c.cols[col]), `<input type="number" min="0" max="20" id="${k}_col_${col}" value="${n || ''}" placeholder="0" style="max-width:90px"> takes`); }).join('');
  } else if (a.type === 'move_day') {
    title = '📅 Move a filming day';
    body = row('From', `<input type="date" id="${k}_d" value="${date}">`) + row('To', `<input type="date" id="${k}_t" value="${dOk(a.to_date || ymd(addDays(new Date(), 1)))}">`);
  } else if (a.type === 'mark_filmed') {
    title = '✅ Mark takes filmed';
    body = row('Product', actProdSel(c, k + '_p', a.product)) + row('Date', `<input type="date" id="${k}_d" value="${date}">`) + row('How many', `<input type="number" min="0" id="${k}_n" value="${a.count || ''}" placeholder="all">`);
  } else if (a.type === 'add_promo') {
    title = '★ Add a promo';
    body = row('Product', `<input id="${k}_p" value="${esc(a.product || '')}">`) + row('Line', actSel(k + '_l', [['Shark', 'Shark'], ['Ninja', 'Ninja'], ['Shark Beauty', 'Shark Beauty']], /beauty/i.test(a.line) ? 'Shark Beauty' : /ninja/i.test(a.line) ? 'Ninja' : 'Shark'))
      + row('Deal', `<input id="${k}_deal" value="${esc(a.deal || '')}">`) + row('Starts', `<input type="date" id="${k}_s" value="${dOk(a.start_date || a.date)}">`) + row('Ends', `<input type="date" id="${k}_e" value="${/^\d{4}-\d{2}-\d{2}$/.test(a.end_date || '') ? a.end_date : ''}">`);
  } else if (a.type === 'product_note') {
    title = '🏷 Add a product note';
    body = row('Product', actProdSel(c, k + '_p', a.product)) + row('Note', `<textarea id="${k}_n" rows="2">${esc(a.note || '')}</textarea>`);
  } else return '';
  return `<div class="acard" id="${k}"><div class="atitle">${title}</div>${body}<div class="abtns"><button class="abtn primary" onclick="actRun('${k}',this)">Save</button><button class="abtn" onclick="actSkip('${k}')">Skip</button></div><div class="astat"></div></div>`;
}

// entry point from send(): returns true if it handled the message
async function actTry(text, waitEl) {
  // answering "any notes for this day?"
  if (ACT.pendingNote) {
    const p = ACT.pendingNote; ACT.pendingNote = null;
    if (/^\s*(no|nope|nah|skip|not now|none|no thanks|all good|nothing)\b/i.test(text)) { waitEl.classList.remove('wait'); waitEl.innerHTML = 'No problem — nothing added.'; return true; }
    if (!actLooksLikeAction(text) || text.length < 140) {
      try { await actSaleNote(p.date, p.acct, text); waitEl.classList.remove('wait'); waitEl.innerHTML = `📝 Added to your notes for <b>${esc(prettyD(p.date))}</b>.`; return true; }
      catch (e) { waitEl.classList.remove('wait'); waitEl.innerHTML = `Couldn't save the note: ${esc(e.message)}`; return true; }
    }
  }
  if (!actLooksLikeAction(text)) return false;
  let parsed; try { parsed = await actParse(text); } catch (e) { return false; }
  const acts = (parsed.actions || []).filter(a => a && a.type);
  if (!parsed.is_action || !acts.length) return false;
  const c = await actContext();
  waitEl.classList.remove('wait');
  waitEl.innerHTML = `<p>Here's what I'll do — check it and tap <b>Save</b>:</p>` + acts.map((a, i) => actCardHtml(a, i, c)).join('');
  return true;
}
function actSkip(k) { const el = document.getElementById(k); el.querySelector('.abtns').remove(); el.querySelector('.astat').textContent = 'Skipped.'; el.classList.add('done'); }
const v$ = (k, s) => document.getElementById(k + s)?.value ?? '';

async function actRun(k, btn) {
  const a = ACT.cards[k], c = await actContext(), stat = document.querySelector(`#${k} .astat`);
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const msg = await ({ log_sale: actSale, day_note: actDayNote, film_plan: actFilm, move_day: actMove, mark_filmed: actMark, add_promo: actPromo, product_note: actProdNote })[a.type](k, a, c);
    const el = document.getElementById(k); el.querySelector('.abtns').remove(); el.classList.add('done');
    el.querySelectorAll('input,select,textarea').forEach(x => x.disabled = true);
    stat.innerHTML = '✓ ' + msg;
    ACT.ctx = null; if (typeof DATA !== 'undefined') { DATA = null; }
    if (a.type === 'log_sale' && ACT.pendingNote) add('ai', `Would you like to add any notes for <b>${esc(prettyD(ACT.pendingNote.date))}</b>? Just type them, or say "no".`);
  } catch (e) { btn.disabled = false; btn.textContent = 'Save'; stat.textContent = 'Could not save: ' + e.message; }
}

// ── the actual saves ──
async function actSalesRow(c, date, acct) {
  const { data } = await db.from('sales').select('*').eq('user_id', c.uid).eq('date', date).eq('tiktok_account_id', acct).limit(1);
  return data?.[0] || null;
}
function actVs(row) { let r = row?.video_sales; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } } return Array.isArray(r) ? r : []; }

async function actSale(k, a, c) {
  const date = v$(k, '_d') || ymd(new Date()), units = +v$(k, '_u') || 0, gmv = +v$(k, '_g') || 0, comm = +v$(k, '_c') || 0;
  let entry, acct, label;
  if (a.source === 'showcase') {
    const pid = v$(k, '_p'); if (!pid) throw new Error('pick the product');
    acct = v$(k, '_acct'); entry = { source: 'showcase', product_id: pid, units, gmv, comm };
    label = c.prods.find(p => p.id === pid)?.name || 'product';
  } else {
    const vid = v$(k, '_v'); if (!vid) throw new Error('pick the video');
    const v = c.vids.find(x => String(x.id) === String(vid)); acct = v?.tiktok_account_id || c.active;
    entry = { source: 'video', video_id: vid, units, gmv, comm }; label = String(v?.title || 'video').slice(0, 50);
  }
  if (!acct) throw new Error('no account found');
  const ex = await actSalesRow(c, date, acct);
  if (ex) {
    const old = actVs(ex), rows = [...old, entry];
    const tot = old.length ? rows.reduce((s, r) => ({ units: s.units + (+r.units || 0), gmv: s.gmv + (+r.gmv || 0), comm: s.comm + (+r.comm || 0) }), { units: 0, gmv: 0, comm: 0 })
      : { units: (+ex.units || 0) + units, gmv: (+ex.gmv || 0) + gmv, comm: (+ex.comm || 0) + comm };
    const { error } = await db.from('sales').update({ ...tot, gmv: +tot.gmv.toFixed(2), comm: +tot.comm.toFixed(2), video_sales: rows }).eq('id', ex.id).eq('user_id', c.uid);
    if (error) throw error;
  } else {
    const { error } = await db.from('sales').insert({ user_id: c.uid, date, units, gmv, comm, note: '', video_sales: [entry], tiktok_account_id: acct });
    if (error) throw error;
  }
  ACT.pendingNote = { date, acct };
  return `Logged ${units} sale${units === 1 ? '' : 's'} · $${money(gmv)} GMV · $${money(comm)} comm for <b>${esc(label)}</b> on ${esc(prettyD(date))} (${esc(c.acctName(acct))}).`;
}
async function actSaleNote(date, acct, note) {
  const c = await actContext(); const ex = await actSalesRow(c, date, acct);
  if (ex) { const n = [String(ex.note || '').trim(), note.trim()].filter(Boolean).join('\n'); const { error } = await db.from('sales').update({ note: n }).eq('id', ex.id).eq('user_id', c.uid); if (error) throw error; }
  else { const { error } = await db.from('sales').insert({ user_id: c.uid, date, units: 0, gmv: 0, comm: 0, note: note.trim(), video_sales: [], tiktok_account_id: acct }); if (error) throw error; }
}
async function actDayNote(k, a, c) {
  const date = v$(k, '_d'), acct = v$(k, '_acct'), note = v$(k, '_n').trim(); if (!note) throw new Error('note is empty');
  await actSaleNote(date, acct, note); return `Note added to ${esc(prettyD(date))} (${esc(c.acctName(acct))}).`;
}

async function actFilm(k, a, c) {
  const pid = v$(k, '_p'), date = v$(k, '_d'); if (!pid) throw new Error('pick the product');
  const p = c.prods.find(x => x.id === pid);
  const plan = Object.keys(c.cols).map(col => ({ col, n: Math.min(20, +v$(k, '_col_' + col) || 0) })).filter(x => x.n > 0);
  if (!plan.length) throw new Error('add at least 1 take');
  const { data: existing } = await db.from('queue').select('id,notes,prod_id').eq('user_id', c.uid).eq('date', date).eq('prod_id', pid);
  const hasBase = (existing || []).some(r => !/\[copy:\w+\]/.test(r.notes || ''));
  const board = (await plannerGet('filmBoard', {})) || {}; const day = { ...(board[date] || {}) };
  const acct = p.tiktok_account_id || c.active; const rows = [], keys = [];
  plan.forEach((x, i) => {
    const useBase = i === 0 && !hasBase, tag = useBase ? '' : `[copy:${Date.now().toString(36)}${i}]`;
    const key = String(pid) + (tag ? '#' + tag.slice(6, -1) : '');
    keys.push([key, x.col]);
    for (let t = 0; t < x.n; t++) rows.push({ user_id: c.uid, tiktok_account_id: acct, date, prod_id: pid, name: p.name, brand: p.brand || '', notes: tag, script: '', done: false, sort_order: 900 + i });
  });
  const { error } = await db.from('queue').insert(rows); if (error) throw error;
  keys.forEach(([key, col], i) => { day[key] = { ...(day[key] || {}), style: col, order: 900 + i }; });
  board[date] = day; await plannerSet('filmBoard', board);
  return `Added <b>${esc(p.name)}</b> to your Film Board for ${esc(prettyD(date))}: ${plan.map(x => `${x.n} × ${esc(c.cols[x.col])}`).join(', ')}.`;
}
async function actMove(k, a, c) {
  const from = v$(k, '_d'), to = v$(k, '_t'); if (!from || !to || from === to) throw new Error('pick two different days');
  const { data, error } = await db.from('queue').update({ date: to }).eq('user_id', c.uid).eq('date', from).select('id'); if (error) throw error;
  const b = (await plannerGet('filmBoard', {})) || {}; if (b[from]) { b[to] = { ...(b[to] || {}), ...b[from] }; delete b[from]; await plannerSet('filmBoard', b); }
  return `Moved ${data?.length || 0} take${data?.length === 1 ? '' : 's'} from ${esc(prettyD(from))} to ${esc(prettyD(to))}.`;
}
async function actMark(k, a, c) {
  const pid = v$(k, '_p'), date = v$(k, '_d'), n = +v$(k, '_n') || 0; if (!pid) throw new Error('pick the product');
  const { data } = await db.from('queue').select('id').eq('user_id', c.uid).eq('date', date).eq('prod_id', pid).eq('done', false).order('sort_order');
  const ids = (data || []).slice(0, n || undefined).map(r => r.id); if (!ids.length) throw new Error('no unfilmed takes for that product on that day');
  const { error } = await db.from('queue').update({ done: true }).in('id', ids).eq('user_id', c.uid); if (error) throw error;
  return `Marked ${ids.length} take${ids.length === 1 ? '' : 's'} filmed.`;
}
async function actPromo(k, a, c) {
  const product = v$(k, '_p').trim(), line = v$(k, '_l'), s = v$(k, '_s'), e = v$(k, '_e') || s; if (!product) throw new Error('product is empty');
  const accts = typeof promoAccounts === 'function' ? await promoAccounts(c.uid) : {};
  const prod = actProd(c, product)[0];
  const { error } = await db.from('promos').insert({ user_id: c.uid, month: s.slice(0, 7), product, line, sku: '', deal: v$(k, '_deal'), start_date: s, end_date: e, notes: '', prod_id: prod?.id || null,
    tiktok_account_id: (typeof promoAccountFor === 'function' ? promoAccountFor(line, accts) : null) || c.active, todo_added: false, priority: false });
  if (error) throw error;
  return `Added <b>${esc(product)}</b> to Shark &amp; Ninja promos (${esc(prettyD(s))}${e && e !== s ? ' – ' + esc(prettyD(e)) : ''}).`;
}
async function actProdNote(k, a, c) {
  const pid = v$(k, '_p'), note = v$(k, '_n').trim(); if (!pid || !note) throw new Error('pick a product and write a note');
  const p = c.prods.find(x => x.id === pid);
  const { error } = await db.from('products').update({ notes: [String(p.notes || '').trim(), note].filter(Boolean).join('\n') }).eq('id', pid).eq('user_id', c.uid);
  if (error) throw error; return `Note added to <b>${esc(p.name)}</b>.`;
}
