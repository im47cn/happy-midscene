/**
 * Built-in Detection Rules
 * Predefined rules for common sensitive data types
 */

import type { DetectionRule } from '../../types/masking';

/**
 * Credential detection rules
 */
const credentialRules: DetectionRule[] = [
  {
    id: 'builtin-password',
    name: 'Password Field',
    description: 'Detect password values in key-value pairs',
    enabled: true,
    priority: 90,
    detection: {
      type: 'regex',
      pattern:
        '(?:password|pwd|passwd|pass|secret)\\s*[:=]\\s*["\']?([^"\'\\s,;}{\\]\\[]+)["\']?',
      flags: 'gi',
    },
    masking: {
      method: 'placeholder',
      options: { placeholder: '[PASSWORD]' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },
  {
    id: 'builtin-api-key',
    name: 'API Key',
    description: 'Detect API keys',
    enabled: true,
    priority: 95,
    detection: {
      type: 'regex',
      pattern:
        '(?:api[_-]?key|apikey|api[_-]?secret)\\s*[:=]\\s*["\']?([a-zA-Z0-9_\\-]{16,})["\']?',
      flags: 'gi',
    },
    masking: {
      method: 'placeholder',
      options: { placeholder: '[API_KEY]' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },
  {
    id: 'builtin-bearer-token',
    name: 'Bearer Token',
    description: 'Detect Bearer authentication tokens',
    enabled: true,
    priority: 95,
    detection: {
      type: 'regex',
      pattern: 'Bearer\\s+([a-zA-Z0-9_\\-\\.]+)',
      flags: 'gi',
    },
    masking: {
      method: 'placeholder',
      options: { placeholder: '[BEARER_TOKEN]' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },
  {
    id: 'builtin-jwt',
    name: 'JWT Token',
    description: 'Detect JSON Web Tokens',
    enabled: true,
    priority: 95,
    detection: {
      type: 'regex',
      pattern: 'eyJ[a-zA-Z0-9_-]*\\.eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*',
      flags: 'g',
    },
    masking: {
      method: 'placeholder',
      options: { placeholder: '[JWT_TOKEN]' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },
  {
    id: 'builtin-aws-key',
    name: 'AWS Access Key',
    description: 'Detect AWS access key IDs',
    enabled: true,
    priority: 95,
    detection: {
      type: 'regex',
      pattern: '(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}',
      flags: 'g',
    },
    masking: {
      method: 'placeholder',
      options: { placeholder: '[AWS_KEY]' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },
  {
    id: 'builtin-private-key',
    name: 'Private Key',
    description: 'Detect private key content',
    enabled: true,
    priority: 98,
    detection: {
      type: 'regex',
      pattern:
        '-----BEGIN\\s+(?:RSA\\s+)?PRIVATE\\s+KEY-----[\\s\\S]*?-----END\\s+(?:RSA\\s+)?PRIVATE\\s+KEY-----',
      flags: 'g',
    },
    masking: {
      method: 'placeholder',
      options: { placeholder: '[PRIVATE_KEY]' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },
  {
    id: 'builtin-openai-key',
    name: 'OpenAI API Key',
    description: 'Detect OpenAI API keys',
    enabled: true,
    priority: 95,
    detection: {
      type: 'regex',
      pattern: 'sk-[a-zA-Z0-9]{32,}',
      flags: 'g',
    },
    masking: {
      method: 'placeholder',
      options: { placeholder: '[OPENAI_KEY]' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'credential',
    builtIn: true,
  },
];

/**
 * PII (Personal Identifiable Information) detection rules
 */
const piiRules: DetectionRule[] = [
  {
    id: 'builtin-phone-cn',
    name: 'China Mobile Phone',
    description: 'Detect Chinese mobile phone numbers',
    enabled: true,
    priority: 80,
    detection: {
      type: 'regex',
      pattern: '(?<![0-9])1[3-9]\\d{9}(?![0-9])',
      flags: 'g',
    },
    masking: {
      method: 'partial',
      options: { keepStart: 3, keepEnd: 4, maskChar: '*' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: false },
    category: 'pii',
    builtIn: true,
  },
  {
    id: 'builtin-phone-intl',
    name: 'International Phone',
    description: 'Detect international phone numbers',
    enabled: true,
    priority: 75,
    detection: {
      type: 'regex',
      pattern: '\\+[1-9]\\d{1,2}[\\s-]?\\d{3,4}[\\s-]?\\d{3,4}[\\s-]?\\d{3,4}',
      flags: 'g',
    },
    masking: {
      method: 'partial',
      options: { keepStart: 4, keepEnd: 4, maskChar: '*' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: false },
    category: 'pii',
    builtIn: true,
  },
  {
    id: 'builtin-id-card-cn',
    name: 'China ID Card',
    description: 'Detect Chinese ID card numbers',
    enabled: true,
    priority: 85,
    detection: {
      type: 'regex',
      pattern:
        '(?<![0-9])[1-9]\\d{5}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx](?![0-9])',
      flags: 'g',
    },
    masking: {
      method: 'partial',
      options: { keepStart: 6, keepEnd: 4, maskChar: '*' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: false },
    category: 'pii',
    builtIn: true,
  },
  {
    id: 'builtin-email',
    name: 'Email Address',
    description: 'Detect email addresses',
    enabled: true,
    priority: 70,
    detection: {
      type: 'regex',
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      flags: 'gi',
    },
    masking: {
      method: 'hash',
      options: { hashLength: 6 },
    },
    scope: { text: true, screenshot: false, log: true, yaml: false },
    category: 'pii',
    builtIn: true,
  },
  {
    id: 'builtin-name-cn',
    name: 'Chinese Name',
    description: 'Detect Chinese names (2-4 characters)',
    enabled: false, // Disabled by default due to high false positive
    priority: 50,
    detection: {
      type: 'regex',
      pattern: '(?:姓名|用户名|联系人)[：:]?\\s*([\\u4e00-\\u9fa5]{2,4})',
      flags: 'g',
    },
    masking: {
      method: 'partial',
      options: { keepStart: 1, keepEnd: 0, maskChar: '*' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: false },
    category: 'pii',
    builtIn: true,
  },
  {
    id: 'builtin-address-cn',
    name: 'Chinese Address',
    description: 'Detect Chinese addresses',
    enabled: false, // Disabled by default due to complexity
    priority: 45,
    detection: {
      type: 'regex',
      pattern: '(?:地址|住址)[：:]?\\s*([\\u4e00-\\u9fa5a-zA-Z0-9\\s]{10,})',
      flags: 'g',
    },
    masking: {
      method: 'partial',
      options: { keepStart: 6, keepEnd: 0, maskChar: '*' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: false },
    category: 'pii',
    builtIn: true,
  },
];

/**
 * Financial data detection rules
 */
const financialRules: DetectionRule[] = [
  {
    id: 'builtin-bank-card',
    name: 'Bank Card Number',
    description: 'Detect bank card numbers',
    enabled: true,
    priority: 85,
    detection: {
      type: 'regex',
      pattern:
        '(?<![0-9])\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}(?:[\\s-]?\\d{1,3})?(?![0-9])',
      flags: 'g',
    },
    masking: {
      method: 'partial',
      options: { keepStart: 4, keepEnd: 4, maskChar: '*' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: false },
    category: 'financial',
    builtIn: true,
  },
  {
    id: 'builtin-credit-card-cvv',
    name: 'CVV Code',
    description: 'Detect CVV/CVC codes',
    enabled: true,
    priority: 80,
    detection: {
      type: 'regex',
      pattern: '(?:cvv|cvc|安全码)\\s*[:：]?\\s*(\\d{3,4})',
      flags: 'gi',
    },
    masking: {
      method: 'full',
      options: { maskChar: '*' },
    },
    scope: { text: true, screenshot: true, log: true, yaml: true },
    category: 'financial',
    builtIn: true,
  },
];

/**
 * All built-in detection rules
 */
export const BUILT_IN_RULES: DetectionRule[] = [
  ...credentialRules,
  ...piiRules,
  ...financialRules,
];

/**
 * Get rules by category
 */
export function getRulesByCategory(
  category: DetectionRule['category'],
): DetectionRule[] {
  return BUILT_IN_RULES.filter((rule) => rule.category === category);
}

/**
 * Get enabled rules
 */
export function getEnabledRules(): DetectionRule[] {
  return BUILT_IN_RULES.filter((rule) => rule.enabled);
}

/**
 * Get rules sorted by priority (descending)
 */
export function getRulesSortedByPriority(): DetectionRule[] {
  return [...BUILT_IN_RULES].sort((a, b) => b.priority - a.priority);
}
