import { WorkflowEngine } from '../workflow-engine';
import { prisma } from '@/src/lib/db/client';

// Mock Prisma client
jest.mock('@/src/lib/db/client', () => ({
  prisma: {
    workflowRun: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    content: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJob: jest.fn().mockResolvedValue({
      id: 'mock-job-id',
      progress: 50,
      returnvalue: null,
      failedReason: null,
    }),
  })),
}));

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
    jest.clearAllMocks();
  });

  describe('startWorkflow', () => {
    it('should start a new workflow run', async () => {
      const mockRun = {
        id: 'run-123',
        workspaceId: 'workspace-123',
        topic: 'productivity tips',
        status: 'running',
        stage: 'scraping',
      };

      (prisma.workflowRun.create as jest.Mock).mockResolvedValue(mockRun);

      const result = await engine.startWorkflow({
        workspaceId: 'workspace-123',
        topic: 'productivity tips',
        platforms: ['instagram'],
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('run-123');
      expect(result.status).toBe('running');
      expect(prisma.workflowRun.create).toHaveBeenCalled();
    });

    it('should handle workflow start with brand voice', async () => {
      const mockRun = {
        id: 'run-124',
        workspaceId: 'workspace-123',
        topic: 'marketing strategies',
        status: 'running',
        stage: 'scraping',
      };

      (prisma.workflowRun.create as jest.Mock).mockResolvedValue(mockRun);

      const result = await engine.startWorkflow({
        workspaceId: 'workspace-123',
        topic: 'marketing strategies',
        platforms: ['linkedin'],
        brandVoice: {
          tone: 'professional',
          vocabulary: ['strategic', 'innovative'],
          sentenceStructure: 'medium',
          themes: ['growth'],
        },
      });

      expect(result).toBeDefined();
      expect(prisma.workflowRun.create).toHaveBeenCalled();
    });
  });

  describe('getWorkflowStatus', () => {
    it('should return workflow run status', async () => {
      const mockRun = {
        id: 'run-123',
        workspaceId: 'workspace-123',
        topic: 'productivity',
        status: 'running',
        stage: 'ai-processing',
        progress: 50,
      };

      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      const status = await engine.getWorkflowStatus('run-123');

      expect(status).toBeDefined();
      expect(status.id).toBe('run-123');
      expect(status.status).toBe('running');
      expect(status.progress).toBe(50);
    });

    it('should return null for non-existent run', async () => {
      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(null);

      const status = await engine.getWorkflowStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('cancelWorkflow', () => {
    it('should cancel a running workflow', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'cancelled',
      };

      (prisma.workflowRun.update as jest.Mock).mockResolvedValue(mockRun);

      const result = await engine.cancelWorkflow('run-123');

      expect(result).toBeDefined();
      expect(result.status).toBe('cancelled');
      expect(prisma.workflowRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-123' },
          data: expect.objectContaining({
            status: 'cancelled',
          }),
        })
      );
    });
  });

  describe('retryWorkflow', () => {
    it('should retry a failed workflow', async () => {
      const mockOriginalRun = {
        id: 'run-123',
        workspaceId: 'workspace-123',
        topic: 'productivity',
        status: 'failed',
      };

      const mockNewRun = {
        id: 'run-124',
        workspaceId: 'workspace-123',
        topic: 'productivity',
        status: 'running',
      };

      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockOriginalRun);
      (prisma.workflowRun.create as jest.Mock).mockResolvedValue(mockNewRun);

      const result = await engine.retryWorkflow('run-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('run-124');
      expect(result.status).toBe('running');
    });

    it('should throw error when retrying non-failed workflow', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'completed',
      };

      (prisma.workflowRun.findUnique as jest.Mock).mockResolvedValue(mockRun);

      await expect(engine.retryWorkflow('run-123')).rejects.toThrow();
    });
  });

  describe('getMetrics', () => {
    it('should return workflow metrics', async () => {
      const mockRuns = [
        { id: 'run-1', status: 'completed', createdAt: new Date() },
        { id: 'run-2', status: 'completed', createdAt: new Date() },
        { id: 'run-3', status: 'failed', createdAt: new Date() },
      ];

      // Mock the findMany call
      (prisma.workflowRun as any).findMany = jest.fn().mockResolvedValue(mockRuns);

      const metrics = await engine.getMetrics('workspace-123');

      expect(metrics).toBeDefined();
      expect(metrics.totalRuns).toBe(3);
      expect(metrics.successRate).toBeGreaterThan(0);
    });
  });

  describe('batchRun', () => {
    it('should run multiple workflows in batch', async () => {
      const topics = ['topic1', 'topic2', 'topic3'];

      const mockRuns = topics.map((topic, i) => ({
        id: `run-${i}`,
        workspaceId: 'workspace-123',
        topic,
        status: 'running',
      }));

      (prisma.workflowRun.create as jest.Mock).mockImplementation((args) => {
        const index = topics.indexOf(args.data.topic);
        return Promise.resolve(mockRuns[index]);
      });

      const results = await engine.batchRun({
        workspaceId: 'workspace-123',
        topics,
        platforms: ['instagram'],
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'running')).toBe(true);
    });

    it('should handle partial batch failures', async () => {
      const topics = ['topic1', 'topic2'];

      (prisma.workflowRun.create as jest.Mock)
        .mockResolvedValueOnce({
          id: 'run-1',
          status: 'running',
        })
        .mockRejectedValueOnce(new Error('Failed to create run'));

      const results = await engine.batchRun({
        workspaceId: 'workspace-123',
        topics,
        platforms: ['instagram'],
      });

      expect(results.length).toBeLessThanOrEqual(topics.length);
    });
  });
});
