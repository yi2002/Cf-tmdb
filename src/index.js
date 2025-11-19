const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASEconst TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org';

// 多图片源配置
const IMAGE_SOURCES = [
  { name: 'tmdb-primary', base: 'https://image.tmdb.org/t/p', priority: 1 },
  { name: 'tmdb-backup1', base: 'https://www.themoviedb.org/t/p', priority: 2 },
  { name: 'tmdb-backup2', base: 'https://media.themoviedb.org/t/p', priority: 3 },
];

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
      console.log('收到请求:', path, url.search);

      // API 请求 - 强制使用您的 API Key
      if (path.startsWith('/3/')) {
        let targetUrl = `${TMDB_API_BASE}${path.substring(2)}`;
        const searchParams = new URLSearchParams(url.search);
        
        // 🔥 关键修复：强制覆盖 API Key
        if (env.TMDB_API_KEY) {
          searchParams.set('api_key', env.TMDB_API_KEY);
          console.log('使用 API Key:', env.TMDB_API_KEY.substring(0, 8) + '...');
        } else {
          return new Response(JSON.stringify({
            error: 'TMDB_API_KEY 环境变量未设置',
            solution: '请在 Cloudflare Workers 环境变量中设置您的 TMDB API Key'
          }), {
            status: 500,
            headers: { ...baseHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 添加中国区域优化
        if (!searchParams.has('region')) {
          searchParams.set('region', 'CN');
        }
        if (!searchParams.has('language') && !path.includes('/configuration')) {
          searchParams.set('language', 'zh-CN');
        }
        
        targetUrl = `${targetUrl}?${searchParams.toString()}`;
        console.log('转发 API 到:', targetUrl);
        
        const resp = await fetch(targetUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        console.log('API 响应状态:', resp.status);
        return new Response(resp.body, {
          status: resp.status,
          headers: { ...baseHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 多源图片代理
      if (path.startsWith('/t/p/')) {
        const imagePath = path.substring('/t/p/'.length);
        console.log('图片请求:', imagePath);
        
        // 尝试所有图片源
        for (const source of IMAGE_SOURCES.sort((a, b) => a.priority - b.priority)) {
          try {
            const targetUrl = `${source.base}/${imagePath}`;
            console.log('尝试图片源:', source.name, targetUrl);
            
            const resp = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*,*/*',
                'Referer': 'https://www.themoviedb.org/',
              }
            });

            console.log('图片源响应:', source.name, resp.status);
            
            if (resp.status === 200) {
              const headers = new Headers(baseHeaders);
              headers.set('Content-Type', resp.headers.get('content-type') || 'image/jpeg');
              headers.set('X-Image-Source', source.name);
              headers.set('Cache-Control', 'public, max-age=2592000'); // 30天缓存
              return new Response(resp.body, { status: 200, headers });
            }
          } catch (err) {
            console.log('图片源失败:', source.name, err.message);
            continue;
          }
        }
        
        return new Response(JSON.stringify({ 
          error: '图片在所有源中都不可用',
          tried_sources: IMAGE_SOURCES.map(s => s.name)
        }), {
          status: 404,
          headers: { ...baseHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 根路径显示状态
      return new Response(JSON.stringify({ 
        message: 'TMDB Proxy - 强制 API Key 版本',
        status: env.TMDB_API_KEY ? 'API Key 已配置' : 'API Key 未配置',
        usage: {
          api: '/3/movie/278',
          image: '/t/p/w500/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg'
        }
      }), {
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      console.error('Worker 错误:', err);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: err.message
      }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
} = 'https://image.tmdb.org';

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
      // 特殊调试路径 - 显示图片测试结果
      if (path === '/debug-images') {
        const testImage = '/t/p/w500/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg'; // 肖申克的救赎海报
        
        const testUrls = [
          { name: '标准路径', url: `${TMDB_IMAGE_BASE}${testImage}` },
        ];
        
        let results = [];
        
        for (const test of testUrls) {
          try {
            const resp = await fetch(test.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.themoviedb.org/',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site'
              }
            });
            results.push({
              name: test.name,
              url: test.url,
              status: resp.status,
              success: resp.ok,
              proxyUrl: test.url.replace(TMDB_IMAGE_BASE, 'https://cf.6080808.xyz')
            });
          } catch (err) {
            results.push({
              name: test.name,
              url: test.url,
              status: 'Error',
              success: false,
              error: err.message
            });
          }
        }
        
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>TMDB 图片路径测试</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .test { margin: 10px 0; padding: 10px; border-left: 4px solid #ccc; }
              .success { border-color: green; background: #f0fff0; }
              .fail { border-color: red; background: #fff0f0; }
              a { color: #0066cc; }
            </style>
          </head>
          <body>
            <h1>TMDB 图片路径测试结果</h1>
            ${results.map(result => `
              <div class="test ${result.success ? 'success' : 'fail'}">
                <h3>${result.name}</h3>
                <p><strong>状态:</strong> ${result.status} ${result.success ? '✓' : '✗'}</p>
                <p><strong>原始URL:</strong> <a href="${result.url}" target="_blank">${result.url}</a></p>
                <p><strong>代理URL:</strong> <a href="${result.proxyUrl}" target="_blank">${result.proxyUrl}</a></p>
                ${result.error ? `<p><strong>错误:</strong> ${result.error}</p>` : ''}
              </div>
            `).join('')}
            <hr>
            <h2>配置状态:</h2>
            <pre>
{
  "ApiBaseUrls": ["https://cf.6080808.xyz/3"],
  "ImageBaseUrls": ["https://cf.6080808.xyz/t/p"],
  "TMDB_API_KEY": "${env.TMDB_API_KEY ? '已设置' : '未设置'}"
}
            </pre>
          </body>
          </html>
        `;
        
        return new Response(html, {
          headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

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
        
        // 如果没有 API Key，使用环境变量中的 API Key
        if (!searchParams.has('api_key') && env.TMDB_API_KEY) {
          searchParams.set('api_key', env.TMDB_API_KEY);
        }
        
        // 添加中国区域参数
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

      // 图片请求处理 - 增强版
      if (path.startsWith('/t/p/')) {
        const target = TMDB_IMAGE_BASE + path + url.search;

        // 使用更完整的浏览器头信息
        const resp = await fetch(target, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.themoviedb.org/',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
          }
        });

        if (resp.ok) {
          // 返回原始图片流
          return new Response(resp.body, {
            status: resp.status,
            headers: {
              ...baseHeaders,
              'Content-Type': resp.headers.get('Content-Type') || 'image/jpeg',
              'Cache-Control': 'public, max-age=31536000', // 1年缓存
              'Expires': new Date(Date.now() + 31536000000).toUTCString(),
            }
          });
        } else {
          // 如果图片获取失败，返回错误信息
          return new Response(JSON.stringify({
            error: '图片获取失败',
            status: resp.status,
            url: target
          }), {
            status: resp.status,
            headers: { ...baseHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // 根路径显示调试链接
      if (path === '/') {
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>TMDB Proxy</title>
          </head>
          <body>
            <h1>TMDB Proxy 服务运行中</h1>
            <p>API Key 状态: ${env.TMDB_API_KEY ? '✅ 已设置' : '❌ 未设置'}</p>
            <p><a href="/debug-images">测试图片路径</a></p>
            <p><a href="/location">查看地理位置</a></p>
            <p><a href="/3/movie/550">测试API</a></p>
            <p><a href="/t/p/w500/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg">测试图片</a></p>
          </body>
          </html>
        `;
        return new Response(html, {
          headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      return new Response(null, { status: 404 });

    } catch (err) {
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