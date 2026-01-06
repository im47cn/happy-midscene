/**
 * Template Auditor Service
 * Audits templates for sensitive information and malicious code
 */

import * as yaml from 'js-yaml';
import type { AuditResult, ITemplateAuditor, TemplateDraft } from '../types';

/**
 * Patterns for detecting sensitive information
 */
const SENSITIVE_PATTERNS = [
  // Hardcoded passwords
  { pattern: /password\s*[:=]\s*["'][^"']+["']/gi, name: 'Hardcoded password' },
  { pattern: /pwd\s*[:=]\s*["'][^"']+["']/gi, name: 'Hardcoded password' },

  // API keys
  {
    pattern: /api[_-]?key\s*[:=]\s*["'][a-zA-Z0-9_-]{20,}["']/gi,
    name: 'API key',
  },
  { pattern: /apikey\s*[:=]\s*["'][a-zA-Z0-9_-]{20,}["']/gi, name: 'API key' },

  // Tokens
  { pattern: /token\s*[:=]\s*["'][a-zA-Z0-9_.-]{20,}["']/gi, name: 'Token' },
  { pattern: /bearer\s+[a-zA-Z0-9_.-]{20,}/gi, name: 'Bearer token' },

  // Secrets
  { pattern: /secret\s*[:=]\s*["'][^"']+["']/gi, name: 'Secret' },
  { pattern: /private[_-]?key\s*[:=]\s*["'][^"']+["']/gi, name: 'Private key' },

  // AWS credentials
  { pattern: /AKIA[A-Z0-9]{16}/g, name: 'AWS access key' },

  // Connection strings
  {
    pattern: /mongodb(\+srv)?:\/\/[^@]+:[^@]+@/gi,
    name: 'MongoDB connection string',
  },
  {
    pattern: /postgres:\/\/[^@]+:[^@]+@/gi,
    name: 'PostgreSQL connection string',
  },
  { pattern: /mysql:\/\/[^@]+:[^@]+@/gi, name: 'MySQL connection string' },
];

/**
 * Patterns for detecting malicious code
 */
const MALICIOUS_PATTERNS = [
  { pattern: /eval\s*\(/gi, name: 'eval() call' },
  { pattern: /exec\s*\(/gi, name: 'exec() call' },
  { pattern: /Function\s*\(/gi, name: 'Function constructor' },
  { pattern: /<script[^>]*>/gi, name: 'Script tag' },
  { pattern: /javascript:/gi, name: 'JavaScript URL' },
  { pattern: /on\w+\s*=\s*["']/gi, name: 'Event handler attribute' },
  { pattern: /document\.cookie/gi, name: 'Cookie access' },
  { pattern: /window\.location\s*=/gi, name: 'Location manipulation' },
  { pattern: /localStorage\./gi, name: 'localStorage access' },
  { pattern: /sessionStorage\./gi, name: 'sessionStorage access' },
  { pattern: /XMLHttpRequest/gi, name: 'XHR request' },
  { pattern: /fetch\s*\(/gi, name: 'Fetch request' },
];

/**
 * Template auditor implementation
 */
export class TemplateAuditor implements ITemplateAuditor {
  /**
   * Audit a template draft
   */
  async audit(draft: TemplateDraft): Promise<AuditResult> {
    const reasons: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for sensitive information
    const sensitiveCheck = this.detectSensitiveInfo(draft.content.yaml);
    if (sensitiveCheck.found) {
      reasons.push(
        `Sensitive information detected: ${sensitiveCheck.matches.join(', ')}`,
      );
    }

    // Check for malicious code
    const maliciousCheck = this.detectMaliciousCode(draft.content.yaml);
    if (maliciousCheck.found) {
      reasons.push(
        `Potentially malicious code detected: ${maliciousCheck.matches.join(', ')}`,
      );
    }

    // Validate YAML syntax
    const yamlCheck = this.validateYaml(draft.content.yaml);
    if (!yamlCheck.valid) {
      reasons.push(`Invalid YAML syntax: ${yamlCheck.errors.join(', ')}`);
    }

    // Check for undefined parameters
    const paramCheck = this.checkParameters(draft);
    if (paramCheck.undefinedParams.length > 0) {
      warnings.push(
        `Parameters used but not defined: ${paramCheck.undefinedParams.join(', ')}`,
      );
    }
    if (paramCheck.unusedParams.length > 0) {
      warnings.push(
        `Parameters defined but not used: ${paramCheck.unusedParams.join(', ')}`,
      );
    }

    // Check content quality
    const qualityCheck = this.checkContentQuality(draft);
    warnings.push(...qualityCheck.warnings);
    suggestions.push(...qualityCheck.suggestions);

    return {
      passed: reasons.length === 0,
      reasons,
      warnings: warnings.length > 0 ? warnings : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * Detect sensitive information in content
   */
  detectSensitiveInfo(content: string): { found: boolean; matches: string[] } {
    const matches: string[] = [];

    for (const { pattern, name } of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        matches.push(name);
      }
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
    }

    return {
      found: matches.length > 0,
      matches: [...new Set(matches)],
    };
  }

  /**
   * Detect malicious code patterns
   */
  detectMaliciousCode(content: string): { found: boolean; matches: string[] } {
    const matches: string[] = [];

    for (const { pattern, name } of MALICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        matches.push(name);
      }
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
    }

    return {
      found: matches.length > 0,
      matches: [...new Set(matches)],
    };
  }

  /**
   * Validate YAML syntax
   */
  validateYaml(yamlContent: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // First replace parameters with placeholders for validation
      const sanitizedYaml = yamlContent.replace(/\$\{[^}]+\}/g, 'PLACEHOLDER');
      yaml.load(sanitizedYaml);
    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        errors.push(error.message);
      } else {
        errors.push('Unknown YAML parsing error');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check parameter definitions
   */
  private checkParameters(draft: TemplateDraft): {
    undefinedParams: string[];
    unusedParams: string[];
  } {
    // Extract parameters used in YAML
    const paramRegex = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const usedParams = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = paramRegex.exec(draft.content.yaml)) !== null) {
      usedParams.add(match[1]);
    }

    // Get defined parameters
    const definedParams = new Set(draft.content.parameters.map((p) => p.name));

    // Find undefined and unused parameters
    const undefinedParams = [...usedParams].filter(
      (p) => !definedParams.has(p),
    );
    const unusedParams = [...definedParams].filter((p) => !usedParams.has(p));

    return { undefinedParams, unusedParams };
  }

  /**
   * Check content quality
   */
  private checkContentQuality(draft: TemplateDraft): {
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check description length
    if (draft.description.length < 50) {
      suggestions.push('Consider adding a more detailed description');
    }

    // Check short description length
    if (draft.shortDescription.length < 20) {
      warnings.push('Short description is too brief');
    }
    if (draft.shortDescription.length > 200) {
      warnings.push('Short description is too long');
    }

    // Check for tags
    if (draft.tags.length === 0) {
      suggestions.push('Adding tags will help users discover your template');
    }

    // Check for parameters without descriptions
    const paramsWithoutDesc = draft.content.parameters.filter(
      (p) => !p.description,
    );
    if (paramsWithoutDesc.length > 0) {
      suggestions.push('Consider adding descriptions for all parameters');
    }

    // Check for required parameters without defaults
    const requiredWithoutDefault = draft.content.parameters.filter(
      (p) => p.required && p.default === undefined,
    );
    if (requiredWithoutDefault.length > 0) {
      suggestions.push(
        'Consider providing default values for required parameters',
      );
    }

    return { warnings, suggestions };
  }

  /**
   * Sanitize content by removing sensitive patterns
   */
  sanitizeContent(content: string): string {
    let sanitized = content;

    for (const { pattern } of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
      pattern.lastIndex = 0;
    }

    return sanitized;
  }
}

// Export singleton instance
export const templateAuditor = new TemplateAuditor();
