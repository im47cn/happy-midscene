/**
 * input: Individual algorithm modules
 * output: Unified algorithm exports
 * pos: Entry point for anomaly detection algorithms
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// Z-Score detection
export {
  calculateZScore,
  detectZScoreAnomaly,
  detectZScoreAnomalies,
  calculateModifiedZScore,
  calculateMAD,
  detectModifiedZScoreAnomaly,
  type ZScoreDetectionOptions,
  type ZScoreResult,
} from './zScore';

// IQR detection
export {
  calculateIQRStats,
  detectIQRAnomaly,
  detectIQRAnomalies,
  getAnomalyPercentage,
  type IQRDetectionOptions,
  type IQRStats,
  type IQRResult,
} from './iqr';

// Moving Average detection
export {
  calculateSMA,
  calculateEMA,
  calculateMovingStdDev,
  detectMovingAverageAnomaly,
  detectMovingAverageAnomalies,
  calculateBollingerBands,
  detectBollingerBandAnomalies,
  type MovingAverageOptions,
  type MovingAverageResult,
} from './movingAverage';

// Consecutive pattern detection
export {
  detectConsecutiveFailures,
  detectFlakyPattern,
  detectPassRateChange,
  getFailureTrend,
  type ExecutionResult,
  type ConsecutiveDetectionOptions,
  type ConsecutivePatternResult,
} from './consecutive';
