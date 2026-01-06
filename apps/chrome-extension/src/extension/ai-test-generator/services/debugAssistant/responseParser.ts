/**
 * Response Parser for Debug Assistant
 * Parses LLM responses to extract actions, suggestions, and text content
 */

import type {
  DebugAction,
  DebugActionType,
  FixSuggestion,
  FixSuggestionType,
  ParsedResponse,
} from '../../types/debugAssistant';

export interface ParseResult extends ParsedResponse {
  rawResponse: string;
  confidence: number;
}

export interface ResponseParserOptions {
  actionPattern?: string;
  suggestionPattern?: string;
  confidenceThreshold?: number;
}

/**
 * Response Parser - extracts structured data from LLM responses
 */
export class ResponseParser {
  private actionPattern: RegExp;
  private suggestionPattern: RegExp;
  private confidenceThreshold: number;

  constructor(options?: ResponseParserOptions) {
    this.actionPattern = options?.actionPattern
      ? new RegExp(options.actionPattern, 'gi')
      : /\[ACTION:\s*([a-z_]+)(?:\s*:\s*([^\]:]*))?(?:\s*:\s*([^\]]*))?\]/gi;

    this.suggestionPattern = options?.suggestionPattern
      ? new RegExp(options.suggestionPattern, 'gi')
      : /\[SUGGESTION:\s*([^\|\]]+)(?:\s*\|\s*([^\]]*))?\]/gi;

    this.confidenceThreshold = options?.confidenceThreshold ?? 0.5;
  }

  /**
   * Parse LLM response into structured components
   */
  parse(response: string): ParseResult {
    const trimmed = response.trim();

    // Extract context request first
    const contextRequest = this.parseContextRequest(trimmed);

    // Extract actions
    const actions = this.extractActions(trimmed);

    // Extract suggestions
    const suggestions = this.extractSuggestions(trimmed);

    // Calculate confidence based on response quality
    const confidence = this.calculateConfidence(trimmed, actions, suggestions);

    // Clean text by removing special tags
    let text = this.cleanResponse(trimmed);

    // Format text for better readability
    text = this.formatText(text);

    return {
      text,
      actions,
      suggestions,
      rawResponse: response,
      confidence,
      contextRequest: contextRequest ?? null,
    };
  }

  /**
   * Extract action commands from response
   */
  extractActions(response: string): DebugAction[] {
    const actions: DebugAction[] = [];
    const matches = [...response.matchAll(this.actionPattern)];

    for (const match of matches) {
      const [, type, target, value] = match;
      const actionType = this.normalizeActionType(type);

      if (actionType) {
        actions.push({
          id: this.generateId(),
          type: actionType,
          target: target?.trim() || undefined,
          value: value?.trim() || undefined,
          options: this.parseActionOptions(actionType, value),
        });
      }
    }

    return actions;
  }

  /**
   * Extract fix suggestions from response
   * Handles formats: [SUGGESTION:description], [SUGGESTION:description|code], [SUGGESTION:description|code|confidence]
   */
  extractSuggestions(response: string): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    // First, find all [SUGGESTION:...] tags
    const suggestionTags = response.match(/\[SUGGESTION:[^\]]+\]/gi) || [];

    for (const tag of suggestionTags) {
      // Use the parseSuggestion method which handles all formats correctly
      const suggestion = this.parseSuggestion(tag);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Also try to extract suggestions from natural language
    const nlSuggestions = this.extractNaturalLanguageSuggestions(response);
    suggestions.push(...nlSuggestions);

    return suggestions;
  }

  /**
   * Strip all tags from text, keeping only plain content
   */
  stripTags(text: string): string {
    let cleaned = text;

    // Remove action tags
    cleaned = cleaned.replace(this.actionPattern, '');

    // Remove suggestion tags
    cleaned = cleaned.replace(this.suggestionPattern, '');

    // Remove context tags
    cleaned = cleaned.replace(/\[CONTEXT:[^\]]*\]/gi, '');

    return cleaned;
  }

  /**
   * Public method to parse actions from text
   */
  parseActions(text: string): DebugAction[] {
    return this.extractActions(text);
  }

  /**
   * Parse a single action from text
   */
  parseAction(text: string): DebugAction | null {
    const matches = [...text.matchAll(this.actionPattern)];
    if (matches.length === 0) return null;

    const match = matches[0];
    const [, type, target, value] = match;
    const actionType = this.normalizeActionType(type);

    if (!actionType) return null;

    // Actions that require a target
    const actionsRequiringTarget: DebugActionType[] = [
      'click',
      'input',
      'scroll',
      'highlight',
      'locate',
      'describe',
      'compare',
    ];

    const trimmedTarget = target?.trim();
    if (actionsRequiringTarget.includes(actionType) && !trimmedTarget) {
      return null;
    }

    return {
      id: this.generateId(),
      type: actionType,
      target: trimmedTarget || '',
      value: value?.trim(),
    };
  }

  /**
   * Public method to parse suggestions from text
   */
  parseSuggestions(text: string): FixSuggestion[] {
    return this.extractSuggestions(text);
  }

  /**
   * Parse a single suggestion from text
   * Handles formats: [SUGGESTION:description], [SUGGESTION:description|code], [SUGGESTION:description|code|confidence]
   * Code can contain pipe characters.
   */
  parseSuggestion(text: string): FixSuggestion | null {
    // Match [SUGGESTION:...] and capture everything inside
    const fullMatch = text.match(/\[SUGGESTION:(.*)\]/is);
    if (!fullMatch) return null;

    const innerContent = fullMatch[1].trim();

    // Try to parse from the end - look for confidence number at the end
    // Pattern: ...|code|0.8 or ...|code|.8
    const confidenceMatch = innerContent.match(/\|(\d*\.?\d+)\s*$/);
    let confidence = 0.7; // default
    let remainingContent = innerContent;

    if (confidenceMatch) {
      confidence = Math.min(
        1,
        Math.max(0, Number.parseFloat(confidenceMatch[1])),
      );
      // Remove confidence from content
      remainingContent = innerContent
        .substring(0, innerContent.lastIndexOf('|'))
        .trim();
    }

    // Now we have either: description or description|code
    // Split on first pipe
    const firstPipeIndex = remainingContent.indexOf('|');

    let description: string;
    let code = '';

    if (firstPipeIndex === -1) {
      // Only description
      description = remainingContent;
    } else {
      // description|code
      description = remainingContent.substring(0, firstPipeIndex).trim();
      code = remainingContent.substring(firstPipeIndex + 1).trim();
    }

    if (!description) return null;

    const suggestionType = this.inferSuggestionType(description, code);
    return {
      id: this.generateId(),
      type: suggestionType,
      description: description.trim(),
      confidence,
      code, // Return empty string when no code, not undefined
      beforeAfter: code ? this.extractBeforeAfter(code) : undefined,
    };
  }

  /**
   * Parse context request from text
   */
  parseContextRequest(text: string): { type: string; details: string } | null {
    const contextPattern = /\[CONTEXT:([^\]:]+):?([^\]]*)\]/i;
    const match = text.match(contextPattern);

    if (match) {
      const [, type, details] = match;
      return {
        type: type.trim(),
        details: details?.trim() || '',
      };
    }

    return null;
  }

  /**
   * Clean response by removing action and suggestion tags
   */
  private cleanResponse(response: string): string {
    let cleaned = this.stripTags(response);

    // Remove code block markers if they're empty
    cleaned = cleaned.replace(/^```\s*$/gm, '');

    return cleaned;
  }

  /**
   * Format text for better readability
   */
  private formatText(text: string): string {
    // Normalize line endings
    let formatted = text.replace(/\r\n/g, '\n');

    // Remove excessive blank lines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    // Trim whitespace
    formatted = formatted.trim();

    return formatted;
  }

  /**
   * Normalize action type string to enum value
   */
  private normalizeActionType(type: string): DebugActionType | null {
    const normalized = type.toLowerCase().trim();

    const validTypes: Record<string, DebugActionType> = {
      click: 'click',
      input: 'input',
      type: 'input',
      scroll: 'scroll',
      refresh: 'refresh',
      reload: 'refresh',
      highlight: 'highlight',
      screenshot: 'screenshot',
      wait: 'wait',
      sleep: 'wait',
      compare: 'compare',
      describe: 'describe',
      locate: 'locate',
      find: 'locate',
    };

    return validTypes[normalized] || null;
  }

  /**
   * Parse action options from value string
   */
  private parseActionOptions(type: DebugActionType, value?: string): any {
    if (!value) return undefined;

    const options: Record<string, any> = {};

    switch (type) {
      case 'wait':
      case 'sleep':
        // Parse duration: "2000ms", "2s", "2"
        const durationMatch = value.match(/(\d+)\s*(ms|s)?/i);
        if (durationMatch) {
          const amount = Number.parseInt(durationMatch[1], 10);
          const unit = durationMatch[2]?.toLowerCase();
          options.timeout = unit === 's' ? amount * 1000 : amount;
        }
        break;

      case 'scroll':
        // Parse direction: "up", "down", "left", "right"
        if (value.toLowerCase().includes('up')) options.scrollDirection = 'up';
        else if (value.toLowerCase().includes('down'))
          options.scrollDirection = 'down';
        else if (value.toLowerCase().includes('left'))
          options.scrollDirection = 'left';
        else if (value.toLowerCase().includes('right'))
          options.scrollDirection = 'right';
        break;

      case 'click':
      case 'highlight':
      case 'locate':
        // Parse index: "button 2", "第三个按钮"
        const indexMatch = value.match(
          /(\d+)|第([一二三四五六七八九十百千万]+)[个些]/,
        );
        if (indexMatch) {
          const num = this.chineseToNumber(indexMatch[1] || indexMatch[2]);
          if (!Number.isNaN(num)) options.index = num;
        }
        break;
    }

    return Object.keys(options).length > 0 ? options : undefined;
  }

  /**
   * Convert Chinese number to Arabic numeral
   */
  private chineseToNumber(chinese: string): number {
    const map: Record<string, number> = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };

    if (Number.isInteger(Number(chinese))) {
      return Number(chinese);
    }

    for (const [key, value] of Object.entries(map)) {
      if (chinese.includes(key)) return value;
    }

    return Number.NaN;
  }

  /**
   * Infer suggestion type from description and code
   */
  private inferSuggestionType(
    description: string,
    code?: string,
  ): FixSuggestionType {
    const desc = description.toLowerCase();

    // Check for code changes
    if (code && code.includes('- ai:')) {
      return 'code_change';
    }

    // Check for wait time suggestions
    if (
      desc.includes('等待') ||
      desc.includes('延迟') ||
      desc.includes('wait') ||
      desc.includes('sleep') ||
      desc.includes('超时')
    ) {
      return 'wait_time';
    }

    // Check for locator changes
    if (
      desc.includes('定位') ||
      desc.includes('选择器') ||
      desc.includes('locator') ||
      desc.includes('selector') ||
      desc.includes('找不到')
    ) {
      return 'locator_change';
    }

    // Check for pre-action
    if (
      desc.includes('先') ||
      desc.includes('前置') ||
      desc.includes('之前') ||
      desc.includes('before')
    ) {
      return 'pre_action';
    }

    // Default to code_change
    return 'code_change';
  }

  /**
   * Estimate confidence score for a suggestion
   */
  private estimateConfidence(description: string, code?: string): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if code is provided
    if (code) {
      confidence += 0.2;
    }

    // Higher confidence for specific, actionable descriptions
    const specificPatterns = [
      /点击|click/i,
      /等待|wait/i,
      /刷新|refresh/i,
      /输入|input|type/i,
      /定位|locator|selector/i,
    ];

    for (const pattern of specificPatterns) {
      if (pattern.test(description)) {
        confidence += 0.1;
      }
    }

    // Lower confidence for vague suggestions
    // Use word boundaries to avoid matching substrings like "retry" containing "try"
    const vaguePatterns = [/可能|maybe|perhaps/i, /\b(?:试试|try|尝试)\b/i];
    for (const pattern of vaguePatterns) {
      if (pattern.test(description)) {
        confidence -= 0.15;
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract before/after code for diff display
   */
  private extractBeforeAfter(
    code: string,
  ): { before: string; after: string } | undefined {
    const lines = code.split('\n');

    // Look for patterns like "- ai: old" and "+ ai: new"
    const beforeLine = lines.find((l) => l.trim().startsWith('-'));
    const afterLine = lines.find((l) => l.trim().startsWith('+'));

    if (beforeLine && afterLine) {
      return {
        before: beforeLine.replace(/^\+\s*/, ''),
        after: afterLine.replace(/^-\s*/, ''),
      };
    }

    return undefined;
  }

  /**
   * Extract suggestions from natural language (without tags)
   */
  private extractNaturalLanguageSuggestions(response: string): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    // Pattern: "建议..." or "推荐..." (use word boundaries to avoid matching within words)
    const suggestPatterns = [
      /(?:建议|推荐|可以尝试)(?:[:：])?\s*([^\n.]+(?:[。\n]|$))/gi,
      /\b(?:suggest|recommend|try)\b(?:[:：])?\s*([^\n.]+(?:[.\n]|$))/gi,
    ];

    for (const pattern of suggestPatterns) {
      const matches = [...response.matchAll(pattern)];
      for (const match of matches) {
        const description = match[1]?.trim();
        if (description && !this.isInTag(description, response)) {
          suggestions.push({
            id: this.generateId(),
            type: 'retry',
            description,
            confidence: 0.5,
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Check if text is within a tag (already extracted)
   */
  private isInTag(text: string, fullResponse: string): boolean {
    const index = fullResponse.indexOf(text);
    if (index === -1) return false;

    // Check if there's a tag before this text
    const before = fullResponse.substring(0, index);
    const tagAfter = before.lastIndexOf('[');
    const tagCloseBefore = before.lastIndexOf(']');

    // If we're inside unclosed brackets, it's in a tag
    return tagAfter > tagCloseBefore && tagAfter !== -1;
  }

  /**
   * Calculate overall confidence for the response
   */
  private calculateConfidence(
    response: string,
    actions: DebugAction[],
    suggestions: FixSuggestion[],
  ): number {
    let confidence = 0.5;

    // Higher confidence if response is well-structured
    if (actions.length > 0 || suggestions.length > 0) {
      confidence += 0.2;
    }

    // Higher confidence for longer, more detailed responses
    if (response.length > 100) {
      confidence += 0.1;
    }

    // Higher confidence if response contains actionable content
    const actionablePatterns = [
      /点击|click/i,
      /输入|input/i,
      /等待|wait/i,
      /高亮|highlight/i,
      /刷新|refresh/i,
    ];

    for (const pattern of actionablePatterns) {
      if (pattern.test(response)) {
        confidence += 0.05;
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update parser options
   */
  updateOptions(options: Partial<ResponseParserOptions>): void {
    if (options.actionPattern) {
      this.actionPattern = new RegExp(options.actionPattern, 'gi');
    }
    if (options.suggestionPattern) {
      this.suggestionPattern = new RegExp(options.suggestionPattern, 'gi');
    }
    if (options.confidenceThreshold !== undefined) {
      this.confidenceThreshold = options.confidenceThreshold;
    }
  }
}

// Export singleton getter
let parserInstance: ResponseParser | null = null;

export function getResponseParser(
  options?: ResponseParserOptions,
): ResponseParser {
  if (!parserInstance) {
    parserInstance = new ResponseParser(options);
  }
  return parserInstance;
}

export function resetResponseParser(): void {
  parserInstance = null;
}
