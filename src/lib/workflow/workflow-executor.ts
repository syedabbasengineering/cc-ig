import { WorkflowEngine } from './workflow-engine';
import type { WorkflowConfig } from '@/src/types/workflow.types';

export class WorkflowExecutor {
  private engine: WorkflowEngine;

  constructor() {
    this.engine = new WorkflowEngine();
  }

  async runSingleTopic(
    workflowId: string,
    topic: string,
    brandVoiceSamples?: string[]
  ) {
    return await this.engine.executeWorkflow(workflowId, topic, brandVoiceSamples);
  }

  async runMultipleTopics(
    workflowId: string,
    topics: string[],
    brandVoiceSamples?: string[]
  ) {
    const runIds = await Promise.all(
      topics.map(topic =>
        this.engine.executeWorkflow(workflowId, topic, brandVoiceSamples)
      )
    );
    return runIds;
  }

  async runScheduledWorkflow(
    workflowId: string,
    topic: string,
    scheduleTime: Date,
    brandVoiceSamples?: string[]
  ) {
    const delay = scheduleTime.getTime() - Date.now();

    if (delay <= 0) {
      // Run immediately if schedule time has passed
      return await this.engine.executeWorkflow(workflowId, topic, brandVoiceSamples);
    }

    // Schedule for later execution
    setTimeout(async () => {
      await this.engine.executeWorkflow(workflowId, topic, brandVoiceSamples);
    }, delay);

    return `scheduled-${workflowId}-${Date.now()}`;
  }

  async batchExecute(
    requests: Array<{
      workflowId: string;
      topic: string;
      brandVoiceSamples?: string[];
    }>
  ) {
    const results = await Promise.allSettled(
      requests.map(req =>
        this.engine.executeWorkflow(req.workflowId, req.topic, req.brandVoiceSamples)
      )
    );

    return results.map((result, index) => ({
      request: requests[index],
      status: result.status,
      runId: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null,
    }));
  }

  async getExecutionStatus(runId: string) {
    return await this.engine.getRunDetails(runId);
  }

  async cancelExecution(runId: string) {
    return await this.engine.cancelWorkflow(runId);
  }

  async retryFailedExecution(runId: string) {
    return await this.engine.retryFailedRun(runId);
  }

  async getWorkflowPerformance(workflowId: string) {
    return await this.engine.getWorkflowMetrics(workflowId);
  }
}

export default WorkflowExecutor;