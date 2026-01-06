/**
 * Syntax Validator
 * 验证自适应测试语法的正确性
 */

import type {
  AdaptiveStep,
  AdaptiveTestCase,
  SyntaxNode,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from '../../types/adaptive';

/**
 * 验证规则接口
 */
interface ValidationRule {
  name: string;
  severity: 'error' | 'warning';
  validate: (context: ValidationContext) => boolean;
  message: string;
  suggestion?: string;
}

/**
 * 验证上下文
 */
interface ValidationContext {
  testCase: AdaptiveTestCase;
  currentStep?: AdaptiveStep;
  parentStep?: AdaptiveStep;
  depth: number;
  loopCount: number;
  variables: Set<string>;
  path: string[];
}

/**
 * 内置验证规则
 */
const BUILT_IN_RULES: ValidationRule[] = [
  // 结构规则
  {
    name: 'has-name',
    severity: 'error',
    validate: (ctx) => ctx.testCase.name.length > 0,
    message: 'Test case must have a name',
  },
  {
    name: 'has-steps',
    severity: 'error',
    validate: (ctx) => ctx.testCase.steps.length > 0,
    message: 'Test case must have at least one step',
  },

  // 条件规则
  {
    name: 'condition-has-expression',
    severity: 'error',
    validate: (ctx) => {
      if (ctx.currentStep?.type !== 'condition') return true;
      return !!ctx.currentStep.condition?.expression?.length;
    },
    message: 'Condition must have an expression',
  },
  {
    name: 'condition-has-then',
    severity: 'error',
    validate: (ctx) => {
      if (ctx.currentStep?.type !== 'condition') return true;
      return (ctx.currentStep.condition?.thenSteps?.length || 0) > 0;
    },
    message: 'Condition must have at least one "then" step',
  },

  // 循环规则
  {
    name: 'loop-has-body',
    severity: 'error',
    validate: (ctx) => {
      if (ctx.currentStep?.type !== 'loop') return true;
      return (ctx.currentStep.loop?.body?.length || 0) > 0;
    },
    message: 'Loop must have at least one step in body',
  },
  {
    name: 'while-has-condition',
    severity: 'error',
    validate: (ctx) => {
      if (ctx.currentStep?.type !== 'loop') return true;
      if (ctx.currentStep.loop?.type !== 'while') return true;
      return !!ctx.currentStep.loop?.condition?.length;
    },
    message: 'While loop must have a condition',
  },
  {
    name: 'foreach-has-collection',
    severity: 'error',
    validate: (ctx) => {
      if (ctx.currentStep?.type !== 'loop') return true;
      if (ctx.currentStep.loop?.type !== 'forEach') return true;
      return !!ctx.currentStep.loop?.collection?.length;
    },
    message: 'ForEach loop must have a collection',
  },

  // 变量规则
  {
    name: 'variable-has-name',
    severity: 'error',
    validate: (ctx) => {
      if (ctx.currentStep?.type !== 'variable') return true;
      return !!ctx.currentStep.variable?.name?.length;
    },
    message: 'Variable operation must have a name',
  },
  {
    name: 'variable-declared-before-use',
    severity: 'warning',
    validate: (ctx) => {
      // Check if variable reference is declared before use
      if (!ctx.currentStep) return true;
      const desc = ctx.currentStep.description || '';
      const matches = desc.match(/\$\{(\w+)\}/g);
      if (!matches) return true;

      for (const match of matches) {
        const varName = match.slice(2, -1);
        if (!ctx.variables.has(varName) && !ctx.testCase.variables[varName]) {
          return false;
        }
      }
      return true;
    },
    message: 'Variable used before declaration',
    suggestion: 'Declare variables before using them with ${varName}',
  },

  // 深度规则
  {
    name: 'max-depth',
    severity: 'warning',
    validate: (ctx) => {
      const maxDepth = ctx.testCase.config.maxNestedDepth || 3;
      return ctx.depth <= maxDepth;
    },
    message: `Nesting depth exceeds configured limit`,
    suggestion: 'Reduce nesting or increase maxNestedDepth',
  },

  // 循环限制
  {
    name: 'max-iterations',
    severity: 'warning',
    validate: (ctx) => {
      const maxIter = ctx.testCase.config.maxLoopIterations || 50;
      return ctx.testCase.config.maxLoopIterations <= 100;
    },
    message: 'maxLoopIterations is very high',
    suggestion: 'Consider reducing maxLoopIterations to 50 or less',
  },
];

/**
 * 主验证器类
 */
export class SyntaxValidator {
  private customRules: ValidationRule[] = [];

  /**
   * 添加自定义验证规则
   */
  addRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  /**
   * 移除验证规则
   */
  removeRule(name: string): void {
    this.customRules = this.customRules.filter((r) => r.name !== name);
  }

  /**
   * 验证测试用例
   */
  validate(testCase: AdaptiveTestCase): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Collect all variables
    const variables = new Set<string>(Object.keys(testCase.variables));

    // Run validation recursively
    this.validateSteps(
      testCase.steps,
      testCase,
      {
        testCase,
        depth: 0,
        loopCount: 0,
        variables,
        path: [],
      },
      errors,
      warnings,
    );

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 递归验证步骤
   */
  private validateSteps(
    steps: AdaptiveStep[],
    testCase: AdaptiveTestCase,
    context: ValidationContext,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    for (const step of steps) {
      const stepContext: ValidationContext = {
        ...context,
        currentStep: step,
        parentStep: context.currentStep,
        path: [...context.path, step.id],
        depth: context.depth + 1,
      };

      // Track variable declarations
      if (step.type === 'variable' && step.variable?.name) {
        context.variables.add(step.variable.name);
      }

      // Run all rules
      const allRules = [...BUILT_IN_RULES, ...this.customRules];
      for (const rule of allRules) {
        const isValid = rule.validate(stepContext);
        if (!isValid) {
          const issueBase = {
            type: rule.severity === 'error' ? 'syntax' : 'complexity',
            message: rule.message,
            line: step.lineNumber,
            suggestion: rule.suggestion,
          };

          if (rule.severity === 'error') {
            errors.push(issueBase as ValidationError);
          } else {
            warnings.push(issueBase as ValidationWarning);
          }
        }
      }

      // Recursively validate nested steps
      if (step.type === 'condition') {
        this.validateSteps(
          step.condition?.thenSteps || [],
          testCase,
          stepContext,
          errors,
          warnings,
        );
        this.validateSteps(
          step.condition?.elseSteps || [],
          testCase,
          stepContext,
          errors,
          warnings,
        );
      }

      if (step.type === 'loop') {
        const loopContext = {
          ...stepContext,
          loopCount: context.loopCount + 1,
        };

        if (loopContext.loopCount > 3) {
          warnings.push({
            type: 'complexity',
            message: 'Multiple nested loops detected',
            line: step.lineNumber,
            suggestion: 'Consider flattening nested loops',
          });
        }

        this.validateSteps(
          step.loop?.body || [],
          testCase,
          loopContext,
          errors,
          warnings,
        );
      }
    }
  }
}

/**
 * 快速验证函数
 */
export function validateSyntax(testCase: AdaptiveTestCase): ValidationResult {
  const validator = new SyntaxValidator();
  return validator.validate(testCase);
}

/**
 * 验证单个条件表达式
 */
export function validateConditionExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  if (!expression || expression.trim().length === 0) {
    return { valid: false, error: 'Condition expression is empty' };
  }

  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of expression) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      return { valid: false, error: 'Unbalanced parentheses' };
    }
  }
  if (parenCount !== 0) {
    return { valid: false, error: 'Unbalanced parentheses' };
  }

  // Check for valid operators
  const hasValidOperator = [
    'element',
    'is',
    'exists',
    'visible',
    'enabled',
    'selected',
    'text',
    'contains',
    'matches',
    'equals',
    'state',
    'logged_in',
    'loading',
    'error',
    'empty',
    'and',
    'or',
    'not',
  ].some((op) => expression.toLowerCase().includes(op));

  if (!hasValidOperator && !expression.match(/^\w+\s*[=!<>]+\s*/)) {
    return { valid: false, error: 'No valid condition operator found' };
  }

  return { valid: true };
}

/**
 * 验证循环表达式
 */
export function validateLoopExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  if (!expression || expression.trim().length === 0) {
    return { valid: false, error: 'Loop expression is empty' };
  }

  const lower = expression.toLowerCase().trim();

  // Count loop
  const countMatch = lower.match(/^repeat\s+(\d+)\s+times?$/);
  if (countMatch) {
    const count = Number.parseInt(countMatch[1], 10);
    if (count <= 0) {
      return { valid: false, error: 'Loop count must be positive' };
    }
    if (count > 100) {
      return { valid: false, error: 'Loop count exceeds maximum (100)' };
    }
    return { valid: true };
  }

  // While loop
  if (lower.startsWith('while ')) {
    const condition = expression.slice(6).trim();
    return validateConditionExpression(condition);
  }

  // ForEach loop
  const forEachMatch = lower.match(/^forEach\s+"?([^"\s]+)"?\s+as\s+(\w+)$/);
  if (forEachMatch) {
    if (!forEachMatch[1]) {
      return { valid: false, error: 'ForEach loop must specify a collection' };
    }
    if (!forEachMatch[2]) {
      return {
        valid: false,
        error: 'ForEach loop must specify an item variable name',
      };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Invalid loop syntax' };
}

/**
 * 验证变量表达式
 */
export function validateVariableExpression(expression: string): {
  valid: boolean;
  error?: string;
} {
  if (!expression || expression.trim().length === 0) {
    return { valid: false, error: 'Variable expression is empty' };
  }

  const lower = expression.toLowerCase().trim();

  // Set operation
  const setMatch = lower.match(/^set\s+(\w+)\s*=\s*(.+)$/);
  if (setMatch) {
    if (!setMatch[1]) {
      return { valid: false, error: 'Variable name is required' };
    }
    return { valid: true };
  }

  // Extract operation
  const extractMatch = lower.match(/^extract\s+(\w+)\s+from\s+"?([^"\s]+)"?$/);
  if (extractMatch) {
    if (!extractMatch[1]) {
      return { valid: false, error: 'Variable name is required' };
    }
    if (!extractMatch[2]) {
      return { valid: false, error: 'Source selector is required' };
    }
    return { valid: true };
  }

  // Increment operation
  const incMatch = lower.match(/^increment\s+(\w+)$/);
  if (incMatch) {
    if (!incMatch[1]) {
      return { valid: false, error: 'Variable name is required' };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Invalid variable syntax' };
}

/**
 * 获取语法建议
 */
export function getSyntaxSuggestions(
  testCase: AdaptiveTestCase,
  validation: ValidationResult,
): string[] {
  const suggestions: string[] = [];

  for (const warning of validation.warnings) {
    if (warning.suggestion) {
      suggestions.push(warning.suggestion);
    }

    // Generate contextual suggestions
    if (warning.type === 'complexity' && warning.message.includes('depth')) {
      suggestions.push(
        'Consider extracting nested conditions into separate test cases',
      );
    }

    if (warning.type === 'performance' && warning.message.includes('loop')) {
      suggestions.push(
        'Use "break" conditions or add guards to prevent infinite loops',
      );
    }
  }

  // Add general best practices
  if (testCase.steps.length > 20) {
    suggestions.push(
      'Consider splitting large test cases into smaller, focused tests',
    );
  }

  return Array.from(new Set(suggestions));
}

/**
 * 格式化验证结果
 */
export function formatValidationResult(
  validation: ValidationResult,
  includeSuggestions = true,
): string {
  const lines: string[] = [];

  if (validation.valid) {
    lines.push('✅ Validation passed');
  } else {
    lines.push(
      `❌ Validation failed with ${validation.errors.length} error(s)`,
    );
  }

  if (validation.errors.length > 0) {
    lines.push('\nErrors:');
    for (const error of validation.errors) {
      const location = error.line ? ` (line ${error.line})` : '';
      lines.push(`  - ${error.message}${location}`);
    }
  }

  if (validation.warnings.length > 0) {
    lines.push('\nWarnings:');
    for (const warning of validation.warnings) {
      const location = warning.line ? ` (line ${warning.line})` : '';
      lines.push(`  - ${warning.message}${location}`);
    }
  }

  return lines.join('\n');
}
