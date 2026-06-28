export default {
  async fetch(request, env) {

    const origin = request.headers.get('Origin') || '';
    const allowed = ['https://take24.co', 'https://www.take24.co'];
    if (!allowed.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');
    const params = url.searchParams;

    if (!endpoint) {
      return new Response('Missing endpoint param', { status: 400, headers: corsHeaders });
    }

    // Support versioned endpoints: if endpoint starts with v1/ or v2/ etc, use as-is
    // Otherwise prepend v1/ for backwards compatibility
    const isVersioned = /^v\d+\//.test(endpoint);
    const apiBase = isVersioned
      ? 'https://api.scrapecreators.com/'
      : 'https://api.scrapecreators.com/v1/';

    const forwardUrl = new URL(apiBase + endpoint);

    for (const [key, val] of params.entries()) {
      if (key !== 'endpoint') forwardUrl.searchParams.set(key, val);
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
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
};
