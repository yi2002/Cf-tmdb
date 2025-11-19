const TMDB_API_BASE = 'https://api.themoviedb.org';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 🎯 重点：记录所有请求，看看 Emby 到底在请求什么
    console.log('📱 请求来自:', request.headers.get('user-agent')?.includes('Emby') ? 'Emby' : 'Browser');
    console.log('📍 请求路径:', path + url.search);
    console.log('---');

    const baseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: baseHeaders });
    }

    try {
      if (path.startsWith('/3/')) {
        const apiKey = env.TMDB_API_KEY;
        const headers = { 'Accept': 'application/json' };

        const auth = request.headers.get("Authorization");
        if (auth) {
          headers["Authorization"] = auth;
          console.log('🔑 Emby 提供了 Auth 头');
        } else if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
          console.log('🔑 使用 Worker 的 API Key');
        }

        const targetUrl = TMDB_API_BASE + path + url.search;
        console.log('🚀 代理到:', targetUrl);
        
        const resp = await fetch(targetUrl, { headers });
        
        console.log('✅ TMDb 响应:', resp.status);
        if (resp.status !== 200) {
          const errorText = await resp.text();
          console.log('❌ 错误内容:', errorText);
        }

        return new Response(resp.body, {
          status: resp.status,
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      if (path.startsWith('/t/p/')) {
        const targetUrl = TMDB_IMAGE_BASE + path + url.search;
        const resp = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://www.themoviedb.org/'
          }
        });

        return new Response(resp.body, {
          status: resp.status,
          headers: {
            ...baseHeaders,
            'Content-Type': resp.headers.get('Content-Type') || 'image/jpeg'
          }
        });
      }

      return new Response('Not Found', { status: 404, headers: baseHeaders });

    } catch (err) {
      console.error('💥 错误:', err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};