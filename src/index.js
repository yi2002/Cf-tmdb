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