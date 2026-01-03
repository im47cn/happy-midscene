/**
 * Log Masker Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogMasker, logMasker } from '../logMasker';

describe('LogMasker', () => {
  let masker: LogMasker;

  beforeEach(() => {
    masker = new LogMasker();
  });

  afterEach(() => {
    masker.unwrapConsole();
  });

  describe('mask', () => {
    it('should mask password in message', () => {
      const result = masker.mask('password=secret123');

      expect(result.message).toContain('[PASSWORD]');
      expect(result.message).not.toContain('secret123');
    });

    it('should mask API keys in message', () => {
      const result = masker.mask('api_key=abcdef1234567890abcdef');

      expect(result.message).toContain('[API_KEY]');
    });

    it('should mask phone numbers in message', () => {
      const result = masker.mask('phone: 13812345678');

      expect(result.message).toContain('138');
      expect(result.message).toContain('****');
      expect(result.message).not.toContain('12345678');
    });

    it('should mask JWT tokens in message', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = masker.mask(`token: ${jwt}`);

      expect(result.message).toContain('[JWT_TOKEN]');
    });

    it('should mask OpenAI keys in message', () => {
      const result = masker.mask('sk-abcdefghijklmnopqrstuvwxyz123456');

      expect(result.message).toContain('[OPENAI_KEY]');
    });

    it('should mask Chinese ID card numbers', () => {
      const result = masker.mask('身份证: 110101199001011234');

      expect(result.message).toContain('110101');
      expect(result.message).toContain('****');
    });

    it('should mask data object with sensitive keys', () => {
      const result = masker.mask('User data:', {
        username: 'testuser',
        password: 'secret',
        apiKey: 'key123',
      });

      expect(result.data).toEqual({
        username: 'testuser',
        password: '[MASKED]',
        apiKey: '[MASKED]',
      });
    });

    it('should mask sensitive data in nested objects', () => {
      const result = masker.mask('Config:', {
        user: {
          name: 'John',
          secret: 'hidden',
        },
      });

      expect((result.data as any).user.secret).toBe('[MASKED]');
      expect((result.data as any).user.name).toBe('John');
    });

    it('should mask arrays of strings', () => {
      const result = masker.mask('Logs:', [
        'password=test123',
        'normal log',
        'api_key=abcdef1234567890abcdef',
      ]);

      const data = result.data as string[];
      expect(data[0]).toContain('[PASSWORD]');
      expect(data[1]).toBe('normal log');
      expect(data[2]).toContain('[API_KEY]');
    });
  });

  describe('wrapConsole / unwrapConsole', () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    let logOutput: string[] = [];

    beforeEach(() => {
      logOutput = [];
      console.log = vi.fn((...args) => {
        logOutput.push(args.join(' '));
      });
      console.warn = vi.fn((...args) => {
        logOutput.push(args.join(' '));
      });
      console.error = vi.fn((...args) => {
        logOutput.push(args.join(' '));
      });
    });

    afterEach(() => {
      masker.unwrapConsole();
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    });

    it('should mask sensitive data in console.log after wrapConsole', () => {
      masker.wrapConsole();
      console.log('Login with password=secret123');

      expect(logOutput.some((log) => log.includes('[PASSWORD]'))).toBe(true);
      expect(logOutput.some((log) => log.includes('secret123'))).toBe(false);
    });

    it('should mask sensitive data in console.warn', () => {
      masker.wrapConsole();
      console.warn('Warning: api_key=abcdef1234567890abcdef exposed');

      expect(logOutput.some((log) => log.includes('[API_KEY]'))).toBe(true);
    });

    it('should mask sensitive data in console.error', () => {
      masker.wrapConsole();
      console.error('Error: password=failedlogin');

      expect(logOutput.some((log) => log.includes('[PASSWORD]'))).toBe(true);
    });

    it('should properly unwrap console', () => {
      masker.wrapConsole();
      masker.unwrapConsole();
      console.log('password=secret123');

      // After unwrap, masking should not happen
      expect(logOutput.some((log) => log.includes('secret123'))).toBe(true);
    });

    it('should report wrapped status correctly', () => {
      expect(masker.isConsoleWrapped()).toBe(false);

      masker.wrapConsole();
      expect(masker.isConsoleWrapped()).toBe(true);

      masker.unwrapConsole();
      expect(masker.isConsoleWrapped()).toBe(false);
    });

    it('should not double-wrap console', () => {
      masker.wrapConsole();
      masker.wrapConsole(); // Second call should be no-op

      expect(masker.isConsoleWrapped()).toBe(true);
    });
  });

  describe('default instance', () => {
    it('should export a default logMasker instance', () => {
      expect(logMasker).toBeInstanceOf(LogMasker);
    });
  });
});
