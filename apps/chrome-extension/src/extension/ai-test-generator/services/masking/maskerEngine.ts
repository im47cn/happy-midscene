/**
 * Masker Engine
 * Applies masking to detected sensitive data
 */

import type {
  DetectionRule,
  IMaskerEngine,
  MaskingConfig,
  MaskingMatch,
  MaskingMethod,
  MaskingOptions,
  MaskingScope,
  TextMaskingResult,
} from '../../types/masking';
import { DEFAULT_MASKING_CONFIG } from '../../types/masking';
import { type DetectorEngine, detectorEngine } from './detectorEngine';

/**
 * MaskerEngine implementation
 * Detects and masks sensitive data in text
 */
export class MaskerEngine implements IMaskerEngine {
  private config: MaskingConfig = { ...DEFAULT_MASKING_CONFIG };
  private detector: DetectorEngine;

  constructor(detector?: DetectorEngine) {
    this.detector = detector || detectorEngine;
  }

  /**
   * Mask sensitive data in text
   * @param text - The text to mask
   * @param scope - The masking scope
   * @returns Masking result with original, masked text, and match details
   */
  async maskText(
    text: string,
    scope: keyof MaskingScope,
  ): Promise<TextMaskingResult> {
    const startTime = Date.now();

    if (!this.config.enabled || !text) {
      return {
        original: text,
        masked: text,
        matches: [],
        processingTime: Date.now() - startTime,
      };
    }

    // Check if masking is enabled for this scope
    const scopeConfig: Record<keyof MaskingScope, boolean> = {
      text: this.config.textMasking,
      screenshot: this.config.screenshotMasking !== 'off',
      log: this.config.logMasking,
      yaml: this.config.yamlMasking,
    };

    if (!scopeConfig[scope]) {
      return {
        original: text,
        masked: text,
        matches: [],
        processingTime: Date.now() - startTime,
      };
    }

    // Detect sensitive data
    const detections = await this.detector.detect(text, scope);

    if (detections.length === 0) {
      return {
        original: text,
        masked: text,
        matches: [],
        processingTime: Date.now() - startTime,
      };
    }

    // Apply masking from end to start to preserve positions
    let result = text;
    const matches: MaskingMatch[] = [];

    // Sort detections by position (descending) to replace from end
    const sortedDetections = [...detections].sort(
      (a, b) => b.position.start - a.position.start,
    );

    for (const detection of sortedDetections) {
      const rule = this.detector.getRule(detection.ruleId);
      if (!rule) continue;

      const maskedValue = this.applyMasking(detection.value, rule);

      result =
        result.substring(0, detection.position.start) +
        maskedValue +
        result.substring(detection.position.end);

      matches.unshift({
        ruleId: detection.ruleId,
        ruleName: detection.ruleName,
        category: detection.category,
        position: detection.position,
        originalValue: detection.value,
        maskedValue,
      });
    }

    return {
      original: text,
      masked: result,
      matches,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): MaskingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<MaskingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Apply masking to a value based on rule configuration
   */
  private applyMasking(value: string, rule: DetectionRule): string {
    const { method, options = {} } = rule.masking;
    return applyMaskingMethod(value, method, options);
  }
}

/**
 * Apply a masking method to a value
 */
export function applyMaskingMethod(
  value: string,
  method: MaskingMethod,
  options: MaskingOptions = {},
): string {
  switch (method) {
    case 'full':
      return fullMask(value, options.maskChar);

    case 'partial':
      return partialMask(
        value,
        options.keepStart,
        options.keepEnd,
        options.maskChar,
      );

    case 'hash':
      return hashMask(value, options.hashLength);

    case 'placeholder':
      return options.placeholder || '[SENSITIVE]';

    case 'blur':
      // Blur is only for images, return placeholder for text
      return '[BLUR]';

    default:
      return partialMask(value);
  }
}

/**
 * Full masking - replace all characters
 */
function fullMask(value: string, maskChar = '*'): string {
  return maskChar.repeat(Math.min(value.length, 16));
}

/**
 * Partial masking - keep some characters visible
 */
function partialMask(
  value: string,
  keepStart = 3,
  keepEnd = 4,
  maskChar = '*',
): string {
  if (value.length <= keepStart + keepEnd) {
    return maskChar.repeat(value.length);
  }

  const maskLength = Math.min(value.length - keepStart - keepEnd, 10);
  return (
    value.substring(0, keepStart) +
    maskChar.repeat(maskLength) +
    value.substring(value.length - keepEnd)
  );
}

/**
 * Hash-based masking - consistent output for same input
 */
function hashMask(value: string, length = 6): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  // Determine category prefix based on content
  let prefix = 'MASKED';
  if (value.includes('@')) {
    prefix = 'EMAIL';
  }

  return `[${prefix}:${Math.abs(hash).toString(36).substring(0, length).padStart(length, '0')}]`;
}

/**
 * Default masker engine instance
 */
export const maskerEngine = new MaskerEngine();
