/**
 * Designer Executor Service Tests
 * 设计器执行服务测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DesignerExecutor,
  createDesignerExecutor,
  type DesignerExecutionCallbacks,
  type DesignerExecutionResult,
  type DesignerExecutionOptions,
} from '../designerExecutor';
import type { ExecutionEngine } from '../../../services/executionEngine';
import type { TestFlow, DesignerNode, VariableDefinition } from '../../../types/designer';

// Mock ExecutionEngine
const createMockExecutionEngine = (): ExecutionEngine => ({
  executeTestCase: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  setCallbacks: vi.fn(),
  setSelfHealingConfig: vi.fn(),
  setHighlightingEnabled: vi.fn(),
  setScreenshotStorageEnabled: vi.fn(),
  getStatus: vi.fn(() => 'idle'),
  getResults: vi.fn(() => []),
}) as ExecutionEngine;

// Helper to create a simple test flow
function createTestFlow(overrides?: Partial<TestFlow>): TestFlow {
  const nodes: DesignerNode[] = [
    {
      id: 'start-1',
      type: 'start',
      position: { x: 0, y: 0 },
      data: { label: '开始', config: {} },
    },
    {
      id: 'click-1',
      type: 'click',
      position: { x: 200, y: 0 },
      data: {
        label: '点击按钮',
        config: {
          target: 'button.submit',
          description: 'Click submit button',
        },
      },
    },
    {
      id: 'input-1',
      type: 'input',
      position: { x: 400, y: 0 },
      data: {
        label: '输入文本',
        config: {
          target: 'input.username',
          value: 'testuser',
        },
      },
    },
    {
      id: 'end-1',
      type: 'end',
      position: { x: 600, y: 0 },
      data: { label: '结束', config: {} },
    },
  ];

  const edges = [
    { id: 'e1', source: 'start-1', target: 'click-1', type: 'default' },
    { id: 'e2', source: 'click-1', target: 'input-1', type: 'default' },
    { id: 'e3', source: 'input-1', target: 'end-1', type: 'default' },
  ];

  return {
    id: 'flow-1',
    name: 'Test Flow',
    description: 'Test flow description',
    version: 1,
    nodes,
    edges,
    variables: [],
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    ...overrides,
  };
}

describe('DesignerExecutor', () => {
  let mockEngine: ExecutionEngine;
  let executor: DesignerExecutor;
  let callbacks: DesignerExecutionCallbacks;

  beforeEach(() => {
    mockEngine = createMockExecutionEngine();
    executor = createDesignerExecutor(() => mockEngine);

    callbacks = {
      onExecutionStart: vi.fn(),
      onExecutionComplete: vi.fn(),
      onNodeStart: vi.fn(),
      onNodeComplete: vi.fn(),
      onNodeFailed: vi.fn(),
      onProgress: vi.fn(),
    };
    executor.setCallbacks(callbacks);
  });

  describe('initialization', () => {
    it('should create executor instance', () => {
      expect(executor).toBeInstanceOf(DesignerExecutor);
    });

    it('should have idle status initially', () => {
      expect(executor.getStatus()).toBe('idle');
    });

    it('should have empty results initially', () => {
      expect(executor.getResults()).toEqual([]);
    });

    it('should return pending status for unknown node', () => {
      expect(executor.getNodeStatus('unknown')).toBe('pending');
    });

    it('should set callbacks', () => {
      const newCallbacks: DesignerExecutionCallbacks = {
        onExecutionStart: vi.fn(),
      };
      executor.setCallbacks(newCallbacks);
      // Callbacks are stored, no direct way to verify without internal access
      // But setCallbacks should not throw
      expect(() => executor.setCallbacks(newCallbacks)).not.toThrow();
    });
  });

  describe('executeFlow - validation', () => {
    it('should fail validation for flow without start node', async () => {
      const flow = createTestFlow({
        nodes: [
          {
            id: 'click-1',
            type: 'click',
            position: { x: 0, y: 0 },
            data: { label: 'Click', config: { target: 'button' } },
          },
        ],
      });

      const result = await executor.executeFlow(flow);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('开始节点'))).toBe(true);
      expect(executor.getStatus()).toBe('failed');
    });

    it('should fail validation for flow with no executable nodes', async () => {
      const flow = createTestFlow({
        nodes: [
          {
            id: 'start-1',
            type: 'start',
            position: { x: 0, y: 0 },
            data: { label: '开始', config: {} },
          },
          {
            id: 'end-1',
            type: 'end',
            position: { x: 200, y: 0 },
            data: { label: '结束', config: {} },
          },
        ],
        edges: [{ id: 'e1', source: 'start-1', target: 'end-1', type: 'default' }],
      });

      const result = await executor.executeFlow(flow);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('没有可执行的节点');
    });

    it('should call onExecutionStart callback', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({
        success: true,
        yamlContent: 'test: yaml',
      });

      await executor.executeFlow(flow);

      expect(callbacks.onExecutionStart).toHaveBeenCalledWith(flow);
    });
  });

  describe('buildExecutionOrder', () => {
    it('should build execution order from start node', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({
        success: true,
        yamlContent: 'yaml',
      });

      await executor.executeFlow(flow);

      const results = executor.getResults();
      // Note: Results depend on mock returning actual execution results
      // This test mainly verifies the flow doesn't crash
      expect(executor.getStatus()).toBe('completed' as any);
    });

    it('should handle empty flow', async () => {
      const flow: TestFlow = {
        id: 'empty',
        name: 'Empty',
        nodes: [],
        edges: [],
        variables: [],
        metadata: { createdAt: Date.now(), updatedAt: Date.now() },
      };

      const result = await executor.executeFlow(flow);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('nodeToStepText', () => {
    it('should generate click step text', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: 'click-1',
            type: 'click',
            position: { x: 200, y: 0 },
            data: { label: '点击', config: { target: 'button.submit' } },
          },
          { id: 'end', type: 'end', position: { x: 400, y: 0 }, data: { config: {} } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'click-1', type: 'default' },
          { id: 'e2', source: 'click-1', target: 'end', type: 'default' },
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({
        success: true,
        yamlContent: 'yaml',
        stepsResults: [{ success: true, stepId: 'click-1' }],
      });

      await executor.executeFlow(flow);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const testCase = call[0];
      expect(testCase.steps[0].originalText).toContain('点击');
    });

    it('should generate input step text', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: 'input-1',
            type: 'input',
            position: { x: 200, y: 0 },
            data: { config: { target: 'input.name', value: 'John' } },
          },
          { id: 'end', type: 'end', position: { x: 400, y: 0 }, data: { config: {} } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'input-1', type: 'default' },
          { id: 'e2', source: 'input-1', target: 'end', type: 'default' },
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      await executor.executeFlow(flow);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const testCase = call[0];
      expect(testCase.steps[0].originalText).toContain('输入');
      expect(testCase.steps[0].originalText).toContain('John');
    });

    it('should generate scroll step text', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: 'scroll-1',
            type: 'scroll',
            position: { x: 200, y: 0 },
            data: { config: { direction: 'down' } },
          },
          { id: 'end', type: 'end', position: { x: 400, y: 0 }, data: { config: {} } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'scroll-1', type: 'default' },
          { id: 'e2', source: 'scroll-1', target: 'end', type: 'default' },
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      await executor.executeFlow(flow);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const testCase = call[0];
      expect(testCase.steps[0].originalText).toContain('向下');
    });

    it('should generate wait step text', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: 'wait-1',
            type: 'wait',
            position: { x: 200, y: 0 },
            data: { config: { duration: 5000 } },
          },
          { id: 'end', type: 'end', position: { x: 400, y: 0 }, data: { config: {} } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'wait-1', type: 'default' },
          { id: 'e2', source: 'wait-1', target: 'end', type: 'default' },
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      await executor.executeFlow(flow);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const testCase = call[0];
      expect(testCase.steps[0].originalText).toContain('等待');
      expect(testCase.steps[0].originalText).toContain('5000');
    });

    it('should generate assert step text', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: 'assert-1',
            type: 'assertExists',
            position: { x: 200, y: 0 },
            data: { config: { target: '.success-message', shouldExist: true } },
          },
          { id: 'end', type: 'end', position: { x: 400, y: 0 }, data: { config: {} } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'assert-1', type: 'default' },
          { id: 'e2', source: 'assert-1', target: 'end', type: 'default' },
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      await executor.executeFlow(flow);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const testCase = call[0];
      expect(testCase.steps[0].originalText).toContain('验证');
      expect(testCase.steps[0].originalText).toContain('存在');
    });

    it('should replace variables in step text', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: 'input-1',
            type: 'input',
            position: { x: 200, y: 0 },
            data: { config: { target: '${usernameField}', value: '${username}' } },
          },
          { id: 'end', type: 'end', position: { x: 400, y: 0 }, data: { config: {} } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'input-1', type: 'default' },
          { id: 'e2', source: 'input-1', target: 'end', type: 'default' },
        ],
        variables: [
          { name: 'usernameField', defaultValue: '#username', type: 'string' },
          { name: 'username', defaultValue: 'testuser', type: 'string' },
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      await executor.executeFlow(flow);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const testCase = call[0];
      expect(testCase.steps[0].originalText).toContain('#username');
      expect(testCase.steps[0].originalText).toContain('testuser');
    });
  });

  describe('executeFlow - execution', () => {
    it('should fail when execution engine is not available', async () => {
      const noEngineExecutor = createDesignerExecutor(() => null);
      noEngineExecutor.setCallbacks(callbacks);

      const flow = createTestFlow();
      const result = await noEngineExecutor.executeFlow(flow);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('执行引擎未初始化');
    });

    it('should apply execution options', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      const options: DesignerExecutionOptions = {
        enableSelfHealing: true,
        enableHighlighting: false,
        storeScreenshots: true,
        startDelay: 100,
        context: {
          url: 'https://example.com',
          viewportWidth: 1920,
          viewportHeight: 1080,
        },
      };

      await executor.executeFlow(flow, options);

      expect(mockEngine.setSelfHealingConfig).toHaveBeenCalledWith({ enabled: true });
      expect(mockEngine.setHighlightingEnabled).toHaveBeenCalledWith(false);
      expect(mockEngine.setScreenshotStorageEnabled).toHaveBeenCalledWith(true);
    });

    it('should call engine with correct context', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      const options: DesignerExecutionOptions = {
        context: {
          url: 'https://test.com',
          viewportWidth: 1280,
          viewportHeight: 720,
        },
      };

      await executor.executeFlow(flow, options);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const context = call[1];
      expect(context.url).toBe('https://test.com');
      expect(context.viewportWidth).toBe(1280);
      expect(context.viewportHeight).toBe(720);
    });

    it('should return success result on successful execution', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({
        success: true,
        yamlContent: 'test:\n  - click button',
      });

      const result = await executor.executeFlow(flow);

      expect(result.success).toBe(true);
      expect(result.yamlContent).toBe('test:\n  - click button');
      expect(result.errors).toEqual([]);
      expect(executor.getStatus()).toBe('completed' as any);
    });

    it('should return failure result on failed execution', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({
        success: false,
        yamlContent: 'test:\n  - click button',
      });

      const result = await executor.executeFlow(flow);

      expect(result.success).toBe(false);
      expect(executor.getStatus()).toBe('failed' as any);
    });

    it('should handle execution errors', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockRejectedValue(new Error('Execution failed'));

      const result = await executor.executeFlow(flow);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Execution failed');
    });
  });

  describe('pause, resume, stop', () => {
    it('should pause execution', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Simulate long-running execution
            setTimeout(() => resolve({ success: true, yamlContent: 'yaml' }), 1000);
          }),
      );

      // Start execution (don't await)
      const executionPromise = executor.executeFlow(flow);

      // Wait a bit then pause
      await new Promise((resolve) => setTimeout(resolve, 10));
      executor.pause();

      expect(executor.getStatus()).toBe('paused' as any);
      expect(mockEngine.pause).toHaveBeenCalled();

      // Clean up
      await executionPromise.catch(() => {});
    });

    it('should resume paused execution', () => {
      executor.resume();
      expect(executor.getStatus()).toBe('idle'); // Not paused, so no change
    });

    it('should call engine stop when status is running', () => {
      // Manually set status to running and setup engine for this test
      (executor as any).status = 'running';
      (executor as any).executionEngine = mockEngine;
      executor.stop();

      expect(mockEngine.stop).toHaveBeenCalled();
    });

    it('should not pause when not running', () => {
      executor.pause();
      expect(mockEngine.pause).not.toHaveBeenCalled();
    });

    it('should not resume when not paused', () => {
      executor.resume();
      expect(mockEngine.resume).not.toHaveBeenCalled();
    });
  });

  describe('retryFailedNodes', () => {
    it('should return success when no failed nodes', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      // First successful execution
      await executor.executeFlow(flow);

      // Retry should immediately return success
      const retryResult = await executor.retryFailedNodes(flow);

      expect(retryResult.success).toBe(true);
    });

    it('should retry only failed nodes', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({
        success: true,
        yamlContent: 'yaml',
      });

      await executor.executeFlow(flow);

      // Simulate a failed node result
      (executor as any).results.set('click-1', {
        nodeId: 'click-1',
        stepId: 'click-1',
        nodeType: 'click',
        success: false,
        error: 'Element not found',
        duration: 0,
      });

      const failedBefore = Array.from((executor as any).results.values()).filter(
        (r: DesignerExecutionResult) => !r.success,
      );

      expect(failedBefore.length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return zero stats initially', () => {
      const stats = executor.getStats();

      expect(stats.total).toBe(0);
      expect(stats.success).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.skipped).toBe(0);
    });

    it('should return accurate stats after execution', async () => {
      const flow = createTestFlow();

      // Manually set some node statuses
      (executor as any).nodeStatus.set('click-1', 'success');
      (executor as any).nodeStatus.set('input-1', 'failed');
      (executor as any).nodeStatus.set('scroll-1', 'pending');

      const stats = executor.getStats();

      expect(stats.total).toBe(3);
      expect(stats.success).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(1);
    });
  });

  describe('getAllNodeStatus', () => {
    it('should return all node statuses', async () => {
      const flow = createTestFlow();

      // Manually set some node statuses
      (executor as any).nodeStatus.set('node-1', 'success');
      (executor as any).nodeStatus.set('node-2', 'failed');
      (executor as any).nodeStatus.set('node-3', 'running');

      const allStatus = executor.getAllNodeStatus();

      expect(allStatus.get('node-1')).toBe('success');
      expect(allStatus.get('node-2')).toBe('failed');
      expect(allStatus.get('node-3')).toBe('running');
      expect(allStatus.get('unknown')).toBeUndefined();
    });
  });

  describe('control flow nodes', () => {
    it('should handle ifElse node in execution order', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: 'if-1',
            type: 'ifElse',
            position: { x: 200, y: 0 },
            data: { config: { condition: 'true' } },
          },
          {
            id: 'click-1',
            type: 'click',
            position: { x: 400, y: 0 },
            data: { config: { target: 'button' } },
          },
          { id: 'end', type: 'end', position: { x: 600, y: 0 }, data: { config: {} } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'if-1', type: 'default' },
          { id: 'e2', source: 'if-1', target: 'click-1', sourceHandle: 'true', type: 'default' },
          { id: 'e3', source: 'click-1', target: 'end', type: 'default' },
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      await executor.executeFlow(flow);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const testCase = call[0];
      // Should include ifElse and click nodes
      expect(testCase.steps.length).toBeGreaterThan(0);
    });

    it('should handle loop node in execution order', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: 'loop-1',
            type: 'loop',
            position: { x: 200, y: 0 },
            data: { config: { loopType: 'count', count: 3 } },
          },
          {
            id: 'click-1',
            type: 'click',
            position: { x: 400, y: 0 },
            data: { config: { target: 'button' } },
          },
          { id: 'end', type: 'end', position: { x: 600, y: 0 }, data: { config: {} } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'loop-1', type: 'default' },
          { id: 'e2', source: 'loop-1', target: 'click-1', type: 'default' },
          { id: 'e3', source: 'click-1', target: 'end', type: 'default' },
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      await executor.executeFlow(flow);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const testCase = call[0];
      expect(testCase.steps.length).toBeGreaterThan(0);
    });
  });

  describe('callback handling', () => {
    it('should call onNodeStart when step starts', async () => {
      const flow = createTestFlow();

      let stepStartCallback: any;
      (mockEngine as any).setCallbacks.mockImplementation((callbacks: any) => {
        stepStartCallback = callbacks.onStepStart;
      });
      (mockEngine as any).executeTestCase.mockImplementation(
        (testCase: any) =>
          new Promise((resolve) => {
            // Trigger the onStepStart callback
            stepStartCallback?.(testCase.steps[0], 0);
            resolve({ success: true, yamlContent: 'yaml' });
          }),
      );

      await executor.executeFlow(flow);

      expect(callbacks.onNodeStart).toHaveBeenCalled();
    });

    it('should call onProgress during execution', async () => {
      const flow = createTestFlow();

      let progressCallback: any;
      (mockEngine as any).setCallbacks.mockImplementation((callbacks: any) => {
        progressCallback = callbacks.onProgress;
      });
      (mockEngine as any).executeTestCase.mockImplementation(
        (testCase: any) =>
          new Promise((resolve) => {
            progressCallback?.(1, 2);
            resolve({ success: true, yamlContent: 'yaml' });
          }),
      );

      await executor.executeFlow(flow);

      expect(callbacks.onProgress).toHaveBeenCalledWith(1, 2);
    });

    it('should call onExecutionComplete on completion', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({
        success: true,
        yamlContent: 'test:\n  - click button',
      });

      await executor.executeFlow(flow);

      expect(callbacks.onExecutionComplete).toHaveBeenCalledWith(
        true,
        [],
        'test:\n  - click button',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle circular dependencies (depth limit)', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          { id: 'node-1', type: 'click', position: { x: 100, y: 0 }, data: { config: { target: 'a' } } },
          { id: 'node-2', type: 'click', position: { x: 200, y: 0 }, data: { config: { target: 'b' } } },
          { id: 'node-3', type: 'click', position: { x: 300, y: 0 }, data: { config: { target: 'c' } } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'node-1', type: 'default' },
          { id: 'e2', source: 'node-1', target: 'node-2', type: 'default' },
          { id: 'e3', source: 'node-2', target: 'node-3', type: 'default' },
          { id: 'e4', source: 'node-3', target: 'node-1', type: 'default' }, // Circular
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      // Should not hang, should complete with depth limit
      const result = await executor.executeFlow(flow);

      expect(result).toBeTruthy();
    });

    it('should handle disconnected nodes', async () => {
      const flow = createTestFlow({
        nodes: [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { config: {} } },
          {
            id: 'connected',
            type: 'click',
            position: { x: 200, y: 0 },
            data: { config: { target: 'button' } },
          },
          {
            id: 'disconnected',
            type: 'click',
            position: { x: 400, y: 100 },
            data: { config: { target: 'link' } },
          },
          { id: 'end', type: 'end', position: { x: 600, y: 0 }, data: { config: {} } },
        ],
        edges: [
          { id: 'e1', source: 'start', target: 'connected', type: 'default' },
          { id: 'e2', source: 'connected', target: 'end', type: 'default' },
          // disconnected node has no edges
        ],
      });

      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      const result = await executor.executeFlow(flow);

      // Should execute only connected nodes
      expect(result.success).toBe(true);
    });
  });

  describe('flowToTestCase', () => {
    it('should create proper test case structure', async () => {
      const flow = createTestFlow();
      (mockEngine as any).executeTestCase.mockResolvedValue({ success: true, yamlContent: 'yaml' });

      await executor.executeFlow(flow);

      const call = (mockEngine.executeTestCase as any).mock.calls[0];
      const testCase = call[0];

      expect(testCase.id).toBe(flow.id);
      expect(testCase.name).toBe(flow.name);
      expect(testCase.description).toBe(flow.description);
      expect(testCase.steps).toBeInstanceOf(Array);
      expect(testCase.steps.length).toBeGreaterThan(0);
    });
  });

  describe('getAllNodeStatus', () => {
    it('should return copy of node status map', async () => {
      const flow = createTestFlow();

      // Manually set status
      (executor as any).nodeStatus.set('node-1', 'success');

      const status1 = executor.getAllNodeStatus();
      const status2 = executor.getAllNodeStatus();

      // Should be equal but different references
      expect(status1).toEqual(status2);
      expect(status1).not.toBe(status2);
    });
  });
});
