const TMDB_API_BASE = 'https://api.themoviedb.org';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 通用 CORS 头
    const baseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    // 处理 OPTIONS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: baseHeaders });
    }

    // 处理 HEAD 请求（Emby 可能会用）
    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers: baseHeaders });
    }

    try {
      // -------------------------------------------------------------------
      // 📌 1. TMDb API 代理
      // -------------------------------------------------------------------
      if (path.startsWith('/3/')) {
        const apiKey = env.TMDB_API_KEY;
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        };

        // 处理认证头
        const auth = request.headers.get("Authorization");
        if (auth) {
          headers["Authorization"] = auth;
        } else if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        } else {
          return new Response(JSON.stringify({ error: "Missing TMDB API Key" }), {
            status: 500,
            headers: { ...baseHeaders, "Content-Type": "application/json" }
          });
        }

        const targetUrl = TMDB_API_BASE + path + url.search;
        
        const resp = await fetch(targetUrl, { 
          headers,
          cf: {
            // 添加 Cloudflare 缓存策略
            cacheTtl: 300, // 5分钟缓存
            cacheEverything: true,
          }
        });

        // 复制重要的响应头
        const responseHeaders = {
          ...baseHeaders,
          "Content-Type": resp.headers.get("Content-Type") || "application/json",
        };

        // 如果有缓存相关头，也传递
        const cacheControl = resp.headers.get("Cache-Control");
        if (cacheControl) {
          responseHeaders["Cache-Control"] = cacheControl;
        }

        return new Response(resp.body, {
          status: resp.status,
          headers: responseHeaders
        });
      }

      // -------------------------------------------------------------------
      // 📌 2. TMDb 图片代理（Emby 海报 / Fanart）
      // -------------------------------------------------------------------
      if (path.startsWith('/t/p/')) {
        const targetUrl = TMDB_IMAGE_BASE + path + url.search;

        const imgResp = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.themoviedb.org/",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          },
          cf: {
            // 图片缓存更长时间
            cacheTtl: 604800, // 7天
            cacheEverything: true,
          }
        });

        if (!imgResp.ok) {
          return new Response("Image not found", { 
            status: 404, 
            headers: baseHeaders 
          });
        }

        // 构建图片响应头
        const imageHeaders = {
          ...baseHeaders,
          "Content-Type": imgResp.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=604800, immutable", // 图片可长期缓存
        };

        // 可选：传递更多原始头
        const etag = imgResp.headers.get("ETag");
        if (etag) imageHeaders["ETag"] = etag;
        
        const lastModified = imgResp.headers.get("Last-Modified");
        if (lastModified) imageHeaders["Last-Modified"] = lastModified;

        return new Response(imgResp.body, {
          status: imgResp.status,
          headers: imageHeaders
        });
      }

      // -------------------------------------------------------------------
      // 📌 3. 健康检查端点
      // -------------------------------------------------------------------
      if (path === '/health' || path === '/') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          service: 'TMDB Proxy Worker',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...baseHeaders, "Content-Type": "application/json" }
        });
      }

      // 其他路径
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, 
        headers: { ...baseHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      console.error('Proxy Error:', err);
      return new Response(JSON.stringify({ 
        error: "Internal Server Error",
        message: err.message 
      }), {
        status: 500,
        headers: { ...baseHeaders, "Content-Type": "application/json" }
      });
    }
  },
};