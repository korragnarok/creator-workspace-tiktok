const GEMINI_KEY_STORAGE = 'gemini_api_key';

window.CreatorGemini = (() => {
  let ai = null;
  let sdkPromise = null;
  let modalPromise = null;

  function savedKey() {
    try { return localStorage.getItem(GEMINI_KEY_STORAGE) || ''; } catch(e) { return ''; }
  }

  function looksLikeKey(key) {
  return true;
}

  async function loadSdk() {
    if (!sdkPromise) sdkPromise = import('https://esm.run/@google/genai');
    return sdkPromise;
  }

  async function initialize(key) {
    const cleanKey = String(key || '').trim();
    if (!looksLikeKey(cleanKey)) throw new Error('Gemini API key does not look valid.');
    const { GoogleGenAI } = await loadSdk();
    ai = new GoogleGenAI({ apiKey: cleanKey });
    return ai;
  }

  function ensureModal() {
    let overlay = document.getElementById('geminiKeyModal');
    if (overlay) return overlay;

    const style = document.createElement('style');
    style.textContent = `
      .gemini-key-overlay{display:none;position:fixed;inset:0;z-index:900;align-items:center;justify-content:center;background:rgba(0,0,0,0.52);backdrop-filter:blur(5px);padding:24px;}
      .gemini-key-overlay.open{display:flex;}
      .gemini-key-modal{width:min(520px,100%);border:1px solid var(--border-mid);border-radius:16px;background:var(--bg-lift);box-shadow:var(--shadow-md);padding:24px;color:var(--text);}
      .gemini-key-title{font-family:'IBM Plex Serif',serif;font-size:28px;font-weight:800;line-height:1.05;color:var(--ink);margin-bottom:8px;}
      .gemini-key-copy{font-size:14px;color:var(--text-mid);line-height:1.6;margin-bottom:16px;}
      .gemini-key-copy a{color:var(--rust);text-decoration:underline;text-underline-offset:3px;}
      .gemini-key-input{width:100%;border:1px solid var(--border-mid);border-radius:10px;background:var(--bg);color:var(--ink);padding:12px 14px;outline:none;margin-bottom:16px;}
      .gemini-key-input:focus{border-color:var(--rust);}
      .gemini-key-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;}
    `;
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.id = 'geminiKeyModal';
    overlay.className = 'gemini-key-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="gemini-key-modal">
        <div class="gemini-key-title">Connect Gemini</div>
        <div class="gemini-key-copy">
          Paste your own Gemini API key to use AI features. You can get one from
          <a href="https://aistudio.google.com/" target="_blank" rel="noopener">Google AI Studio</a>.
          Your key stays in this browser only.
        </div>
<input class="gemini-key-input" id="geminiKeyInput" type="password" autocomplete="off" placeholder="Paste your API key here...">

        <div class="gemini-key-actions">
          <button class="btn btn-primary" id="geminiSaveKeyBtn" type="button">Save Key</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('geminiSaveKeyBtn').addEventListener('click', saveFromModal);
    document.getElementById('geminiKeyInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveFromModal();
      }
    });
    return overlay;
  }

  async function saveFromModal() {
  const input = document.getElementById('geminiKeyInput');
  const key = input?.value.trim() || '';
    try {
    localStorage.setItem(GEMINI_KEY_STORAGE, key);
    await initialize(key);
    closeModal();
    if (modalPromise) {
      modalPromise.resolve(ai);
      modalPromise = null;
    }
  } catch (error) {
    alert('Could not initialize Gemini with that key. Please check it and try again.');
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    ai = null;
    input?.focus();
  }
}

  function closeModal() {
    document.getElementById('geminiKeyModal')?.classList.remove('open');
  }

  function showKeyPrompt() {
    ensureModal().classList.add('open');
    setTimeout(() => document.getElementById('geminiKeyInput')?.focus(), 80);
    if (!modalPromise) {
      modalPromise = {};
      modalPromise.promise = new Promise(resolve => { modalPromise.resolve = resolve; });
    }
    return modalPromise.promise;
  }

  async function init(options = {}) {
    const key = savedKey();
    if (looksLikeKey(key)) {
      try { return await initialize(key); }
      catch(e) {
        localStorage.removeItem(GEMINI_KEY_STORAGE);
        ai = null;
      }
    }
    return options.autoPrompt ? showKeyPrompt() : null;
  }

  async function requireKey() {
    if (ai) return ai;
    const key = savedKey();
    if (looksLikeKey(key)) return initialize(key);
    return showKeyPrompt();
  }

  function disconnect() {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    ai = null;
    showKeyPrompt();
  }

  function isAuthError(error) {
    const text = `${error?.message || ''} ${error?.status || ''} ${error?.code || ''}`.toLowerCase();
    return text.includes('403') || text.includes('400') || text.includes('api key') || text.includes('permission') || text.includes('auth');
  }

  function responseText(response) {
    return typeof response.text === 'function' ? response.text() : (response.text || '');
  }

  async function generateText(prompt, options = {}) {
    try {
      const client = await requireKey();
      const response = await client.models.generateContent({
        model: options.model || 'gemini-2.5-flash',
        contents: prompt,
        config: options.config || undefined
      });
      return responseText(response);
    } catch (error) {
      if (isAuthError(error)) {
        alert('Your Gemini API key failed. Please enter a new key.');
        localStorage.removeItem(GEMINI_KEY_STORAGE);
        ai = null;
        showKeyPrompt();
      }
      throw error;
    }
  }

  async function generateJson(prompt, schema, options = {}) {
    const text = await generateText(prompt, {
      ...options,
      config: {
        ...(options.config || {}),
        responseMimeType: 'application/json',
        responseJsonSchema: schema
      }
    });
    return JSON.parse(String(text || '').replace(/```json|```/gi, '').trim());
  }

  return { init, requireKey, disconnect, generateText, generateJson, hasKey: () => looksLikeKey(savedKey()) };
})();
