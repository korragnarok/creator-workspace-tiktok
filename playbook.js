// ─── Script Playbook ──────────────────────────────────────────────────────────
// The playbook text lives ONLY in your Supabase account (user_planner, key "playbook"),
// never in these public files. Edit it in Settings → Script Playbook.
// Needs supabase.js (db) and planner-sync.js (plannerGet/plannerSet).
let _pbCache = null;
async function getPlaybook(){
  if (_pbCache !== null) return _pbCache;
  try { const v = await plannerGet('playbook', null); _pbCache = (v && typeof v === 'object' ? v.text : v) || ''; }
  catch(e) { _pbCache = ''; }
  return _pbCache;
}
function setPlaybookCache(text){ _pbCache = text || ''; }
// Just the hard rules section (used by policy checks and reviews)
async function getPlaybookRules(){
  const t = await getPlaybook(); if (!t) return '';
  const m = t.match(/##[^\n]*HARD RULES[\s\S]*?(?=\n## |\n### Decisions|\n---\s*\n#|$)/i);
  return m ? m[0].trim() : '';
}
// Block to paste into any script-writing prompt
async function playbookPrompt(){
  const t = await getPlaybook(); if (!t) return '';
  return `\n=== KOURTNEY'S SCRIPT PLAYBOOK (follow this — it's her coaching notes; the HARD RULES are non-negotiable and override anything else) ===\n${t.replace(/\n### Open questions[\s\S]*$/i,'').trim()}\n=== END PLAYBOOK ===\n`;
}
// preload so it's ready when a prompt is built
try { setTimeout(() => getPlaybook(), 300); } catch(e) {}
// Synchronous versions (use after the preload above has finished — it loads on page open)
function playbookPromptSync(){
  const t = _pbCache || ''; if (!t) return '';
  return `\n=== KOURTNEY'S SCRIPT PLAYBOOK (follow this — her coaching notes; the HARD RULES are non-negotiable and override anything else) ===\n${t.replace(/\n### Open questions[\s\S]*$/i,'').trim()}\n=== END PLAYBOOK ===\n`;
}
function playbookRulesSync(){
  const t = _pbCache || ''; const m = t.match(/##[^\n]*HARD RULES[\s\S]*?(?=\n## |\n### Decisions|\n---\s*\n#|$)/i);
  return m ? `\nHER HARD RULES:\n${m[0].trim()}\n` : '';
}
