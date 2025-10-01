import { Redis } from 'ioredis';

/**
 * Redis caching service for performance optimization
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class RedisCache {
  private redis: Redis;
  private defaultTTL: number = 3600; // 1 hour
  private prefix: string = 'cache:';

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.prefix + key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached value
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const ttl = options?.ttl || this.defaultTTL;
      const prefixedKey = (options?.prefix || this.prefix) + key;

      await this.redis.setex(prefixedKey, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(this.prefix + key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete all keys matching pattern
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(this.prefix + pattern);
      if (keys.length === 0) return 0;

      await this.redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(this.prefix + key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetchFn();

    // Cache it
    await this.set(key, fresh, options);

    return fresh;
  }

  /**
   * Increment counter
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.redis.incr(this.prefix + key);
    } catch (error) {
      console.error('Cache incr error:', error);
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.redis.decr(this.prefix + key);
    } catch (error) {
      console.error('Cache decr error:', error);
      return 0;
    }
  }

  /**
   * Set expiration on key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      await this.redis.expire(this.prefix + key, seconds);
      return true;
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Get time to live for key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(this.prefix + key);
    } catch (error) {
      console.error('Cache ttl error:', error);
      return -1;
    }
  }

  /**
   * Cache invalidation helpers
   */
  async invalidateWorkspace(workspaceId: string): Promise<void> {
    await this.delPattern(`workspace:${workspaceId}:*`);
  }

  async invalidateWorkflowRun(runId: string): Promise<void> {
    await this.delPattern(`workflow:${runId}:*`);
  }

  async invalidateContent(contentId: string): Promise<void> {
    await this.delPattern(`content:${contentId}:*`);
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton instance
export const cache = new RedisCache();

/**
 * Cache decorator for functions
 */
export function Cacheable(options?: CacheOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;

      return await cache.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}
