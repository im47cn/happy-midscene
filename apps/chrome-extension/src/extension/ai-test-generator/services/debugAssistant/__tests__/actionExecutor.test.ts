/**
 * Unit tests for Action Executor
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DebugAction } from '../../../types/debugAssistant';
import {
  ActionExecutor,
  getActionExecutor,
  resetActionExecutor,
} from '../actionExecutor';

// Mock agent
const mockAgent = {
  aiAct: vi.fn(),
  aiLocate: vi.fn(),
  aiQuery: vi.fn(),
  page: {
    mouse: {
      click: vi.fn(),
    },
    keyboard: {
      type: vi.fn(),
      down: vi.fn(),
      up: vi.fn(),
      press: vi.fn(),
    },
    evaluate: vi.fn(),
    reload: vi.fn(),
    screenshot: vi.fn(),
    url: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
    title: vi.fn(),
    content: vi.fn(),
  },
};

describe('ActionExecutor', () => {
  let executor: ActionExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    resetActionExecutor();
    executor = getActionExecutor({
      getAgent: () => mockAgent,
      defaultTimeout: 10000,
      defaultWaitTime: 1000,
    });
  });

  describe('execute', () => {
    it('should execute click action successfully', async () => {
      mockAgent.aiAct.mockResolvedValue(undefined);
      mockAgent.aiLocate.mockResolvedValue([
        {
          center: [100, 200],
          rect: { left: 50, top: 150, width: 100, height: 50 },
        },
      ]);

      const action: DebugAction = {
        type: 'click',
        target: 'Submit button',
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('点击');
    });

    it('should execute input action successfully', async () => {
      mockAgent.aiAct.mockResolvedValue(undefined);

      const action: DebugAction = {
        type: 'input',
        target: 'Username field',
        value: 'testuser',
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('输入');
    });

    it('should execute scroll action successfully', async () => {
      mockAgent.page.evaluate.mockResolvedValue(undefined);

      const action: DebugAction = {
        type: 'scroll',
        options: {
          scrollDirection: 'down',
          scrollAmount: 500,
        },
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('滚动');
    });

    it('should execute refresh action successfully', async () => {
      mockAgent.page.reload.mockResolvedValue(undefined);

      const action: DebugAction = {
        type: 'refresh',
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('刷新');
    });

    it('should execute wait action successfully', async () => {
      const action: DebugAction = {
        type: 'wait',
        options: {
          timeout: 500,
        },
      };

      const startTime = Date.now();
      const result = await executor.execute(action);
      const elapsed = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(400); // Allow some margin
    });

    it('should execute screenshot action successfully', async () => {
      mockAgent.page.screenshot.mockResolvedValue('base64screenshotdata');

      const action: DebugAction = {
        type: 'screenshot',
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.screenshot).toBe('base64screenshotdata');
    });

    it('should execute highlight action successfully', async () => {
      mockAgent.aiLocate.mockResolvedValue([
        {
          rect: { left: 100, top: 200, width: 50, height: 30 },
        },
      ]);
      mockAgent.page.evaluate.mockResolvedValue([
        {
          id: 'highlight-1',
          rect: { left: 100, top: 200, width: 50, height: 30 },
        },
      ]);

      const action: DebugAction = {
        type: 'highlight',
        target: 'Submit button',
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('高亮');
    });

    it('should execute locate action successfully', async () => {
      mockAgent.aiLocate.mockResolvedValue([
        {
          text: 'Submit',
          rect: { left: 100, top: 200, width: 50, height: 30 },
        },
      ]);

      const action: DebugAction = {
        type: 'locate',
        target: 'Submit button',
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(1);
    });

    it('should execute describe action successfully', async () => {
      mockAgent.aiQuery.mockResolvedValue({
        text: 'This is a submit button',
      });

      const action: DebugAction = {
        type: 'describe',
        target: 'Submit button',
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.message).toBeTruthy();
    });

    it('should return error for unknown action type', async () => {
      const action: DebugAction = {
        type: 'unknown' as any,
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(false);
      expect(result.message).toContain('不支持');
    });

    it('should handle agent unavailability', async () => {
      const noAgentExecutor = new ActionExecutor({
        getAgent: () => null,
      });

      const action: DebugAction = {
        type: 'click',
        target: 'Submit',
      };

      const result = await noAgentExecutor.execute(action);

      expect(result.success).toBe(false);
      expect(result.message).toContain('无法获取');
    });

    it('should include duration in result', async () => {
      mockAgent.aiAct.mockResolvedValue(undefined);

      const action: DebugAction = {
        type: 'click',
        target: 'Submit',
      };

      const result = await executor.execute(action);

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeMultiple', () => {
    it('should execute multiple actions in sequence', async () => {
      mockAgent.aiAct.mockResolvedValue(undefined);

      const actions: DebugAction[] = [
        { type: 'click', target: 'Button 1' },
        { type: 'wait', options: { timeout: 100 } },
        { type: 'click', target: 'Button 2' },
      ];

      const results = await executor.executeMultiple(actions);

      expect(results.length).toBe(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
    });

    it('should stop on critical action failure', async () => {
      mockAgent.aiAct.mockRejectedValue(new Error('Click failed'));

      const actions: DebugAction[] = [
        { type: 'click', target: 'Button 1' },
        { type: 'input', target: 'Field', value: 'test' },
      ];

      const results = await executor.executeMultiple(actions);

      expect(results.length).toBe(1); // Should stop after first failure
      expect(results[0].success).toBe(false);
    });

    it('should continue on non-critical action failure', async () => {
      mockAgent.page.evaluate.mockRejectedValue(new Error('Highlight failed'));

      const actions: DebugAction[] = [
        { type: 'highlight', target: 'Element' },
        { type: 'click', target: 'Button' },
      ];

      const results = await executor.executeMultiple(actions);

      expect(results.length).toBe(2);
    });
  });

  describe('callbacks', () => {
    it('should call onBeforeExecute callback', async () => {
      const onBeforeExecute = vi.fn();
      executor.setCallbacks({ onBeforeExecute });

      mockAgent.aiAct.mockResolvedValue(undefined);

      const action: DebugAction = { type: 'click', target: 'Button' };
      await executor.execute(action);

      expect(onBeforeExecute).toHaveBeenCalledWith(action);
    });

    it('should call onAfterExecute callback', async () => {
      const onAfterExecute = vi.fn();
      executor.setCallbacks({ onAfterExecute });

      mockAgent.aiAct.mockResolvedValue(undefined);

      const action: DebugAction = { type: 'click', target: 'Button' };
      const result = await executor.execute(action);

      expect(onAfterExecute).toHaveBeenCalledWith(action, result);
    });

    it('should call onExecutionError callback on error', async () => {
      const onExecutionError = vi.fn();
      executor.setCallbacks({ onExecutionError });

      mockAgent.aiAct.mockRejectedValue(new Error('Test error'));

      const action: DebugAction = { type: 'click', target: 'Button' };
      await executor.execute(action);

      expect(onExecutionError).toHaveBeenCalled();
    });
  });

  describe('service setters', () => {
    it('should set page actions service', () => {
      const mockPageActions = {};
      executor.setPageActions(mockPageActions);
      expect((executor as any).pageActions).toBe(mockPageActions);
    });

    it('should set highlight action service', () => {
      const mockHighlight = {};
      executor.setHighlightAction(mockHighlight);
      expect((executor as any).highlightAction).toBe(mockHighlight);
    });

    it('should set compare action service', () => {
      const mockCompare = {};
      executor.setCompareAction(mockCompare);
      expect((executor as any).compareAction).toBe(mockCompare);
    });
  });

  describe('compare action', () => {
    it('should execute compare action with previous screenshot', async () => {
      mockAgent.page.screenshot.mockResolvedValue('currentscreenshot');

      const action: DebugAction = {
        type: 'compare',
        value: {
          previousScreenshot: 'previousscreenshot',
        },
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('previous');
      expect(result.data).toHaveProperty('current');
    });

    it('should return error when previous screenshot missing', async () => {
      const action: DebugAction = {
        type: 'compare',
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(false);
      expect(result.message).toContain('缺少');
    });
  });

  describe('fallback behavior', () => {
    it('should use manual click when aiAct unavailable', async () => {
      const agentWithoutAiAct = {
        ...mockAgent,
        aiAct: undefined,
      };

      const fallbackExecutor = new ActionExecutor({
        getAgent: () => agentWithoutAiAct,
      });

      mockAgent.aiLocate.mockResolvedValue([
        {
          center: [100, 200],
          rect: { left: 50, top: 150, width: 100, height: 50 },
        },
      ]);

      const action: DebugAction = {
        type: 'click',
        target: 'Button',
      };

      const result = await fallbackExecutor.execute(action);

      expect(result.success).toBe(true);
    });

    it('should use manual input when aiAct unavailable', async () => {
      const agentWithoutAiAct = {
        ...mockAgent,
        aiAct: undefined,
      };

      const fallbackExecutor = new ActionExecutor({
        getAgent: () => agentWithoutAiAct,
      });

      mockAgent.aiLocate.mockResolvedValue([
        {
          center: [100, 200],
          rect: { left: 50, top: 150, width: 100, height: 50 },
        },
      ]);

      const action: DebugAction = {
        type: 'input',
        target: 'Field',
        value: 'test',
      };

      const result = await fallbackExecutor.execute(action);

      expect(result.success).toBe(true);
    });
  });

  describe('wait duration parsing', () => {
    it('should parse wait duration from number', async () => {
      const action: DebugAction = {
        type: 'wait',
        options: { timeout: 2000 },
      };

      const startTime = Date.now();
      await executor.execute(action);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(1800);
    });

    it('should parse wait duration from string with ms', async () => {
      const action: DebugAction = {
        type: 'wait',
        value: '500ms',
      };

      const startTime = Date.now();
      await executor.execute(action);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(400);
    });

    it('should parse wait duration from string with s', async () => {
      const action: DebugAction = {
        type: 'wait',
        value: '1s',
      };

      const startTime = Date.now();
      await executor.execute(action);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(900);
    });

    it('should use default wait time when no duration specified', async () => {
      const action: DebugAction = {
        type: 'wait',
      };

      const result = await executor.execute(action);

      expect(result.success).toBe(true);
      expect(result.message).toContain('1000');
    });
  });
});
