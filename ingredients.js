// ─── Ingredient check: honest read of what's actually in a product ─────────────
// 1. Looks the product up in her Skin Lab list (skin.take24.co/products.js — her own ingredient lists)
// 2. Not there? Finds the full ingredient list online with Google Search
// 3. Gemini reads the list like a cosmetic chemist and gives an honest, TikTok-Shop-safe breakdown
// Results are saved per product (planner key "ingredientChecks") so it only runs once.
(function () {
  const W = () => (typeof WORKER !== 'undefined' ? WORKER : 'https://take24-scout.kortnycall5.workers.dev');
  let skinLoad = null;
  function loadSkinLab() {
    if (window.PRODUCTS && Array.isArray(window.PRODUCTS)) return Promise.resolve(window.PRODUCTS);
    if (skinLoad) return skinLoad;
    skinLoad = new Promise(res => {
      const s = document.createElement('script'); s.src = 'https://skin.take24.co/products.js?t=' + Math.floor(Date.now() / 36e5);
      s.onload = () => res(Array.isArray(window.PRODUCTS) ? window.PRODUCTS : []); s.onerror = () => res([]);
      document.head.appendChild(s); setTimeout(() => res(window.PRODUCTS || []), 8000);
    });
    return skinLoad;
  }
  const norm = t => String(t || '').toLowerCase().replace(/[®™'’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  async function findSkinProduct(name, brand) {
    const list = await loadSkinLab(); const n = norm(name), nb = norm(`${brand || ''} ${name}`);
    if (!n) return null;
    let best = null, score = 0;
    list.forEach(p => {
      const pn = norm(p.name); if (!pn) return;
      if (pn === n || pn === nb) { best = p; score = 999; return; }
      const w = pn.split(' ').filter(x => x.length > 2), hit = w.filter(x => nb.includes(x)).length, sc = w.length ? hit / w.length : 0;
      if (sc > score) { score = sc; best = p; }
    });
    return score >= 0.75 ? best : null;
  }
  async function gemini(body, ms = 60000) {
    const r = await fetch(`${W()}/?service=gemini&model=gemini-2.5-flash`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.error?.message || `Gemini error (${r.status})`);
    return (d?.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('').trim();
  }
  async function findIngredientsOnline(name, brand) {
    const t = await gemini({ contents: [{ role: 'user', parts: [{ text: `Find the FULL official ingredient list (INCI, in order) for the skincare/beauty product "${name}"${brand ? ` by ${brand}` : ''}. Use Google Search — the brand's site, retailer listings (Ulta, Sephora, Amazon), INCIDecoder or Skinsort. Reply with ONLY the ingredient list exactly in order, comma-separated, then a new line "SOURCE: <site name>". If you can't find this exact product's list, reply only: NOT FOUND` }] }], tools: [{ google_search: {} }] });
    if (!t || /NOT FOUND/i.test(t)) return null;
    const src = (t.match(/SOURCE:\s*(.+)/i) || [])[1] || 'online search';
    return { list: t.replace(/SOURCE:.*$/is, '').trim(), source: src.trim() };
  }
  const SCHEMA = { type: 'OBJECT', properties: {
    verdict: { type: 'STRING' }, what_it_really_is: { type: 'STRING' },
    stars: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, position: { type: 'NUMBER' }, note: { type: 'STRING' } }, required: ['name', 'position', 'note'] } },
    fragrance: { type: 'STRING' }, watch_outs: { type: 'ARRAY', items: { type: 'STRING' } },
    good_for: { type: 'ARRAY', items: { type: 'STRING' } }, skip_if: { type: 'ARRAY', items: { type: 'STRING' } },
    honest_lines: { type: 'ARRAY', items: { type: 'STRING' } }
  }, required: ['verdict', 'what_it_really_is', 'stars', 'fragrance', 'watch_outs', 'good_for', 'skip_if', 'honest_lines'] };
  async function analyze(name, brand, list, extra) {
    const t = await gemini({ contents: [{ role: 'user', parts: [{ text: `You're an honest cosmetic-ingredient reviewer helping a skincare creator understand a product BEFORE she films it. Read this ingredient list like a cosmetic chemist and tell her the truth, in plain words.
PRODUCT: ${name}${brand ? ` by ${brand}` : ''}
INGREDIENTS (in order — earlier = more of it; anything after the preservatives like phenoxyethanol / ethylhexylglycerin is usually under ~1%):
${list}
${extra ? `HER NOTES: ${extra}\n` : ''}
Return:
- verdict: one honest sentence.
- what_it_really_is: what this formula actually is based on the list (e.g. "mostly a hydrating peptide blend — copper peptide is near the end, so it's a small amount, not a strong copper serum"). Compare the marketing name to where the hero ingredient sits.
- stars: the 3–6 ingredients that matter most, with their 1-based position in the list and a plain note (what it does cosmetically, and whether the amount is likely meaningful).
- fragrance: "Fragrance-free" or name exactly what adds scent (parfum/fragrance, essential oils, linalool, limonene, citrus/lavender oils, etc.).
- watch_outs: honest flags — fragrance/essential oils, drying alcohol (alcohol denat high up), common irritants, high acids, fungal-acne triggers, comedogenic-ish oils, pregnancy-caution ingredients. Empty list if none.
- good_for / skip_if: skin types or situations.
- honest_lines: 3–5 short things she could actually SAY on camera that are honest AND TikTok Shop safe — cosmetic/temporary effects only, no medical claims (no treats/cures/heals acne or conditions), no "dermatologist approved", no knocking other brands. e.g. "the copper peptide is pretty far down the list, so I'd think of this as a gentle peptide serum".
Be accurate. If you're not sure about an ingredient, say so instead of guessing.` }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 } }, 90000);
    return JSON.parse(t.replace(/```json|```/g, ''));
  }
  // main: get (or reuse) the honest ingredient check for a product
  async function ingredientCheck(name, brand, opts = {}) {
    const key = norm(`${brand || ''} ${name}`); if (!key) return null;
    let saved = {}; try { saved = (typeof plannerGet === 'function' ? await plannerGet('ingredientChecks', {}) : {}) || {}; } catch (e) {}
    if (saved[key] && !opts.fresh) return saved[key];
    const sk = await findSkinProduct(name, brand);
    let list = sk?.ingredients || '', source = sk ? 'Your Skin Lab list' : '';
    if (!list && opts.pasted) { list = opts.pasted; source = 'What you pasted'; }
    if (!list && opts.noOnline) return null;
    if (!list) { const on = await findIngredientsOnline(name, brand).catch(() => null); if (on) { list = on.list; source = on.source; } }
    if (!list) return { none: true, name };
    const extra = sk ? [sk.warn?.length ? 'Her notes: ' + sk.warn.join('; ') : '', sk.flags?.length ? 'Flags: ' + sk.flags.join(', ') : '', sk.fit ? 'Her fit chart: ' + Object.entries(sk.fit).map(([k, v]) => `${k}=${v}`).join(', ') : ''].filter(Boolean).join('. ') : '';
    const r = await analyze(name, brand, list, extra);
    const out = { ...r, name, brand: brand || '', source, list, at: Date.now() };
    try { saved[key] = out; if (typeof plannerSet === 'function') await plannerSet('ingredientChecks', saved); } catch (e) {}
    return out;
  }
  // text block for script prompts
  function ingredientFacts(c) {
    if (!c || c.none) return '';
    return `INGREDIENT CHECK (honest — use it; the script's one downside can come from here):
What it really is: ${c.what_it_really_is}
Key ingredients: ${(c.stars || []).map(s => `${s.name} (#${s.position}: ${s.note})`).join('; ')}
Fragrance: ${c.fragrance}
Watch-outs: ${(c.watch_outs || []).join('; ') || 'none'}
Good for: ${(c.good_for || []).join(', ')} · Skip if: ${(c.skip_if || []).join(', ')}
Honest things she can say: ${(c.honest_lines || []).join(' | ')}
Never overstate a hero ingredient that sits low on the list. Cosmetic/temporary effects only — no medical claims.`;
  }
  const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  function ingredientCardHtml(c) {
    if (!c) return '';
    if (c.none) return `<div class="ingc"><b>🧪 Ingredient check</b><p>Couldn't find an ingredient list for ${esc(c.name)} in your Skin Lab list or online. Add a screenshot of the ingredients and I'll read it.</p></div>`;
    const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join('');
    return `<div class="ingc"><b>🧪 Ingredient check</b> <small style="color:var(--text-muted)">· from ${esc(c.source)}</small>
      <p style="margin:6px 0"><b>${esc(c.verdict)}</b></p><p style="margin:0 0 8px">${esc(c.what_it_really_is)}</p>
      <p style="margin:0 0 4px"><b>Key ingredients</b></p><ul style="margin:0 0 8px 18px">${(c.stars || []).map(s => `<li><b>${esc(s.name)}</b> <small>(#${esc(s.position)} on the list)</small> — ${esc(s.note)}</li>`).join('')}</ul>
      <p style="margin:0 0 8px"><b>Fragrance:</b> ${esc(c.fragrance)}</p>
      ${c.watch_outs?.length ? `<p style="margin:0 0 4px"><b>Watch-outs</b></p><ul style="margin:0 0 8px 18px">${li(c.watch_outs)}</ul>` : ''}
      <p style="margin:0 0 8px"><b>Good for:</b> ${esc((c.good_for || []).join(', '))}<br><b>Skip if:</b> ${esc((c.skip_if || []).join(', '))}</p>
      <p style="margin:0 0 4px"><b>Honest things you could say</b></p><ul style="margin:0 0 8px 18px">${li(c.honest_lines)}</ul>
      <details><summary style="cursor:pointer;font-size:12px;color:var(--text-muted)">Full ingredient list</summary><p style="font-size:12px;margin-top:6px">${esc(c.list)}</p></details>
      <p style="font-size:11px;color:var(--text-muted);margin-top:8px">AI read of the ingredient list — not medical advice. Double-check anything you'll say on camera.</p></div>`;
  }
  const looksBeauty = t => /serum|cream|moistur|cleanser|toner|essence|sunscreen|spf|lotion|mask|balm|oil|retin|peptide|acid|niacinamide|vitamin c|skin|lip|eye|face|hair|shampoo|conditioner|scalp|body wash|exfol|mist|gel|beauty|cosmetic|makeup|foundation|concealer|primer|kitsch|cerave|ordinary|medicube|dr\.?/i.test(t || '');
  Object.assign(window, { looksBeauty, ingredientCheck, ingredientFacts, ingredientCardHtml, findSkinProduct });
})();
