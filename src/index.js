const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const MY_PROXY_BASE = 'https://cf.6080808.xyz';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

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
        const targetUrl = `${TMDB_API_BASE}${path.substring(2)}${url.search}`;
        
        const resp = await fetch(targetUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (resp.ok) {
          const data = await resp.json();
          
          // 重写所有图片路径到我们的代理
          const rewriteImages = (obj) => {
            if (!obj) return;
            
            if (obj.backdrop_path) {
              obj.backdrop_path = `${MY_PROXY_BASE}/t/p${obj.backdrop_path}`;
            }
            if (obj.poster_path) {
              obj.poster_path = `${MY_PROXY_BASE}/t/p${obj.poster_path}`;
            }
            if (obj.profile_path) {
              obj.profile_path = `${MY_PROXY_BASE}/t/p${obj.profile_path}`;
            }
            if (obj.logo_path) {
              obj.logo_path = `${MY_PROXY_BASE}/t/p${obj.logo_path}`;
            }
            if (obj.still_path) {
              obj.still_path = `${MY_PROXY_BASE}/t/p${obj.still_path}`;
            }
            
            // 处理嵌套对象
            for (let key in obj) {
              if (obj[key] && typeof obj[key] === 'object') {
                rewriteImages(obj[key]);
              }
            }
            
            // 处理数组
            if (Array.isArray(obj)) {
              obj.forEach(item => rewriteImages(item));
            }
          };
          
          rewriteImages(data);
          
          return new Response(JSON.stringify(data), {
            headers: { 
              ...baseHeaders,
              'Content-Type': 'application/json; charset=utf-8'
            }
          });
        }

        return new Response(resp.body, {
          status: resp.status,
          headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      if (path.startsWith('/t/p/')) {
        const targetUrl = `${TMDB_IMAGE_BASE}${path.substring(4)}${url.search}`;
        
        const resp = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
          }
        });

        if (resp.ok) {
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          return new Response(resp.body, { status: resp.status, headers });
        }
        
        return new Response(null, { status: 404 });
      }

      return new Response(null, { status: 404 });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
}