// ─── Shark & Ninja promos — shared helpers (Home + Promos page). Needs supabase.js. ───
const PROMO_LEAD_DAYS = 2;   // put each promo item on the to-do 2 days before its deal starts
function promoYmd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function promoShift(key, days){ const d = new Date(key + 'T00:00:00'); d.setDate(d.getDate() + days); return promoYmd(d); }
function promoStatus(p, today = promoYmd(new Date())){
  if (!p.start_date) return 'undated';
  if (p.end_date && p.end_date < today) return 'ended';
  if (p.start_date <= today) return 'live';
  return 'upcoming';
}
// Which TikTok account a promo line belongs to
async function promoAccounts(userId){
  const { data } = await db.from('tiktok_accounts').select('tiktok_open_id,username,display_name').eq('user_id', userId);
  const find = re => (data || []).find(a => re.test(`${a.username} ${a.display_name}`))?.tiktok_open_id || null;
  return { house: find(/house\s*of\s*ko/i), cozy: find(/cozy\s*ko/i) };
}
function promoAccountFor(line, accts){ return /beauty/i.test(line || '') ? (accts.cozy || accts.house) : (accts.house || accts.cozy); }

// Adds upcoming promo items to the to-do list (2 days before they start). Safe to run often — each item is added once.
async function syncPromoTodos(userId){
  try {
    const today = promoYmd(new Date());
    const { data: promos, error } = await db.from('promos').select('*').eq('user_id', userId).eq('todo_added', false).not('start_date', 'is', null);
    if (error || !promos?.length) return 0;
    const due = promos.filter(p => promoShift(p.start_date, -PROMO_LEAD_DAYS) <= today && (!p.end_date || p.end_date >= today));
    if (!due.length) return 0;
    const accts = await promoAccounts(userId);
    const rows = due.map((p, i) => {
      const lead = promoShift(p.start_date, -PROMO_LEAD_DAYS);
      return { user_id: userId, tiktok_account_id: p.tiktok_account_id || promoAccountFor(p.line, accts), date: lead < today ? today : lead,
        prod_id: p.prod_id || null, name: p.product, brand: p.line, notes: `Promo: ${p.deal || 'deal'} · ${p.start_date}${p.end_date ? ' → ' + p.end_date : ''}`,
        script: '', done: false, sort_order: 900 + i };
    });
    const { error: e2 } = await db.from('queue').insert(rows);
    if (e2) { console.warn('Promo to-do sync failed', e2); return 0; }
    await db.from('promos').update({ todo_added: true }).in('id', due.map(p => p.id)).eq('user_id', userId);
    return rows.length;
  } catch (e) { console.warn('Promo to-do sync failed', e); return 0; }
}

// SKU matching: exact SKU first, otherwise the same first 4 letters/numbers. No match = you don't own it.
function promoSkuKey(v){ return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function promoMatchBySku(sku, prods){
  const k = promoSkuKey(sku); if (!k) return null;
  const withSku = (prods || []).filter(p => promoSkuKey(p.sku));
  return withSku.find(p => promoSkuKey(p.sku) === k)
      || (k.length >= 4 ? withSku.find(p => promoSkuKey(p.sku).slice(0, 4) === k.slice(0, 4)) : null)
      || null;
}
// Links promo items to products you've added since (by SKU when the promo has one, otherwise by name). Runs on Home + the Promos page.
async function linkPromoProducts(userId){
  try {
    const [{ data: promos }, { data: prods }] = await Promise.all([
      db.from('promos').select('id,product,sku,notes').eq('user_id', userId).is('prod_id', null),
      db.from('products').select('id,name,sku').eq('user_id', userId)
    ]);
    if (!promos?.length || !prods?.length) return 0;
    const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const words = v => norm(v).split(' ').filter(w => w.length > 2 && !['the','and','with','for'].includes(w));
    let n = 0;
    for (const p of promos) {
      if (/\[nolink\]/.test(p.notes || '')) continue;   // you unlinked this one on purpose
      if (promoSkuKey(p.sku)) {   // has a SKU → only SKU matching counts
        const hit = promoMatchBySku(p.sku, prods);
        if (hit) { await db.from('promos').update({ prod_id: hit.id }).eq('id', p.id).eq('user_id', userId); n++; }
        continue;
      }
      const pn = norm(p.product), pw = words(p.product);
      // exact name, one name containing the other, or every important word of the promo name in the product name
      const hit = prods.find(x => norm(x.name) === pn)
        || prods.find(x => pn.length > 5 && (norm(x.name).includes(pn) || pn.includes(norm(x.name))) && norm(x.name).length > 5)
        || (pw.length >= 2 ? prods.find(x => pw.every(w => norm(x.name).includes(w))) : null);
      if (hit) { await db.from('promos').update({ prod_id: hit.id }).eq('id', p.id).eq('user_id', userId); n++; }
    }
    return n;
  } catch (e) { console.warn('Promo linking failed', e); return 0; }
}
