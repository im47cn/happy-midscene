/**
 * Detector Engine
 * Detects sensitive data in text using configurable rules
 */

import type {
  DetectionResult,
  DetectionRule,
  IDetectorEngine,
  MaskingScope,
} from '../../types/masking';
import { BUILT_IN_RULES } from './builtInRules';

/**
 * DetectorEngine implementation
 * Scans text for sensitive data using regex patterns
 */
export class DetectorEngine implements IDetectorEngine {
  private rules: Map<string, DetectionRule> = new Map();

  constructor() {
    // Load built-in rules
    for (const rule of BUILT_IN_RULES) {
      this.rules.set(rule.id, { ...rule });
    }
  }

  /**
   * Detect sensitive data in text
   * @param text - The text to scan
   * @param scope - Optional scope filter
   * @returns Array of detection results
   */
  async detect(
    text: string,
    scope?: keyof MaskingScope,
  ): Promise<DetectionResult[]> {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const results: DetectionResult[] = [];

    // Get enabled rules sorted by priority
    const enabledRules = this.getEnabledRulesSorted(scope);

    for (const rule of enabledRules) {
      const matches = this.matchRule(text, rule);
      results.push(...matches);
    }

    // Merge overlapping matches (higher priority rules win)
    return this.mergeOverlappingResults(results);
  }

  /**
   * Add a custom rule
   */
  addRule(rule: DetectionRule): void {
    this.rules.set(rule.id, { ...rule });
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    // Only allow removing non-built-in rules
    if (rule && !rule.builtIn) {
      this.rules.delete(ruleId);
    }
  }

  /**
   * Enable a rule
   */
  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  /**
   * Disable a rule
   */
  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  /**
   * Get all rules
   */
  getRules(): DetectionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a specific rule
   */
  getRule(ruleId: string): DetectionRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get enabled rules sorted by priority
   */
  private getEnabledRulesSorted(scope?: keyof MaskingScope): DetectionRule[] {
    return Array.from(this.rules.values())
      .filter((rule) => {
        if (!rule.enabled) return false;
        if (scope && !rule.scope[scope]) return false;
        return true;
      })
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Match a rule against text
   */
  private matchRule(text: string, rule: DetectionRule): DetectionResult[] {
    const results: DetectionResult[] = [];

    if (rule.detection.type !== 'regex') {
      // Currently only regex is supported
      return results;
    }

    try {
      const regex = new RegExp(
        rule.detection.pattern,
        rule.detection.flags || 'g',
      );
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        // Check context if specified
        if (!this.checkContext(text, match, rule.detection.context)) {
          continue;
        }

        // Get the matched value (use capture group if exists, otherwise full match)
        const value = match[1] || match[0];
        const startPos = match[1]
          ? match.index + match[0].indexOf(match[1])
          : match.index;

        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          position: {
            start: startPos,
            end: startPos + value.length,
          },
          value,
        });

        // Prevent infinite loop for zero-width matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } catch (error) {
      console.warn(`Failed to match rule ${rule.id}:`, error);
    }

    return results;
  }

  /**
   * Check context constraints
   */
  private checkContext(
    text: string,
    match: RegExpExecArray,
    context?: { before?: string; after?: string },
  ): boolean {
    if (!context) return true;

    // Check "before" context
    if (context.before) {
      const beforeStart = Math.max(0, match.index - 50);
      const beforeText = text.substring(beforeStart, match.index);
      if (!new RegExp(context.before, 'i').test(beforeText)) {
        return false;
      }
    }

    // Check "after" context
    if (context.after) {
      const afterEnd = Math.min(
        text.length,
        match.index + match[0].length + 50,
      );
      const afterText = text.substring(match.index + match[0].length, afterEnd);
      if (!new RegExp(context.after, 'i').test(afterText)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Merge overlapping detection results
   * Higher priority rules take precedence
   */
  private mergeOverlappingResults(
    results: DetectionResult[],
  ): DetectionResult[] {
    if (results.length <= 1) {
      return results;
    }

    // Sort by start position
    const sorted = [...results].sort(
      (a, b) => a.position.start - b.position.start,
    );
    const merged: DetectionResult[] = [];
    const usedRanges: Array<{ start: number; end: number }> = [];

    for (const result of sorted) {
      // Check if this result overlaps with any used range
      const overlaps = usedRanges.some(
        (range) =>
          result.position.start < range.end &&
          result.position.end > range.start,
      );

      if (!overlaps) {
        merged.push(result);
        usedRanges.push({
          start: result.position.start,
          end: result.position.end,
        });
      }
    }

    return merged;
  }
}

/**
 * Default detector engine instance
 */
export const detectorEngine = new DetectorEngine();
