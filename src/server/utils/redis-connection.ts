import IORedis from 'ioredis';

export function createRedisConnection() {
  if (process.env.REDIS_URL) {
    return new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return new IORedis({
    host: process.env.REDIS_HOST || 'coolify-redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  });
}
