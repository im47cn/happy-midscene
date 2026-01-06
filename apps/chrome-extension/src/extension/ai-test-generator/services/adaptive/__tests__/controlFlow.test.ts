/**
 * Control Flow Executor Tests
 * 测试流程控制执行器
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlFlowExecutor, executeStep } from '../controlFlowExecutor';
import { LoopManager } from '../loopManager';
import { VariableStore } from '../variableStore';
import type { ExecutionContext, AdaptiveStep, LoopContext } from '../../../../types/adaptive';

// Mock agent
const mockAgent = {
  locate: vi.fn(),
  click: vi.fn(),
  input: vi.fn(),
  wait: vi.fn(),
};

describe('ControlFlowExecutor', () => {
  let executor: ControlFlowExecutor;
  let context: ExecutionContext;
  let loopManager: LoopManager;
  let variableStore: VariableStore;

  beforeEach(() => {
    executor = new ControlFlowExecutor();
    loopManager = new LoopManager();
    variableStore = new VariableStore();

    context = {
      variables: new Map([
        ['count', 0],
        ['username', 'testuser'],
      ]),
      loopStack: [],
      pathHistory: [],
      errorStack: [],
      currentDepth: 0,
    };

    vi.clearAllMocks();
  });

  describe('executeCondition', () => {
    it('should execute then branch when condition is true', async () => {
      const conditionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'condition',
        description: '如果登录按钮存在',
        condition: {
          expression: '登录按钮存在',
          thenSteps: [
            {
              id: 'step-2',
              type: 'action',
              description: '点击登录按钮',
              action: { type: 'click', target: '登录按钮' },
            },
          ],
        },
      };

      // Mock condition evaluation to true
      vi.spyOn(executor, 'evaluateCondition' as any).mockResolvedValue(true);

      const result = await executor.executeCondition(conditionStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(result.branch).toBe('then');
      expect(result.skipped).toBe(false);
    });

    it('should execute else branch when condition is false', async () => {
      const conditionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'condition',
        description: '如果已登录',
        condition: {
          expression: '已登录状态',
          thenSteps: [
            {
              id: 'step-2',
              type: 'action',
              description: '进入主页',
              action: { type: 'navigate', target: '/home' },
            },
          ],
          elseSteps: [
            {
              id: 'step-3',
              type: 'action',
              description: '执行登录',
              action: { type: 'click', target: '登录' },
            },
          ],
        },
      };

      // Mock condition evaluation to false
      vi.spyOn(executor, 'evaluateCondition' as any).mockResolvedValue(false);

      const result = await executor.executeCondition(conditionStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(result.branch).toBe('else');
    });

    it('should skip when no else branch and condition is false', async () => {
      const conditionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'condition',
        description: '可选步骤',
        condition: {
          expression: '条件',
          thenSteps: [
            {
              id: 'step-2',
              type: 'action',
              description: '执行操作',
              action: { type: 'click', target: '按钮' },
            },
          ],
        },
      };

      vi.spyOn(executor, 'evaluateCondition' as any).mockResolvedValue(false);

      const result = await executor.executeCondition(conditionStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(result.branch).toBe('else');
      expect(result.skipped).toBe(true);
    });

    it('should handle nested conditions', async () => {
      const innerStep: AdaptiveStep = {
        id: 'step-3',
        type: 'action',
        description: '最终操作',
        action: { type: 'click', target: '按钮' },
      };

      const middleCondition: AdaptiveStep = {
        id: 'step-2',
        type: 'condition',
        description: '内层条件',
        condition: {
          expression: '内层条件',
          thenSteps: [innerStep],
        },
      };

      const outerCondition: AdaptiveStep = {
        id: 'step-1',
        type: 'condition',
        description: '外层条件',
        condition: {
          expression: '外层条件',
          thenSteps: [middleCondition],
        },
      };

      vi.spyOn(executor, 'evaluateCondition' as any).mockResolvedValue(true);

      const result = await executor.executeCondition(outerCondition, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(context.currentDepth).toBe(2); // Should track nesting depth
    });

    it('should record path in history', async () => {
      const conditionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'condition',
        description: '条件判断',
        condition: {
          expression: '条件',
          thenSteps: [
            {
              id: 'step-2',
              type: 'action',
              description: '操作',
              action: { type: 'click', target: '按钮' },
            },
          ],
        },
      };

      vi.spyOn(executor, 'evaluateCondition' as any).mockResolvedValue(true);

      await executor.executeCondition(conditionStep, context, mockAgent as any);

      expect(context.pathHistory).toHaveLength(1);
      expect(context.pathHistory[0].branch).toBe('then');
    });

    it('should handle condition evaluation errors', async () => {
      const conditionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'condition',
        description: '条件判断',
        condition: {
          expression: '无效条件',
          thenSteps: [
            {
              id: 'step-2',
              type: 'action',
              description: '操作',
              action: { type: 'click', target: '按钮' },
            },
          ],
        },
      };

      vi.spyOn(executor, 'evaluateCondition' as any).mockRejectedValue(new Error('Evaluation failed'));

      const result = await executor.executeCondition(conditionStep, context, mockAgent as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(context.errorStack).toHaveLength(1);
    });
  });

  describe('executeLoop', () => {
    it('should execute count loop for specified iterations', async () => {
      const loopStep: AdaptiveStep = {
        id: 'step-1',
        type: 'loop',
        description: '重复5次',
        loop: {
          type: 'count',
          count: 5,
          body: [
            {
              id: 'step-2',
              type: 'action',
              description: '点击下一页',
              action: { type: 'click', target: '下一页' },
            },
          ],
          maxIterations: 15,
        },
      };

      const result = await executor.executeLoop(loopStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(5);
    });

    it('should stop count loop at maxIterations', async () => {
      const loopStep: AdaptiveStep = {
        id: 'step-1',
        type: 'loop',
        description: '大量重复',
        loop: {
          type: 'count',
          count: 100,
          body: [
            {
              id: 'step-2',
              type: 'action',
              description: '操作',
              action: { type: 'click', target: '按钮' },
            },
          ],
          maxIterations: 10,
        },
      };

      const result = await executor.executeLoop(loopStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(10); // Limited by maxIterations
    });

    it('should execute while loop until condition is false', async () => {
      let callCount = 0;
      const loopStep: AdaptiveStep = {
        id: 'step-1',
        type: 'loop',
        description: '条件循环',
        loop: {
          type: 'while',
          condition: '有更多数据',
          body: [
            {
              id: 'step-2',
              type: 'action',
              description: '加载更多',
              action: { type: 'click', target: '加载更多' },
            },
          ],
          maxIterations: 50,
          timeout: 30000,
        },
      };

      // Mock condition: return true for first 3 iterations, then false
      vi.spyOn(executor, 'evaluateCondition' as any).mockImplementation(async () => {
        callCount++;
        return callCount <= 3;
      });

      const result = await executor.executeLoop(loopStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(3);
    });

    it('should execute forEach loop over collection', async () => {
      const collection = ['item1', 'item2', 'item3'];

      const loopStep: AdaptiveStep = {
        id: 'step-1',
        type: 'loop',
        description: '遍历列表',
        loop: {
          type: 'forEach',
          collection: 'items',
          itemVar: 'item',
          body: [
            {
              id: 'step-2',
              type: 'action',
              description: '处理项目',
              action: { type: 'click', target: 'item' },
            },
          ],
          maxIterations: 50,
        },
      };

      // Setup mock for forEach collection resolution
      vi.spyOn(executor, 'resolveCollection' as any).mockResolvedValue(collection);

      const result = await executor.executeLoop(loopStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(3);
    });

    it('should maintain loop context in stack', async () => {
      const loopStep: AdaptiveStep = {
        id: 'step-1',
        type: 'loop',
        description: '循环测试',
        loop: {
          type: 'count',
          count: 3,
          body: [
            {
              id: 'step-2',
              type: 'action',
              description: '操作',
              action: { type: 'click', target: '按钮' },
            },
          ],
          maxIterations: 10,
        },
      };

      const initialStackLength = context.loopStack.length;

      await executor.executeLoop(loopStep, context, mockAgent as any);

      // Stack should be restored after loop completes
      expect(context.loopStack.length).toBe(initialStackLength);
    });

    it('should handle loop body errors gracefully', async () => {
      const loopStep: AdaptiveStep = {
        id: 'step-1',
        type: 'loop',
        description: '有错误的循环',
        loop: {
          type: 'count',
          count: 5,
          body: [
            {
              id: 'step-2',
              type: 'action',
              description: '失败的操作',
              action: { type: 'click', target: '按钮' },
            },
          ],
          maxIterations: 10,
        },
      };

      // Mock action execution to fail
      vi.spyOn(executor, 'executeAction' as any).mockRejectedValue(new Error('Action failed'));

      const result = await executor.executeLoop(loopStep, context, mockAgent as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should timeout long-running loops', async () => {
      const loopStep: AdaptiveStep = {
        id: 'step-1',
        type: 'loop',
        description: '慢循环',
        loop: {
          type: 'while',
          condition: 'true',
          body: [
            {
              id: 'step-2',
              type: 'action',
              description: '慢操作',
              action: { type: 'wait', target: '1s' },
            },
          ],
          maxIterations: 1000,
          timeout: 100, // 100ms timeout
        },
      };

      vi.spyOn(executor, 'evaluateCondition' as any).mockResolvedValue(true);
      vi.spyOn(executor, 'executeAction' as any).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // Slow operation
      });

      const result = await executor.executeLoop(loopStep, context, mockAgent as any);

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
    });
  });

  describe('executeForEach', () => {
    it('should iterate over array with correct item variable', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const result = await executor.executeForEach(
        {
          type: 'forEach',
          collection: items,
          itemVar: 'fruit',
          body: [
            {
              id: 'step-1',
              type: 'variable',
              description: '设置变量',
              variable: { operation: 'set', name: 'fruit', value: '' },
            },
          ],
          maxIterations: 10,
        },
        context,
        mockAgent as any,
      );

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(3);
    });

    it('should handle empty collection', async () => {
      const result = await executor.executeForEach(
        {
          type: 'forEach',
          collection: [],
          itemVar: 'item',
          body: [],
          maxIterations: 10,
        },
        context,
        mockAgent as any,
      );

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(0);
    });
  });

  describe('executeAction', () => {
    it('should execute click action', async () => {
      const actionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'action',
        description: '点击按钮',
        action: { type: 'click', target: '提交按钮' },
      };

      mockAgent.click.mockResolvedValue({ success: true });

      const result = await executor.executeAction(actionStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(mockAgent.click).toHaveBeenCalledWith('提交按钮');
    });

    it('should execute input action', async () => {
      const actionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'action',
        description: '输入用户名',
        action: { type: 'input', target: '用户名输入框', value: 'testuser' },
      };

      mockAgent.input.mockResolvedValue({ success: true });

      const result = await executor.executeAction(actionStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(mockAgent.input).toHaveBeenCalledWith('用户名输入框', 'testuser');
    });

    it('should execute wait action', async () => {
      const actionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'action',
        description: '等待2秒',
        action: { type: 'wait', target: '2s' },
      };

      const result = await executor.executeAction(actionStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(1900); // ~2 seconds
    });

    it('should execute navigate action', async () => {
      const actionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'action',
        description: '打开页面',
        action: { type: 'navigate', target: 'https://example.com' },
      };

      const result = await executor.executeAction(actionStep, context, mockAgent as any);

      expect(result.success).toBe(true);
    });

    it('should handle action execution errors', async () => {
      const actionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'action',
        description: '失败的操作',
        action: { type: 'click', target: '不存在的按钮' },
      };

      mockAgent.click.mockRejectedValue(new Error('Element not found'));

      const result = await executor.executeAction(actionStep, context, mockAgent as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('executeVariable', () => {
    it('should execute set variable operation', async () => {
      const varStep: AdaptiveStep = {
        id: 'step-1',
        type: 'variable',
        description: '设置计数',
        variable: { operation: 'set', name: 'count', value: 10 },
      };

      const result = await executor.executeVariable(varStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(context.variables.get('count')).toBe(10);
    });

    it('should execute increment operation', async () => {
      const varStep: AdaptiveStep = {
        id: 'step-1',
        type: 'variable',
        description: '增加计数',
        variable: { operation: 'increment', name: 'count' },
      };

      context.variables.set('count', 5);

      const result = await executor.executeVariable(varStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(context.variables.get('count')).toBe(6);
    });

    it('should execute extract operation', async () => {
      const varStep: AdaptiveStep = {
        id: 'step-1',
        type: 'variable',
        description: '提取余额',
        variable: { operation: 'extract', name: 'balance', source: '余额显示' },
      };

      // Mock element text extraction
      mockAgent.locate.mockResolvedValue({
        found: true,
        text: '余额: ¥100.00',
      });

      const result = await executor.executeVariable(varStep, context, mockAgent as any);

      expect(result.success).toBe(true);
      expect(context.variables.has('balance')).toBe(true);
    });
  });

  describe('executeStep', () => {
    it('should dispatch to correct executor based on step type', async () => {
      const steps: AdaptiveStep[] = [
        {
          id: 'step-1',
          type: 'action',
          description: '点击',
          action: { type: 'click', target: '按钮' },
        },
        {
          id: 'step-2',
          type: 'variable',
          description: '设置变量',
          variable: { operation: 'set', name: 'x', value: 1 },
        },
      ];

      mockAgent.click.mockResolvedValue({ success: true });

      const result1 = await executeStep(steps[0], context, mockAgent as any);
      const result2 = await executeStep(steps[1], context, mockAgent as any);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(context.variables.get('x')).toBe(1);
    });
  });

  describe('error recovery', () => {
    it('should continue on error when configured', async () => {
      const executorWithRecovery = new ControlFlowExecutor({ continueOnError: true });

      const actionStep: AdaptiveStep = {
        id: 'step-1',
        type: 'action',
        description: '失败操作',
        action: { type: 'click', target: '按钮' },
      };

      mockAgent.click.mockRejectedValue(new Error('Click failed'));

      const result = await executorWithRecovery.executeAction(actionStep, context, mockAgent as any);

      expect(result.success).toBe(false);
      expect(result.recovered).toBe(true);
    });
  });
});
