(function () {
  const NAV_ITEMS = [
    { href: 'index.html', label: 'Home', icon: 'home', aliases: [''] },
    { href: 'daily-todo.html', label: 'Daily To Do', mobileLabel: 'To Do', icon: 'todo' },
    { href: 'video-tracker.html', label: 'Content Tracker', mobileLabel: 'Content', icon: 'video' },
    { href: 'products.html', label: 'Products', icon: 'products' },
    { href: 'brand-deals.html', label: 'Brand Deals', icon: 'products', desktopOnly: true },
    { href: 'scripts.html', label: 'Scripts', icon: 'scripts' },
    { href: 'script-workshop.html', label: 'Script Workshop', icon: 'workshop', desktopOnly: true },
    { href: 'sales-calendar.html', label: 'Sales Log', mobileLabel: 'Sales', icon: 'sales' }
  ];

  const MOBILE_ITEMS = NAV_ITEMS.filter(item => !item.desktopOnly);
  const MORE_ITEMS = NAV_ITEMS.filter(item => item.desktopOnly);

  function currentPage() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    return file === '' ? 'index.html' : file;
  }

  function isActive(item, page) {
    return item.href === page || (item.aliases || []).includes(page);
  }

  function iconImg(item, className = '') {
    return `<img src="icons/dusk/${item.icon}.png" data-theme-icon${className ? ` class="${className}"` : ''} alt="">`;
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

  function sidebar(page) {
    const links = NAV_ITEMS.map(item => `
      <a href="${item.href}" class="side-link${isActive(item, page) ? ' active' : ''}">
        <span class="nav-icon">${iconImg(item)}</span>${item.label}
      </a>`).join('');

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
    link.href = 'layout.css?v=111';
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
    if (typeof applyThemeIcons === 'function') applyThemeIcons(_cachedTheme?.() || DEFAULT_THEME);
  }

  window.openMobileMoreSheet = openMobileMoreSheet;
  window.closeMobileMoreSheet = closeMobileMoreSheet;
  window.renderSharedLayout = renderSharedLayout;
  renderSharedLayout();
})();
