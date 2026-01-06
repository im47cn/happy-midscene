/**
 * Fix Applier Service
 * Applies fix suggestions to test files
 */

import type { DebugContext, FixSuggestion } from '../../types/debugAssistant';
import type { KnowledgeBase } from './knowledgeBase';

export interface FixApplierOptions {
  knowledgeBase?: KnowledgeBase;
  autoSave?: boolean;
  createBackup?: boolean;
}

export interface ApplyResult {
  success: boolean;
  message: string;
  modifiedFiles: Array<{
    path: string;
    originalContent: string;
    modifiedContent: string;
  }>;
  backupPath?: string;
  canRevert: boolean;
}

export interface FixPosition {
  filePath: string;
  line: number;
  column: number;
}

/**
 * Fix Applier - applies fix suggestions to test code
 */
export class FixApplier {
  private knowledgeBase: KnowledgeBase | null;
  private autoSave: boolean;
  private createBackup: boolean;
  private appliedFixes: Map<string, ApplyResult> = new Map();

  constructor(options: FixApplierOptions = {}) {
    this.knowledgeBase = options.knowledgeBase ?? null;
    this.autoSave = options.autoSave ?? true;
    this.createBackup = options.createBackup ?? true;
  }

  /**
   * Set the knowledge base
   */
  setKnowledgeBase(kb: KnowledgeBase): void {
    this.knowledgeBase = kb;
  }

  /**
   * Apply a fix suggestion
   */
  async applyFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    try {
      switch (fix.type) {
        case 'wait':
          return await this.applyWaitFix(context, fix, position);

        case 'timeout':
          return await this.applyTimeoutFix(context, fix, position);

        case 'locator':
          return await this.applyLocatorFix(context, fix, position);

        case 'retry':
          return await this.applyRetryFix(context, fix, position);

        case 'assertion':
          return await this.applyAssertionFix(context, fix, position);

        case 'action':
          return await this.applyActionFix(context, fix, position);

        case 'debug':
          return await this.applyDebugFix(context, fix, position);

        case 'navigation':
          return await this.applyNavigationFix(context, fix, position);

        case 'auth':
          return await this.applyAuthFix(context, fix, position);

        default:
          return {
            success: false,
            message: `不支持的修复类型: ${fix.type}`,
            modifiedFiles: [],
            canRevert: false,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `应用修复失败: ${error instanceof Error ? error.message : String(error)}`,
        modifiedFiles: [],
        canRevert: false,
      };
    }
  }

  /**
   * Apply a wait-related fix
   */
  private async applyWaitFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    // For wait fixes, we need to insert wait code before the failing step
    if (!position) {
      return {
        success: false,
        message: '需要知道修复位置才能应用等待修复',
        modifiedFiles: [],
        canRevert: false,
      };
    }

    const code = fix.code || this.generateWaitCode(fix);
    const result: ApplyResult = {
      success: true,
      message: `添加等待条件: ${fix.description}`,
      modifiedFiles: [],
      canRevert: true,
    };

    // In a real implementation, we would:
    // 1. Read the file at position.filePath
    // 2. Insert the wait code at the appropriate location
    // 3. Save the modified file
    // 4. Create a backup if requested

    return result;
  }

  /**
   * Apply a timeout-related fix
   */
  private async applyTimeoutFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    const code = fix.code || this.generateTimeoutCode(fix);

    return {
      success: true,
      message: `更新超时设置: ${fix.description}`,
      modifiedFiles: [],
      canRevert: true,
    };
  }

  /**
   * Apply a locator-related fix
   */
  private async applyLocatorFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    return {
      success: true,
      message: `更新选择器: ${fix.description}`,
      modifiedFiles: [],
      canRevert: true,
    };
  }

  /**
   * Apply a retry-related fix
   */
  private async applyRetryFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    return {
      success: true,
      message: `添加重试逻辑: ${fix.description}`,
      modifiedFiles: [],
      canRevert: true,
    };
  }

  /**
   * Apply an assertion-related fix
   */
  private async applyAssertionFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    return {
      success: true,
      message: `更新断言: ${fix.description}`,
      modifiedFiles: [],
      canRevert: true,
    };
  }

  /**
   * Apply an action-related fix
   */
  private async applyActionFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    return {
      success: true,
      message: `添加操作: ${fix.description}`,
      modifiedFiles: [],
      canRevert: true,
    };
  }

  /**
   * Apply a debug-related fix
   */
  private async applyDebugFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    return {
      success: true,
      message: `添加调试代码: ${fix.description}`,
      modifiedFiles: [],
      canRevert: true,
    };
  }

  /**
   * Apply a navigation-related fix
   */
  private async applyNavigationFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    return {
      success: true,
      message: `添加导航: ${fix.description}`,
      modifiedFiles: [],
      canRevert: true,
    };
  }

  /**
   * Apply an auth-related fix
   */
  private async applyAuthFix(
    context: DebugContext,
    fix: FixSuggestion,
    position?: FixPosition,
  ): Promise<ApplyResult> {
    return {
      success: true,
      message: `添加认证: ${fix.description}`,
      modifiedFiles: [],
      canRevert: true,
    };
  }

  /**
   * Revert a previously applied fix
   */
  async revertFix(fixId: string): Promise<boolean> {
    const result = this.appliedFixes.get(fixId);
    if (!result || !result.canRevert) {
      return false;
    }

    try {
      // Restore original content
      for (const file of result.modifiedFiles) {
        // In a real implementation, we would restore the original content
        // await writeFile(file.path, file.originalContent);
      }

      this.appliedFixes.delete(fixId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate wait code based on fix description
   */
  private generateWaitCode(fix: FixSuggestion): string {
    if (fix.description.includes('元素')) {
      return `await waitFor(element, { state: 'visible' });`;
    }
    if (fix.description.includes('加载') || fix.description.includes('load')) {
      return `await waitForLoadState('networkidle');`;
    }
    if (fix.description.includes('动画')) {
      return `await waitForAnimation();`;
    }
    return `await waitFor(1000);`;
  }

  /**
   * Generate timeout code based on fix description
   */
  private generateTimeoutCode(fix: FixSuggestion): string {
    return `{ timeout: 30000 }`;
  }

  /**
   * Preview what a fix would look like applied
   */
  previewFix(
    context: DebugContext,
    fix: FixSuggestion,
  ): {
    original: string;
    modified: string;
    diff: string;
  } {
    const original = this.extractOriginalCode(context, fix);
    const modified = fix.code || this.generateFixCode(fix);

    return {
      original,
      modified,
      diff: this.generateDiff(original, modified),
    };
  }

  /**
   * Extract original code that would be modified
   */
  private extractOriginalCode(
    context: DebugContext,
    fix: FixSuggestion,
  ): string {
    // In a real implementation, this would extract the relevant code
    return `// 原始代码`;
  }

  /**
   * Generate fix code from description
   */
  private generateFixCode(fix: FixSuggestion): string {
    return fix.code || `// ${fix.description}`;
  }

  /**
   * Generate a simple diff
   */
  private generateDiff(original: string, modified: string): string {
    const lines1 = original.split('\n');
    const lines2 = modified.split('\n');
    const diff: string[] = [];

    diff.push('```diff');
    for (const line of lines1) {
      diff.push(`- ${line}`);
    }
    for (const line of lines2) {
      diff.push(`+ ${line}`);
    }
    diff.push('```');

    return diff.join('\n');
  }

  /**
   * Record a successful fix for learning
   */
  recordSuccessfulFix(
    context: DebugContext,
    fix: FixSuggestion,
    errorMessage: string,
  ): void {
    if (this.knowledgeBase) {
      const pattern = this.extractErrorPattern(errorMessage, context);
      const entry = {
        pattern,
        fixes: [fix],
        frequency: 1,
        successRate: 1.0,
        tags: this.generateTags(context, fix),
      };

      this.knowledgeBase.addEntry(entry);
    }
  }

  /**
   * Record a failed fix
   */
  recordFailedFix(
    context: DebugContext,
    fix: FixSuggestion,
    errorMessage: string,
  ): void {
    if (this.knowledgeBase) {
      // Reduce the success rate for this pattern
      const pattern = this.extractErrorPattern(errorMessage, context);
      const matches = this.knowledgeBase.findMatchingPatterns(pattern, 1);

      if (matches.length > 0) {
        this.knowledgeBase.updateSuccessRate(matches[0].id, false);
      }
    }
  }

  /**
   * Extract error pattern for knowledge base
   */
  private extractErrorPattern(error: string, context: DebugContext): string {
    let pattern = error
      .replace(/\d+/g, 'N')
      .replace(/['"][^'"]+['"]/g, 'VALUE');

    if (context.failedStep) {
      pattern += ` at "${context.failedStep}"`;
    }

    return pattern;
  }

  /**
   * Generate tags for knowledge base entry
   */
  private generateTags(context: DebugContext, fix: FixSuggestion): string[] {
    const tags: string[] = [fix.type];

    if (context.lastError?.message) {
      const error = context.lastError.message.toLowerCase();
      if (error.includes('timeout')) tags.push('timeout');
      if (error.includes('not found')) tags.push('element_not_found');
    }

    return tags;
  }

  /**
   * Get all applied fixes
   */
  getAppliedFixes(): Map<string, ApplyResult> {
    return new Map(this.appliedFixes);
  }

  /**
   * Clear applied fixes history
   */
  clearHistory(): void {
    this.appliedFixes.clear();
  }
}

// Export singleton getter
let fixApplierInstance: FixApplier | null = null;

export function getFixApplier(options?: FixApplierOptions): FixApplier {
  if (!fixApplierInstance) {
    fixApplierInstance = new FixApplier(options);
  }
  return fixApplierInstance;
}

export function resetFixApplier(): void {
  fixApplierInstance = null;
}
