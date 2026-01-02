/**
 * Intent Inferrer for Smart Assertion System
 * Infers user intent and determines if assertion is needed
 */

import type {
  ActionContext,
  AnalysisResult,
  AssertionType,
  VisualChange,
  HIGH_VALUE_INTENTS,
} from '../../types/assertion';

/**
 * Intent patterns for matching
 */
interface IntentPattern {
  intent: string;
  patterns: RegExp[];
  assertionTypes: AssertionType[];
  priority: number;
}

/**
 * Intent patterns database
 */
const INTENT_PATTERNS: IntentPattern[] = [
  // Authentication
  {
    intent: 'login',
    patterns: [/登录|log\s*in|sign\s*in/i],
    assertionTypes: ['text_contains', 'url_contains', 'element_visible'],
    priority: 100,
  },
  {
    intent: 'logout',
    patterns: [/登出|退出|log\s*out|sign\s*out/i],
    assertionTypes: ['url_contains', 'text_contains'],
    priority: 100,
  },
  {
    intent: 'signup',
    patterns: [/注册|sign\s*up|register/i],
    assertionTypes: ['text_contains', 'url_contains', 'element_visible'],
    priority: 100,
  },

  // Form actions
  {
    intent: 'submit_form',
    patterns: [/提交|确定|确认|保存|submit|confirm|save|ok|apply|发送|send/i],
    assertionTypes: ['text_contains', 'element_visible', 'element_exists'],
    priority: 90,
  },
  {
    intent: 'cancel',
    patterns: [/取消|关闭|cancel|close|dismiss/i],
    assertionTypes: ['element_visible', 'element_exists'],
    priority: 80,
  },

  // E-commerce
  {
    intent: 'add_to_cart',
    patterns: [/加入购物车|添加到购物车|add\s*to\s*cart|加入|添加/i],
    assertionTypes: ['text_contains', 'count_equals', 'element_visible'],
    priority: 90,
  },
  {
    intent: 'checkout',
    patterns: [/结算|checkout|付款|支付/i],
    assertionTypes: ['url_contains', 'element_visible'],
    priority: 95,
  },

  // CRUD operations
  {
    intent: 'delete_item',
    patterns: [/删除|移除|delete|remove/i],
    assertionTypes: ['element_exists', 'count_equals', 'text_contains'],
    priority: 85,
  },
  {
    intent: 'update_data',
    patterns: [/更新|修改|编辑|update|edit|modify/i],
    assertionTypes: ['text_contains', 'value_equals'],
    priority: 80,
  },
  {
    intent: 'save_data',
    patterns: [/保存|save/i],
    assertionTypes: ['text_contains', 'element_visible'],
    priority: 85,
  },

  // Search and filter
  {
    intent: 'search',
    patterns: [/搜索|查找|search|find|查询/i],
    assertionTypes: ['element_visible', 'count_equals', 'text_contains'],
    priority: 75,
  },
  {
    intent: 'filter',
    patterns: [/筛选|过滤|filter/i],
    assertionTypes: ['count_equals', 'element_visible'],
    priority: 70,
  },
  {
    intent: 'sort',
    patterns: [/排序|sort|order\s*by/i],
    assertionTypes: ['element_visible'],
    priority: 65,
  },

  // Navigation
  {
    intent: 'navigate_to',
    patterns: [/跳转|前往|navigate|go\s*to|访问|打开/i],
    assertionTypes: ['url_contains', 'element_visible'],
    priority: 80,
  },

  // File operations
  {
    intent: 'upload',
    patterns: [/上传|upload/i],
    assertionTypes: ['text_contains', 'element_visible'],
    priority: 75,
  },
  {
    intent: 'download',
    patterns: [/下载|download/i],
    assertionTypes: ['text_contains'],
    priority: 70,
  },

  // UI interactions
  {
    intent: 'expand',
    patterns: [/展开|expand|show\s*more/i],
    assertionTypes: ['element_visible'],
    priority: 60,
  },
  {
    intent: 'collapse',
    patterns: [/收起|collapse|hide/i],
    assertionTypes: ['element_visible'],
    priority: 60,
  },
  {
    intent: 'toggle',
    patterns: [/切换|toggle|switch/i],
    assertionTypes: ['state_check', 'element_visible'],
    priority: 65,
  },
];

/**
 * High value intents that always need assertion
 */
const HIGH_VALUE_INTENT_SET = new Set([
  'login',
  'logout',
  'signup',
  'submit_form',
  'add_to_cart',
  'checkout',
  'delete_item',
  'save_data',
  'navigate_to',
]);

/**
 * Analyze text and infer intent
 */
function analyzeText(text: string): {
  intent: string;
  assertionTypes: AssertionType[];
  confidence: number;
} {
  // Check against patterns
  for (const pattern of INTENT_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        return {
          intent: pattern.intent,
          assertionTypes: pattern.assertionTypes,
          confidence: pattern.priority,
        };
      }
    }
  }

  // Default fallback
  return {
    intent: 'generic_action',
    assertionTypes: ['element_visible'],
    confidence: 30,
  };
}

/**
 * Determine assertion types from visual changes
 */
function getAssertionTypesFromChanges(changes: VisualChange[]): AssertionType[] {
  const types: Set<AssertionType> = new Set();

  for (const change of changes) {
    if (change.type === 'appeared') {
      types.add('element_visible');
      types.add('element_exists');

      // Check for text content
      if (change.description && change.description.length > 0) {
        types.add('text_contains');
      }

      // Check for form elements
      if (change.elementInfo?.tagName) {
        const tag = change.elementInfo.tagName.toLowerCase();
        if (['input', 'select', 'textarea'].includes(tag)) {
          types.add('value_equals');
        }
        if (['button', 'a'].includes(tag)) {
          types.add('enabled');
        }
      }
    }

    if (change.type === 'modified') {
      types.add('state_check');
      if (change.description) {
        types.add('text_contains');
      }
    }

    if (change.type === 'disappeared') {
      types.add('element_exists');
    }
  }

  return Array.from(types);
}

/**
 * Calculate overall confidence
 */
function calculateConfidence(
  intentConfidence: number,
  changes: VisualChange[],
  urlChanged: boolean
): number {
  let confidence = intentConfidence;

  // Boost for significant changes
  const significantChanges = changes.filter(c => c.confidence >= 0.7);
  confidence += significantChanges.length * 5;

  // Boost for URL change
  if (urlChanged) {
    confidence += 15;
  }

  // Cap at 100
  return Math.min(100, confidence);
}

/**
 * Intent Inferrer class
 */
class IntentInferrer {
  /**
   * Analyze action context and determine assertion needs
   */
  analyze(context: ActionContext): AnalysisResult {
    const { action, pageState, semantic } = context;

    // Analyze the action target text
    const textAnalysis = analyzeText(semantic.targetSemantics);

    // Check for URL change
    const urlChanged = pageState.beforeUrl !== pageState.afterUrl;

    // Get assertion types from visual changes
    const changeTypes = getAssertionTypesFromChanges(pageState.visibleChanges);

    // Merge assertion types
    const allAssertionTypes = new Set([
      ...textAnalysis.assertionTypes,
      ...changeTypes,
    ]);

    // Add URL assertion type if URL changed
    if (urlChanged) {
      allAssertionTypes.add('url_contains');
    }

    // Determine if assertion is needed
    const isHighValueIntent = HIGH_VALUE_INTENT_SET.has(textAnalysis.intent);
    const hasSignificantChanges = pageState.visibleChanges.some(c => c.confidence >= 0.7);
    const needsAssertion = isHighValueIntent || hasSignificantChanges || urlChanged;

    // Calculate confidence
    const confidence = calculateConfidence(
      textAnalysis.confidence,
      pageState.visibleChanges,
      urlChanged
    );

    // Determine suggested target
    const suggestedTarget = this.determineSuggestedTarget(context);

    return {
      needsAssertion,
      assertionTypes: Array.from(allAssertionTypes),
      changes: pageState.visibleChanges,
      intent: textAnalysis.intent,
      confidence,
      suggestedTarget,
    };
  }

  /**
   * Determine the suggested target for assertion
   */
  private determineSuggestedTarget(context: ActionContext): string | undefined {
    const { pageState, semantic } = context;

    // If there are visible changes, use the most confident one
    const sortedChanges = [...pageState.visibleChanges].sort(
      (a, b) => b.confidence - a.confidence
    );

    if (sortedChanges.length > 0 && sortedChanges[0].type === 'appeared') {
      return sortedChanges[0].description;
    }

    // Otherwise use the expected outcome
    return semantic.expectedOutcome;
  }

  /**
   * Quick check if intent is high value
   */
  isHighValueIntent(intent: string): boolean {
    return HIGH_VALUE_INTENT_SET.has(intent);
  }

  /**
   * Get suggested assertion types for an intent
   */
  getSuggestedAssertionTypes(intent: string): AssertionType[] {
    const pattern = INTENT_PATTERNS.find(p => p.intent === intent);
    return pattern?.assertionTypes || ['element_visible'];
  }

  /**
   * Infer expected outcome message
   */
  inferExpectedOutcome(intent: string): string {
    const outcomes: Record<string, string> = {
      login: '登录成功',
      logout: '已退出登录',
      signup: '注册成功',
      submit_form: '提交成功',
      cancel: '已取消',
      add_to_cart: '已加入购物车',
      checkout: '订单创建成功',
      delete_item: '删除成功',
      update_data: '更新成功',
      save_data: '保存成功',
      search: '搜索结果',
      filter: '筛选结果',
      sort: '排序完成',
      navigate_to: '页面加载完成',
      upload: '上传成功',
      download: '下载开始',
    };

    return outcomes[intent] || '操作成功';
  }
}

// Export singleton instance
export const intentInferrer = new IntentInferrer();

// Export class for testing
export { IntentInferrer };
