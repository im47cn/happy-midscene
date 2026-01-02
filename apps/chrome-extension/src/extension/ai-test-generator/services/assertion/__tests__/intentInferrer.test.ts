/**
 * Intent Inferrer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntentInferrer } from '../intentInferrer';
import type { ActionContext } from '../../../types/assertion';

describe('IntentInferrer', () => {
  let inferrer: IntentInferrer;

  beforeEach(() => {
    inferrer = new IntentInferrer();
  });

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

  describe('analyze', () => {
    it('should detect login intent', () => {
      const context = createContext({
        semantic: {
          actionIntent: 'login',
          targetSemantics: '登录按钮',
          expectedOutcome: '登录成功',
        },
      });

      const result = inferrer.analyze(context);

      expect(result.intent).toBe('login');
      expect(result.needsAssertion).toBe(true);
      expect(result.assertionTypes).toContain('text_contains');
    });

    it('should detect navigation change', () => {
      const context = createContext({
        pageState: {
          beforeUrl: 'https://example.com/login',
          afterUrl: 'https://example.com/dashboard',
          visibleChanges: [],
        },
      });

      const result = inferrer.analyze(context);

      expect(result.needsAssertion).toBe(true);
      expect(result.assertionTypes).toContain('url_contains');
    });

    it('should detect significant visual changes', () => {
      const context = createContext({
        pageState: {
          beforeUrl: 'https://example.com',
          afterUrl: 'https://example.com',
          visibleChanges: [
            {
              type: 'appeared',
              region: { x: 0, y: 0, width: 100, height: 50 },
              description: '登录成功',
              confidence: 0.9,
            },
          ],
        },
      });

      const result = inferrer.analyze(context);

      expect(result.needsAssertion).toBe(true);
      expect(result.changes).toHaveLength(1);
    });

    it('should not require assertion for low-value intents without changes', () => {
      const context = createContext({
        semantic: {
          actionIntent: 'generic_action',
          targetSemantics: '普通按钮',
          expectedOutcome: '操作成功',
        },
        pageState: {
          beforeUrl: 'https://example.com',
          afterUrl: 'https://example.com',
          visibleChanges: [],
        },
      });

      const result = inferrer.analyze(context);

      expect(result.needsAssertion).toBe(false);
    });
  });

  describe('isHighValueIntent', () => {
    it('should identify high-value intents', () => {
      expect(inferrer.isHighValueIntent('login')).toBe(true);
      expect(inferrer.isHighValueIntent('logout')).toBe(true);
      expect(inferrer.isHighValueIntent('submit_form')).toBe(true);
      expect(inferrer.isHighValueIntent('delete_item')).toBe(true);
    });

    it('should not identify low-value intents as high-value', () => {
      expect(inferrer.isHighValueIntent('scroll')).toBe(false);
      expect(inferrer.isHighValueIntent('generic_action')).toBe(false);
    });
  });

  describe('getSuggestedAssertionTypes', () => {
    it('should return suggested types for login', () => {
      const types = inferrer.getSuggestedAssertionTypes('login');
      expect(types).toContain('text_contains');
      expect(types).toContain('url_contains');
    });

    it('should return default types for unknown intent', () => {
      const types = inferrer.getSuggestedAssertionTypes('unknown_intent');
      expect(types).toContain('element_visible');
    });
  });

  describe('inferExpectedOutcome', () => {
    it('should return correct outcome for login', () => {
      expect(inferrer.inferExpectedOutcome('login')).toBe('登录成功');
    });

    it('should return correct outcome for delete', () => {
      expect(inferrer.inferExpectedOutcome('delete_item')).toBe('删除成功');
    });

    it('should return default for unknown intent', () => {
      expect(inferrer.inferExpectedOutcome('unknown')).toBe('操作成功');
    });
  });
});
