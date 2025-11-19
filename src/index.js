// 图片请求处理 - 修复版
if (path.startsWith('/t/p/')) {
  // 保持原始路径格式
  const imagePath = path.replace('/t/p/', '/t/p/');
  const targetUrl = `https://image.tmdb.org${imagePath}${url.search}`;
  
  console.log('🖼️ 转发图片请求:', targetUrl);

  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.themoviedb.org/',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
        'DNT': '1',
        'Connection': 'keep-alive'
      }
    });

    console.log('📨 图片响应状态:', resp.status);

    if (resp.status === 200) {
      const headers = new Headers(baseHeaders);
      // 复制所有原始图片响应头
      resp.headers.forEach((value, key) => {
        if (!key.toLowerCase().includes('cookie')) {
          headers.set(key, value);
        }
      });
      
      // 确保缓存头
      headers.set('Cache-Control', 'public, max-age=2592000'); // 30天
      headers.set('X-Proxy-Source', 'TMDB-CF-Proxy');
      
      return new Response(resp.body, {
        status: 200,
        headers: headers
      });
    } else {
      // 返回更详细的错误信息
      return new Response(JSON.stringify({
        error: '图片获取失败',
        status: resp.status,
        targetUrl: targetUrl,
        workerVersion: '2.0-fixed'
      }), {
        status: resp.status,
        headers: { ...baseHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('❌ 图片代理错误:', error);
    return new Response(JSON.stringify({
      error: '图片代理内部错误',
      message: error.message
    }), {
      status: 500,
      headers: { ...baseHeaders, 'Content-Type': 'application/json' }
    });
  }
}