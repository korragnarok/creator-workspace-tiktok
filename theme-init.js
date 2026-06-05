(function () {
  const THEMES = {
    dusk: {
      '--bg':'#2A1822','--bg-lift':'#341D2A','--surface':'#3C2431','--surface-2':'#4A2B3B',
      '--border':'rgba(255,210,220,0.08)','--border-mid':'rgba(255,210,220,0.14)',
      '--text':'#F3C7D0','--text-mid':'#B98A9A','--text-muted':'#8B6674','--ink':'#FFF0F3',
      '--sage':'#A78C93','--rose':'#F0A8B6','--rust':'#E17788','--tan':'#C79CA7','--sand':'#4A2B3B',
      '--shadow-sm':'0 1px 4px rgba(0,0,0,0.32)','--shadow-md':'0 4px 20px rgba(0,0,0,0.42)'
    },
    warm: {
      '--bg':'#F8F5F1','--bg-lift':'#FCFAF8','--surface':'#FCFAF8','--surface-2':'#EDE8E1',
      '--border':'rgba(42,39,37,0.1)','--border-mid':'rgba(42,39,37,0.15)',
      '--text':'#2A2725','--text-mid':'#7A816C','--text-muted':'#A58B71','--ink':'#2A2725',
      '--sage':'#7A816C','--rose':'#D1A9A5','--rust':'#AE6965','--tan':'#A58B71','--sand':'#E5DFD6',
      '--shadow-sm':'0 1px 4px rgba(42,39,37,0.07)','--shadow-md':'0 4px 20px rgba(42,39,37,0.09)'
    },
    noir: {
      '--bg':'#1A1A1A','--bg-lift':'#222222','--surface':'#2A2A2A','--surface-2':'#333333',
      '--border':'rgba(255,255,255,0.07)','--border-mid':'rgba(255,255,255,0.12)',
      '--text':'#E8E0D8','--text-mid':'#9A9490','--text-muted':'#6A6460','--ink':'#F0EBE5',
      '--sage':'#607070','--rose':'#C0A898','--rust':'#D63C2A','--tan':'#9A9490','--sand':'#333333',
      '--shadow-sm':'0 1px 4px rgba(0,0,0,0.4)','--shadow-md':'0 4px 20px rgba(0,0,0,0.5)'
    },
    forest: {
      '--bg':'#2B1F18','--bg-lift':'#34261D','--surface':'#3C2C22','--surface-2':'#493529',
      '--border':'rgba(245,240,232,0.09)','--border-mid':'rgba(245,240,232,0.15)',
      '--text':'#F5F0E8','--text-mid':'#CBBDAA','--text-muted':'#9B8A78','--ink':'#FFF7EC',
      '--sage':'#6F8F6B','--rose':'#C8A878','--rust':'#E9D7BE','--tan':'#F5F0E8','--sand':'#493529',
      '--shadow-sm':'0 1px 4px rgba(0,0,0,0.26)','--shadow-md':'0 4px 20px rgba(0,0,0,0.36)'
    }
  };
  const DEFAULT_THEME = 'dusk';
  let key = DEFAULT_THEME;
  try {
    const saved = localStorage.getItem('creatorHub:theme');
    if (THEMES[saved]) key = saved;
  } catch (e) {}
  const root = document.documentElement;
  root.dataset.theme = key;
  Object.entries(THEMES[key]).forEach(([name, value]) => root.style.setProperty(name, value));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEMES[key]['--bg']);
})();
