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
      // 图片请求 - 修复版
      // ======================
      if (path.startsWith('/t/p')) {
        // 直接使用完整路径，不需要替换
        const targetUrl = `${TMDB_IMAGE_BASE}${path.substring('/t/p'.length)}${url.search}`;
        
        console.log('🖼️ 转发图片请求到:', targetUrl);

        const resp = await fetch(targetUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Referer': 'https://www.themoviedb.org/',
          }
        });

        console.log('📨 图片响应状态:', resp.status);

        if (resp.ok) {
          const newHeaders = new Headers(baseHeaders);
          // 复制所有原始响应头
          resp.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'set-cookie') { // 避免cookie问题
              newHeaders.set(key, value);
            }
          });
          
          // 确保缓存头正确
          newHeaders.set('Cache-Control', 'public, max-age=86400'); // 24小时缓存
          
          return new Response(resp.body, { 
            status: resp.status, 
            headers: newHeaders 
          });
        } else {
          console.error('❌ 图片请求失败:', resp.status);
          return new Response(null, { status: 404 });
        }
      }

      // ======================
      // 额外处理 Emby 可能使用的其他路径
      // ======================
      if (path.startsWith('/movie') || path.startsWith('/tv') || path.startsWith('/person')) {
        // 这些可能是 Emby 的图片请求
        const targetUrl = `https://www.themoviedb.org${path}${url.search}`;
        console.log('🎬 转发 Emby 图片请求到:', targetUrl);
        
        const resp = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Referer': 'https://www.themoviedb.org/',
          }
        });

        if (resp.ok) {
          const newHeaders = new Headers(baseHeaders);
          resp.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'set-cookie') {
              newHeaders.set(key, value);
            }
          });
          return new Response(resp.body, { status: resp.status, headers: newHeaders });
        }
      }

      // 默认响应
      return new Response(JSON.stringify({ 
        message: 'TMDB Proxy Worker - Fixed Version',
        available_paths: {
          api: '/3/...',
          image: '/t/p/w500/xxx.jpg'
        }
      }), {
        status: 404,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      console.error('❌ Worker错误:', err);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: err.message
      }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
}