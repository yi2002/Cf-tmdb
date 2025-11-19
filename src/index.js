const TMDB_API_BASE = 'https://api.themoviedb.org/3';

const CHINA_CONFIG = {
  region: 'CN',
  language: 'zh-CN', 
  timezone: 'Asia/Shanghai'
};

/* ------------------- 图片源配置 ------------------- */
const imageSources = [
  { name: 'tmdb-primary', hostname: 'image.tmdb.org', priority: 1, enabled: true },
  { name: 'tmdb-backup1', hostname: 'www.themoviedb.org', pathTransform: path => path.replace(/^\//,'/t/'), priority: 2, enabled: true },
  { name: 'tmdb-backup2', hostname: 'media.themoviedb.org', priority: 3, enabled: true }
];

/* ------------------- 多语言 URL 构造 ------------------- */
function constructMultilangUrls(originalUrl, source, originalPath) {
  const urls = [];
  const langPaths = [`/zh${originalPath}`, `/en${originalPath}`, originalPath];
  for(const lp of langPaths) {
    const url = new URL(originalUrl.toString());
    url.hostname = source.hostname;
    url.protocol = 'https:';
    url.pathname = source.pathTransform ? source.pathTransform(lp) : lp;
    urls.push(url.toString());
  }
  return urls;
}

/* ------------------- 并发抓取第一个成功 ------------------- */
async function fetchFirstSuccess(urls, timeout) {
  const promises = urls.map(u => fetchWithTimeout(u, timeout).then(r => ({r})).catch(e => ({e})));
  const results = await Promise.all(promises);
  for(const r of results) if(r.r && r.r.status === 200) return r.r;
  return null;
}

/* ------------------- fetch + 超时 + headers ------------------- */
async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { 
      signal: controller.signal, 
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TMDB-MultiSource-Proxy/2.0)',
        'Accept': 'image/*,*/*',
        'Referer': 'https://www.themoviedb.org/'
      }
    });
  } finally { 
    clearTimeout(id); 
  }
}

function isValidImage(response) {
  return response.headers.get('content-type')?.startsWith('image/');
}

/* ------------------- 图片请求检测 ------------------- */
function isImageRequest(pathname) {
  const patterns = [
    /^\/t\//,
    /^\/p\/w\d+\//,
    /^\/w\d+\//,
    /\/original\//,
    /\/backdrop\//,
    /\/profile\//,
    /\/logo\//,
    /\/poster\//,
    /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i
  ];
  return patterns.some(p => p.test(pathname));
}

/* ------------------- 主处理函数 ------------------- */
export default {
  async fetch(request, env, ctx) {
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
      // 地理位置端点
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

      // 调试页面
      if (path === '/debug-images') {
        const testImage = '/t/p/w500/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg';
        let results = [];
        
        for(const source of imageSources) {
          try {
            const urls = constructMultilangUrls(url, source, testImage);
            const response = await fetchFirstSuccess(urls, 3000);
            results.push({
              name: source.name,
              hostname: source.hostname,
              status: response ? response.status : 'Timeout',
              success: response && response.status === 200
            });
          } catch(err) {
            results.push({
              name: source.name,
              hostname: source.hostname,
              status: 'Error',
              success: false,
              error: err.message
            });
          }
        }
        
        const html = `
          <!DOCTYPE html>
          <html>
          <head><title>TMDB 多源图片测试</title></head>
          <body>
            <h1>多源图片代理测试</h1>
            ${results.map(result => `
              <div style="border-left: 4px solid ${result.success ? 'green' : 'red'}; padding: 10px; margin: 10px 0;">
                <h3>${result.name}</h3>
                <p>状态: ${result.status} ${result.success ? '✓' : '✗'}</p>
                <p>主机: ${result.hostname}</p>
                ${result.error ? `<p>错误: ${result.error}</p>` : ''}
              </div>
            `).join('')}
          </body>
          </html>
        `;
        
        return new Response(html, {
          headers: { ...baseHeaders, 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // 根路径
      if (path === '/') {
        return new Response(JSON.stringify({
          message: 'TMDB Proxy - 完整功能版',
          features: [
            '多源图片代理',
            '中国区域优化', 
            '地理位置标识',
            '调试页面'
          ],
          endpoints: {
            api: '/3/movie/550',
            image: '/t/p/w500/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg',
            location: '/location',
            debug: '/debug-images'
          }
        }), {
          headers: { ...baseHeaders, 'Content-Type': 'application/json' }
        });
      }

      // API 代理 - 添加中国参数
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

      // 多源图片代理
      if (isImageRequest(path)) {
        const availableSources = imageSources.filter(s => s.enabled).sort((a,b) => a.priority - b.priority);
        const log = [];

        for(const source of availableSources) {
          try {
            const urls = constructMultilangUrls(url, source, path);
            log.push(`尝试源: ${source.name}`);
            
            const response = await fetchFirstSuccess(urls, 5000);
            
            if(response && response.status === 200 && isValidImage(response)) {
              log.push(`成功使用源: ${source.name}`);
              
              const headers = new Headers(baseHeaders);
              const contentType = response.headers.get('content-type');
              if (contentType) headers.set('Content-Type', contentType);
              headers.set('Cache-Control', 'public, max-age=604800');
              headers.set('X-Image-Source', source.name);
              headers.set('X-Debug-Log', log.join('; '));
              
              return new Response(response.body, {
                status: 200,
                headers: headers
              });
            }
          } catch(err) {
            log.push(`源 ${source.name} 失败: ${err.message}`);
            continue;
          }
        }

        // 所有源都失败
        log.push('所有图片源均失败');
        return new Response(JSON.stringify({
          error: '所有图片源均失败',
          tried_sources: availableSources.map(s => s.name),
          log: log
        }), {
          status: 404,
          headers: { ...baseHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });

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