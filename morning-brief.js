// ─── Good Morning pop-up ──────────────────────────────────────────────────────
// Shows once per day (per device) the first time Home opens.
// Sections hide themselves when they have nothing to show.
(function(){
  const KEY = 'take24:briefShown';
  const pad = n => String(n).padStart(2,'0');
  const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const daysBetween = (a,b) => Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000);
  const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const money = n => '$'+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
  const short = n => { n=Number(n||0); return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':String(n); };

  function css(){
    if(document.getElementById('mbCss')) return;
    const s=document.createElement('style'); s.id='mbCss';
    s.textContent=`
.mb-ov{position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;}
.mb{width:min(100%,560px);max-height:88vh;overflow:auto;background:var(--surface);border:1px solid var(--border-mid);border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.4);padding:22px;}
.mb h2{font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:500;color:var(--ink);margin:0;}
.mb .mb-date{font-size:13px;color:var(--text-muted);margin:2px 0 14px;}
.mb-sec{border-top:1px solid var(--border);padding:12px 0;}
.mb-h{font-family:'Stack Sans Notch',sans-serif;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--rust);margin-bottom:8px;}
.mb-row{display:flex;justify-content:space-between;gap:10px;font-size:14px;color:var(--text);padding:4px 0;text-decoration:none;}
.mb-row b{color:var(--ink);font-weight:700;}
.mb-row span:last-child{color:var(--text-muted);white-space:nowrap;font-size:13px;}
.mb-row.warn span:last-child{color:var(--rust);font-weight:700;}
.mb-line{font-size:14px;color:var(--text);line-height:1.6;}
.mb-up{color:#6FA36B;font-weight:700}.mb-down{color:var(--rust);font-weight:700}
.mb-btn{margin-top:14px;width:100%;border:0;border-radius:10px;background:var(--rust);color:#fff;font-family:'Stack Sans Notch',sans-serif;font-weight:800;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:12px;cursor:pointer;}
`; document.head.appendChild(s);
  }

  async function gather(uid){
    const today=new Date(), t=ymd(today), y=ymd(addDays(today,-1)), y2=ymd(addDays(today,-2));
    const [promos,vids,sales,queue,prods,accts]=await Promise.all([
      db.from('promos').select('product,line,deal,start_date,end_date,priority').eq('user_id',uid).gte('end_date',t).lte('start_date',ymd(addDays(today,2))),
      db.from('videos').select('*').eq('user_id',uid).gte('date',ymd(addDays(today,-30))),
      db.from('sales').select('date,gmv,comm,units').eq('user_id',uid).in('date',[y,y2]),
      db.from('queue').select('date,prod_id,name,script,done').eq('user_id',uid).gte('date',ymd(addDays(today,-120))),
      db.from('products').select('id,name,notes,created_at').eq('user_id',uid),
      db.from('tiktok_accounts').select('tiktok_open_id,username,display_name,stats_updated_at').eq('user_id',uid)
    ]);
    const out={t};
    const P=promos.data||[];
    // 1. ending soonest (live), ★ first, max 5
    out.ending=P.filter(p=>p.start_date<=t).map(p=>({...p,left:daysBetween(t,p.end_date)}))
      .sort((a,b)=>a.left-b.left||(b.priority?1:0)-(a.priority?1:0)).slice(0,5);
    // 5. starting in next 2 days
    out.starting=P.filter(p=>p.start_date>t).sort((a,b)=>a.start_date.localeCompare(b.start_date)).slice(0,5);
    // 2. outliers: ≥3× that account's average views, last 30 days
    const V=(vids.data||[]).filter(v=>Number(v.views)>0), byA={};
    V.forEach(v=>(byA[v.tiktok_account_id||'_']??=[]).push(v));
    const names={}; (accts.data||[]).forEach(a=>names[a.tiktok_open_id]='@'+(a.username||a.display_name||'tiktok'));
    out.outliers=[];
    Object.entries(byA).forEach(([a,list])=>{ if(list.length<4) return;
      const avg=list.reduce((s,v)=>s+Number(v.views),0)/list.length;
      list.forEach(v=>{ const x=Number(v.views)/avg; if(x>=3) out.outliers.push({...v,x,acct:names[a]||''}); }); });
    out.outliers.sort((a,b)=>b.x-a.x); out.outliers=out.outliers.slice(0,5);
    // 3. yesterday's sales (all accounts summed)
    const sum=d=>(sales.data||[]).filter(r=>r.date===d).reduce((o,r)=>({gmv:o.gmv+Number(r.gmv||0),comm:o.comm+Number(r.comm||0),units:o.units+Number(r.units||0)}),{gmv:0,comm:0,units:0});
    out.yest=sum(y); out.prev=sum(y2);
    // 4. today's to-do
    const Q=queue.data||[], tq=Q.filter(q=>q.date===t);
    out.todo={n:tq.length, left:tq.filter(q=>!q.done).length, noScript:tq.filter(q=>!q.done&&!String(q.script||'').trim()).length};
    // 6. streak (any account)
    const days=new Set((vids.data||[]).map(v=>String(v.date||'').slice(0,10)));
    let s=0, d=days.has(t)?today:addDays(today,-1); while(days.has(ymd(d))){ s++; d=addDays(d,-1); }
    out.streak={n:s, postedToday:days.has(t), missedYest:!days.has(y)&&!days.has(t)};
    // 7. free samples not filmed, waiting 7+ days
    const filmed=new Set(Q.filter(q=>q.done&&q.prod_id).map(q=>q.prod_id));
    out.samples=(prods.data||[]).filter(p=>/FREE_SAMPLE/.test(p.notes||'')&&!filmed.has(p.id)&&p.created_at&&daysBetween(p.created_at.slice(0,10),t)>=7)
      .map(p=>({name:p.name,wait:daysBetween(p.created_at.slice(0,10),t)})).sort((a,b)=>b.wait-a.wait).slice(0,5);
    // 8. stale TikTok connection (stats not refreshed in 3+ days)
    out.stale=(accts.data||[]).filter(a=>!a.stats_updated_at||daysBetween(a.stats_updated_at.slice(0,10),t)>=3).map(a=>'@'+(a.username||a.display_name||'account'));
    return out;
  }

  function render(o){
    const sec=(h,body)=>body?`<div class="mb-sec"><div class="mb-h">${h}</div>${body}</div>`:'';
    const leftTxt=n=>n<=0?'ends today':n===1?'ends tomorrow':`ends in ${n} days`;
    const pct=(a,b)=>{ if(!b) return ''; const p=Math.round((a-b)/b*100); return ` <span class="${p>=0?'mb-up':'mb-down'}">${p>=0?'▲':'▼'} ${Math.abs(p)}%</span>`; };
    const name=(()=>{ try{ return (document.getElementById('profileName')?.textContent||'').trim().split(' ')[0]; }catch(e){ return ''; } })();
    const h=new Date().getHours(), greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    let html=`<h2>${greet}${name&&name!=='Creator'?', '+esc(name):''}</h2><div class="mb-date">${new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</div>`;
    if(o.stale.length) html+=sec('⚠ Reconnect TikTok',`<a class="mb-row warn" href="settings.html"><span>${esc(o.stale.join(', '))} hasn't updated in a few days</span><span>Fix in Settings →</span></a>`);
    html+=sec('Shark & Ninja · ending soonest',o.ending.map(p=>`<a class="mb-row${p.left<=2?' warn':''}" href="promos.html"><span>${p.priority?'★ ':''}<b>${esc(p.product)}</b>${p.deal?' · '+esc(p.deal):''}</span><span>${leftTxt(p.left)}</span></a>`).join(''));
    html+=sec('Outlier videos · last 30 days',o.outliers.map(v=>{ const link=v.link||v.share_url||''; return `<a class="mb-row" ${link?`href="${esc(link)}" target="_blank"`:'href="video-tracker.html"'}><span><b>${esc(String(v.title||'Untitled').slice(0,60))}</b>${v.acct?' · '+esc(v.acct):''}</span><span>${short(v.views)} views · ${v.x.toFixed(1)}× your avg</span></a>`; }).join('')+(o.outliers.length?`<div class="mb-line" style="font-size:12px;color:var(--text-muted)">Worth reposting, remaking, or running through "Copy what worked."</div>`:''));
    if(o.yest.gmv||o.yest.comm||o.yest.units) html+=sec("Yesterday's sales",`<div class="mb-line"><b>${money(o.yest.gmv)}</b> GMV${pct(o.yest.gmv,o.prev.gmv)} · <b>${money(o.yest.comm)}</b> commission · <b>${o.yest.units}</b> orders</div>`);
    if(o.todo.n) html+=sec('Today',`<a class="mb-row" href="index.html#today"><span><b>${o.todo.left}</b> product${o.todo.left===1?'':'s'} left to film${o.todo.noScript?` · <b>${o.todo.noScript}</b> with no script yet`:''}</span><span>of ${o.todo.n}</span></a>`);
    html+=sec('Promos starting soon',o.starting.map(p=>{ const d=daysBetween(o.t,p.start_date); return `<a class="mb-row" href="promos.html"><span>${p.priority?'★ ':''}<b>${esc(p.product)}</b>${p.deal?' · '+esc(p.deal):''}</span><span>starts ${d===1?'tomorrow':'in '+d+' days'} — film ahead</span></a>`; }).join(''));
    const st=o.streak;
    html+=sec('Posting streak',`<div class="mb-line">${st.postedToday?`🔥 <b>${st.n}</b>-day streak — you've already posted today.`:st.n?`🔥 Post today to keep your <b>${st.n}</b>-day streak going.`:st.missedYest?`No post yesterday — post today to start a new streak.`:'Post today to start a streak.'}</div>`);
    html+=sec('Free samples waiting',o.samples.map(s=>`<a class="mb-row" href="products.html"><span><b>${esc(s.name)}</b></span><span>${s.wait} days, not filmed</span></a>`).join(''));
    html+=`<button class="mb-btn" onclick="document.getElementById('mbOv').remove()">Got it</button>`;
    return html;
  }

  async function show(force){
    try{
      const t=ymd(new Date());
      if(!force){ try{ if(localStorage.getItem(KEY)===t) return; }catch(e){} }
      const { data:{ session } }=await db.auth.getSession(); if(!session) return;
      const o=await gather(session.user.id);
      try{ localStorage.setItem(KEY,t); }catch(e){}
      css(); document.getElementById('mbOv')?.remove();
      const ov=document.createElement('div'); ov.className='mb-ov'; ov.id='mbOv';
      ov.innerHTML=`<div class="mb">${render(o)}</div>`;
      ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
      document.body.appendChild(ov);
    }catch(e){ console.warn('Morning brief failed:',e); }
  }
  window.showMorningBrief=()=>show(true);
  if(document.readyState==='complete') setTimeout(()=>show(false),800);
  else window.addEventListener('load',()=>setTimeout(()=>show(false),800));
})();
