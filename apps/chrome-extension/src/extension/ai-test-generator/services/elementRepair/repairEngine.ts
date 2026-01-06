/**
 * Repair Engine Service
 * Generates repair suggestions and applies repairs based on selected elements
 */

import type { ChromeExtensionProxyPageAgent } from '@midscene/web/chrome-extension';
import type {
  ElementSelector,
  IRepairEngine,
  RepairOptions,
  RepairResult,
  RepairSuggestion,
  SelectedElement,
} from '../../types/elementRepair';
import { elementSelector } from './elementSelector';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate repair confidence based on various factors
 */
function calculateConfidence(
  selectedElement: SelectedElement,
  options: RepairOptions,
  selectorType: string,
): number {
  let confidence = 50; // Base confidence

  // Boost for semantic description match
  if (selectedElement.semanticDescription) {
    const descLower = selectedElement.semanticDescription.toLowerCase();
    const originalLower = options.originalDescription.toLowerCase();

    // Check for keyword overlap
    const originalWords = originalLower.split(/\s+/);
    const matchingWords = originalWords.filter(word =>
      word.length > 2 && descLower.includes(word),
    );

    confidence += Math.min(matchingWords.length * 10, 30);
  }

  // Boost for stable selector types
  if (selectorType === 'data-testid') {
    confidence += 20;
  } else if (selectorType === 'css' && selectedElement.attributes.id) {
    confidence += 15;
  } else if (selectorType === 'text') {
    confidence += 10;
  }

  // Reduce if failure reason suggests dynamic content
  if (options.failureReason.includes('timeout') || options.failureReason.includes('not visible')) {
    confidence -= 10;
  }

  return Math.min(Math.max(confidence, 0), 100);
}

/**
 * Repair Engine Implementation
 */
export class RepairEngine implements IRepairEngine {
  private agent: ChromeExtensionProxyPageAgent | null = null;
  private repairHistory: Map<string, RepairResult[]> = new Map();

  /**
   * Set the agent for AI operations
   */
  setAgent(agent: ChromeExtensionProxyPageAgent): void {
    this.agent = agent;
    elementSelector.setAgent(agent);
  }

  /**
   * Generate repair suggestions based on selected element
   */
  async generateSuggestions(
    selectedElement: SelectedElement,
    options: RepairOptions,
  ): Promise<RepairSuggestion[]> {
    const suggestions: RepairSuggestion[] = [];
    const { originalDescription, originalSelector, failureReason } = options;

    // Suggestion 1: Update selector with best suggested selector
    const bestSelector = selectedElement.suggestedSelectors[0];
    if (bestSelector && bestSelector.value !== originalSelector) {
      suggestions.push({
        id: generateId(),
        actionType: 'update_selector',
        title: '更新元素选择器',
        description: `使用 ${bestSelector.type} 选择器: ${bestSelector.value.slice(0, 50)}${bestSelector.value.length > 50 ? '...' : ''}`,
        currentValue: originalSelector || '无',
        suggestedValue: bestSelector.value,
        confidence: calculateConfidence(selectedElement, options, bestSelector.type),
        impact: this.assessImpact(failureReason, 'update_selector'),
      });
    }

    // Suggestion 2: Update semantic description
    if (selectedElement.semanticDescription && selectedElement.semanticDescription !== originalDescription) {
      suggestions.push({
        id: generateId(),
        actionType: 'update_description',
        title: '更新语义描述',
        description: `使用 AI 生成的语义描述: "${selectedElement.semanticDescription.slice(0, 50)}..."`,
        currentValue: originalDescription,
        suggestedValue: selectedElement.semanticDescription,
        confidence: selectedElement.semanticDescription ? 85 : 50,
        impact: 'high',
      });
    }

    // Suggestion 3: Add fallback selector
    if (selectedElement.suggestedSelectors.length > 1) {
      const fallbackSelector = selectedElement.suggestedSelectors[1];
      suggestions.push({
        id: generateId(),
        actionType: 'add_fallback',
        title: '添加备用选择器',
        description: `添加 ${fallbackSelector.type} 作为备用选择器`,
        currentValue: '无备用选择器',
        suggestedValue: fallbackSelector.value,
        confidence: calculateConfidence(selectedElement, options, fallbackSelector.type) - 10,
        impact: 'medium',
      });
    }

    // Suggestion 4: Add wait condition (if failure reason suggests timing issue)
    if (failureReason.includes('timeout') || failureReason.includes('not found')) {
      suggestions.push({
        id: generateId(),
        actionType: 'add_wait_condition',
        title: '添加等待条件',
        description: '添加元素可见性等待，确保元素加载完成',
        currentValue: '无等待条件',
        suggestedValue: 'waitForElement({ visible: true, timeout: 5000 })',
        confidence: 75,
        impact: 'high',
      });
    }

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Apply repair suggestion
   */
  async applyRepair(
    suggestion: RepairSuggestion,
    selectedElement: SelectedElement,
    options: RepairOptions,
  ): Promise<RepairResult> {
    const startTime = Date.now();
    let success = false;
    let validationResult: RepairResult['validationResult'] | undefined;

    switch (suggestion.actionType) {
      case 'update_selector':
      case 'add_fallback':
        // Validate the new selector
        const isValid = await elementSelector.validateSelector(suggestion.suggestedValue);
        if (isValid) {
          success = true;
          validationResult = {
            elementFound: true,
            elementPosition: selectedElement.center,
          };
        }
        break;

      case 'update_description':
        // Validate by trying to locate with semantic description
        if (this.agent && selectedElement.semanticDescription) {
          try {
            const result = await this.agent.aiLocate(selectedElement.semanticDescription);
            if (result.center && result.rect) {
              success = true;
              validationResult = {
                elementFound: true,
                elementPosition: result.center,
              };
            }
          } catch {
            // Validation failed
          }
        } else {
          // Description update doesn't need validation
          success = true;
        }
        break;

      case 'add_wait_condition':
        // Wait conditions are always valid
        success = true;
        break;
    }

    const repairResult: RepairResult = {
      success,
      repairId: generateId(),
      appliedRepair: {
        actionType: suggestion.actionType,
        oldValue: suggestion.currentValue,
        newValue: suggestion.suggestedValue,
      },
      validationResult,
      timestamp: Date.now(),
    };

    // Store in history
    const history = this.repairHistory.get(options.stepId) || [];
    history.push(repairResult);
    this.repairHistory.set(options.stepId, history);

    return repairResult;
  }

  /**
   * Validate repair result
   */
  async validateRepair(result: RepairResult): Promise<boolean> {
    if (!result.validationResult) {
      return result.success;
    }

    return result.validationResult.elementFound;
  }

  /**
   * Get repair history
   */
  async getRepairHistory(stepId?: string): Promise<RepairResult[]> {
    if (stepId) {
      return this.repairHistory.get(stepId) || [];
    }

    // Return all history
    const allResults: RepairResult[] = [];
    for (const history of this.repairHistory.values()) {
      allResults.push(...history);
    }
    return allResults.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear repair history
   */
  clearHistory(stepId?: string): void {
    if (stepId) {
      this.repairHistory.delete(stepId);
    } else {
      this.repairHistory.clear();
    }
  }

  /**
   * Get repair statistics
   */
  getStatistics(): {
    totalRepairs: number;
    successfulRepairs: number;
    failedRepairs: number;
    averageConfidence: number;
  } {
    const allResults: RepairResult[] = [];
    for (const history of this.repairHistory.values()) {
      allResults.push(...history);
    }

    const totalRepairs = allResults.length;
    const successfulRepairs = allResults.filter(r => r.success).length;
    const failedRepairs = totalRepairs - successfulRepairs;

    return {
      totalRepairs,
      successfulRepairs,
      failedRepairs,
      averageConfidence: totalRepairs > 0 ? Math.round((successfulRepairs / totalRepairs) * 100) : 0,
    };
  }

  // ==================== Private Methods ====================

  /**
   * Assess the impact of a repair action
   */
  private assessImpact(failureReason: string, actionType: string): 'high' | 'medium' | 'low' {
    // High impact fixes for common failures
    if (failureReason.includes('not found') || failureReason.includes('timeout')) {
      if (actionType === 'update_selector' || actionType === 'add_wait_condition') {
        return 'high';
      }
    }

    // Medium impact for fallback selectors
    if (actionType === 'add_fallback') {
      return 'medium';
    }

    // Low impact for description updates (cosmetic)
    if (actionType === 'update_description') {
      return 'low';
    }

    return 'medium';
  }
}

// Export singleton instance
export const repairEngine = new RepairEngine();
