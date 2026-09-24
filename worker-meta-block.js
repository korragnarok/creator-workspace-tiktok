    // ── Meta (Facebook + Instagram) ─────────────────────────────────────────
    // token:  trades the login code for a long-lived token (META_APP_SECRET never leaves this Worker)
    // oembed: finds a thumbnail for a public Instagram / Facebook video link
    if (service === 'meta') {
      const action = url.searchParams.get('action');
      const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const GRAPH = 'https://graph.facebook.com/v23.0';

      if (action === 'oembed') {
        const target = url.searchParams.get('url') || '';
        if (!/^https:\/\/(www\.)?(instagram\.com|facebook\.com|fb\.watch)\//i.test(target)) return json({ error: 'Unsupported link' }, 400);
        const token = `${env.META_APP_ID}|${env.META_APP_SECRET}`;
        try {
          // 1) Meta's official oEmbed
          const isIG = /instagram\.com/i.test(target);
          const ep = isIG ? 'instagram_oembed' : 'oembed_video';
          const o = await (await fetch(`${GRAPH}/${ep}?` + new URLSearchParams({ url: target, access_token: token, fields: 'thumbnail_url' }))).json();
          if (o.thumbnail_url) return json({ thumbnail_url: o.thumbnail_url });
          // 2) Instagram fallback: read the cover image from the post's public embed page
          const m = target.match(/instagram\.com\/(?:[^\/]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
          if (m) {
            const html = await (await fetch(`https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed/`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
            const img = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/) || html.match(/<img[^>]+src="(https:\/\/[^"]*(?:cdninstagram|fbcdn)[^"]+)"/);
            if (img) return json({ thumbnail_url: img[1].replace(/&amp;/g, '&') });
          }
          return json({ error: o.error?.message || 'No thumbnail found' }, 404);
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      if (action !== 'token') return json({ error: 'Unknown meta action' }, 400);
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
      try {
        const body = await request.json();
        const shortRes = await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({
          client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET,
          redirect_uri: body.redirect_uri || '', code: body.code || '',
        }));
        const short = await shortRes.json();
        if (!short.access_token) return json({ error: short.error?.message || 'Token exchange failed' }, 400);
        const longRes = await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({
          grant_type: 'fb_exchange_token', client_id: env.META_APP_ID,
          client_secret: env.META_APP_SECRET, fb_exchange_token: short.access_token,
        }));
        const long = await longRes.json();
        return json({ access_token: long.access_token || short.access_token });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }
