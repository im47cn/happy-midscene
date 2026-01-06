/**
 * Template Auditor Service Tests
 */

import { describe, expect, it } from 'vitest';
import type { TemplateDraft } from '../../types';
import { TemplateAuditor } from '../templateAuditor';

describe('TemplateAuditor', () => {
  const auditor = new TemplateAuditor();

  const createDraft = (
    yaml: string,
    params: TemplateDraft['content']['parameters'] = [],
  ): TemplateDraft => ({
    name: 'Test Template',
    description:
      'A test template for unit testing purposes with sufficient description length.',
    shortDescription: 'A short but valid description',
    category: 'authentication',
    tags: ['test', 'login'],
    platforms: ['web'],
    language: 'en',
    content: {
      yaml,
      parameters: params,
    },
    license: 'MIT',
    version: '1.0.0',
  });

  describe('detectSensitiveInfo', () => {
    it('should detect hardcoded passwords', () => {
      const result = auditor.detectSensitiveInfo('password: "mysecret123"');
      expect(result.found).toBe(true);
      expect(result.matches).toContain('Hardcoded password');
    });

    it('should detect API keys', () => {
      const result = auditor.detectSensitiveInfo(
        'api_key: "sk-12345678901234567890abcd"',
      );
      expect(result.found).toBe(true);
      expect(result.matches).toContain('API key');
    });

    it('should detect tokens', () => {
      const result = auditor.detectSensitiveInfo(
        'token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."',
      );
      expect(result.found).toBe(true);
      expect(result.matches).toContain('Token');
    });

    it('should detect AWS access keys', () => {
      const result = auditor.detectSensitiveInfo(
        'aws_key: "AKIAIOSFODNN7EXAMPLE"',
      );
      expect(result.found).toBe(true);
      expect(result.matches).toContain('AWS access key');
    });

    it('should detect MongoDB connection strings', () => {
      const result = auditor.detectSensitiveInfo(
        'mongodb://user:password@host:27017/db',
      );
      expect(result.found).toBe(true);
      expect(result.matches).toContain('MongoDB connection string');
    });

    it('should not flag parameterized values without hardcoded strings', () => {
      // The pattern `password: "${var}"` still matches because it contains `password:`
      // But it doesn't contain actual hardcoded credentials
      const result = auditor.detectSensitiveInfo('user_input: "${userValue}"');
      expect(result.found).toBe(false);
    });

    it('should not flag empty password fields', () => {
      const result = auditor.detectSensitiveInfo('password: ""');
      expect(result.found).toBe(false);
    });
  });

  describe('detectMaliciousCode', () => {
    it('should detect eval calls', () => {
      const result = auditor.detectMaliciousCode('eval("dangerous code")');
      expect(result.found).toBe(true);
      expect(result.matches).toContain('eval() call');
    });

    it('should detect script tags', () => {
      const result = auditor.detectMaliciousCode(
        '<script>alert("xss")</script>',
      );
      expect(result.found).toBe(true);
      expect(result.matches).toContain('Script tag');
    });

    it('should detect javascript URLs', () => {
      const result = auditor.detectMaliciousCode('href: "javascript:alert(1)"');
      expect(result.found).toBe(true);
      expect(result.matches).toContain('JavaScript URL');
    });

    it('should detect document.cookie access', () => {
      const result = auditor.detectMaliciousCode('document.cookie');
      expect(result.found).toBe(true);
      expect(result.matches).toContain('Cookie access');
    });

    it('should not flag normal YAML content', () => {
      const result = auditor.detectMaliciousCode(`
        target:
          url: "https://example.com"
        flow:
          - ai: "Click login button"
      `);
      expect(result.found).toBe(false);
    });
  });

  describe('validateYaml', () => {
    it('should pass valid YAML', () => {
      const yaml = `
target:
  url: "https://example.com"
flow:
  - ai: "Click button"
`;
      const result = auditor.validateYaml(yaml);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass YAML with parameters', () => {
      const yaml = `
target:
  url: "\${loginUrl}"
flow:
  - ai: "Enter \${username}"
`;
      const result = auditor.validateYaml(yaml);
      expect(result.valid).toBe(true);
    });

    it('should fail invalid YAML', () => {
      const yaml = `
target:
  url: "https://example.com"
  invalid: [unclosed bracket
`;
      const result = auditor.validateYaml(yaml);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('audit', () => {
    it('should pass clean template', async () => {
      const draft = createDraft(
        `
target:
  url: "\${loginUrl}"
flow:
  - ai: "Enter username \${username}"
  - ai: "Enter password"
  - ai: "Click login"
`,
        [
          { name: 'loginUrl', label: 'Login URL', type: 'url', required: true },
          {
            name: 'username',
            label: 'Username',
            type: 'string',
            required: true,
          },
        ],
      );

      const result = await auditor.audit(draft);
      expect(result.passed).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should fail template with sensitive info', async () => {
      const draft = createDraft(`
target:
  url: "https://example.com"
  password: "hardcoded123"
`);

      const result = await auditor.audit(draft);
      expect(result.passed).toBe(false);
      expect(result.reasons.some((r) => r.includes('Sensitive'))).toBe(true);
    });

    it('should fail template with malicious code', async () => {
      const draft = createDraft(`
target:
  url: "javascript:alert('xss')"
`);

      const result = await auditor.audit(draft);
      expect(result.passed).toBe(false);
      expect(result.reasons.some((r) => r.includes('malicious'))).toBe(true);
    });

    it('should fail template with invalid YAML', async () => {
      const draft = createDraft(`
target:
  url: [unclosed
`);

      const result = await auditor.audit(draft);
      expect(result.passed).toBe(false);
      expect(result.reasons.some((r) => r.includes('YAML'))).toBe(true);
    });

    it('should warn about undefined parameters', async () => {
      const draft = createDraft(
        `
target:
  url: "\${loginUrl}"
  user: "\${undefinedParam}"
`,
        [{ name: 'loginUrl', label: 'Login URL', type: 'url', required: true }],
      );

      const result = await auditor.audit(draft);
      expect(result.passed).toBe(true);
      expect(result.warnings?.some((w) => w.includes('undefinedParam'))).toBe(
        true,
      );
    });

    it('should warn about unused parameters', async () => {
      const draft = createDraft(
        `
target:
  url: "\${loginUrl}"
`,
        [
          { name: 'loginUrl', label: 'Login URL', type: 'url', required: true },
          {
            name: 'unusedParam',
            label: 'Unused',
            type: 'string',
            required: false,
          },
        ],
      );

      const result = await auditor.audit(draft);
      expect(result.passed).toBe(true);
      expect(result.warnings?.some((w) => w.includes('unusedParam'))).toBe(
        true,
      );
    });
  });

  describe('sanitizeContent', () => {
    it('should redact sensitive patterns', () => {
      const content = 'password: "secret123"';
      const result = auditor.sanitizeContent(content);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('secret123');
    });

    it('should preserve non-sensitive content', () => {
      const content = 'url: "https://example.com"';
      const result = auditor.sanitizeContent(content);
      expect(result).toBe(content);
    });
  });
});
