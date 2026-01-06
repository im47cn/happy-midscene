/**
 * Reference Resolver Service
 * Resolves references in LLM responses to actual actions and elements
 */

import type { DebugAction, FixSuggestion, DebugContext } from '../../types/debugAssistant';

export interface ResolvedReference {
  type: 'action' | 'element' | 'suggestion' | 'variable';
  value: any;
  confidence: number;
  source: string;
}

export interface ResolveOptions {
  context: DebugContext;
  fuzzyMatch?: boolean;
  requireConfidence?: number;
}

/**
 * Reference Resolver - resolves references in LLM responses
 */
export class ReferenceResolver {
  /**
   * Resolve a text reference to an element
   */
  static async resolveElementReference(
    text: string,
    options: ResolveOptions,
  ): Promise<ResolvedReference | null> {
    const { context, fuzzyMatch = true, requireConfidence = 0.5 } = options;

    // Check if text contains common element patterns
    const elementPatterns = [
      /(?:the|this|that|an?)\s+(?:button|input|field|link|element|text)/i,
      /['"]([^'"]+)['"]/,
      /【([^】]+)】/,
      /「([^」]+)」/,
    ];

    for (const pattern of elementPatterns) {
      const match = text.match(pattern);
      if (match) {
        const elementText = match[1] || match[0];

        return {
          type: 'element',
          value: elementText,
          confidence: this.calculateElementConfidence(elementText, context),
          source: text,
        };
      }
    }

    // Use the text directly as element reference
    if (fuzzyMatch) {
      return {
        type: 'element',
        value: text.trim(),
        confidence: 0.6,
        source: text,
      };
    }

    return null;
  }

  /**
   * Resolve an action reference
   */
  static resolveActionReference(
    text: string,
    options: ResolveOptions,
  ): DebugAction | null {
    // Parse action from text format [ACTION:type:target[:value]]
    // Target is optional for actions like screenshot, refresh
    const actionMatch = text.match(/\[ACTION:(\w+)(?::([^\]:]*))?(?::([^\]]*))?\]/);
    if (actionMatch) {
      const [, type, target, value] = actionMatch;
      return {
        id: `action-${Date.now()}`,
        type: type as DebugAction['type'],
        target: target?.trim() || '',
        value: value?.trim(),
      };
    }

    // If text starts with [ but isn't an ACTION tag, skip natural language matching
    // This prevents matching structured tags like [SUGGESTION:...]
    if (text.trimStart().startsWith('[')) {
      return null;
    }

    // Parse natural language action references
    const actionPatterns = [
      { pattern: /点击\s*(.+)/i, type: 'click' as const },
      { pattern: /click\s+(.+)/i, type: 'click' as const },
      { pattern: /输入\s*(.+?)\s*到\s*(.+)/i, type: 'input' as const },
      { pattern: /type\s+(.+?)\s+into\s+(.+)/i, type: 'input' as const },
      { pattern: /滚动\s*(.+)/i, type: 'scroll' as const },
      { pattern: /scroll\s+(.+)/i, type: 'scroll' as const },
      { pattern: /高亮\s*(.+)/i, type: 'highlight' as const },
      { pattern: /highlight\s+(.+)/i, type: 'highlight' as const },
      { pattern: /截图/i, type: 'screenshot' as const },
      { pattern: /screenshot/i, type: 'screenshot' as const },
      { pattern: /等待\s*(.+)/i, type: 'wait' as const },
      { pattern: /wait\s*(?:for\s+)?(.+)/i, type: 'wait' as const },
      { pattern: /刷新/i, type: 'refresh' as const },
      { pattern: /refresh/i, type: 'refresh' as const },
    ];

    for (const { pattern, type } of actionPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (type === 'input') {
          return {
            id: `action-${Date.now()}`,
            type,
            target: match[2]?.trim(),
            value: match[1]?.trim(),
          };
        }
        return {
          id: `action-${Date.now()}`,
          type,
          target: match[1]?.trim(),
          value: undefined,
        };
      }
    }

    return null;
  }

  /**
   * Resolve a suggestion reference
   */
  static resolveSuggestionReference(
    text: string,
    options: ResolveOptions,
  ): FixSuggestion | null {
    // Parse suggestion from text format [SUGGESTION:description|code|confidence]
    const suggestionMatch = text.match(/\[SUGGESTION:([^|]+)(?:\|([^|]*))?(?:\|([0-9.]+))?\]/);
    if (suggestionMatch) {
      const [, description, code, confidence] = suggestionMatch;
      return {
        type: this.inferSuggestionType(description),
        description: description.trim(),
        code: code?.trim() || '',
        confidence: confidence ? parseFloat(confidence) : 0.7,
      };
    }

    // Parse natural language suggestions
    const suggestionPatterns = [
      {
        pattern: /建议\s*[:：]\s*(.+?)(?:\n|$)/i,
        type: 'generic' as const,
      },
      {
        pattern: /可以尝试\s*[:：]\s*(.+?)(?:\n|$)/i,
        type: 'generic' as const,
      },
      {
        pattern: /尝试\s*(?:添加|使用)?\s*[:：]?\s*(.+?)(?:\n|$)/i,
        type: 'generic' as const,
      },
    ];

    for (const { pattern, type } of suggestionPatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type,
          description: match[1]?.trim(),
          code: '',
          confidence: 0.6,
        };
      }
    }

    return null;
  }

  /**
   * Resolve all references in a text
   */
  static resolveAllReferences(
    text: string,
    options: ResolveOptions,
  ): {
    actions: DebugAction[];
    suggestions: FixSuggestion[];
    elements: string[];
    cleanText: string;
  } {
    const actions: DebugAction[] = [];
    const suggestions: FixSuggestion[] = [];
    const elements: string[] = [];

    const lines = text.split('\n');
    const cleanLines: string[] = [];

    for (const line of lines) {
      // Check for action references
      const action = this.resolveActionReference(line, options);
      if (action) {
        actions.push(action);
        if (action.target) {
          elements.push(action.target);
        }
        // Remove action tag from clean text
        cleanLines.push(line.replace(/\[ACTION:[^\]]+\]/g, '').trim());
        continue;
      }

      // Check for suggestion references
      const suggestion = this.resolveSuggestionReference(line, options);
      if (suggestion) {
        suggestions.push(suggestion);
        // Remove suggestion tag from clean text
        cleanLines.push(line.replace(/\[SUGGESTION:[^\]]+\]/g, '').trim());
        continue;
      }

      cleanLines.push(line);
    }

    return {
      actions,
      suggestions,
      elements,
      cleanText: cleanLines.join('\n').trim(),
    };
  }

  /**
   * Infer suggestion type from description
   */
  private static inferSuggestionType(description: string): FixSuggestion['type'] {
    const desc = description.toLowerCase();

    if (desc.includes('wait') || desc.includes('等待')) {
      return 'wait';
    }
    if (desc.includes('timeout') || desc.includes('超时')) {
      return 'timeout';
    }
    if (desc.includes('locator') || desc.includes('selector') || desc.includes('选择器')) {
      return 'locator';
    }
    if (desc.includes('retry') || desc.includes('重试')) {
      return 'retry';
    }
    if (desc.includes('assertion') || desc.includes('断言')) {
      return 'assertion';
    }
    if (desc.includes('click') || desc.includes('点击')) {
      return 'action';
    }
    if (desc.includes('debug') || desc.includes('调试')) {
      return 'debug';
    }
    if (desc.includes('login') || desc.includes('auth') || desc.includes('登录') || desc.includes('认证')) {
      return 'auth';
    }
    if (desc.includes('navigate') || desc.includes('导航')) {
      return 'navigation';
    }

    return 'generic';
  }

  /**
   * Calculate confidence score for element reference
   */
  private static calculateElementConfidence(elementText: string, context: DebugContext): number {
    let confidence = 0.5;

    // Higher confidence if element text appears in execution history
    if (context.executionHistory?.some((step) => step.includes(elementText))) {
      confidence += 0.2;
    }

    // Higher confidence if element text is specific (not generic)
    const genericTerms = ['button', 'input', 'element', 'the', 'a', 'an'];
    const isGeneric = genericTerms.some((term) => elementText.toLowerCase() === term);
    if (!isGeneric) {
      confidence += 0.15;
    }

    // Higher confidence if element has quoted content
    if (/['"].+['"]/.test(elementText)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Normalize element reference
   */
  static normalizeElementReference(ref: string): string {
    // Remove quotes
    let normalized = ref.replace(/^['"]|['"]$/g, '');

    // Remove brackets
    normalized = normalized.replace(/^[【『「]|[】』」]$/g, '');

    // Trim whitespace
    normalized = normalized.trim();

    return normalized;
  }

  /**
   * Extract all references from conversation history
   */
  static extractReferencesFromHistory(
    messages: Array<{ role: string; content: string }>,
  ): {
    mentionedElements: Set<string>;
    mentionedActions: Set<string>;
    mentionedErrors: Set<string>;
  } {
    const mentionedElements = new Set<string>();
    const mentionedActions = new Set<string>();
    const mentionedErrors = new Set<string>();

    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        // Extract elements (quoted strings, bracketed content)
        // Match: 'text', "text", 【text】, 『text』, 「text」
        const elementMatches = msg.content.match(/['"]([^'"]+)['"]|【([^】]+)】|『([^』]+)』|「([^」]+)」/g) || [];
        for (const match of elementMatches) {
          const element = this.normalizeElementReference(match);
          if (element.length > 1) {
            mentionedElements.add(element);
          }
        }

        // Extract actions (click, input, etc.)
        const actionMatches = msg.content.match(/(?:点击|输入|滚动|高亮)\s*[:：]?\s*([^\n,。]+)/gi) || [];
        for (const match of actionMatches) {
          mentionedActions.add(match.trim());
        }

        // Extract errors
        const errorMatches = msg.content.match(/(?:error|错误)[:：]?\s*([^\n]+)/gi) || [];
        for (const match of errorMatches) {
          mentionedErrors.add(match.trim());
        }
      }
    }

    return {
      mentionedElements,
      mentionedActions,
      mentionedErrors,
    };
  }

  /**
   * Resolve pronoun references (it, that, this, etc.)
   */
  static resolvePronounReference(
    pronoun: string,
    context: DebugContext,
    conversationHistory: Array<{ role: string; content: string }> = [],
  ): string | null {
    const { mentionedElements, mentionedActions, mentionedErrors } =
      this.extractReferencesFromHistory(conversationHistory);

    // Get the most recently mentioned element
    const recentElements = Array.from(mentionedElements).reverse();
    const recentActions = Array.from(mentionedActions).reverse();

    const pronounLower = pronoun.toLowerCase();

    // "it", "this", "that" usually refer to elements
    if (['it', 'this', 'that', '这', '那', '它'].some((p) => pronounLower.includes(p))) {
      if (recentElements.length > 0) {
        return recentElements[0];
      }
    }

    // Fall back to current step description if no elements mentioned
    if (recentElements.length === 0 && context.currentStep?.description) {
      return context.currentStep.description;
    }

    return recentElements[0] || null;
  }

  /**
   * Validate a resolved reference
   */
  static validateResolvedReference(ref: ResolvedReference): boolean {
    if (ref.confidence < 0.3) {
      return false;
    }

    if (!ref.value || (typeof ref.value === 'string' && ref.value.trim().length === 0)) {
      return false;
    }

    return true;
  }

  /**
   * Format reference for display
   */
  static formatReference(ref: ResolvedReference): string {
    switch (ref.type) {
      case 'action':
        return `[Action: ${ref.value}]`;
      case 'element':
        return `"${ref.value}"`;
      case 'suggestion':
        return `[Suggestion: ${ref.value.description || 'N/A'}]`;
      case 'variable':
        return `${ref.value}`;
      default:
        return String(ref.value);
    }
  }
}
