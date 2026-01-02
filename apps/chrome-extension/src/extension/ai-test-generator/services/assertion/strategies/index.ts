/**
 * Assertion Generation Strategies
 * Strategy pattern implementation for generating assertions
 */

import type {
  ActionContext,
  AnalysisResult,
  AssertionRecommendation,
  AssertionStrategy,
  AssertionType,
  VisualChange,
} from '../../../types/assertion';
import { SUCCESS_KEYWORDS, ERROR_KEYWORDS } from '../../../types/assertion';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `ast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if text looks like a success message
 */
function looksLikeSuccessMessage(text: string): boolean {
  const lowerText = text.toLowerCase();
  return SUCCESS_KEYWORDS.some(kw => lowerText.includes(kw.toLowerCase()));
}

/**
 * Check if text looks like an error message
 */
function looksLikeErrorMessage(text: string): boolean {
  const lowerText = text.toLowerCase();
  return ERROR_KEYWORDS.some(kw => lowerText.includes(kw.toLowerCase()));
}

/**
 * Strategy 1: Success Message Detection
 * Detects success/confirmation messages after form submissions
 */
export class SuccessMessageStrategy implements AssertionStrategy {
  name = 'success_message';
  priority = 100;

  applies(context: ActionContext, analysis: AnalysisResult): boolean {
    const targetIntents = ['submit_form', 'login', 'signup', 'save_data', 'add_to_cart', 'delete_item'];
    return targetIntents.includes(analysis.intent);
  }

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const recommendations: AssertionRecommendation[] = [];
    const newElements = analysis.changes.filter(c => c.type === 'appeared');

    // Find elements that look like success messages
    for (const element of newElements) {
      if (looksLikeSuccessMessage(element.description)) {
        recommendations.push({
          id: generateId(),
          type: 'text_contains',
          description: `验证成功提示 "${element.description}" 出现`,
          confidence: element.confidence * 100,
          reason: '操作后检测到成功提示消息出现',
          parameters: {
            target: element.description,
            operator: 'contains',
          },
          yamlOutput: `- ai: "验证页面包含文本 '${element.description}'"`,
          source: 'rule',
        });
      }
    }

    // If no specific success message found but it's a form submit, add generic check
    if (recommendations.length === 0 && analysis.intent === 'submit_form') {
      const expectedMessage = context.semantic.expectedOutcome;
      recommendations.push({
        id: generateId(),
        type: 'text_contains',
        description: `验证操作成功提示出现`,
        confidence: 60,
        reason: '表单提交后应显示成功提示',
        parameters: {
          target: expectedMessage,
          operator: 'contains',
        },
        yamlOutput: `- ai: "验证页面显示成功提示"`,
        source: 'rule',
      });
    }

    return recommendations;
  }
}

/**
 * Strategy 2: Navigation Verification
 * Verifies URL changes after navigation actions
 */
export class NavigationStrategy implements AssertionStrategy {
  name = 'navigation';
  priority = 95;

  applies(context: ActionContext, analysis: AnalysisResult): boolean {
    return context.pageState.beforeUrl !== context.pageState.afterUrl;
  }

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const { beforeUrl, afterUrl } = context.pageState;

    try {
      const afterPath = new URL(afterUrl).pathname;

      return [{
        id: generateId(),
        type: 'url_contains',
        description: `验证页面跳转到 ${afterPath}`,
        confidence: 95,
        reason: '检测到页面导航，应验证目标 URL',
        parameters: {
          expectedValue: afterPath,
          operator: 'contains',
        },
        yamlOutput: `- ai: "验证当前 URL 包含 '${afterPath}'"`,
        source: 'rule',
      }];
    } catch {
      return [];
    }
  }
}

/**
 * Strategy 3: State Change Verification
 * Verifies element state changes
 */
export class StateChangeStrategy implements AssertionStrategy {
  name = 'state_change';
  priority = 80;

  applies(context: ActionContext, analysis: AnalysisResult): boolean {
    return analysis.changes.some(c => c.type === 'modified');
  }

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const modifications = analysis.changes.filter(c => c.type === 'modified');

    return modifications.map(mod => ({
      id: generateId(),
      type: 'state_check' as AssertionType,
      description: `验证 ${mod.description} 状态变化`,
      confidence: mod.confidence * 90,
      reason: '元素状态发生变化，应验证新状态',
      parameters: {
        target: mod.description,
      },
      yamlOutput: `- ai: "验证 ${mod.description} 状态正确"`,
      source: 'rule' as const,
    }));
  }
}

/**
 * Strategy 4: Element Visibility
 * Verifies that expected elements appear after action
 */
export class ElementVisibilityStrategy implements AssertionStrategy {
  name = 'element_visibility';
  priority = 70;

  applies(context: ActionContext, analysis: AnalysisResult): boolean {
    return analysis.changes.some(
      c => c.type === 'appeared' && c.confidence >= 0.6
    );
  }

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const recommendations: AssertionRecommendation[] = [];
    const newElements = analysis.changes.filter(
      c => c.type === 'appeared' && c.confidence >= 0.6
    );

    // Filter out elements that are likely success/error messages (handled by other strategies)
    const nonMessageElements = newElements.filter(
      el => !looksLikeSuccessMessage(el.description) && !looksLikeErrorMessage(el.description)
    );

    for (const element of nonMessageElements.slice(0, 3)) {
      recommendations.push({
        id: generateId(),
        type: 'element_visible',
        description: `验证元素 "${element.description}" 可见`,
        confidence: element.confidence * 85,
        reason: '新元素出现在页面上',
        parameters: {
          target: element.description,
        },
        yamlOutput: `- ai: "验证元素 '${element.description}' 可见"`,
        source: 'rule',
      });
    }

    return recommendations;
  }
}

/**
 * Strategy 5: Data Validation
 * Verifies data-related changes (counts, values)
 */
export class DataValidationStrategy implements AssertionStrategy {
  name = 'data_validation';
  priority = 75;

  applies(context: ActionContext, analysis: AnalysisResult): boolean {
    const dataIntents = ['add_to_cart', 'delete_item', 'search', 'filter', 'sort'];
    return dataIntents.includes(analysis.intent);
  }

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const recommendations: AssertionRecommendation[] = [];
    const { intent } = analysis;

    if (intent === 'add_to_cart') {
      recommendations.push({
        id: generateId(),
        type: 'count_equals',
        description: '验证购物车数量增加',
        confidence: 80,
        reason: '添加商品后购物车数量应更新',
        parameters: {
          target: '购物车',
        },
        yamlOutput: `- ai: "验证购物车数量已增加"`,
        source: 'rule',
      });
    }

    if (intent === 'delete_item') {
      recommendations.push({
        id: generateId(),
        type: 'element_exists',
        description: '验证项目已从列表中移除',
        confidence: 85,
        reason: '删除操作后项目应不再显示',
        parameters: {
          target: context.semantic.targetSemantics,
        },
        yamlOutput: `- ai: "验证已删除的项目不再显示"`,
        source: 'rule',
      });
    }

    if (intent === 'search' || intent === 'filter') {
      recommendations.push({
        id: generateId(),
        type: 'element_visible',
        description: '验证搜索/筛选结果显示',
        confidence: 75,
        reason: '搜索或筛选后应显示结果',
        parameters: {
          target: '结果',
        },
        yamlOutput: `- ai: "验证搜索结果显示"`,
        source: 'rule',
      });
    }

    return recommendations;
  }
}

/**
 * Strategy 6: Error Prevention
 * Adds assertions to catch potential error states
 */
export class ErrorPreventionStrategy implements AssertionStrategy {
  name = 'error_prevention';
  priority = 60;

  applies(context: ActionContext, analysis: AnalysisResult): boolean {
    // Apply to form submissions and critical actions
    const criticalIntents = ['login', 'signup', 'checkout', 'submit_form'];
    return criticalIntents.includes(analysis.intent);
  }

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const recommendations: AssertionRecommendation[] = [];
    const newElements = analysis.changes.filter(c => c.type === 'appeared');

    // Check for error messages
    for (const element of newElements) {
      if (looksLikeErrorMessage(element.description)) {
        recommendations.push({
          id: generateId(),
          type: 'element_exists',
          description: `检测到可能的错误提示: "${element.description}"`,
          confidence: element.confidence * 70,
          reason: '检测到可能的错误消息，请验证是否为预期行为',
          parameters: {
            target: element.description,
          },
          yamlOutput: `- ai: "验证页面没有显示错误提示"`,
          source: 'rule',
        });
      }
    }

    // Add general error check for critical actions
    if (recommendations.length === 0) {
      recommendations.push({
        id: generateId(),
        type: 'element_exists',
        description: '验证没有错误提示出现',
        confidence: 50,
        reason: '关键操作应确保没有错误发生',
        parameters: {},
        yamlOutput: `- ai: "验证页面没有显示任何错误信息"`,
        source: 'rule',
      });
    }

    return recommendations;
  }
}

/**
 * All available strategies
 */
export const ALL_STRATEGIES: AssertionStrategy[] = [
  new SuccessMessageStrategy(),
  new NavigationStrategy(),
  new StateChangeStrategy(),
  new ElementVisibilityStrategy(),
  new DataValidationStrategy(),
  new ErrorPreventionStrategy(),
];

/**
 * Get strategies sorted by priority
 */
export function getStrategiesByPriority(): AssertionStrategy[] {
  return [...ALL_STRATEGIES].sort((a, b) => b.priority - a.priority);
}
