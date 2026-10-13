// ─── Insights: Home glance strip, product scorecards, monthly recap ─────────────
// Needs supabase.js (db) and planner-sync.js. Optional: celebrate.js.
(function () {
  const pad = n => String(n).padStart(2, '0'), ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = n => '$' + Math.round(+n || 0).toLocaleString(), $2 = n => '$' + (+n || 0).toFixed(2), num = n => Math.round(+n || 0).toLocaleString();
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  async function uid() { const { data: { session } } = await db.auth.getSession(); return session?.user?.id; }
  const vs = r => { let x = r?.video_sales; if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { x = []; } } return Array.isArray(x) ? x : []; };

  // shared modal
  const css = `.ins-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;}
  .ins-card{background:var(--surface);border:1px solid var(--border-mid);border-radius:22px;width:100%;max-width:560px;max-height:90vh;overflow:auto;padding:22px;color:var(--text);font:14px 'Nunito Sans',sans-serif;position:relative;}
  .ins-x{position:absolute;top:12px;right:14px;border:0;background:var(--surface-2);color:var(--ink);width:30px;height:30px;border-radius:50%;font-size:17px;cursor:pointer;}
  .ins-head{display:flex;gap:14px;align-items:center;margin-bottom:16px;padding-right:30px;} .ins-head img{width:64px;height:64px;border-radius:14px;object-fit:cover;background:var(--surface-2);}
  .ins-head h2{font:300 30px 'Cormorant Garamond',serif;color:var(--ink);line-height:1.05;} .ins-sub{color:var(--text-muted);font-size:12.5px;margin-top:3px;}
  .ins-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;} .ins-t{background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:10px 12px;}
  .ins-t b{display:block;font:300 24px 'Cormorant Garamond',serif;color:var(--ink);line-height:1.1;} .ins-t span{font:800 9.5px 'Nunito Sans',sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--tan);}
  .ins-t small{display:block;font-size:11px;color:var(--text-muted);margin-top:2px;} .ins-t .up{color:#4caf7a;} .ins-t .dn{color:#d66;}
  .ins-sec{margin:12px 0 6px;font:800 10px 'Nunito Sans',sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--tan);}
  .ins-row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--border);font-size:13px;} .ins-row:first-of-type{border-top:0;} .ins-row b{color:var(--ink);}
  .ins-verdict{background:color-mix(in srgb,var(--rust) 14%,transparent);border-radius:12px;padding:10px 12px;color:var(--ink);font-size:13px;margin-top:12px;}
  .ins-btns{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;} .ins-btns button,.ins-btns a{border:1px solid var(--border-mid);background:var(--bg);color:var(--ink);border-radius:999px;padding:8px 14px;font:800 12px 'Nunito Sans',sans-serif;cursor:pointer;text-decoration:none;}
  .ins-btns .pri{background:var(--rust);border-color:var(--rust);color:#fff;}
  .recap-hero{text-align:center;padding:6px 0 14px;} .recap-hero .m{font:22px 'Bad Script',cursive;color:var(--tan);} .recap-hero .big{font:300 54px 'Cormorant Garamond',serif;color:var(--ink);line-height:1;} .recap-hero .lbl{font-size:12px;color:var(--text-muted);}
  @media(max-width:520px){.ins-grid{grid-template-columns:repeat(2,1fr);}}
  /* glance strip */
  .glance{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 18px;}
  .gl{background:var(--surface);border:1px solid var(--border-mid);border-radius:18px;padding:14px 16px;cursor:pointer;transition:transform .15s,border-color .15s;min-width:0;}
  .gl:hover{transform:translateY(-2px);border-color:var(--tan);} .gl .k{font:800 10px 'Nunito Sans',sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--tan);}
  .gl .v{font:300 30px 'Cormorant Garamond',serif;color:var(--ink);line-height:1.05;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .gl .s{font-size:12px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .gl .bar{height:7px;background:var(--surface-2);border-radius:99px;overflow:hidden;margin-top:8px;} .gl .bar i{display:block;height:100%;background:var(--rust);border-radius:99px;transition:width .8s ease;}
  .gl .bar i.ok{background:#4caf7a;}
  @media(max-width:900px){.glance{grid-template-columns:repeat(2,minmax(0,1fr));}}`;
  function ensureCss() { if (document.getElementById('ins-css')) return; const s = document.createElement('style'); s.id = 'ins-css'; s.textContent = css; document.head.appendChild(s); }
  function modal(html) {
    ensureCss(); document.querySelector('.ins-ov')?.remove();
    const ov = document.createElement('div'); ov.className = 'ins-ov';
    ov.innerHTML = `<div class="ins-card"><button class="ins-x" aria-label="Close">×</button>${html}</div>`;
    let down = false; ov.addEventListener('mousedown', e => down = e.target === ov);
    ov.addEventListener('click', e => { if ((e.target === ov && down) || e.target.classList.contains('ins-x')) ov.remove(); });
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', k); } });
    document.body.appendChild(ov); return ov;
  }
  const loading = t => modal(`<div style="padding:30px;text-align:center;color:var(--text-muted)">${t}</div>`);

  // ── Product scorecard ──
  window.openScorecard = async function (prodId) {
    loading('Pulling the numbers…');
    try {
      const u = await uid();
      const [{ data: p }, { data: vids }, { data: sales }, { data: q }, { data: promos }] = await Promise.all([
        db.from('products').select('*').eq('id', prodId).eq('user_id', u).single(),
        db.from('videos').select('id,title,brand,prod_id,views,date,link,high_quality,units,gmv,tiktok_account_id').eq('user_id', u),
        db.from('sales').select('date,video_sales').eq('user_id', u),
        db.from('queue').select('date,done,prod_id').eq('user_id', u).eq('prod_id', prodId),
        db.from('promos').select('product,prod_id,deal,start_date,end_date').eq('user_id', u).gte('end_date', ymd(new Date()))
      ]);
      if (!p) throw new Error('product not found');
      const mine = (vids || []).filter(v => v.prod_id === p.id || (!v.prod_id && v.brand && norm(v.brand) === norm(p.name)));
      const ids = new Set(mine.map(v => String(v.id)));
      let units = 0, gmv = 0, comm = 0, showU = 0, showG = 0; const perVid = {};
      (sales || []).forEach(s => vs(s).forEach(x => {
        if (x.source === 'showcase' ? x.product_id === p.id : ids.has(String(x.video_id))) {
          units += +x.units || 0; gmv += +x.gmv || 0; comm += +x.comm || 0;
          if (x.source === 'showcase') { showU += +x.units || 0; showG += +x.gmv || 0; } else { const k = String(x.video_id); perVid[k] = (perVid[k] || 0) + (+x.gmv || 0); }
        } }));
      mine.forEach(v => { if (!perVid[v.id] && (+v.gmv || 0)) { gmv += +v.gmv; units += +v.units || 0; perVid[v.id] = +v.gmv; } });
      const views = mine.reduce((s, v) => s + (+v.views || 0), 0), avg = mine.length ? views / mine.length : 0;
      const allAvg = (vids || []).length ? (vids || []).reduce((s, v) => s + (+v.views || 0), 0) / vids.length : 0;
      const best = [...mine].sort((a, b) => (perVid[b.id] || 0) - (perVid[a.id] || 0) || (+b.views || 0) - (+a.views || 0))[0];
      const lastPost = mine.map(v => String(v.date || '').slice(0, 10)).sort().pop();
      const lastFilm = (q || []).filter(r => r.done).map(r => r.date).sort().pop();
      const promo = (promos || []).find(x => x.prod_id === p.id || norm(x.product).includes(norm(p.name)) || norm(p.name).includes(norm(x.product)));
      const daysAgo = d => d ? Math.round((new Date(ymd(new Date())) - new Date(d)) / 864e5) : null;
      const gap = daysAgo(lastPost);
      let verdict;
      if (!mine.length) verdict = /FREE_SAMPLE/.test(p.notes || '') ? "🎁 Free sample you haven't posted yet — film it." : "📭 No videos yet. Give it a first try.";
      else if (gmv > 0 && gap != null && gap > 10) verdict = `💰 It sells (${$(gmv)} GMV) but you haven't posted it in ${gap} days — time for a new one.`;
      else if (gmv > 0) verdict = `💰 A seller — ${$(gmv)} GMV from ${mine.length} video${mine.length === 1 ? '' : 's'}. Keep it in rotation${best ? ` and remake the "${String(best.title || '').slice(0, 40)}" style` : ''}.`;
      else if (allAvg && avg >= allAvg * 1.5) verdict = `👀 Gets ${(avg / allAvg).toFixed(1)}× your average views but no sales yet — keep the hook, change how you sell it.`;
      else if (mine.length >= 4) verdict = `🤔 ${mine.length} videos, no sales logged yet — try a new hook or a middle-of-funnel push, or give it a rest.`;
      else verdict = '🌱 Early days — a couple more videos will tell you more.';
      modal(`<div class="ins-head">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : ''}<div><h2>${esc(p.name)}</h2><div class="ins-sub">${esc(p.brand || '')}${promo ? ` · ★ on promo until ${new Date(promo.end_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}${/FREE_SAMPLE/.test(p.notes || '') ? ' · free sample' : ''}</div></div></div>
        <div class="ins-grid">
          <div class="ins-t"><span>GMV</span><b>${$(gmv)}</b><small>${units} sold${showU ? ` · ${showU} showcase` : ''}</small></div>
          <div class="ins-t"><span>Commission</span><b>${$2(comm)}</b><small>logged sales</small></div>
          <div class="ins-t"><span>Videos</span><b>${mine.length}</b><small>${mine.filter(v => v.high_quality).length} HQ</small></div>
          <div class="ins-t"><span>Total views</span><b>${num(views)}</b><small>all videos</small></div>
          <div class="ins-t"><span>Avg views</span><b>${num(avg)}</b><small>${allAvg ? `<span class="${avg >= allAvg ? 'up' : 'dn'}">${avg >= allAvg ? '▲' : '▼'} ${Math.round(Math.abs(avg / allAvg - 1) * 100)}%</span> vs your avg` : ''}</small></div>
          <div class="ins-t"><span>Last posted</span><b>${gap == null ? '—' : gap === 0 ? 'Today' : gap + 'd'}</b><small>${gap == null ? 'never' : 'ago'}${lastFilm ? ` · filmed ${daysAgo(lastFilm)}d ago` : ''}</small></div>
        </div>
        ${best ? `<div class="ins-sec">Best video</div><div class="ins-row"><span>${esc(String(best.title || 'Untitled').slice(0, 80))}</span><b>${num(best.views)} views${perVid[best.id] ? ` · ${$(perVid[best.id])}` : ''}</b></div>` : ''}
        ${mine.length > 1 ? `<div class="ins-sec">Recent videos</div>${[...mine].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5).map(v => `<div class="ins-row"><span>${esc(String(v.date || '').slice(5, 10))} · ${esc(String(v.title || 'Untitled').slice(0, 55))}</span><b>${num(v.views)}${perVid[v.id] ? ' · ' + $(perVid[v.id]) : ''}</b></div>`).join('')}` : ''}
        <div class="ins-verdict">${verdict}</div>
        <div class="ins-btns"><a class="pri" href="ask.html?q=${encodeURIComponent('Write a script for the ' + p.name)}">✍️ Write a script</a><a href="ask.html?q=${encodeURIComponent('Add 2 takes of the ' + p.name + ' to my Film Board today')}">🎬 Film it today</a>${best?.link ? `<a href="${esc(best.link)}" target="_blank" rel="noopener">▶ Best video</a>` : ''}</div>`);
    } catch (e) { modal(`<div style="padding:20px">Couldn't load the scorecard: ${esc(e.message)}</div>`); }
  };

  // ── Monthly recap ──
  window.openRecap = async function (month) {
    const t = new Date(), m = month || (t.getDate() <= 3 ? ymd(new Date(t.getFullYear(), t.getMonth() - 1, 1)).slice(0, 7) : ymd(t).slice(0, 7));
    loading('Putting your month together…');
    try {
      const u = await uid(), [y, mo] = m.split('-').map(Number), first = `${m}-01`, last = ymd(new Date(y, mo, 0));
      const pf = ymd(new Date(y, mo - 2, 1)), pl = ymd(new Date(y, mo - 1, 0));
      const [{ data: sales }, { data: vids }, { data: prods }, { data: q }, { data: accts }] = await Promise.all([
        db.from('sales').select('date,gmv,comm,units,video_sales,tiktok_account_id').eq('user_id', u).gte('date', pf).lte('date', last),
        db.from('videos').select('id,title,brand,prod_id,views,date,tiktok_account_id').eq('user_id', u).gte('date', pf).lte('date', last + 'T23:59:59'),
        db.from('products').select('id,name,image_url').eq('user_id', u),
        db.from('queue').select('date,done,notes').eq('user_id', u).gte('date', first).lte('date', last),
        db.from('tiktok_accounts').select('tiktok_open_id,username,display_name').eq('user_id', u)
      ]);
      const inM = d => String(d || '').slice(0, 10) >= first && String(d || '').slice(0, 10) <= last, inP = d => String(d || '').slice(0, 10) >= pf && String(d || '').slice(0, 10) <= pl;
      const tot = f => (sales || []).filter(s => f(s.date)).reduce((a, s) => ({ gmv: a.gmv + (+s.gmv || 0), comm: a.comm + (+s.comm || 0), units: a.units + (+s.units || 0) }), { gmv: 0, comm: 0, units: 0 });
      const cur = tot(inM), prev = tot(inP);
      const vm = (vids || []).filter(v => inM(v.date)), vp = (vids || []).filter(v => inP(v.date));
      const views = vm.reduce((s, v) => s + (+v.views || 0), 0);
      const chg = (a, b) => b ? `<span class="${a >= b ? 'up' : 'dn'}">${a >= b ? '▲' : '▼'} ${Math.round(Math.abs(a / b - 1) * 100)}%</span> vs last month` : '';
      const bestV = [...vm].sort((a, b) => (+b.views || 0) - (+a.views || 0))[0];
      const byDay = {}; (sales || []).filter(s => inM(s.date)).forEach(s => byDay[s.date] = (byDay[s.date] || 0) + (+s.gmv || 0));
      const bestDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
      const prodG = {}; (sales || []).filter(s => inM(s.date)).forEach(s => vs(s).forEach(x => { let pid = x.source === 'showcase' ? x.product_id : (vids || []).find(v => String(v.id) === String(x.video_id))?.prod_id; if (pid) prodG[pid] = (prodG[pid] || 0) + (+x.gmv || 0); }));
      const topP = Object.entries(prodG).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, g]) => ({ p: (prods || []).find(x => x.id === id), g })).filter(x => x.p);
      const filmed = (q || []).filter(r => r.done && !/^REMINDER$/m.test(r.notes || '')).length;
      const postDays = new Set(vm.map(v => String(v.date).slice(0, 10))).size, daysIn = Math.min(new Date(y, mo, 0).getDate(), m === ymd(t).slice(0, 7) ? t.getDate() : 99);
      const acct = id => { const a = (accts || []).find(x => x.tiktok_open_id === id); return a ? '@' + (a.username || a.display_name) : 'other'; };
      const byAcct = {}; (sales || []).filter(s => inM(s.date)).forEach(s => byAcct[acct(s.tiktok_account_id)] = (byAcct[acct(s.tiktok_account_id)] || 0) + (+s.gmv || 0));
      const label = new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const prevM = ymd(new Date(y, mo - 2, 1)).slice(0, 7), nextM = ymd(new Date(y, mo, 1)).slice(0, 7), canNext = nextM <= ymd(t).slice(0, 7);
      modal(`<div class="recap-hero"><div class="m">${esc(label)} recap</div><div class="big">${$(cur.gmv)}</div><div class="lbl">GMV · ${chg(cur.gmv, prev.gmv) || 'first month tracked'}</div></div>
        <div class="ins-grid">
          <div class="ins-t"><span>Commission</span><b>${$(cur.comm)}</b><small>${chg(cur.comm, prev.comm)}</small></div>
          <div class="ins-t"><span>Units sold</span><b>${num(cur.units)}</b><small>${chg(cur.units, prev.units)}</small></div>
          <div class="ins-t"><span>Videos posted</span><b>${vm.length}</b><small>${chg(vm.length, vp.length)}</small></div>
          <div class="ins-t"><span>Total views</span><b>${num(views)}</b><small>${vm.length ? num(views / vm.length) + ' avg' : ''}</small></div>
          <div class="ins-t"><span>Posting days</span><b>${postDays}/${daysIn}</b><small>days you posted</small></div>
          <div class="ins-t"><span>Takes filmed</span><b>${filmed}</b><small>from your board</small></div>
        </div>
        ${topP.length ? `<div class="ins-sec">Top products</div>${topP.map((x, i) => `<div class="ins-row"><span>${['🥇', '🥈', '🥉'][i]} ${esc(x.p.name)}</span><b>${$(x.g)}</b></div>`).join('')}` : ''}
        ${bestV ? `<div class="ins-sec">Most-viewed video</div><div class="ins-row"><span>${esc(String(bestV.title || 'Untitled').slice(0, 70))}</span><b>${num(bestV.views)} views</b></div>` : ''}
        ${bestDay && bestDay[1] > 0 ? `<div class="ins-sec">Best day</div><div class="ins-row"><span>${new Date(bestDay[0] + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span><b>${$(bestDay[1])}</b></div>` : ''}
        ${Object.keys(byAcct).length > 1 ? `<div class="ins-sec">By account</div>${Object.entries(byAcct).sort((a, b) => b[1] - a[1]).map(([a, g]) => `<div class="ins-row"><span>${esc(a)}</span><b>${$(g)}</b></div>`).join('')}` : ''}
        <div class="ins-btns"><button onclick="openRecap('${prevM}')">‹ ${new Date(y, mo - 2, 1).toLocaleDateString(undefined, { month: 'short' })}</button>${canNext ? `<button onclick="openRecap('${nextM}')">${new Date(y, mo, 1).toLocaleDateString(undefined, { month: 'short' })} ›</button>` : ''}<a class="pri" href="ask.html?q=${encodeURIComponent('What should I do differently next month based on ' + label + '?')}">Ask what to do next month</a></div>`);
      if (cur.gmv > prev.gmv && prev.gmv > 0 && typeof celebrate === 'function' && !month) celebrate(`Up ${Math.round((cur.gmv / prev.gmv - 1) * 100)}% from last month! 📈`, { count: 120 });
    } catch (e) { modal(`<div style="padding:20px">Couldn't build the recap: ${esc(e.message)}</div>`); }
  };

  // ── Home glance strip ──
  window.renderGlance = async function (el) {
    if (!el) return; ensureCss();
    try {
      const u = await uid(), t = new Date(), today = ymd(t), first = today.slice(0, 8) + '01', in2 = ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 2));
      const [{ data: q }, { data: sales }, { data: promos }, goals, { data: vids }] = await Promise.all([
        db.from('queue').select('done,notes').eq('user_id', u).eq('date', today),
        db.from('sales').select('date,gmv,comm,units').eq('user_id', u).gte('date', first),
        db.from('promos').select('product,end_date').eq('user_id', u).lte('start_date', today).gte('end_date', today),
        plannerGet('goals', {}).catch(() => ({})),
        db.from('videos').select('date').eq('user_id', u).gte('date', ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 60)))
      ]);
      const takes = (q || []).filter(r => !/^REMINDER$/m.test(r.notes || '')), done = takes.filter(r => r.done).length;
      const m = (sales || []).reduce((a, s) => ({ gmv: a.gmv + (+s.gmv || 0), comm: a.comm + (+s.comm || 0), units: a.units + (+s.units || 0) }), { gmv: 0, comm: 0, units: 0 });
      const gm = (goals || {}).month || {}, metric = ['gmv', 'comm', 'units'].find(k => gm[k]);
      const ending = (promos || []).filter(p => p.end_date <= in2);
      // posting streak (consecutive days with a video, counting back from today or yesterday)
      const days = new Set((vids || []).map(v => String(v.date).slice(0, 10))); let streak = 0, d = new Date(t);
      if (!days.has(today)) d.setDate(d.getDate() - 1);
      while (days.has(ymd(d))) { streak++; d.setDate(d.getDate() - 1); }
      const pct = takes.length ? Math.round(done / takes.length * 100) : 0;
      let goalTile;
      if (metric) {
        const have = m[metric], goal = gm[metric], p = Math.min(100, Math.round(have / goal * 100)), dim = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(), on = have / t.getDate() * dim >= goal;
        const f = v => metric === 'units' ? num(v) : $(v);
        goalTile = `<div class="gl" onclick="location.href='ask.html?q=${encodeURIComponent('Am I on pace for my goals?')}'"><div class="k">🎯 ${metric === 'gmv' ? 'GMV' : metric === 'comm' ? 'Commission' : 'Units'} goal</div><div class="v">${f(have)} <span style="font-size:16px;color:var(--text-muted)">/ ${f(goal)}</span></div><div class="bar"><i class="${on ? 'ok' : ''}" style="width:0" data-w="${p}%"></i></div><div class="s">${on ? 'On pace 🙌' : 'A little behind pace'} · ${p}%</div></div>`;
      } else goalTile = `<div class="gl" onclick="location.href='ask.html?q=${encodeURIComponent('My goal is ')}'"><div class="k">💰 This month</div><div class="v">${$(m.gmv)}</div><div class="s">${$(m.comm)} commission · tap to set a goal</div></div>`;
      el.className = 'glance';
      el.innerHTML = `<div class="gl" onclick="location.href='film.html'"><div class="k">🎬 Today's takes</div><div class="v">${takes.length ? `${done}/${takes.length}` : '—'}</div><div class="bar"><i class="${pct === 100 ? 'ok' : ''}" style="width:0" data-w="${pct}%"></i></div><div class="s">${!takes.length ? 'Nothing planned yet' : pct === 100 ? 'All done! 🎉' : `${takes.length - done} left`}</div></div>
        ${goalTile}
        <div class="gl" onclick="location.href='promos.html'"><div class="k">⏳ Promos</div><div class="v">${ending.length || (promos || []).length || 0}</div><div class="s">${ending.length ? `ending in 2 days: ${esc(ending.slice(0, 2).map(p => p.product).join(', '))}` : `${(promos || []).length ? 'live right now' : 'none live'}`}</div></div>
        <div class="gl" onclick="openRecap()"><div class="k">${streak ? '🔥 Posting streak' : '📅 Monthly recap'}</div><div class="v">${streak ? `${streak} day${streak === 1 ? '' : 's'}` : t.toLocaleDateString(undefined, { month: 'short' })}</div><div class="s">${streak ? 'tap for your monthly recap' : 'tap to see your month'}</div></div>`;
      requestAnimationFrame(() => setTimeout(() => el.querySelectorAll('.bar i').forEach(i => i.style.width = i.dataset.w), 60));
      if (metric && m[metric] >= gm[metric] && typeof celebrate === 'function') { const key = 'take24:goalHit:' + today.slice(0, 7) + metric; try { if (!localStorage.getItem(key)) { localStorage.setItem(key, '1'); celebrate('You hit your monthly goal! 🎯🎉', { count: 240 }); } } catch (e) {} }
    } catch (e) { console.warn('glance', e); }
  };
})();
