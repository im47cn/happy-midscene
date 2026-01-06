/**
 * input: None (standalone type definitions)
 * output: Anomaly detection type definitions for the entire module
 * pos: Foundation layer for anomaly detection system
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// ============================================================================
// Core Anomaly Types
// ============================================================================

/**
 * Anomaly type enumeration
 */
export type AnomalyType =
  | 'duration_spike' // Execution time spike
  | 'failure_spike' // Failure rate spike
  | 'flaky_pattern' // Flaky test detected
  | 'performance_degradation' // Performance degradation
  | 'success_rate_drop' // Success rate drop
  | 'pass_rate_drop' // Pass rate drop (similar to success rate but different metric)
  | 'resource_anomaly' // Resource consumption anomaly
  | 'trend_change' // Trend change
  | 'seasonal_deviation' // Seasonal deviation
  | 'consecutive_failures' // Consecutive test failures
  | 'flaky_detected'; // Flaky test behavior detected

/**
 * Severity level
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Anomaly status
 */
export type AnomalyStatus =
  | 'new'
  | 'acknowledged'
  | 'investigating'
  | 'resolved';

/**
 * Metric information
 */
export interface MetricInfo {
  name: string;
  currentValue: number;
  unit: string;
  timestamp: number;
}

/**
 * Baseline information
 */
export interface BaselineInfo {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  period: string;
  sampleCount: number;
  lastUpdated: number;
}

/**
 * Deviation information
 */
export interface DeviationInfo {
  absoluteDeviation: number;
  percentageDeviation: number;
  zScore: number;
}

/**
 * Impact information
 */
export interface ImpactInfo {
  affectedCases: string[];
  affectedFeatures: string[];
  estimatedScope: 'low' | 'medium' | 'high';
}

/**
 * Anomaly definition (simplified for detector usage)
 */
export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: Severity;
  status: AnomalyStatus;
  detectedAt: number;
  metric: string; // Metric name
  currentValue: number;
  expectedValue: number;
  deviation: number;
  caseId?: string;
  caseName?: string;
  description: string;
  resolvedAt?: number;
}

/**
 * Extended anomaly with full analysis (for detailed views)
 */
export interface AnomalyWithAnalysis extends Anomaly {
  baseline?: BaselineInfo;
  deviationInfo?: DeviationInfo;
  impact?: ImpactInfo;
  rootCauses?: RootCause[];
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolution?: string;
}

// ============================================================================
// Baseline Types
// ============================================================================

/**
 * Baseline calculation method
 */
export type BaselineMethod =
  | 'moving_average'
  | 'exponential_smoothing'
  | 'percentile'
  | 'median';

/**
 * Seasonal pattern type
 */
export interface SeasonalPattern {
  type: 'daily' | 'weekly' | 'monthly';
  adjustments: Record<string, number>;
}

/**
 * Seasonality configuration
 */
export interface SeasonalityConfig {
  enabled: boolean;
  patterns: SeasonalPattern[];
}

/**
 * Baseline configuration
 */
export interface BaselineConfig {
  metricName: string;
  calculationMethod: BaselineMethod;
  windowSize: number; // Window size in days
  excludeAnomalies: boolean;
  seasonality: SeasonalityConfig;
}

// ============================================================================
// Root Cause Types
// ============================================================================

/**
 * Root cause category
 */
export type RootCauseCategory =
  | 'locator_change' // Element locator change
  | 'timing_issue' // Timing issue
  | 'environment_change' // Environment change
  | 'code_change' // Code change
  | 'data_issue' // Data issue
  | 'network_issue' // Network issue
  | 'resource_constraint'; // Resource constraint

/**
 * Evidence for root cause analysis
 */
export interface Evidence {
  type: string;
  description: string;
  data: Record<string, unknown>;
  weight: number;
}

/**
 * Suggestion for fixing the issue
 */
export interface Suggestion {
  action: string;
  priority: number;
  effort: 'low' | 'medium' | 'high';
}

/**
 * Root cause definition
 */
export interface RootCause {
  id: string;
  category: RootCauseCategory;
  description: string;
  confidence: number; // 0-100
  evidence: Evidence[];
  suggestions: Suggestion[];
}

// ============================================================================
// Trend Prediction Types
// ============================================================================

/**
 * Trend direction
 */
export type TrendDirection = 'improving' | 'stable' | 'declining';

/**
 * Prediction point
 */
export interface PredictionPoint {
  timestamp: number;
  value: number;
  lowerBound: number;
  upperBound: number;
}

/**
 * Trend factor
 */
export interface TrendFactor {
  name: string;
  impact: number; // Positive value = positive impact
  description: string;
}

/**
 * Trend prediction result
 */
export interface TrendPrediction {
  metricName: string;
  currentValue: number;
  predictions: PredictionPoint[];
  trend: TrendDirection;
  confidence: number;
  factors: TrendFactor[];
}

// ============================================================================
// Health Score Types
// ============================================================================

/**
 * Health factor
 */
export interface HealthFactor {
  name: string;
  value: number;
  impact: 'positive' | 'neutral' | 'negative';
}

/**
 * Health dimension
 */
export interface HealthDimension {
  name: string;
  score: number;
  weight: number;
  factors: HealthFactor[];
}

/**
 * Health score
 */
export interface HealthScore {
  overall: number; // 0-100
  dimensions: HealthDimension[];
  trend: TrendDirection;
  comparedTo: {
    lastWeek: number;
    lastMonth: number;
  };
  recommendations: string[];
  calculatedAt: number;
}

// ============================================================================
// Pattern Learning Types
// ============================================================================

/**
 * Pattern type
 */
export type PatternType = 'periodic' | 'sudden' | 'gradual' | 'seasonal';

/**
 * Learned pattern
 */
export interface LearnedPattern {
  id: string;
  type: PatternType;
  description: string;
  confidence: number;
  occurrences: number;
  lastSeen: number;
  features: Record<string, unknown>;
}

// ============================================================================
// Detection Options
// ============================================================================

/**
 * Detection options
 */
export interface DetectOptions {
  scope?: 'all' | 'recent' | 'specific';
  caseIds?: string[];
  types?: AnomalyType[];
  minSeverity?: Severity;
  timeRange?: {
    start: number;
    end: number;
  };
}

/**
 * Detection thresholds type
 */
export interface DetectionThresholds {
  zScoreThreshold: number;
  passRateDropThreshold: number;
  durationSpikeThreshold: number;
  consecutiveFailureThreshold: number;
  flakyThreshold: number;
}

/**
 * Detection configuration
 */
export interface DetectionConfig {
  enabled: boolean;
  algorithms: string[];
  sensitivity: 'low' | 'medium' | 'high';
  thresholds: DetectionThresholds;
  minDataPoints: number;
  detectionWindow: number; // days
}

/**
 * Anomaly point (for internal use)
 */
export interface AnomalyPoint {
  index: number;
  value: number;
  deviation: number;
  timestamp?: number;
}

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Alert level
 */
export type AlertLevel = 'info' | 'warning' | 'critical' | 'emergency';

/**
 * Alert definition
 */
export interface AnomalyAlert {
  id: string;
  anomalyId: string;
  level: AlertLevel;
  title: string;
  message: string;
  createdAt: number;
  acknowledged: boolean;
  acknowledgedAt?: number;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Anomaly record for storage
 */
export interface AnomalyRecord extends Anomaly {
  _createdAt: number;
  _updatedAt: number;
}

/**
 * Baseline record for storage
 */
export interface BaselineRecord {
  metricName: string;
  baseline: BaselineInfo;
  config: BaselineConfig;
  _createdAt: number;
  _updatedAt: number;
}

/**
 * Pattern record for storage
 */
export interface PatternRecord {
  id: string;
  pattern: LearnedPattern;
  _createdAt: number;
  _updatedAt: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default detection thresholds
 */
export const DEFAULT_THRESHOLDS = {
  zScoreThreshold: 3,
  passRateDropThreshold: 0.2, // 20% drop
  durationSpikeThreshold: 2, // 2x baseline
  consecutiveFailureThreshold: 3,
  flakyThreshold: 0.3, // 30% flaky rate
} as const;

/**
 * Severity weights for prioritization
 */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Severity factor weights for multi-factor severity calculation
 * Used by SeverityEvaluator to weight different factors
 */
export const SEVERITY_FACTOR_WEIGHTS = {
  deviation: 0.35, // How far from baseline
  duration: 0.2, // How long anomaly persisted
  frequency: 0.15, // How often it occurs
  impact: 0.3, // How many cases affected
} as const;

/**
 * Deviation thresholds for severity levels (in standard deviations)
 */
export const SEVERITY_DEVIATION_THRESHOLDS = {
  critical: 4, // >= 4 sigma
  high: 3, // >= 3 sigma
  medium: 2, // >= 2 sigma
} as const;

/**
 * Default baseline configuration
 */
export const DEFAULT_BASELINE_CONFIG: BaselineConfig = {
  metricName: '',
  calculationMethod: 'moving_average',
  windowSize: 30, // 30 days
  excludeAnomalies: true,
  seasonality: {
    enabled: false,
    patterns: [],
  },
};
