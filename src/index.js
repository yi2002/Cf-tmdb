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
      console.log('请求路径:', path);

      // ======================
      // API 请求 /api/
      // ======================
      if (path.startsWith('/api/')) {
        const apiKey = env.TMDB_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ 
            status_code: 7, 
            status_message: 'Invalid API key: API key not configured' 
          }), {
            status: 401,
            headers: { ...baseHeaders, "Content-Type": "application/json" }
          });
        }

        // 构建API路径：去掉 /api 前缀
        const apiPath = path.replace('/api', '');
        const targetUrl = `${TMDB_API_BASE}${apiPath}${url.search}`;
        
        console.log('API请求URL:', targetUrl);

        // 添加API key到查询参数
        const targetUrlWithKey = new URL(targetUrl);
        targetUrlWithKey.searchParams.set('api_key', apiKey);

        const resp = await fetch(targetUrlWithKey.toString(), {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        });

        console.log('API响应状态:', resp.status);

        return new Response(resp.body, {
          status: resp.status,
          headers: { 
            ...baseHeaders, 
            'Content-Type': 'application/json; charset=utf-8' 
          }
        });
      }

      // ======================
      // 图片请求 /img/
      // ======================
      if (path.startsWith('/img/')) {
        // 构建图片路径：/img/w500/abc.jpg -> /t/p/w500/abc.jpg
        const imgPath = path.replace('/img', '');
        const targetUrl = `${TMDB_IMAGE_BASE}${imgPath}${url.search}`;
        
        console.log('图片请求URL:', targetUrl);

        const resp = await fetch(targetUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0', 
            'Referer': 'https://www.themoviedb.org/' 
          }
        });

        console.log('图片响应状态:', resp.status);

        if (!resp.ok) {
          return new Response(JSON.stringify({ error: 'Image not found' }), {
            status: 404,
            headers: { ...baseHeaders, 'Content-Type': 'application/json' }
          });
        }

        const newHeaders = new Headers(baseHeaders);
        resp.headers.forEach((v, k) => {
          // 保留重要的图片头信息
          if (['content-type', 'content-length', 'cache-control', 'etag'].includes(k.toLowerCase())) {
            newHeaders.set(k, v);
          }
        });

        return new Response(resp.body, { 
          status: resp.status, 
          headers: newHeaders 
        });
      }

      // 默认响应 - 提供使用说明
      return new Response(JSON.stringify({ 
        message: 'TMDB Proxy Worker',
        usage: {
          api: 'GET /api/movie/550',
          image: 'GET /img/w500/abc123.jpg'
        }
      }), {
        headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });

    } catch (err) {
      console.error('Worker错误:', err);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: err.message 
      }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  }
}