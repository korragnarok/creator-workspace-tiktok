(function () {
  const NAV_ITEMS = [
    { href: 'index.html', label: 'Home', icon: 'home', aliases: [''] },
    { href: 'daily-todo.html', label: 'Daily To Do', mobileLabel: 'To Do', icon: 'todo' },
    { href: 'video-tracker.html', label: 'Content Tracker', mobileLabel: 'Content', icon: 'video' },
    { href: 'products.html', label: 'Products', icon: 'products' },
    { href: 'scripts.html', label: 'Scripts', icon: 'scripts' },
    { href: 'script-workshop.html', label: 'Script Workshop', icon: 'workshop', desktopOnly: true },
    { href: 'sales-calendar.html', label: 'Sales Log', mobileLabel: 'Sales', icon: 'sales' }
  ];

  const MOBILE_ITEMS = NAV_ITEMS.filter(item => !item.desktopOnly);

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

    return `
      <div class="tab-bar" data-shared-layout="true">
        ${links}

      </div>`;
  }

  function injectSharedLayoutStyles() {
    if (document.querySelector('link[data-shared-layout-styles], link[href*="layout.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'layout.css?v=58';
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
    if (typeof applyThemeIcons === 'function') applyThemeIcons(_cachedTheme?.() || DEFAULT_THEME);
  }

  window.renderSharedLayout = renderSharedLayout;
  renderSharedLayout();
})();
