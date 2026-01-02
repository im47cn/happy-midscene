/**
 * Assertion Generator for Smart Assertion System
 * Generates assertion recommendations based on context analysis
 */

import type {
  ActionContext,
  AnalysisResult,
  AssertionRecommendation,
  AssertionStrategy,
  SmartAssertionConfig,
  AssertionTemplate,
} from '../../types/assertion';
import { DEFAULT_SMART_ASSERTION_CONFIG } from '../../types/assertion';
import { contextCollector } from './contextCollector';
import { changeDetector } from './changeDetector';
import { intentInferrer } from './intentInferrer';
import { getStrategiesByPriority, ALL_STRATEGIES } from './strategies';

/**
 * Deduplicate recommendations by type and target
 */
function deduplicateRecommendations(
  recommendations: AssertionRecommendation[]
): AssertionRecommendation[] {
  const seen = new Set<string>();
  const unique: AssertionRecommendation[] = [];

  for (const rec of recommendations) {
    const key = `${rec.type}|${rec.parameters.target || ''}|${rec.parameters.expectedValue || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(rec);
    }
  }

  return unique;
}

/**
 * Assertion Generator class
 */
class AssertionGenerator {
  private config: SmartAssertionConfig = DEFAULT_SMART_ASSERTION_CONFIG;
  private strategies: AssertionStrategy[] = [];
  private templates: AssertionTemplate[] = [];

  constructor() {
    this.strategies = getStrategiesByPriority();
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<SmartAssertionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SmartAssertionConfig {
    return { ...this.config };
  }

  /**
   * Set assertion templates
   */
  setTemplates(templates: AssertionTemplate[]): void {
    this.templates = templates;
  }

  /**
   * Add custom strategy
   */
  addStrategy(strategy: AssertionStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Analyze step and generate assertion recommendations
   */
  async analyzeAndGenerate(
    stepId: string,
    stepIndex: number,
    stepText: string,
    beforeUrl: string,
    afterUrl: string
  ): Promise<{
    analysis: AnalysisResult;
    recommendations: AssertionRecommendation[];
  }> {
    if (!this.config.enabled) {
      return {
        analysis: {
          needsAssertion: false,
          assertionTypes: [],
          changes: [],
          intent: 'unknown',
          confidence: 0,
        },
        recommendations: [],
      };
    }

    // Create context
    const context = contextCollector.createContextFromResult(
      stepId,
      stepIndex,
      stepText,
      beforeUrl,
      afterUrl
    );

    // Add visual changes if available
    const changes = changeDetector.detectChanges();
    context.pageState.visibleChanges = changes;

    // Add URL change if present
    const urlChange = changeDetector.detectUrlChange(beforeUrl, afterUrl);
    if (urlChange) {
      context.pageState.visibleChanges.push(urlChange);
    }

    // Analyze context
    const analysis = intentInferrer.analyze(context);

    // Generate recommendations if assertion needed
    let recommendations: AssertionRecommendation[] = [];
    if (analysis.needsAssertion || this.config.autoSuggest) {
      recommendations = await this.generate(context, analysis);
    }

    return { analysis, recommendations };
  }

  /**
   * Generate assertion recommendations
   */
  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const allRecommendations: AssertionRecommendation[] = [];

    // Apply strategies
    for (const strategy of this.strategies) {
      try {
        if (strategy.applies(context, analysis)) {
          const strategyRecs = await strategy.generate(context, analysis);
          allRecommendations.push(...strategyRecs);
        }
      } catch (error) {
        console.debug(`Strategy ${strategy.name} failed:`, error);
      }
    }

    // Apply templates if enabled
    if (this.config.enableTemplates) {
      const templateRecs = await this.applyTemplates(context, analysis);
      allRecommendations.push(...templateRecs);
    }

    // Process recommendations
    const processed = this.processRecommendations(allRecommendations);

    return processed;
  }

  /**
   * Apply matching templates
   */
  private async applyTemplates(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const recommendations: AssertionRecommendation[] = [];

    for (const template of this.templates) {
      // Check category filter
      if (!this.config.templateCategories.includes(template.category)) {
        continue;
      }

      // Check trigger conditions
      if (this.matchesTrigger(template.trigger, context, analysis)) {
        recommendations.push({
          id: `tpl-${template.id}-${Date.now()}`,
          type: template.assertion.type,
          description: template.description,
          confidence: 80, // Template matches are reasonably confident
          reason: `匹配模板: ${template.name}`,
          parameters: template.assertion.parameters as any,
          yamlOutput: this.generateYamlFromTemplate(template),
          source: 'template',
        });
      }
    }

    return recommendations;
  }

  /**
   * Check if template trigger matches context
   */
  private matchesTrigger(
    trigger: AssertionTemplate['trigger'],
    context: ActionContext,
    analysis: AnalysisResult
  ): boolean {
    // Check action type
    if (trigger.actionType && trigger.actionType !== context.action.type) {
      return false;
    }

    // Check intent pattern
    if (trigger.intentPattern) {
      const regex = new RegExp(trigger.intentPattern, 'i');
      if (!regex.test(analysis.intent)) {
        return false;
      }
    }

    // Check element pattern
    if (trigger.elementPattern) {
      const regex = new RegExp(trigger.elementPattern, 'i');
      const targetText = context.semantic.targetSemantics;
      if (!regex.test(targetText)) {
        return false;
      }
    }

    // Check URL pattern
    if (trigger.urlPattern) {
      const regex = new RegExp(trigger.urlPattern, 'i');
      if (!regex.test(context.pageState.afterUrl)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate YAML from template
   */
  private generateYamlFromTemplate(template: AssertionTemplate): string {
    const { type, parameters } = template.assertion;

    switch (type) {
      case 'text_contains':
        return `- aiAssert: "页面包含文本 '${parameters.expectedValue || ''}'"`
      case 'element_visible':
        return `- aiAssert: "元素 '${parameters.target || ''}' 可见"`;
      case 'url_contains':
        return `- aiAssert: "当前 URL 包含 '${parameters.expectedValue || ''}'"`;
      default:
        return `- ai: "验证 ${template.description}"`;
    }
  }

  /**
   * Process and filter recommendations
   */
  private processRecommendations(
    recommendations: AssertionRecommendation[]
  ): AssertionRecommendation[] {
    // Deduplicate
    let processed = deduplicateRecommendations(recommendations);

    // Filter by minimum confidence
    processed = processed.filter(
      rec => rec.confidence >= this.config.minConfidence
    );

    // Sort by confidence
    processed.sort((a, b) => b.confidence - a.confidence);

    // Limit to max recommendations
    processed = processed.slice(0, this.config.maxRecommendations);

    return processed;
  }

  /**
   * Convert recommendation to YAML assertion
   */
  toYaml(recommendation: AssertionRecommendation): string {
    return recommendation.yamlOutput;
  }

  /**
   * Convert multiple recommendations to YAML
   */
  toYamlBatch(recommendations: AssertionRecommendation[]): string {
    return recommendations
      .map(rec => rec.yamlOutput)
      .join('\n');
  }

  /**
   * Start monitoring for changes (call before action)
   */
  startMonitoring(stepId: string, stepIndex: number, stepText: string): void {
    contextCollector.startCollection(stepId, stepIndex, stepText);
    changeDetector.startDetection();
  }

  /**
   * Complete monitoring and get recommendations (call after action)
   */
  async completeMonitoring(): Promise<{
    analysis: AnalysisResult;
    recommendations: AssertionRecommendation[];
  }> {
    const context = contextCollector.completeCollection();
    if (!context) {
      return {
        analysis: {
          needsAssertion: false,
          assertionTypes: [],
          changes: [],
          intent: 'unknown',
          confidence: 0,
        },
        recommendations: [],
      };
    }

    // Get visual changes
    context.pageState.visibleChanges = changeDetector.detectChanges();

    // Analyze and generate
    const analysis = intentInferrer.analyze(context);
    let recommendations: AssertionRecommendation[] = [];

    if (analysis.needsAssertion || this.config.autoSuggest) {
      recommendations = await this.generate(context, analysis);
    }

    return { analysis, recommendations };
  }

  /**
   * Cancel current monitoring
   */
  cancelMonitoring(): void {
    contextCollector.cancelCollection();
    changeDetector.reset();
  }
}

// Export singleton instance
export const assertionGenerator = new AssertionGenerator();

// Export class for testing
export { AssertionGenerator };
