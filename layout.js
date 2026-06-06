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
        <a href="index.html" class="side-brand"><img src="logo.png" alt="Take24" style="width:160px;height:auto;object-fit:contain;display:block;padding:4px 0;"></a>
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

  function injectSharedLayoutStyles() {
    if (document.getElementById('sharedLayoutStyles')) return;
    const style = document.createElement('style');
    style.id = 'sharedLayoutStyles';
    style.textContent = `
      @media (min-width: 769px) {
        .desktop-sidebar.sidebar {
          position: fixed;
          top: 0;
          left: 0;
          width: 188px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
          padding-bottom: max(16px, env(safe-area-inset-bottom));
        }
        .desktop-sidebar.sidebar .side-nav {
          gap: 6px;
          flex-shrink: 0;
        }
        .desktop-sidebar.sidebar .side-link {
          display: flex;
          align-items: center;
          gap: 12px;
          border-radius: 8px;
          padding: 8px 12px;
          color: var(--text-mid);
          font-weight: 700;
          transition: background 0.15s, color 0.15s;
        }
        .desktop-sidebar.sidebar .side-link.active {
          background: color-mix(in srgb,var(--rust) 26%,var(--surface) 74%);
          color: var(--ink);
        }
        .desktop-sidebar.sidebar .side-link:hover {
          background: color-mix(in srgb,var(--surface) 78%,var(--rust) 22%);
          color: var(--ink);
        }
        .desktop-sidebar.sidebar .nav-icon {
          width: 28px;
          height: 28px;
          border: 1px solid var(--border-mid);
          border-radius: 8px;
          background: color-mix(in srgb,var(--surface) 78%,var(--bg) 22%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .desktop-sidebar.sidebar .nav-icon img {
          width: 19px;
          height: 19px;
          object-fit: contain;
        }
        .desktop-sidebar.sidebar .core-sidebar {
          flex-shrink: 0;
          border: 1px solid var(--border-mid);
          border-radius: 12px;
          padding: 10px;
          background: color-mix(in srgb,var(--surface) 74%,var(--bg) 26%);
          box-shadow: inset 0 1px 0 color-mix(in srgb,var(--ink) 9%,transparent);
          display: flex;
          flex-direction: column;
          gap: 9px;
        }
        .desktop-sidebar.sidebar .core-sidebar-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--rust);
          font-size: 15px;
        }
        .desktop-sidebar.sidebar .core-sidebar-head span:first-child {
          font-weight: 700;
        }
        .desktop-sidebar.sidebar .core-sidebar-count {
          font-family: 'Noto Sans Mono',sans-serif;
          font-size: 10px;
          font-weight: 800;
          color: var(--ink);
          background: color-mix(in srgb,var(--sage) 24%,var(--surface) 76%);
          border: 1px solid var(--border-mid);
          border-radius: 999px;
          padding: 3px 7px;
        }
        .desktop-sidebar.sidebar .core-mini-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .desktop-sidebar.sidebar .core-mini-item {
          display: block;
          position: relative;
        }
        .desktop-sidebar.sidebar .core-mini-num,
        .desktop-sidebar.sidebar .core-mini-input {
          display: none;
        }
        .desktop-sidebar.sidebar .core-pill {
          min-width: 0;
          width: 100%;
          border: 1px solid var(--border-mid);
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color 0.15s, opacity 0.15s, background 0.15s;
          background: color-mix(in srgb,var(--surface) 75%,var(--sand) 25%);
          display: flex;
          align-items: center;
        }
        .desktop-sidebar.sidebar .core-pill:hover {
          border-color: var(--rust);
        }
        .desktop-sidebar.sidebar .core-pill-empty {
          opacity: 0.45;
        }
        .desktop-sidebar.sidebar .core-pill-empty:hover {
          opacity: 0.7;
        }
        .desktop-sidebar.sidebar .core-pill-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--ink);
        }
        .desktop-sidebar.sidebar .core-pill-empty .core-pill-text {
          color: var(--text-muted);
          font-style: italic;
        }
        .desktop-sidebar.sidebar .side-profile {
          margin-top: 0;
          flex-shrink: 0;
          border: 1px solid var(--border);
          border-radius: var(--r, 12px);
          background: color-mix(in srgb,var(--surface) 76%,var(--bg) 24%);
          padding: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .desktop-sidebar.sidebar .side-profile:hover {
          border-color: var(--rust);
        }
        .desktop-sidebar.sidebar .avatar,
        .tab-profile-avatar {
          overflow: hidden;
          background: var(--sage);
          flex-shrink: 0;
        }
        .desktop-sidebar.sidebar .avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
        }
        .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .desktop-sidebar.sidebar .profile-name {
          font-weight: 700;
          line-height: 1.1;
          color: var(--ink);
        }
        .desktop-sidebar.sidebar .profile-role {
          font-size: 11px;
          color: var(--text-muted);
        }
        .app-shell > .workspace {
          grid-column: 2;
        }
      }
      @media (max-width: 1280px) and (min-width: 769px) {
        body:not(.has-app-shell) {
          padding-left: 76px !important;
        }
        .desktop-sidebar.sidebar {
          width: 76px;
          padding: 18px 10px;
          align-items: center;
          gap: 16px;
        }
        .desktop-sidebar.sidebar .side-brand {
          width: 48px;
          height: 48px;
          border: 1px solid var(--border-mid);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-size: 0;
          background: color-mix(in srgb,var(--surface) 76%,var(--bg) 24%);
        }
        .desktop-sidebar.sidebar .side-brand::before {
          content: '';
        }
        .desktop-sidebar.sidebar .side-brand img {
          width: 40px !important;
          height: 40px !important;
          object-fit: cover;
          border-radius: 8px;
        }
        .desktop-sidebar.sidebar .side-brand span,
        .desktop-sidebar.sidebar .side-link {
          font-size: 0;
        }
        .desktop-sidebar.sidebar .side-nav {
          align-items: center;
          width: 100%;
        }
        .desktop-sidebar.sidebar .side-link {
          width: 48px;
          height: 48px;
          justify-content: center;
          padding: 0;
          gap: 0;
        }
        .desktop-sidebar.sidebar .nav-icon {
          width: 34px;
          height: 34px;
        }
        .desktop-sidebar.sidebar .nav-icon img {
          width: 21px;
          height: 21px;
        }
        .desktop-sidebar.sidebar .core-sidebar,
        .desktop-sidebar.sidebar .side-profile {
          display: none;
        }
        .app-shell {
          grid-template-columns: 76px minmax(0, 1fr);
        }
        .app-shell > .workspace {
          grid-column: 2;
        }
      }
      @media (max-width: 768px) {
        .app-shell > .workspace {
          grid-column: 1;
        }
        .desktop-sidebar.sidebar {
          display: none;
        }
        body > nav {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
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
