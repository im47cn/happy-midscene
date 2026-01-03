/**
 * Log Masker
 * Intercepts and masks sensitive data in console logs
 */

import type { ILogMasker } from '../../types/masking';
import { type MaskerEngine, maskerEngine } from './maskerEngine';

/**
 * LogMasker implementation
 * Wraps console methods to automatically mask sensitive data
 */
export class LogMasker implements ILogMasker {
  private masker: MaskerEngine;
  private originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  } | null = null;
  private isWrapped = false;

  constructor(masker?: MaskerEngine) {
    this.masker = masker || maskerEngine;
  }

  /**
   * Mask a log message and its data
   * @param message - The log message
   * @param data - Optional additional data
   * @returns Masked message and data
   */
  mask(message: string, data?: unknown): { message: string; data?: unknown } {
    // Mask the message
    const maskedMessage = this.maskSync(message);

    // Mask data if provided
    let maskedData = data;
    if (data !== undefined) {
      maskedData = this.maskData(data);
    }

    return {
      message: maskedMessage,
      data: maskedData,
    };
  }

  /**
   * Synchronous mask for performance in hot paths
   */
  private maskSync(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // Use a simplified synchronous masking for logs
    // This avoids the async overhead for frequent log calls
    let result = text;

    // Quick patterns for common sensitive data
    const patterns = [
      // Passwords
      {
        regex:
          /(?:password|pwd|passwd|pass|secret)\s*[:=]\s*["']?([^"'\s,;}{[\]]+)["']?/gi,
        replacement: '[PASSWORD]',
      },
      // API Keys
      {
        regex:
          /(?:api[_-]?key|apikey)\s*[:=]\s*["']?([a-zA-Z0-9_-]{16,})["']?/gi,
        replacement: '[API_KEY]',
      },
      // Bearer Tokens
      {
        regex: /Bearer\s+([a-zA-Z0-9_\-.]+)/gi,
        replacement: 'Bearer [TOKEN]',
      },
      // JWT Tokens
      {
        regex: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        replacement: '[JWT_TOKEN]',
      },
      // OpenAI Keys
      {
        regex: /sk-[a-zA-Z0-9]{32,}/g,
        replacement: '[OPENAI_KEY]',
      },
      // Chinese Mobile Phones
      {
        regex: /(?<![0-9])1[3-9]\d{9}(?![0-9])/g,
        replacement: (match: string) =>
          match.substring(0, 3) + '****' + match.substring(7),
      },
      // Chinese ID Cards
      {
        regex:
          /(?<![0-9])[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?![0-9])/g,
        replacement: (match: string) =>
          match.substring(0, 6) + '********' + match.substring(14),
      },
    ];

    for (const { regex, replacement } of patterns) {
      if (typeof replacement === 'string') {
        result = result.replace(regex, replacement);
      } else {
        result = result.replace(regex, replacement);
      }
    }

    return result;
  }

  /**
   * Recursively mask sensitive data in objects/arrays
   */
  private maskData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.maskSync(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.maskData(item));
    }

    if (typeof data === 'object') {
      const masked: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        // Check if key indicates sensitive data
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('apikey') ||
          lowerKey.includes('api_key')
        ) {
          masked[key] = '[MASKED]';
        } else {
          masked[key] = this.maskData(value);
        }
      }
      return masked;
    }

    return data;
  }

  /**
   * Wrap console methods to automatically mask logs
   */
  wrapConsole(): void {
    if (this.isWrapped) {
      return;
    }

    // Store original methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
    };

    // Create wrapped methods
    const createWrappedMethod = (original: (...args: unknown[]) => void) => {
      return (...args: unknown[]) => {
        const maskedArgs = args.map((arg) => {
          if (typeof arg === 'string') {
            return this.maskSync(arg);
          }
          return this.maskData(arg);
        });
        original(...maskedArgs);
      };
    };

    // Replace console methods
    console.log = createWrappedMethod(this.originalConsole.log);
    console.info = createWrappedMethod(this.originalConsole.info);
    console.warn = createWrappedMethod(this.originalConsole.warn);
    console.error = createWrappedMethod(this.originalConsole.error);
    console.debug = createWrappedMethod(this.originalConsole.debug);

    this.isWrapped = true;
  }

  /**
   * Restore original console methods
   */
  unwrapConsole(): void {
    if (!this.isWrapped || !this.originalConsole) {
      return;
    }

    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;

    this.originalConsole = null;
    this.isWrapped = false;
  }

  /**
   * Check if console is wrapped
   */
  isConsoleWrapped(): boolean {
    return this.isWrapped;
  }
}

/**
 * Default log masker instance
 */
export const logMasker = new LogMasker();
