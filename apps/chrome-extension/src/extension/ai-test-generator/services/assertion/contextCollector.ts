/**
 * Context Collector for Smart Assertion System
 * Collects action and page state information for assertion analysis
 */

import type {
  ActionContext,
  ActionType,
  BoundingBox,
  ElementInfo,
  PageState,
} from '../../types/assertion';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Infer action type from step text
 */
function inferActionType(text: string): ActionType {
  const lowerText = text.toLowerCase();

  if (/^(打开|访问|跳转|go to|navigate|open|visit)\s/i.test(text)) {
    return 'navigate';
  }
  if (/点击|单击|按下|click|tap|press|选择|select/i.test(text)) {
    return 'click';
  }
  if (/输入|填写|键入|type|input|enter|fill/i.test(text)) {
    return 'input';
  }
  if (/滚动|滑动|scroll|swipe/i.test(text)) {
    return 'scroll';
  }
  if (/等待|wait|sleep|delay/i.test(text)) {
    return 'wait';
  }
  if (/验证|确认|检查|断言|verify|assert|check|should|expect/i.test(text)) {
    return 'assert';
  }
  if (/选择|下拉|dropdown|select/i.test(text)) {
    return 'select';
  }

  return 'ai';
}

/**
 * Extract target element description from step text
 */
function extractTargetDescription(
  text: string,
  actionType: ActionType,
): string {
  // Remove action keywords to get target
  const patterns: Record<string, RegExp> = {
    click:
      /(?:点击|单击|按下|click|tap|press|选择|select)\s*(?:"|'|「|【)?([^"'」】\n]+)/i,
    input:
      /(?:输入|填写|键入|type|input|enter|fill)\s*(?:"|'|「|【)?([^"'」】\n]+)/i,
    navigate:
      /(?:打开|访问|跳转到?|go to|navigate to?|open|visit)\s*(?:"|'|「|【)?([^"'」】\n]+)/i,
    select: /(?:选择|下拉|dropdown|select)\s*(?:"|'|「|【)?([^"'」】\n]+)/i,
    wait: /(?:等待|wait for?|sleep|delay)\s*(?:"|'|「|【)?([^"'」】\n]+)/i,
    assert:
      /(?:验证|确认|检查|断言|verify|assert|check|should|expect)\s*(?:"|'|「|【)?([^"'」】\n]+)/i,
  };

  const pattern = patterns[actionType];
  if (pattern) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return text;
}

/**
 * Extract input value from step text
 */
function extractInputValue(text: string): string | undefined {
  // Pattern: 输入 "value" / input "value" / fill "value"
  const patterns = [
    /(?:输入|填写|键入|type|input|enter|fill)\s*["'「]([^"'」]+)["'」]/i,
    /["'「]([^"'」]+)["'」]\s*(?:输入|填写|到|into|in)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Infer action intent from context
 */
function inferActionIntent(
  actionType: ActionType,
  targetDesc: string,
  value?: string,
): string {
  const lowerTarget = targetDesc.toLowerCase();

  // Login related
  if (/登录|login|sign\s*in/i.test(targetDesc)) {
    return 'login';
  }

  // Logout related
  if (/登出|退出|logout|sign\s*out/i.test(targetDesc)) {
    return 'logout';
  }

  // Signup related
  if (/注册|signup|sign\s*up|register/i.test(targetDesc)) {
    return 'signup';
  }

  // Submit related
  if (/提交|确定|确认|保存|submit|confirm|save|ok|apply/i.test(targetDesc)) {
    return 'submit_form';
  }

  // Cancel related
  if (/取消|cancel|close|关闭/i.test(targetDesc)) {
    return 'cancel';
  }

  // Add to cart
  if (/加入购物车|添加到购物车|add\s*to\s*cart/i.test(targetDesc)) {
    return 'add_to_cart';
  }

  // Delete related
  if (/删除|移除|delete|remove/i.test(targetDesc)) {
    return 'delete_item';
  }

  // Search related
  if (/搜索|查找|search|find/i.test(targetDesc)) {
    return 'search';
  }

  // Filter related
  if (/筛选|过滤|filter/i.test(targetDesc)) {
    return 'filter';
  }

  // Sort related
  if (/排序|sort/i.test(targetDesc)) {
    return 'sort';
  }

  // Navigation
  if (actionType === 'navigate') {
    return 'navigate_to';
  }

  // Input action
  if (actionType === 'input' && value) {
    return 'update_data';
  }

  // Default to action type
  return `${actionType}_action`;
}

/**
 * Infer expected outcome from action intent
 */
function inferExpectedOutcome(intent: string): string {
  const outcomes: Record<string, string> = {
    login: '用户成功登录，显示欢迎消息或跳转到首页',
    logout: '用户成功登出，跳转到登录页面',
    signup: '用户成功注册，显示欢迎消息或跳转到确认页面',
    submit_form: '表单提交成功，显示成功消息',
    cancel: '操作已取消，返回上一状态',
    add_to_cart: '商品已添加到购物车，购物车数量更新',
    delete_item: '项目已删除，从列表中移除',
    search: '搜索结果显示',
    filter: '筛选结果更新',
    sort: '列表排序更新',
    navigate_to: '页面成功跳转到目标页面',
    update_data: '数据更新成功',
  };

  return outcomes[intent] || '操作执行成功';
}

/**
 * Context Collector class
 */
class ContextCollector {
  private currentContext: Partial<ActionContext> | null = null;
  private beforeUrl = '';
  private beforeTitle = '';

  /**
   * Start collecting context before action execution
   */
  startCollection(stepId: string, stepIndex: number, stepText: string): void {
    this.beforeUrl = typeof window !== 'undefined' ? window.location.href : '';
    this.beforeTitle = typeof document !== 'undefined' ? document.title : '';

    const actionType = inferActionType(stepText);
    const targetDesc = extractTargetDescription(stepText, actionType);
    const inputValue = extractInputValue(stepText);
    const intent = inferActionIntent(actionType, targetDesc, inputValue);

    this.currentContext = {
      action: {
        type: actionType,
        target: {
          text: targetDesc,
        },
        value: inputValue,
        timestamp: Date.now(),
      },
      pageState: {
        beforeUrl: this.beforeUrl,
        afterUrl: '',
        beforeTitle: this.beforeTitle,
        afterTitle: '',
        visibleChanges: [],
      },
      semantic: {
        actionIntent: intent,
        targetSemantics: targetDesc,
        expectedOutcome: inferExpectedOutcome(intent),
      },
      stepId,
      stepIndex,
    };
  }

  /**
   * Complete context collection after action execution
   */
  completeCollection(): ActionContext | null {
    if (!this.currentContext) {
      return null;
    }

    const afterUrl = typeof window !== 'undefined' ? window.location.href : '';
    const afterTitle = typeof document !== 'undefined' ? document.title : '';

    // Update page state
    if (this.currentContext.pageState) {
      this.currentContext.pageState.afterUrl = afterUrl;
      this.currentContext.pageState.afterTitle = afterTitle;
    }

    const context = this.currentContext as ActionContext;
    this.currentContext = null;

    return context;
  }

  /**
   * Cancel current collection
   */
  cancelCollection(): void {
    this.currentContext = null;
  }

  /**
   * Create context from step result (for post-execution analysis)
   */
  createContextFromResult(
    stepId: string,
    stepIndex: number,
    stepText: string,
    beforeUrl: string,
    afterUrl: string,
    elementInfo?: Partial<ElementInfo>,
  ): ActionContext {
    const actionType = inferActionType(stepText);
    const targetDesc = extractTargetDescription(stepText, actionType);
    const inputValue = extractInputValue(stepText);
    const intent = inferActionIntent(actionType, targetDesc, inputValue);

    return {
      action: {
        type: actionType,
        target: elementInfo || { text: targetDesc },
        value: inputValue,
        timestamp: Date.now(),
      },
      pageState: {
        beforeUrl,
        afterUrl,
        beforeTitle: '',
        afterTitle: '',
        visibleChanges: [],
      },
      semantic: {
        actionIntent: intent,
        targetSemantics: targetDesc,
        expectedOutcome: inferExpectedOutcome(intent),
      },
      stepId,
      stepIndex,
    };
  }

  /**
   * Add visual change to current context
   */
  addVisualChange(
    change: ActionContext['pageState']['visibleChanges'][0],
  ): void {
    if (this.currentContext?.pageState) {
      this.currentContext.pageState.visibleChanges.push(change);
    }
  }

  /**
   * Update element info for current context
   */
  updateElementInfo(elementInfo: Partial<ElementInfo>): void {
    if (this.currentContext?.action) {
      this.currentContext.action.target = {
        ...this.currentContext.action.target,
        ...elementInfo,
      };
    }
  }
}

// Export singleton instance
export const contextCollector = new ContextCollector();

// Export class for testing
export { ContextCollector };
