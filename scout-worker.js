export default {
  async fetch(request, env) {

    const origin = request.headers.get('Origin') || '';
    const allowed = ['https://take24.co', 'https://www.take24.co'];
    if (!allowed.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const service = url.searchParams.get('service'); // 'scrape' or 'gemini'

    // ── Gemini proxy (POST) ──────────────────────────────────────────────────
    if (service === 'gemini') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      }
      const model = url.searchParams.get('model') || 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
      try {
        const body = await request.text();
        const apiRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await apiRes.text();
        return new Response(data, {
          status: apiRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── ScrapeCreators proxy (GET) ───────────────────────────────────────────
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const endpoint = url.searchParams.get('endpoint');
    if (!endpoint) {
      return new Response('Missing endpoint param', { status: 400, headers: corsHeaders });
    }

    const isVersioned = /^v\d+\//.test(endpoint);
    const apiBase = isVersioned
      ? 'https://api.scrapecreators.com/'
      : 'https://api.scrapecreators.com/v1/';

    const forwardUrl = new URL(apiBase + endpoint);
    for (const [key, val] of url.searchParams.entries()) {
      if (key !== 'endpoint' && key !== 'service') forwardUrl.searchParams.set(key, val);
    }

    try {
      const apiRes = await fetch(forwardUrl.toString(), {
        headers: {
          'x-api-key': env.SCRAPE_API_KEY,
          'Content-Type': 'application/json',
        },
      });
      const data = await apiRes.text();
      return new Response(data, {
        status: apiRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
};
