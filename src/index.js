const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const CHINA_CONFIG = {
  region: 'CN',
  language: 'zh-CN', 
  timezone: 'Asia/Shanghai'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const baseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': '*',
      'X-Server-Region': 'CN',
      'X-Content-Location': 'China',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: baseHeaders });
    }

    try {
      if (path === '/location' || path === '/geo') {
        return new Response(JSON.stringify({
          country: 'CN',
          country_name: 'China',
          region: 'Asia',
          timezone: CHINA_CONFIG.timezone,
          language: CHINA_CONFIG.language,
          network: 'Cloudflare China'
        }), {
          headers: { ...baseHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/3/')) {
        let targetUrl = `${TMDB_API_BASE}${path.substring(2)}`;
        const searchParams = new URLSearchParams(url.search);
        
        if (!searchParams.has('region')) {
          searchParams.set('region', CHINA_CONFIG.region);
        }
        if (!searchParams.has('language') && !path.includes('/configuration')) {
          searchParams.set('language', CHINA_CONFIG.language);
        }
        
        targetUrl = `${targetUrl}?${searchParams.toString()}`;
        
        const resp = await fetch(targetUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

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
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

        if (resp.ok) {
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          return new Response(resp.body, { status: resp.status, headers });
        }
      }

      if (path.match(/\.(jpg|jpeg|png|webp)$/i)) {
        const targetUrl = `https://image.tmdb.org/t/p${path}${url.search}`;
        
        const resp = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

        if (resp.ok) {
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          return new Response(resp.body, { status: resp.status, headers });
        }
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