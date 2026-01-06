/**
 * Unit tests for Context Builder
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DebugContext, Message } from '../../../types/debugAssistant';
import { getContextBuilder, resetContextBuilder } from '../contextBuilder';

describe('ContextBuilder', () => {
  let debugContext: DebugContext;
  let conversationHistory: Message[];

  beforeEach(() => {
    resetContextBuilder();

    // Setup test context
    debugContext = {
      screenshot: 'base64screenshotdata',
      pageState: {
        url: 'https://example.com/test',
        title: 'Test Page',
      },
      lastError: {
        type: 'element_not_found',
        message: 'Cannot find element: submit button',
        stack: 'Error: Cannot find element\n    at test.ts:10',
      },
      currentStep: {
        description: 'Click submit button',
        index: 5,
      },
      consoleErrors: [
        'Error: Network request failed',
        'Warning: Deprecated API',
      ],
      networkErrors: [
        {
          url: 'https://api.example.com/data',
          status: 500,
          error: 'Internal Server Error',
        },
      ],
      executionHistory: [
        'Step 1: Navigate to page',
        'Step 2: Enter username',
        'Step 3: Enter password',
        'Step 4: Click login',
        'Step 5: Click submit - FAILED',
      ],
      failedStep: 'Click submit button',
    };

    conversationHistory = [
      {
        role: 'user',
        content: 'Why did the test fail?',
        timestamp: Date.now(),
      },
      {
        role: 'assistant',
        content:
          'The test failed because the submit button could not be found.',
        timestamp: Date.now(),
      },
    ];
  });

  describe('build', () => {
    it('should build complete LLM context', () => {
      const contextBuilder = getContextBuilder();
      const context = contextBuilder.build(
        debugContext,
        conversationHistory,
        'Tell me more about this error',
      );

      expect(context).toBeDefined();
      expect(context.systemPrompt).toBeTruthy();
      expect(context.conversationHistory).toEqual(conversationHistory);
      expect(context.images).toContain('base64screenshotdata');
    });

    it('should include system prompt in Chinese', () => {
      const contextBuilder = getContextBuilder();
      const context = contextBuilder.build(
        debugContext,
        conversationHistory,
        '',
      );

      expect(context.systemPrompt).toContain('Midscene');
      expect(context.systemPrompt).toContain('调试助手');
    });

    it('should limit conversation history', () => {
      const contextBuilder = getContextBuilder();

      // Create more than 10 messages
      const longHistory: Message[] = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: Date.now(),
      }));

      const context = contextBuilder.build(debugContext, longHistory, '');

      // Should have last 10 messages
      expect(context.conversationHistory.length).toBeLessThanOrEqual(10);
    });

    it('should include current screenshot and previous screenshots', () => {
      const contextBuilder = getContextBuilder();
      const context = contextBuilder.build(
        debugContext,
        conversationHistory,
        '',
      );

      expect(context.images).toBeDefined();
      expect(context.images.length).toBeGreaterThan(0);
    });

    it('should inject console errors when question asks about errors', () => {
      const contextBuilder = getContextBuilder();
      const context = contextBuilder.build(
        debugContext,
        conversationHistory,
        'What are the console errors?',
      );

      expect(context.systemPrompt).toContain('consoleErrors');
    });

    it('should inject network errors when question asks about network', () => {
      const contextBuilder = getContextBuilder();
      const context = contextBuilder.build(
        debugContext,
        conversationHistory,
        'Are there network issues?',
      );

      expect(context.systemPrompt).toContain('networkErrors');
    });

    it('should inject visible elements when question asks about elements', () => {
      const contextBuilder = getContextBuilder();
      const contextWithElements: DebugContext = {
        ...debugContext,
        visibleElements: [
          {
            text: 'Submit',
            selector: 'button[type="submit"]',
            visible: true,
            rect: {
              left: 100,
              top: 200,
              width: 80,
              height: 30,
              right: 180,
              bottom: 230,
            },
          },
        ],
      };
      const context = contextBuilder.build(
        contextWithElements,
        conversationHistory,
        'What elements are visible?',
      );

      expect(context.systemPrompt).toContain('visibleElements');
    });

    it('should inject execution history when question asks about history', () => {
      const contextBuilder = getContextBuilder();
      const context = contextBuilder.build(
        debugContext,
        conversationHistory,
        'Show me the execution history',
      );

      expect(context.systemPrompt).toContain('executionHistory');
    });

    it('should handle empty context gracefully', () => {
      const contextBuilder = getContextBuilder();
      const emptyContext: DebugContext = {
        screenshot: '',
      };
      const emptyHistory: Message[] = [];

      const context = contextBuilder.build(emptyContext, emptyHistory, '');

      expect(context).toBeDefined();
      expect(context.systemPrompt).toBeTruthy();
    });

    it('should handle missing optional fields', () => {
      const contextBuilder = getContextBuilder();
      const minimalContext: DebugContext = {
        screenshot: 'base64data',
      };

      const context = contextBuilder.build(minimalContext, [], '');

      expect(context).toBeDefined();
      expect(context.systemPrompt).toBeTruthy();
    });
  });

  describe('formatConsoleErrors', () => {
    it('should format console errors with emoji indicators', () => {
      const contextBuilder = getContextBuilder();
      const context = contextBuilder.build(
        debugContext,
        conversationHistory,
        'console errors',
      );

      expect(context.systemPrompt).toContain('❌');
      expect(context.systemPrompt).toContain('⚠️');
    });

    it('should limit console errors to 10', () => {
      const contextBuilder = getContextBuilder();
      const manyErrors: DebugContext = {
        ...debugContext,
        consoleErrors: Array.from({ length: 15 }, (_, i) => `Error ${i}`),
      };

      const context = contextBuilder.build(
        manyErrors,
        conversationHistory,
        'console errors',
      );

      // Should format at most 10 errors
      const errorMatches = context.systemPrompt.match(/❌/g);
      expect(errorMatches?.length).toBeLessThanOrEqual(10);
    });
  });

  describe('formatNetworkErrors', () => {
    it('should format network errors with details', () => {
      const contextBuilder = getContextBuilder();
      const context = contextBuilder.build(
        debugContext,
        conversationHistory,
        'network errors',
      );

      expect(context.systemPrompt).toContain('500');
      expect(context.systemPrompt).toContain('api.example.com');
    });
  });

  describe('formatVisibleElements', () => {
    it('should format visible elements with coordinates', () => {
      const contextBuilder = getContextBuilder();
      const contextWithElements: DebugContext = {
        ...debugContext,
        visibleElements: [
          {
            text: 'Submit',
            selector: 'button[type="submit"]',
            visible: true,
            rect: {
              left: 100,
              top: 200,
              width: 80,
              height: 30,
              right: 180,
              bottom: 230,
            },
          },
          {
            text: 'Cancel',
            selector: 'button[type="button"]',
            visible: true,
            rect: {
              left: 200,
              top: 200,
              width: 80,
              height: 30,
              right: 280,
              bottom: 230,
            },
          },
        ],
      };

      const context = contextBuilder.build(contextWithElements, [], 'elements');

      expect(context.systemPrompt).toContain('Submit');
      expect(context.systemPrompt).toContain('Cancel');
      expect(context.systemPrompt).toContain('(100, 200)');
    });

    it('should limit visible elements to 20', () => {
      const contextBuilder = getContextBuilder();
      const manyElements: DebugContext = {
        ...debugContext,
        visibleElements: Array.from({ length: 25 }, (_, i) => ({
          text: `Element ${i}`,
          selector: `#elem-${i}`,
          visible: true,
          rect: {
            left: i * 10,
            top: 0,
            width: 50,
            height: 20,
            right: i * 10 + 50,
            bottom: 20,
          },
        })),
      };

      const context = contextBuilder.build(manyElements, [], 'elements');

      // Should format at most 20 elements
      const elemMatches = context.systemPrompt.match(/Element \d+/g);
      expect(elemMatches?.length).toBeLessThanOrEqual(20);
    });
  });

  describe('formatExecutionHistory', () => {
    it('should format execution history with status indicators', () => {
      const contextBuilder = getContextBuilder();
      const context = contextBuilder.build(debugContext, [], 'history');

      expect(context.systemPrompt).toContain('✅');
      expect(context.systemPrompt).toContain('❌');
    });
  });

  describe('configuration', () => {
    it('should accept custom max history size', () => {
      const contextBuilder = getContextBuilder({ maxHistorySize: 5 });
      const longHistory: Message[] = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
        timestamp: Date.now(),
      }));

      const context = contextBuilder.build(debugContext, longHistory, '');

      expect(context.conversationHistory.length).toBeLessThanOrEqual(5);
    });

    it('should accept custom max images', () => {
      const contextBuilder = getContextBuilder({ maxImages: 1 });
      const context = contextBuilder.build(debugContext, [], '');

      expect(context.images.length).toBeLessThanOrEqual(1);
    });

    it('should accept custom include options', () => {
      const contextBuilder = getContextBuilder({
        includeConsoleErrors: false,
        includeNetworkErrors: false,
      });

      const context = contextBuilder.build(debugContext, [], 'any question');

      // Should still build context without errors
      expect(context).toBeDefined();
    });
  });

  describe('buildUserQueryContext', () => {
    it('should detect console error keywords', () => {
      const contextBuilder = getContextBuilder();

      const keywords = ['console', '错误', 'error', '报错'];
      for (const keyword of keywords) {
        const shouldInclude = (contextBuilder as any).shouldIncludeContext(
          keyword,
          'consoleErrors',
        );
        expect(shouldInclude).toBe(true);
      }
    });

    it('should detect network error keywords', () => {
      const contextBuilder = getContextBuilder();

      const keywords = ['network', '网络', '请求', 'request', 'api'];
      for (const keyword of keywords) {
        const shouldInclude = (contextBuilder as any).shouldIncludeContext(
          keyword,
          'networkErrors',
        );
        expect(shouldInclude).toBe(true);
      }
    });

    it('should detect element keywords', () => {
      const contextBuilder = getContextBuilder();

      const keywords = ['element', '元素', 'visible', '可见', 'find', '查找'];
      for (const keyword of keywords) {
        const shouldInclude = (contextBuilder as any).shouldIncludeContext(
          keyword,
          'visibleElements',
        );
        expect(shouldInclude).toBe(true);
      }
    });

    it('should detect history keywords', () => {
      const contextBuilder = getContextBuilder();

      const keywords = [
        'history',
        '历史',
        'execution',
        '执行',
        'steps',
        '步骤',
      ];
      for (const keyword of keywords) {
        const shouldInclude = (contextBuilder as any).shouldIncludeContext(
          keyword,
          'executionHistory',
        );
        expect(shouldInclude).toBe(true);
      }
    });
  });
});
