/**
 * Detector Engine Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { DetectionRule } from '../../../types/masking';
import { DetectorEngine } from '../detectorEngine';

describe('DetectorEngine', () => {
  let engine: DetectorEngine;

  beforeEach(() => {
    engine = new DetectorEngine();
  });

  describe('detect', () => {
    describe('credential detection', () => {
      it('should detect password in key-value format', async () => {
        const text = 'config: password=abc123';
        const results = await engine.detect(text);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((r) => r.category === 'credential')).toBe(true);
      });

      it('should detect password with quotes', async () => {
        const text = 'password: "secret123"';
        const results = await engine.detect(text);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].value).toBe('secret123');
      });

      it('should detect API keys', async () => {
        const text = 'api_key=sk_test_1234567890abcdef';
        const results = await engine.detect(text);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((r) => r.ruleName.includes('API'))).toBe(true);
      });

      it('should detect Bearer tokens', async () => {
        const text =
          'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
        const results = await engine.detect(text);

        expect(results.length).toBeGreaterThan(0);
        // Should match both Bearer token and JWT patterns
      });

      it('should detect JWT tokens', async () => {
        const text =
          'token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const results = await engine.detect(text);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((r) => r.ruleName === 'JWT Token')).toBe(true);
      });

      it('should detect OpenAI API keys', async () => {
        // Use text format that only matches OpenAI pattern, not API Key pattern
        const text = 'My key is sk-abcdefghijklmnopqrstuvwxyz123456 here';
        const results = await engine.detect(text);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((r) => r.ruleName === 'OpenAI API Key')).toBe(true);
      });

      it('should detect AWS access keys', async () => {
        const text = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
        const results = await engine.detect(text);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((r) => r.ruleName === 'AWS Access Key')).toBe(true);
      });
    });

    describe('PII detection', () => {
      it('should detect Chinese mobile phone numbers', async () => {
        const text = '联系电话：13812345678';
        const results = await engine.detect(text);

        expect(results.length).toBe(1);
        expect(results[0].category).toBe('pii');
        expect(results[0].value).toBe('13812345678');
      });

      it('should detect Chinese ID card numbers', async () => {
        const text = '身份证号：110101199001011234';
        const results = await engine.detect(text);

        expect(results.length).toBe(1);
        expect(results[0].category).toBe('pii');
        expect(results[0].value).toBe('110101199001011234');
      });

      it('should detect email addresses', async () => {
        const text = '邮箱: test@example.com';
        const results = await engine.detect(text);

        expect(results.length).toBe(1);
        expect(results[0].category).toBe('pii');
        expect(results[0].value).toBe('test@example.com');
      });

      it('should handle multiple phone numbers', async () => {
        const text = '手机1: 13812345678, 手机2: 15987654321';
        const results = await engine.detect(text);

        expect(results.length).toBe(2);
        expect(results.every((r) => r.category === 'pii')).toBe(true);
      });
    });

    describe('financial detection', () => {
      it('should detect bank card numbers', async () => {
        const text = '银行卡号: 6222 0200 1234 5678';
        const results = await engine.detect(text);

        expect(results.length).toBe(1);
        expect(results[0].category).toBe('financial');
      });

      it('should detect card numbers without spaces', async () => {
        const text = '卡号：6222020012345678';
        const results = await engine.detect(text);

        expect(results.length).toBe(1);
        expect(results[0].category).toBe('financial');
      });

      it('should detect CVV codes', async () => {
        const text = 'CVV: 123';
        const results = await engine.detect(text);

        expect(results.length).toBe(1);
        expect(results[0].category).toBe('financial');
      });
    });

    describe('scope filtering', () => {
      it('should filter by text scope', async () => {
        const text = '密码：abc123, 手机：13812345678';
        const results = await engine.detect(text, 'text');

        expect(results.length).toBeGreaterThan(0);
      });

      it('should filter by yaml scope', async () => {
        const text = 'password: abc123';
        const results = await engine.detect(text, 'yaml');

        // Password rule has yaml scope enabled
        expect(results.length).toBeGreaterThan(0);
      });
    });

    describe('edge cases', () => {
      it('should return empty array for empty text', async () => {
        const results = await engine.detect('');
        expect(results).toEqual([]);
      });

      it('should return empty array for null/undefined', async () => {
        const results = await engine.detect(null as unknown as string);
        expect(results).toEqual([]);
      });

      it('should not detect non-sensitive data', async () => {
        const text = 'Hello, this is a normal message without sensitive data.';
        const results = await engine.detect(text);

        expect(results.length).toBe(0);
      });

      it('should handle overlapping matches by priority', async () => {
        const text = 'api_key=sk-abcdefghijklmnopqrstuvwxyz123456';
        const results = await engine.detect(text);

        // Should not have overlapping results
        const positions = results.map(
          (r) => `${r.position.start}-${r.position.end}`,
        );
        const uniquePositions = new Set(positions);
        expect(positions.length).toBe(uniquePositions.size);
      });
    });
  });

  describe('rule management', () => {
    it('should add custom rules', () => {
      const customRule: DetectionRule = {
        id: 'custom-test',
        name: 'Custom Test Rule',
        description: 'Test custom rule',
        enabled: true,
        priority: 50,
        detection: {
          type: 'regex',
          pattern: 'SECRET_\\w+',
          flags: 'g',
        },
        masking: {
          method: 'placeholder',
          options: { placeholder: '[CUSTOM]' },
        },
        scope: { text: true, screenshot: false, log: true, yaml: true },
        category: 'custom',
        builtIn: false,
      };

      engine.addRule(customRule);
      const rules = engine.getRules();

      expect(rules.some((r) => r.id === 'custom-test')).toBe(true);
    });

    it('should enable/disable rules', () => {
      // Disable a built-in rule
      engine.disableRule('builtin-password');

      const rule = engine.getRule('builtin-password');
      expect(rule?.enabled).toBe(false);

      // Re-enable it
      engine.enableRule('builtin-password');
      const reEnabled = engine.getRule('builtin-password');
      expect(reEnabled?.enabled).toBe(true);
    });

    it('should not remove built-in rules', () => {
      const initialCount = engine.getRules().length;
      engine.removeRule('builtin-password');

      // Built-in rule should still exist
      const afterCount = engine.getRules().length;
      expect(afterCount).toBe(initialCount);
    });

    it('should remove custom rules', () => {
      const customRule: DetectionRule = {
        id: 'temp-rule',
        name: 'Temp Rule',
        description: 'Temporary rule',
        enabled: true,
        priority: 50,
        detection: { type: 'regex', pattern: 'TEMP', flags: 'g' },
        masking: { method: 'full' },
        scope: { text: true, screenshot: false, log: true, yaml: true },
        category: 'custom',
        builtIn: false,
      };

      engine.addRule(customRule);
      expect(engine.getRules().some((r) => r.id === 'temp-rule')).toBe(true);

      engine.removeRule('temp-rule');
      expect(engine.getRules().some((r) => r.id === 'temp-rule')).toBe(false);
    });
  });
});
