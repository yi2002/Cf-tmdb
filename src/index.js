const TMDB_API_BASE = 'https://api.themoviedb.org';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org';

// 存储日志的全局变量
let requestLogs = [];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const now = new Date().toISOString();

    // 增强的Emby检测
    const userAgent = request.headers.get('user-agent') || '';
    const isEmby = userAgent.includes('Emby') || 
                   userAgent.includes('emby') ||
                   userAgent.includes('Emby-Server');

    // 记录请求
    const logEntry = {
      time: now,
      method: request.method,
      path: path + url.search,
      userAgent: userAgent.substring(0, 80),
      isEmby: isEmby,
      origin: request.headers.get('origin') || 'unknown'
    };
    
    // 添加到日志数组
    requestLogs.unshift(logEntry);
    if (requestLogs.length > 50) {
      requestLogs = requestLogs.slice(0, 50);
    }
    
    // 输出到控制台
    console.log(`${now} - ${request.method} ${path} - Emby: ${isEmby} - Origin: ${logEntry.origin}`);

    const baseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': '*',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: baseHeaders });
    }

    try {
      // 日志查看页面
      if (path === '/logs' || path === '/debug') {
        const embyCount = requestLogs.filter(log => log.isEmby).length;
        const apiCount = requestLogs.filter(log => log.path.startsWith('/3/')).length;
        const imageCount = requestLogs.filter(log => log.path.startsWith('/t/p/')).length;
        const embyApiCount = requestLogs.filter(log => log.isEmby && log.path.startsWith('/3/')).length;
        
        const logInfo = {
          summary: {
            total_requests: requestLogs.length,
            emby_requests: embyCount,
            api_requests: apiCount,
            image_requests: imageCount,
            emby_api_requests: embyApiCount,
            status: embyApiCount > 0 ? '✅ Emby配置正确' : '❌ Emby未发送API请求'
          },
          recent_requests: requestLogs.slice(0, 20),
          config_check: {
            emby_user_agent_detected: embyCount > 0,
            expected_emby_requests: 'Emby应该发送到 /3/ 路径的API请求',
            setup_guide: '在Emby TMDB插件中设置API服务器为: https://cf.6080808.xyz'
          }
        };
        
        return new Response(JSON.stringify(logInfo, null, 2), {
          headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      // API 代理
      if (path.startsWith('/3/')) {
        console.log(`🎬 API请求: ${path} - 来自Emby: ${isEmby}`);
        
        const apiKey = env.TMDB_API_KEY;
        const headers = { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };

        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
          console.log('🔑 使用Worker API Key');
        } else {
          return new Response(JSON.stringify({ 
            success: false, 
            status_code: 7,
            status_message: "Invalid API key" 
          }), {
            status: 401,
            headers: { ...baseHeaders, "Content-Type": "application/json" }
          });
        }

        const targetUrl = TMDB_API_BASE + path + url.search;
        console.log('🚀 请求TMDb API:', targetUrl);
        
        const resp = await fetch(targetUrl, { headers });
        const responseBody = await resp.text();
        
        console.log('📡 TMDb响应状态:', resp.status);
        
        // 调试图片路径
        try {
          const data = JSON.parse(responseBody);
          console.log('📊 数据检查 - 请求来自Emby:', isEmby);
          
          if (data.poster_path) {
            console.log('✅ 海报路径:', data.poster_path);
            console.log('完整海报URL:', `${TMDB_IMAGE_BASE}/t/p/w500${data.poster_path}`);
          } else {
            console.log('❌ 海报路径为空');
          }
          
          if (data.profile_path) {
            console.log('✅ 人物图片路径:', data.profile_path);
          } else {
            console.log('❌ 人物图片路径为空');
          }
          
          if (data.backdrop_path) {
            console.log('✅ 背景图路径:', data.backdrop_path);
          }
          
          // 处理搜索结果
          if (data.results && Array.isArray(data.results)) {
            console.log(`📋 找到 ${data.results.length} 个结果`);
            data.results.forEach((item, index) => {
              if (item.poster_path) {
                console.log(`🎞️ 结果${index}海报:`, item.poster_path);
              }
            });
          }
        } catch (e) {
          console.log('解析响应数据时出错:', e.message);
        }
        
        return new Response(responseBody, {
          status: resp.status,
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json; charset=utf-8'
          }
        });
      }

      // 图片代理
      if (path.startsWith('/t/p/')) {
        console.log(`🖼️ 图片请求: ${path} - 来自Emby: ${isEmby}`);
        
        const targetUrl = TMDB_IMAGE_BASE + path + url.search;
        console.log('完整图片URL:', targetUrl);
        
        const resp = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.themoviedb.org/',
            'Accept': 'image/webp,image/apng,image/*,*/*'
          }
        });
        
        console.log('图片响应状态:', resp.status);
        console.log('内容类型:', resp.headers.get('content-type'));
        
        return new Response(resp.body, {
          status: resp.status,
          headers: {
            ...baseHeaders,
            'Content-Type': resp.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }

      // 主页
      return new Response(JSON.stringify({ 
        message: 'TMDB代理Worker - 增强调试版',
        endpoints: {
          logs: '/logs - 查看请求日志和Emby状态',
          api_test: '/3/movie/550?language=zh-CN',
          image_test: '/t/p/w500/rJBDuMN2FkGpFSVNSK3yPt5DLlV.jpg'
        },
        emby_setup: {
          api_server: 'https://cf.6080808.xyz',
          check_status: '在Emby中刷新电影后查看 /logs'
        }
      }), {
        headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });

    } catch (err) {
      console.error('💥 错误:', err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  }
}