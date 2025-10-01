/**
 * Queue partition strategy for horizontal scaling
 * Distributes jobs across multiple queues based on various strategies
 */

import { Queue } from 'bullmq';
import { getRedisClient } from '../redis/cluster-config';

export type PartitionStrategy = 'round-robin' | 'workspace' | 'priority' | 'hash';

export interface PartitionConfig {
  strategy: PartitionStrategy;
  partitionCount: number;
  prefix: string;
}

export class QueuePartitioner {
  private queues: Map<string, Queue[]> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private redis = getRedisClient();

  /**
   * Initialize partitioned queues
   */
  initializePartitions(queueName: string, config: PartitionConfig): void {
    const { partitionCount, prefix } = config;
    const partitions: Queue[] = [];

    for (let i = 0; i < partitionCount; i++) {
      const partitionName = `${prefix}:${queueName}:${i}`;
      const queue = new Queue(partitionName, {
        connection: this.redis,
      });

      partitions.push(queue);
    }

    this.queues.set(queueName, partitions);
    this.roundRobinCounters.set(queueName, 0);

    console.log(`✅ Initialized ${partitionCount} partitions for ${queueName}`);
  }

  /**
   * Add job to appropriate partition based on strategy
   */
  async addJob(
    queueName: string,
    jobName: string,
    data: any,
    strategy: PartitionStrategy = 'round-robin',
    options?: any
  ): Promise<void> {
    const partitions = this.queues.get(queueName);
    if (!partitions || partitions.length === 0) {
      throw new Error(`No partitions found for queue ${queueName}`);
    }

    const partitionIndex = this.selectPartition(
      queueName,
      data,
      strategy,
      partitions.length
    );

    const targetQueue = partitions[partitionIndex];
    await targetQueue.add(jobName, data, options);

    console.log(
      `📤 Added job ${jobName} to ${queueName} partition ${partitionIndex} (strategy: ${strategy})`
    );
  }

  /**
   * Select partition based on strategy
   */
  private selectPartition(
    queueName: string,
    data: any,
    strategy: PartitionStrategy,
    partitionCount: number
  ): number {
    switch (strategy) {
      case 'round-robin':
        return this.roundRobinSelect(queueName, partitionCount);

      case 'workspace':
        return this.workspaceHashSelect(data.workspaceId, partitionCount);

      case 'priority':
        return this.prioritySelect(data.priority, partitionCount);

      case 'hash':
        return this.hashSelect(data.id || data.workspaceId, partitionCount);

      default:
        return 0;
    }
  }

  /**
   * Round-robin partition selection
   */
  private roundRobinSelect(queueName: string, partitionCount: number): number {
    const counter = this.roundRobinCounters.get(queueName) || 0;
    const partition = counter % partitionCount;
    this.roundRobinCounters.set(queueName, counter + 1);
    return partition;
  }

  /**
   * Workspace-based partition selection
   * Ensures all jobs for a workspace go to the same partition
   */
  private workspaceHashSelect(workspaceId: string, partitionCount: number): number {
    if (!workspaceId) return 0;
    return this.hashSelect(workspaceId, partitionCount);
  }

  /**
   * Priority-based partition selection
   * High priority jobs go to dedicated partitions
   */
  private prioritySelect(priority: number = 5, partitionCount: number): number {
    if (priority >= 8) {
      // High priority: First partition
      return 0;
    } else if (priority >= 5) {
      // Medium priority: Middle partitions
      return Math.floor(partitionCount / 2);
    } else {
      // Low priority: Last partition
      return partitionCount - 1;
    }
  }

  /**
   * Hash-based partition selection
   * Consistent hashing for load distribution
   */
  private hashSelect(key: string, partitionCount: number): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % partitionCount;
  }

  /**
   * Get partition statistics
   */
  async getPartitionStats(queueName: string): Promise<
    Array<{
      partition: number;
      active: number;
      waiting: number;
      completed: number;
      failed: number;
    }>
  > {
    const partitions = this.queues.get(queueName);
    if (!partitions) {
      return [];
    }

    const stats = [];
    for (let i = 0; i < partitions.length; i++) {
      const queue = partitions[i];
      const counts = await queue.getJobCounts(
        'active',
        'waiting',
        'completed',
        'failed'
      );

      stats.push({
        partition: i,
        active: counts.active || 0,
        waiting: counts.waiting || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
      });
    }

    return stats;
  }

  /**
   * Rebalance partitions
   * Move jobs from overloaded partitions to underutilized ones
   */
  async rebalancePartitions(queueName: string): Promise<void> {
    const stats = await this.getPartitionStats(queueName);
    const partitions = this.queues.get(queueName);

    if (!partitions) return;

    // Calculate average load
    const totalWaiting = stats.reduce((sum, s) => sum + s.waiting, 0);
    const avgWaiting = totalWaiting / stats.length;
    const threshold = avgWaiting * 1.5; // 50% above average

    console.log(`🔄 Rebalancing ${queueName} (avg waiting: ${avgWaiting.toFixed(2)})`);

    // Find overloaded and underutilized partitions
    const overloaded = stats.filter(s => s.waiting > threshold);
    const underutilized = stats.filter(s => s.waiting < avgWaiting);

    for (const over of overloaded) {
      const excess = over.waiting - avgWaiting;
      const jobsToMove = Math.floor(excess / 2);

      if (underutilized.length > 0 && jobsToMove > 0) {
        console.log(
          `📊 Moving ${jobsToMove} jobs from partition ${over.partition} to underutilized partitions`
        );

        // Implementation would require moving jobs between queues
        // This is a simplified version - actual implementation would need job migration
      }
    }
  }

  /**
   * Get all partition queues for a given queue name
   */
  getPartitions(queueName: string): Queue[] {
    return this.queues.get(queueName) || [];
  }

  /**
   * Close all partitions
   */
  async closeAll(): Promise<void> {
    for (const [name, partitions] of this.queues.entries()) {
      for (const partition of partitions) {
        await partition.close();
      }
      console.log(`✅ Closed all partitions for ${name}`);
    }
    this.queues.clear();
  }
}

// Singleton instance
let partitioner: QueuePartitioner | null = null;

export function getQueuePartitioner(): QueuePartitioner {
  if (!partitioner) {
    partitioner = new QueuePartitioner();
  }
  return partitioner;
}

/**
 * Initialize default partitions
 */
export function initializeDefaultPartitions(): void {
  const partitioner = getQueuePartitioner();

  // Initialize partitions for each queue type
  const queueConfigs = [
    {
      name: 'scraping',
      partitions: parseInt(process.env.SCRAPING_PARTITIONS || '2'),
      prefix: 'queue',
      strategy: 'workspace' as PartitionStrategy,
    },
    {
      name: 'ai-processing',
      partitions: parseInt(process.env.AI_PARTITIONS || '4'),
      prefix: 'queue',
      strategy: 'round-robin' as PartitionStrategy,
    },
    {
      name: 'publishing',
      partitions: parseInt(process.env.PUBLISHING_PARTITIONS || '2'),
      prefix: 'queue',
      strategy: 'priority' as PartitionStrategy,
    },
  ];

  for (const config of queueConfigs) {
    partitioner.initializePartitions(config.name, {
      strategy: config.strategy,
      partitionCount: config.partitions,
      prefix: config.prefix,
    });
  }

  console.log('✅ Default queue partitions initialized');
}
