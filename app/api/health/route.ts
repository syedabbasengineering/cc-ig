import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/src/lib/db/connection-pool';
import { checkRedisHealth } from '@/src/lib/redis/cluster-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  try {
    // Check database
    const dbHealth = await checkDatabaseHealth();

    // Check Redis
    const redisHealth = await checkRedisHealth();

    // Overall health status
    const healthy = dbHealth.healthy && redisHealth.healthy;
    const responseTime = Date.now() - startTime;

    const health = {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: {
          status: dbHealth.healthy ? 'up' : 'down',
          latency: dbHealth.latency ? `${dbHealth.latency}ms` : undefined,
          error: dbHealth.error,
        },
        redis: {
          status: redisHealth.healthy ? 'up' : 'down',
          latency: redisHealth.latency ? `${redisHealth.latency}ms` : undefined,
          error: redisHealth.error,
        },
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nodeVersion: process.version,
      },
    };

    return NextResponse.json(health, {
      status: healthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
