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
      // 特殊调试路径 - 显示图片测试结果
      if (path === '/debug-images') {
        const testImage = '/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg'; // 肖申克的救赎海报
        
        const testUrls = [
          { name: '方式1: 标准路径', url: `${TMDB_IMAGE_BASE}/w500${testImage}` },
          { name: '方式2: 直接路径', url: `${TMDB_IMAGE_BASE}${testImage}` },
          { name: '方式3: 原始尺寸', url: `${TMDB_IMAGE_BASE}/original${testImage}` },
        ];
        
        let results = [];
        
        for (const test of testUrls) {
          try {
            const resp = await fetch(test.url);
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
            <h2>推荐配置:</h2>
            <pre>
{
  "ApiBaseUrls": ["https://cf.6080808.xyz/3"],
  "ImageBaseUrls": ["https://cf.6080808.xyz/t/p"]
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

      // 图片请求处理 - 增强版，包含多种路径尝试
      if (path.startsWith('/t/p/')) {
        const log = [];
        
        // 方式1: 标准路径 /t/p/w500/xxx.jpg -> https://image.tmdb.org/t/p/w500/xxx.jpg
        const targetUrl1 = `${TMDB_IMAGE_BASE}${path.substring(4)}${url.search}`;
        log.push(`尝试方式1: ${targetUrl1}`);
        
        let resp = await fetch(targetUrl1, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

        if (resp.ok) {
          log.push(`方式1成功: ${resp.status}`);
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          headers.set('X-Debug-Log', log.join('; '));
          return new Response(resp.body, { status: resp.status, headers });
        }
        
        log.push(`方式1失败: ${resp.status}`);
        
        // 方式2: 直接路径 /t/p/xxx.jpg -> https://image.tmdb.org/t/p/w500/xxx.jpg
        const filename = path.split('/').pop();
        const targetUrl2 = `${TMDB_IMAGE_BASE}/w500/${filename}${url.search}`;
        log.push(`尝试方式2: ${targetUrl2}`);
        
        resp = await fetch(targetUrl2, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

        if (resp.ok) {
          log.push(`方式2成功: ${resp.status}`);
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          headers.set('X-Debug-Log', log.join('; '));
          return new Response(resp.body, { status: resp.status, headers });
        }
        
        log.push(`方式2失败: ${resp.status}`);
        
        // 返回错误信息
        const headers = new Headers(baseHeaders);
        headers.set('Content-Type', 'application/json');
        headers.set('X-Debug-Log', log.join('; '));
        return new Response(JSON.stringify({
          error: '图片获取失败',
          attempts: log
        }), { status: 404, headers });
      }

      // 处理其他可能的图片路径格式
      if (path.match(/\.(jpg|jpeg|png|webp)$/i)) {
        const filename = path.split('/').pop();
        const log = [];
        
        // 方式3: 直接文件名 /xxx.jpg -> https://image.tmdb.org/t/p/w500/xxx.jpg
        const targetUrl3 = `${TMDB_IMAGE_BASE}/w500/${filename}${url.search}`;
        log.push(`尝试方式3: ${targetUrl3}`);
        
        let resp = await fetch(targetUrl3, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          }
        });

        if (resp.ok) {
          log.push(`方式3成功: ${resp.status}`);
          const headers = new Headers(baseHeaders);
          const contentType = resp.headers.get('content-type');
          if (contentType) headers.set('Content-Type', contentType);
          headers.set('X-Debug-Log', log.join('; '));
          return new Response(resp.body, { status: resp.status, headers });
        }
        
        log.push(`方式3失败: ${resp.status}`);
        
        // 返回错误信息
        const headers = new Headers(baseHeaders);
        headers.set('Content-Type', 'application/json');
        headers.set('X-Debug-Log', log.join('; '));
        return new Response(JSON.stringify({
          error: '图片获取失败',
          attempts: log
        }), { status: 404, headers });
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
            <p><a href="/debug-images">测试图片路径</a></p>
            <p><a href="/location">查看地理位置</a></p>
            <p><a href="/3/movie/550">测试API</a></p>
          </body>
          </html>
        `;
        return new Response(html, {
          headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
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