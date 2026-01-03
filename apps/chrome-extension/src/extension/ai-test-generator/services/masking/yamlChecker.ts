/**
 * YAML Sensitive Data Checker
 * Detects hardcoded sensitive data in YAML scripts and provides warnings and suggestions
 */

import type {
  DetectionResult,
  MaskingMatch,
  SensitiveCategory,
} from '../../types/masking';
import { detectorEngine } from './detectorEngine';
import { maskerEngine } from './maskerEngine';

/**
 * Warning severity levels
 */
export type WarningSeverity = 'high' | 'medium' | 'low';

/**
 * YAML check warning
 */
export interface YamlWarning {
  severity: WarningSeverity;
  line: number;
  column: number;
  category: SensitiveCategory;
  ruleId: string;
  ruleName: string;
  message: string;
  originalValue: string;
  suggestion?: string;
}

/**
 * YAML replacement suggestion
 */
export interface YamlReplacementSuggestion {
  line: number;
  original: string;
  replacement: string;
  parameterName: string;
  description: string;
}

/**
 * YAML check result
 */
export interface YamlCheckResult {
  hasSensitiveData: boolean;
  warnings: YamlWarning[];
  suggestions: YamlReplacementSuggestion[];
  maskedYaml: string;
  summary: {
    totalWarnings: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    byCategory: Record<string, number>;
  };
}

/**
 * Get severity based on category
 */
function getSeverity(category: SensitiveCategory): WarningSeverity {
  switch (category) {
    case 'credential':
      return 'high';
    case 'financial':
      return 'high';
    case 'pii':
      return 'medium';
    case 'health':
      return 'medium';
    case 'custom':
      return 'low';
    default:
      return 'low';
  }
}

/**
 * Get message based on category
 */
function getMessage(category: SensitiveCategory, ruleName: string): string {
  const messages: Record<SensitiveCategory, string> = {
    credential: `检测到硬编码的${ruleName}，这是一个安全风险`,
    pii: `检测到硬编码的个人信息 (${ruleName})，可能违反隐私规定`,
    financial: `检测到硬编码的金融信息 (${ruleName})，这是一个安全风险`,
    health: `检测到硬编码的健康信息 (${ruleName})，可能违反HIPAA等规定`,
    custom: `检测到敏感数据 (${ruleName})`,
  };
  return messages[category] || `检测到敏感数据 (${ruleName})`;
}

/**
 * Generate parameter name from rule
 */
function generateParameterName(ruleId: string): string {
  const mapping: Record<string, string> = {
    password: 'password',
    'api-key': 'apiKey',
    token: 'token',
    secret: 'secret',
    email: 'email',
    phone: 'phoneNumber',
    mobile_phone: 'mobile',
    'china-id-card': 'idCard',
    'bank-card': 'bankCard',
    'credit-card': 'creditCard',
    ssn: 'ssn',
    'aws-access-key': 'awsAccessKey',
    'aws-secret-key': 'awsSecretKey',
    'private-key': 'privateKey',
    jwt: 'jwtToken',
    'bearer-token': 'bearerToken',
    'oauth-token': 'oauthToken',
  };
  return mapping[ruleId] || `param_${ruleId.replace(/-/g, '_')}`;
}

/**
 * Find line and column for a position in text
 */
function findLineAndColumn(
  text: string,
  position: number,
): { line: number; column: number } {
  const lines = text.substring(0, position).split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * YAML Checker class
 */
class YamlChecker {
  /**
   * Check YAML content for sensitive data
   */
  async check(yamlContent: string): Promise<YamlCheckResult> {
    const warnings: YamlWarning[] = [];
    const suggestions: YamlReplacementSuggestion[] = [];
    const byCategory: Record<string, number> = {};

    // Detect sensitive data
    const detections = await detectorEngine.detect(yamlContent, 'yaml');

    for (const detection of detections) {
      const { line, column } = findLineAndColumn(
        yamlContent,
        detection.position.start,
      );
      const severity = getSeverity(detection.category);
      const parameterName = generateParameterName(detection.ruleId);

      // Create warning
      const warning: YamlWarning = {
        severity,
        line,
        column,
        category: detection.category,
        ruleId: detection.ruleId,
        ruleName: detection.ruleName,
        message: getMessage(detection.category, detection.ruleName),
        originalValue: detection.value,
        suggestion: `使用参数 {{${parameterName}}} 替代硬编码值`,
      };
      warnings.push(warning);

      // Track by category
      byCategory[detection.category] =
        (byCategory[detection.category] || 0) + 1;

      // Create replacement suggestion
      const lineContent = yamlContent.split('\n')[line - 1] || '';
      const suggestion: YamlReplacementSuggestion = {
        line,
        original: lineContent,
        replacement: lineContent.replace(
          detection.value,
          `{{${parameterName}}}`,
        ),
        parameterName,
        description: `将 ${detection.ruleName} 替换为参数引用`,
      };
      suggestions.push(suggestion);
    }

    // Sort warnings by severity and line
    warnings.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.line - b.line;
    });

    // Get masked version
    const maskResult = await maskerEngine.maskText(yamlContent, 'yaml');

    // Build summary
    const summary = {
      totalWarnings: warnings.length,
      highSeverity: warnings.filter((w) => w.severity === 'high').length,
      mediumSeverity: warnings.filter((w) => w.severity === 'medium').length,
      lowSeverity: warnings.filter((w) => w.severity === 'low').length,
      byCategory,
    };

    return {
      hasSensitiveData: warnings.length > 0,
      warnings,
      suggestions,
      maskedYaml: maskResult.masked,
      summary,
    };
  }

  /**
   * Get formatted warning messages for display
   */
  formatWarnings(warnings: YamlWarning[]): string[] {
    return warnings.map((w) => {
      const severityIcon =
        w.severity === 'high' ? '[!]' : w.severity === 'medium' ? '[?]' : '[-]';
      return `${severityIcon} 第${w.line}行: ${w.message}`;
    });
  }

  /**
   * Apply all suggestions to YAML content
   */
  applySuggestions(
    yamlContent: string,
    suggestions: YamlReplacementSuggestion[],
  ): string {
    const lines = yamlContent.split('\n');

    // Apply suggestions from bottom to top to preserve line numbers
    const sortedSuggestions = [...suggestions].sort(
      (a, b) => b.line - a.line,
    );

    for (const suggestion of sortedSuggestions) {
      if (suggestion.line <= lines.length) {
        lines[suggestion.line - 1] = suggestion.replacement;
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate parameter definitions from suggestions
   */
  generateParameterDefinitions(
    suggestions: YamlReplacementSuggestion[],
  ): string {
    const uniqueParams = new Map<string, string>();

    for (const suggestion of suggestions) {
      if (!uniqueParams.has(suggestion.parameterName)) {
        uniqueParams.set(suggestion.parameterName, suggestion.description);
      }
    }

    const lines = ['# Parameters (add to your test configuration)', 'params:'];
    for (const [name, description] of uniqueParams) {
      lines.push(`  ${name}: "" # ${description}`);
    }

    return lines.join('\n');
  }

  /**
   * Quick check if YAML has any sensitive data
   */
  async hasSensitiveData(yamlContent: string): Promise<boolean> {
    const detections = await detectorEngine.detect(yamlContent, 'yaml');
    return detections.length > 0;
  }
}

export const yamlChecker = new YamlChecker();
