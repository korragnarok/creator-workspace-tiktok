// ─── Ask Take24: do things, not just answer ─────────────────────────────────────
// Log sales (video or showcase), sales-day notes, plan the Film Board, move a day,
// mark takes filmed, add a promo, add a product note. Every action shows a confirm card first.
// Needs supabase.js (db), planner-sync.js, promos-sync.js and ask.html's gemText/add/esc/ymd/addDays.

const ACT = { ctx: null, pendingNote: null, cards: {} };
const actTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' took too long')), ms))]);
const ACT_COLS_DEFAULT = { talking: '🗣 Talking head', vacuum: '🎬 Demo / voiceover', faceless: '✨ Aesthetic / faceless', car: '🚗 Car' };

// quick gate so plain questions skip the extra AI call
function actLooksLikeAction(t) {
  return /\b(made|sold|sale|sales|gmv|commission|comm\b|log|add|put|plan|film|filming|move|mark|filmed|promo|note|notes|schedule|takes?|posted|post|uploaded|left|today|tomorrow|day|hq|high quality)\b/i.test(t);
}

async function actContext() {
  if (ACT.ctx && Date.now() - ACT.ctx.at < 60e3) return ACT.ctx;
  const { data: { session } } = await db.auth.getSession(); if (!session) throw new Error('Please sign in first.');
  const uid = session.user.id, since = ymd(addDays(new Date(), -180));
  const [{ data: accts }, { data: prods }, { data: vids }, colNames] = await Promise.all([
    db.from('tiktok_accounts').select('tiktok_open_id,username,display_name').eq('user_id', uid).order('created_at', { ascending: true }),
    db.from('products').select('id,name,brand,notes,tiktok_account_id,status,units_sold').eq('user_id', uid).order('name'),
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
    type: { type: 'STRING', enum: ['log_sale', 'day_note', 'film_plan', 'move_day', 'mark_filmed', 'add_promo', 'product_note', 'plan_day', 'whats_left', 'log_video'] },
    date: { type: 'STRING' }, to_date: { type: 'STRING' },
    source: { type: 'STRING', enum: ['video', 'showcase'] },
    caption: { type: 'STRING' }, product: { type: 'STRING' }, account: { type: 'STRING' },
    units: { type: 'NUMBER' }, gmv: { type: 'NUMBER' }, comm: { type: 'NUMBER' },
    note: { type: 'STRING' }, count: { type: 'NUMBER' },
    columns: { type: 'ARRAY', items: { type: 'OBJECT', properties: { column: { type: 'STRING', enum: ['talking', 'vacuum', 'faceless', 'car'] }, takes: { type: 'NUMBER' } }, required: ['column', 'takes'] } },
    link: { type: 'STRING' }, high_quality: { type: 'BOOLEAN' }, column: { type: 'STRING' },
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
- plan_day: she wants the app to PLAN/FILL her filming day for her ("plan my day", "what should I film today, add it", "fill my board for tomorrow"). date, count = how many products if she says (else 0).
- whats_left: she asks what's left / still to film / to do today (date). Not a general strategy question.
- log_video: she POSTED a video ("posted the Glossi car video on @thecozyko, caption '...'"). caption = the caption/description she gives, product, account, date, link if given, high_quality true only if she says HQ/high quality, column = which style it was if she says it.
One message can have several actions. Never invent numbers she didn't say — leave them 0.

MESSAGE: ${text}`;
  const res = await fetch(`${WORKER}/?service=gemini&model=gemini-2.5-flash`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: ACT_SCHEMA, thinkingConfig: { thinkingBudget: 0 } } }), signal: AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined });
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
  } else if (a.type === 'log_video') {
    title = '📹 Log a posted video';
    const p = actProd(c, a.product || a.caption || '')[0];
    body = row('Caption', `<textarea id="${k}_t" rows="2">${esc(a.caption || '')}</textarea>`)
      + row('Product', actSel(k + '_p', [['', '— no product —'], ...c.prods.map(x => [x.id, `${x.name}${x.brand ? ' — ' + x.brand : ''}`])], p?.id || ''))
      + row('Account', actAcctSel(c, k + '_acct', actAcctGuess(c, a.account) || p?.tiktok_account_id))
      + row('Posted', `<input type="date" id="${k}_d" value="${date}">`)
      + row('Link (optional)', `<input id="${k}_l" value="${esc(a.link || '')}" placeholder="https://www.tiktok.com/…">`)
      + `<label class="achk"><input type="checkbox" id="${k}_hq"${a.high_quality ? ' checked' : ''}> High quality</label>`
      + `<label class="achk"><input type="checkbox" id="${k}_m" checked> Mark a take filmed on the Film Board</label>`;
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
  const strong = /\b(made|log|logged|sold)\b.*\b(sale|sales|gmv|commission)\b|\b(add|put)\b.*\b(film ?board|board|to-?do)\b|\bplan my\b|\bposted\b/i.test(text);
  waitEl.textContent = 'Reading that…';
  let parsed; try { parsed = await actTimeout(actParse(text), 30000, 'Understanding your message'); }
  catch (e) { console.warn('actParse', e); if (!strong) return false; waitEl.classList.remove('wait'); waitEl.innerHTML = `I couldn't set that up just now (${esc(e.message)}). Try sending it again.`; return true; }
  const acts = (parsed.actions || []).filter(a => a && a.type);
  if (!parsed.is_action || !acts.length) return false;
  waitEl.textContent = 'Getting it ready…';
  let c; try { c = await actTimeout(actContext(), 20000, 'Loading your videos and products'); }
  catch (e) { waitEl.classList.remove('wait'); waitEl.innerHTML = `Couldn't load your data: ${esc(e.message)}. Try again.`; return true; }
  const left = acts.filter(a => a.type === 'whats_left'), rest = acts.filter(a => a.type !== 'whats_left');
  let html = '';
  for (const a of left) html += await actWhatsLeft(c, dOk(a.date));
  const cards = [];
  for (let i = 0; i < rest.length; i++) cards.push(rest[i].type === 'plan_day' ? await actPlanDayCard(rest[i], i, c) : actCardHtml(rest[i], i, c));
  if (cards.length) html += `<p>Here's what I'll do — check it and tap <b>Save</b>:</p>` + cards.join('');
  waitEl.classList.remove('wait');
  waitEl.innerHTML = html;
  return true;
}
function actSkip(k) { const el = document.getElementById(k); el.querySelector('.abtns').remove(); el.querySelector('.astat').textContent = 'Skipped.'; el.classList.add('done'); }
const v$ = (k, s) => document.getElementById(k + s)?.value ?? '';

async function actRun(k, btn) {
  const a = ACT.cards[k], c = await actContext(), stat = document.querySelector(`#${k} .astat`);
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const msg = await ({ plan_day: actPlanDaySave, log_video: actVideo, log_sale: actSale, day_note: actDayNote, film_plan: actFilm, move_day: actMove, mark_filmed: actMark, add_promo: actPromo, product_note: actProdNote })[a.type](k, a, c);
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
  const board = (await plannerGet('filmBoard', {})) || {};
  await actAddToBoard(c, date, p, plan, board); await plannerSet('filmBoard', board);
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

// ─── Daily workflow ────────────────────────────────────────────────────────────
const ACT_GUESS = (n, b) => /vacuum|vac\b|mop|stain|carpet|robot|wet ?dry|steam|cordless|power detect|hydro|clean/i.test(`${n} ${b}`) ? 'vacuum' : 'talking';

// shared: put a product on the Film Board with takes per column (used by film_plan + plan_day)
async function actAddToBoard(c, date, p, plan, board) {
  const { data: existing } = await db.from('queue').select('id,notes').eq('user_id', c.uid).eq('date', date).eq('prod_id', p.id);
  const hasBase = (existing || []).some(r => !/\[copy:\w+\]/.test(r.notes || ''));
  const day = { ...(board[date] || {}) }, acct = p.tiktok_account_id || c.active, rows = [], keys = [];
  plan.forEach((x, i) => {
    const tag = (i === 0 && !hasBase) ? '' : `[copy:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}${i}]`;
    keys.push([String(p.id) + (tag ? '#' + tag.slice(6, -1) : ''), x.col]);
    for (let t = 0; t < x.n; t++) rows.push({ user_id: c.uid, tiktok_account_id: acct, date, prod_id: p.id, name: p.name, brand: p.brand || '', notes: tag, script: '', done: false, sort_order: 900 + i });
  });
  const { error } = await db.from('queue').insert(rows); if (error) throw error;
  keys.forEach(([key, col], i) => { day[key] = { ...(day[key] || {}), style: col, order: 900 + Object.keys(day).length + i }; });
  board[date] = day;
}

async function actPlanDayCard(a, i, c) {
  const date = dOk(a.date), want = Math.min(10, a.count || 5);
  const [{ data: promos }, { data: q90 }, { data: dayQ }, mem, { data: vids }] = await Promise.all([
    db.from('promos').select('product,prod_id,deal,start_date,end_date,priority').eq('user_id', c.uid).lte('start_date', date).gte('end_date', date),
    db.from('queue').select('prod_id,date,done').eq('user_id', c.uid).gte('date', ymd(addDays(new Date(), -120))),
    db.from('queue').select('prod_id').eq('user_id', c.uid).eq('date', date),
    plannerGet('filmStyleMem', {}).catch(() => ({})),
    db.from('videos').select('prod_id').eq('user_id', c.uid).not('prod_id', 'is', null)
  ]);
  const onDay = new Set((dayQ || []).map(r => r.prod_id)), posted = new Set((vids || []).map(v => v.prod_id));
  const last = {}; (q90 || []).filter(r => r.done && r.prod_id).forEach(r => { if (!last[r.prod_id] || r.date > last[r.prod_id]) last[r.prod_id] = r.date; });
  const active = c.prods.filter(p => !/shelved|paused|inactive|archived/i.test(p.status || '') && !onDay.has(p.id));
  const picks = [], seen = new Set(), push = (p, why, takes) => { if (p && !seen.has(p.id) && !onDay.has(p.id)) { seen.add(p.id); picks.push({ p, why, takes }); } };
  const days = d => Math.round((new Date(d + 'T00:00:00') - new Date(date + 'T00:00:00')) / 864e5);
  (promos || []).sort((x, y) => (y.priority ? 1 : 0) - (x.priority ? 1 : 0) || String(x.end_date).localeCompare(String(y.end_date))).forEach(pr => {
    const p = c.prods.find(x => x.id === pr.prod_id) || actProd(c, pr.product)[0]; const d = days(pr.end_date);
    push(p, `${pr.priority ? '★ ' : ''}Promo ${d <= 0 ? 'ends today' : d === 1 ? 'ends tomorrow' : `ends in ${d} days`}`, d <= 2 ? 2 : 1);
  });
  active.filter(p => /FREE_SAMPLE/.test(p.notes || '') && !last[p.id] && !posted.has(p.id)).forEach(p => push(p, 'Free sample — not filmed yet', 1));
  active.filter(p => (+p.units_sold || 0) > 0).map(p => ({ p, gap: last[p.id] ? days(last[p.id]) * -1 : 999 })).filter(x => x.gap >= 7)
    .sort((x, y) => (+y.p.units_sold || 0) - (+x.p.units_sold || 0)).forEach(x => push(x.p, x.gap >= 999 ? `Has sold ${x.p.units_sold} — no recent filming` : `Has sold ${x.p.units_sold} — last filmed ${x.gap} days ago`, 1));
  const list = picks.slice(0, want);
  const k = `a${Date.now().toString(36)}${i}`; ACT.cards[k] = { ...a, type: 'plan_day', list };
  if (!list.length) return `<div class="acard done" id="${k}"><div class="atitle">🗓 Plan ${esc(prettyD(date))}</div><div class="astat">Nothing urgent to add — no live promos, unfilmed samples or best-sellers you've skipped lately.</div></div>`;
  const colSel = (id, sel) => actSel(id, Object.entries(c.cols), sel);
  return `<div class="acard" id="${k}"><div class="atitle">🗓 Plan ${esc(prettyD(date))}</div><input type="hidden" id="${k}_d" value="${date}">
    <div class="sub" style="margin:0 0 8px;font-size:12.5px">Untick anything you don't want, and change the column or takes.</div>
    ${list.map((x, j) => `<div class="aplan"><label class="achk" style="margin:0"><input type="checkbox" id="${k}_on${j}" checked> <b>${esc(x.p.name)}</b></label><div class="awhy">${esc(x.why)}</div>
      <div class="aplanrow">${colSel(`${k}_c${j}`, (mem || {})[x.p.id] || ACT_GUESS(x.p.name, x.p.brand || ''))}<input type="number" min="1" max="10" id="${k}_n${j}" value="${x.takes}" style="max-width:70px"> takes</div></div>`).join('')}
    <div class="abtns"><button class="abtn primary" onclick="actRun('${k}',this)">Add to Film Board</button><button class="abtn" onclick="actSkip('${k}')">Skip</button></div><div class="astat"></div></div>`;
}
async function actPlanDaySave(k, a, c) {
  const date = v$(k, '_d'), board = (await plannerGet('filmBoard', {})) || {}; let n = 0, names = [];
  for (let j = 0; j < a.list.length; j++) {
    if (!document.getElementById(`${k}_on${j}`)?.checked) continue;
    const takes = Math.max(1, Math.min(10, +v$(k, `_n${j}`) || 1));
    await actAddToBoard(c, date, a.list[j].p, [{ col: v$(k, `_c${j}`), n: takes }], board); n += takes; names.push(a.list[j].p.name);
  }
  if (!names.length) throw new Error('nothing ticked');
  await plannerSet('filmBoard', board);
  return `Added ${names.length} product${names.length === 1 ? '' : 's'} (${n} takes) to your Film Board for ${esc(prettyD(date))}: ${names.map(esc).join(', ')}.`;
}

async function actWhatsLeft(c, date) {
  const [{ data: q }, { data: promos }, board] = await Promise.all([
    db.from('queue').select('prod_id,name,done,script,notes').eq('user_id', c.uid).eq('date', date),
    db.from('promos').select('product,end_date,priority').eq('user_id', c.uid).lte('start_date', date).gte('end_date', date),
    plannerGet('filmBoard', {}).catch(() => ({}))
  ]);
  const rows = q || [], meta = (board || {})[date] || {};
  const g = {}; rows.forEach(r => { const tag = (String(r.notes || '').match(/\[copy:(\w+)\]/) || [])[1]; const key = String(r.prod_id || String(r.name || '').toLowerCase()) + (tag ? '#' + tag : '');
    (g[key] = g[key] || { name: r.name, key, rows: [] }).rows.push(r); });
  const groups = Object.values(g), open = groups.filter(x => x.rows.some(r => !r.done));
  const left = open.reduce((s, x) => s + x.rows.filter(r => !r.done).length, 0), doneN = rows.filter(r => r.done).length;
  const ending = (promos || []).filter(p => Math.round((new Date(p.end_date + 'T00:00:00') - new Date(date + 'T00:00:00')) / 864e5) <= 2);
  const col = x => c.cols[meta[x.key]?.style] || '';
  if (!rows.length) return `<p><b>${esc(prettyD(date))}</b>: nothing on your Film Board yet. Say <b>"plan my day"</b> and I'll fill it.</p>`;
  if (!left) return `<p>🎉 Everything on <b>${esc(prettyD(date))}</b> is filmed — ${doneN} take${doneN === 1 ? '' : 's'} done.</p>`;
  return `<p><b>${left} take${left === 1 ? '' : 's'} left</b> on ${esc(prettyD(date))} (${doneN} done):</p><ul>${open.map(x => { const n = x.rows.filter(r => !r.done).length, noScript = x.rows.every(r => !String(r.script || '').trim());
      const pr = (promos || []).find(p => actScore(x.name, p.product) >= 60);
      return `<li><b>${esc(x.name)}</b> — ${n} take${n === 1 ? '' : 's'}${col(x) ? ` · ${esc(col(x))}` : ''}${noScript ? ' · <i>no script yet</i>' : ''}${pr ? ` · ★ promo` : ''}</li>`; }).join('')}</ul>`
    + (ending.length ? `<p class="note">⏳ Ending in 2 days or less: ${ending.map(p => esc(p.product)).join(', ')}</p>` : '');
}

async function actVideo(k, a, c) {
  const title = v$(k, '_t').trim(), pid = v$(k, '_p'), acct = v$(k, '_acct'), date = v$(k, '_d') || ymd(new Date());
  if (!title) throw new Error('add the caption'); if (!acct) throw new Error('pick the account');
  const p = c.prods.find(x => x.id === pid);
  const row = { user_id: c.uid, title, brand: p?.name || '', date, status: 'live', views: 0, units: 0, gmv: 0, notes: '', link: v$(k, '_l').trim(), prod_id: p?.id || null, tiktok_account_id: acct, high_quality: !!document.getElementById(k + '_hq')?.checked };
  let { error } = await db.from('videos').insert(row);
  if (error && /(prod_id|high_quality|link)/i.test(error.message || '')) { const f = { ...row }; ['prod_id', 'high_quality', 'link'].forEach(x => { if (new RegExp(x, 'i').test(error.message)) delete f[x]; }); ({ error } = await db.from('videos').insert(f)); }
  if (error) throw error;
  let extra = '';
  if (p && document.getElementById(k + '_m')?.checked) {
    const { data } = await db.from('queue').select('id').eq('user_id', c.uid).eq('date', date).eq('prod_id', p.id).eq('done', false).order('sort_order').limit(1);
    if (data?.[0]) { await db.from('queue').update({ done: true }).eq('id', data[0].id).eq('user_id', c.uid); extra = ' and marked a take filmed'; }
    else extra = ' (no unfilmed take for it on that day to check off)';
  }
  return `Added to your Content Tracker on ${esc(c.acctName(acct))}${extra}.`;
}
