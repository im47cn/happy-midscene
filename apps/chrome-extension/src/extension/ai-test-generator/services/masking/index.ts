/**
 * Data Masking Module
 * Provides sensitive data detection and masking capabilities
 */

// Types
export type {
  SensitiveCategory,
  MaskingMethod,
  DetectionType,
  MaskingScope,
  ContextMatch,
  MaskingOptions,
  DetectionRule,
  DetectionResult,
  MaskingMatch,
  TextMaskingResult,
  MaskRegion,
  ImageMaskingResult,
  ScreenshotMaskingLevel,
  MaskingConfig,
  MaskingAuditEntry,
  IDetectorEngine,
  IMaskerEngine,
  IImageMasker,
  ILogMasker,
} from '../../types/masking';

export { DEFAULT_MASKING_CONFIG } from '../../types/masking';

// Built-in rules
export {
  BUILT_IN_RULES,
  getRulesByCategory,
  getEnabledRules,
  getRulesSortedByPriority,
} from './builtInRules';

// Detector engine
export { DetectorEngine, detectorEngine } from './detectorEngine';

// Masker engine
export {
  MaskerEngine,
  maskerEngine,
  applyMaskingMethod,
} from './maskerEngine';

// Log masker
export { LogMasker, logMasker } from './logMasker';

// Image masker
export {
  ImageMasker,
  imageMasker,
  createMaskRegionsFromElements,
} from './imageMasker';

// Whitelist manager
export {
  WhitelistManager,
  whitelistManager,
  type WhitelistEntry,
  type WhitelistType,
  type WhitelistConfig,
} from './whitelistManager';

// OCR engine
export {
  OCREngine,
  ocrEngine,
  type OCRWord,
  type OCRLine,
  type OCRResult,
  type OCRConfig,
  type SensitiveTextMatch,
} from './ocrEngine';

// Region detector
export {
  RegionDetector,
  regionDetector,
  detectScreenshotMaskRegions,
  type ElementInfo,
  type SensitiveElementType,
  type DetectionSelector,
  type RegionDetectorConfig,
} from './regionDetector';

// Audit logger
export {
  auditLogger,
  type AuditStats,
} from './auditLogger';

// YAML checker
export {
  yamlChecker,
  type WarningSeverity,
  type YamlWarning,
  type YamlReplacementSuggestion,
  type YamlCheckResult,
} from './yamlChecker';

/**
 * Quick mask function for convenience
 * @param text - Text to mask
 * @returns Masked text
 */
export async function maskText(text: string): Promise<string> {
  const { maskerEngine } = await import('./maskerEngine');
  const result = await maskerEngine.maskText(text, 'text');
  return result.masked;
}

/**
 * Quick mask function for logs (synchronous)
 * @param message - Log message to mask
 * @returns Masked message
 */
export function maskLog(message: string): string {
  const { logMasker } = require('./logMasker');
  return logMasker.mask(message).message;
}
