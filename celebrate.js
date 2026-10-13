// ─── Little celebrations: confetti + a toast. celebrate('All takes filmed! 🎉') ───
(function () {
  const COLORS = ['#B5683F', '#D9A441', '#E8C9A8', '#8A4B2E', '#F3E3CF', '#C98B5E'];
  window.celebrate = function (msg, opts = {}) {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { celebrateToast(msg); return; }
      const c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999';
      document.body.appendChild(c);
      const ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
      const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
      const n = opts.count || 140, parts = [];
      for (let i = 0; i < n; i++) {
        const fromLeft = i % 2 === 0;
        parts.push({ x: fromLeft ? 0 : W, y: H * 0.65, vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 10) * dpr, vy: -(10 + Math.random() * 14) * dpr,
          r: (4 + Math.random() * 5) * dpr, c: COLORS[i % COLORS.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .3, shape: Math.random() < .5 });
      }
      const start = performance.now();
      (function frame(t) {
        const el = t - start; ctx.clearRect(0, 0, W, H);
        parts.forEach(p => { p.vy += .35 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - el / 2600);
          if (p.shape) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.4, 0, 6.3); ctx.fill(); }
          ctx.restore(); });
        if (el < 2600) requestAnimationFrame(frame); else c.remove();
      })(start);
    } catch (e) {}
    celebrateToast(msg);
  };
  function celebrateToast(msg) {
    if (!msg) return;
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:var(--rust,#B5683F);color:#fff;font:800 14px 'Nunito Sans',sans-serif;padding:12px 20px;border-radius:999px;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:100000;opacity:0;transition:all .35s ease;max-width:90vw;text-align:center";
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; setTimeout(() => t.remove(), 400); }, 2800);
  }
})();
