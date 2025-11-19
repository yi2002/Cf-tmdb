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

      // 图片请求处理 - 尝试多种可能的路径
      if (path.startsWith('/t/p/')) {
        // 方式1: 标准路径 /t/p/w500/xxx.jpg -> https://image.tmdb.org/t/p/w500/xxx.jpg
        const targetUrl1 = `${TMDB_IMAGE_BASE}${path.substring(4)}${url.search}`;
        console.log('尝试方式1:', targetUrl1);
        
        let resp = await fetch(targetUrl1, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

        if (resp.ok) {
          console.log('方式1成功');
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          return new Response(resp.body, { status: resp.status, headers });
        }
        
        // 方式1失败，尝试方式2: 直接路径 /t/p/xxx.jpg -> https://image.tmdb.org/t/p/w500/xxx.jpg
        const filename = path.split('/').pop();
        const targetUrl2 = `${TMDB_IMAGE_BASE}/w500/${filename}${url.search}`;
        console.log('尝试方式2:', targetUrl2);
        
        resp = await fetch(targetUrl2, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

        if (resp.ok) {
          console.log('方式2成功');
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          return new Response(resp.body, { status: resp.status, headers });
        }
      }

      // 处理其他可能的图片路径格式
      if (path.match(/\.(jpg|jpeg|png|webp)$/i)) {
        const filename = path.split('/').pop();
        
        // 方式3: 直接文件名 /xxx.jpg -> https://image.tmdb.org/t/p/w500/xxx.jpg
        const targetUrl3 = `${TMDB_IMAGE_BASE}/w500/${filename}${url.search}`;
        console.log('尝试方式3:', targetUrl3);
        
        let resp = await fetch(targetUrl3, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

        if (resp.ok) {
          console.log('方式3成功');
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          return new Response(resp.body, { status: resp.status, headers });
        }
        
        // 方式4: 完整路径 /xxx.jpg -> https://image.tmdb.org/t/p/original/xxx.jpg
        const targetUrl4 = `${TMDB_IMAGE_BASE}/original/${filename}${url.search}`;
        console.log('尝试方式4:', targetUrl4);
        
        resp = await fetch(targetUrl4, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

        if (resp.ok) {
          console.log('方式4成功');
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          return new Response(resp.body, { status: resp.status, headers });
        }
      }

      // 所有方式都失败
      console.log('所有图片路径尝试均失败');
      return new Response(null, { status: 404 });

    } catch (err) {
      console.error('Worker错误:', err);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
}