/**
 * Adaptive Parser Tests
 * 测试自适应测试用例解析器
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { AdaptiveTestCase } from '../../../../types/adaptive';
import {
  buildParseTree,
  formatAdaptiveTestToMarkdown,
  parseAdaptiveTest,
  validateAdaptiveTest,
} from '../adaptiveParser';

describe('AdaptiveParser', () => {
  describe('parseAdaptiveTest', () => {
    it('should parse basic action steps', () => {
      const markdown = `
# Login Test

测试用户登录功能

steps:
- 点击登录按钮
- 输入用户名到输入框
- 验证登录成功
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.name).toBe('Login Test');
      expect(testCase.description).toBe('测试用户登录功能');
      expect(testCase.steps).toHaveLength(3);
      expect(testCase.steps[0].type).toBe('action');
      expect(testCase.steps[0].action?.type).toBe('click');
      expect(testCase.steps[1].action?.type).toBe('input');
      expect(testCase.steps[2].action?.type).toBe('assert');
    });

    it('should parse condition steps', () => {
      const markdown = `
# Conditional Test

steps:
- when: 登录按钮存在
  then:
    - 点击登录按钮
  else:
    - 跳过登录流程
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.steps).toHaveLength(1);
      expect(testCase.steps[0].type).toBe('condition');
      expect(testCase.steps[0].condition?.expression).toBe('登录按钮存在');
      expect(testCase.steps[0].condition?.thenSteps).toHaveLength(1);
      expect(testCase.steps[0].condition?.elseSteps).toHaveLength(1);
    });

    it('should parse count loop steps', () => {
      const markdown = `
# Loop Test

steps:
- repeat 5 times:
    - 点击下一页
    - 验证数据加载
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.steps).toHaveLength(1);
      expect(testCase.steps[0].type).toBe('loop');
      expect(testCase.steps[0].loop?.type).toBe('count');
      expect(testCase.steps[0].loop?.count).toBe(5);
      expect(testCase.steps[0].loop?.body).toHaveLength(2);
    });

    it('should parse while loop steps', () => {
      const markdown = `
# While Loop Test

steps:
- while 有更多数据:
    - 点击加载更多
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.steps).toHaveLength(1);
      expect(testCase.steps[0].type).toBe('loop');
      expect(testCase.steps[0].loop?.type).toBe('while');
      expect(testCase.steps[0].loop?.condition).toBe('有更多数据');
    });

    it('should parse forEach loop steps', () => {
      const markdown = `
# ForEach Loop Test

steps:
- forEach "商品列表" as item:
    - 点击项目
    - 验证详情页
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.steps).toHaveLength(1);
      expect(testCase.steps[0].type).toBe('loop');
      expect(testCase.steps[0].loop?.type).toBe('forEach');
      expect(testCase.steps[0].loop?.collection).toBe('商品列表');
      expect(testCase.steps[0].loop?.itemVar).toBe('item');
    });

    it('should parse variable operations', () => {
      const markdown = `
# Variable Test

steps:
- set username = "testuser"
- set count = 10
- extract balance from "账户余额显示"
- increment counter
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.steps).toHaveLength(4);
      expect(testCase.steps[0].type).toBe('variable');
      expect(testCase.steps[0].variable?.operation).toBe('set');
      expect(testCase.steps[0].variable?.name).toBe('username');
      expect(testCase.steps[0].variable?.value).toBe('testuser');

      expect(testCase.steps[1].variable?.value).toBe(10);

      expect(testCase.steps[2].variable?.operation).toBe('extract');
      expect(testCase.steps[2].variable?.source).toBe('账户余额显示');

      expect(testCase.steps[3].variable?.operation).toBe('increment');
    });

    it('should parse YAML frontmatter variables', () => {
      const markdown = `
---
variables:
  username: "testuser"
  password: "testpass"
  count: 5
config:
  maxLoopIterations: 100
---

# Frontmatter Test

steps:
- 点击登录按钮
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.variables.username).toBe('testuser');
      expect(testCase.variables.password).toBe('testpass');
      expect(testCase.variables.count).toBe(5);
      expect(testCase.config.maxLoopIterations).toBe(100);
    });

    it('should parse nested conditions', () => {
      const markdown = `
# Nested Condition Test

steps:
- when: 已登录状态
  then:
    - when: 是管理员
      then:
        - 进入管理面板
      else:
        - 进入用户面板
  else:
    - 执行登录流程
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.steps).toHaveLength(1);
      const outerCondition = testCase.steps[0];
      expect(outerCondition.type).toBe('condition');

      const innerCondition = outerCondition.condition?.thenSteps[0];
      expect(innerCondition.type).toBe('condition');
      expect(innerCondition.condition?.thenSteps).toHaveLength(1);
      expect(innerCondition.condition?.elseSteps).toHaveLength(1);
    });

    it('should parse different action types', () => {
      const markdown = `
# Action Types Test

steps:
- 点击提交按钮
- 输入 "test" 到输入框
- 等待 2 秒
- 导航到 https://example.com
- 滚动到底部
- 悬停菜单按钮
- 断言成功消息显示
`;

      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.steps[0].action?.type).toBe('click');
      expect(testCase.steps[1].action?.type).toBe('input');
      expect(testCase.steps[2].action?.type).toBe('wait');
      expect(testCase.steps[3].action?.type).toBe('navigate');
      expect(testCase.steps[4].action?.type).toBe('scroll');
      expect(testCase.steps[5].action?.type).toBe('hover');
      expect(testCase.steps[6].action?.type).toBe('assert');
    });

    it('should handle empty markdown gracefully', () => {
      const markdown = '';
      const testCase = parseAdaptiveTest(markdown);

      expect(testCase.name).toBe('Untitled Test Case');
      expect(testCase.steps).toHaveLength(0);
    });
  });

  describe('validateAdaptiveTest', () => {
    it('should validate valid test case', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: 'Valid Test',
        steps: [
          {
            id: 'step-1',
            type: 'action',
            description: '点击按钮',
            action: { type: 'click', target: '按钮' },
          },
        ],
        variables: {},
        config: {
          maxLoopIterations: 50,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const result = validateAdaptiveTest(testCase);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing test case name', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: '',
        steps: [],
        variables: {},
        config: {
          maxLoopIterations: 50,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const result = validateAdaptiveTest(testCase);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('name'))).toBe(true);
    });

    it('should detect empty steps', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: 'Empty Test',
        steps: [],
        variables: {},
        config: {
          maxLoopIterations: 50,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const result = validateAdaptiveTest(testCase);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.message.includes('at least one step')),
      ).toBe(true);
    });

    it('should warn about high maxLoopIterations', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: 'Test',
        steps: [
          {
            id: 'step-1',
            type: 'action',
            description: 'action',
            action: { type: 'click', target: 'btn' },
          },
        ],
        variables: {},
        config: {
          maxLoopIterations: 150,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const result = validateAdaptiveTest(testCase);

      expect(result.warnings.some((w) => w.type === 'performance')).toBe(true);
    });

    it('should validate while loop has condition', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: 'Invalid Loop Test',
        steps: [
          {
            id: 'step-1',
            type: 'loop',
            description: 'while loop',
            loop: {
              type: 'while',
              body: [],
              maxIterations: 50,
            },
          },
        ],
        variables: {},
        config: {
          maxLoopIterations: 50,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const result = validateAdaptiveTest(testCase);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('condition'))).toBe(
        true,
      );
    });

    it('should validate forEach loop has collection', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: 'Invalid ForEach Test',
        steps: [
          {
            id: 'step-1',
            type: 'loop',
            description: 'forEach loop',
            loop: {
              type: 'forEach',
              body: [],
              maxIterations: 50,
            },
          },
        ],
        variables: {},
        config: {
          maxLoopIterations: 50,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const result = validateAdaptiveTest(testCase);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('collection'))).toBe(
        true,
      );
    });
  });

  describe('buildParseTree', () => {
    it('should build syntax tree from test case', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: 'Tree Test',
        steps: [
          {
            id: 'step-1',
            type: 'action',
            description: '点击按钮',
            action: { type: 'click', target: '按钮' },
            indent: 0,
          },
          {
            id: 'step-2',
            type: 'condition',
            description: 'condition',
            condition: {
              expression: 'test',
              thenSteps: [
                {
                  id: 'step-3',
                  type: 'action',
                  description: 'then action',
                  action: { type: 'click', target: 'then' },
                  indent: 2,
                },
              ],
            },
            indent: 0,
          },
        ],
        variables: {},
        config: {
          maxLoopIterations: 50,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const tree = buildParseTree(testCase);

      expect(tree).toHaveLength(2);
      expect(tree[0].type).toBe('action');
      expect(tree[1].type).toBe('condition');
      expect(tree[1].children).toHaveLength(1);
    });
  });

  describe('formatAdaptiveTestToMarkdown', () => {
    it('should format test case to markdown', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: 'Formatted Test',
        description: '测试描述',
        steps: [
          {
            id: 'step-1',
            type: 'action',
            description: '点击登录按钮',
            action: { type: 'click', target: '登录按钮' },
          },
        ],
        variables: { username: 'test' },
        config: {
          maxLoopIterations: 50,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const markdown = formatAdaptiveTestToMarkdown(testCase);

      expect(markdown).toContain('name: Formatted Test');
      expect(markdown).toContain('description: 测试描述');
      expect(markdown).toContain('username: "test"');
      expect(markdown).toContain('- 点击登录按钮');
    });

    it('should format condition with else branch', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: 'Condition Test',
        steps: [
          {
            id: 'step-1',
            type: 'condition',
            description: 'test',
            condition: {
              expression: '登录按钮存在',
              thenSteps: [
                {
                  id: 'step-2',
                  type: 'action',
                  description: '点击登录',
                  action: { type: 'click', target: '登录' },
                },
              ],
              elseSteps: [
                {
                  id: 'step-3',
                  type: 'action',
                  description: '跳过',
                  action: { type: 'click', target: '跳过' },
                },
              ],
            },
          },
        ],
        variables: {},
        config: {
          maxLoopIterations: 50,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const markdown = formatAdaptiveTestToMarkdown(testCase);

      expect(markdown).toContain('- when: 登录按钮存在');
      expect(markdown).toContain('- then:');
      expect(markdown).toContain('- else:');
      expect(markdown).toContain('- 点击登录');
      expect(markdown).toContain('- 跳过');
    });

    it('should format loop steps', () => {
      const testCase: AdaptiveTestCase = {
        id: 'test-1',
        name: 'Loop Test',
        steps: [
          {
            id: 'step-1',
            type: 'loop',
            description: 'repeat 5 times',
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
          },
        ],
        variables: {},
        config: {
          maxLoopIterations: 50,
          maxNestedDepth: 3,
          loopIterationTimeout: 30000,
          totalTimeout: 300000,
          conditionEvaluationTimeout: 10000,
          defaultConditionFallback: false,
          enablePathOptimization: true,
          trackPathStatistics: true,
          enableDebugLogging: false,
          saveVariableSnapshots: false,
        },
      };

      const markdown = formatAdaptiveTestToMarkdown(testCase);

      expect(markdown).toContain('- repeat 5 times:');
      expect(markdown).toContain('- 点击下一页');
    });
  });
});
