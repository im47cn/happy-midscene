/**
 * Environment Manager
 *
 * Manages environment variables, secrets, and configuration merging.
 */

import { existsSync, readFileSync } from 'node:fs';

// Optional dotenv import
let dotenvConfig: ((options?: any) => any) | undefined;
try {
  // @ts-ignore - optional dependency
  dotenvConfig = require('dotenv').config;
} catch {
  // dotenv not available
}

/**
 * Environment value source
 */
export type EnvSource = 'process' | 'dotenv' | 'config' | 'default';

/**
 * Environment value metadata
 */
export interface EnvValue {
  /** The value */
  value: string;
  /** Where the value came from */
  source: EnvSource;
  /** Whether this is a secret (should be masked in logs) */
  isSecret: boolean;
}

/**
 * Environment configuration
 */
export interface EnvConfig {
  /** Prefix for environment variables (e.g., 'MIDSCENE_') */
  prefix?: string;
  /** Path to .env file */
  envPath?: string;
  /** Default values */
  defaults?: Record<string, string>;
  /** Secret patterns (values matching these will be masked) */
  secretPatterns?: string[];
  /** Required variables */
  required?: string[];
}

/**
 * Environment Manager
 *
 * Manages environment variables with priority:
 * 1. Process env (highest)
 * 2. .env file
 * 3. Config values
 * 4. Defaults (lowest)
 */
export class EnvManager {
  private config: EnvConfig;
  private dotenvValues: Record<string, string> = {};
  private configValues: Record<string, string> = {};
  private cache = new Map<string, EnvValue>();

  // Default secret patterns
  private static DEFAULT_SECRET_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /private[_-]?key/i,
    /auth/i,
    /credential/i,
  ];

  constructor(config: EnvConfig = {}) {
    this.config = {
      prefix: 'MIDSCENE_',
      envPath: '.env',
      secretPatterns: [],
      defaults: {},
      required: [],
      ...config,
    };

    this.loadDotenv();
  }

  /**
   * Load .env file
   */
  private loadDotenv(): void {
    if (!dotenvConfig) {
      return;
    }

    if (this.config.envPath && existsSync(this.config.envPath)) {
      const result = dotenvConfig({ path: this.config.envPath });
      this.dotenvValues = result.parsed || {};
    }
  }

  /**
   * Set config values (from config file)
   */
  setConfigValues(values: Record<string, string>): void {
    this.configValues = { ...values };
    this.cache.clear();
  }

  /**
   * Get environment variable
   */
  get(key: string, defaultValue?: string): string {
    const cached = this.cache.get(key);
    if (cached) {
      return cached.value;
    }

    // Try with prefix first
    const prefixedKey = this.config.prefix
      ? `${this.config.prefix}${key}`
      : key;
    const result = this.resolve(key, prefixedKey);

    // Cache the result
    this.cache.set(key, result);

    return result.value || defaultValue || '';
  }

  /**
   * Get environment variable with metadata
   */
  getWithMeta(key: string): EnvValue | undefined {
    const prefixedKey = this.config.prefix
      ? `${this.config.prefix}${key}`
      : key;
    return this.resolve(key, prefixedKey);
  }

  /**
   * Get all environment variables
   */
  getAll(): Record<string, string> {
    const result: Record<string, string> = {};

    // Collect all keys from all sources
    const keys = new Set<string>();

    Object.keys(process.env).forEach((k) => keys.add(k));
    Object.keys(this.dotenvValues).forEach((k) => keys.add(k));
    Object.keys(this.configValues).forEach((k) => keys.add(k));
    Object.keys(this.config.defaults || {}).forEach((k) => keys.add(k));

    for (const key of keys) {
      // Strip prefix for output
      const unprefixed = this.config.prefix
        ? key.replace(new RegExp(`^${this.config.prefix}`), '')
        : key;

      if (unprefixed !== key) {
        result[unprefixed] = this.get(unprefixed);
      }
    }

    return result;
  }

  /**
   * Check if all required variables are set
   */
  validateRequired(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const key of this.config.required || []) {
      const value = this.get(key);
      if (!value) {
        missing.push(key);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Mask secrets in a string
   */
  maskSecrets(input: string): string {
    let output = input;
    const patterns = [
      ...EnvManager.DEFAULT_SECRET_PATTERNS,
      ...(this.config.secretPatterns || []),
    ];

    // Get all env values that might be secrets
    for (const [key, meta] of this.cache.entries()) {
      if (meta.isSecret && meta.value) {
        output = output.replace(new RegExp(meta.value, 'g'), '***');
      }
    }

    // Also mask values that match secret patterns
    for (const pattern of patterns) {
      if (pattern instanceof RegExp) {
        // Look for common patterns in the input
        output = output.replace(
          new RegExp(`(${pattern.source})\\s*[=:]\\s*\\S+`, 'gi'),
          '$1: ***',
        );
      }
    }

    return output;
  }

  /**
   * Resolve environment variable from all sources
   */
  private resolve(key: string, prefixedKey: string): EnvValue {
    // Priority 1: Process env (prefixed)
    if (process.env[prefixedKey] !== undefined) {
      return {
        value: process.env[prefixedKey]!,
        source: 'process',
        isSecret: this.isSecretKey(prefixedKey),
      };
    }

    // Priority 2: Process env (unprefixed)
    if (process.env[key] !== undefined) {
      return {
        value: process.env[key]!,
        source: 'process',
        isSecret: this.isSecretKey(key),
      };
    }

    // Priority 3: Dotenv (prefixed)
    if (this.dotenvValues[prefixedKey] !== undefined) {
      return {
        value: this.dotenvValues[prefixedKey]!,
        source: 'dotenv',
        isSecret: this.isSecretKey(prefixedKey),
      };
    }

    // Priority 4: Dotenv (unprefixed)
    if (this.dotenvValues[key] !== undefined) {
      return {
        value: this.dotenvValues[key]!,
        source: 'dotenv',
        isSecret: this.isSecretKey(key),
      };
    }

    // Priority 5: Config values
    if (this.configValues[key] !== undefined) {
      return {
        value: this.configValues[key]!,
        source: 'config',
        isSecret: false,
      };
    }

    // Priority 6: Defaults
    if (this.config.defaults && this.config.defaults[key] !== undefined) {
      return {
        value: this.config.defaults[key]!,
        source: 'default',
        isSecret: false,
      };
    }

    return {
      value: '',
      source: 'default',
      isSecret: false,
    };
  }

  /**
   * Check if a key is likely a secret
   */
  private isSecretKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return EnvManager.DEFAULT_SECRET_PATTERNS.some((pattern) =>
      pattern.test(lowerKey),
    );
  }

  /**
   * Create a child environment with different defaults
   */
  withDefaults(defaults: Record<string, string>): EnvManager {
    const child = new EnvManager({
      ...this.config,
      defaults: { ...this.config.defaults, ...defaults },
    });
    child.dotenvValues = { ...this.dotenvValues };
    child.configValues = { ...this.configValues };
    return child;
  }

  /**
   * Create a child environment with different prefix
   */
  withPrefix(prefix: string): EnvManager {
    const child = new EnvManager({
      ...this.config,
      prefix,
    });
    child.dotenvValues = { ...this.dotenvValues };
    child.configValues = { ...this.configValues };
    return child;
  }
}

/**
 * Create environment manager with config
 */
export function createEnvManager(config?: EnvConfig): EnvManager {
  return new EnvManager(config);
}

/**
 * Global environment manager instance
 */
let globalEnvManager: EnvManager | undefined;

/**
 * Get or create global environment manager
 */
export function getEnvManager(config?: EnvConfig): EnvManager {
  if (!globalEnvManager) {
    globalEnvManager = new EnvManager(config);
  }
  return globalEnvManager;
}
