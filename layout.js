(function () {
  const NAV_ITEMS = [
    { href: 'index.html', label: 'Home', icon: 'home', aliases: [''] },
    { href: 'daily-todo.html', label: 'Daily To Do', mobileLabel: 'To Do', icon: 'todo' },
    { href: 'video-tracker.html', label: 'Content Tracker', icon: 'video' },
    { href: 'hooks.html', label: 'Hooks', icon: 'hooks' },
    { href: 'products.html', label: 'Products', icon: 'products' },
    { href: 'scripts.html', label: 'Scripts', icon: 'scripts' },
    { href: 'sales-calendar.html', label: 'Sales Log', mobileLabel: 'Sales', icon: 'sales' }
  ];

  const MOBILE_ITEMS = NAV_ITEMS.filter(item =>
    ['index.html', 'daily-todo.html', 'sales-calendar.html', 'products.html'].includes(item.href)
  );

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
        <div class="core-sidebar-head"><span>Core 5</span><span class="core-sidebar-count" id="coreCount">0/5</span></div>
        <div class="core-mini-list">
          <label class="core-mini-item"><span class="core-mini-num">1</span><input class="core-mini-input" data-core-index="0" placeholder="Product name"></label>
          <label class="core-mini-item"><span class="core-mini-num">2</span><input class="core-mini-input" data-core-index="1" placeholder="Product name"></label>
          <label class="core-mini-item"><span class="core-mini-num">3</span><input class="core-mini-input" data-core-index="2" placeholder="Product name"></label>
          <label class="core-mini-item"><span class="core-mini-num">4</span><input class="core-mini-input" data-core-index="3" placeholder="Product name"></label>
          <label class="core-mini-item"><span class="core-mini-num">5</span><input class="core-mini-input" data-core-index="4" placeholder="Product name"></label>
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
        <a href="index.html" class="side-brand">creator <span>workspace</span></a>
        <div class="side-nav">${links}</div>
        ${coreSidebar()}
        <div class="side-profile">
          <div class="avatar" id="profileAvatar"><img class="avatar-img" src="icons/users/icon-1.png" alt=""></div>
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
        <button type="button" class="tab-item profile-trigger" aria-label="Open profile menu">
          <div class="tab-profile-avatar"><img class="avatar-img" src="icons/users/icon-1.png" alt=""></div><div>User</div>
        </button>
      </div>`;
  }

  function renderSharedLayout() {
    if (document.querySelector('[data-shared-layout]')) return;
    const page = currentPage();
    const appShell = document.querySelector('.app-shell');
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
