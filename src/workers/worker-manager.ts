/**
 * Worker Manager for horizontal scaling
 * Manages multiple worker instances for distributed processing
 */

import { Worker } from 'bullmq';
import { getRedisClient } from '../lib/redis/cluster-config';

export interface WorkerConfig {
  name: string;
  processor: any;
  concurrency: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

export class WorkerManager {
  private workers: Map<string, Worker[]> = new Map();
  private redis = getRedisClient();

  /**
   * Start all workers with horizontal scaling
   */
  async startAll(instanceId: string = process.env.WORKER_INSTANCE_ID || '0'): Promise<void> {
    // Worker processors would be imported from actual worker files
    // For now, this is a template for production deployment
    const workerConfigs: WorkerConfig[] = [];

    console.log(`🚀 Worker manager initialized on instance ${instanceId}`);
    console.log('ℹ️  Import worker processors from ./scraping.worker, ./ai-processing.worker, etc.');

    // Example configuration (uncomment when worker files are created):
    // const workerConfigs: WorkerConfig[] = [
    //   {
    //     name: 'scraping',
    //     processor: scrapingProcessor,
    //     concurrency: parseInt(process.env.SCRAPING_CONCURRENCY || '3'),
    //     limiter: { max: 5, duration: 60000 },
    //   },
    //   {
    //     name: 'ai-processing',
    //     processor: aiProcessingProcessor,
    //     concurrency: parseInt(process.env.AI_CONCURRENCY || '5'),
    //     limiter: { max: 10, duration: 60000 },
    //   },
    //   {
    //     name: 'publishing',
    //     processor: publishingProcessor,
    //     concurrency: parseInt(process.env.PUBLISHING_CONCURRENCY || '2'),
    //     limiter: { max: 3, duration: 60000 },
    //   },
    // ];

    for (const config of workerConfigs) {
      await this.startWorker(config, instanceId);
    }

    if (workerConfigs.length > 0) {
      console.log('✅ All workers started successfully');
    }
  }

  /**
   * Start individual worker with configuration
   */
  private async startWorker(config: WorkerConfig, instanceId: string): Promise<void> {
    const { name, processor, concurrency, limiter } = config;

    const worker = new Worker(name, processor, {
      connection: this.redis,
      concurrency,
      limiter,
      autorun: true,
      // Worker identification
      prefix: `worker:${instanceId}`,
      // Graceful shutdown
      lockDuration: 30000,
      lockRenewTime: 15000,
      // Staleness check
      stalledInterval: 30000,
      maxStalledCount: 3,
    });

    // Event listeners
    worker.on('ready', () => {
      console.log(`✅ Worker ${name} ready (instance: ${instanceId}, concurrency: ${concurrency})`);
    });

    worker.on('active', (job) => {
      console.log(`▶️  Worker ${name} processing job ${job.id}`);
    });

    worker.on('completed', (job) => {
      console.log(`✅ Worker ${name} completed job ${job.id}`);
    });

    worker.on('failed', (job, error) => {
      console.error(`❌ Worker ${name} failed job ${job?.id}:`, error.message);
    });

    worker.on('error', (error) => {
      console.error(`❌ Worker ${name} error:`, error);
    });

    worker.on('stalled', (jobId) => {
      console.warn(`⚠️  Worker ${name} job ${jobId} stalled`);
    });

    // Store worker instance
    const workers = this.workers.get(name) || [];
    workers.push(worker);
    this.workers.set(name, workers);
  }

  /**
   * Stop all workers gracefully
   */
  async stopAll(): Promise<void> {
    console.log('🛑 Stopping all workers...');

    for (const [name, workers] of this.workers.entries()) {
      for (const worker of workers) {
        await worker.close();
      }
      console.log(`✅ Worker ${name} stopped`);
    }

    this.workers.clear();
    console.log('✅ All workers stopped');
  }

  /**
   * Pause all workers
   */
  async pauseAll(): Promise<void> {
    for (const workers of this.workers.values()) {
      for (const worker of workers) {
        await worker.pause();
      }
    }
    console.log('⏸️  All workers paused');
  }

  /**
   * Resume all workers
   */
  async resumeAll(): Promise<void> {
    for (const workers of this.workers.values()) {
      for (const worker of workers) {
        await worker.resume();
      }
    }
    console.log('▶️  All workers resumed');
  }

  /**
   * Get worker statistics
   */
  async getStats(): Promise<{
    [key: string]: {
      active: number;
      completed: number;
      failed: number;
      concurrency: number;
      instances: number;
    };
  }> {
    const stats: any = {};

    for (const [name, workers] of this.workers.entries()) {
      stats[name] = {
        active: 0,
        completed: 0,
        failed: 0,
        concurrency: 0,
        instances: workers.length,
      };
    }

    return stats;
  }

  /**
   * Health check for all workers
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    workers: { [key: string]: { running: boolean; instances: number } };
  }> {
    const workers: any = {};
    let allHealthy = true;

    for (const [name, workerList] of this.workers.entries()) {
      const running = workerList.some(w => !w.isPaused());
      workers[name] = {
        running,
        instances: workerList.length,
      };

      if (!running) {
        allHealthy = false;
      }
    }

    return {
      healthy: allHealthy,
      workers,
    };
  }

  /**
   * Scale worker concurrency dynamically
   */
  async scaleWorker(name: string, newConcurrency: number): Promise<void> {
    const workers = this.workers.get(name);
    if (!workers) {
      throw new Error(`Worker ${name} not found`);
    }

    for (const worker of workers) {
      // Note: BullMQ doesn't support dynamic concurrency changes
      // Would need to restart worker with new config
      console.log(`ℹ️  Scaling ${name} to concurrency ${newConcurrency} (requires restart)`);
    }
  }
}

// Singleton instance
let workerManager: WorkerManager | null = null;

export function getWorkerManager(): WorkerManager {
  if (!workerManager) {
    workerManager = new WorkerManager();
  }
  return workerManager;
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);

  const manager = getWorkerManager();
  await manager.stopAll();

  console.log('✅ Graceful shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
if (process.env.NODE_ENV === 'production') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
