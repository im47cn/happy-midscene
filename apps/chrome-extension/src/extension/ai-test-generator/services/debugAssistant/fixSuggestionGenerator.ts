/**
 * Fix Suggestion Generator Service
 * Analyzes test failures and generates fix suggestions
 */

import type { FixSuggestion, DebugContext } from '../../types/debugAssistant';
import { KnowledgeBase, type KnowledgeEntry } from './knowledgeBase';

export interface FixGeneratorOptions {
  knowledgeBase?: KnowledgeBase;
  maxSuggestions?: number;
  minConfidence?: number;
}

export interface FailureAnalysis {
  type: string; // e.g., 'element_not_found', 'timeout', 'assertion_failed'
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  likelyCauses: string[];
  suggestedFixes: FixSuggestion[];
}

export interface ElementInfo {
  selector: string;
  exists: boolean;
  visible: boolean;
  enabled: boolean;
  text?: string;
}

/**
 * Fix Suggestion Generator - analyzes failures and generates fix suggestions
 */
export class FixSuggestionGenerator {
  private knowledgeBase: KnowledgeBase | null;
  private maxSuggestions: number;
  private minConfidence: number;

  // Common error patterns
  private readonly commonPatterns = {
    elementNotFound: [
      '找不到元素',
      'element not found',
      '无法定位',
      'cannot find element',
      'no element located',
      'timeout waiting for element',
    ],
    timeout: [
      '超时',
      'timeout',
      'timed out',
      '等待超时',
    ],
    assertionFailed: [
      '断言失败',
      'assertion failed',
      '期望',
      'expected',
      '实际',
      'actual',
    ],
    networkError: [
      '网络错误',
      'network error',
      '连接失败',
      'connection failed',
      'fetch failed',
    ],
    staleElement: [
      'stale element',
      '元素已过期',
      'element reference',
      'detached from DOM',
    ],
    clickIntercepted: [
      'click intercepted',
      'element click intercepted',
      'other element would receive',
      '遮罩',
    ],
  };

  constructor(options: FixGeneratorOptions = {}) {
    this.knowledgeBase = options.knowledgeBase ?? null;
    this.maxSuggestions = options.maxSuggestions ?? 5;
    this.minConfidence = options.minConfidence ?? 0.3;
  }

  /**
   * Set the knowledge base
   */
  setKnowledgeBase(kb: KnowledgeBase): void {
    this.knowledgeBase = kb;
  }

  /**
   * Generate fix suggestions based on debug context
   */
  async generateSuggestions(
    context: DebugContext,
    errorMessage?: string,
  ): Promise<FixSuggestion[]> {
    const suggestions: FixSuggestion[] = [];

    // 1. Check knowledge base first
    if (this.knowledgeBase) {
      const query = this.buildSearchQuery(context, errorMessage);
      const matches = this.knowledgeBase.findMatchingPatterns(query, this.maxSuggestions);

      for (const match of matches) {
        for (const fix of match.fixes) {
          if (fix.confidence >= this.minConfidence) {
            suggestions.push({
              ...fix,
              confidence: fix.confidence * 0.9, // Slightly reduce confidence for KB matches
            });
          }
        }
      }
    }

    // 2. Analyze the error type
    const analysis = this.analyzeFailure(context, errorMessage);

    // 3. Add suggestions from analysis
    for (const fix of analysis.suggestedFixes) {
      if (!suggestions.some((s) => s.description === fix.description)) {
        suggestions.push(fix);
      }
    }

    // 4. Generate contextual suggestions based on test state
    const contextualSuggestions = this.generateContextualSuggestions(context, errorMessage);
    for (const fix of contextualSuggestions) {
      if (!suggestions.some((s) => s.description === fix.description)) {
        suggestions.push(fix);
      }
    }

    // 5. Sort by confidence and limit
    suggestions.sort((a, b) => b.confidence - a.confidence);
    return suggestions.slice(0, this.maxSuggestions);
  }

  /**
   * Analyze a test failure
   */
  analyzeFailure(context: DebugContext, errorMessage?: string): FailureAnalysis {
    // Prioritize context error over parameter
    const error = context.lastError?.message || errorMessage || '';
    const errorLower = error.toLowerCase();

    // Detect failure type
    let type = 'unknown';
    let severity: FailureAnalysis['severity'] = 'medium';
    let description = '未知错误类型';
    const likelyCauses: string[] = [];
    const suggestedFixes: FixSuggestion[] = [];

    if (this.matchesAny(errorLower, this.commonPatterns.elementNotFound)) {
      type = 'element_not_found';
      severity = 'high';
      description = '无法找到目标元素';
      likelyCauses.push(
        '元素选择器不正确',
        '元素尚未加载完成',
        '元素被动态生成',
        '页面结构与预期不符',
      );
      suggestedFixes.push(
        {
          type: 'wait',
          description: '添加等待条件，等待元素出现',
          code: `await waitFor(element, { state: 'visible' });`,
          confidence: 0.85,
        },
        {
          type: 'locator',
          description: '使用更可靠的选择器（如 test-id）',
          code: '// 使用 data-testid 属性\nconst button = await locate("test-id=submit-btn");',
          confidence: 0.8,
        },
        {
          type: 'retry',
          description: '添加重试机制',
          code: `await retry(async () => {\n  await click(element);\n}, { times: 3 });`,
          confidence: 0.7,
        },
      );
    } else if (this.matchesAny(errorLower, this.commonPatterns.timeout)) {
      type = 'timeout';
      severity = 'high';
      description = '操作超时';
      likelyCauses.push(
        '页面加载缓慢',
        '网络延迟',
        '元素动画未完成',
        '等待时间设置过短',
      );
      suggestedFixes.push(
        {
          type: 'timeout',
          description: '增加超时时间',
          code: `await click(element, { timeout: 30000 });`,
          confidence: 0.75,
        },
        {
          type: 'wait',
          description: '等待特定状态而非固定时间',
          code: `await waitFor(() => element.isVisible());`,
          confidence: 0.8,
        },
      );
    } else if (this.matchesAny(errorLower, this.commonPatterns.assertionFailed)) {
      type = 'assertion_failed';
      severity = 'medium';
      description = '断言失败';
      likelyCauses.push(
        '实际值与预期不符',
        '业务逻辑错误',
        '数据状态异常',
      );
      suggestedFixes.push(
        {
          type: 'assertion',
          description: '检查断言条件是否正确',
          code: '// 确认期望值是否符合实际业务逻辑\nassert.equal(actual, expected);',
          confidence: 0.6,
        },
        {
          type: 'debug',
          description: '添加调试输出查看实际值',
          code: `console.log('实际值:', actualValue);\nconsole.log('期望值:', expectedValue);`,
          confidence: 0.7,
        },
      );
    } else if (this.matchesAny(errorLower, this.commonPatterns.networkError)) {
      type = 'network_error';
      severity = 'high';
      description = '网络请求失败';
      likelyCauses.push(
        '网络连接问题',
        'API 服务异常',
        '请求被阻止',
        'CORS 问题',
      );
      suggestedFixes.push(
        {
          type: 'retry',
          description: '添加网络重试逻辑',
          code: `await retry(async () => {\n  await fetchData();\n}, { times: 3, delay: 1000 });`,
          confidence: 0.75,
        },
        {
          type: 'wait',
          description: '等待网络稳定',
          code: `await waitForNetworkIdle();`,
          confidence: 0.65,
        },
      );
    } else if (this.matchesAny(errorLower, this.commonPatterns.staleElement)) {
      type = 'stale_element';
      severity = 'medium';
      description = '元素引用已过期';
      likelyCauses.push(
        '页面已更新',
        '元素被重新渲染',
        'DOM 结构发生变化',
      );
      suggestedFixes.push(
        {
          type: 'locator',
          description: '每次使用前重新定位元素',
          code: `// 不要缓存元素引用\nconst button = await locate('提交按钮');\nawait click(button);`,
          confidence: 0.85,
        },
      );
    } else if (this.matchesAny(errorLower, this.commonPatterns.clickIntercepted)) {
      type = 'click_intercepted';
      severity = 'medium';
      description = '点击被其他元素拦截';
      likelyCauses.push(
        '弹窗或遮罩层',
        '加载动画',
        '浮动元素',
      );
      suggestedFixes.push(
        {
          type: 'action',
          description: '先关闭遮罩层再点击',
          code: `await click('关闭弹窗');\nawait click('提交按钮');`,
          confidence: 0.8,
        },
        {
          type: 'wait',
          description: '等待动画完成',
          code: `await waitForAnimation();\nawait click(element);`,
          confidence: 0.7,
        },
      );
    }

    return {
      type,
      severity,
      description,
      likelyCauses,
      suggestedFixes,
    };
  }

  /**
   * Generate contextual suggestions based on test state
   */
  private generateContextualSuggestions(
    context: DebugContext,
    errorMessage?: string,
  ): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    // Check if page has loaded
    if (!context.pageState?.url || context.pageState.url === 'about:blank') {
      suggestions.push({
        type: 'navigation',
        description: '页面未加载，需要先导航到目标页面',
        code: `await navigate('https://example.com');`,
        confidence: 0.9,
      });
    }

    // Check for authentication issues
    if (context.consoleErrors?.some((e) => e.includes('401') || e.includes('403') || e.includes('unauthorized'))) {
      suggestions.push({
        type: 'auth',
        description: '可能需要重新登录',
        code: `await login();\n// 或检查登录状态\nif (!await isLoggedIn()) {\n  await performLogin();\n}`,
        confidence: 0.85,
      });
    }

    // Check for loading indicators
    if (errorMessage?.toLowerCase().includes('timeout')) {
      suggestions.push({
        type: 'wait',
        description: '等待加载动画消失',
        code: `await waitFor(() => !loadingIndicator.isVisible());`,
        confidence: 0.7,
      });
    }

    // Check for iframe issues
    if (errorMessage?.toLowerCase().includes('frame')) {
      suggestions.push({
        type: 'action',
        description: '可能需要切换到 iframe',
        code: `const frame = page.frame('iframe-name');\nawait frame.click(element);`,
        confidence: 0.75,
      });
    }

    return suggestions;
  }

  /**
   * Build search query for knowledge base
   */
  private buildSearchQuery(context: DebugContext, errorMessage?: string): string {
    const parts: string[] = [];

    if (errorMessage) {
      parts.push(errorMessage);
    }

    if (context.lastError?.message) {
      parts.push(context.lastError.message);
    }

    if (context.failedStep) {
      parts.push(context.failedStep);
    }

    // Add relevant console errors
    if (context.consoleErrors?.length) {
      parts.push(context.consoleErrors.slice(0, 2).join(' '));
    }

    return parts.join(' ');
  }

  /**
   * Check if text matches any of the patterns
   */
  private matchesAny(text: string, patterns: string[]): boolean {
    return patterns.some((pattern) => text.includes(pattern.toLowerCase()));
  }

  /**
   * Learn from a successful fix
   */
  async learnFromSuccess(
    context: DebugContext,
    appliedFix: FixSuggestion,
    originalError: string,
  ): Promise<void> {
    if (!this.knowledgeBase) return;

    const pattern = this.extractPattern(originalError, context);
    const entry = {
      pattern,
      fixes: [appliedFix],
      frequency: 1,
      successRate: 1.0,
      tags: this.generateTags(context, appliedFix),
    };

    this.knowledgeBase.addEntry(entry);
  }

  /**
   * Extract pattern from error and context
   */
  private extractPattern(error: string, context: DebugContext): string {
    // Simplify error message to create a pattern
    let pattern = error
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'ID') // Replace UUIDs
      .replace(/['"][^'"]+['"]/g, 'VALUE'); // Replace quoted strings

    // Add context info
    if (context.failedStep) {
      pattern += ` 在步骤 "${context.failedStep}"`;
    }

    return pattern;
  }

  /**
   * Generate tags for a knowledge base entry
   */
  private generateTags(context: DebugContext, fix: FixSuggestion): string[] {
    const tags: string[] = [];

    // Add fix type as tag
    tags.push(fix.type);

    // Add error-based tags
    if (context.lastError?.message) {
      const error = context.lastError.message.toLowerCase();
      if (error.includes('timeout')) tags.push('timeout');
      if (error.includes('not found')) tags.push('element_not_found');
      if (error.includes('click')) tags.push('click');
      if (error.includes('assert')) tags.push('assertion');
    }

    // Add page type tags
    if (context.pageState?.url) {
      try {
        const url = new URL(context.pageState.url);
        if (url.pathname.includes('login')) tags.push('login_page');
        if (url.pathname.includes('admin')) tags.push('admin_page');
      } catch {
        // Invalid URL, ignore
      }
    }

    return tags;
  }

  /**
   * Get common fix patterns for a given error type
   */
  getCommonFixes(errorType: string): FixSuggestion[] {
    const fixes: Record<string, FixSuggestion[]> = {
      element_not_found: [
        {
          type: 'wait',
          description: '添加显式等待',
          code: 'await waitFor(element, { state: "visible" });',
          confidence: 0.9,
        },
        {
          type: 'locator',
          description: '使用更稳定的选择器',
          code: '// 使用 data-testid\nconst btn = await locate("test-id=submit");',
          confidence: 0.85,
        },
      ],
      timeout: [
        {
          type: 'timeout',
          description: '增加超时时间',
          code: 'await action(element, { timeout: 30000 });',
          confidence: 0.8,
        },
        {
          type: 'wait',
          description: '等待加载完成',
          code: 'await waitForLoadState("networkidle");',
          confidence: 0.75,
        },
      ],
      click_intercepted: [
        {
          type: 'action',
          description: '强制点击',
          code: 'await element.click({ force: true });',
          confidence: 0.7,
        },
      ],
    };

    return fixes[errorType] || [];
  }
}

// Export singleton getter
let fixSuggestionGeneratorInstance: FixSuggestionGenerator | null = null;

export function getFixSuggestionGenerator(options?: FixGeneratorOptions): FixSuggestionGenerator {
  if (!fixSuggestionGeneratorInstance) {
    fixSuggestionGeneratorInstance = new FixSuggestionGenerator(options);
  }
  return fixSuggestionGeneratorInstance;
}

export function resetFixSuggestionGenerator(): void {
  fixSuggestionGeneratorInstance = null;
}
