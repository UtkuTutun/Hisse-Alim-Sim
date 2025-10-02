type CacheEntry = {
  url?: string;
  buffer?: Buffer;
  expires: number;
};

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function getChart(key: string): CacheEntry | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    cache.delete(key);
    return undefined;
  }
  return e;
}

export function setChartUrl(key: string, url: string, ttl = DEFAULT_TTL) {
  cache.set(key, { url, expires: Date.now() + ttl });
}

export function setChartBuffer(key: string, buffer: Buffer, ttl = DEFAULT_TTL) {
  cache.set(key, { buffer, expires: Date.now() + ttl });
}

export function clearCache() {
  cache.clear();
}

export function cacheSize() {
  return cache.size;
}

export default { getChart, setChartUrl, setChartBuffer, clearCache, cacheSize };
