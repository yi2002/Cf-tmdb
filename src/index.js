const API_ORIGIN = 'https://api.themoviedb.org';
const IMAGE_ORIGIN = 'https://image.tmdb.org';
const API_CACHE_TTL = 600;
const IMAGE_CACHE_TTL = 86400;
const MAX_CONCURRENT = 5;

let queue = 0;

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const MAX_DELAY = 60000;

async function fetchWithDynamicRateLimiting(url) {
  let attempt = 0;
  let delay = BASE_DELAY;

  while (attempt < MAX_RETRIES) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        throw new Error('Rate Limit Exceeded');
      }

      return response;
    } catch (error) {
      if (error.message === 'Rate Limit Exceeded') {
        attempt++;
        console.log(`Attempt ${attempt} failed. Retrying in ${delay / 1000}s...`);
        
        delay = Math.min(MAX_DELAY, delay * 2);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('Request failed:', error);
        throw error;
      }
    }
  }

  throw new Error('Max retries reached');
}

export default {
  async fetch(request, event) {
    const url = new URL(request.url);
    const { pathname, search } = url;

    if (pathname.startsWith('/3/') || pathname.startsWith('/4/')) {
      const target = `${API_ORIGIN}${pathname}${search}`;
      const apiResponse = await proxy(request, target, API_CACHE_TTL, false, event);

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        const imagePromises = [];

        if (apiData.poster_path) {
          imagePromises.push(fetchImage(apiData.poster_path, event));
        }
        if (apiData.backdrop_path) {
          imagePromises.push(fetchImage(apiData.backdrop_path, event));
        }

        await Promise.all(imagePromises);
        return apiResponse;
      }

      return apiResponse;
    }

    if (pathname.startsWith('/t/p/')) {
      const target = `${IMAGE_ORIGIN}${pathname}${search}`;
      return proxy(request, target, IMAGE_CACHE_TTL, true, event);
    }

    return new Response('OK', { status: 200 });
  }
};

async function proxy(incomingRequest, targetUrl, ttl, cacheImages, event) {
  while (queue >= MAX_CONCURRENT) await new Promise(r => setTimeout(r, 10));
  queue++;

  const hopByHop = new Set([
    'connection', 'keep-alive', 'transfer-encoding', 'proxy-connection',
    'upgrade', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers'
  ]);

  const reqHeaders = new Headers();
  for (const [k, v] of incomingRequest.headers) if (!hopByHop.has(k.toLowerCase()) && k.toLowerCase() !== 'host') reqHeaders.append(k, v);

  const init = { method: incomingRequest.method, headers: reqHeaders, body: needsBody(incomingRequest.method) ? incomingRequest.body : undefined, redirect: cacheImages ? 'follow' : 'manual' };
  const cache = caches.default;
  const cacheKey = new Request(targetUrl, init);

  if (cacheImages) {
    const cached = await cache.match(cacheKey);
    if (cached) { queue--; return cached; }
  }

  const upstream = await fetch(targetUrl, init);
  const resHeaders = new Headers();
  for (const [k, v] of upstream.headers) if (!hopByHop.has(k.toLowerCase())) resHeaders.append(k, v);

  resHeaders.set('Access-Control-Allow-Origin', '*');
  resHeaders.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  resHeaders.set('Access-Control-Allow-Headers', '*');
  resHeaders.set('Cache-Control', `public, max-age=${ttl}`);

  const response = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: resHeaders });

  if (cacheImages && upstream.ok) event.waitUntil(cache.put(cacheKey, response.clone()));

  queue--;
  return response;
}

function needsBody(method) {
  const m = method.toUpperCase();
  return m !== 'GET' && m !== 'HEAD';
}

async function fetchImage(imagePath, event) {
  const imageUrl = `${IMAGE_ORIGIN}/t/p/original${imagePath}`;
  const imageRequest = new Request(imageUrl);

  const imageResponse = await proxy(imageRequest, imageUrl, IMAGE_CACHE_TTL, true, event);

  return imageResponse;
}