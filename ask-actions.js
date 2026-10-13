// ─── Ask Take24: do things, not just answer ─────────────────────────────────────
// Log sales (video or showcase), sales-day notes, plan the Film Board, move a day,
// mark takes filmed, add a promo, add a product note. Every action shows a confirm card first.
// Needs supabase.js (db), planner-sync.js, promos-sync.js and ask.html's gemText/add/esc/ymd/addDays.

const ACT = { ctx: null, pendingNote: null, cards: {} };
const actTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' took too long')), ms))]);
const ACT_COLS_DEFAULT = { talking: '🗣 Talking head', vacuum: '🎬 Demo / voiceover', faceless: '✨ Aesthetic / faceless', car: '🚗 Car' };

// quick gate so plain questions skip the extra AI call
function actLooksLikeAction(t) {
  return /\b(made|sold|sale|sales|gmv|commission|comm\b|log|add|put|plan|film|filming|move|mark|filmed|promo|note|notes|schedule|takes?|posted|post|uploaded|left|today|tomorrow|day|hq|high quality|script|scripts|caption|hashtags?|hook|write|product|products|sample|samples|got|stock|restock|shelve|shelved|promote|goal|goals|remind|reminder|reminders)\b/i.test(t);
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
    type: { type: 'STRING', enum: ['log_sale', 'day_note', 'film_plan', 'move_day', 'mark_filmed', 'add_promo', 'product_note', 'plan_day', 'whats_left', 'log_video', 'write_script', 'add_product', 'set_status', 'mark_hq', 'set_goal', 'add_reminder'] },
    date: { type: 'STRING' }, to_date: { type: 'STRING' },
    source: { type: 'STRING', enum: ['video', 'showcase'] },
    caption: { type: 'STRING' }, product: { type: 'STRING' }, account: { type: 'STRING' },
    units: { type: 'NUMBER' }, gmv: { type: 'NUMBER' }, comm: { type: 'NUMBER' },
    note: { type: 'STRING' }, count: { type: 'NUMBER' },
    columns: { type: 'ARRAY', items: { type: 'OBJECT', properties: { column: { type: 'STRING', enum: ['talking', 'vacuum', 'faceless', 'car'] }, takes: { type: 'NUMBER' } }, required: ['column', 'takes'] } },
    link: { type: 'STRING' }, high_quality: { type: 'BOOLEAN' }, column: { type: 'STRING' },
    metric: { type: 'STRING', enum: ['gmv', 'comm', 'units', 'videos'] }, amount: { type: 'NUMBER' }, period: { type: 'STRING', enum: ['month', 'week', 'day'] },
    brand: { type: 'STRING' }, free_sample: { type: 'BOOLEAN' }, status: { type: 'STRING', enum: ['active', 'paused', 'shelved', 'promote'] }, hq: { type: 'BOOLEAN' },
    funnel: { type: 'STRING', enum: ['Top', 'Middle'] }, on_sale: { type: 'BOOLEAN' }, angle: { type: 'STRING' },
    focus: { type: 'ARRAY', items: { type: 'STRING', enum: ['promos', 'outliers', 'video_sales', 'showcase_sales', 'samples', 'not_filmed_lately'] } }, days: { type: 'NUMBER' },
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
- plan_day: she wants the app to PLAN/FILL her filming day for her ("plan my day", "what should I film today, add it", "fill my board for tomorrow"). date, count = how many products if she says (else 0). focus = ONLY if she says what to base it on, in her order: promos, outliers (high-view / viral / outlier videos), video_sales (products that sold from videos), showcase_sales, samples (free samples), not_filmed_lately. "based on what sold from videos recently" → ["video_sales"]. "promos and outliers" → ["promos","outliers"]. "what's been selling" (no source) → ["video_sales","showcase_sales"]. days = lookback if she says ("this week" → 7, "recently" → 0 = default, "this month" → 30).
- whats_left: she asks what's left / still to film / to do today (date). Not a general strategy question.
- set_goal: she sets a goal ("my goal is $2k GMV this month", "I want $300 commission this week", "goal: 50 sales this month"). metric gmv / comm (commission) / units (sales/units) / videos (videos posted — "post 3 videos a day", "60 videos this month"), amount as a plain number, period month (default), week, or day ("a day" / "per day" / "daily"). Asking HOW she's doing on a goal is NOT an action.
- add_reminder: a reminder or to-do that isn't filming a product ("remind me to repost the CryoGlow Friday", "remind me to email QVC tomorrow"). note = the reminder in short plain words, date.
- add_product: she got / wants to add a NEW product ("I got a free sample of the X from Y", "add the X to my products"). product = product name as she says it, brand, link if she pastes one, free_sample true if she says free sample / sample / they sent it, note = anything else she says about it.
- set_status: change a product's stock status. product, status: "active" (back in stock / restock / unshelve), "paused" (out of stock), "shelved" (shelve / stop promoting / done with it), "promote" (push it / promote now).
- mark_hq: mark a posted video high quality (or not). caption = words from the caption/description she gives, product if she names it, hq = false only if she says NOT high quality.
- write_script: she wants a video SCRIPT written (or a caption/hashtags for a product). product, funnel ("Middle" if she says middle of funnel / push the sale / get them to buy, else "Top"), on_sale true only if she says it's on sale/promo, column = the filming style if she says it, angle = any specific idea/angle/hook she mentions, date if she says one.
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
  } else if (a.type === 'set_goal') {
    title = '🎯 Set a goal';
    body = `<div class="arow3">${row('Goal', actSel(k + '_m', [['gmv', 'GMV $'], ['comm', 'Commission $'], ['units', 'Units sold'], ['videos', 'Videos posted']], a.metric || 'gmv'))}${row('Amount', `<input type="number" min="0" id="${k}_amt" value="${a.amount || ''}">`)}${row('Per', actSel(k + '_per', [['month', 'Month'], ['week', 'Week'], ['day', 'Day']], a.period || 'month'))}</div><div class="sub" style="font-size:12px;margin:0">Counts both accounts. Ask "am I on pace?" anytime.</div>`;
  } else if (a.type === 'add_reminder') {
    title = '⏰ Add a reminder';
    body = row('Reminder', `<input id="${k}_n" value="${esc(a.note || '')}">`) + row('Day', `<input type="date" id="${k}_d" value="${date}">`) + `<div class="sub" style="font-size:12px;margin:0">Shows on your Home to-do that day (not on the Film Board).</div>`;
  } else if (a.type === 'set_status') {
    title = '📦 Change stock status';
    const st = a.status || 'active';
    body = row('Product', actProdSel(c, k + '_p', a.product)) + row('Status', actSel(k + '_st', [['active', 'In stock'], ['paused', 'Out of stock'], ['promote', 'Promote now'], ['shelved', 'Shelved']], st));
  } else if (a.type === 'mark_hq') {
    title = a.hq === false ? '☆ Remove high quality' : '★ Mark high quality';
    const m = actFind(c.vids, `${a.caption || ''} ${a.product || ''}`.trim(), 'title', 30);
    const opts = (m.length ? m : c.vids.slice(0, 40)).map(v => [v.id, `${String(v.title || 'Untitled').slice(0, 60)} · ${String(v.date || '').slice(5, 10)} · ${c.acctName(v.tiktok_account_id)}`]);
    body = row('Video', (m.length ? '' : `<div class="awarn">Couldn't find "${esc(a.caption || a.product || '')}" — pick it:</div>`) + actSel(k + '_v', opts, m[0]?.id))
      + `<label class="achk"><input type="checkbox" id="${k}_hq"${a.hq === false ? '' : ' checked'}> High quality</label>`;
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
  const strong = /\b(made|log|logged|sold)\b.*\b(sale|sales|gmv|commission)\b|\b(add|put)\b.*\b(film ?board|board|to-?do)\b|\bplan my\b|\bposted\b|\bwrite\b.*\bscript\b/i.test(text);
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
  for (let i = 0; i < rest.length; i++) { const t = rest[i].type; if (t === 'write_script') waitEl.textContent = 'Writing your script…'; if (t === 'add_product') waitEl.textContent = 'Looking it up on TikTok Shop…'; cards.push(t === 'plan_day' ? await actPlanDayCard(rest[i], i, c) : t === 'write_script' ? await actScriptCard(rest[i], i, c) : t === 'add_product' ? await actAddProductCard(rest[i], i, c) : actCardHtml(rest[i], i, c)); }
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
    const msg = await ({ set_goal: actGoal, add_reminder: actReminder, add_product: actAddProductSave, set_status: actStatus, mark_hq: actHQ, write_script: actScriptSave, plan_day: actPlanDaySave, log_video: actVideo, log_sale: actSale, day_note: actDayNote, film_plan: actFilm, move_day: actMove, mark_filmed: actMark, add_promo: actPromo, product_note: actProdNote })[a.type](k, a, c);
    const el = document.getElementById(k); el.querySelector('.abtns').remove(); el.classList.add('done');
    el.querySelectorAll('input,select,textarea').forEach(x => x.disabled = true);
    stat.innerHTML = '✓ ' + msg;
    if (typeof celebrate === 'function') { if (a.type === 'log_sale') celebrate('Sale logged! 💰', { count: 120 }); else if (a.type === 'set_goal') celebrate('Goal set — let\'s go! 🎯', { count: 80 }); else if (a.type === 'add_product') celebrate('', { count: 50 }); }
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
  const { data } = await db.from('queue').select('id').eq('user_id', c.uid).eq('date', date).eq('prod_id', pid).eq('done', false).order('sort_order').order('id');
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
  const date = dOk(a.date), want = Math.min(10, a.count || 5), look = Math.min(365, Math.max(3, a.days || 60));
  const FOCUS = ['promos', 'outliers', 'video_sales', 'showcase_sales', 'samples', 'not_filmed_lately'];
  const focus = (a.focus || []).filter(f => FOCUS.includes(f));
  const since = ymd(addDays(new Date(), -look));
  const [{ data: promos }, { data: q90 }, { data: dayQ }, mem, { data: vids }, { data: sales }] = await Promise.all([
    db.from('promos').select('product,prod_id,deal,start_date,end_date,priority').eq('user_id', c.uid).lte('start_date', date).gte('end_date', date),
    db.from('queue').select('prod_id,date,done').eq('user_id', c.uid).gte('date', ymd(addDays(new Date(), -120))),
    db.from('queue').select('prod_id').eq('user_id', c.uid).eq('date', date),
    plannerGet('filmStyleMem', {}).catch(() => ({})),
    db.from('videos').select('id,prod_id,title,brand,views,units,gmv,date').eq('user_id', c.uid).gte('date', since),
    db.from('sales').select('video_sales,date').eq('user_id', c.uid).gte('date', since)
  ]);
  const allVids = [...(vids || []), ...c.vids.filter(v => !(vids || []).some(x => x.id === v.id))];
  const onDay = new Set((dayQ || []).map(r => r.prod_id)), posted = new Set(allVids.filter(v => v.prod_id).map(v => v.prod_id));
  const off = p => /shelved|paused|inactive|archived/i.test(p?.status || '');
  const vidProd = v => c.prods.find(p => p.id === v.prod_id) || (v.brand ? c.prods.find(p => actNorm(p.name) === actNorm(v.brand)) : null) || actProd(c, `${v.brand || ''} ${v.title || ''}`)[0] || null;
  const last = {}; (q90 || []).filter(r => r.done && r.prod_id).forEach(r => { if (!last[r.prod_id] || r.date > last[r.prod_id]) last[r.prod_id] = r.date; });
  const days = d => Math.round((new Date(d + 'T00:00:00') - new Date(date + 'T00:00:00')) / 864e5);
  const src = {}; FOCUS.forEach(f => src[f] = []);
  const add = (f, p, why, takes) => { if (p && !off(p) && !onDay.has(p.id)) src[f].push({ p, why, takes }); };
  (promos || []).sort((x, y) => (y.priority ? 1 : 0) - (x.priority ? 1 : 0) || String(x.end_date).localeCompare(String(y.end_date))).forEach(pr => {
    const d = days(pr.end_date); add('promos', c.prods.find(x => x.id === pr.prod_id) || actProd(c, pr.product)[0], `${pr.priority ? '★ ' : ''}Promo ${d <= 0 ? 'ends today' : d === 1 ? 'ends tomorrow' : `ends in ${d} days`}`, d <= 2 ? 2 : 1); });
  const vv = (vids || []).filter(v => +v.views > 0), avg = vv.length ? vv.reduce((s, v) => s + +v.views, 0) / vv.length : 0;
  vv.filter(v => avg && +v.views >= avg * 1.5).sort((x, y) => y.views - x.views)
    .forEach(v => add('outliers', vidProd(v), `Outlier video — ${Number(v.views).toLocaleString()} views (${(v.views / avg).toFixed(1)}× your average)`, 2));
  const sold = { video: {}, showcase: {} };
  (sales || []).forEach(d => { let r = d.video_sales; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } }
    (Array.isArray(r) ? r : []).forEach(x => { const sc = x.source === 'showcase';
      const p = sc ? c.prods.find(pp => pp.id === x.product_id) : (() => { const v = allVids.find(vv => String(vv.id) === String(x.video_id)); return v ? vidProd(v) : null; })();
      if (!p) return; const m = sold[sc ? 'showcase' : 'video']; m[p.id] = m[p.id] || { p, u: 0, g: 0, n: 0 }; m[p.id].u += +x.units || 0; m[p.id].g += +x.gmv || 0; m[p.id].n++; }); });
  (vids || []).filter(v => (+v.units || 0) > 0 || (+v.gmv || 0) > 0).forEach(v => { const p = vidProd(v); if (p && !sold.video[p.id]) sold.video[p.id] = { p, u: +v.units || 0, g: +v.gmv || 0 }; });
  Object.values(sold.video).sort((x, y) => y.g - x.g || y.u - x.u).forEach(x => add('video_sales', x.p, `Sold from videos — ${x.u} sold${x.g ? `, $${x.g.toFixed(0)} GMV` : ''} in the last ${look} days`, x.u >= 1 || x.g > 0 ? 2 : 1));
  Object.values(sold.showcase).sort((x, y) => y.g - x.g || y.u - x.u).forEach(x => add('showcase_sales', x.p, `Sold from your showcase — ${x.u} sold${x.g ? `, $${x.g.toFixed(0)} GMV` : ''} in the last ${look} days`, 1));
  c.prods.filter(p => /FREE_SAMPLE/.test(p.notes || '') && !last[p.id] && !posted.has(p.id)).forEach(p => add('samples', p, 'Free sample — not filmed yet', 1));
  c.prods.filter(p => (+p.units_sold || 0) > 0).map(p => ({ p, gap: last[p.id] ? -days(last[p.id]) : 999 })).filter(x => x.gap >= 7)
    .sort((x, y) => (+y.p.units_sold || 0) - (+x.p.units_sold || 0)).forEach(x => add('not_filmed_lately', x.p, x.gap >= 999 ? `Has sold ${x.p.units_sold} — no recent filming` : `Has sold ${x.p.units_sold} — last filmed ${x.gap} days ago`, 1));
  // order: what she asked for, otherwise the default priority
  const order = focus.length ? focus : ['promos', 'outliers', 'video_sales', 'showcase_sales', 'samples', 'not_filmed_lately'];
  const picks = [], seen = new Set();
  order.forEach(f => src[f].forEach(x => { if (!seen.has(x.p.id)) { seen.add(x.p.id); picks.push(x); } }));
  const list = picks.slice(0, want);
  const k = `a${Date.now().toString(36)}${i}`; ACT.cards[k] = { ...a, type: 'plan_day', list };
  const focusLbl = { promos: 'promos', outliers: 'outlier videos', video_sales: 'products selling from videos', showcase_sales: 'showcase sales', samples: 'free samples', not_filmed_lately: "best sellers you haven't filmed lately" };
  if (!list.length) return `<div class="acard done" id="${k}"><div class="atitle">🗓 Plan ${esc(prettyD(date))}</div><div class="astat">${focus.length ? `Couldn't find any ${focus.map(f => focusLbl[f]).join(' or ')} to add${focus.some(f => /sales|outliers/.test(f)) ? ` in the last ${look} days` : ''} (that aren't already on the board).` : "Nothing urgent to add — no live promos, outliers, recent sellers or unfilmed samples."}</div></div>`;
  const colSel = (id, sel) => actSel(id, Object.entries(c.cols), sel);
  return `<div class="acard" id="${k}"><div class="atitle">🗓 Plan ${esc(prettyD(date))}</div><input type="hidden" id="${k}_d" value="${date}">
    <div class="sub" style="margin:0 0 8px;font-size:12.5px">${focus.length ? `Based on ${focus.map(f => focusLbl[f]).join(' + ')}${focus.some(f => /sales|outliers/.test(f)) ? ` (last ${look} days)` : ''}. ` : ''}Untick anything you don't want, and change the column or takes.</div>
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
  const all = q || [], rems = all.filter(r => /^REMINDER$/m.test(r.notes || '')), rows = all.filter(r => !/^REMINDER$/m.test(r.notes || '')), meta = (board || {})[date] || {};
  const remHtml = rems.length ? `<p><b>⏰ Reminders:</b></p><ul>${rems.map(r => `<li>${r.done ? '✓ <s>' : ''}${esc(r.name)}${r.done ? '</s>' : ''}</li>`).join('')}</ul>` : '';
  const g = {}; rows.forEach(r => { const tag = (String(r.notes || '').match(/\[copy:(\w+)\]/) || [])[1]; const key = String(r.prod_id || String(r.name || '').toLowerCase()) + (tag ? '#' + tag : '');
    (g[key] = g[key] || { name: r.name, key, rows: [] }).rows.push(r); });
  const groups = Object.values(g), open = groups.filter(x => x.rows.some(r => !r.done));
  const left = open.reduce((s, x) => s + x.rows.filter(r => !r.done).length, 0), doneN = rows.filter(r => r.done).length;
  const ending = (promos || []).filter(p => Math.round((new Date(p.end_date + 'T00:00:00') - new Date(date + 'T00:00:00')) / 864e5) <= 2);
  const col = x => c.cols[meta[x.key]?.style] || '';
  if (!rows.length) return `<p><b>${esc(prettyD(date))}</b>: nothing on your Film Board yet. Say <b>"plan my day"</b> and I'll fill it.</p>` + remHtml;
  if (!left) return `<p>🎉 Everything on <b>${esc(prettyD(date))}</b> is filmed — ${doneN} take${doneN === 1 ? '' : 's'} done.</p>` + remHtml;
  return `<p><b>${left} take${left === 1 ? '' : 's'} left</b> on ${esc(prettyD(date))} (${doneN} done):</p><ul>${open.map(x => { const n = x.rows.filter(r => !r.done).length, noScript = x.rows.every(r => !String(r.script || '').trim());
      const pr = (promos || []).find(p => actScore(x.name, p.product) >= 60);
      return `<li><b>${esc(x.name)}</b> — ${n} take${n === 1 ? '' : 's'}${col(x) ? ` · ${esc(col(x))}` : ''}${noScript ? ' · <i>no script yet</i>' : ''}${pr ? ` · ★ promo` : ''}</li>`; }).join('')}</ul>`
    + (ending.length ? `<p class="note">⏳ Ending in 2 days or less: ${ending.map(p => esc(p.product)).join(', ')}</p>` : '') + remHtml;
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
    const { data } = await db.from('queue').select('id').eq('user_id', c.uid).eq('date', date).eq('prod_id', p.id).eq('done', false).order('sort_order').order('id').limit(1);
    if (data?.[0]) { await db.from('queue').update({ done: true }).eq('id', data[0].id).eq('user_id', c.uid); extra = ' and marked a take filmed'; }
    else extra = ' (no unfilmed take for it on that day to check off)';
  }
  return `Added to your Content Tracker on ${esc(c.acctName(acct))}${extra}.`;
}

// ─── Scripts from Ask ───────────────────────────────────────────────────────────
async function actGemJSON(prompt, schema, temp = 0.7, ms = 60000) {
  const res = await fetch(`${WORKER}/?service=gemini&model=gemini-2.5-flash`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: temp, responseMimeType: 'application/json', responseSchema: schema } }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined });
  const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.error?.message || `Gemini error (${res.status})`);
  return JSON.parse((data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join(''));
}
function actVoice() {
  const ban = `- NEVER use: "okay", "honestly", "you guys", or "like" as filler (only for real comparisons). Never open with "Okay", "Ok so", "So," or "Alright".
- No cringe ad-speak: "game changer", "holy grail", "you NEED this", "run don't walk", "life-changing", all-caps hype.
- NEVER say a price, dollar amount, or % off. Talk about a deal without numbers.
- Every line earns its place: specific > generic.`;
  const real = typeof voicePromptSync === 'function' ? voicePromptSync() : '';
  return `${real || 'VOICE: warm, natural, confident — a real person talking to a friend, short sentences, contractions, real-life moments.'}\n${ban}\n${typeof TTS_POLICY_SHORT !== 'undefined' ? '- ' + TTS_POLICY_SHORT : ''}${typeof playbookPromptSync === 'function' ? playbookPromptSync() : ''}${typeof voiceEditsPromptSync === 'function' ? voiceEditsPromptSync() : ''}`;
}
function actClean(ps) {
  return (ps || []).map(p => { const t = String(p).replace(/^\s*(okay|ok|alright|all right)\b[\s,.!…-]*(so\b[\s,]*)?/i, '')
    .replace(/,?\s*\bhonestly\b,?/gi, '').replace(/,?\s*\byou guys\b,?/gi, '').replace(/,\s*like,/gi, ',').replace(/(^|[.!?]\s+)like,\s*/gi, '$1')
    .replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : p; }).filter(Boolean);
}
async function actWriteScript(c, p, a) {
  const funnel = a.funnel === 'Middle' ? 'Middle' : 'Top';
  const facts = [`Name: ${p.name}`, p.brand ? `Brand: ${p.brand}` : '', String(p.notes || '').replace(/FREE_SAMPLE/g, '').replace(/TikTok Shop (price|sold count) seen:.*$/gim, '').trim() ? `Her notes: ${String(p.notes).replace(/FREE_SAMPLE/g, '').slice(0, 800)}` : ''].filter(Boolean).join('\n');
  const style = { talking: 'talking to camera', vacuum: 'demo / voiceover over the product in use', faceless: 'aesthetic / faceless — voiceover over hands, product and B-roll, she is never on camera', car: 'filmed in her car, talking to camera' }[a.column] || 'talking to camera';
  const fun = funnel === 'Middle'
    ? `FUNNEL: MIDDLE — the viewer already knows this product. Don't re-explain it or list features (one quick reminder of the main benefit at most). Get them to finally buy: name the hesitation and answer it, what life is like once you have it, real reassurance, a confident-but-soft push. ${a.on_sale ? 'It IS on a promo right now, so the deal can be one reason to buy now (no numbers).' : 'It is NOT on a promo — do NOT mention sales, discounts, deals, coupons or "the price right now". No fake urgency.'} About 20–30 seconds.`
    : `FUNNEL: TOP — the viewer has never seen this product. Hook with a relatable problem or strong visual moment, then really show and explain it: what it is, how it works, 2–3 specific features tied to a real benefit, what makes it different, a quick real-life use. ${a.on_sale ? 'It is on sale right now — mention it briefly, no numbers.' : ''} About 30–45 seconds.`;
  const sc = await actGemJSON(`Write a TikTok Shop video script (spoken lines only, 5–8 short paragraphs) for ${p.name}${p.brand ? ' by ' + p.brand : ''}.
${actVoice()}
Filming style: ${style}.
${fun}
${a.angle ? `Her idea / angle for this one: ${a.angle}` : 'Pick the most convincing everyday angle yourself.'}
PRODUCT FACTS (use these; don't invent features, specs or claims that aren't here; never quote prices):
${facts}
End with a soft, casual close like "I tagged it below" — never "click the link" or "tap the orange cart".
Also write: a short title (3–6 words), and a ready-to-post caption in her voice (1–3 short sentences, under 150 characters) plus exactly 5 hashtags, most relevant first. Also 10–15 SEO words: short lowercase search phrases people would actually type into TikTok search to find this video (product name/type, brand, the problem it solves, who it's for), no hashtags.`,
    { type: 'OBJECT', properties: { title: { type: 'STRING' }, paragraphs: { type: 'ARRAY', items: { type: 'STRING' } }, caption: { type: 'STRING' }, hashtags: { type: 'ARRAY', items: { type: 'STRING' } }, seo: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['title', 'paragraphs', 'caption', 'hashtags', 'seo'] });
  let pol = null;
  try {
    pol = await actGemJSON(`Check this TikTok Shop affiliate script and caption against TikTok Shop content policy and her hard rules.${typeof playbookRulesSync === 'function' ? playbookRulesSync() : ''}
${typeof TTS_POLICY !== 'undefined' ? TTS_POLICY : ''}
Also: NO prices, dollar amounts or % of any kind; no "free"; no directing people off TikTok; no medical/cure claims; no "best/#1/guaranteed". If it's fine return passed=true, issues=[] and everything unchanged. If not, return passed=false, list each issue in plain words, and return FIXED versions with the smallest possible changes, same voice.
SCRIPT:
${sc.paragraphs.join('\n\n')}
CAPTION: ${sc.caption}`, { type: 'OBJECT', properties: { passed: { type: 'BOOLEAN' }, issues: { type: 'ARRAY', items: { type: 'STRING' } }, paragraphs: { type: 'ARRAY', items: { type: 'STRING' } }, caption: { type: 'STRING' } }, required: ['passed', 'issues', 'paragraphs', 'caption'] }, 0.2, 45000);
  } catch (e) { console.warn('policy check', e); }
  const paragraphs = actClean(pol?.paragraphs?.length ? pol.paragraphs : sc.paragraphs);
  const tags = (sc.hashtags || []).slice(0, 5).map(h => '#' + String(h).replace(/^#/, '').replace(/\s+/g, ''));
  return { title: sc.title || p.name, paragraphs, caption: `${(pol?.caption || sc.caption || '').trim()}\n\n${tags.join(' ')}`.trim(), passed: pol ? pol.passed : null, issues: pol?.issues || [], funnel, seo: (sc.seo || []).map(w => String(w).replace(/^#/, '').trim().toLowerCase()).filter(Boolean).slice(0, 15).join(', ') };
}
async function actScriptCard(a, i, c) {
  const p = actProd(c, a.product || '')[0];
  const k = `a${Date.now().toString(36)}${i}`;
  if (!p) return `<div class="acard done" id="${k}"><div class="atitle">✍️ Script</div><div class="astat">I couldn't find "${esc(a.product || '')}" in your Products. Check the name and ask again.</div></div>`;
  let sc; try { sc = await actTimeout(actWriteScript(c, p, a), 110000, 'Writing the script'); }
  catch (e) { return `<div class="acard done" id="${k}"><div class="atitle">✍️ Script for ${esc(p.name)}</div><div class="astat">Couldn't write it: ${esc(e.message)}. Try again.</div></div>`; }
  const date = dOk(a.date);
  const [{ data: q }, mem] = await Promise.all([db.from('queue').select('id').eq('user_id', c.uid).eq('date', date).eq('prod_id', p.id).limit(1), plannerGet('filmStyleMem', {}).catch(() => ({}))]);
  ACT.cards[k] = { ...a, type: 'write_script', pid: p.id, sc };
  const col = a.column || (mem || {})[p.id] || ACT_GUESS(p.name, p.brand || '');
  const pol = sc.passed === true ? '<span class="apol ok">✓ Policy check passed</span>' : sc.passed === false ? '<span class="apol fix">Policy fixes applied</span>' : '';
  return `<div class="acard" id="${k}"><div class="atitle">✍️ ${esc(sc.title)} <small style="font-weight:600;color:var(--text-muted)">· ${esc(p.name)} · ${sc.funnel} of funnel</small> ${pol}</div>
    ${sc.passed === false && sc.issues.length ? `<div class="awarn" style="margin-bottom:8px">Fixed: ${sc.issues.map(esc).join(' · ')}</div>` : ''}
    <div class="arow"><label>Script — edit any line; your changes teach it your voice</label><textarea id="${k}_s" rows="${Math.min(16, sc.paragraphs.length * 2 + 2)}">${esc(sc.paragraphs.join('\n\n'))}</textarea></div>
    <div class="arow"><label>Caption + hashtags</label><textarea id="${k}_cap" rows="3">${esc(sc.caption)}</textarea></div>
    <div class="arow"><label>SEO words</label><textarea id="${k}_seo" rows="2">${esc(sc.seo || '')}</textarea></div>
    <div class="arow3" style="grid-template-columns:1fr 1fr"><div class="arow"><label>Film Board day</label><input type="date" id="${k}_d" value="${date}"></div><div class="arow"><label>Column ${q?.length ? '(already on the board)' : ''}</label>${actSel(k + '_col', Object.entries(c.cols), col)}</div></div>
    <label class="achk"><input type="checkbox" id="${k}_fb" checked> Put it on my Film Board ${q?.length ? '(fills the next take with no script)' : '(adds the product with 1 take)'}</label>
    <label class="achk"><input type="checkbox" id="${k}_v"> Also save to Script Vault</label>
    <div class="abtns"><button class="abtn primary" onclick="actRun('${k}',this)">Save</button><button class="abtn" onclick="navigator.clipboard.writeText(document.getElementById('${k}_s').value);this.textContent='✓ Copied'">Copy script</button><button class="abtn" onclick="actSkip('${k}')">Skip</button></div><div class="astat"></div></div>`;
}
async function actScriptSave(k, a, c) {
  const p = c.prods.find(x => x.id === a.pid), date = v$(k, '_d'), script = v$(k, '_s').trim(), caption = v$(k, '_cap').trim(), seo = v$(k, '_seo').trim();
  if (!script) throw new Error('the script is empty');
  const done = [];
  // learn from her edits (paragraph by paragraph)
  const mine = script.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  if (typeof addVoiceEdits === 'function' && mine.length === a.sc.paragraphs.length) {
    const pairs = mine.map((m, j) => ({ ai: a.sc.paragraphs[j], mine: m, product: p.name, funnel: a.sc.funnel })).filter(x => x.ai.trim() !== x.mine);
    if (pairs.length) { try { await addVoiceEdits(pairs); done.push(`learned ${pairs.length} rewritten line${pairs.length === 1 ? '' : 's'}`); } catch (e) {} }
  }
  if (document.getElementById(k + '_fb')?.checked) {
    let { data: rows } = await db.from('queue').select('id,notes,script').eq('user_id', c.uid).eq('date', date).eq('prod_id', p.id).order('sort_order').order('id');
    const board = (await plannerGet('filmBoard', {})) || {};
    if (!rows?.length) { await actAddToBoard(c, date, p, [{ col: v$(k, '_col'), n: 1 }], board); ({ data: rows } = await db.from('queue').select('id,notes,script').eq('user_id', c.uid).eq('date', date).eq('prod_id', p.id).order('sort_order').order('id')); }
    const isBase = r => !/\[copy:\w+\]/.test(r.notes || ''), empty = r => !String(r.script || '').trim();
    const target = (rows || []).find(r => isBase(r) && empty(r)) || (rows || []).find(empty) || (rows || [])[0];
    if (!target) throw new Error('could not find a take to attach it to');
    const { error } = await db.from('queue').update({ script }).eq('id', target.id).eq('user_id', c.uid); if (error) throw error;
    const tag = (String(target.notes || '').match(/\[copy:(\w+)\]/) || [])[1], key = String(p.id) + (tag ? '#' + tag : '');
    board[date] = { ...(board[date] || {}) }; board[date][key] = { ...(board[date][key] || {}), caption, seo, style: board[date][key]?.style || v$(k, '_col') };
    await plannerSet('filmBoard', board);
    done.push(`on your Film Board for ${esc(prettyD(date))} (take ${(rows || []).indexOf(target) + 1}) with the caption + SEO words`);
  }
  if (document.getElementById(k + '_v')?.checked) {
    const { error } = await db.from('scripts').insert({ user_id: c.uid, title: a.sc.title, brand: p.name, cat: 'review', script, notes: [caption ? `Caption:\n${caption}` : '', seo ? `SEO words:\n${seo}` : ''].filter(Boolean).join('\n\n') });
    if (error) throw error; done.push('saved to Script Vault');
  }
  if (!done.length) throw new Error('tick at least one place to save it');
  return `Script for <b>${esc(p.name)}</b>: ${done.join(' · ')}.`;
}

// ─── Products from Ask ──────────────────────────────────────────────────────────
async function actAddProductCard(a, i, c) {
  const k = `a${Date.now().toString(36)}${i}`, name = String(a.product || '').trim();
  const dupe = name ? actProd(c, name)[0] : null;
  let found = [], err = '';
  try {
    if (/^https?:\/\//i.test(a.link || '')) { const p = typeof shopFromLink === 'function' ? await shopFromLink(a.link) : null; if (p) found = [p]; }
    if (!found.length && name && typeof shopSearch === 'function') found = await shopSearch(`${a.brand || ''} ${name}`.trim());
  } catch (e) { err = e.message; }
  ACT.cards[k] = { ...a, type: 'add_product', found };
  const opt = (p, j) => `<label class="ashop"><input type="radio" name="${k}_pick" value="${j}"${j === 0 ? ' checked' : ''}><img src="${esc(p.image_url || 'icons/default-product.png')}" onerror="this.src='icons/default-product.png'"><span><b>${esc(p.name)}</b><small>${esc(p.brand || 'TikTok Shop')}${p.sold ? ` · ${Number(p.sold).toLocaleString()} sold` : ''}</small></span></label>`;
  return `<div class="acard" id="${k}"><div class="atitle">➕ Add a product</div>
    ${dupe ? `<div class="awarn" style="margin-bottom:8px">You already have <b>${esc(dupe.name)}</b> in Products — still add a new one?</div>` : ''}
    ${found.length ? `<div class="arow"><label>Pick the TikTok Shop listing (fills in the photo + link)</label>${found.map(opt).join('')}<label class="ashop"><input type="radio" name="${k}_pick" value="-1"><span><b>None of these</b><small>just add it with the name below</small></span></label></div>`
      : `<div class="awarn" style="margin-bottom:8px">${err ? `TikTok Shop search didn't work (${esc(err)}) — ` : "Couldn't find it on TikTok Shop — "}I'll add it with just the name. You can add the photo later.</div>`}
    <div class="arow3" style="grid-template-columns:1fr 1fr"><div class="arow"><label>Name in your Products</label><input id="${k}_n" value="${esc(name)}" placeholder="${esc(found[0]?.name || 'Product name')}"><button type="button" class="alink" onclick="const r=document.querySelector('input[name=${k}_pick]:checked');const f=ACT.cards['${k}'].found[+(r?.value??-1)];if(f)document.getElementById('${k}_n').value=f.name;">${found.length ? 'use the TikTok listing name instead' : ''}</button></div><div class="arow"><label>Brand ${found.length ? '(blank = listing)' : ''}</label><input id="${k}_b" value="${found.length ? '' : esc(a.brand || '')}" placeholder="${esc(a.brand || '')}"></div></div>
    <div class="arow"><label>Notes (optional)</label><textarea id="${k}_note" rows="2">${esc(a.note || '')}</textarea></div>
    <label class="achk"><input type="checkbox" id="${k}_fs"${a.free_sample ? ' checked' : ''}> Free sample</label>
    <div class="abtns"><button class="abtn primary" onclick="actRun('${k}',this)">Add product</button><button class="abtn" onclick="actSkip('${k}')">Skip</button></div><div class="astat"></div></div>`;
}
async function actAddProductSave(k, a, c) {
  const pick = +(document.querySelector(`input[name="${k}_pick"]:checked`)?.value ?? -1), sp = pick >= 0 ? a.found[pick] : null;
  const name = v$(k, '_n').trim() || sp?.name || String(a.product || '').trim(); if (!name) throw new Error('add a name');
  const brand = v$(k, '_b').trim() || sp?.brand || a.brand || '';
  let notes = v$(k, '_note').trim();
  if (sp) notes = [notes, sp.price ? `TikTok Shop price seen: ${sp.price}` : '', sp.sold ? `TikTok Shop sold count seen: ${Number(sp.sold).toLocaleString()}` : '', 'Imported from TikTok Shop search.'].filter(Boolean).join('\n');
  if (document.getElementById(k + '_fs')?.checked) notes = notes ? notes + '\nFREE_SAMPLE' : 'FREE_SAMPLE';
  const row = { user_id: c.uid, name, brand, link: sp?.link || (/^https?:/.test(a.link || '') ? a.link : ''), image_url: sp?.image_url || '', notes, status: 'active', tiktok_account_id: null };
  const { error } = await db.from('products').insert(row); if (error) throw error;
  return `Added <b>${esc(name)}</b> to Products${sp?.image_url ? ' with its photo and link' : ' (no photo yet — add it on the Products page)'}${/FREE_SAMPLE/.test(notes) ? ' as a free sample' : ''}.`;
}
async function actStatus(k, a, c) {
  const pid = v$(k, '_p'), st = v$(k, '_st'); if (!pid) throw new Error('pick the product');
  const { error } = await db.from('products').update({ status: st }).eq('id', pid).eq('user_id', c.uid); if (error) throw error;
  return `<b>${esc(c.prods.find(p => p.id === pid)?.name || 'Product')}</b> is now <b>${{ active: 'in stock', paused: 'out of stock', promote: 'promote now', shelved: 'shelved' }[st]}</b>.`;
}
async function actHQ(k, a, c) {
  const vid = v$(k, '_v'), hq = !!document.getElementById(k + '_hq')?.checked; if (!vid) throw new Error('pick the video');
  const { error } = await db.from('videos').update({ high_quality: hq }).eq('id', vid).eq('user_id', c.uid); if (error) throw error;
  return `${hq ? 'Marked' : 'Unmarked'} <b>${esc(String(c.vids.find(v => String(v.id) === String(vid))?.title || 'video').slice(0, 50))}</b> as high quality.`;
}

// ─── Goals + reminders ─────────────────────────────────────────────────────────
async function actGoal(k, a, c) {
  const m = v$(k, '_m'), amt = +v$(k, '_amt') || 0, per = v$(k, '_per'); if (!amt) throw new Error('add an amount');
  const g = (await plannerGet('goals', {})) || {}; g[per] = { ...(g[per] || {}), [m]: amt }; await plannerSet('goals', g);
  return `Goal set: <b>${m === 'units' ? amt + ' units' : m === 'videos' ? amt + ' video' + (amt === 1 ? '' : 's') + ' posted' : '$' + amt.toLocaleString()}${m === 'comm' ? ' commission' : m === 'gmv' ? ' GMV' : ''}</b> per ${per}. Ask "am I on pace?" anytime.`;
}
async function actReminder(k, a, c) {
  const note = v$(k, '_n').trim(), date = v$(k, '_d'); if (!note) throw new Error('write the reminder');
  const { error } = await db.from('queue').insert({ user_id: c.uid, tiktok_account_id: c.active, date, prod_id: null, name: note, brand: '', notes: 'REMINDER', script: '', done: false, sort_order: 0 });
  if (error) throw error; return `Reminder added for ${esc(prettyD(date))}: <b>${esc(note)}</b>.`;
}
// goal progress text for the analyst (used by ask.html gather)
async function actGoalsSummary(sales, vids) {
  const g = (await plannerGet('goals', {}).catch(() => ({}))) || {}; if (!g.month && !g.week && !g.day) return '';
  const t = new Date(), today = ymd(t), out = ['\nHER GOALS (both accounts combined; pace = projected total at the current daily rate):'];
  const sum = (from, to) => ({ ...(sales || []).filter(s => s.date >= from && s.date <= to).reduce((a, s) => ({ gmv: a.gmv + (+s.gmv || 0), comm: a.comm + (+s.comm || 0), units: a.units + (+s.units || 0) }), { gmv: 0, comm: 0, units: 0 }),
    videos: (vids || []).filter(v => { const d = String(v.date || '').slice(0, 10); return d >= from && d <= to; }).length });
  const line = (per, from, to, totalDays) => { const tot = sum(from, today), elapsed = Math.round((new Date(today) - new Date(from)) / 864e5) + 1;
    Object.entries(g[per] || {}).forEach(([m, goal]) => { const have = tot[m], pace = have / elapsed * totalDays;
      out.push(`- ${per === 'month' ? 'This month' : per === 'week' ? 'This week' : 'Today'} ${m}: goal ${goal}, so far ${have.toFixed(/units|videos/.test(m) ? 0 : 2)} (${Math.round(have / goal * 100)}%), day ${elapsed} of ${totalDays}, on pace for ${pace.toFixed(/units|videos/.test(m) ? 0 : 2)} → ${pace >= goal ? 'ON PACE' : 'BEHIND — needs ' + ((goal - have) / Math.max(1, totalDays - elapsed)).toFixed(2) + ' per day for the rest of the ' + per}`); }); };
  if (g.month) { const first = today.slice(0, 8) + '01', days = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); line('month', first, today, days); }
  if (g.day) line('day', today, today, 1);
  if (g.week) { const d = new Date(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); line('week', ymd(d), today, 7); }
  return out.join('\n');
}
