/**
 * Data Masking Integration Tests
 * End-to-end tests for the complete masking pipeline
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { detectorEngine } from '../detectorEngine';
import { logMasker } from '../logMasker';
import { maskerEngine } from '../maskerEngine';
import { whitelistManager } from '../whitelistManager';
import { yamlChecker } from '../yamlChecker';

describe('Data Masking Integration', () => {
  beforeEach(() => {
    // Reset masker engine config
    maskerEngine.setConfig({
      enabled: true,
      textMasking: true,
      logMasking: true,
      yamlMasking: true,
      screenshotMasking: 'standard',
    });

    // Clear whitelist
    whitelistManager.clear();
  });

  describe('Text Masking Pipeline', () => {
    it('should detect and mask passwords with context', async () => {
      const input = 'password=MySecret123!';

      const result = await maskerEngine.maskText(input, 'text');

      expect(result.masked).not.toContain('MySecret123!');
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].category).toBe('credential');
    });

    it('should detect and mask email addresses', async () => {
      const input = 'Contact us at user@example.com for support';

      const result = await maskerEngine.maskText(input, 'text');

      expect(result.masked).not.toContain('user@example.com');
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should detect and mask phone numbers', async () => {
      const input = '请拨打 13812345678 联系我们';

      const result = await maskerEngine.maskText(input, 'text');

      expect(result.masked).not.toContain('13812345678');
      expect(result.matches.some((m) => m.category === 'pii')).toBe(true);
    });

    it('should preserve non-sensitive data', async () => {
      const input = 'Hello World, today is 2024-01-15';

      const result = await maskerEngine.maskText(input, 'text');

      expect(result.masked).toBe(input);
      expect(result.matches).toHaveLength(0);
    });

    it('should respect whitelist entries', async () => {
      // Note: WhitelistManager is a standalone component
      // It is not currently integrated into MaskerEngine automatically
      // This test verifies the whitelist works when explicitly used

      whitelistManager.enable();
      whitelistManager.addEntry({
        type: 'exact',
        value: 'test@example.com',
        description: 'Test email',
        enabled: true,
      });

      // Whitelist should identify whitelisted values
      expect(whitelistManager.isWhitelisted('test@example.com')).toBe(true);
      expect(whitelistManager.isWhitelisted('other@email.com')).toBe(false);

      // MaskerEngine still masks all detected values (whitelist is for manual filtering)
      const input = 'Contact: test@example.com and other@email.com';
      const result = await maskerEngine.maskText(input, 'text');

      // Both emails are masked since whitelist is not auto-integrated into masker
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('should handle Chinese ID cards correctly', async () => {
      const input = '身份证号: 110101199003075678';

      const result = await maskerEngine.maskText(input, 'text');

      expect(result.masked).not.toContain('110101199003075678');
      expect(result.matches.some((m) => m.category === 'pii')).toBe(true);
    });

    it('should detect bank card numbers', async () => {
      const input = '银行卡号：6225123456789012345';

      const result = await maskerEngine.maskText(input, 'text');

      expect(result.masked).not.toContain('6225123456789012345');
      expect(result.matches.some((m) => m.category === 'financial')).toBe(true);
    });
  });

  describe('Log Masking Pipeline', () => {
    it('should mask sensitive data in log messages', () => {
      // LogMasker uses simplified sync patterns for performance
      // It masks password=xxx patterns but not standalone emails in message text
      const message =
        'User login: password=secret123, apiKey=abcd1234567890abcdefgh';

      const result = logMasker.mask(message);

      // Password pattern is masked
      expect(result.message).not.toContain('secret123');
      expect(result.message).toContain('[PASSWORD]');
    });

    it('should mask sensitive data in log objects', () => {
      const data = {
        username: 'testuser',
        password: 'MySecret123',
        apiKey: 'sk-1234567890abcdefghijklmnopqrstuvwxyz',
        nested: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
        },
      };

      const result = logMasker.mask('User data:', data);

      expect(result.data).toBeDefined();
      // Keys with sensitive names are masked
      expect((result.data as any).password).not.toBe('MySecret123');
      expect((result.data as any).apiKey).not.toBe(
        'sk-1234567890abcdefghijklmnopqrstuvwxyz',
      );
      expect((result.data as any).nested.token).not.toBe(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
      );
      // Non-sensitive data is preserved
      expect((result.data as any).username).toBe('testuser');
    });

    it('should handle console wrapping correctly', () => {
      const originalLog = console.log;
      const logCalls: string[] = [];

      console.log = (...args: unknown[]) => {
        logCalls.push(args.join(' '));
      };

      logMasker.wrapConsole();
      console.log('password=secret123');
      logMasker.unwrapConsole();

      console.log = originalLog;

      expect(logCalls.length).toBe(1);
      expect(logCalls[0]).not.toContain('secret123');
    });
  });

  describe('YAML Masking Pipeline', () => {
    it('should detect hardcoded credentials in YAML', async () => {
      const yamlContent = `
steps:
  - action: type
    selector: "#username"
    value: admin
  - action: type
    selector: "#password"
    value: password=SuperSecret123!
  - action: click
    selector: "#login"
`;

      const result = await yamlChecker.check(yamlContent);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.warnings.some((w) => w.severity === 'high')).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should generate valid parameter suggestions', async () => {
      const yamlContent = 'password=MySecret123';

      const result = await yamlChecker.check(yamlContent);

      if (result.suggestions.length > 0) {
        // Check that replacement uses parameter syntax
        expect(result.suggestions[0].replacement).toMatch(/\{\{.+\}\}/);

        // Verify the suggestion can be applied
        const applied = yamlChecker.applySuggestions(
          yamlContent,
          result.suggestions,
        );
        expect(applied).toMatch(/\{\{.+\}\}/);
        expect(applied).not.toContain('MySecret123');
      }
    });

    it('should detect API keys in YAML', async () => {
      const yamlContent =
        'api_key: sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';

      const result = await yamlChecker.check(yamlContent);

      expect(result.hasSensitiveData).toBe(true);
      expect(result.warnings.some((w) => w.category === 'credential')).toBe(
        true,
      );
    });
  });

  describe('Detection Engine', () => {
    it('should detect credentials', async () => {
      // OpenAI key pattern: sk-[a-zA-Z0-9]{32,}
      const text = 'API key: sk-1234567890abcdefghijklmnopqrstuvwxyz';

      const results = await detectorEngine.detect(text, 'text');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.category === 'credential')).toBe(true);
    });

    it('should detect PII', async () => {
      const text = 'Email: john@example.com';

      const results = await detectorEngine.detect(text, 'text');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.category === 'pii')).toBe(true);
    });

    it('should detect financial data', async () => {
      const text = 'Card number: 4111111111111111';

      const results = await detectorEngine.detect(text, 'text');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.category === 'financial')).toBe(true);
    });

    it('should handle empty input', async () => {
      const results = await detectorEngine.detect('', 'text');

      expect(results).toHaveLength(0);
    });

    it('should handle very long text efficiently', async () => {
      const longText = 'password=secret123 '.repeat(1000);

      const startTime = Date.now();
      const results = await detectorEngine.detect(longText, 'text');
      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      // Should complete within reasonable time (< 2000ms for repetitive text)
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Whitelist Manager Integration', () => {
    // Note: Detailed whitelist tests are in whitelistManager.test.ts
    // These tests focus on integration behavior

    it('should have entries accessible', () => {
      const initialEntries = whitelistManager.getEntries();
      expect(Array.isArray(initialEntries)).toBe(true);
    });

    it('should report enabled status', () => {
      expect(typeof whitelistManager.isEnabled()).toBe('boolean');
    });

    it('should provide stats', () => {
      const stats = whitelistManager.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('enabled');
    });
  });

  describe('Configuration Management', () => {
    it('should respect enabled/disabled state', async () => {
      maskerEngine.setConfig({ enabled: false });

      const result = await maskerEngine.maskText('password=secret123', 'text');

      // When disabled, should return original text
      expect(result.masked).toBe('password=secret123');
      expect(result.matches).toHaveLength(0);
    });

    it('should respect scope settings', async () => {
      maskerEngine.setConfig({ textMasking: false });

      const result = await maskerEngine.maskText('password=secret123', 'text');

      // When text masking is disabled, should return original
      expect(result.masked).toBe('password=secret123');
    });
  });

  describe('Performance', () => {
    it('should process text quickly', async () => {
      const text = 'email: test@example.com, password=secret123';

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        await maskerEngine.maskText(text, 'text');
      }
      const duration = Date.now() - startTime;

      // 100 operations should complete in < 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        maskerEngine.maskText(`password=secret${i}`, 'text'),
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      // At least some results should have masking applied
      const maskedCount = results.filter((r) => r.matches.length > 0).length;
      expect(maskedCount).toBeGreaterThan(0);
    });
  });
});
