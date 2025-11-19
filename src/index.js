const TMDB_API_BASE = 'https://api.themoviedb.org';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org';

export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 处理 TMDb API 请求
      if (path.startsWith('/3/')) {
        const apiKey = env.TMDB_API_KEY;
        const authHeader = request.headers.get('Authorization');
        const reqHeaders = {};

        if (authHeader) {
          reqHeaders['Authorization'] = authHeader;
        } else if (apiKey) {
          reqHeaders['Authorization'] = `Bearer ${apiKey}`;
        }

        const tmdbUrl = TMDB_API_BASE + path + url.search;
        const resp = await fetch(tmdbUrl, { headers: reqHeaders });
        const data = await resp.json();

        return new Response(JSON.stringify(data), {
          status: resp.status,
          headers,
        });
      }

      // 处理 TMDb 图片请求
      if (path.startsWith('/t/p/')) {
        const tmdbUrl = TMDB_IMAGE_BASE + path + url.search;
        const resp = await fetch(tmdbUrl);
        const arrayBuffer = await resp.arrayBuffer();

        return new Response(arrayBuffer, {
          status: resp.status,
          headers: {
            ...headers,
            'Content-Type': resp.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'max-age=86400',
          },
        });
      }

      // 非法路径返回 404
      return new Response('Not found', { status: 404, headers });
    } catch (err) {
      console.error('TMDb Worker error:', err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers,
      });
    }
  },
};