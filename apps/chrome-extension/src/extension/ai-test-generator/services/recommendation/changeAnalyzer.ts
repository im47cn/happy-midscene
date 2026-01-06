/**
 * Change Analyzer
 * Analyzes code changes and their impact on test cases
 */

import type { CaseStats } from '../../types/analytics';
import type {
  CaseCorrelation,
  ChangeImpact,
  ChangeInfo,
} from '../../types/recommendation';
import { analyticsStorage } from '../analytics/analyticsStorage';

/**
 * File path to test case mapping patterns
 */
const FILE_MAPPING_PATTERNS: Record<string, RegExp[]> = {
  login: [/login/, /auth/, /signin/, /credential/],
  checkout: [/checkout/, /payment/, /cart/, /order/],
  profile: [/profile/, /user/, /account/, /settings/],
  search: [/search/, /query/, /filter/],
  navigation: [/nav/, /menu/, /header/, /sidebar/],
};

/**
 * Component dependency mapping
 */
const COMPONENT_DEPENDENCIES: Record<string, string[]> = {
  Button: ['all'], // Button affects all tests
  Input: ['form', 'login', 'search'],
  Form: ['login', 'signup', 'checkout'],
  Modal: ['all'],
  Table: ['dashboard', 'list'],
};

/**
 * Change Analyzer class
 */
export class ChangeAnalyzer {
  private customMappings: Map<string, string[]> = new Map();

  /**
   * Analyze impact of changes on test cases
   */
  async analyzeImpact(changes: ChangeInfo[]): Promise<ChangeImpact[]> {
    const allCaseStats = await analyticsStorage.getAllCaseStats();
    const impacts: ChangeImpact[] = [];

    for (const change of changes) {
      const affectedCases = this.findAffectedCases(change, allCaseStats);
      const impactLevel = this.calculateImpactLevel(
        affectedCases,
        allCaseStats,
      );
      const reasoning = this.generateReasoning(
        change,
        affectedCases,
        impactLevel,
      );

      impacts.push({
        change,
        affectedCases,
        impactLevel,
        reasoning,
      });
    }

    return impacts.sort((a, b) => {
      const levelOrder = { high: 0, medium: 1, low: 2 };
      return levelOrder[a.impactLevel] - levelOrder[b.impactLevel];
    });
  }

  /**
   * Map changes to affected test cases
   */
  async mapChangesToCases(
    changes: ChangeInfo[],
  ): Promise<Map<string, string[]>> {
    const allCaseStats = await analyticsStorage.getAllCaseStats();
    const mapping = new Map<string, string[]>();

    for (const change of changes) {
      const affectedCases = this.findAffectedCases(change, allCaseStats);
      mapping.set(change.target, affectedCases);
    }

    return mapping;
  }

  /**
   * Suggest tests for given changes
   */
  async suggestTests(changes: ChangeInfo[], limit = 10): Promise<string[]> {
    const impacts = await this.analyzeImpact(changes);

    // Collect all affected cases with their impact levels
    const caseImpacts = new Map<string, number>();
    for (const impact of impacts) {
      const weight =
        impact.impactLevel === 'high'
          ? 3
          : impact.impactLevel === 'medium'
            ? 2
            : 1;
      for (const caseId of impact.affectedCases) {
        const existing = caseImpacts.get(caseId) ?? 0;
        caseImpacts.set(caseId, existing + weight);
      }
    }

    // Sort by impact weight and return top cases
    const sorted = Array.from(caseImpacts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([caseId]) => caseId);

    return sorted;
  }

  /**
   * Add custom file-to-case mapping
   */
  addCustomMapping(pattern: string, caseIds: string[]): void {
    this.customMappings.set(pattern, caseIds);
  }

  /**
   * Get custom mappings
   */
  getCustomMappings(): Map<string, string[]> {
    return new Map(this.customMappings);
  }

  /**
   * Clear custom mappings
   */
  clearCustomMappings(): void {
    this.customMappings.clear();
  }

  /**
   * Find affected cases for a change
   */
  private findAffectedCases(
    change: ChangeInfo,
    allCases: CaseStats[],
  ): string[] {
    const affected: string[] = [];
    const target = change.target.toLowerCase();

    for (const caseStat of allCases) {
      const caseName = caseStat.caseName.toLowerCase();

      // Direct name match
      if (caseName.includes(target)) {
        affected.push(caseStat.caseId);
        continue;
      }

      // Pattern-based matching
      for (const [pattern, patterns] of Object.entries(FILE_MAPPING_PATTERNS)) {
        for (const regex of patterns) {
          if (regex.test(target) && caseName.includes(pattern)) {
            affected.push(caseStat.caseId);
            break;
          }
        }
      }

      // Component dependency matching
      for (const [component, relatedPatterns] of Object.entries(
        COMPONENT_DEPENDENCIES,
      )) {
        if (target.includes(component.toLowerCase())) {
          if (
            relatedPatterns.includes('all') ||
            relatedPatterns.some((p) => caseName.includes(p))
          ) {
            if (!affected.includes(caseStat.caseId)) {
              affected.push(caseStat.caseId);
            }
          }
        }
      }
    }

    // Apply custom mappings
    for (const [pattern, caseIds] of this.customMappings) {
      if (target.includes(pattern.toLowerCase())) {
        for (const caseId of caseIds) {
          if (!affected.includes(caseId)) {
            affected.push(caseId);
          }
        }
      }
    }

    return affected;
  }

  /**
   * Calculate impact level
   */
  private calculateImpactLevel(
    affectedCases: string[],
    allCases: CaseStats[],
  ): ChangeImpact['impactLevel'] {
    const ratio = affectedCases.length / Math.max(allCases.length, 1);

    if (ratio > 0.3 || affectedCases.length > 10) return 'high';
    if (ratio > 0.1 || affectedCases.length > 5) return 'medium';
    return 'low';
  }

  /**
   * Generate reasoning for impact analysis
   */
  private generateReasoning(
    change: ChangeInfo,
    affectedCases: string[],
    impactLevel: ChangeImpact['impactLevel'],
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`变更目标: ${change.target} (${change.type})`);
    reasoning.push(`影响用例数: ${affectedCases.length}`);

    if (impactLevel === 'high') {
      reasoning.push('高风险变更，建议全面回归测试');
    } else if (impactLevel === 'medium') {
      reasoning.push('中等风险，建议选择性测试相关用例');
    } else {
      reasoning.push('低风险变更，测试影响范围有限');
    }

    // Add specific recommendations based on change type
    if (change.type === 'component') {
      reasoning.push('组件变更可能影响所有使用该组件的页面');
    } else if (change.type === 'feature') {
      reasoning.push('功能变更应重点测试相关业务流程');
    }

    return reasoning;
  }

  /**
   * Parse change info from git diff or similar
   */
  static parseChangesFromDiff(diff: string): ChangeInfo[] {
    const changes: ChangeInfo[] = [];
    const lines = diff.split('\n');

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        const parts = line.split(' ');
        if (parts.length >= 4) {
          const filePath = parts[2].replace('a/', '').replace('b/', '');
          changes.push({
            type: 'file',
            target: filePath,
            description: `文件变更: ${filePath}`,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Parse change info from file paths
   */
  static parseChangesFromPaths(paths: string[]): ChangeInfo[] {
    return paths.map((path) => ({
      type: 'file',
      target: path,
      description: `文件: ${path}`,
    }));
  }

  /**
   * Infer change type from file path
   */
  static inferChangeType(filePath: string): ChangeInfo['type'] {
    const path = filePath.toLowerCase();

    if (path.includes('component') || path.includes('components/')) {
      return 'component';
    }
    if (path.includes('feature') || path.includes('features/')) {
      return 'feature';
    }
    if (path.includes('page') || path.includes('pages/')) {
      return 'feature';
    }

    return 'file';
  }
}

// Export singleton instance
export const changeAnalyzer = new ChangeAnalyzer();
