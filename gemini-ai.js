// Gemini calls route through the Cloudflare worker — no API key needed in browser
const WORKER_URL = 'https://take24-scout.kortnycall5.workers.dev';

window.CreatorGemini = (() => {

  function responseText(response) {
    return response?.candidates?.[0]?.content?.parts
      ?.map(part => part?.text || '')
      .join('')
      .trim() || '';
  }

  function buildPayload(prompt, options = {}) {
    const payload = {
      contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }]
    };
    if (options.config && Object.keys(options.config).length) {
      payload.generationConfig = options.config;
    }
    if (Array.isArray(options.tools) && options.tools.length) {
      payload.tools = options.tools;
    }
    return payload;
  }

  async function requestGemini(prompt, options = {}) {
    const model = options.model || 'gemini-2.5-flash';
    const url = new URL(WORKER_URL);
    url.searchParams.set('service', 'gemini');
    url.searchParams.set('model', model);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(prompt, options))
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Gemini request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    const text = responseText(data);
    if (!text) throw new Error('Gemini returned an empty response.');
    return text;
  }

  async function generateText(prompt, options = {}) {
    return await requestGemini(prompt, options);
  }

  async function generateJson(prompt, schema, options = {}) {
    const text = await generateText(prompt, {
      ...options,
      config: {
        ...(options.config || {}),
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });
    return JSON.parse(String(text || '').replace(/```json|```/gi, '').trim());
  }

  async function init() {
    // No-op — key lives in Cloudflare, nothing to initialize
  }

  // Stubs for any code that still calls these — harmless no-ops
  function hasKey() { return true; }
  function showKeyPrompt() { return Promise.resolve(true); }
  function disconnect() {}
  function updateIndicator() {}
  async function requireKey() { return 'worker'; }

  return { init, requireKey, disconnect, generateText, generateJson, hasKey, showKeyPrompt, updateIndicator };
})();
