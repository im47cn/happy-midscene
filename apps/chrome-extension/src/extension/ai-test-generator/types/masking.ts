/**
 * Data Masking Types
 * Type definitions for sensitive data detection and masking
 */

/**
 * Sensitive data categories
 */
export type SensitiveCategory =
  | 'credential' // Credentials: password, API key, token
  | 'pii' // Personal Identifiable Information
  | 'financial' // Financial data
  | 'health' // Health information
  | 'custom'; // User-defined

/**
 * Masking methods
 */
export type MaskingMethod =
  | 'full' // Full mask: ********
  | 'partial' // Partial mask: 138****5678
  | 'hash' // Hash: [MASKED:a1b2c3]
  | 'placeholder' // Placeholder: [PASSWORD]
  | 'blur'; // Blur (for images only)

/**
 * Detection types
 */
export type DetectionType = 'regex' | 'keyword' | 'pattern';

/**
 * Masking scope configuration
 */
export interface MaskingScope {
  text: boolean; // Text content masking
  screenshot: boolean; // Screenshot masking
  log: boolean; // Log output masking
  yaml: boolean; // YAML script masking
}

/**
 * Context matching configuration
 */
export interface ContextMatch {
  before?: string; // Pattern to match before the sensitive data
  after?: string; // Pattern to match after the sensitive data
}

/**
 * Masking options for different methods
 */
export interface MaskingOptions {
  // For partial masking
  keepStart?: number; // Characters to keep at start
  keepEnd?: number; // Characters to keep at end
  maskChar?: string; // Character to use for masking (default: *)

  // For hash masking
  hashLength?: number; // Length of hash output

  // For placeholder masking
  placeholder?: string; // Custom placeholder text

  // For blur masking (images)
  blurRadius?: number; // Blur radius in pixels
}

/**
 * Detection rule for sensitive data
 */
export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Higher priority rules are applied first (0-100)

  // Detection configuration
  detection: {
    type: DetectionType;
    pattern: string; // Regex pattern or keywords
    flags?: string; // Regex flags (e.g., 'gi')
    context?: ContextMatch;
  };

  // Masking configuration
  masking: {
    method: MaskingMethod;
    options?: MaskingOptions;
  };

  // Scope configuration
  scope: MaskingScope;

  // Metadata
  category: SensitiveCategory;
  builtIn: boolean; // Whether this is a built-in rule
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Detection result
 */
export interface DetectionResult {
  ruleId: string;
  ruleName: string;
  category: SensitiveCategory;
  position: {
    start: number;
    end: number;
  };
  value: string;
}

/**
 * Masking match details
 */
export interface MaskingMatch {
  ruleId: string;
  ruleName: string;
  category: SensitiveCategory;
  position: {
    start: number;
    end: number;
  };
  originalValue: string;
  maskedValue: string;
}

/**
 * Text masking result
 */
export interface TextMaskingResult {
  original: string;
  masked: string;
  matches: MaskingMatch[];
  processingTime: number;
}

/**
 * Image mask region
 */
export interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'blur' | 'fill';
  category?: SensitiveCategory;
}

/**
 * Image masking result
 */
export interface ImageMaskingResult {
  originalSize: { width: number; height: number };
  regions: MaskRegion[];
  processingTime: number;
}

/**
 * Screenshot masking level
 */
export type ScreenshotMaskingLevel = 'off' | 'standard' | 'strict';

/**
 * Masking configuration
 */
export interface MaskingConfig {
  enabled: boolean;
  screenshotMasking: ScreenshotMaskingLevel;
  logMasking: boolean;
  yamlMasking: boolean;
  textMasking: boolean;
}

/**
 * Default masking configuration
 */
export const DEFAULT_MASKING_CONFIG: MaskingConfig = {
  enabled: true,
  screenshotMasking: 'standard',
  logMasking: true,
  yamlMasking: true,
  textMasking: true,
};

/**
 * Masking audit log entry
 */
export interface MaskingAuditEntry {
  id: string;
  timestamp: number;
  type: 'text' | 'screenshot' | 'log' | 'yaml';
  ruleId: string;
  category: SensitiveCategory;
  source: string;
  matchCount: number;
}

/**
 * Interface for detector engine
 */
export interface IDetectorEngine {
  detect(text: string, scope?: keyof MaskingScope): Promise<DetectionResult[]>;
  addRule(rule: DetectionRule): void;
  removeRule(ruleId: string): void;
  enableRule(ruleId: string): void;
  disableRule(ruleId: string): void;
  getRules(): DetectionRule[];
}

/**
 * Interface for masker engine
 */
export interface IMaskerEngine {
  maskText(text: string, scope: keyof MaskingScope): Promise<TextMaskingResult>;
  getConfig(): MaskingConfig;
  setConfig(config: Partial<MaskingConfig>): void;
}

/**
 * Interface for image masker
 */
export interface IImageMasker {
  maskScreenshot(
    imageData: ImageData | string,
    level: ScreenshotMaskingLevel,
    sensitiveRegions?: MaskRegion[],
  ): Promise<{ imageData: ImageData; result: ImageMaskingResult }>;
}

/**
 * Interface for log masker
 */
export interface ILogMasker {
  mask(message: string, data?: unknown): { message: string; data?: unknown };
  wrapConsole(): void;
  unwrapConsole(): void;
}
