/**
 * Redis cluster configuration for production
 */

import { Redis, Cluster } from 'ioredis';

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  tls?: boolean;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
  retryStrategy: (times: number) => number;
}

/**
 * Create Redis client with production-ready configuration
 */
export function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  const config: RedisConfig = {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };

  // Parse Redis URL
  if (redisUrl.startsWith('rediss://') || redisUrl.startsWith('redis://')) {
    return new Redis(redisUrl, {
      ...config,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
      // Keepalive to prevent connection drops
      keepAlive: 30000,
      // Connection timeout
      connectTimeout: 10000,
      // Disable offline queue for faster failures
      enableOfflineQueue: false,
      // Reconnect on error
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some(targetError => err.message.includes(targetError));
      },
    });
  }

  throw new Error('Invalid REDIS_URL format');
}

/**
 * Create Redis Cluster client (for high availability)
 */
export function createRedisCluster(nodes: string[]): Cluster {
  return new Cluster(
    nodes.map(node => {
      const [host, port] = node.split(':');
      return { host, port: parseInt(port) };
    }),
    {
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      },
      clusterRetryStrategy: (times) => {
        return Math.min(times * 100, 3000);
      },
    }
  );
}

/**
 * Singleton Redis instance
 */
let redisInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = createRedisClient();

    // Handle connection events
    redisInstance.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisInstance.on('ready', () => {
      console.log('✅ Redis ready');
    });

    redisInstance.on('error', (error) => {
      console.error('❌ Redis error:', error);
    });

    redisInstance.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    redisInstance.on('close', () => {
      console.log('⚠️ Redis connection closed');
    });
  }

  return redisInstance;
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const client = getRedisClient();
    await client.ping();
    const latency = Date.now() - start;

    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully disconnect Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}

/**
 * Get Redis info and statistics
 */
export async function getRedisStats(): Promise<{
  uptime: number;
  connectedClients: number;
  usedMemory: number;
  totalKeys: number;
}> {
  const client = getRedisClient();

  try {
    const info = await client.info();
    const dbSize = await client.dbsize();

    // Parse info string
    const uptimeMatch = info.match(/uptime_in_seconds:(\d+)/);
    const clientsMatch = info.match(/connected_clients:(\d+)/);
    const memoryMatch = info.match(/used_memory:(\d+)/);

    return {
      uptime: uptimeMatch ? parseInt(uptimeMatch[1]) : 0,
      connectedClients: clientsMatch ? parseInt(clientsMatch[1]) : 0,
      usedMemory: memoryMatch ? parseInt(memoryMatch[1]) : 0,
      totalKeys: dbSize,
    };
  } catch (error) {
    console.error('Error getting Redis stats:', error);
    return {
      uptime: 0,
      connectedClients: 0,
      usedMemory: 0,
      totalKeys: 0,
    };
  }
}

/**
 * Redis cache warmup helper
 */
export async function warmupCache(keys: string[]): Promise<void> {
  const client = getRedisClient();

  console.log(`🔥 Warming up cache with ${keys.length} keys...`);

  for (const key of keys) {
    try {
      await client.get(key);
    } catch (error) {
      console.error(`Error warming up key ${key}:`, error);
    }
  }

  console.log('✅ Cache warmup complete');
}

/**
 * Flush all Redis data (use with caution!)
 */
export async function flushAllRedis(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot flush Redis in production');
  }

  const client = getRedisClient();
  await client.flushall();
  console.log('🗑️  Redis flushed');
}

/**
 * Export connection for BullMQ
 */
export const redisConnection = getRedisClient();
