/**
 * input: Prediction values and statistical parameters
 * output: Confidence intervals and uncertainty metrics
 * pos: Statistical confidence interval calculations for predictions
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// ============================================================================
// Types
// ============================================================================

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number; // Confidence level (e.g., 0.95 for 95%)
  width: number; // Interval width
}

export interface UncertaintyMetrics {
  pointEstimate: number;
  standardError: number;
  coefficientOfVariation: number;
  confidence: ConfidenceInterval;
  predictionInterval: ConfidenceInterval;
}

export interface BootstrapResult {
  mean: number;
  standardError: number;
  percentiles: Map<number, number>;
  confidence: ConfidenceInterval;
}

// ============================================================================
// Constants
// ============================================================================

// Z-scores for common confidence levels
const Z_SCORES: Record<number, number> = {
  0.8: 1.282,
  0.85: 1.44,
  0.9: 1.645,
  0.95: 1.96,
  0.99: 2.576,
};

// T-scores for small samples (df = n-1)
const T_SCORES: Record<number, Record<number, number>> = {
  // df: { confidence_level: t_score }
  2: { 0.9: 2.92, 0.95: 4.303, 0.99: 9.925 },
  3: { 0.9: 2.353, 0.95: 3.182, 0.99: 5.841 },
  4: { 0.9: 2.132, 0.95: 2.776, 0.99: 4.604 },
  5: { 0.9: 2.015, 0.95: 2.571, 0.99: 4.032 },
  10: { 0.9: 1.812, 0.95: 2.228, 0.99: 3.169 },
  20: { 0.9: 1.725, 0.95: 2.086, 0.99: 2.845 },
  30: { 0.9: 1.697, 0.95: 2.042, 0.99: 2.75 },
};

// ============================================================================
// Confidence Interval Functions
// ============================================================================

/**
 * Calculate confidence interval using normal distribution (z-score)
 */
export function calculateZConfidenceInterval(
  mean: number,
  standardError: number,
  level = 0.95,
): ConfidenceInterval {
  const z = Z_SCORES[level] ?? 1.96; // Default to 95%
  const margin = z * standardError;

  return {
    lower: mean - margin,
    upper: mean + margin,
    level,
    width: 2 * margin,
  };
}

/**
 * Calculate confidence interval using t-distribution (for small samples)
 */
export function calculateTConfidenceInterval(
  mean: number,
  standardError: number,
  sampleSize: number,
  level = 0.95,
): ConfidenceInterval {
  const df = sampleSize - 1;

  // Get t-score (use closest df or fall back to z-score for large samples)
  let tScore: number;
  if (df >= 30) {
    tScore = Z_SCORES[level] ?? 1.96;
  } else {
    const dfKey = Object.keys(T_SCORES)
      .map(Number)
      .filter((k) => k <= df)
      .sort((a, b) => b - a)[0];
    tScore = T_SCORES[dfKey]?.[level] ?? Z_SCORES[level] ?? 1.96;
  }

  const margin = tScore * standardError;

  return {
    lower: mean - margin,
    upper: mean + margin,
    level,
    width: 2 * margin,
  };
}

/**
 * Calculate prediction interval (wider than confidence interval)
 * Used for individual future observations
 */
export function calculatePredictionInterval(
  mean: number,
  standardError: number,
  residualStdDev: number,
  level = 0.95,
): ConfidenceInterval {
  const z = Z_SCORES[level] ?? 1.96;

  // Prediction interval includes both model uncertainty and residual variance
  const predictionError = Math.sqrt(standardError ** 2 + residualStdDev ** 2);
  const margin = z * predictionError;

  return {
    lower: mean - margin,
    upper: mean + margin,
    level,
    width: 2 * margin,
  };
}

/**
 * Calculate standard error from sample
 */
export function calculateStandardError(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);

  return Math.sqrt(variance / n);
}

/**
 * Calculate comprehensive uncertainty metrics
 */
export function calculateUncertaintyMetrics(
  values: number[],
  level = 0.95,
): UncertaintyMetrics {
  if (values.length === 0) {
    return {
      pointEstimate: 0,
      standardError: 0,
      coefficientOfVariation: 0,
      confidence: { lower: 0, upper: 0, level, width: 0 },
      predictionInterval: { lower: 0, upper: 0, level, width: 0 },
    };
  }

  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    n > 1 ? values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const standardError = stdDev / Math.sqrt(n);
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : 0;

  const confidence = calculateTConfidenceInterval(
    mean,
    standardError,
    n,
    level,
  );
  const predictionInterval = calculatePredictionInterval(
    mean,
    standardError,
    stdDev,
    level,
  );

  return {
    pointEstimate: mean,
    standardError,
    coefficientOfVariation: cv,
    confidence,
    predictionInterval,
  };
}

// ============================================================================
// Bootstrap Methods
// ============================================================================

/**
 * Perform bootstrap resampling for confidence interval estimation
 */
export function bootstrapConfidenceInterval(
  values: number[],
  iterations = 1000,
  level = 0.95,
): BootstrapResult {
  if (values.length === 0) {
    return {
      mean: 0,
      standardError: 0,
      percentiles: new Map(),
      confidence: { lower: 0, upper: 0, level, width: 0 },
    };
  }

  const n = values.length;
  const bootstrapMeans: number[] = [];

  // Generate bootstrap samples
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(Math.random() * n);
      sum += values[idx];
    }
    bootstrapMeans.push(sum / n);
  }

  // Sort bootstrap means
  bootstrapMeans.sort((a, b) => a - b);

  // Calculate statistics
  const mean = bootstrapMeans.reduce((sum, v) => sum + v, 0) / iterations;
  const variance =
    bootstrapMeans.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    (iterations - 1);
  const standardError = Math.sqrt(variance);

  // Calculate percentiles
  const percentiles = new Map<number, number>();
  const percentilesNeeded = [2.5, 5, 10, 25, 50, 75, 90, 95, 97.5];

  for (const p of percentilesNeeded) {
    const idx = Math.floor((p / 100) * iterations);
    percentiles.set(p, bootstrapMeans[idx]);
  }

  // Confidence interval from percentiles
  const alpha = (1 - level) / 2;
  const lowerPercentile = alpha * 100;
  const upperPercentile = (1 - alpha) * 100;

  const lowerIdx = Math.floor((lowerPercentile * iterations) / 100);
  const upperIdx = Math.floor((upperPercentile * iterations) / 100);

  const confidence: ConfidenceInterval = {
    lower: bootstrapMeans[lowerIdx],
    upper: bootstrapMeans[upperIdx],
    level,
    width: bootstrapMeans[upperIdx] - bootstrapMeans[lowerIdx],
  };

  return {
    mean,
    standardError,
    percentiles,
    confidence,
  };
}

// ============================================================================
// Interval Quality Assessment
// ============================================================================

/**
 * Assess the quality/reliability of a confidence interval
 */
export function assessIntervalQuality(
  interval: ConfidenceInterval,
  sampleSize: number,
  dataRange: number,
): {
  reliability: 'high' | 'medium' | 'low';
  score: number;
  concerns: string[];
} {
  const concerns: string[] = [];
  let score = 100;

  // Check sample size
  if (sampleSize < 5) {
    score -= 40;
    concerns.push('Very small sample size (<5)');
  } else if (sampleSize < 10) {
    score -= 20;
    concerns.push('Small sample size (<10)');
  } else if (sampleSize < 30) {
    score -= 10;
    concerns.push('Moderate sample size (<30)');
  }

  // Check interval width relative to data range
  if (dataRange > 0) {
    const relativeWidth = interval.width / dataRange;
    if (relativeWidth > 0.5) {
      score -= 30;
      concerns.push('Very wide interval (>50% of data range)');
    } else if (relativeWidth > 0.3) {
      score -= 15;
      concerns.push('Wide interval (>30% of data range)');
    }
  }

  // Check confidence level
  if (interval.level < 0.9) {
    score -= 10;
    concerns.push(
      `Low confidence level (${(interval.level * 100).toFixed(0)}%)`,
    );
  }

  // Determine reliability
  let reliability: 'high' | 'medium' | 'low';
  if (score >= 80) {
    reliability = 'high';
  } else if (score >= 50) {
    reliability = 'medium';
  } else {
    reliability = 'low';
  }

  return {
    reliability,
    score: Math.max(0, score),
    concerns,
  };
}

/**
 * Calculate overlap between two confidence intervals
 */
export function calculateIntervalOverlap(
  interval1: ConfidenceInterval,
  interval2: ConfidenceInterval,
): {
  overlaps: boolean;
  overlapAmount: number;
  overlapPercentage: number;
} {
  const overlapLower = Math.max(interval1.lower, interval2.lower);
  const overlapUpper = Math.min(interval1.upper, interval2.upper);

  const overlaps = overlapLower < overlapUpper;
  const overlapAmount = overlaps ? overlapUpper - overlapLower : 0;

  // Calculate as percentage of smaller interval
  const smallerWidth = Math.min(interval1.width, interval2.width);
  const overlapPercentage =
    smallerWidth > 0 ? (overlapAmount / smallerWidth) * 100 : 0;

  return {
    overlaps,
    overlapAmount,
    overlapPercentage,
  };
}

/**
 * Combine multiple confidence intervals (for meta-analysis)
 */
export function combineIntervals(
  intervals: Array<{ mean: number; standardError: number; weight?: number }>,
): { mean: number; standardError: number; confidence: ConfidenceInterval } {
  if (intervals.length === 0) {
    return {
      mean: 0,
      standardError: 0,
      confidence: { lower: 0, upper: 0, level: 0.95, width: 0 },
    };
  }

  // Use inverse variance weighting if weights not provided
  const weightedData = intervals.map((i) => ({
    ...i,
    weight: i.weight ?? (i.standardError > 0 ? 1 / i.standardError ** 2 : 1),
  }));

  const totalWeight = weightedData.reduce((sum, d) => sum + d.weight, 0);

  // Weighted mean
  const mean =
    weightedData.reduce((sum, d) => sum + d.mean * d.weight, 0) / totalWeight;

  // Combined standard error
  const standardError = Math.sqrt(1 / totalWeight);

  const confidence = calculateZConfidenceInterval(mean, standardError, 0.95);

  return { mean, standardError, confidence };
}
