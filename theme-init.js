(function () {
  const THEMES = {
    dusk: {
      label: 'Dusk', swatch: ['#2A1822','#3C2431','#E17788','#F3C7D0'],
      '--bg':'#2A1822','--bg-lift':'#341D2A','--surface':'#3C2431','--surface-2':'#4A2B3B',
      '--border':'rgba(255,210,220,0.08)','--border-mid':'rgba(255,210,220,0.14)',
      '--text':'#F3C7D0','--text-mid':'#B98A9A','--text-muted':'#8B6674','--ink':'#FFF0F3',
      '--sage':'#A78C93','--rose':'#F0A8B6','--rust':'#E17788','--tan':'#C79CA7','--sand':'#4A2B3B',
      '--shadow-sm':'0 1px 4px rgba(0,0,0,0.32)','--shadow-md':'0 4px 20px rgba(0,0,0,0.42)'
    },
    warm: {
      label: 'Warm', swatch: ['#F8F5F1','#FCFAF8','#AE6965','#2A2725'],
      '--bg':'#F8F5F1','--bg-lift':'#FCFAF8','--surface':'#FCFAF8','--surface-2':'#EDE8E1',
      '--border':'rgba(42,39,37,0.1)','--border-mid':'rgba(42,39,37,0.15)',
      '--text':'#2A2725','--text-mid':'#7A816C','--text-muted':'#A58B71','--ink':'#2A2725',
      '--sage':'#7A816C','--rose':'#D1A9A5','--rust':'#AE6965','--tan':'#A58B71','--sand':'#E5DFD6',
      '--shadow-sm':'0 1px 4px rgba(42,39,37,0.07)','--shadow-md':'0 4px 20px rgba(42,39,37,0.09)'
    },
    noir: {
      label: 'Noir', swatch: ['#1A1A1A','#2A2A2A','#D63C2A','#E8E0D8'],
      '--bg':'#1A1A1A','--bg-lift':'#222222','--surface':'#2A2A2A','--surface-2':'#333333',
      '--border':'rgba(255,255,255,0.07)','--border-mid':'rgba(255,255,255,0.12)',
      '--text':'#E8E0D8','--text-mid':'#9A9490','--text-muted':'#6A6460','--ink':'#F0EBE5',
      '--sage':'#607070','--rose':'#C0A898','--rust':'#D63C2A','--tan':'#9A9490','--sand':'#333333',
      '--shadow-sm':'0 1px 4px rgba(0,0,0,0.4)','--shadow-md':'0 4px 20px rgba(0,0,0,0.5)'
    },
    forest: {
      label: 'Forest', swatch: ['#2B1F18','#3C2C22','#E9D7BE','#F5F0E8'],
      '--bg':'#2B1F18','--bg-lift':'#34261D','--surface':'#3C2C22','--surface-2':'#493529',
      '--border':'rgba(245,240,232,0.09)','--border-mid':'rgba(245,240,232,0.15)',
      '--text':'#F5F0E8','--text-mid':'#CBBDAA','--text-muted':'#9B8A78','--ink':'#FFF7EC',
      '--sage':'#6F8F6B','--rose':'#C8A878','--rust':'#E9D7BE','--tan':'#F5F0E8','--sand':'#493529',
      '--shadow-sm':'0 1px 4px rgba(0,0,0,0.26)','--shadow-md':'0 4px 20px rgba(0,0,0,0.36)'
    },
    grove: {
      label: 'Grove', swatch: ['#E3DCD2','#F0EBE3','#013328'],
      '--bg':'#E3DCD2','--bg-lift':'#F5F0E8','--surface':'#F0EBE3','--surface-2':'#C8BFB0',
      '--border':'rgba(1,51,40,0.1)','--border-mid':'rgba(1,51,40,0.16)',
      '--text':'#2A2420','--text-mid':'#5A4A3A','--text-muted':'#7A6B54','--ink':'#1A1410',
      '--sage':'#CC8B65','--rose':'#CC8B65','--rust':'#013328','--tan':'#CC8B65','--sand':'#013328',
      '--shadow-sm':'0 1px 4px rgba(1,51,40,0.08)','--shadow-md':'0 4px 20px rgba(1,51,40,0.12)'
    },
    haus: {
      label: 'Haus', swatch: ['#2F4454','#2E151B','#DA7B93','#E8D8DC'],
      '--bg':'#2F4454','--bg-lift':'#263C4A','--surface':'#2E151B','--surface-2':'#3A1E24',
      '--border':'rgba(218,123,147,0.1)','--border-mid':'rgba(218,123,147,0.18)',
      '--text':'#E8D8DC','--text-mid':'#DA7B93','--text-muted':'#7A8F9A','--ink':'#F5EEF0',
      '--sage':'#376E6F','--rose':'#DA7B93','--rust':'#DA7B93','--tan':'#7A8F9A','--sand':'#2E151B',
      '--shadow-sm':'0 1px 4px rgba(0,0,0,0.36)','--shadow-md':'0 4px 20px rgba(0,0,0,0.48)'
    },
    fiesta: {
      label: 'Fiesta', swatch: ['#F9FAF4','#F0F1EA','#F9A66C','#2A2E2E'],
      '--bg':'#F9FAF4','--bg-lift':'#FFFFFF','--surface':'#F0F1EA','--surface-2':'#E6E7DF',
      '--border':'rgba(74,97,99,0.1)','--border-mid':'rgba(74,97,99,0.16)',
      '--text':'#2A2E2E','--text-mid':'#4A6163','--text-muted':'#7A8A8B','--ink':'#1A2020',
      '--sage':'#4A6163','--rose':'#F17A7E','--rust':'#F9A66C','--tan':'#FFC94B','--sand':'#E6E7DF',
      '--shadow-sm':'0 1px 4px rgba(74,97,99,0.08)','--shadow-md':'0 4px 20px rgba(74,97,99,0.12)'
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
  Object.entries(THEMES[key]).forEach(([name, value]) => {
    if (name.startsWith('--')) root.style.setProperty(name, value);
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEMES[key]['--bg']);

  // Expose globally so settings.html can read all themes
  window.THEMES = THEMES;
})();
