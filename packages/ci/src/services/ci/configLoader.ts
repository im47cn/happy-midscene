/**
 * Configuration Loader
 *
 * Loads and parses YAML configuration files with environment variable substitution.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getEnvManager } from './envManager';

/**
 * Configuration file formats
 */
export type ConfigFormat = 'yaml' | 'json' | 'midscene';

/**
 * Configuration load options
 */
export interface ConfigLoadOptions {
  /** Config file path */
  path?: string;
  /** Working directory for resolving relative paths */
  cwd?: string;
  /** Environment variable placeholder pattern */
  envPattern?: RegExp;
  /** Strict mode (error on missing required fields) */
  strict?: boolean;
  /** Additional config files to merge */
  extends?: string[];
}

/**
 * Loaded configuration metadata
 */
export interface ConfigMetadata {
  /** Source file path */
  source: string;
  /** Format */
  format: ConfigFormat;
  /** Whether this is a merged config */
  merged: boolean;
  /** Extended configs */
  extended: string[];
}

/**
 * Configuration loader result
 */
export interface ConfigLoadResult<T = any> {
  /** Parsed configuration */
  config: T;
  /** Metadata about the loaded config */
  metadata: ConfigMetadata;
}

/**
 * Configuration Loader
 *
 * Supports:
 * - YAML and JSON formats
 * - Environment variable substitution (${VAR} or ${VAR:default})
 * - Config extension (extends field)
 * - Multiple config merging
 */
export class ConfigLoader {
  private options: ConfigLoadOptions;
  private envManager = getEnvManager();

  constructor(options: ConfigLoadOptions = {}) {
    this.options = {
      envPattern: /\$\{([^}:]+)(?::([^}]*))?\}/g,
      strict: false,
      extends: [],
      ...options,
    };
  }

  /**
   * Load configuration from file
   */
  load<T = any>(path?: string): ConfigLoadResult<T> {
    const configPath = path || this.resolveConfigPath();

    if (!configPath || !existsSync(configPath)) {
      if (this.options.strict) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }
      return {
        config: {} as T,
        metadata: {
          source: '',
          format: 'yaml',
          merged: false,
          extended: [],
        },
      };
    }

    const format = this.detectFormat(configPath);
    const content = readFileSync(configPath, 'utf-8');

    let config: any;

    switch (format) {
      case 'json':
        config = JSON.parse(content);
        break;
      case 'yaml':
        // Use YAML parser if available, otherwise basic parse
        config = this.parseYaml(content);
        break;
      case 'midscene':
        config = this.parseMidsceneConfig(content);
        break;
    }

    // Handle extends
    const extended: string[] = [];
    if (config.extends) {
      const extendsList = Array.isArray(config.extends) ? config.extends : [config.extends];
      for (const extPath of extendsList) {
        const baseConfig = this.loadExtendsConfig(extPath, configPath);
        config = this.mergeConfigs(baseConfig, config);
        extended.push(extPath);
      }
      delete config.extends;
    }

    // Substitute environment variables
    config = this.substituteEnvVars(config);

    // Also load any additional configs from options
    for (const extPath of this.options.extends || []) {
      const extConfig = this.loadExtendsConfig(extPath, configPath);
      config = this.mergeConfigs(config, extConfig);
      extended.push(extPath);
    }

    return {
      config,
      metadata: {
        source: configPath,
        format,
        merged: extended.length > 0,
        extended,
      },
    };
  }

  /**
   * Resolve configuration file path
   */
  private resolveConfigPath(): string | null {
    const cwd = this.options.cwd || process.cwd();
    const candidates = [
      this.options.path,
      'midscene.config.ts',
      'midscene.config.js',
      'midscene.config.yaml',
      'midscene.config.yml',
      'midscene.config.json',
      '.midscenerc',
      '.midscenerc.yaml',
      '.midscenerc.yml',
      '.midscenerc.json',
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const resolved = resolve(cwd, candidate);
      if (existsSync(resolved)) {
        return resolved;
      }
    }

    return null;
  }

  /**
   * Detect file format from extension
   */
  private detectFormat(path: string): ConfigFormat {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      default:
        return 'midscene';
    }
  }

  /**
   * Parse YAML (basic implementation)
   */
  private parseYaml(content: string): any {
    // Try to use yaml parser if available
    try {
      // @ts-ignore - optional dependency
      const yaml = require('yaml');
      if (yaml && typeof yaml.parse === 'function') {
        return yaml.parse(content);
      }
    } catch {
      // Fall through to basic parsing
    }
    // Fallback to basic parsing
    return this.parseBasicYaml(content);
  }

  /**
   * Basic YAML parser for simple configs
   */
  private parseBasicYaml(content: string): any {
    const result: any = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim();
        let value: any = trimmed.slice(colonIndex + 1).trim();

        // Handle basic types
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value === 'null' || value === '~') value = null;
        else if (value === '[]') value = [];
        else if (value === '{}') value = {};
        else if (value.startsWith('"') || value.startsWith("'")) {
          value = value.slice(1, -1);
        } else if (!isNaN(Number(value))) {
          value = Number(value);
        } else if (value.startsWith('[')) {
          try {
            value = JSON.parse(value.replace(/'/g, '"'));
          } catch {
            value = [];
          }
        }

        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Parse Midscene-specific config format
   */
  private parseMidsceneConfig(content: string): any {
    // Midscene config can be YAML or export from JS/TS
    // For now, try YAML
    return this.parseYaml(content);
  }

  /**
   * Load extended config file
   */
  private loadExtendsConfig(extPath: string, currentPath: string): any {
    const resolvedPath = resolve(currentPath, '..', extPath);

    if (!existsSync(resolvedPath)) {
      if (this.options.strict) {
        throw new Error(`Extended config not found: ${resolvedPath}`);
      }
      return {};
    }

    const loader = new ConfigLoader({ ...this.options, path: resolvedPath });
    const result = loader.load();
    return result.config;
  }

  /**
   * Merge configurations (later values override earlier)
   */
  private mergeConfigs(base: any, override: any): any {
    if (Array.isArray(base) && Array.isArray(override)) {
      return [...base, ...override];
    }

    if (typeof base === 'object' && typeof override === 'object') {
      const result = { ...base };

      for (const key of Object.keys(override)) {
        if (key in result && typeof result[key] === 'object' && typeof override[key] === 'object') {
          result[key] = this.mergeConfigs(result[key], override[key]);
        } else {
          result[key] = override[key];
        }
      }

      return result;
    }

    return override;
  }

  /**
   * Substitute environment variables in config values
   */
  private substituteEnvVars(config: any): any {
    if (typeof config === 'string') {
      return config.replace(this.options.envPattern!, (match, name, defaultValue) => {
        const value = this.envManager.get(name, defaultValue || '');
        if (!value && !defaultValue && this.options.strict) {
          throw new Error(`Missing required environment variable: ${name}`);
        }
        return value;
      });
    }

    if (Array.isArray(config)) {
      return config.map((item) => this.substituteEnvVars(item));
    }

    if (typeof config === 'object' && config !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(config)) {
        result[key] = this.substituteEnvVars(value);
      }
      return result;
    }

    return config;
  }

  /**
   * Validate configuration against schema
   */
  validate<T>(config: any, schema: ConfigSchema<T>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, rule] of Object.entries(schema)) {
      const value = config[key];

      if (rule.required && (value === undefined || value === null)) {
        errors.push(`Missing required field: ${key}`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`Field '${key}' must be of type ${rule.type}`);
        }

        if (rule.validate && !rule.validate(value)) {
          errors.push(`Field '${key}' failed validation`);
        }

        if (rule.allowed && !rule.allowed.includes(value)) {
          errors.push(`Field '${key}' must be one of: ${rule.allowed.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Configuration schema definition
 */
export interface ConfigSchema<T = any> {
  [key: string]: {
    type?: string;
    required?: boolean;
    default?: any;
    allowed?: any[];
    validate?: (value: any) => boolean;
  };
}

/**
 * Load configuration with options
 */
export function loadConfig<T = any>(options?: ConfigLoadOptions): ConfigLoadResult<T> {
  const loader = new ConfigLoader(options);
  return loader.load<T>();
}

/**
 * Load and validate configuration
 */
export function loadConfigWithValidation<T = any>(
  options: ConfigLoadOptions,
  schema: ConfigSchema<T>,
): { result: ConfigLoadResult<T> | null; errors: string[] } {
  const loader = new ConfigLoader(options);
  const result = loader.load<T>();
  const validation = loader.validate(result.config, schema);

  if (!validation.valid) {
    return { result: null, errors: validation.errors };
  }

  return { result, errors: [] };
}
