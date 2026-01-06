/**
 * Unit tests for LLM Engine
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  LLMEngine,
  getLLMEngine,
  resetLLMEngine,
} from '../llmEngine';
import type { LLMContext } from '../../../types/debugAssistant';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLMEngine', () => {
  let llmEngine: LLMEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    resetLLMEngine();
    mockFetch.mockClear();

    llmEngine = getLLMEngine({
      apiKey: 'test-api-key',
      model: 'claude-test',
      maxTokens: 1000,
      temperature: 0.5,
      timeout: 5000,
    });
  });

  afterEach(() => {
    resetLLMEngine();
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const defaultEngine = new LLMEngine();

      expect(defaultEngine).toBeDefined();
      const config = defaultEngine.getConfig();
      expect(config.model).toBe('claude-sonnet-4-20250514');
      expect(config.maxTokens).toBe(4096);
    });

    it('should accept custom options', () => {
      const customEngine = new LLMEngine({
        apiKey: 'custom-key',
        baseURL: 'https://custom.api.com',
        model: 'custom-model',
        maxTokens: 2000,
        temperature: 0.3,
        timeout: 10000,
      });

      const config = customEngine.getConfig();
      expect(config.apiKey).toBe('custom-key');
      expect(config.baseURL).toBe('https://custom.api.com');
      expect(config.model).toBe('custom-model');
      expect(config.maxTokens).toBe(2000);
      expect(config.temperature).toBe(0.3);
      expect(config.timeout).toBe(10000);
    });
  });

  describe('updateConfig', () => {
    it('should update individual config values', () => {
      llmEngine.updateConfig({ model: 'new-model' });

      const config = llmEngine.getConfig();
      expect(config.model).toBe('new-model');
      expect(config.apiKey).toBe('test-api-key'); // Unchanged
    });

    it('should update multiple config values', () => {
      llmEngine.updateConfig({
        model: 'updated-model',
        temperature: 0.8,
        maxTokens: 5000,
      });

      const config = llmEngine.getConfig();
      expect(config.model).toBe('updated-model');
      expect(config.temperature).toBe(0.8);
      expect(config.maxTokens).toBe(5000);
    });

    it('should update API key', () => {
      llmEngine.updateConfig({ apiKey: 'new-key' });

      const config = llmEngine.getConfig();
      expect(config.apiKey).toBe('new-key');
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = llmEngine.getConfig();

      expect(config).toEqual({
        apiKey: 'test-api-key',
        baseURL: 'https://api.anthropic.com/v1/messages',
        model: 'claude-test',
        maxTokens: 1000,
        temperature: 0.5,
        timeout: 5000,
      });
    });
  });

  describe('chat', () => {
    it('should send chat request and return response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Hello! How can I help you?' }],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
          model: 'claude-test',
        }),
      });

      const context: LLMContext = {
        systemPrompt: 'You are a helpful assistant.',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      const response = await llmEngine.chat(context);

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.usage?.promptTokens).toBe(10);
      expect(response.usage?.completionTokens).toBe(20);
      expect(response.usage?.totalTokens).toBe(30);
      expect(response.model).toBe('claude-test');
    });

    it('should include images in request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'I see an image' }],
          usage: { input_tokens: 1500, output_tokens: 10 },
        }),
      });

      const context: LLMContext = {
        systemPrompt: 'You analyze images.',
        conversationHistory: [{ role: 'user', content: 'What is this?' }],
        images: ['base64imagedata', 'base64imagedata2'],
      };

      await llmEngine.chat(context);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Images should be added as separate messages
      const imageMessages = requestBody.messages.filter((m: any) =>
        Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image')
      );
      expect(imageMessages.length).toBe(2);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      await expect(llmEngine.chat(context)).rejects.toThrow('LLM request failed');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      await expect(llmEngine.chat(context)).rejects.toThrow('LLM request failed');
    });

    it('should update conversation history', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      await llmEngine.chat(context);

      const history = llmEngine.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].content).toBe('Response');
    });
  });

  describe('chatStream', () => {
    it('should stream response chunks', async () => {
      // Create a mock readable stream
      const streamChunks = [
        'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"text":" world"}}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamChunks[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamChunks[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamChunks[2]) })
          .mockResolvedValueOnce({ done: true, value: null }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      const chunks = [];
      let accumulatedResult = '';

      for await (const chunk of llmEngine.chatStream(context)) {
        if (!chunk.done && chunk.content) {
          chunks.push(chunk.content);
          accumulatedResult += chunk.content;
        }
      }

      expect(chunks).toContain('Hello');
      expect(chunks).toContain(' world');
      expect(accumulatedResult).toBe('Hello world');
    });

    it('should handle streaming errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      const generator = llmEngine.chatStream(context);

      await expect(generator.next()).rejects.toThrow('LLM stream failed');
    });

    it('should handle invalid stream data', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: invalid json\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
          .mockResolvedValueOnce({ done: true, value: null }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      // Should not throw, just skip invalid JSON
      const chunks = [];
      for await (const chunk of llmEngine.chatStream(context)) {
        if (!chunk.done && chunk.content) {
          chunks.push(chunk.content);
        }
      }

      // Should complete without error
      expect(chunks.length).toBe(0);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for English text', () => {
      const text = 'Hello world, this is a test.';
      const tokens = llmEngine.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      // Roughly 4 chars per token for English (excluding spaces)
      const effectiveChars = text.replace(/\s/g, '').length;
      expect(tokens).toBeCloseTo(effectiveChars / 4, 0);
    });

    it('should estimate tokens for Chinese text', () => {
      const text = '你好世界这是一个测试';
      const tokens = llmEngine.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      // Roughly 2 chars per token for Chinese
      expect(tokens).toBeCloseTo(text.length / 2, 0);
    });

    it('should estimate tokens for mixed text', () => {
      const text = 'Hello 你好 world 世界';
      const tokens = llmEngine.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      // Chinese: 4 chars / 2 = 2 tokens
      // English: 12 chars / 4 = 3 tokens
      expect(tokens).toBeCloseTo(5, 0);
    });

    it('should handle empty string', () => {
      const tokens = llmEngine.estimateTokens('');
      expect(tokens).toBe(0);
    });
  });

  describe('estimateRequestTokens', () => {
    it('should estimate total tokens for request', () => {
      const context: LLMContext = {
        systemPrompt: 'You are a helpful assistant.',
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        additionalContext: {
          consoleErrors: ['Error 1', 'Error 2'],
          networkErrors: [],
          visibleElements: '<div>Button</div>',
          executionHistory: ['Step 1', 'Step 2'],
        },
        images: ['img1', 'img2'],
      };

      const tokens = llmEngine.estimateRequestTokens(context);

      expect(tokens).toBeGreaterThan(0);
      // Should include system prompt, history, additional context, and images
      // Each image is estimated at 1000 tokens
      expect(tokens).toBeGreaterThanOrEqual(2000); // At least 2 images
    });

    it('should handle minimal context', () => {
      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [],
        images: [],
      };

      const tokens = llmEngine.estimateRequestTokens(context);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('wouldExceedLimit', () => {
    it('should return false for small requests', () => {
      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      const exceeds = llmEngine.wouldExceedLimit(context);

      expect(exceeds).toBe(false);
    });

    it('should return true for large requests', () => {
      // Create content that will exceed 90% of 200k limit (180k tokens)
      // With estimateTokens dividing by 4, we need ~720k+ characters
      const largeContent = 'x'.repeat(400000); // ~100k tokens per field

      const context: LLMContext = {
        systemPrompt: largeContent,
        conversationHistory: [{ role: 'user', content: largeContent }],
        images: [],
      };

      const exceeds = llmEngine.wouldExceedLimit(context);

      // ~200k tokens should exceed 90% of 200k limit
      expect(exceeds).toBe(true);
    });

    it('should use custom limit', () => {
      const context: LLMContext = {
        systemPrompt: 'x'.repeat(20000),
        conversationHistory: [],
        images: [],
      };

      const exceeds = llmEngine.wouldExceedLimit(context, 5000);

      expect(exceeds).toBe(true);
    });
  });

  describe('truncateContext', () => {
    it('should keep system prompt intact', () => {
      const context: LLMContext = {
        systemPrompt: 'This is the system prompt that must be preserved.',
        conversationHistory: [
          { role: 'user', content: 'Message 1' },
          { role: 'assistant', content: 'Response 1' },
          { role: 'user', content: 'Message 2' },
        ],
        images: [],
      };

      const truncated = llmEngine.truncateContext(context);

      expect(truncated.systemPrompt).toBe(context.systemPrompt);
    });

    it('should truncate conversation history when needed', () => {
      const largeContext: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: Array.from({ length: 100 }, (_, i) => ({
          role: 'user' as const,
          content: `Message ${i} with some content to make it longer`,
        })),
        images: [],
      };

      const truncated = llmEngine.truncateContext(largeContext, 1000);

      // Should have fewer messages
      expect(truncated.conversationHistory.length).toBeLessThan(largeContext.conversationHistory.length);
    });

    it('should keep most recent messages', () => {
      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [
          { role: 'user', content: 'Old message that should be removed due to token limits' },
          { role: 'user', content: 'Recent message' },
        ],
        images: [],
      };

      // Use a small limit to force truncation (10 tokens = ~40 chars with 90% = 36 chars available)
      const truncated = llmEngine.truncateContext(context, 10);

      // Should keep only the most recent message due to token constraints
      expect(truncated.conversationHistory).toHaveLength(1);
      expect(truncated.conversationHistory[0].content).toBe('Recent message');
    });
  });

  describe('validateConfig', () => {
    it('should return valid for good config', () => {
      const result = llmEngine.validateConfig();

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error when API key missing', () => {
      const noKeyEngine = new LLMEngine({ apiKey: undefined });
      const result = noKeyEngine.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('API key');
    });

    it('should return error for invalid URL', () => {
      const badUrlEngine = new LLMEngine({ apiKey: 'key', baseURL: 'not-a-url' });
      const result = badUrlEngine.validateConfig();

      expect(result.valid).toBe(false);
      expect(result.error).toContain('URL');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Connected' }],
        }),
      });

      const result = await llmEngine.testConnection();

      expect(result).toBe(true);
    });

    it('should return false on connection failure', async () => {
      mockFetch.mockRejectedValue(new Error('Connection failed'));

      const result = await llmEngine.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('conversation history', () => {
    it('should maintain conversation history', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
        }),
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      await llmEngine.chat(context);

      const history = llmEngine.getHistory();

      expect(history.length).toBeGreaterThanOrEqual(2); // user + assistant
      expect(history[0].role).toBe('user');
      expect(history[history.length - 1].role).toBe('assistant');
    });

    it('should limit history size', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
        }),
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      // Add many messages to exceed limit
      for (let i = 0; i < 100; i++) {
        await llmEngine.chat(context);
      }

      const history = llmEngine.getHistory();

      // Should be limited to 50
      expect(history.length).toBeLessThanOrEqual(50);
    });

    it('should clear history', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
        }),
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      };

      await llmEngine.chat(context);
      expect(llmEngine.getHistory().length).toBeGreaterThan(0);

      llmEngine.clearHistory();
      expect(llmEngine.getHistory().length).toBe(0);
    });

    it('should return a copy of history', () => {
      const history1 = llmEngine.getHistory();
      history1.push({ role: 'user', content: 'External' });

      const history2 = llmEngine.getHistory();

      // External modification should not affect internal state
      expect(history2.length).toBe(0);
    });
  });

  describe('formatAdditionalContext', () => {
    it('should format console errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
        }),
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [],
        images: [],
        additionalContext: {
          consoleErrors: ['Error 1', 'Error 2'],
          networkErrors: [],
          visibleElements: '',
          executionHistory: [],
        },
      };

      await llmEngine.chat(context);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const additionalMsg = sentBody.messages.find((m: any) => m.content.includes('控制台错误'));
      expect(additionalMsg).toBeDefined();
    });

    it('should format network errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
        }),
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [],
        images: [],
        additionalContext: {
          consoleErrors: [],
          networkErrors: ['Network error 1', 'Network error 2'],
          visibleElements: '',
          executionHistory: [],
        },
      };

      await llmEngine.chat(context);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const additionalMsg = sentBody.messages.find((m: any) => m.content.includes('网络错误'));
      expect(additionalMsg).toBeDefined();
    });

    it('should format when all additional context provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
        }),
      });

      const context: LLMContext = {
        systemPrompt: 'Test',
        conversationHistory: [{ role: 'user', content: 'Help me debug this' }],
        images: [],
        additionalContext: {
          consoleErrors: ['Console error'],
          networkErrors: ['Network error'],
          visibleElements: '<button>Click</button>',
          executionHistory: ['Step 1', 'Step 2'],
        },
      };

      await llmEngine.chat(context);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Should have user message + additionalContext message
      expect(sentBody.messages.length).toBeGreaterThan(1);
    });
  });
});
