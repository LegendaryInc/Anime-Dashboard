// utils/jikan.js

const axios = require('axios');

// In-memory cache for Jikan results
const jikanCache = new Map();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Rate limiting: Jikan allows 3 req/sec, 60 req/min
// We'll be conservative: 2 req/sec with delays
class JikanRateLimiter {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.minDelayMs = 500; // 2 requests per second
    this.requestCount = 0;
    this.minuteStart = Date.now();
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      
      if (now - this.minuteStart > 60000) {
        this.requestCount = 0;
        this.minuteStart = now;
      }

      if (this.requestCount >= 50) { // 50 to be safe
        const waitTime = 60000 - (now - this.minuteStart);
        console.log(`⏳ Jikan rate limit: waiting ${Math.ceil(waitTime / 1000)}s`);
        await this.sleep(waitTime);
        this.requestCount = 0;
        this.minuteStart = Date.now();
      }

      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelayMs) {
        await this.sleep(this.minDelayMs - timeSinceLastRequest);
      }

      const { fn, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();
      this.requestCount++;

      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const jikanLimiter = new JikanRateLimiter();

// Fetch English title from Jikan with rate limiting, caching, and retry logic
async function fetchEnglishFromJikan(idMal, retries = 3) {
  if (!idMal) return null;

  const cacheKey = `jikan_${idMal}`;
  const cached = jikanCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.title;
  }

  return jikanLimiter.add(async () => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const r = await axios.get(`https://api.jikan.moe/v4/anime/${idMal}`, {
          timeout: 5000,
          headers: { 'User-Agent': 'Anime-Dashboard/1.0' }
        });
        
        const title = r?.data?.data?.title_english?.trim() || null;
        
        jikanCache.set(cacheKey, {
          title,
          timestamp: Date.now()
        });
        
        return title;
      } catch (error) {
        if (error.response?.status === 429 || error.response?.status >= 500) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 8000);
          console.warn(`⚠️  Jikan error for MAL ${idMal}, retry ${attempt + 1}/${retries} after ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        if (error.response?.status === 404) {
          jikanCache.set(cacheKey, { title: null, timestamp: Date.now() });
        }
        
        return null;
      }
    }
    
    console.warn(`❌ Jikan failed for MAL ${idMal} after ${retries} attempts`);
    return null;
  });
}

// Export the function and the limiter instance
module.exports = {
  fetchEnglishFromJikan,
  jikanLimiter,
  jikanCache
};