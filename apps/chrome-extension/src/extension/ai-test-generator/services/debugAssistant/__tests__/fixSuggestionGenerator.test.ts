/**
 * Unit tests for Fix Suggestion Generator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FixSuggestionGenerator,
  getFixSuggestionGenerator,
  resetFixSuggestionGenerator,
} from '../fixSuggestionGenerator';
import { KnowledgeBase } from '../knowledgeBase';
import type { DebugContext } from '../../../types/debugAssistant';

describe('FixSuggestionGenerator', () => {
  let generator: FixSuggestionGenerator;
  let mockKnowledgeBase: KnowledgeBase;

  beforeEach(() => {
    vi.clearAllMocks();
    resetFixSuggestionGenerator();

    // Create a mock knowledge base
    mockKnowledgeBase = {
      addEntry: vi.fn(),
      findMatchingPatterns: vi.fn(() => []),
      updateSuccessRate: vi.fn(),
      getEntry: vi.fn(),
      findByTags: vi.fn(() => []),
      getBySuccessRate: vi.fn(() => []),
      getRecentEntries: vi.fn(() => []),
      getStats: vi.fn(() => ({
        totalEntries: 0,
        totalFixes: 0,
        averageSuccessRate: 0,
        mostCommonPatterns: [],
      })),
      clear: vi.fn(),
      export: vi.fn(() => '[]'),
      import: vi.fn(),
    } as unknown as KnowledgeBase;

    generator = getFixSuggestionGenerator({
      knowledgeBase: mockKnowledgeBase,
      maxSuggestions: 5,
      minConfidence: 0.3,
    });
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions for element not found error', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        pageState: { url: 'https://example.com', title: 'Test Page' },
        lastError: {
          type: 'element_not_found',
          message: 'Cannot find element: submit button',
          stack: '',
        },
      };

      const suggestions = await generator.generateSuggestions(context);

      expect(suggestions.length).toBeGreaterThan(0);
      // Wait has highest confidence (0.85) for element_not_found
      const waitFix = suggestions.find((s) => s.type === 'wait');
      expect(waitFix).toBeDefined();
      expect(waitFix?.confidence).toBeGreaterThan(0);
    });

    it('should generate suggestions for timeout error', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        pageState: { url: 'https://example.com', title: 'Test Page' },
        lastError: {
          type: 'timeout',
          message: 'Timeout waiting for element',
          stack: '',
        },
      };

      const suggestions = await generator.generateSuggestions(context);

      expect(suggestions.length).toBeGreaterThan(0);
      // Should have both timeout and wait fixes for timeout errors
      const timeoutFix = suggestions.find((s) => s.type === 'timeout');
      const waitFix = suggestions.find((s) => s.type === 'wait');
      expect(timeoutFix).toBeDefined();
      expect(waitFix).toBeDefined();
    });

    it('should generate suggestions for assertion failure', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        pageState: { url: 'https://example.com', title: 'Test Page' },
        lastError: {
          type: 'assertion_failed',
          message: 'Assertion failed: expected true but got false',
          stack: '',
        },
      };

      const suggestions = await generator.generateSuggestions(context);

      expect(suggestions.length).toBeGreaterThan(0);
      const assertFix = suggestions.find((s) => s.type === 'assertion');
      expect(assertFix).toBeDefined();
    });

    it('should generate suggestions for network error', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        pageState: { url: 'https://example.com', title: 'Test Page' },
        lastError: {
          type: 'network_error',
          message: 'Network request failed',
          stack: '',
        },
      };

      const suggestions = await generator.generateSuggestions(context);

      expect(suggestions.length).toBeGreaterThan(0);
      const retryFix = suggestions.find((s) => s.type === 'retry');
      expect(retryFix).toBeDefined();
    });

    it('should include knowledge base matches', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        pageState: { url: 'https://example.com', title: 'Test Page' },
        lastError: {
          type: 'element_not_found',
          message: 'Element not found',
          stack: '',
        },
      };

      (mockKnowledgeBase.findMatchingPatterns as any).mockReturnValue([
        {
          id: 'kb-1',
          pattern: 'element not found',
          fixes: [
            {
              type: 'wait',
              description: 'Wait from KB',
              code: 'await wait()',
              confidence: 0.9,
            },
          ],
        },
      ]);

      const suggestions = await generator.generateSuggestions(context);

      expect(mockKnowledgeBase.findMatchingPatterns).toHaveBeenCalled();
      // Should have KB match with reduced confidence
      const kbSuggestion = suggestions.find((s) => s.description === 'Wait from KB');
      expect(kbSuggestion?.confidence).toBeLessThan(0.9);
    });

    it('should respect max suggestions limit', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        pageState: { url: 'https://example.com', title: 'Test Page' },
        lastError: {
          type: 'element_not_found',
          message: 'Element not found',
          stack: '',
        },
      };

      const suggestions = await generator.generateSuggestions(context);

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should filter by minimum confidence', async () => {
      const lowConfidenceGenerator = new FixSuggestionGenerator({
        minConfidence: 0.8,
      });

      const context: DebugContext = {
        screenshot: 'base64img',
        pageState: { url: 'https://example.com', title: 'Test Page' },
        lastError: {
          type: 'timeout',
          message: 'Operation timed out',
          stack: '',
        },
      };

      const suggestions = await lowConfidenceGenerator.generateSuggestions(context);

      // All suggestions should meet minimum confidence
      // timeout error generates: timeout(0.75), wait(0.8)
      // with minConfidence 0.8, only wait(0.8) should be included
      suggestions.forEach((s) => {
        expect(s.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should generate contextual suggestions for unloaded page', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        pageState: {
          url: 'about:blank',
          title: '',
        },
        lastError: {
          type: 'element_not_found',
          message: 'Element not found',
          stack: '',
        },
      };

      const suggestions = await generator.generateSuggestions(context);

      const navFix = suggestions.find((s) => s.type === 'navigation');
      expect(navFix).toBeDefined();
      expect(navFix?.description).toContain('页面未加载');
    });

    it('should generate auth suggestions for 401 errors', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        pageState: {
          url: 'https://example.com',
          title: 'Test',
        },
        consoleErrors: ['Request failed with status 401'],
        lastError: {
          type: 'network_error',
          message: 'Request failed',
          stack: '',
        },
      };

      const suggestions = await generator.generateSuggestions(context);

      const authFix = suggestions.find((s) => s.type === 'auth');
      expect(authFix).toBeDefined();
      expect(authFix?.description).toContain('登录');
    });
  });

  describe('analyzeFailure', () => {
    it('should detect element not found type', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        lastError: {
          type: 'element_not_found',
          message: '找不到元素',
          stack: '',
        },
      };

      const analysis = generator.analyzeFailure(context);

      expect(analysis.type).toBe('element_not_found');
      expect(analysis.severity).toBe('high');
      expect(analysis.likelyCauses.length).toBeGreaterThan(0);
      expect(analysis.suggestedFixes.length).toBeGreaterThan(0);
    });

    it('should detect timeout type', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        lastError: {
          type: 'timeout',
          message: '操作超时',
          stack: '',
        },
      };

      const analysis = generator.analyzeFailure(context);

      expect(analysis.type).toBe('timeout');
      expect(analysis.severity).toBe('high');
    });

    it('should detect stale element type', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        lastError: {
          type: 'stale_element',
          message: 'stale element reference',
          stack: '',
        },
      };

      const analysis = generator.analyzeFailure(context);

      expect(analysis.type).toBe('stale_element');
      expect(analysis.severity).toBe('medium');
    });

    it('should detect click intercepted type', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        lastError: {
          type: 'click_intercepted',
          message: 'element click intercepted',
          stack: '',
        },
      };

      const analysis = generator.analyzeFailure(context);

      expect(analysis.type).toBe('click_intercepted');
      expect(analysis.severity).toBe('medium');
    });

    it('should return unknown type for unrecognized errors', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        lastError: {
          type: 'unknown',
          message: 'something went wrong',
          stack: '',
        },
      };

      const analysis = generator.analyzeFailure(context);

      expect(analysis.type).toBe('unknown');
      expect(analysis.severity).toBe('medium');
    });

    it('should use provided error message', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const analysis = generator.analyzeFailure(context, 'element not found');

      expect(analysis.type).toBe('element_not_found');
    });

    it('should prioritize context error message over parameter', () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        lastError: {
          type: 'timeout',
          message: 'timeout from context',
          stack: '',
        },
      };

      const analysis = generator.analyzeFailure(context, 'element not found');

      expect(analysis.type).toBe('timeout');
    });
  });

  describe('learnFromSuccess', () => {
    it('should add successful fix to knowledge base', async () => {
      const context: DebugContext = {
        screenshot: 'base64img',
        failedStep: 'Click submit button',
        lastError: {
          type: 'element_not_found',
          message: 'Cannot find element',
          stack: '',
        },
      };

      const fix = {
        type: 'wait' as const,
        description: 'Wait for element',
        code: 'await wait()',
        confidence: 0.9,
      };

      await generator.learnFromSuccess(context, fix, 'Cannot find element: submit');

      expect(mockKnowledgeBase.addEntry).toHaveBeenCalled();
      const entry = (mockKnowledgeBase.addEntry as any).mock.calls[0][0];
      expect(entry.fixes).toHaveLength(1);
      expect(entry.successRate).toBe(1.0);
    });

    it('should not add to knowledge base if none set', async () => {
      const noKbGenerator = new FixSuggestionGenerator({ knowledgeBase: undefined });

      const context: DebugContext = {
        screenshot: 'base64img',
      };

      const fix = {
        type: 'wait' as const,
        description: 'Wait',
        code: 'await wait()',
        confidence: 0.9,
      };

      // Should not throw
      await noKbGenerator.learnFromSuccess(context, fix, 'error');
    });
  });

  describe('getCommonFixes', () => {
    it('should return common fixes for element_not_found', () => {
      const fixes = generator.getCommonFixes('element_not_found');

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes[0].type).toBe('wait');
    });

    it('should return common fixes for timeout', () => {
      const fixes = generator.getCommonFixes('timeout');

      expect(fixes.length).toBeGreaterThan(0);
      expect(fixes.some((f) => f.type === 'timeout')).toBe(true);
    });

    it('should return common fixes for click_intercepted', () => {
      const fixes = generator.getCommonFixes('click_intercepted');

      expect(fixes.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown error type', () => {
      const fixes = generator.getCommonFixes('unknown_type');

      expect(fixes).toEqual([]);
    });
  });

  describe('setKnowledgeBase', () => {
    it('should update knowledge base reference', () => {
      const newKb = {} as KnowledgeBase;

      generator.setKnowledgeBase(newKb);

      expect((generator as any).knowledgeBase).toBe(newKb);
    });
  });

  describe('pattern matching', () => {
    it('should match various element not found patterns', () => {
      const patterns = [
        '找不到元素',
        'element not found',
        '无法定位',
        'cannot find element',
        'no element located',
        'timeout waiting for element',
      ];

      patterns.forEach((pattern) => {
        const context: DebugContext = {
          screenshot: 'base64img',
          lastError: { type: 'element_not_found', message: pattern, stack: '' },
        };
        const analysis = generator.analyzeFailure(context);
        expect(analysis.type).toBe('element_not_found');
      });
    });

    it('should match various timeout patterns', () => {
      const patterns = ['超时', 'timeout', 'timed out', '等待超时'];

      patterns.forEach((pattern) => {
        const context: DebugContext = {
          screenshot: 'base64img',
          lastError: { type: 'timeout', message: pattern, stack: '' },
        };
        const analysis = generator.analyzeFailure(context);
        expect(analysis.type).toBe('timeout');
      });
    });

    it('should match various assertion patterns', () => {
      const patterns = [
        '断言失败',
        'assertion failed',
        '期望',
        'expected',
        '实际',
        'actual',
      ];

      patterns.forEach((pattern) => {
        const context: DebugContext = {
          screenshot: 'base64img',
          lastError: { type: 'assertion_failed', message: pattern, stack: '' },
        };
        const analysis = generator.analyzeFailure(context);
        expect(analysis.type).toBe('assertion_failed');
      });
    });
  });
});
