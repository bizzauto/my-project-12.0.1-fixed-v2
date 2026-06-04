import IORedis from 'ioredis';

export function createRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  const redisPassword = process.env.REDIS_PASSWORD;
  
  // If no Redis credentials, return a dummy connection that does nothing
  if (!redisUrl && !redisPassword) {
    console.log('Redis: No credentials - running without Redis');
    return createDummyConnection();
  }
  
  try {
    const opts: any = {
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        if (times > 1) return null; // Stop retrying after 1 attempt
        return 200;
      },
      enableOfflineQueue: false,
      connectTimeout: 3000,
      commandTimeout: 3000,
    };

    let client: IORedis;
    if (redisUrl) {
      client = new IORedis(redisUrl, opts);
    } else {
      client = new IORedis({
        host: process.env.REDIS_HOST || 'coolify-redis',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: redisPassword,
        ...opts,
      });
    }

    client.on('error', () => {}); // Suppress errors silently
    return client;
  } catch {
    return createDummyConnection();
  }
}

function createDummyConnection(): IORedis {
  // Return a disconnected client that won't throw errors
  const client = new IORedis({ 
    lazyConnect: true, 
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  return client;
}
