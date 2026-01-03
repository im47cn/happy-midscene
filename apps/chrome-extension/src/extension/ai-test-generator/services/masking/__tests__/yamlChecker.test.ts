/**
 * YAML Checker Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the detector and masker engines
vi.mock('../detectorEngine', () => ({
  detectorEngine: {
    detect: vi.fn(),
  },
}));

vi.mock('../maskerEngine', () => ({
  maskerEngine: {
    maskText: vi.fn(),
  },
}));

import { detectorEngine } from '../detectorEngine';
import { maskerEngine } from '../maskerEngine';
import { yamlChecker } from '../yamlChecker';

describe('YamlChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(maskerEngine.maskText).mockResolvedValue({
      original: '',
      masked: '',
      matches: [],
      processingTime: 1,
    });
  });

  describe('check', () => {
    it('should return no warnings for clean YAML', async () => {
      vi.mocked(detectorEngine.detect).mockResolvedValue([]);

      const result = await yamlChecker.check(`
steps:
  - action: click
    target: button
`);

      expect(result.hasSensitiveData).toBe(false);
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should detect password in YAML', async () => {
      vi.mocked(detectorEngine.detect).mockResolvedValue([
        {
          ruleId: 'password',
          ruleName: '密码',
          category: 'credential',
          position: { start: 50, end: 62 },
          value: 'secret123!@#',
        },
      ]);

      const yamlContent = `
steps:
  - action: type
    target: password field
    value: secret123!@#
`;

      const result = await yamlChecker.check(yamlContent);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].severity).toBe('high');
      expect(result.warnings[0].category).toBe('credential');
      expect(result.warnings[0].ruleId).toBe('password');
    });

    it('should detect email in YAML', async () => {
      vi.mocked(detectorEngine.detect).mockResolvedValue([
        {
          ruleId: 'email',
          ruleName: '邮箱',
          category: 'pii',
          position: { start: 30, end: 48 },
          value: 'user@example.com',
        },
      ]);

      const result = await yamlChecker.check(`
steps:
  - action: type
    value: user@example.com
`);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].severity).toBe('medium');
      expect(result.warnings[0].category).toBe('pii');
    });

    it('should detect multiple sensitive values', async () => {
      vi.mocked(detectorEngine.detect).mockResolvedValue([
        {
          ruleId: 'password',
          ruleName: '密码',
          category: 'credential',
          position: { start: 50, end: 58 },
          value: 'pass123',
        },
        {
          ruleId: 'email',
          ruleName: '邮箱',
          category: 'pii',
          position: { start: 100, end: 118 },
          value: 'test@example.com',
        },
        {
          ruleId: 'bank-card',
          ruleName: '银行卡号',
          category: 'financial',
          position: { start: 150, end: 169 },
          value: '6225123456789012345',
        },
      ]);

      const result = await yamlChecker.check(`
steps:
  - type password: pass123
  - type email: test@example.com
  - type card: 6225123456789012345
`);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.warnings).toHaveLength(3);
      expect(result.summary.highSeverity).toBe(2); // password + bank-card
      expect(result.summary.mediumSeverity).toBe(1); // email
    });

    it('should generate replacement suggestions', async () => {
      const yamlContent = 'value: mypass';
      vi.mocked(detectorEngine.detect).mockResolvedValue([
        {
          ruleId: 'password',
          ruleName: '密码',
          category: 'credential',
          position: { start: 7, end: 13 },
          value: 'mypass',
        },
      ]);

      const result = await yamlChecker.check(yamlContent);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].parameterName).toBe('password');
      expect(result.suggestions[0].replacement).toContain('{{password}}');
    });

    it('should sort warnings by severity then line', async () => {
      vi.mocked(detectorEngine.detect).mockResolvedValue([
        {
          ruleId: 'email',
          ruleName: '邮箱',
          category: 'pii',
          position: { start: 10, end: 20 },
          value: 'a@b.com',
        },
        {
          ruleId: 'password',
          ruleName: '密码',
          category: 'credential',
          position: { start: 50, end: 60 },
          value: 'pass123',
        },
      ]);

      const result = await yamlChecker.check(`
email: a@b.com

password: pass123
`);

      // High severity (password) should come before medium (email)
      expect(result.warnings[0].ruleId).toBe('password');
      expect(result.warnings[1].ruleId).toBe('email');
    });
  });

  describe('formatWarnings', () => {
    it('should format warnings with severity icons', () => {
      const warnings = [
        {
          severity: 'high' as const,
          line: 5,
          column: 10,
          category: 'credential' as const,
          ruleId: 'password',
          ruleName: '密码',
          message: '检测到硬编码的密码',
          originalValue: 'secret',
        },
        {
          severity: 'medium' as const,
          line: 10,
          column: 5,
          category: 'pii' as const,
          ruleId: 'email',
          ruleName: '邮箱',
          message: '检测到硬编码的邮箱',
          originalValue: 'a@b.com',
        },
        {
          severity: 'low' as const,
          line: 15,
          column: 1,
          category: 'custom' as const,
          ruleId: 'custom',
          ruleName: '自定义',
          message: '检测到敏感数据',
          originalValue: 'data',
        },
      ];

      const formatted = yamlChecker.formatWarnings(warnings);

      expect(formatted[0]).toContain('[!]');
      expect(formatted[0]).toContain('第5行');
      expect(formatted[1]).toContain('[?]');
      expect(formatted[1]).toContain('第10行');
      expect(formatted[2]).toContain('[-]');
      expect(formatted[2]).toContain('第15行');
    });
  });

  describe('applySuggestions', () => {
    it('should replace values with parameter references', () => {
      const yamlContent = `
steps:
  - value: secret123
  - email: test@test.com
`;

      const suggestions = [
        {
          line: 3,
          original: '  - value: secret123',
          replacement: '  - value: {{password}}',
          parameterName: 'password',
          description: '替换密码',
        },
        {
          line: 4,
          original: '  - email: test@test.com',
          replacement: '  - email: {{email}}',
          parameterName: 'email',
          description: '替换邮箱',
        },
      ];

      const result = yamlChecker.applySuggestions(yamlContent, suggestions);

      expect(result).toContain('{{password}}');
      expect(result).toContain('{{email}}');
      expect(result).not.toContain('secret123');
      expect(result).not.toContain('test@test.com');
    });
  });

  describe('generateParameterDefinitions', () => {
    it('should generate parameter YAML block', () => {
      const suggestions = [
        {
          line: 1,
          original: '',
          replacement: '',
          parameterName: 'password',
          description: '用户密码',
        },
        {
          line: 2,
          original: '',
          replacement: '',
          parameterName: 'email',
          description: '用户邮箱',
        },
      ];

      const result = yamlChecker.generateParameterDefinitions(suggestions);

      expect(result).toContain('params:');
      expect(result).toContain('password:');
      expect(result).toContain('email:');
    });

    it('should deduplicate parameters', () => {
      const suggestions = [
        {
          line: 1,
          original: '',
          replacement: '',
          parameterName: 'password',
          description: '密码1',
        },
        {
          line: 2,
          original: '',
          replacement: '',
          parameterName: 'password',
          description: '密码2',
        },
      ];

      const result = yamlChecker.generateParameterDefinitions(suggestions);
      const passwordCount = (result.match(/password:/g) || []).length;

      expect(passwordCount).toBe(1);
    });
  });

  describe('hasSensitiveData', () => {
    it('should return true when sensitive data detected', async () => {
      vi.mocked(detectorEngine.detect).mockResolvedValue([
        {
          ruleId: 'password',
          ruleName: '密码',
          category: 'credential',
          position: { start: 0, end: 10 },
          value: 'secret',
        },
      ]);

      const result = await yamlChecker.hasSensitiveData('password: secret');

      expect(result).toBe(true);
    });

    it('should return false when no sensitive data detected', async () => {
      vi.mocked(detectorEngine.detect).mockResolvedValue([]);

      const result = await yamlChecker.hasSensitiveData('action: click');

      expect(result).toBe(false);
    });
  });
});
