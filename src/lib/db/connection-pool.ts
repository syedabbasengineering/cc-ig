/**
 * Database connection pooling configuration for production
 */

import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

/**
 * Create Prisma client with connection pooling optimizations
 */
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

/**
 * Singleton Prisma client instance
 * In development, use global to preserve instance across hot reloads
 * In production, create new instance
 */
export const prismaWithPool =
  global.prisma ||
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prismaWithPool;
}

/**
 * Connection pool configuration for serverless
 */
export const poolConfig = {
  // Maximum number of connections in the pool
  maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),

  // Minimum number of connections in the pool
  minConnections: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '2'),

  // Time to wait for a connection before timing out (ms)
  connectionTimeoutMillis: 30000,

  // Time a connection can be idle before being released (ms)
  idleTimeoutMillis: 30000,

  // Maximum lifetime of a connection (ms)
  maxLifetimeSeconds: 3600,
};

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    await prismaWithPool.$queryRaw`SELECT 1`;
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
 * Gracefully disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  await prismaWithPool.$disconnect();
}

/**
 * Middleware for query logging and performance monitoring
 * Note: Prisma v5+ uses $extends instead of $use for middleware
 */
export function setupQueryLogging() {
  // Query logging is handled via Prisma's log configuration
  // in the PrismaClient initialization above
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Prisma query logging enabled');
  }
}

/**
 * Connection pool statistics
 */
export async function getConnectionStats(): Promise<{
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
}> {
  // This would require database-specific queries
  // For PostgreSQL:
  try {
    const result = await prismaWithPool.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    return {
      activeConnections: Number(result[0]?.count || 0),
      idleConnections: 0, // Would need additional query
      totalConnections: Number(result[0]?.count || 0),
    };
  } catch (error) {
    console.error('Error getting connection stats:', error);
    return {
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
    };
  }
}

/**
 * Transaction helper with retry logic
 */
export async function withTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await prismaWithPool.$transaction(async (tx) => {
        return await fn(tx as PrismaClient);
      });
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's not a connection error
      if (!isConnectionError(error)) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Transaction failed after retries');
}

/**
 * Check if error is a connection error that should be retried
 */
function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const connectionErrors = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'Connection terminated',
    'Connection lost',
    'Connection pool timeout',
  ];

  return connectionErrors.some(msg => error.message.includes(msg));
}
