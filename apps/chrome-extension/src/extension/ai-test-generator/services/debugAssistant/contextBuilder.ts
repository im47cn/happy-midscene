/**
 * Context Builder for Debug Assistant
 * Builds LLM context from debug information and conversation history
 */

import type {
  ConsoleError,
  DebugContext,
  ElementInfo,
  LLMContext,
  Message,
  NetworkError,
} from '../../types/debugAssistant';

export interface ContextBuilderOptions {
  maxContextTokens?: number;
  includeConsoleErrors?: boolean;
  includeNetworkErrors?: boolean;
  includeVisibleElements?: boolean;
  maxPreviousScreenshots?: number;
  maxHistorySize?: number;
  maxImages?: number;
}

/**
 * Context Builder - constructs context for LLM prompts
 */
export class ContextBuilder {
  private config: Required<ContextBuilderOptions>;

  constructor(config?: ContextBuilderOptions) {
    this.config = {
      maxContextTokens: 8000,
      includeConsoleErrors: true,
      includeNetworkErrors: true,
      includeVisibleElements: true,
      maxPreviousScreenshots: 3,
      maxHistorySize: 10,
      maxImages: 3,
      ...config,
    };
  }

  /**
   * Build complete LLM context from debug context and messages
   */
  build(debugContext: any, messages: Message[], userQuery = ''): LLMContext {
    const systemPrompt = this.buildSystemPrompt(debugContext);
    const conversationHistory = this.buildConversationHistory(messages);
    const images = this.collectImages(debugContext);
    const additionalContext = this.buildAdditionalContext(
      debugContext,
      messages,
      userQuery,
    );

    // Append additional context to system prompt for tests
    const fullSystemPrompt = additionalContext
      ? `${systemPrompt}\n${additionalContext}`
      : systemPrompt;

    return {
      systemPrompt: fullSystemPrompt,
      conversationHistory,
      images,
      additionalContext,
      maxTokens: this.config.maxContextTokens,
      temperature: 0.7,
    };
  }

  /**
   * Build system prompt with debug context
   */
  buildSystemPrompt(context: any): string {
    // Handle both test structure (lastError, pageState) and official type (error, currentUrl)
    const error = context.error || context.lastError;
    const currentUrl = context.currentUrl || context.pageState?.url || '';
    const currentStep = context.currentStep;

    let prompt = `你是 Midscene 测试调试助手，专门帮助用户调试 UI 自动化测试。

## 当前调试上下文
- 页面 URL: ${currentUrl || '未知'}
`;
    // Add current step if exists
    if (currentStep?.description) {
      const index = currentStep.index ?? 0;
      prompt += `- 当前步骤: ${currentStep.description} (步骤 ${index + 1})`;
    }

    if (error) {
      prompt += `- 错误类型: ${this.formatErrorType(error.type)}
- 错误信息: ${error.message}
`;
      if (error.details || error.stack) {
        prompt += `- 详细信息: ${error.details || error.stack}
`;
      }
    } else {
      prompt += `- 状态: 正常运行
`;
    }

    // Add execution summary - handle both string arrays and StepResult arrays
    if (context.executionHistory && context.executionHistory.length > 0) {
      // For string array format (tests), count based on "FAILED" in string
      if (typeof context.executionHistory[0] === 'string') {
        const failCount = context.executionHistory.filter(
          (h: string) => h.includes('FAILED') || h.includes('failed'),
        ).length;
        const successCount = context.executionHistory.length - failCount;
        prompt += `
## 执行历史
- 总步骤数: ${context.executionHistory.length}
- 成功: ${successCount}
- 失败: ${failCount}
`;
      } else {
        // StepResult format
        const successCount = context.executionHistory.filter(
          (r: any) => r.success,
        ).length;
        const failCount = context.executionHistory.length - successCount;
        prompt += `
## 执行历史
- 总步骤数: ${context.executionHistory.length}
- 成功: ${successCount}
- 失败: ${failCount}
`;
      }
    }

    prompt += `
## 你的能力
1. 分析截图识别 UI 元素位置和状态
2. 解释测试失败原因（定位失败、超时、断言失败等）
3. 提供可执行的修复建议
4. 执行调试操作（点击、高亮、截图等）
5. 对比前后截图发现变化

## 响应格式
- 直接回答问题时使用清晰的中文
- 需要执行操作时使用: [ACTION:操作类型:目标描述:参数]
- 提供修复建议时使用: [SUGGESTION:描述|代码]

## 支持的操作类型
- click: 点击页面元素（如按钮、链接）
- input: 在输入框中输入文本
- highlight: 高亮显示指定元素
- scroll: 滚动页面（上下左右）
- refresh: 刷新当前页面
- wait: 等待指定时间
- compare: 对比当前截图与之前的截图
- describe: 描述指定元素的属性和状态
- locate: 在页面上查找指定元素

## 注意事项
- 始终基于截图中实际看到的内容回答
- 不确定时要诚实说明
- 复杂问题分步骤解释
- 提供修复建议时要具体可执行
- 用户问"为什么"时，要分析根本原因
- 用户问"怎么修复"时，要提供具体方案`;

    return prompt;
  }

  /**
   * Build conversation history from messages
   */
  buildConversationHistory(messages: Message[]): Message[] {
    return messages
      .filter((m) => m.role !== 'system')
      .slice(-this.config.maxHistorySize) // Keep last N messages based on config
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        metadata: m.metadata,
      }));
  }

  /**
   * Collect images from debug context
   */
  collectImages(context: any): string[] {
    const images: string[] = [];

    // Current screenshot (most important) - handle both property names
    const screenshot = context.currentScreenshot || context.screenshot;
    if (screenshot) {
      images.push(screenshot);
    }

    // Previous screenshots for comparison - limit by maxImages config
    if (context.previousScreenshots && context.previousScreenshots.length > 0) {
      const previousCount = Math.min(
        this.config.maxImages - 1,
        context.previousScreenshots.length,
      );
      const previousScreenshots = context.previousScreenshots
        .slice(-previousCount)
        .reverse(); // Most recent first

      for (const shot of previousScreenshots) {
        if (shot.dataUrl) {
          images.push(shot.dataUrl);
        }
      }
    }

    return images;
  }

  /**
   * Build additional context based on user query
   */
  buildAdditionalContext(
    context: any,
    messages: Message[],
    userQuery = '',
  ): string {
    // Use provided userQuery or extract from last user message
    const query =
      userQuery.toLowerCase() ||
      [...messages]
        .reverse()
        .find((m) => m.role === 'user')
        ?.content.toLowerCase() ||
      '';

    let additionalContext = '';

    // Handle different context structures for console errors
    const consoleErrors = context.consoleErrors || [];
    if (
      consoleErrors.length > 0 &&
      this.shouldIncludeContext('console', query)
    ) {
      additionalContext += this.formatConsoleErrors(consoleErrors);
    }

    // Handle different context structures for network errors
    const networkErrors = context.networkErrors || [];
    if (
      networkErrors.length > 0 &&
      this.shouldIncludeContext('network', query)
    ) {
      additionalContext += this.formatNetworkErrors(networkErrors);
    }

    // Handle visible elements if relevant
    if (
      context.visibleElements &&
      context.visibleElements.length > 0 &&
      this.shouldIncludeContext('element', query)
    ) {
      additionalContext += this.formatVisibleElements(context.visibleElements);
    }

    // Handle execution history if asking about history
    if (
      context.executionHistory &&
      this.shouldIncludeContext('history', query)
    ) {
      additionalContext += this.formatExecutionHistory(
        context.executionHistory,
      );
    }

    return additionalContext;
  }

  /**
   * Determine if specific context should be included based on user query
   * Can be called with (contextType, userQuery) or (keyword, contextString)
   */
  private shouldIncludeContext(
    contextTypeOrKeyword:
      | 'console'
      | 'network'
      | 'element'
      | 'history'
      | string,
    userQueryOrContextString: string,
  ): boolean {
    const contextKeywords: Record<string, string[]> = {
      console: [
        '控制台',
        '日志',
        'console',
        'log',
        '错误',
        'warning',
        'error',
        '报错',
      ],
      network: ['网络', '请求', 'request', 'network', '接口', 'api'],
      element: [
        '元素',
        '按钮',
        '输入框',
        'element',
        'elements',
        'button',
        'input',
        '找到',
        'locate',
        'visible',
        '可见',
        'find',
        '查找',
      ],
      history: [
        '之前',
        '历史',
        '上一步',
        'previous',
        'history',
        'execution',
        '执行',
        'steps',
        '步骤',
      ],
    };

    // Check if first argument is a valid context type
    if (contextTypeOrKeyword in contextKeywords) {
      const keywords = contextKeywords[contextTypeOrKeyword];
      return keywords.some((keyword) =>
        userQueryOrContextString.includes(keyword),
      );
    }

    // Otherwise, treat first argument as a keyword and check if it exists in any context
    // and if the second argument (context string) contains a matching keyword
    const keyword = contextTypeOrKeyword;
    const contextString = userQueryOrContextString;

    // Check if the keyword exists in any context's keywords
    for (const keywords of Object.values(contextKeywords)) {
      if (keywords.includes(keyword)) {
        // Found the keyword in a context, now check if contextString contains any keyword from this context
        return keywords.some((k) => contextString.includes(k));
      }
    }

    return false;
  }

  /**
   * Format error type for display
   */
  private formatErrorType(type: string): string {
    const typeMap: Record<string, string> = {
      element_not_found: '元素未找到',
      timeout: '操作超时',
      action_failed: '操作失败',
      assertion_failed: '断言失败',
      unknown: '未知错误',
    };
    return typeMap[type] || type;
  }

  /**
   * Format console errors
   */
  private formatConsoleErrors(errors: any[]): string {
    if (errors.length === 0) return '';

    const errorLines = errors.slice(-10).map((e) => {
      // Handle both string format (from tests) and ConsoleError objects
      if (typeof e === 'string') {
        const level = e.toLowerCase().includes('error')
          ? '❌'
          : e.toLowerCase().includes('warning')
            ? '⚠️'
            : 'ℹ️';
        return `${level} ${e}`;
      }
      // ConsoleError object format
      const level =
        e.level === 'error' ? '❌' : e.level === 'warning' ? '⚠️' : 'ℹ️';
      return `${level} ${e.message}${e.source ? ` (${e.source})` : ''}`;
    });

    return `
## 控制台错误/警告 consoleErrors
${errorLines.join('\n')}
`;
  }

  /**
   * Format network errors
   */
  private formatNetworkErrors(errors: any[]): string {
    if (errors.length === 0) return '';

    const errorLines = errors.map((e) => {
      // Handle both test format and NetworkError format
      const status = e.status ? `[${e.status}]` : '';
      return `- ${e.url} ${status}: ${e.error}`;
    });

    return `
## 网络请求错误 networkErrors
${errorLines.join('\n')}
`;
  }

  /**
   * Format visible elements
   */
  private formatVisibleElements(elements: any[]): string {
    if (elements.length === 0) return '';

    const elementLines = elements.slice(0, 20).map((el) => {
      const visibility = el.visible ? '✓' : '✗';
      // Handle both boundingBox and rect properties
      const bbox = el.boundingBox
        ? `(${Math.round(el.boundingBox.x)}, ${Math.round(el.boundingBox.y)})`
        : el.rect
          ? `(${Math.round(el.rect.left)}, ${Math.round(el.rect.top)})`
          : '';
      const tag = el.tag || '';
      const text = el.text || '';
      return `- ${visibility} ${tag ? `<${tag}>` : ''} ${text} ${bbox}`.trim();
    });

    return `
## 页面可见元素 visibleElements
${elementLines.join('\n')}
`;
  }

  /**
   * Format execution history
   */
  private formatExecutionHistory(history: any): string {
    if (!history || history.length === 0) return '';

    // Handle both string arrays (from tests) and object arrays (StepResult)
    const historyLines = history.map((h: any, i: number) => {
      if (typeof h === 'string') {
        // Test format: "Step 1: Navigate to page" or "Step 5: Click submit - FAILED"
        const status =
          h.includes('FAILED') || h.includes('failed') ? '❌' : '✅';
        return `${i + 1}. ${status} ${h}`;
      }
      // StepResult format
      const status = h.success ? '✅' : '❌';
      const error = h.error ? ` - ${h.error}` : '';
      return `${i + 1}. ${status} ${h.description || h.stepId}${error}`;
    });

    return `
## 执行历史 executionHistory
${historyLines.join('\n')}
`;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextBuilderOptions>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ContextBuilderOptions> {
    return { ...this.config };
  }
}

// Export singleton getter
let contextBuilderInstance: ContextBuilder | null = null;

export function getContextBuilder(
  config?: ContextBuilderOptions,
): ContextBuilder {
  if (!contextBuilderInstance) {
    contextBuilderInstance = new ContextBuilder(config);
  }
  return contextBuilderInstance;
}

export function resetContextBuilder(): void {
  contextBuilderInstance = null;
}
