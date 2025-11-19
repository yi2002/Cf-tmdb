const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

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
          
          // 重写所有图片URL到我们的代理
          const rewriteImageUrls = (obj) => {
            if (obj && typeof obj === 'object') {
              for (let key in obj) {
                if (typeof obj[key] === 'string' && obj[key].includes('image.tmdb.org')) {
                  obj[key] = obj[key].replace('https://image.tmdb.org/t/p/', 'https://cf.6080808.xyz/t/p/');
                } else if (typeof obj[key] === 'object') {
                  rewriteImageUrls(obj[key]);
                }
              }
            }
          };
          
          rewriteImageUrls(data);
          
          return new Response(JSON.stringify(data), {
            headers: { 
              ...baseHeaders,
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'public, max-age=300'
            }
          });
        }

        return new Response(resp.body, {
          status: resp.status,
          headers: { 
            ...baseHeaders,
            'Content-Type': 'application/json; charset=utf-8'
          }
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
          headers.set('Cache-Control', 'public, max-age=2592000');
          return new Response(resp.body, { status: resp.status, headers });
        }
        
        return new Response(null, { status: 404 });
      }

      return new Response(null, { status: 404 });

    } catch (err) {
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error'
      }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
}