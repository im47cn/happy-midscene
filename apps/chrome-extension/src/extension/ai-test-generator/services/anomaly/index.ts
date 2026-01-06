/**
 * input: All anomaly detection modules
 * output: Unified anomaly detection API
 * pos: Main entry point for anomaly detection system
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// Types re-export
export type {
  AnomalyType,
  Severity,
  AnomalyStatus,
  MetricInfo,
  BaselineInfo,
  DeviationInfo,
  ImpactInfo,
  Anomaly,
  BaselineMethod,
  SeasonalPattern,
  SeasonalityConfig,
  BaselineConfig,
  RootCauseCategory,
  Evidence,
  Suggestion,
  RootCause,
  TrendDirection,
  PredictionPoint,
  TrendFactor,
  TrendPrediction,
  HealthFactor,
  HealthDimension,
  HealthScore,
  PatternType,
  LearnedPattern,
  DetectOptions,
  AnomalyPoint,
  AlertLevel,
  AnomalyAlert,
  AnomalyRecord,
  BaselineRecord,
  PatternRecord,
} from '../../types/anomaly';

export {
  DEFAULT_THRESHOLDS,
  SEVERITY_WEIGHTS,
  DEFAULT_BASELINE_CONFIG,
} from '../../types/anomaly';

// Storage
export {
  anomalyStorage,
  type IAnomalyStorage,
  type IBaselineStorage,
  type IPatternStorage,
  type IHealthScoreStorage,
} from './storage';

// Baseline building (Phase 2)
export {
  baselineBuilder,
  type BuildBaselineOptions,
  type UpdateBaselineOptions,
} from './baselineBuilder';
export {
  seasonalityAnalyzer,
  type SeasonalAnalysisResult,
  type CycleInfo,
} from './seasonalityAnalyzer';
export {
  dataPreprocessor,
  type DataPoint,
  type PreprocessConfig,
  type PreprocessResult,
  DEFAULT_PREPROCESS_CONFIG,
  calculateStats,
  calculateZScore,
} from './dataPreprocessor';

// Anomaly detection (Phase 3)
export {
  anomalyDetector,
  type DetectionOptions,
  type BatchDetectionOptions,
  type DetectionResult,
  type CaseDetectionResult,
} from './anomalyDetector';

export {
  severityEvaluator,
  type SeverityInput,
  type SeverityResult,
  type SeverityFactor,
  type ImpactAssessment,
} from './severityEvaluator';

// Detection algorithms
export {
  // Z-Score
  calculateZScore as algorithmZScore,
  detectZScoreAnomaly,
  detectZScoreAnomalies,
  calculateModifiedZScore,
  calculateMAD,
  detectModifiedZScoreAnomaly,
  type ZScoreDetectionOptions,
  type ZScoreResult,
  // IQR
  calculateIQRStats,
  detectIQRAnomaly,
  detectIQRAnomalies,
  getAnomalyPercentage,
  type IQRDetectionOptions,
  type IQRStats,
  type IQRResult,
  // Moving Average
  calculateSMA,
  calculateEMA,
  calculateMovingStdDev,
  detectMovingAverageAnomaly,
  detectMovingAverageAnomalies,
  calculateBollingerBands,
  detectBollingerBandAnomalies,
  type MovingAverageOptions,
  type MovingAverageResult,
  // Consecutive patterns
  detectConsecutiveFailures,
  detectFlakyPattern,
  detectPassRateChange,
  getFailureTrend,
  type ExecutionResult,
  type ConsecutiveDetectionOptions,
  type ConsecutivePatternResult,
} from './algorithms';

// Root cause analysis (Phase 4)
export {
  rootCauseAnalyzer,
  type AnalysisOptions,
  type AnalysisResult,
  type FailureAnalysisResult,
  type Recommendation,
  type BatchAnalysisResult,
  type CommonCause,
} from './rootCauseAnalyzer';

export {
  evidenceCollector,
  type ExecutionContext,
  type LogEntry,
  type Screenshot,
  type NetworkRequest,
  type EnvironmentInfo,
  type CollectedEvidence,
  type TimelineEvent,
  type ChangeInfo,
} from './evidenceCollector';

export {
  causeMatcher,
  type MatchRule,
  type MatchCondition,
  type SuggestionTemplate,
  type HistoricalPattern,
} from './causeMatcher';

// Trend prediction (Phase 5)
export {
  trendPredictor,
  type DataPoint as TrendDataPoint,
  type PredictOptions,
  type CasePrediction,
  type OverallTrend,
  type ModelComparison,
} from './trendPredictor';

export {
  calculateZConfidenceInterval,
  calculateTConfidenceInterval,
  calculatePredictionInterval,
  calculateStandardError,
  calculateUncertaintyMetrics,
  bootstrapConfidenceInterval,
  assessIntervalQuality,
  calculateIntervalOverlap,
  combineIntervals,
  type ConfidenceInterval,
  type UncertaintyMetrics,
  type BootstrapResult,
} from './confidenceInterval';

// Prediction models
export {
  // Linear Regression
  fitLinearRegression,
  predictLinear,
  linearRegressionPredict,
  calculateLinearConfidence,
  detectTrendFromSlope,
  type LinearRegressionModel,
  type LinearPrediction,
  type RegressionResult,
  // Exponential Smoothing
  fitHoltModel,
  predictHolt,
  exponentialSmoothingPredict,
  calculateSmoothingConfidence,
  detectTrendFromHolt,
  type HoltModel,
  type SmoothingPrediction,
  type SmoothingResult,
  type SmoothingOptions,
  // ARIMA
  fitArimaModel,
  predictArima,
  arimaPredict,
  calculateArimaConfidence,
  type ArimaModel,
  type ArimaPrediction,
  type ArimaResult,
  type ArimaOptions,
} from './models';

// Pattern learning (Phase 6)
export {
  patternLearner,
  type DataPoint as PatternDataPoint,
  type PatternFeatures,
  type PatternMatch,
  type LearnOptions,
  type RecognitionResult,
} from './patternLearner';

// Health scoring (Phase 7)
export {
  healthScorer,
  type MetricData,
  type CalculateOptions,
  type ScoreTrend,
  type ScoreComparison,
  type DimensionTrend,
  type ScoreTrendAnalysis,
} from './healthScorer';

// Alert integration (Phase 8)
export {
  alertTrigger,
  getAlertTrigger,
  getAlertTemplate,
  getAllAlertTemplates,
  type AlertConfig,
  type AlertTemplate,
  type AlertNotification,
  type AlertStats,
  type ConvergenceGroup,
} from './alertTrigger';
