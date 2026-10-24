// ─── Home "shell": side panels stay, the middle swaps to other pages (desktop only) ───
(function () {
  const WIDE = window.matchMedia('(min-width: 1181px)');
  const SKIP = /^(index\.html|auth\.html|login\.html|privacy\.html|terms\.html)?$/i;
  let wrap, frame, title, board;
  const FRAMES = {};   // one live iframe per page, kept in the background so pages don't reset when you leave them
  const fileOf = p => String(p || '').split(/[?#]/)[0];

  function pageOf(href) {
    try { const u = new URL(href, location.href); if (u.origin !== location.origin) return null;
      const f = u.pathname.split('/').pop(); if (!/\.html$/i.test(f) || SKIP.test(f)) return null; return f + u.search + u.hash; } catch (e) { return null; }
  }
  function build() {
    board = document.querySelector('.main.board'); const center = document.querySelector('.b-center');
    if (!board || !center || wrap) return !!wrap;
    const st = document.createElement('style');
    st.textContent = `.board.shell-on .b-center>*:not(.shell-wrap){display:none!important;}
      .shell-wrap{display:none;flex-direction:column;flex:1 1 auto;min-height:0;height:100%;background:var(--surface);border:1px solid var(--border-mid);border-radius:20px;overflow:hidden;}
      .board.shell-on .shell-wrap{display:flex;}
      .shell-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);flex:none;}
      .shell-bar button{border:1px solid var(--border-mid);background:var(--bg);color:var(--ink);border-radius:999px;padding:6px 12px;font:800 11.5px 'Nunito Sans',sans-serif;cursor:pointer;display:flex;align-items:center;gap:6px;}
      .shell-bar button:hover{border-color:var(--tan);}
      .shell-title{flex:1;font:300 20px 'Cormorant Garamond',serif;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .shell-wrap iframe{flex:1;width:100%;border:0;background:var(--bg);}
      .shell-wrap iframe.shell-hidden{display:none;}
      .board.shell-full{grid-template-columns:minmax(0,1fr)!important;}
      .board.shell-full .b-left,.board.shell-full .b-right{display:none!important;}`;
    document.head.appendChild(st);
    wrap = document.createElement('div'); wrap.className = 'shell-wrap';
    wrap.innerHTML = `<div class="shell-bar"><button type="button" data-a="home" title="Back to Home">⌂ Home</button><div class="shell-title"></div>
      <button type="button" data-a="full" title="Use the whole screen">⤢ Expand</button></div>`;
    center.appendChild(wrap); title = wrap.querySelector('.shell-title');
    wrap.querySelector('.shell-bar').addEventListener('click', e => { const a = e.target.closest('button')?.dataset.a;
      if (a === 'home') home(); else if (a === 'full') setFull(!board.classList.contains('shell-full')); else if (a === 'tab') window.open(currentPage(), '_blank'); });
    return true;
  }
  let FULL = false; try { FULL = localStorage.getItem('take24:shellFull') === '1'; } catch (e) {}
  function setFull(on) { FULL = on; try { localStorage.setItem('take24:shellFull', on ? '1' : '0'); } catch (e) {}
    board.classList.toggle('shell-full', on && board.classList.contains('shell-on'));
    wrap.querySelector('[data-a="full"]').textContent = on ? '⤡ Show panels' : '⤢ Expand'; }
  function currentPage() { if (!frame) return ''; try { const l = frame.contentWindow.location; return l.pathname.split('/').pop() + l.search + l.hash; } catch (e) { return frame.getAttribute('src'); } }
  function open(page, push = true) {
    if (!build()) return false;
    board.classList.add('shell-on'); setFull(FULL);
    const f = fileOf(page); let fr = FRAMES[f], fresh = false;
    if (!fr) { fr = document.createElement('iframe'); fr.title = 'Page'; fr.addEventListener('load', () => onFrameLoad(fr)); wrap.appendChild(fr); FRAMES[f] = fr; fresh = true; }
    Object.values(FRAMES).forEach(x => x.classList.toggle('shell-hidden', x !== fr)); frame = fr;
    let cur = ''; try { const l = fr.contentWindow.location; cur = l.pathname.split('/').pop() + l.search + l.hash; } catch (e) {}
    if (fresh || (page !== f && cur !== page)) { title.textContent = 'Loading…'; fr.setAttribute('src', page); }   // new page, or same page with a different filter (e.g. a brand)
    else { setTitle(fr); try { fr.contentWindow.postMessage({ t24: 'shown' }, location.origin); } catch (e) {} }
    if (push) history.pushState({ shell: page }, '', 'index.html?p=' + encodeURIComponent(page));
    return true;
  }
  function home(push = true) {
    if (!board) return; board.classList.remove('shell-on', 'shell-full');
    // pages stay alive in the background (hidden) so they're exactly as you left them
    if (push) history.pushState({}, '', 'index.html');
    try { window.renderTodayContent && renderTodayContent(); } catch (e) {}
  }
  function setTitle(fr) { try { const doc = fr.contentDocument, file = fr.contentWindow.location.pathname.split('/').pop(); title.textContent = (doc.title || file).replace(/\s*[·|–-]\s*(Take24|Creator Hub).*$/i, ''); } catch (e) {} }
  function onFrameLoad(fr) {
    let doc; try { doc = fr.contentDocument; } catch (e) { return; }
    if (!doc || fr.src === 'about:blank') return;
    let p = ''; try { const l = fr.contentWindow.location; p = l.pathname.split('/').pop() + l.search + l.hash; } catch (e) {}
    const file = fileOf(p), key = Object.keys(FRAMES).find(k => FRAMES[k] === fr);
    if (!file || SKIP.test(file)) { if (key) { fr.remove(); delete FRAMES[key]; } home(); return; }      // page inside went back to Home
    if (key && key !== file) { delete FRAMES[key]; if (FRAMES[file] && FRAMES[file] !== fr) FRAMES[file].remove(); FRAMES[file] = fr; }   // a link inside moved this frame to another page
    if (fr !== frame) return;
    setTitle(fr);
    if (history.state?.shell !== p) history.replaceState({ shell: p }, '', 'index.html?p=' + encodeURIComponent(p));
  }
  // links on Home open in the middle
  document.addEventListener('click', e => {
    if (!WIDE.matches || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]'); if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    if (wrap && wrap.contains(a)) return;
    const p = pageOf(a.getAttribute('href')); if (!p) { if (/(^|\/)index\.html$|^\.?\/?$/.test(a.getAttribute('href')) && board?.classList.contains('shell-on')) { e.preventDefault(); home(); } return; }
    e.preventDefault(); open(p);
  }, true);
  window.addEventListener('popstate', e => { if (!WIDE.matches) return; const p = e.state?.shell || new URLSearchParams(location.search).get('p'); p ? open(p, false) : home(false); });
  window.T24Shell = { open: p => WIDE.matches ? open(pageOf(p) || p) : (location.href = p), home: () => home() };
  // opened with ?p=page (refresh / shared link)
  const start = () => { const p = new URLSearchParams(location.search).get('p'); if (!p) return;
    if (WIDE.matches && pageOf(p)) open(pageOf(p), false); else if (pageOf(p)) location.replace(p); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  WIDE.addEventListener?.('change', () => { if (!WIDE.matches && board?.classList.contains('shell-on')) location.href = currentPage(); });
})();
