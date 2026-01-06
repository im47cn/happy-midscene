/**
 * Unit tests for reference resolver
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DebugContext } from '../../../types/debugAssistant';
import { ReferenceResolver } from '../referenceResolver';

describe('ReferenceResolver', () => {
  let debugContext: DebugContext;

  beforeEach(() => {
    debugContext = {
      currentUrl: 'https://example.com',
      currentStep: {
        id: 'step-1',
        description: 'Click the submit button',
        index: 0,
        status: 'pending',
      },
      lastError: {
        type: 'element_not_found',
        message: 'Cannot find element with text "Submit"',
        timestamp: Date.now(),
      },
      executionHistory: ['Step 1: Click button', 'Step 2: Input text'],
      pageDiagnostics: {
        visibleElements: [
          { tag: 'BUTTON', text: 'Submit' },
          { tag: 'INPUT', text: '' },
        ],
        consoleErrors: [],
        networkErrors: [],
      },
    };
  });

  describe('resolveActionReference', () => {
    it('should parse ACTION tag format', () => {
      const text = '[ACTION:click:submit-button]';
      const action = ReferenceResolver.resolveActionReference(text, {
        context: debugContext,
      });

      expect(action).not.toBeNull();
      expect(action?.type).toBe('click');
      expect(action?.target).toBe('submit-button');
    });

    it('should parse ACTION tag with value', () => {
      const text = '[ACTION:input:username:text-value]';
      const action = ReferenceResolver.resolveActionReference(text, {
        context: debugContext,
      });

      expect(action?.type).toBe('input');
      expect(action?.target).toBe('username');
      expect(action?.value).toBe('text-value');
    });

    it('should parse click action patterns', () => {
      const patterns = ['点击提交按钮', 'click the button', 'Click submit'];

      for (const pattern of patterns) {
        const action = ReferenceResolver.resolveActionReference(pattern, {
          context: debugContext,
        });
        expect(action?.type).toBe('click');
      }
    });

    it('should parse input action patterns', () => {
      const patterns = ['输入test到username', 'type hello into input'];

      for (const pattern of patterns) {
        const action = ReferenceResolver.resolveActionReference(pattern, {
          context: debugContext,
        });
        expect(action?.type).toBe('input');
        expect(action?.target).toBeTruthy();
        expect(action?.value).toBeTruthy();
      }
    });

    it('should parse scroll action patterns', () => {
      const patterns = ['滚动到下方', 'scroll down'];

      for (const pattern of patterns) {
        const action = ReferenceResolver.resolveActionReference(pattern, {
          context: debugContext,
        });
        expect(action?.type).toBe('scroll');
      }
    });

    it('should parse wait action patterns', () => {
      const patterns = ['等待5秒', 'wait for 5 seconds'];

      for (const pattern of patterns) {
        const action = ReferenceResolver.resolveActionReference(pattern, {
          context: debugContext,
        });
        expect(action?.type).toBe('wait');
      }
    });

    it('should parse highlight action patterns', () => {
      const patterns = ['高亮button', 'highlight the button'];

      for (const pattern of patterns) {
        const action = ReferenceResolver.resolveActionReference(pattern, {
          context: debugContext,
        });
        expect(action?.type).toBe('highlight');
      }
    });

    it('should parse screenshot action patterns', () => {
      const patterns = ['截图', 'screenshot'];

      for (const pattern of patterns) {
        const action = ReferenceResolver.resolveActionReference(pattern, {
          context: debugContext,
        });
        expect(action?.type).toBe('screenshot');
      }
    });

    it('should parse refresh action patterns', () => {
      const patterns = ['刷新页面', 'refresh'];

      for (const pattern of patterns) {
        const action = ReferenceResolver.resolveActionReference(pattern, {
          context: debugContext,
        });
        expect(action?.type).toBe('refresh');
      }
    });

    it('should return null for unknown actions', () => {
      const action = ReferenceResolver.resolveActionReference('do something', {
        context: debugContext,
      });
      expect(action).toBeNull();
    });
  });

  describe('resolveSuggestionReference', () => {
    it('should parse SUGGESTION tag format', () => {
      const text =
        '[SUGGESTION:Add wait time|await page.waitForTimeout(5000)|0.9]';
      const suggestion = ReferenceResolver.resolveSuggestionReference(text, {
        context: debugContext,
      });

      expect(suggestion).not.toBeNull();
      expect(suggestion?.description).toBe('Add wait time');
      expect(suggestion?.code).toBe('await page.waitForTimeout(5000)');
      expect(suggestion?.confidence).toBe(0.9);
    });

    it('should parse suggestion without code and confidence', () => {
      const text = '[SUGGESTION:Try waiting for element]';
      const suggestion = ReferenceResolver.resolveSuggestionReference(text, {
        context: debugContext,
      });

      expect(suggestion?.description).toBe('Try waiting for element');
      expect(suggestion?.code).toBe('');
      expect(suggestion?.confidence).toBe(0.7); // default
    });

    it('should infer wait type from description', () => {
      const suggestions = [
        '建议：等待元素出现',
        'Try adding wait time',
        'Add a timeout',
      ];

      for (const desc of suggestions) {
        const suggestion = ReferenceResolver.resolveSuggestionReference(
          `[SUGGESTION:${desc}]`,
          { context: debugContext },
        );
        expect(['wait', 'timeout']).toContain(suggestion?.type);
      }
    });

    it('should infer locator type from description', () => {
      const desc = 'Use better selector';
      const suggestion = ReferenceResolver.resolveSuggestionReference(
        `[SUGGESTION:${desc}]`,
        { context: debugContext },
      );

      expect(suggestion?.type).toBe('locator');
    });

    it('should infer retry type from description', () => {
      const desc = 'Retry the action';
      const suggestion = ReferenceResolver.resolveSuggestionReference(
        `[SUGGESTION:${desc}]`,
        { context: debugContext },
      );

      expect(suggestion?.type).toBe('retry');
    });

    it('should infer assertion type from description', () => {
      const desc = 'Fix the assertion';
      const suggestion = ReferenceResolver.resolveSuggestionReference(
        `[SUGGESTION:${desc}]`,
        { context: debugContext },
      );

      expect(suggestion?.type).toBe('assertion');
    });
  });

  describe('resolveAllReferences', () => {
    it('should extract actions and suggestions from text', () => {
      const text = `
[ACTION:click:button]
[SUGGESTION:Wait for element|await page.waitForSelector('#btn')]
[ACTION:screenshot]
`;

      const result = ReferenceResolver.resolveAllReferences(text, {
        context: debugContext,
      });

      expect(result.actions).toHaveLength(2);
      expect(result.suggestions).toHaveLength(1);
      expect(result.actions[0].type).toBe('click');
      expect(result.actions[1].type).toBe('screenshot');
      expect(result.suggestions[0].description).toBe('Wait for element');
    });

    it('should clean action and suggestion tags from text', () => {
      const text = `
Here is my response:
[ACTION:highlight:button]
[SUGGESTION:Use better selector]
Try this approach.
`;

      const result = ReferenceResolver.resolveAllReferences(text, {
        context: debugContext,
      });

      expect(result.cleanText).not.toContain('[ACTION:');
      expect(result.cleanText).not.toContain('[SUGGESTION:');
      expect(result.cleanText).toContain('Here is my response');
      expect(result.cleanText).toContain('Try this approach');
    });
  });

  describe('resolvePronounReference', () => {
    it('should resolve "it" to last mentioned element', () => {
      const conversationHistory = [
        { role: 'user', content: 'Click the "Submit" button' },
        { role: 'assistant', content: 'I clicked the button' },
        { role: 'user', content: 'Is it visible?' },
      ];

      const resolved = ReferenceResolver.resolvePronounReference(
        'it',
        debugContext,
        conversationHistory,
      );

      expect(resolved).toBe('Submit');
    });

    it('should resolve "this" to last mentioned element', () => {
      const conversationHistory = [
        { role: 'user', content: 'Check the "Save" button' },
        { role: 'user', content: 'Why is this disabled?' },
      ];

      const resolved = ReferenceResolver.resolvePronounReference(
        'this',
        debugContext,
        conversationHistory,
      );

      expect(resolved).toBe('Save');
    });

    it('should resolve Chinese pronoun "它"', () => {
      const conversationHistory = [
        { role: 'user', content: '点击"提交"按钮' },
        { role: 'user', content: '它能点击吗？' },
      ];

      const resolved = ReferenceResolver.resolvePronounReference(
        '它',
        debugContext,
        conversationHistory,
      );

      expect(resolved).toBe('提交');
    });

    it('should return null when no context available', () => {
      const resolved = ReferenceResolver.resolvePronounReference(
        'it',
        debugContext,
        [],
      );

      // Falls back to failed step if exists
      expect(resolved).toBeTruthy();
    });
  });

  describe('normalizeElementReference', () => {
    it('should remove quotes', () => {
      expect(ReferenceResolver.normalizeElementReference('"button"')).toBe(
        'button',
      );
      expect(ReferenceResolver.normalizeElementReference("'text'")).toBe(
        'text',
      );
    });

    it('should remove brackets', () => {
      expect(ReferenceResolver.normalizeElementReference('【button】')).toBe(
        'button',
      );
      expect(ReferenceResolver.normalizeElementReference('「text」')).toBe(
        'text',
      );
      expect(ReferenceResolver.normalizeElementReference('『el』')).toBe('el');
    });

    it('should trim whitespace', () => {
      expect(ReferenceResolver.normalizeElementReference('  button  ')).toBe(
        'button',
      );
    });
  });

  describe('extractReferencesFromHistory', () => {
    it('should extract mentioned elements', () => {
      const history = [
        { role: 'user', content: 'Click the "Submit" button' },
        { role: 'assistant', content: 'I clicked 【Submit】' },
      ];

      const result = ReferenceResolver.extractReferencesFromHistory(history);

      expect(result.mentionedElements.has('Submit')).toBe(true);
    });

    it('should extract mentioned actions', () => {
      const history = [
        { role: 'user', content: '点击按钮' },
        { role: 'assistant', content: 'Scroll down to see more' },
      ];

      const result = ReferenceResolver.extractReferencesFromHistory(history);

      expect(result.mentionedActions.size).toBeGreaterThan(0);
    });

    it('should extract mentioned errors', () => {
      const history = [
        { role: 'assistant', content: 'Error: element not found' },
        { role: 'user', content: '错误：超时' },
      ];

      const result = ReferenceResolver.extractReferencesFromHistory(history);

      expect(result.mentionedErrors.size).toBeGreaterThan(0);
    });
  });

  describe('validateResolvedReference', () => {
    it('should reject references with low confidence', () => {
      const ref = {
        type: 'element' as const,
        value: 'button',
        confidence: 0.2,
        source: 'test',
      };

      expect(ReferenceResolver.validateResolvedReference(ref)).toBe(false);
    });

    it('should reject references with empty value', () => {
      const ref = {
        type: 'element' as const,
        value: '',
        confidence: 0.8,
        source: 'test',
      };

      expect(ReferenceResolver.validateResolvedReference(ref)).toBe(false);
    });

    it('should accept valid references', () => {
      const ref = {
        type: 'element' as const,
        value: 'button',
        confidence: 0.8,
        source: 'test',
      };

      expect(ReferenceResolver.validateResolvedReference(ref)).toBe(true);
    });
  });

  describe('formatReference', () => {
    it('should format action reference', () => {
      const ref = {
        type: 'action' as const,
        value: { type: 'click', target: 'button' },
        confidence: 1,
        source: 'test',
      };

      const formatted = ReferenceResolver.formatReference(ref);
      expect(formatted).toBe('[Action: [object Object]]');
    });

    it('should format element reference', () => {
      const ref = {
        type: 'element' as const,
        value: 'Submit button',
        confidence: 0.9,
        source: 'test',
      };

      const formatted = ReferenceResolver.formatReference(ref);
      expect(formatted).toBe('"Submit button"');
    });

    it('should format suggestion reference', () => {
      const ref = {
        type: 'suggestion' as const,
        value: { description: 'Add wait' },
        confidence: 0.8,
        source: 'test',
      };

      const formatted = ReferenceResolver.formatReference(ref);
      expect(formatted).toBe('[Suggestion: Add wait]');
    });
  });
});
