const TMDB_API_BASE = 'https://api.themoviedb.org/3';

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
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: baseHeaders });
    }

    try {
      // 根路径
      if (path === '/') {
        return new Response(JSON.stringify({
          message: 'TMDB Proxy - 多源图片代理',
          features: ['多源自动回退', '多语言支持', '快速出图'],
          endpoints: {
            api: '/3/movie/550',
            image: '/t/p/w500/kBf3g9crrADGMc2AMAMlLBgSm2h.jpg'
          }
        }), {
          headers: { ...baseHeaders, 'Content-Type': 'application/json' }
        });
      }

      // API 代理
      if (path.startsWith('/3/')) {
        const targetUrl = `${TMDB_API_BASE}${path.substring(2)}${url.search}`;
        
        const resp = await fetch(targetUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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

        for(const source of availableSources) {
          try {
            const urls = constructMultilangUrls(url, source, path);
            const response = await fetchFirstSuccess(urls, 5000);
            
            if(response && response.status === 200 && isValidImage(response)) {
              const headers = new Headers(baseHeaders);
              const contentType = response.headers.get('content-type');
              if (contentType) headers.set('Content-Type', contentType);
              headers.set('Cache-Control', 'public, max-age=604800');
              headers.set('X-Image-Source', source.name);
              
              return new Response(response.body, {
                status: 200,
                headers: headers
              });
            }
          } catch(err) {
            continue;
          }
        }

        // 所有源都失败
        return new Response(JSON.stringify({
          error: '所有图片源均失败',
          tried_sources: availableSources.map(s => s.name)
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