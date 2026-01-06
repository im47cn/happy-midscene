/**
 * LLM Engine Service
 * Handles communication with language models for debugging assistance
 */

import type { LLMContext, ParsedResponse } from '../../types/debugAssistant';

export interface LLMEngineOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

/**
 * LLM Engine - handles communication with language models
 */
export class LLMEngine {
  private apiKey: string | undefined;
  private baseURL: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private timeout: number;

  // Message history for context
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(options: LLMEngineOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://api.anthropic.com/v1/messages';
    this.model = options.model || 'claude-sonnet-4-20250514';
    this.maxTokens = options.maxTokens ?? 4096;
    this.temperature = options.temperature ?? 0.7;
    this.timeout = options.timeout ?? 30000;
  }

  /**
   * Update configuration
   */
  updateConfig(options: Partial<LLMEngineOptions>): void {
    if (options.apiKey !== undefined) this.apiKey = options.apiKey;
    if (options.baseURL !== undefined) this.baseURL = options.baseURL;
    if (options.model !== undefined) this.model = options.model;
    if (options.maxTokens !== undefined) this.maxTokens = options.maxTokens;
    if (options.temperature !== undefined)
      this.temperature = options.temperature;
    if (options.timeout !== undefined) this.timeout = options.timeout;
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMEngineOptions {
    return {
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      model: this.model,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
      timeout: this.timeout,
    };
  }

  /**
   * Send a chat completion request
   */
  async chat(context: LLMContext): Promise<LLMResponse> {
    const messages = this.buildMessages(context);

    try {
      // Build the request
      const requestBody = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: context.systemPrompt,
        messages: messages,
      };

      // Make the API call
      const response = await this.makeRequest(requestBody);

      // Extract the response content
      const content = response.content[0]?.text || '';

      // Update conversation history
      this.addToHistory(
        'user',
        context.conversationHistory[context.conversationHistory.length - 1]
          ?.content || '',
      );
      this.addToHistory('assistant', content);

      return {
        content,
        usage: response.usage
          ? {
              promptTokens: response.usage.input_tokens,
              completionTokens: response.usage.output_tokens,
              totalTokens:
                response.usage.input_tokens + response.usage.output_tokens,
            }
          : undefined,
        model: response.model,
      };
    } catch (error) {
      throw new Error(
        `LLM request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Stream a chat completion request
   */
  async *chatStream(
    context: LLMContext,
  ): AsyncGenerator<StreamChunk, string, unknown> {
    const messages = this.buildMessages(context);
    let fullContent = '';

    try {
      const requestBody = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: context.systemPrompt,
        messages: messages,
        stream: true,
      };

      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Read the stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { content: '', done: true };
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text || '';
                fullContent += content;
                yield { content, done: false };
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Update conversation history
      this.addToHistory('assistant', fullContent);

      return fullContent;
    } catch (error) {
      throw new Error(
        `LLM stream failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Build messages array from context
   */
  private buildMessages(
    context: LLMContext,
  ): Array<{ role: string; content: any }> {
    const messages: Array<{ role: string; content: any }> = [];

    // Add conversation history (excluding system prompt which is sent separately)
    for (const msg of context.conversationHistory) {
      if (msg.role === 'user') {
        messages.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        messages.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    }

    // Add additional context if provided
    if (context.additionalContext) {
      messages.push({
        role: 'user',
        content: this.formatAdditionalContext(context),
      });
    }

    // Add images if provided
    if (context.images && context.images.length > 0) {
      for (const image of context.images) {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: image,
              },
            },
          ],
        });
      }
    }

    return messages;
  }

  /**
   * Format additional context
   */
  private formatAdditionalContext(context: LLMContext): string {
    const parts: string[] = [];

    if (context.additionalContext) {
      if (context.additionalContext.consoleErrors?.length) {
        parts.push(
          '**控制台错误:**\n' +
            context.additionalContext.consoleErrors.join('\n'),
        );
      }
      if (context.additionalContext.networkErrors?.length) {
        parts.push(
          '**网络错误:**\n' +
            context.additionalContext.networkErrors.join('\n'),
        );
      }
      if (context.additionalContext.visibleElements) {
        parts.push(
          '**可见元素:**\n' + context.additionalContext.visibleElements,
        );
      }
      if (context.additionalContext.executionHistory?.length) {
        parts.push(
          '**执行历史:**\n' +
            context.additionalContext.executionHistory.join('\n'),
        );
      }
    }

    return parts.join('\n\n') || '无额外上下文';
  }

  /**
   * Build request headers
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Make a non-streaming request
   */
  private async makeRequest(
    requestBody: Record<string, unknown>,
  ): Promise<any> {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Add a message to conversation history
   */
  private addToHistory(role: string, content: string): void {
    this.conversationHistory.push({ role, content });

    // Limit history size
    const maxHistory = 50;
    if (this.conversationHistory.length > maxHistory) {
      this.conversationHistory = this.conversationHistory.slice(-maxHistory);
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): Array<{ role: string; content: string }> {
    return [...this.conversationHistory];
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokens(text: string): number {
    if (!text) return 0;

    // Rough estimate: ~4 characters per token for English text
    // For Chinese, it's closer to ~2 characters per token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const nonChinese = text.replace(/[\u4e00-\u9fa5]/g, '');
    // Exclude whitespace from non-Chinese characters for better accuracy
    const otherChars = nonChinese.replace(/\s/g, '').length;
    return Math.ceil(chineseChars / 2 + otherChars / 4);
  }

  /**
   * Estimate total tokens for a request
   */
  estimateRequestTokens(context: LLMContext): number {
    let tokens = 0;

    // System prompt
    tokens += this.estimateTokens(context.systemPrompt);

    // Conversation history
    for (const msg of context.conversationHistory) {
      tokens += this.estimateTokens(msg.content);
    }

    // Additional context
    if (context.additionalContext) {
      for (const key in context.additionalContext) {
        const value =
          context.additionalContext[
            key as keyof typeof context.additionalContext
          ];
        if (typeof value === 'string') {
          tokens += this.estimateTokens(value);
        } else if (Array.isArray(value)) {
          tokens += value.reduce(
            (sum, item) => sum + this.estimateTokens(String(item)),
            0,
          );
        }
      }
    }

    // Images (rough estimate: each image ~1000 tokens)
    if (context.images) {
      tokens += context.images.length * 1000;
    }

    return tokens;
  }

  /**
   * Check if a request would exceed token limits
   */
  wouldExceedLimit(context: LLMContext, maxTokens?: number): boolean {
    const limit = maxTokens || 200000; // Default Claude input limit
    const estimated = this.estimateRequestTokens(context);
    return estimated > limit * 0.9; // Use 90% as safety margin
  }

  /**
   * Truncate context to fit within token limits
   */
  truncateContext(context: LLMContext, maxTokens?: number): LLMContext {
    const limit = (maxTokens || 200000) * 0.9;
    const systemTokens = this.estimateTokens(context.systemPrompt);
    const availableForHistory = limit - systemTokens;

    // Keep system prompt as-is
    const truncated: LLMContext = {
      ...context,
      systemPrompt: context.systemPrompt,
    };

    // Truncate conversation history if needed
    if (context.conversationHistory.length > 0) {
      const history: typeof context.conversationHistory = [];
      let currentTokens = 0;

      // Keep most recent messages
      for (let i = context.conversationHistory.length - 1; i >= 0; i--) {
        const msg = context.conversationHistory[i];
        const msgTokens = this.estimateTokens(msg.content);

        if (currentTokens + msgTokens <= availableForHistory) {
          history.unshift(msg);
          currentTokens += msgTokens;
        } else {
          break;
        }
      }

      truncated.conversationHistory = history;
    }

    return truncated;
  }

  /**
   * Validate the engine configuration
   */
  validateConfig(): { valid: boolean; error?: string } {
    if (!this.apiKey) {
      return { valid: false, error: 'API key is required' };
    }

    if (!this.baseURL) {
      return { valid: false, error: 'Base URL is required' };
    }

    try {
      new URL(this.baseURL);
    } catch {
      return { valid: false, error: 'Invalid base URL' };
    }

    return { valid: true };
  }

  /**
   * Test the connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chat({
        systemPrompt: 'You are a helpful assistant.',
        conversationHistory: [{ role: 'user', content: 'Hello' }],
        images: [],
      });

      return !!response.content;
    } catch {
      return false;
    }
  }
}

// Export singleton getter
let llmEngineInstance: LLMEngine | null = null;

export function getLLMEngine(options?: LLMEngineOptions): LLMEngine {
  if (!llmEngineInstance) {
    llmEngineInstance = new LLMEngine(options);
  }
  return llmEngineInstance;
}

export function resetLLMEngine(): void {
  llmEngineInstance = null;
}
