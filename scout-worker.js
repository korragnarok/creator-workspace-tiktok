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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // ── TikTok OAuth / API proxy ─────────────────────────────────────────────
    if (service === 'tiktok') {
      const action = url.searchParams.get('action');

      // Token exchange & refresh — POST, form-encoded to TikTok. client_secret never leaves this Worker.
      if (action === 'token' || action === 'refresh') {
        if (request.method !== 'POST') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }
        try {
          const body = await request.json();
          const params = new URLSearchParams({
            client_key: env.TIKTOK_CLIENT_KEY,
            client_secret: env.TIKTOK_CLIENT_SECRET,
          });
          if (action === 'token') {
            params.set('grant_type', 'authorization_code');
            params.set('code', body.code || '');
            params.set('redirect_uri', body.redirect_uri || '');
          } else {
            params.set('grant_type', 'refresh_token');
            params.set('refresh_token', body.refresh_token || '');
          }
          const apiRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cache-Control': 'no-cache',
            },
            body: params.toString(),
          });
          const data = await apiRes.text();
          return new Response(data, { status: apiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // User info (basic + stats) — GET, forwarded with the caller's access token
      if (action === 'user_info') {
        if (request.method !== 'GET') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const fields = 'open_id,avatar_url,display_name,follower_count,following_count,likes_count,video_count';
        try {
          const apiRes = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, {
            headers: { Authorization: authHeader },
          });
          const data = await apiRes.text();
          return new Response(data, { status: apiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Video list — POST passthrough, forwarded with the caller's access token
      if (action === 'video_list') {
        if (request.method !== 'POST') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const fields = 'id,cover_image_url,title,video_description,duration,create_time,share_url,view_count,like_count,comment_count,share_count';
        try {
          const body = await request.text();
          const apiRes = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${fields}`, {
            method: 'POST',
            headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
            body: body || JSON.stringify({ max_count: 20 }),
          });
          const data = await apiRes.text();
          return new Response(data, { status: apiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify({ error: 'Unknown tiktok action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
