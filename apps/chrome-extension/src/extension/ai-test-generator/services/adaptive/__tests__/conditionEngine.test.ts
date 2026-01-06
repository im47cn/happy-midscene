/**
 * Condition Engine Tests
 * 测试条件引擎
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ConditionExpression,
  ExecutionContext,
} from '../../../../types/adaptive';
import { ConditionEngine, evaluateCondition } from '../conditionEngine';
import {
  parseConditionExpression,
  parseNaturalLanguageCondition,
} from '../expressionParser';

// Mock Midscene agent
const mockAgent = {
  locate: vi.fn(),
  element: vi.fn(),
  takeScreenshot: vi.fn(),
};

describe('ConditionEngine', () => {
  let engine: ConditionEngine;
  let context: ExecutionContext;

  beforeEach(() => {
    engine = new ConditionEngine();
    context = {
      variables: new Map([
        ['count', 5],
        ['username', 'testuser'],
        ['isLoggedIn', true],
      ]),
      loopStack: [],
      pathHistory: [],
      errorStack: [],
      currentDepth: 0,
    };
    vi.clearAllMocks();
  });

  describe('evaluate', () => {
    describe('element conditions', () => {
      it('should evaluate element exists condition', async () => {
        mockAgent.locate.mockResolvedValue({ found: true });

        const expr: ConditionExpression = {
          type: 'element',
          element: {
            target: '登录按钮',
            check: 'exists',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate element visible condition', async () => {
        mockAgent.locate.mockResolvedValue({ found: true, visible: true });

        const expr: ConditionExpression = {
          type: 'element',
          element: {
            target: '提交按钮',
            check: 'visible',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate element enabled condition', async () => {
        mockAgent.locate.mockResolvedValue({ found: true, enabled: true });

        const expr: ConditionExpression = {
          type: 'element',
          element: {
            target: '输入框',
            check: 'enabled',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate element selected condition', async () => {
        mockAgent.locate.mockResolvedValue({ found: true, selected: true });

        const expr: ConditionExpression = {
          type: 'element',
          element: {
            target: '复选框',
            check: 'selected',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should return false when element not found', async () => {
        mockAgent.locate.mockResolvedValue({ found: false });

        const expr: ConditionExpression = {
          type: 'element',
          element: {
            target: '不存在的按钮',
            check: 'exists',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(false);
      });

      it('should handle element location errors gracefully', async () => {
        mockAgent.locate.mockRejectedValue(new Error('Location failed'));

        const expr: ConditionExpression = {
          type: 'element',
          element: {
            target: '按钮',
            check: 'exists',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('text conditions', () => {
      it('should evaluate text equals condition', async () => {
        mockAgent.locate.mockResolvedValue({
          found: true,
          text: 'Hello World',
        });

        const expr: ConditionExpression = {
          type: 'text',
          text: {
            target: '标题',
            operator: 'equals',
            value: 'Hello World',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate text contains condition', async () => {
        mockAgent.locate.mockResolvedValue({
          found: true,
          text: 'Welcome to the system',
        });

        const expr: ConditionExpression = {
          type: 'text',
          text: {
            target: '消息',
            operator: 'contains',
            value: 'Welcome',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate text matches condition (regex)', async () => {
        mockAgent.locate.mockResolvedValue({
          found: true,
          text: 'Price: $99.99',
        });

        const expr: ConditionExpression = {
          type: 'text',
          text: {
            target: '价格',
            operator: 'matches',
            value: '\\$\\d+\\.\\d{2}',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should return false when text condition not met', async () => {
        mockAgent.locate.mockResolvedValue({
          found: true,
          text: 'Different Text',
        });

        const expr: ConditionExpression = {
          type: 'text',
          text: {
            target: '标题',
            operator: 'equals',
            value: 'Expected Text',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(false);
      });
    });

    describe('state conditions', () => {
      it('should evaluate logged_in state', async () => {
        const expr: ConditionExpression = {
          type: 'state',
          state: {
            type: 'logged_in',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate loading state', async () => {
        // Mock loading indicator detection
        mockAgent.locate.mockResolvedValue({ found: true });

        const expr: ConditionExpression = {
          type: 'state',
          state: {
            type: 'loading',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate error state', async () => {
        // Mock error message detection
        mockAgent.locate.mockResolvedValue({ found: true });

        const expr: ConditionExpression = {
          type: 'state',
          state: {
            type: 'error',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate empty state', async () => {
        // Mock empty list detection
        mockAgent.locate.mockResolvedValue({ found: true, empty: true });

        const expr: ConditionExpression = {
          type: 'state',
          state: {
            type: 'empty',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });
    });

    describe('variable conditions', () => {
      it('should evaluate variable equality', async () => {
        const expr: ConditionExpression = {
          type: 'variable',
          variable: {
            name: 'count',
            operator: '==',
            value: 5,
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate variable inequality', async () => {
        const expr: ConditionExpression = {
          type: 'variable',
          variable: {
            name: 'count',
            operator: '!=',
            value: 10,
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate variable greater than', async () => {
        const expr: ConditionExpression = {
          type: 'variable',
          variable: {
            name: 'count',
            operator: '>',
            value: 3,
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate variable less than', async () => {
        const expr: ConditionExpression = {
          type: 'variable',
          variable: {
            name: 'count',
            operator: '<',
            value: 10,
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate variable string equality', async () => {
        const expr: ConditionExpression = {
          type: 'variable',
          variable: {
            name: 'username',
            operator: '==',
            value: 'testuser',
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should return false for undefined variable', async () => {
        const expr: ConditionExpression = {
          type: 'variable',
          variable: {
            name: 'undefinedVar',
            operator: '==',
            value: 5,
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(false);
      });
    });

    describe('compound conditions', () => {
      it('should evaluate AND compound condition', async () => {
        mockAgent.locate.mockResolvedValue({ found: true });

        const expr: ConditionExpression = {
          type: 'compound',
          compound: {
            operator: 'and',
            operands: [
              {
                type: 'element',
                element: { target: '按钮1', check: 'exists' },
              },
              {
                type: 'element',
                element: { target: '按钮2', check: 'exists' },
              },
            ],
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate OR compound condition', async () => {
        mockAgent.locate
          .mockResolvedValueOnce({ found: true })
          .mockResolvedValueOnce({ found: false });

        const expr: ConditionExpression = {
          type: 'compound',
          compound: {
            operator: 'or',
            operands: [
              {
                type: 'element',
                element: { target: '按钮1', check: 'exists' },
              },
              {
                type: 'element',
                element: { target: '按钮2', check: 'exists' },
              },
            ],
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should evaluate NOT compound condition', async () => {
        mockAgent.locate.mockResolvedValue({ found: false });

        const expr: ConditionExpression = {
          type: 'compound',
          compound: {
            operator: 'not',
            operands: [
              {
                type: 'element',
                element: { target: '弹窗', check: 'exists' },
              },
            ],
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      });

      it('should short-circuit AND evaluation', async () => {
        mockAgent.locate.mockResolvedValue({ found: false });

        const expr: ConditionExpression = {
          type: 'compound',
          compound: {
            operator: 'and',
            operands: [
              {
                type: 'element',
                element: { target: '按钮1', check: 'exists' },
              },
              {
                type: 'element',
                element: { target: '按钮2', check: 'exists' },
              },
            ],
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(false);
        expect(mockAgent.locate).toHaveBeenCalledTimes(1);
      });

      it('should short-circuit OR evaluation', async () => {
        mockAgent.locate.mockResolvedValue({ found: true });

        const expr: ConditionExpression = {
          type: 'compound',
          compound: {
            operator: 'or',
            operands: [
              {
                type: 'element',
                element: { target: '按钮1', check: 'exists' },
              },
              {
                type: 'element',
                element: { target: '按钮2', check: 'exists' },
              },
            ],
          },
        };

        const result = await engine.evaluate(expr, context, mockAgent as any);

        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
        expect(mockAgent.locate).toHaveBeenCalledTimes(1);
      });
    });

    describe('timeout handling', () => {
      it('should timeout after specified duration', async () => {
        // Create a promise that never resolves
        mockAgent.locate.mockReturnValue(new Promise(() => {}));

        const expr: ConditionExpression = {
          type: 'element',
          element: {
            target: '按钮',
            check: 'exists',
          },
        };

        const engineWithTimeout = new ConditionEngine({ timeout: 100 });
        const result = await engineWithTimeout.evaluate(
          expr,
          context,
          mockAgent as any,
        );

        expect(result.success).toBe(false);
        expect(result.timedOut).toBe(true);
      });
    });
  });

  describe('evaluateCondition helper', () => {
    it('should evaluate condition from expression string', async () => {
      mockAgent.locate.mockResolvedValue({ found: true });

      const result = await evaluateCondition(
        '登录按钮存在',
        context,
        mockAgent as any,
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should evaluate parsed condition expression', async () => {
      mockAgent.locate.mockResolvedValue({ found: true });

      const parsed = parseNaturalLanguageCondition('登录按钮存在');
      if (parsed.success && parsed.result) {
        const result = await evaluateCondition(
          parsed.result,
          context,
          mockAgent as any,
        );
        expect(result.success).toBe(true);
        expect(result.value).toBe(true);
      }
    });
  });

  describe('caching', () => {
    it('should cache evaluation results when enabled', async () => {
      mockAgent.locate.mockResolvedValue({ found: true });

      const engineWithCache = new ConditionEngine({ useCache: true });

      const expr: ConditionExpression = {
        type: 'element',
        element: {
          target: '按钮',
          check: 'exists',
        },
      };

      // First call
      await engineWithCache.evaluate(expr, context, mockAgent as any);
      // Second call - should use cache
      await engineWithCache.evaluate(expr, context, mockAgent as any);

      expect(mockAgent.locate).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on context change', async () => {
      mockAgent.locate.mockResolvedValue({ found: true });

      const engineWithCache = new ConditionEngine({ useCache: true });

      const expr: ConditionExpression = {
        type: 'variable',
        variable: {
          name: 'count',
          operator: '>',
          value: 3,
        },
      };

      // First evaluation
      await engineWithCache.evaluate(expr, context, mockAgent as any);

      // Change context
      context.variables.set('count', 2);

      // Second evaluation - should not use cache due to context change
      await engineWithCache.evaluate(expr, context, mockAgent as any);

      // Variable conditions don't use agent, so no agent calls expected
      // But cache should be invalidated
      expect(engineWithCache['cache']?.size).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle malformed expressions gracefully', async () => {
      const badExpr = {
        type: 'invalid' as any,
      } as ConditionExpression;

      const result = await engine.evaluate(badExpr, context, mockAgent as any);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should use fallback value when configured', async () => {
      mockAgent.locate.mockRejectedValue(new Error('API Error'));

      const engineWithFallback = new ConditionEngine({ fallback: true });

      const expr: ConditionExpression = {
        type: 'element',
        element: {
          target: '按钮',
          check: 'exists',
        },
      };

      const result = await engineWithFallback.evaluate(
        expr,
        context,
        mockAgent as any,
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe(false); // fallback value
    });
  });
});
