import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Load testing utilities for queue performance
 */

interface LoadTestConfig {
  queueName: string;
  totalJobs: number;
  concurrency: number;
  jobPayload?: any;
}

interface LoadTestResult {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  minProcessingTime: number;
  maxProcessingTime: number;
  jobsPerSecond: number;
  totalDuration: number;
}

export class QueueLoadTester {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });
  }

  /**
   * Run load test on a queue
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    const queue = new Queue(config.queueName, {
      connection: this.redis,
    });

    const startTime = Date.now();
    const processingTimes: number[] = [];
    let successfulJobs = 0;
    let failedJobs = 0;

    console.log(`Starting load test: ${config.totalJobs} jobs with concurrency ${config.concurrency}`);

    // Add jobs in batches
    const batchSize = 100;
    const batches = Math.ceil(config.totalJobs / batchSize);

    for (let i = 0; i < batches; i++) {
      const jobsInBatch = Math.min(batchSize, config.totalJobs - i * batchSize);
      const jobs = Array.from({ length: jobsInBatch }, (_, j) => ({
        name: `load-test-job-${i * batchSize + j}`,
        data: config.jobPayload || { testData: `Job ${i * batchSize + j}` },
        opts: {
          removeOnComplete: true,
          removeOnFail: false,
        },
      }));

      await queue.addBulk(jobs);
    }

    // Wait for all jobs to complete
    await this.waitForCompletion(queue, config.totalJobs);

    const endTime = Date.now();
    const totalDuration = (endTime - startTime) / 1000; // in seconds

    // Get metrics from completed/failed jobs
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();

    successfulJobs = completed.length;
    failedJobs = failed.length;

    // Calculate processing times
    for (const job of completed) {
      if (job.finishedOn && job.processedOn) {
        processingTimes.push(job.finishedOn - job.processedOn);
      }
    }

    await queue.close();

    return {
      totalJobs: config.totalJobs,
      successfulJobs,
      failedJobs,
      averageProcessingTime:
        processingTimes.length > 0
          ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
          : 0,
      minProcessingTime: Math.min(...processingTimes) || 0,
      maxProcessingTime: Math.max(...processingTimes) || 0,
      jobsPerSecond: config.totalJobs / totalDuration,
      totalDuration,
    };
  }

  /**
   * Wait for all jobs to complete
   */
  private async waitForCompletion(
    queue: Queue,
    totalJobs: number,
    timeout = 300000 // 5 minutes
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const counts = await queue.getJobCounts('completed', 'failed');
      const processedJobs = counts.completed + counts.failed;

      if (processedJobs >= totalJobs) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Load test timeout: Not all jobs completed in time');
  }

  /**
   * Test queue throughput under different concurrency levels
   */
  async testConcurrencyLevels(
    queueName: string,
    jobsPerTest = 100
  ): Promise<Record<number, LoadTestResult>> {
    const concurrencyLevels = [1, 5, 10, 20, 50];
    const results: Record<number, LoadTestResult> = {};

    for (const concurrency of concurrencyLevels) {
      console.log(`\nTesting concurrency level: ${concurrency}`);

      const result = await this.runLoadTest({
        queueName,
        totalJobs: jobsPerTest,
        concurrency,
      });

      results[concurrency] = result;

      // Wait between tests
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return results;
  }

  /**
   * Stress test to find queue limits
   */
  async stressTest(queueName: string): Promise<{
    maxJobsPerSecond: number;
    breakingPoint: number;
  }> {
    let currentLoad = 10;
    let maxJobsPerSecond = 0;
    let breakingPoint = 0;

    while (currentLoad <= 10000) {
      try {
        console.log(`\nStress testing with ${currentLoad} jobs`);

        const result = await this.runLoadTest({
          queueName,
          totalJobs: currentLoad,
          concurrency: 10,
        });

        if (result.failedJobs > currentLoad * 0.1) {
          // More than 10% failure rate
          breakingPoint = currentLoad;
          break;
        }

        maxJobsPerSecond = Math.max(maxJobsPerSecond, result.jobsPerSecond);
        currentLoad *= 2;
      } catch (error) {
        breakingPoint = currentLoad;
        break;
      }
    }

    return {
      maxJobsPerSecond,
      breakingPoint: breakingPoint || currentLoad,
    };
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * Run load tests and generate report
 */
export async function runLoadTests(): Promise<void> {
  const tester = new QueueLoadTester();

  console.log('=== Queue Load Testing ===\n');

  // Test scraping queue
  console.log('Testing scraping queue...');
  const scrapingResult = await tester.runLoadTest({
    queueName: 'scraping',
    totalJobs: 50,
    concurrency: 5,
  });

  console.log('\nScraping Queue Results:');
  console.log(`- Total Jobs: ${scrapingResult.totalJobs}`);
  console.log(`- Successful: ${scrapingResult.successfulJobs}`);
  console.log(`- Failed: ${scrapingResult.failedJobs}`);
  console.log(`- Avg Processing Time: ${scrapingResult.averageProcessingTime}ms`);
  console.log(`- Jobs/Second: ${scrapingResult.jobsPerSecond.toFixed(2)}`);

  // Test AI processing queue
  console.log('\n\nTesting AI processing queue...');
  const aiResult = await tester.runLoadTest({
    queueName: 'ai-processing',
    totalJobs: 30,
    concurrency: 3,
  });

  console.log('\nAI Processing Queue Results:');
  console.log(`- Total Jobs: ${aiResult.totalJobs}`);
  console.log(`- Successful: ${aiResult.successfulJobs}`);
  console.log(`- Failed: ${aiResult.failedJobs}`);
  console.log(`- Avg Processing Time: ${aiResult.averageProcessingTime}ms`);
  console.log(`- Jobs/Second: ${aiResult.jobsPerSecond.toFixed(2)}`);

  await tester.close();
}
