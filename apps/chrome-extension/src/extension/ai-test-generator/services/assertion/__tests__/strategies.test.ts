/**
 * Assertion Strategies Tests
 */

import { describe, it, expect } from 'vitest';
import {
  SuccessMessageStrategy,
  NavigationStrategy,
  StateChangeStrategy,
  ElementVisibilityStrategy,
  DataValidationStrategy,
  ErrorPreventionStrategy,
  getStrategiesByPriority,
} from '../strategies';
import type { ActionContext, AnalysisResult } from '../../../types/assertion';

const createContext = (overrides: Partial<ActionContext> = {}): ActionContext => ({
  action: {
    type: 'click',
    target: { text: '按钮' },
    timestamp: Date.now(),
  },
  pageState: {
    beforeUrl: 'https://example.com',
    afterUrl: 'https://example.com',
    visibleChanges: [],
  },
  semantic: {
    actionIntent: 'click_action',
    targetSemantics: '按钮',
    expectedOutcome: '操作成功',
  },
  stepId: 'step-1',
  stepIndex: 0,
  ...overrides,
});

const createAnalysis = (overrides: Partial<AnalysisResult> = {}): AnalysisResult => ({
  needsAssertion: true,
  assertionTypes: [],
  changes: [],
  intent: 'generic_action',
  confidence: 50,
  ...overrides,
});

describe('SuccessMessageStrategy', () => {
  const strategy = new SuccessMessageStrategy();

  it('should apply to form submit intents', () => {
    const context = createContext();
    const analysis = createAnalysis({ intent: 'submit_form' });

    expect(strategy.applies(context, analysis)).toBe(true);
  });

  it('should apply to login intent', () => {
    const context = createContext();
    const analysis = createAnalysis({ intent: 'login' });

    expect(strategy.applies(context, analysis)).toBe(true);
  });

  it('should not apply to generic actions', () => {
    const context = createContext();
    const analysis = createAnalysis({ intent: 'generic_action' });

    expect(strategy.applies(context, analysis)).toBe(false);
  });

  it('should generate assertion for success message', async () => {
    const context = createContext();
    const analysis = createAnalysis({
      intent: 'login',
      changes: [
        {
          type: 'appeared',
          region: { x: 0, y: 0, width: 100, height: 50 },
          description: '登录成功，欢迎回来',
          confidence: 0.9,
        },
      ],
    });

    const recommendations = await strategy.generate(context, analysis);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].type).toBe('text_contains');
    expect(recommendations[0].description).toContain('成功');
  });
});

describe('NavigationStrategy', () => {
  const strategy = new NavigationStrategy();

  it('should apply when URL changes', () => {
    const context = createContext({
      pageState: {
        beforeUrl: 'https://example.com/login',
        afterUrl: 'https://example.com/dashboard',
        visibleChanges: [],
      },
    });
    const analysis = createAnalysis();

    expect(strategy.applies(context, analysis)).toBe(true);
  });

  it('should not apply when URL is the same', () => {
    const context = createContext();
    const analysis = createAnalysis();

    expect(strategy.applies(context, analysis)).toBe(false);
  });

  it('should generate URL assertion', async () => {
    const context = createContext({
      pageState: {
        beforeUrl: 'https://example.com/login',
        afterUrl: 'https://example.com/dashboard',
        visibleChanges: [],
      },
    });
    const analysis = createAnalysis();

    const recommendations = await strategy.generate(context, analysis);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].type).toBe('url_contains');
    expect(recommendations[0].parameters.expectedValue).toBe('/dashboard');
  });
});

describe('StateChangeStrategy', () => {
  const strategy = new StateChangeStrategy();

  it('should apply when there are modifications', () => {
    const context = createContext();
    const analysis = createAnalysis({
      changes: [
        {
          type: 'modified',
          region: { x: 0, y: 0, width: 100, height: 50 },
          description: '按钮状态变化',
          confidence: 0.8,
        },
      ],
    });

    expect(strategy.applies(context, analysis)).toBe(true);
  });

  it('should not apply without modifications', () => {
    const context = createContext();
    const analysis = createAnalysis({ changes: [] });

    expect(strategy.applies(context, analysis)).toBe(false);
  });

  it('should generate state check assertions', async () => {
    const context = createContext();
    const analysis = createAnalysis({
      changes: [
        {
          type: 'modified',
          region: { x: 0, y: 0, width: 100, height: 50 },
          description: '切换开关',
          confidence: 0.8,
        },
      ],
    });

    const recommendations = await strategy.generate(context, analysis);

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].type).toBe('state_check');
  });
});

describe('ElementVisibilityStrategy', () => {
  const strategy = new ElementVisibilityStrategy();

  it('should apply when new elements appear', () => {
    const context = createContext();
    const analysis = createAnalysis({
      changes: [
        {
          type: 'appeared',
          region: { x: 0, y: 0, width: 100, height: 50 },
          description: '新元素',
          confidence: 0.7,
        },
      ],
    });

    expect(strategy.applies(context, analysis)).toBe(true);
  });

  it('should not apply for low confidence changes', () => {
    const context = createContext();
    const analysis = createAnalysis({
      changes: [
        {
          type: 'appeared',
          region: { x: 0, y: 0, width: 100, height: 50 },
          description: '新元素',
          confidence: 0.3,
        },
      ],
    });

    expect(strategy.applies(context, analysis)).toBe(false);
  });
});

describe('DataValidationStrategy', () => {
  const strategy = new DataValidationStrategy();

  it('should apply to add_to_cart intent', () => {
    const context = createContext();
    const analysis = createAnalysis({ intent: 'add_to_cart' });

    expect(strategy.applies(context, analysis)).toBe(true);
  });

  it('should apply to delete_item intent', () => {
    const context = createContext();
    const analysis = createAnalysis({ intent: 'delete_item' });

    expect(strategy.applies(context, analysis)).toBe(true);
  });

  it('should generate cart count assertion', async () => {
    const context = createContext();
    const analysis = createAnalysis({ intent: 'add_to_cart' });

    const recommendations = await strategy.generate(context, analysis);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].type).toBe('count_equals');
  });
});

describe('ErrorPreventionStrategy', () => {
  const strategy = new ErrorPreventionStrategy();

  it('should apply to login intent', () => {
    const context = createContext();
    const analysis = createAnalysis({ intent: 'login' });

    expect(strategy.applies(context, analysis)).toBe(true);
  });

  it('should apply to checkout intent', () => {
    const context = createContext();
    const analysis = createAnalysis({ intent: 'checkout' });

    expect(strategy.applies(context, analysis)).toBe(true);
  });

  it('should detect error messages', async () => {
    const context = createContext();
    const analysis = createAnalysis({
      intent: 'login',
      changes: [
        {
          type: 'appeared',
          region: { x: 0, y: 0, width: 200, height: 30 },
          description: '用户名或密码错误',
          confidence: 0.9,
        },
      ],
    });

    const recommendations = await strategy.generate(context, analysis);

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].description).toContain('错误');
  });
});

describe('getStrategiesByPriority', () => {
  it('should return strategies sorted by priority', () => {
    const strategies = getStrategiesByPriority();

    for (let i = 1; i < strategies.length; i++) {
      expect(strategies[i - 1].priority).toBeGreaterThanOrEqual(
        strategies[i].priority
      );
    }
  });
});

describe('YAML format consistency', () => {
  const allStrategies = [
    new SuccessMessageStrategy(),
    new NavigationStrategy(),
    new StateChangeStrategy(),
    new ElementVisibilityStrategy(),
    new DataValidationStrategy(),
    new ErrorPreventionStrategy(),
  ];

  it('should use unified "ai" format instead of "aiAssert"', async () => {
    // Test SuccessMessageStrategy
    const successContext = createContext();
    const successAnalysis = createAnalysis({
      intent: 'login',
      changes: [
        {
          type: 'appeared',
          region: { x: 0, y: 0, width: 100, height: 50 },
          description: '登录成功',
          confidence: 0.9,
        },
      ],
    });
    const successRecs = await allStrategies[0].generate(successContext, successAnalysis);
    for (const rec of successRecs) {
      expect(rec.yamlOutput).toMatch(/^- ai:/);
      expect(rec.yamlOutput).not.toContain('aiAssert');
    }

    // Test NavigationStrategy
    const navContext = createContext({
      pageState: {
        beforeUrl: 'https://example.com/login',
        afterUrl: 'https://example.com/dashboard',
        visibleChanges: [],
      },
    });
    const navAnalysis = createAnalysis();
    const navRecs = await allStrategies[1].generate(navContext, navAnalysis);
    for (const rec of navRecs) {
      expect(rec.yamlOutput).toMatch(/^- ai:/);
      expect(rec.yamlOutput).not.toContain('aiAssert');
    }

    // Test StateChangeStrategy
    const stateContext = createContext();
    const stateAnalysis = createAnalysis({
      changes: [
        {
          type: 'modified',
          region: { x: 0, y: 0, width: 100, height: 50 },
          description: '切换开关',
          confidence: 0.8,
        },
      ],
    });
    const stateRecs = await allStrategies[2].generate(stateContext, stateAnalysis);
    for (const rec of stateRecs) {
      expect(rec.yamlOutput).toMatch(/^- ai:/);
      expect(rec.yamlOutput).not.toContain('aiAssert');
    }

    // Test ElementVisibilityStrategy
    const visContext = createContext();
    const visAnalysis = createAnalysis({
      changes: [
        {
          type: 'appeared',
          region: { x: 0, y: 0, width: 100, height: 50 },
          description: '新元素出现',
          confidence: 0.8,
        },
      ],
    });
    const visRecs = await allStrategies[3].generate(visContext, visAnalysis);
    for (const rec of visRecs) {
      expect(rec.yamlOutput).toMatch(/^- ai:/);
      expect(rec.yamlOutput).not.toContain('aiAssert');
    }

    // Test DataValidationStrategy
    const dataContext = createContext();
    const dataAnalysis = createAnalysis({ intent: 'add_to_cart' });
    const dataRecs = await allStrategies[4].generate(dataContext, dataAnalysis);
    for (const rec of dataRecs) {
      expect(rec.yamlOutput).toMatch(/^- ai:/);
      expect(rec.yamlOutput).not.toContain('aiAssert');
    }

    // Test ErrorPreventionStrategy
    const errorContext = createContext();
    const errorAnalysis = createAnalysis({ intent: 'login' });
    const errorRecs = await allStrategies[5].generate(errorContext, errorAnalysis);
    for (const rec of errorRecs) {
      expect(rec.yamlOutput).toMatch(/^- ai:/);
      expect(rec.yamlOutput).not.toContain('aiAssert');
    }
  });

  it('should produce valid YAML syntax', async () => {
    const context = createContext({
      pageState: {
        beforeUrl: 'https://example.com/login',
        afterUrl: 'https://example.com/home',
        visibleChanges: [],
      },
    });
    const analysis = createAnalysis({
      intent: 'login',
      changes: [
        {
          type: 'appeared',
          region: { x: 0, y: 0, width: 100, height: 50 },
          description: '欢迎回来',
          confidence: 0.9,
        },
      ],
    });

    for (const strategy of allStrategies) {
      if (strategy.applies(context, analysis)) {
        const recs = await strategy.generate(context, analysis);
        for (const rec of recs) {
          // Check valid YAML list item format
          expect(rec.yamlOutput).toMatch(/^- \w+:/);
          // Check quotes are properly balanced
          const quoteCount = (rec.yamlOutput.match(/"/g) || []).length;
          expect(quoteCount % 2).toBe(0);
        }
      }
    }
  });
});
