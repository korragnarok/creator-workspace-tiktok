// ── Inside Home's middle panel: hide this page's own sidebar / phone nav ──
(function () {
  let inShell = false; try { inShell = window.self !== window.top && !!window.parent.T24Shell; } catch (e) {}
  if (!inShell) return;
  document.documentElement.classList.add('embedded');
  const st = document.createElement('style');
  st.textContent = `html.embedded .page-eyebrow,html.embedded .page-title,html.embedded .page-sub,
    html.embedded .page-head .eyebrow,html.embedded .page-head .title,html.embedded .page-head .sub,
    html.embedded .wrap>.head h1,html.embedded .wrap>h1{display:none!important;}
    html.embedded .page,html.embedded main.page,html.embedded .wrap{padding-top:14px!important;}
    html.embedded .page-header,html.embedded .page-head,html.embedded .wrap>.head{margin-top:0!important;padding-top:0!important;min-height:0!important;justify-content:flex-end!important;}
    html.embedded .desktop-sidebar,html.embedded .sidebar.desktop-sidebar,html.embedded .tab-bar,html.embedded .m-top,html.embedded .mobile-more-sheet,html.embedded .mobile-more-backdrop{display:none!important;}
    html.embedded body,html.embedded body:not(.has-app-shell){padding-left:20px!important;padding-right:20px!important;padding-top:16px!important;padding-bottom:20px!important;}
    html.embedded .app-shell{grid-template-columns:minmax(0,1fr)!important;}`;
  document.head.appendChild(st);
  // links back to Home close the panel instead of loading Home inside it
  document.addEventListener('click', e => { const a = e.target.closest('a[href]'); if (!a || a.target === '_blank') return;
    const h = a.getAttribute('href') || ''; if (/^(\.\/)?(index\.html)?(\?.*)?$/i.test(h) && !/^#/.test(h)) { e.preventDefault(); try { window.parent.T24Shell.home(); } catch (_) { location.href = h; } } }, true);
})();
// motion + texture layer on every page
(function () { if (document.querySelector('link[href^="alive.css"]')) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'alive.css?v=388'; document.head.appendChild(l); })();
(function () { if (document.querySelector('link[href^="notebook.css"]')) return; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'notebook.css?v=398'; document.head.appendChild(l); })();
(function () {
  const NAV_ITEMS = [
    { href: 'index.html', label: 'Home', icon: 'home', aliases: [''] },
    { href: 'daily-todo.html', label: 'Daily To Do', mobileLabel: 'To Do', icon: 'todo' },
    { href: 'video-tracker.html', label: 'Content Tracker', icon: 'video' },
    {
      href: 'products.html',
      label: 'Products',
      icon: 'products',
      activePages: ['brand-deals.html', 'product-scout.html'],
      children: [
        { href: 'products.html', label: 'Products', icon: 'products' },
        { href: 'brand-deals.html', label: 'Brand Deals', icon: 'products' },
        { href: 'product-scout.html', label: 'Product Scout', icon: 'products' }
      ]
    },
    {
      href: 'script-workshop.html',
      label: 'Scripts',
      icon: 'scripts',
      activePages: ['scripts.html', 'script-scout.html'],
      children: [
        { href: 'scripts.html', label: 'Script Vault', icon: 'scripts' },
        { href: 'script-workshop.html', label: 'Script Workshop', icon: 'workshop' },
        { href: 'script-scout.html', label: 'Script Scout', icon: 'video' },
      ]
    },
    { href: 'notes.html', label: 'Notes', icon: 'scripts' },
    { href: 'sales-calendar.html', label: 'Sales Log', mobileLabel: 'Sales', icon: 'sales' }
  ];

  const MOBILE_ITEMS = [
    { href: 'index.html', label: 'Home', icon: 'home', aliases: [''] },
    { href: 'daily-todo.html', label: 'To Do', icon: 'todo' },
    { href: 'products.html', label: 'Products', icon: 'products' },
    { href: 'script-scout.html', label: 'Scout', icon: 'video' },
    { href: 'script-workshop.html', label: 'Scripts', icon: 'scripts', activePages: ['scripts.html'] },
    { href: 'sales-calendar.html', label: 'Sales', icon: 'sales' },
    { href: 'video-tracker.html', label: 'Content', icon: 'video' }
  ];

  const MORE_ITEMS = [
    { href: 'script-workshop.html', label: 'Script Workshop', icon: 'workshop' },
    { href: 'brand-deals.html', label: 'Brand Deals', icon: 'products' },
    { href: 'product-scout.html', label: 'Product Scout', icon: 'products' },
    { href: 'notes.html', label: 'Notes', icon: 'scripts' },
    { href: 'shop.html', label: 'Pinterest Shop', icon: 'products' },
    { href: 'settings.html', label: 'Settings', icon: 'scripts' }
  ];

  function currentPage() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    return file === '' ? 'index.html' : file;
  }

  function isActive(item, page) {
    return item.href === page || (item.aliases || []).includes(page) || (item.activePages || []).includes(page);
  }

  function iconImg(item, className = '') {
    return `<img src="icons/${item.icon}.png" data-theme-icon${className ? ` class="${className}"` : ''} alt="">`;
  }

  function coreSidebar() {
    return `
      <div class="core-sidebar">
        <div class="core-sidebar-head"><span>Hero Brands</span></div>
        <div class="core-mini-list">
          <label class="core-mini-item"><span class="core-mini-num">1</span><input class="core-mini-input" data-core-index="0" placeholder="Brand name"></label>
          <label class="core-mini-item"><span class="core-mini-num">2</span><input class="core-mini-input" data-core-index="1" placeholder="Brand name"></label>
          <label class="core-mini-item"><span class="core-mini-num">3</span><input class="core-mini-input" data-core-index="2" placeholder="Brand name"></label>
          <label class="core-mini-item"><span class="core-mini-num">4</span><input class="core-mini-input" data-core-index="3" placeholder="Brand name"></label>
          <label class="core-mini-item"><span class="core-mini-num">5</span><input class="core-mini-input" data-core-index="4" placeholder="Brand name"></label>
          <label class="core-mini-item"><span class="core-mini-num">6</span><input class="core-mini-input" data-core-index="5" placeholder="Brand name"></label>
          <label class="core-mini-item"><span class="core-mini-num">7</span><input class="core-mini-input" data-core-index="6" placeholder="Brand name"></label>
        </div>
      </div>`;
  }

  // ── New planner sidebar: wordmark, mini calendar, ombre folders, profile ──
  // [page, label, folder image number] — image numbers stay fixed so your folder pictures never shuffle
  const FOLDERS = [
    ['video-tracker.html','Content Tracker',2], ['film.html','Film Board',8],
    ['products.html','Products',3], ['brand-deals.html','Brand Deals',4],
    ['promos.html','Shark & Ninja',16], ['shop.html','Pinterest Shop',5],
    ['scripts.html','Script Vault',6], ['sales-calendar.html','Sales Log',10],
    ['https://a.co/d/0aN0vMFu','Storefront',11], ['https://affiliate-program.amazon.com/home','Associates',12],
    ['video-feedback.html','Video Feedback',14], ['ask.html','Ask Take24',7], ['settings.html','Settings',15]
  ];
  // folder image number: 1, 2, 3… but skips 13 (that's the black "you are here" folder)
  const folderNum = i => FOLDERS[i][2];
  const extAttr = href => /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
  function folderShade(i) {
    const t = i / (FOLDERS.length - 1), a = [110,63,40], b = [222,196,170];
    return `rgb(${a.map((c,k) => Math.round(c + (b[k]-c) * t)).join(',')})`;
  }
  function miniCalendar() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    let cells = ['S','M','T','W','T','F','S'].map(d => `<div class="ls-dow">${d}</div>`).join('');
    for (let i = 0; i < first; i++) cells += '<div></div>';
    for (let d = 1; d <= days; d++) cells += `<div class="ls-d${d === now.getDate() ? ' ls-today' : ''}">${d}</div>`;
    return `<a class="ls-cal" href="sales-calendar.html" title="Open Sales Log" style="display:block;text-decoration:none;color:inherit;cursor:pointer"><div class="ls-month">${now.toLocaleDateString(undefined,{month:'long'})}</div><div class="ls-cal-grid">${cells}</div></a>`;
  }
  // Content Ideas shortcut, shown on every page
  function ideasCard(page) {
    let n = 0; try { n = (JSON.parse(localStorage.getItem('take24:ideas')) || []).length; } catch (e) {}
    return `<a class="ls-ideas${page === 'ideas.html' ? ' active' : ''}" href="ideas.html">
      <span class="ls-ideas-t">Content Ideas</span><span class="ls-ideas-n">${n ? n + ' saved' : 'Open board'}</span><span class="ls-ideas-go">→</span></a>`;
  }
  function folderGrid(page) {
    return `<div class="ls-folders">${FOLDERS.map(([href,label],i) => `
      <a class="ls-folder${href === page ? ' active' : ''}" href="${href}"${extAttr(href)} style="--f:${folderShade(i)}">
        <img class="ls-ic" src="icons/folder-${href === page ? 13 : folderNum(i)}.png" alt="" onerror="if(!this.dataset.tried){this.dataset.tried=1;this.src='icons/folder-12.png';}else{this.outerHTML='<span class=&quot;ls-ic ls-fallback&quot;></span>';}">
        <span>${label}</span></a>`).join('')}</div>`;
  }
  function injectPlannerSidebarStyles() {
    if (document.getElementById('planner-sidebar-css')) return;
    if (!document.querySelector('link[href*="Cormorant+Garamond"]')) {
      const f = document.createElement('link'); f.rel = 'stylesheet';
      f.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap';
      document.head.appendChild(f);
    }
    if (!document.querySelector('link[href*="Bad+Script"]')) {
      const f2 = document.createElement('link'); f2.rel = 'stylesheet';
      f2.href = 'https://fonts.googleapis.com/css2?family=Bad+Script&display=swap';
      document.head.appendChild(f2);
    }
    const st = document.createElement('style'); st.id = 'planner-sidebar-css';
    st.textContent = `
      /* ── phone layout ── */
      .m-top{display:none;}
      @media (max-width:768px){
        html body .tab-bar,html body .mobile-more-sheet,html body .mobile-more-overlay{display:none!important;}
        html body .page,html body .content{padding-top:12px!important;}
        html body{padding-top:0!important;}
        .m-top{display:block;padding:max(14px,env(safe-area-inset-top)) 14px 6px;}
        .m-top-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
        .m-logo img{max-height:44px;max-width:150px;display:block;}
        .m-avatar{width:42px;height:42px;border-radius:50%;overflow:hidden;border:2px solid var(--border-mid);padding:0;background:var(--sage);cursor:pointer;}
        .m-avatar img{width:100%;height:100%;object-fit:cover;display:block;}
        .m-top-grid{display:grid;grid-template-columns:1fr;gap:10px;}
        .m-top .ls-cal{padding:10px 8px;border-radius:18px;}
        .m-top .ls-month{font-size:16px;margin-bottom:4px;}
        .m-top .ls-cal-grid{font-size:10px;}
        .m-top .ls-d{height:18px;}
        .m-top .ls-today{width:18px;}
        .m-top .ls-folders{grid-template-columns:repeat(4,1fr);gap:8px 2px;padding:10px 4px;border-radius:18px;align-content:center;}
        .m-top .ls-folder{font-size:9px;gap:3px;}
        .m-top .ls-ic{width:34px;height:34px;}
        .m-top .ls-fallback{width:26px;height:21px;margin:4px 0 3px;}
        .m-top .ls-fallback::before{width:12px;height:5px;top:-4px;}
        .m-more-btn{background:none;border:0;cursor:pointer;padding:0;}
        .m-more-ic{display:flex!important;align-items:center;justify-content:center;color:var(--cream,#fff);font-size:9px;letter-spacing:1px;}
        .m-more{display:none;grid-column:1/-1;grid-template-columns:repeat(4,1fr);gap:8px 2px;padding-top:8px;margin-top:2px;border-top:1px solid var(--border-mid);}
        .m-top.more-open .m-more{display:grid;}
        .m-top.more-open .m-more-btn span:last-child{color:var(--ink);}
      }
      /* subtle dot grid background, same as the Meta side */
      html body{background-image:radial-gradient(rgba(196,160,131,.05) 1px,transparent 1px);background-size:14px 14px;background-attachment:fixed;}
      @media (min-width:769px){
        html:not(.embedded) body:not(.has-app-shell){padding-left:236px!important;}
        html body:not(.has-app-shell)>nav:not(.desktop-sidebar){display:none!important;}          /* old top bar — the sidebar replaces it */
        html body:not(.has-app-shell)>.desktop-sidebar.sidebar{position:fixed!important;left:0;top:0;bottom:0;height:100vh!important;z-index:60;}
        html[data-theme="notebook"]:not(.embedded) body:not(.has-app-shell){padding-left:270px!important;}
        html[data-theme="notebook"]:not(.embedded) body:not(.has-app-shell)>.desktop-sidebar.sidebar{left:34px;}
        html body .app-shell{grid-template-columns:236px minmax(0,1fr)!important;}
        html body .desktop-sidebar.sidebar{width:236px!important;padding:18px 14px!important;align-items:stretch!important;gap:14px!important;overflow-y:auto;scrollbar-width:none;}
        .desktop-sidebar.sidebar::-webkit-scrollbar{display:none;}
      }
      .ls-word{display:block;padding:2px 4px;text-decoration:none;}
      .ls-word img{max-width:170px;max-height:64px;width:auto;height:auto;display:block;}
      .ls-cal{background:var(--rust);border-radius:20px;padding:12px 12px 10px;color:#fff;}
      .ls-month{font-family:'Cormorant Garamond',serif;font-size:19px;text-align:center;margin-bottom:6px;}
      .ls-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:11px;gap:1px 0;}
      .ls-dow{font-weight:800;font-size:9px;opacity:.75;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.25);margin-bottom:3px;}
      .ls-d{height:21px;display:flex;align-items:center;justify-content:center;}
      .ls-today{width:21px;margin:0 auto;border-radius:50%;background:#fff;color:var(--rust);font-weight:800;}
      .ls-ideas{display:grid;grid-template-columns:1fr auto;align-items:center;gap:0 8px;padding:12px 14px;border:1px solid var(--border-mid);border-radius:18px;background:var(--surface);text-decoration:none;transition:border-color .15s;}
      .ls-ideas:hover,.ls-ideas.active{border-color:var(--tan);}
      .ls-ideas-t{font-family:'Cormorant Garamond',serif;font-size:19px;color:var(--ink);}
      .ls-ideas-n{grid-row:2;font-size:11px;color:var(--text-muted);}
      .ls-ideas-go{grid-row:1/3;grid-column:2;font-family:'Bad Script',cursive;font-size:20px;color:var(--tan);}
      .ls-folders{display:grid;grid-template-columns:repeat(3,1fr);gap:12px 2px;padding:14px 6px;border:1px solid var(--border-mid);border-radius:20px;background:var(--surface);}
      .ls-folder{display:flex;flex-direction:column;align-items:center;gap:5px;text-decoration:none;color:var(--text-mid);font-family:'Stack Sans Notch',sans-serif;font-size:9.5px;font-weight:700;text-align:center;line-height:1.15;}
      .ls-folder:hover,.ls-folder.active{color:var(--ink);}
      .ls-folder.active .ls-fallback{background:#111;}   /* until folder-13.png exists */
      .ls-folder.active .ls-fallback::before{background:#111;}
      .ls-ic{width:40px;height:40px;object-fit:contain;display:block;transition:transform .15s;}
      .ls-folder:hover .ls-ic{transform:translateY(-2px);}
      .ls-fallback{width:38px;height:30px;margin:6px 0 4px;border-radius:5px 9px 9px 9px;position:relative;background:var(--f);}
      .ls-fallback::before{content:'';position:absolute;top:-5px;left:0;width:17px;height:7px;border-radius:4px 4px 0 0;background:var(--f);}
      html body .desktop-sidebar.sidebar .side-profile{margin-top:auto!important;width:auto!important;height:auto!important;padding:10px!important;gap:10px!important;justify-content:flex-start!important;}
      html body .desktop-sidebar.sidebar .side-profile .profile-name,html body .desktop-sidebar.sidebar .side-profile .profile-role{display:block!important;}
    `;
    document.head.appendChild(st);
  }

  function sidebar(page) {
    injectPlannerSidebarStyles();
    return `
      <aside class="desktop-sidebar sidebar" data-shared-layout="true">
        <a href="index.html" class="ls-word" title="Home"><img src="logo.png" alt="Take24"></a>
        ${miniCalendar()}
        ${folderGrid(page)}
        ${ideasCard(page)}
        ${(page === 'products.html' || page === 'index.html' || page === '') ? coreSidebar() : ''}
        <div class="side-profile">
          <div class="avatar" id="profileAvatar"><img class="avatar-img" src="icons/users/avatar.png" alt=""></div>
          <div><div class="profile-name" id="profileName">Creator</div><div class="profile-role">Creator</div></div>
        </div>
      </aside>`;
  }

  function oldSidebar(page) {
    const links = NAV_ITEMS.map(item => {
      const submenu = Array.isArray(item.children) && item.children.length
        ? `<div class="side-submenu" role="menu" aria-label="${item.label} menu">
            ${item.children.map(child => `
              <a href="${child.href}" class="side-submenu-link${isActive(child, page) ? ' active' : ''}" role="menuitem">
                <span class="side-submenu-icon">${iconImg(child)}</span>
                <span>${child.label}</span>
              </a>`).join('')}
          </div>`
        : '';
      return `
        <div class="side-nav-item${submenu ? ' has-submenu' : ''}">
          <a href="${item.href}" class="side-link${isActive(item, page) ? ' active' : ''}">
            <span class="nav-icon">${iconImg(item)}</span><span class="side-link-label">${item.label}</span>
          </a>
          ${submenu}
        </div>`;
    }).join('');

    return `
      <aside class="desktop-sidebar sidebar" data-shared-layout="true">
        <a href="index.html" class="side-brand"><img src="logo.png" alt="Take24" style="width:160px;height:auto;object-fit:contain;display:block;padding:4px 0;"></a>
        <div class="side-nav">${links}</div>
        ${coreSidebar()}
        <div class="side-profile">
          <div class="avatar" id="profileAvatar"><img class="avatar-img" src="icons/users/avatar.png" alt=""></div>
          <div><div class="profile-name" id="profileName">Creator</div><div class="profile-role">Creator</div></div>
        </div>
      </aside>`;
  }

  function mobileNav(page) {
    const links = MOBILE_ITEMS.map(item => `
      <a href="${item.href}" class="tab-item${isActive(item, page) ? ' active' : ''}">
        <div>${iconImg(item, 'tab-icon-img')}</div><div>${item.mobileLabel || item.label}</div>
      </a>`).join('');
    const moreActive = MORE_ITEMS.some(item => isActive(item, page));

    return `
      <div class="tab-bar" data-shared-layout="true">
        ${links}
        <button type="button" class="tab-item tab-more${moreActive ? ' active' : ''}" aria-expanded="false" aria-controls="mobileMoreSheet" onclick="openMobileMoreSheet()">
          <span class="tab-more-icon" aria-hidden="true">•••</span><span>More</span>
        </button>
      </div>`;
  }

  function mobileMoreSheet(page) {
    if (!MORE_ITEMS.length) return '';
    const links = MORE_ITEMS.map(item => `
      <a href="${item.href}" class="mobile-more-link${isActive(item, page) ? ' active' : ''}">
        <span class="mobile-more-icon">${iconImg(item)}</span>
        <span>${item.label}</span>
      </a>`).join('');
    return `
      <div class="mobile-more-overlay" id="mobileMoreOverlay" data-shared-layout="true" onclick="closeMobileMoreSheet()"></div>
      <div class="mobile-more-sheet" id="mobileMoreSheet" data-shared-layout="true" role="dialog" aria-modal="true" aria-label="More navigation">
        <button type="button" class="mobile-more-handle" aria-label="Close more navigation" onclick="closeMobileMoreSheet()"></button>
        <div class="mobile-more-title">More</div>
        <div class="mobile-more-list">${links}</div>
      </div>`;
  }

  function openMobileMoreSheet() {
    document.body.classList.add('mobile-more-open');
    document.querySelector('.tab-more')?.setAttribute('aria-expanded', 'true');
  }

  function closeMobileMoreSheet() {
    document.body.classList.remove('mobile-more-open');
    document.querySelector('.tab-more')?.setAttribute('aria-expanded', 'false');
  }

  function initMobileMoreGestures() {
    const sheet = document.getElementById('mobileMoreSheet');
    if (!sheet) return;
    let startY = 0;
    let currentY = 0;
    let dragging = false;
    sheet.addEventListener('touchstart', event => {
      if (!document.body.classList.contains('mobile-more-open')) return;
      startY = event.touches[0].clientY;
      currentY = startY;
      dragging = true;
      sheet.classList.add('dragging');
    }, { passive: true });
    sheet.addEventListener('touchmove', event => {
      if (!dragging) return;
      currentY = event.touches[0].clientY;
      const delta = Math.max(0, currentY - startY);
      sheet.style.transform = `translateY(${delta}px)`;
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
      if (!dragging) return;
      const delta = Math.max(0, currentY - startY);
      dragging = false;
      sheet.classList.remove('dragging');
      sheet.style.transform = '';
      if (delta > 70) closeMobileMoreSheet();
    });
  }

  function injectSharedLayoutStyles() {
    if (document.querySelector('link[data-shared-layout-styles], link[href*="layout.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'layout.css?v=144';
    link.dataset.sharedLayoutStyles = 'true';
    document.head.appendChild(link);
  }

  function renderSharedLayout() {
    if (document.querySelector('[data-shared-layout]')) return;
    injectSharedLayoutStyles();
    const page = currentPage();
    const appShell = document.querySelector('.app-shell');
    if (appShell) document.body.classList.add('has-app-shell');
    const marker = document.createElement('div');
    marker.dataset.sharedLayout = 'true';
    marker.innerHTML = sidebar(page);

    if (appShell) appShell.insertBefore(marker.firstElementChild, appShell.firstElementChild);
    else document.body.insertAdjacentHTML('afterbegin', sidebar(page));

    document.body.insertAdjacentHTML('beforeend', mobileNav(page));
    document.body.insertAdjacentHTML('beforeend', mobileMoreSheet(page));
    initMobileMoreGestures();
    renderMobileTop(page);
    if (typeof applyThemeIcons === 'function') applyThemeIcons(_cachedTheme?.() || DEFAULT_THEME);
  }

  // ── Phone layout: logo + profile, calendar, and folders at the top (replaces the tab bar) ──
  // Phone folders: the 6 main pages, plus a "More" folder that opens the rest
  const MOBILE_MAIN = ['video-tracker.html','products.html','brand-deals.html','scripts.html','sales-calendar.html','settings.html'];
  // Phone nav: honeycomb like desktop — 8 pages, two interlocking rows of 4, light → dark brown
  const MOBILE_HEX = ['film.html','video-tracker.html','products.html','shop.html','scripts.html','brand-deals.html','promos.html','video-feedback.html'];
  function mobileFolders(page) {
    const L = MOBILE_HEX.map(h => FOLDERS.find(f => f[0] === h) || [h, h === 'film.html' ? 'Film Board' : h === 'promos.html' ? 'Shark & Ninja' : h === 'video-feedback.html' ? 'Video Feedback' : h.replace('.html','')]);
    const cell = ([href, label], i) => { const t = i / (L.length - 1), a = [226,201,176], b = [92,52,34], c = a.map((v,k) => Math.round(v + (b[k]-v) * t));
      const fg = (c[0]*.299 + c[1]*.587 + c[2]*.114) > 150 ? '#3b2418' : '#fbefe3';
      return `<a class="m-hex${href === page ? ' active' : ''}" href="${href}" style="--hb:rgb(${c.join(',')});--hf:${fg}"><span>${String(label).replace('&','&amp;')}</span></a>`; };
    if (!document.getElementById('mHexCss')) { const st = document.createElement('style'); st.id = 'mHexCss';
      st.textContent = `.m-hexgrid{--hw:min(20vw,80px);--hh:calc(var(--hw)*1.1547);--hg:5px;display:flex;flex-direction:column;align-items:center;padding:6px 0 4px;grid-column:1/-1;}
        .m-hexrow{display:flex;gap:var(--hg);}
        .m-hexrow:nth-child(1){transform:translateX(calc((var(--hw) + var(--hg))*-.25));}
        .m-hexrow:nth-child(2){transform:translateX(calc((var(--hw) + var(--hg))*.25));margin-top:calc(var(--hh)*-.25 + var(--hg)*.87);}
        .m-hex{width:var(--hw);height:var(--hh);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:var(--hb);color:var(--hf);display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;padding:0 8px;}
        .m-hex span{font:800 10px/1.15 'Nunito Sans',sans-serif;}
        .m-hex.active{filter:brightness(1.1);} .m-hex:active{transform:scale(.96);}
        html[data-theme="notebook"] .m-hex{background:var(--nb-ink)!important;color:var(--nb-ink)!important;position:relative;isolation:isolate;}
        html[data-theme="notebook"] .m-hex::before{content:"";position:absolute;inset:2px;z-index:-1;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.35),transparent 55%),#efe2cc;}
        html[data-theme="notebook"] .m-hexrow:nth-child(1) .m-hex:nth-child(3)::before,html[data-theme="notebook"] .m-hexrow:last-child .m-hex:last-child::before{background:var(--nb-kraft-2);}`;
      document.head.appendChild(st); }
    return `<div class="m-hexgrid"><div class="m-hexrow">${L.slice(0,4).map((f,i) => cell(f,i)).join('')}</div><div class="m-hexrow">${L.slice(4).map((f,j) => cell(f,j+4)).join('')}</div></div>`;
  }

  function renderMobileTop(page) {
    if (document.querySelector('.m-top')) return;
    const el = document.createElement('div');
    el.className = 'm-top'; el.dataset.sharedLayout = 'true';
    el.innerHTML = `
      <div class="m-top-row">
        <a href="index.html" class="m-logo"><img src="logo.png" alt="Take24"></a>
        <button type="button" class="m-avatar profile-trigger" aria-label="Account menu"><img id="mAvatarImg" src="icons/users/avatar.png" alt=""></button>
      </div>
      <div class="m-top-grid">${mobileFolders(page)}${ideasCard(page)}${miniCalendar()}</div>`;
    const host = document.querySelector('.workspace') || document.querySelector('.page') || document.body;
    host.insertBefore(el, host.firstElementChild);
    // keep the phone avatar in sync with the real profile photo once it loads
    const src = document.querySelector('#profileAvatar img');
    const sync = () => { const img = document.querySelector('#profileAvatar img'); if (img?.src) document.getElementById('mAvatarImg').src = img.src; };
    if (src) new MutationObserver(sync).observe(document.getElementById('profileAvatar'), { subtree: true, childList: true, attributes: true });
    setTimeout(sync, 1500);
  }

  window.openMobileMoreSheet = openMobileMoreSheet;
  window.closeMobileMoreSheet = closeMobileMoreSheet;
  window.renderSharedLayout = renderSharedLayout;
  renderSharedLayout();
})();
