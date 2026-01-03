/**
 * Data Masker
 * Handles sensitive data masking for reports and logs
 */

import type {
  IDataMasker,
  MaskingRule,
  MaskingStrategy,
  SemanticType,
} from '../../types/dataGen';
import { SENSITIVE_TYPES } from '../../types/dataGen';

/**
 * Built-in masking rules for different semantic types
 */
const MASKING_RULES: Record<SemanticType, MaskingRule | null> = {
  mobile_phone: {
    id: 'mobile_phone',
    semanticType: 'mobile_phone',
    strategy: 'partial',
    pattern: '^(\\d{3})\\d{4}(\\d{4})$',
    replacement: '$1****$2',
  },
  id_card: {
    id: 'id_card',
    semanticType: 'id_card',
    strategy: 'partial',
    pattern: '^(\\d{6})\\d{8}(\\d{4})$',
    replacement: '$1********$2',
  },
  bank_card: {
    id: 'bank_card',
    semanticType: 'bank_card',
    strategy: 'partial',
    pattern: '^(\\d{4})\\d+(\\d{4})$',
    replacement: '$1****$2',
  },
  email: {
    id: 'email',
    semanticType: 'email',
    strategy: 'partial',
    pattern: '^(.)[^@]*(@.*)$',
    replacement: '$1***$2',
  },
  realname: {
    id: 'realname',
    semanticType: 'realname',
    strategy: 'partial',
    pattern: '^(.).*$',
    replacement: '$1**',
  },
  password: {
    id: 'password',
    semanticType: 'password',
    strategy: 'full',
    pattern: '.*',
    replacement: '********',
  },
  address: {
    id: 'address',
    semanticType: 'address',
    strategy: 'partial',
    pattern: '^(.{6}).*$',
    replacement: '$1******',
  },
  // Non-sensitive types - no masking
  username: null,
  nickname: null,
  landline: null,
  captcha: null,
  postal_code: null,
  city: null,
  province: null,
  country: null,
  date_of_birth: null,
  amount: null,
  quantity: null,
  description: null,
  url: null,
  company: null,
  job_title: null,
  custom: null,
};

/**
 * Check if a semantic type is sensitive
 */
export function isSensitiveType(semanticType: SemanticType): boolean {
  return SENSITIVE_TYPES.includes(semanticType);
}

/**
 * Mask a value based on semantic type
 */
export function maskValue(value: unknown, semanticType: SemanticType): string {
  if (value === null || value === undefined) {
    return '';
  }

  const strValue = String(value);
  const rule = MASKING_RULES[semanticType];

  if (!rule) {
    // No masking rule, return as-is
    return strValue;
  }

  return applyMaskingRule(strValue, rule);
}

/**
 * Apply a masking rule to a value
 */
function applyMaskingRule(value: string, rule: MaskingRule): string {
  switch (rule.strategy) {
    case 'full':
      return rule.replacement;

    case 'partial':
      try {
        const regex = new RegExp(rule.pattern);
        if (regex.test(value)) {
          return value.replace(regex, rule.replacement);
        }
        // If pattern doesn't match, apply default partial masking
        return partialMask(value);
      } catch {
        return partialMask(value);
      }

    case 'hash':
      return hashMask(value);

    case 'substitute':
      return substituteMask(value, rule.replacement);

    case 'shuffle':
      return shuffleMask(value);

    default:
      return partialMask(value);
  }
}

/**
 * Default partial masking - show first and last characters
 */
function partialMask(value: string): string {
  if (value.length <= 2) {
    return '*'.repeat(value.length);
  }

  const showLength = Math.min(2, Math.floor(value.length / 3));
  const maskLength = value.length - showLength * 2;

  return (
    value.slice(0, showLength) +
    '*'.repeat(maskLength) +
    value.slice(-showLength)
  );
}

/**
 * Hash-based masking (consistent for same input)
 */
function hashMask(value: string): string {
  // Simple hash for demonstration - in production use crypto.subtle
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `hash_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Substitute masking - replace with fixed pattern
 */
function substituteMask(value: string, replacement: string): string {
  return replacement
    .repeat(Math.ceil(value.length / replacement.length))
    .slice(0, value.length);
}

/**
 * Shuffle masking - randomize character order
 */
function shuffleMask(value: string): string {
  const chars = value.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Data Masker class implementation
 */
export class DataMasker implements IDataMasker {
  private customRules: Map<SemanticType, MaskingRule> = new Map();

  /**
   * Add a custom masking rule
   */
  addRule(rule: MaskingRule): void {
    this.customRules.set(rule.semanticType, rule);
  }

  /**
   * Remove a custom masking rule
   */
  removeRule(semanticType: SemanticType): void {
    this.customRules.delete(semanticType);
  }

  /**
   * Mask a single value
   */
  mask(value: unknown, semanticType: SemanticType): string {
    if (value === null || value === undefined) {
      return '';
    }

    const strValue = String(value);

    // Check custom rules first
    const customRule = this.customRules.get(semanticType);
    if (customRule) {
      return applyMaskingRule(strValue, customRule);
    }

    // Fall back to built-in rules
    return maskValue(value, semanticType);
  }

  /**
   * Mask multiple fields in a record
   */
  maskRecord(
    record: Record<string, unknown>,
    fieldTypes: Record<string, SemanticType>,
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(record)) {
      const semanticType = fieldTypes[key];
      if (semanticType && isSensitiveType(semanticType)) {
        result[key] = this.mask(value, semanticType);
      } else {
        result[key] = String(value ?? '');
      }
    }

    return result;
  }

  /**
   * Check if a semantic type is sensitive
   */
  isSensitive(semanticType: SemanticType): boolean {
    return isSensitiveType(semanticType);
  }

  /**
   * Get all sensitive types
   */
  getSensitiveTypes(): SemanticType[] {
    return [...SENSITIVE_TYPES];
  }
}

/**
 * Default masker instance
 */
export const dataMasker = new DataMasker();
