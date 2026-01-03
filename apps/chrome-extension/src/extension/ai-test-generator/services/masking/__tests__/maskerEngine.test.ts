/**
 * Masker Engine Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MaskerEngine, applyMaskingMethod } from '../maskerEngine';

describe('MaskerEngine', () => {
  let engine: MaskerEngine;

  beforeEach(() => {
    engine = new MaskerEngine();
    // Enable masking for tests
    engine.setConfig({ enabled: true });
  });

  describe('maskText', () => {
    describe('credential masking', () => {
      it('should mask passwords', async () => {
        const result = await engine.maskText('password=secret123', 'text');

        expect(result.masked).toContain('[PASSWORD]');
        expect(result.masked).not.toContain('secret123');
        expect(result.matches.length).toBe(1);
        expect(result.matches[0].category).toBe('credential');
      });

      it('should mask API keys', async () => {
        const result = await engine.maskText(
          'api_key=sk_test_1234567890abcdef',
          'text',
        );

        expect(result.masked).toContain('[API_KEY]');
        expect(result.masked).not.toContain('sk_test');
      });

      it('should mask JWT tokens', async () => {
        const jwt =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const result = await engine.maskText(`token: ${jwt}`, 'text');

        expect(result.masked).toContain('[JWT_TOKEN]');
        expect(result.masked).not.toContain('eyJhbGci');
      });

      it('should mask OpenAI keys', async () => {
        const result = await engine.maskText(
          'OPENAI_KEY=sk-abcdefghijklmnopqrstuvwxyz123456',
          'text',
        );

        expect(result.masked).toContain('[OPENAI_KEY]');
      });
    });

    describe('PII masking', () => {
      it('should partially mask phone numbers', async () => {
        const result = await engine.maskText('手机号: 13812345678', 'text');

        expect(result.masked).toContain('138');
        expect(result.masked).toContain('5678');
        expect(result.masked).toContain('****');
        expect(result.masked).not.toContain('12345678');
      });

      it('should partially mask ID card numbers', async () => {
        const result = await engine.maskText(
          '身份证: 110101199001011234',
          'text',
        );

        expect(result.masked).toContain('110101');
        expect(result.masked).toContain('1234');
        expect(result.masked).toContain('****');
      });

      it('should hash mask email addresses', async () => {
        const result = await engine.maskText('email: test@example.com', 'text');

        expect(result.masked).toContain('[EMAIL:');
        expect(result.masked).not.toContain('test@');
      });
    });

    describe('financial masking', () => {
      it('should partially mask bank card numbers', async () => {
        const result = await engine.maskText('卡号: 6222020012345678', 'text');

        expect(result.masked).toContain('6222');
        expect(result.masked).toContain('5678');
        expect(result.masked).toContain('****');
      });

      it('should fully mask CVV codes', async () => {
        const result = await engine.maskText('CVV: 123', 'text');

        expect(result.masked).not.toContain('123');
      });
    });

    describe('multiple sensitive data', () => {
      it('should mask multiple items in one text', async () => {
        const text = '用户信息: 手机13812345678, 密码password=abc123';
        const result = await engine.maskText(text, 'text');

        expect(result.matches.length).toBeGreaterThanOrEqual(2);
        expect(result.masked).not.toContain('12345678');
        expect(result.masked).not.toContain('abc123');
      });
    });

    describe('scope handling', () => {
      it('should respect yaml scope', async () => {
        const result = await engine.maskText('password: secret', 'yaml');

        expect(result.masked).toContain('[PASSWORD]');
      });

      it('should respect log scope', async () => {
        const result = await engine.maskText(
          'User logged in with password=test',
          'log',
        );

        expect(result.masked).toContain('[PASSWORD]');
      });
    });

    describe('configuration', () => {
      it('should not mask when disabled', async () => {
        engine.setConfig({ enabled: false });

        const result = await engine.maskText('password=secret123', 'text');

        expect(result.masked).toContain('secret123');
        expect(result.matches.length).toBe(0);
      });

      it('should not mask when scope is disabled', async () => {
        engine.setConfig({ enabled: true, yamlMasking: false });

        const result = await engine.maskText('password=secret123', 'yaml');

        expect(result.masked).toContain('secret123');
      });
    });

    describe('result metadata', () => {
      it('should include processing time', async () => {
        const result = await engine.maskText('password=secret', 'text');

        expect(result.processingTime).toBeGreaterThanOrEqual(0);
      });

      it('should preserve original text', async () => {
        const original = 'password=secret123';
        const result = await engine.maskText(original, 'text');

        expect(result.original).toBe(original);
      });

      it('should include match details', async () => {
        const result = await engine.maskText('password=secret123', 'text');

        expect(result.matches[0]).toHaveProperty('ruleId');
        expect(result.matches[0]).toHaveProperty('ruleName');
        expect(result.matches[0]).toHaveProperty('category');
        expect(result.matches[0]).toHaveProperty('position');
        expect(result.matches[0]).toHaveProperty('originalValue');
        expect(result.matches[0]).toHaveProperty('maskedValue');
      });
    });
  });

  describe('applyMaskingMethod', () => {
    describe('full masking', () => {
      it('should replace all characters with mask char', () => {
        const result = applyMaskingMethod('secret123', 'full', {});

        expect(result).toMatch(/^\*+$/);
      });

      it('should use custom mask char', () => {
        const result = applyMaskingMethod('secret', 'full', { maskChar: 'X' });

        expect(result).toMatch(/^X+$/);
      });

      it('should limit length to 16 characters', () => {
        const result = applyMaskingMethod('a'.repeat(100), 'full', {});

        expect(result.length).toBe(16);
      });
    });

    describe('partial masking', () => {
      it('should keep start and end characters', () => {
        const result = applyMaskingMethod('13812345678', 'partial', {
          keepStart: 3,
          keepEnd: 4,
        });

        expect(result.startsWith('138')).toBe(true);
        expect(result.endsWith('5678')).toBe(true);
        expect(result).toContain('****');
      });

      it('should handle short values', () => {
        const result = applyMaskingMethod('abc', 'partial', {
          keepStart: 3,
          keepEnd: 4,
        });

        // Value is too short, should be fully masked
        expect(result).toBe('***');
      });
    });

    describe('hash masking', () => {
      it('should produce consistent hash', () => {
        const result1 = applyMaskingMethod('test@email.com', 'hash', {});
        const result2 = applyMaskingMethod('test@email.com', 'hash', {});

        expect(result1).toBe(result2);
      });

      it('should include category prefix for emails', () => {
        const result = applyMaskingMethod('test@example.com', 'hash', {});

        expect(result).toContain('[EMAIL:');
      });

      it('should produce different hashes for different values', () => {
        const result1 = applyMaskingMethod('value1', 'hash', {});
        const result2 = applyMaskingMethod('value2', 'hash', {});

        expect(result1).not.toBe(result2);
      });
    });

    describe('placeholder masking', () => {
      it('should use provided placeholder', () => {
        const result = applyMaskingMethod('secret', 'placeholder', {
          placeholder: '[HIDDEN]',
        });

        expect(result).toBe('[HIDDEN]');
      });

      it('should use default placeholder when not provided', () => {
        const result = applyMaskingMethod('secret', 'placeholder', {});

        expect(result).toBe('[SENSITIVE]');
      });
    });
  });
});
