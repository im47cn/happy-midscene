/**
 * Integration Tests for Adaptive Test Generation System
 * 测试自适应测试生成系统的端到端集成
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseAdaptiveTest,
  validateAdaptiveTest,
  type AdaptiveTestCase,
  type AdaptiveStep,
} from '../adaptiveParser';
import { ConditionEngine, getConditionEngine } from '../conditionEngine';
import { ControlFlowExecutor } from '../controlFlowExecutor';
import { LoopManager } from '../loopManager';
import { VariableStore, resetVariableStore } from '../variableStore';
import {
  AdaptiveExecutionEngine,
  executeAdaptiveTest,
} from '../adaptiveExecutionEngine';
import type { ExecutionContext as AdaptiveExecutionContext } from '../../../../types/adaptive';

// Mock AI Agent
const createMockAgent = () => ({
  aiAct: vi.fn().mockResolvedValue(undefined),
  aiLocate: vi.fn().mockResolvedValue({
    found: true,
    text: 'Mock Element',
  }),
  describeElementAtPoint: vi.fn().mockResolvedValue({
    tagName: 'BUTTON',
    text: 'Submit',
  }),
  page: {
    goto: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn().mockResolvedValue('mocked'),
  },
});

describe('Adaptive Test Generation Integration', () => {
  let mockAgent: ReturnType<typeof createMockAgent>;
  let variableStore: VariableStore;
  let conditionEngine: ConditionEngine;
  let controlFlowExecutor: ControlFlowExecutor;
  let loopManager: LoopManager;

  beforeEach(() => {
    mockAgent = createMockAgent();
    variableStore = new VariableStore({}, { enableSnapshots: true, enableChangeEvents: true });
    conditionEngine = new ConditionEngine();
    controlFlowExecutor = new ControlFlowExecutor({ debug: false });
    loopManager = new LoopManager();
    resetVariableStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Adaptive Execution Flow', () => {
    it('should parse and execute simple conditional test', async () => {
      const markdown = `---
name: 登录测试
description: 测试登录流程
variables:
  username: testuser
---

- when: 登录按钮存在
  then:
    - 点击登录按钮
  else:
    - 点击注册按钮
`;

      // Parse the test
      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.name).toBe('登录测试');
      expect(testCase.steps).toHaveLength(1);
      expect(testCase.steps[0].type).toBe('condition');

      // Validate
      const validation = validateAdaptiveTest(testCase);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Verify structure
      const conditionStep = testCase.steps[0];
      expect(conditionStep.condition?.thenSteps).toBeDefined();
      expect(conditionStep.condition?.elseSteps).toBeDefined();
    });

    it('should parse and execute loop-based test', async () => {
      const markdown = `---
name: 分页测试
description: 测试分页加载
variables:
  pageCount: 0
---

- repeat 5 times:
    - 点击下一页按钮
    - 等待页面加载

- while: 还有更多数据
  maxIterations: 10
  body:
    - 加载更多内容
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.name).toBe('分页测试');
      expect(testCase.steps.length).toBeGreaterThanOrEqual(1);

      // Find loop steps
      const loopSteps = testCase.steps.filter((s) => s.type === 'loop');
      expect(loopSteps.length).toBeGreaterThan(0);

      // Validate
      const validation = validateAdaptiveTest(testCase);
      expect(validation.valid).toBe(true);
    });

    it('should parse variable operations', async () => {
      const markdown = `---
name: 变量测试
variables:
  counter: 0
---

- set counter to 1
- increment counter
- extract balance from 余额显示
- if counter equals 5
  then:
    - 执行操作
`;

      const testCase = parseAdaptiveTest(markdown);

      // Find variable steps
      const varSteps = testCase.steps.filter((s) => s.type === 'variable');
      expect(varSteps.length).toBeGreaterThan(0);

      // Check operations
      const operations = varSteps.map((s) => s.variable?.operation);
      expect(operations).toContain('set');
      expect(operations).toContain('increment');
      expect(operations).toContain('extract');
    });

    it('should execute variable operations in sequence', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map([['counter', 0]]),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      // Set variable
      await controlFlowExecutor.executeVariable(
        {
          id: 'step-1',
          type: 'variable',
          description: '设置计数',
          variable: { operation: 'set', name: 'counter', value: 10 },
        },
        context,
        mockAgent as any
      );

      expect(context.variables.get('counter')).toBe(10);

      // Increment
      await controlFlowExecutor.executeVariable(
        {
          id: 'step-2',
          type: 'variable',
          description: '增加计数',
          variable: { operation: 'increment', name: 'counter' },
        },
        context,
        mockAgent as any
      );

      expect(context.variables.get('counter')).toBe(11);
    });
  });

  describe('Complex Nested Scenarios', () => {
    it('should handle nested conditions', async () => {
      const markdown = `---
name: 嵌套条件测试
---

- when: 用户已登录
  then:
    - when: 是管理员用户
      then:
        - 显示管理面板
      else:
        - 显示用户面板
  else:
    - 重定向到登录页
`;

      const testCase = parseAdaptiveTest(markdown);

      // Should have outer condition
      expect(testCase.steps[0].type).toBe('condition');

      // Outer condition should have nested condition in then branch
      const outerThen = testCase.steps[0].condition?.thenSteps;
      expect(outerThen).toBeDefined();
      expect(outerThen?.[0].type).toBe('condition');

      // Validate nested structure
      const validation = validateAdaptiveTest(testCase);
      expect(validation.valid).toBe(true);
    });

    it('should handle loop inside condition', async () => {
      const markdown = `---
name: 条件中循环
---

- when: 有多个待处理项目
  then:
    - repeat 3 times:
        - 处理项目
  else:
    - 显示无项目消息
`;

      const testCase = parseAdaptiveTest(markdown);

      const conditionStep = testCase.steps[0];
      expect(conditionStep.type).toBe('condition');

      // Then branch should contain a loop
      const thenSteps = conditionStep.condition?.thenSteps;
      expect(thenSteps?.[0].type).toBe('loop');

      // Validate
      const validation = validateAdaptiveTest(testCase);
      expect(validation.valid).toBe(true);
    });

    it('should handle condition inside loop', async () => {
      const markdown = `---
name: 循环中条件
---

- repeat 5 times:
    - when: 项目有效
      then:
        - 处理项目
      else:
        - 跳过项目
`;

      const testCase = parseAdaptiveTest(markdown);

      const loopStep = testCase.steps[0];
      expect(loopStep.type).toBe('loop');

      // Loop body should contain a condition
      const loopBody = loopStep.loop?.body;
      expect(loopBody?.[0].type).toBe('condition');

      // Validate
      const validation = validateAdaptiveTest(testCase);
      expect(validation.valid).toBe(true);
    });

    it('should handle deeply nested structure (3 levels)', async () => {
      const markdown = `---
name: 深度嵌套测试
---

- when: 外层条件
  then:
    - repeat 3 times:
        - when: 中层条件
          then:
            - when: 内层条件
              then:
                - 执行最终操作
`;

      const testCase = parseAdaptiveTest(markdown);

      // Check nesting depth
      const validation = validateAdaptiveTest(testCase);

      // Should be valid (within max depth limit)
      expect(validation.valid).toBe(true);

      // Track depth during execution
      let maxDepth = 0;
      const trackDepth = (steps: AdaptiveStep[], currentDepth = 1) => {
        for (const step of steps) {
          maxDepth = Math.max(maxDepth, currentDepth);

          if (step.condition?.thenSteps) {
            trackDepth(step.condition.thenSteps, currentDepth + 1);
          }
          if (step.condition?.elseSteps) {
            trackDepth(step.condition.elseSteps, currentDepth + 1);
          }
          if (step.loop?.body) {
            trackDepth(step.loop.body, currentDepth + 1);
          }
        }
      };

      trackDepth(testCase.steps);
      expect(maxDepth).toBeGreaterThanOrEqual(3);
    });

    it('should detect maximum depth exceeded', async () => {
      // Create a test case that exceeds max depth
      let markdown = `---
name: 超深嵌套
---

- when: Level 1
  then:
`;

      // Add 10 levels of nesting
      for (let i = 2; i <= 10; i++) {
        markdown += `    - when: Level ${i}
  then:
`;
      }

      markdown += '        - 最终操作';

      const testCase = parseAdaptiveTest(markdown);
      const validation = validateAdaptiveTest(testCase);

      // Should have warning about excessive depth
      const depthWarnings = validation.warnings.filter(
        (w) => w.type === 'complexity' && w.message.includes('depth')
      );
      expect(depthWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Variable Store Integration', () => {
    it('should maintain variable state across operations', async () => {
      variableStore.set('count', 0);
      variableStore.set('name', 'test');

      // Simulate operations
      for (let i = 0; i < 5; i++) {
        variableStore.increment('count');
      }

      expect(variableStore.get('count')).toBe(5);
      expect(variableStore.get('name')).toBe('test');
    });

    it('should support variable replacement in descriptions', async () => {
      variableStore.set('username', 'alice');
      variableStore.set('page', 'dashboard');

      const text = 'Hello ${username}, welcome to ${page}';
      const result = variableStore.replaceVariables(text);

      expect(result).toBe('Hello alice, welcome to dashboard');
    });

    it('should create and restore snapshots', async () => {
      // Set initial values
      variableStore.set('a', 1);
      variableStore.set('b', 2);

      const snapshot1 = variableStore.createSnapshot();

      // Modify values
      variableStore.set('a', 10);
      variableStore.set('c', 3);

      const snapshot2 = variableStore.createSnapshot();

      // Restore to first snapshot
      variableStore.restoreSnapshot(snapshot1);

      expect(variableStore.get('a')).toBe(1);
      expect(variableStore.get('b')).toBe(2);
      expect(variableStore.get('c')).toBeUndefined();

      // Restore to second snapshot
      variableStore.restoreSnapshot(snapshot2);

      expect(variableStore.get('a')).toBe(10);
      expect(variableStore.get('c')).toBe(3);
    });

    it('should emit change events', async () => {
      const eventStore = new VariableStore({}, { enableChangeEvents: true });
      const events: any[] = [];

      eventStore.onChange((event) => {
        events.push(event);
      });

      eventStore.set('x', 1);
      eventStore.increment('x');
      eventStore.delete('x');

      expect(events).toHaveLength(3);
      expect(events[0].operation).toBe('set');
      expect(events[1].operation).toBe('increment');
      expect(events[2].operation).toBe('delete');
    });

    it('should convert to and from execution context', async () => {
      variableStore.set('var1', 'value1');
      variableStore.set('var2', 42);

      const context = variableStore.toExecutionContext();

      expect(context.variables.get('var1')).toBe('value1');
      expect(context.variables.get('var2')).toBe(42);

      // Create new store and restore
      const newStore = new VariableStore();
      newStore.fromExecutionContext(context);

      expect(newStore.get('var1')).toBe('value1');
      expect(newStore.get('var2')).toBe(42);
    });
  });

  describe('Loop Manager Integration', () => {
    it('should track loop iterations correctly', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const loopConfig = {
        type: 'count' as const,
        count: 5,
        body: [
          {
            id: 'step-1',
            type: 'action',
            description: '操作',
            action: { type: 'click', target: '按钮' },
          },
        ],
        maxIterations: 10,
      };

      const result = await controlFlowExecutor.executeLoop(
        {
          id: 'loop-1',
          type: 'loop',
          description: '重复5次',
          loop: loopConfig,
        },
        context,
        mockAgent as any
      );

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(5);
    });

    it('should enforce maxIterations limit', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const loopConfig = {
        type: 'count' as const,
        count: 100, // Request more than max
        body: [
          {
            id: 'step-1',
            type: 'action',
            description: '操作',
            action: { type: 'click', target: '按钮' },
          },
        ],
        maxIterations: 10, // Limit to 10
      };

      const result = await controlFlowExecutor.executeLoop(
        {
          id: 'loop-1',
          type: 'loop',
          description: '大量重复',
          loop: loopConfig,
        },
        context,
        mockAgent as any
      );

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(10); // Limited by maxIterations
    });

    it('should handle forEach loop', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const items = ['item1', 'item2', 'item3'];
      context.variables.set('items', items);

      const loopConfig = {
        type: 'forEach' as const,
        collection: 'items',
        itemVar: 'item',
        body: [
          {
            id: 'step-1',
            type: 'action',
            description: '处理项目',
            action: { type: 'click', target: 'item' },
          },
        ],
        maxIterations: 10,
      };

      // Mock collection resolution
      vi.spyOn(controlFlowExecutor, 'resolveCollection' as any).mockResolvedValue(items);

      const result = await controlFlowExecutor.executeLoop(
        {
          id: 'loop-1',
          type: 'loop',
          description: '遍历列表',
          loop: loopConfig,
        },
        context,
        mockAgent as any
      );

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(3);
    });
  });

  describe('Condition Evaluation Integration', () => {
    it('should evaluate element existence conditions', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      // Mock element found
      mockAgent.aiLocate.mockResolvedValue({
        found: true,
        text: '登录按钮',
      });

      const result = await conditionEngine.evaluate(
        {
          type: 'element',
          element: { target: '登录按钮', check: 'exists' },
        },
        context,
        mockAgent as any
      );

      expect(result.isTrue).toBe(true);
    });

    it('should evaluate text content conditions', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      mockAgent.aiLocate.mockResolvedValue({
        found: true,
        text: '余额: ¥100.00',
      });

      const result = await conditionEngine.evaluate(
        {
          type: 'text',
          text: {
            target: '余额显示',
            operator: 'contains',
            value: '¥100',
          },
        },
        context,
        mockAgent as any
      );

      expect(result.isTrue).toBe(true);
    });

    it('should evaluate variable conditions', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map([['count', 5]]),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const result = await conditionEngine.evaluate(
        {
          type: 'variable',
          variable: {
            name: 'count',
            operator: '>=',
            value: 3,
          },
        },
        context,
        mockAgent as any
      );

      expect(result.isTrue).toBe(true);
    });

    it('should evaluate compound conditions with AND', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map([
          ['isLoggedIn', true],
          ['isAdmin', true],
        ]),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const result = await conditionEngine.evaluate(
        {
          type: 'compound',
          compound: {
            operator: 'and',
            operands: [
              {
                type: 'variable',
                variable: { name: 'isLoggedIn', operator: '==', value: true },
              },
              {
                type: 'variable',
                variable: { name: 'isAdmin', operator: '==', value: true },
              },
            ],
          },
        },
        context,
        mockAgent as any
      );

      expect(result.isTrue).toBe(true);
    });

    it('should evaluate compound conditions with OR', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map([
          ['hasPermission', false],
          ['isOwner', true],
        ]),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const result = await conditionEngine.evaluate(
        {
          type: 'compound',
          compound: {
            operator: 'or',
            operands: [
              {
                type: 'variable',
                variable: { name: 'hasPermission', operator: '==', value: true },
              },
              {
                type: 'variable',
                variable: { name: 'isOwner', operator: '==', value: true },
              },
            ],
          },
        },
        context,
        mockAgent as any
      );

      expect(result.isTrue).toBe(true);
    });

    it('should evaluate compound conditions with NOT', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map([['blocked', false]]),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const result = await conditionEngine.evaluate(
        {
          type: 'compound',
          compound: {
            operator: 'not',
            operands: [
              {
                type: 'variable',
                variable: { name: 'blocked', operator: '==', value: true },
              },
            ],
          },
        },
        context,
        mockAgent as any
      );

      expect(result.isTrue).toBe(true);
    });

    it('should short-circuit AND evaluation', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map([
          ['first', false],
          ['second', true],
        ]),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      let evaluationCount = 0;

      // Mock aiLocate to track calls
      mockAgent.aiLocate.mockImplementation(async () => {
        evaluationCount++;
        return { found: true };
      });

      await conditionEngine.evaluate(
        {
          type: 'compound',
          compound: {
            operator: 'and',
            operands: [
              {
                type: 'variable',
                variable: { name: 'first', operator: '==', value: true },
              },
              {
                type: 'element',
                element: { target: 'some element', check: 'exists' },
              },
            ],
          },
        },
        context,
        mockAgent as any
      );

      // Should short-circuit and not check element
      expect(evaluationCount).toBe(0);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should continue on error when configured', async () => {
      const forgivingExecutor = new ControlFlowExecutor({ continueOnError: true });
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      // Mock action failure
      mockAgent.aiAct.mockRejectedValue(new Error('Action failed'));

      const result = await forgivingExecutor.executeAction(
        {
          id: 'step-1',
          type: 'action',
          description: '失败的操作',
          action: { type: 'click', target: '按钮' },
        },
        context,
        mockAgent as any
      );

      expect(result.success).toBe(false);
      expect(result.recovered).toBe(true);
    });

    it('should handle missing variables gracefully', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(), // Empty variables
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const result = await conditionEngine.evaluate(
        {
          type: 'variable',
          variable: {
            name: 'nonexistent',
            operator: '==',
            value: 5,
          },
        },
        context,
        mockAgent as any
      );

      // Should handle missing variable
      expect(result.isTrue).toBe(false);
    });

    it('should handle element not found errors', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      // Mock element not found
      mockAgent.aiLocate.mockResolvedValue({
        found: false,
      });

      const result = await conditionEngine.evaluate(
        {
          type: 'element',
          element: { target: '不存在的元素', check: 'exists' },
        },
        context,
        mockAgent as any
      );

      expect(result.isTrue).toBe(false);
    });

    it('should handle timeout in loops', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const loopConfig = {
        type: 'while' as const,
        condition: 'true',
        body: [
          {
            id: 'step-1',
            type: 'action',
            description: '慢操作',
            action: { type: 'wait', target: '1s' },
          },
        ],
        maxIterations: 100,
        timeout: 100, // 100ms timeout
      };

      // Mock slow operation
      mockAgent.aiAct.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      vi.spyOn(controlFlowExecutor, 'evaluateCondition' as any).mockResolvedValue(true);

      const result = await controlFlowExecutor.executeLoop(
        {
          id: 'loop-1',
          type: 'loop',
          description: '慢循环',
          loop: loopConfig,
        },
        context,
        mockAgent as any
      );

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
    });

    it('should record errors in error stack', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      // Mock failure
      mockAgent.aiAct.mockRejectedValue(new Error('Test error'));

      await controlFlowExecutor.executeAction(
        {
          id: 'step-1',
          type: 'action',
          description: '失败操作',
          action: { type: 'click', target: '按钮' },
        },
        context,
        mockAgent as any
      );

      expect(context.errorStack).toHaveLength(1);
      expect(context.errorStack[0].message).toBe('Test error');
    });

    it('should provide fallback for condition evaluation', async () => {
      const engineWithFallback = new ConditionEngine({
        defaultFallback: false,
      });

      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      // Mock error in evaluation
      mockAgent.aiLocate.mockRejectedValue(new Error('Evaluation failed'));

      const result = await engineWithFallback.evaluate(
        {
          type: 'element',
          element: { target: '元素', check: 'exists' },
        },
        context,
        mockAgent as any
      );

      // Should return fallback value
      expect(result.isTrue).toBe(false);
    });
  });

  describe('Full Workflow Integration', () => {
    it('should complete parse-validate-execute workflow', async () => {
      const markdown = `---
name: 完整流程测试
variables:
  counter: 0
---

- when: 登录按钮存在
  then:
    - 点击登录按钮
    - increment counter

- repeat 3 times:
    - 点击加载更多

- if counter equals 1
  then:
    - 导航到首页
`;

      // 1. Parse
      const testCase = parseAdaptiveTest(markdown);
      expect(testCase.name).toBe('完整流程测试');

      // 2. Validate
      const validation = validateAdaptiveTest(testCase);
      expect(validation.valid).toBe(true);

      // 3. Prepare execution context
      const context: AdaptiveExecutionContext = {
        variables: new Map(Object.entries(testCase.variables)),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      // 4. Mock condition to true
      vi.spyOn(controlFlowExecutor, 'evaluateCondition' as any).mockResolvedValue(true);

      // 5. Execute first step (condition)
      const conditionResult = await controlFlowExecutor.executeCondition(
        testCase.steps[0],
        context,
        mockAgent as any
      );

      expect(conditionResult.success).toBe(true);
      expect(conditionResult.branch).toBe('then');
    });

    it('should track execution statistics', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map([['count', 0]]),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      // Execute a loop
      const loopResult = await controlFlowExecutor.executeLoop(
        {
          id: 'loop-1',
          type: 'loop',
          description: '重复3次',
          loop: {
            type: 'count',
            count: 3,
            body: [
              {
                id: 'step-1',
                type: 'action',
                description: '操作',
                action: { type: 'click', target: '按钮' },
              },
            ],
            maxIterations: 10,
          },
        },
        context,
        mockAgent as any
      );

      // Get statistics
      const stats = controlFlowExecutor.getExecutionStats(context);

      expect(stats.totalSteps).toBeGreaterThan(0);
      expect(stats.loopIterations).toBe(3);
    });

    it('should maintain path history', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      vi.spyOn(controlFlowExecutor, 'evaluateCondition' as any)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      // Execute condition (takes then branch)
      await controlFlowExecutor.executeCondition(
        {
          id: 'cond-1',
          type: 'condition',
          description: '条件1',
          condition: {
            expression: '条件',
            thenSteps: [
              {
                id: 'step-1',
                type: 'action',
                description: '操作1',
                action: { type: 'click', target: '按钮' },
              },
            ],
            elseSteps: [
              {
                id: 'step-2',
                type: 'action',
                description: '操作2',
                action: { type: 'click', target: '按钮' },
              },
            ],
          },
        },
        context,
        mockAgent as any
      );

      // Execute another condition (takes else branch)
      await controlFlowExecutor.executeCondition(
        {
          id: 'cond-2',
          type: 'condition',
          description: '条件2',
          condition: {
            expression: '条件',
            thenSteps: [
              {
                id: 'step-3',
                type: 'action',
                description: '操作3',
                action: { type: 'click', target: '按钮' },
              },
            ],
            elseSteps: [
              {
                id: 'step-4',
                type: 'action',
                description: '操作4',
                action: { type: 'click', target: '按钮' },
              },
            ],
          },
        },
        context,
        mockAgent as any
      );

      // Check path history
      expect(context.pathHistory).toHaveLength(2);
      expect(context.pathHistory[0].branch).toBe('then');
      expect(context.pathHistory[1].branch).toBe('else');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty test case', () => {
      const markdown = `---
name: 空测试
---
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.name).toBe('空测试');
      expect(testCase.steps).toHaveLength(0);

      const validation = validateAdaptiveTest(testCase);
      expect(validation.valid).toBe(true);
    });

    it('should handle test with only variables', () => {
      const markdown = `---
name: 只有变量
variables:
  var1: value1
  var2: 42
  var3: true
---
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.variables.var1).toBe('value1');
      expect(testCase.variables.var2).toBe(42);
      expect(testCase.variables.var3).toBe(true);

      const validation = validateAdaptiveTest(testCase);
      expect(validation.valid).toBe(true);
    });

    it('should handle special characters in descriptions', () => {
      const markdown = `---
name: 特殊字符测试
---
- 点击 "提交" 按钮
- 在输入框输入 <script>alert('test')</script>
- 导航到 https://example.com?param=value&other=123
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.steps).toHaveLength(3);

      const validation = validateAdaptiveTest(testCase);
      expect(validation.valid).toBe(true);
    });

    it('should handle very long loop counts', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      const result = await controlFlowExecutor.executeLoop(
        {
          id: 'loop-1',
          type: 'loop',
          description: '大量重复',
          loop: {
            type: 'count',
            count: 1000000, // Very large
            body: [
              {
                id: 'step-1',
                type: 'action',
                description: '操作',
                action: { type: 'click', target: '按钮' },
              },
            ],
            maxIterations: 50, // But limited
          },
        },
        context,
        mockAgent as any
      );

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(50); // Limited by maxIterations
    });

    it('should handle deeply nested loop stacks', async () => {
      const context: AdaptiveExecutionContext = {
        variables: new Map(),
        loopStack: [],
        pathHistory: [],
        errorStack: [],
        currentDepth: 0,
      };

      // Push nested loop contexts
      for (let i = 0; i < 10; i++) {
        context.loopStack.push({
          loopId: `loop-${i}`,
          currentIteration: i,
          maxIterations: 100,
          startTime: Date.now(),
        });
      }

      // Should detect excessive nesting
      const shouldStop = controlFlowExecutor.shouldStop(context);

      // With maxNestedDepth of 3, 10 loops should trigger stop
      expect(shouldStop).toBe(true);
    });

    it('should handle concurrent variable operations', async () => {
      const store = new VariableStore({}, { enableSnapshots: true, enableChangeEvents: true });

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            store.set(`key${i}`, i);
          })
        );
      }

      await Promise.all(promises);

      expect(store.size).toBe(100);
      expect(store.get('key50')).toBe(50);
    });
  });
});
