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
      console.log('🔍 收到请求:', request.method, path);

      // ======================
      // API 请求
      // ======================
      if (path.startsWith('/3')) {
        // 保持原始路径，直接转发到 TMDB API
        const targetUrl = `${TMDB_API_BASE}${path.replace('/3', '')}${url.search}`;
        
        console.log('🚀 转发 API 请求到:', targetUrl);

        const resp = await fetch(targetUrl, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        console.log('📨 API 响应状态:', resp.status);

        return new Response(resp.body, {
          status: resp.status,
          headers: { 
            ...baseHeaders, 
            'Content-Type': 'application/json; charset=utf-8' 
          }
        });
      }

      // ======================
      // 图片请求
      // ======================
      if (path.startsWith('/t/p')) {
        // 保持原始路径，直接转发到 TMDB 图片
        const targetUrl = `${TMDB_IMAGE_BASE}${path.replace('/t/p', '')}${url.search}`;
        
        console.log('🖼️ 转发图片请求到:', targetUrl);

        const resp = await fetch(targetUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://www.themoviedb.org/',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
          }
        });

        console.log('📨 图片响应状态:', resp.status, 'Content-Type:', resp.headers.get('content-type'));

        const newHeaders = new Headers(baseHeaders);
        resp.headers.forEach((v, k) => {
          newHeaders.set(k, v);
        });

        return new Response(resp.body, { 
          status: resp.status, 
          headers: newHeaders 
        });
      }

      // 默认响应 - 显示可用路径
      return new Response(JSON.stringify({ 
        message: 'TMDB Proxy Worker',
        note: '请使用正确的路径',
        available_paths: {
          api: {
            example: '/3/movie/550?api_key=YOUR_KEY',
            description: 'TMDB API 代理'
          },
          image: {
            example: '/t/p/w500/8Gxv8eSTLYGaK5Agr12v3gph4SR.jpg',
            description: 'TMDB 图片代理'
          }
        }
      }), {
        status: 404,
        headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });

    } catch (err) {
      console.error('❌ Worker错误:', err);
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