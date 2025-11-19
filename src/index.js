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
      // API 请求 - 透明代理
      // ======================
      if (path.startsWith('/3/') || path === '/3') {
        const apiPath = path.replace('/3', '') || '';
        const targetUrl = `${TMDB_API_BASE}${apiPath}${url.search}`;
        
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
      // 图片请求 - 完全模拟浏览器
      // ======================
      if (path.startsWith('/t/p/')) {
        const imgPath = path.replace('/t/p', '');
        const targetUrl = `${TMDB_IMAGE_BASE}${imgPath}${url.search}`;
        
        console.log('🖼️ 转发图片请求到:', targetUrl);

        // 完全模拟真实浏览器的请求头
        const resp = await fetch(targetUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.themoviedb.org/',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site',
            'Cache-Control': 'no-cache',
            'DNT': '1',
            'Pragma': 'no-cache'
          },
          cf: {
            // 尝试使用更真实的 IP
            polish: "off",
            scrapeShield: false
          }
        });

        console.log('📨 图片响应状态:', resp.status);

        if (resp.status === 403 || resp.status === 451) {
          console.log('❌ 图片访问被拒绝，可能被屏蔽');
          return new Response(JSON.stringify({ 
            error: 'Image access blocked by TMDB',
            status: resp.status
          }), {
            status: 403,
            headers: { ...baseHeaders, 'Content-Type': 'application/json' }
          });
        }

        const newHeaders = new Headers(baseHeaders);
        resp.headers.forEach((v, k) => {
          newHeaders.set(k, v);
        });

        return new Response(resp.body, { 
          status: resp.status, 
          headers: newHeaders 
        });
      }

      // 默认响应
      return new Response(JSON.stringify({ 
        message: 'TMDB Enhanced Proxy Worker',
        note: '增强版代理，优化图片访问',
        endpoints: {
          api: '/3/...?api_key=YOUR_KEY',
          image: '/t/p/...'
        }
      }), {
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