/**
 * input: Time series data points
 * output: Exponential smoothing predictions with trend
 * pos: Holt's linear exponential smoothing for trend-aware prediction
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// ============================================================================
// Types
// ============================================================================

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface HoltModel {
  level: number;
  trend: number;
  alpha: number; // Level smoothing parameter
  beta: number; // Trend smoothing parameter
}

export interface SmoothingPrediction {
  timestamp: number;
  value: number;
  level: number;
  trend: number;
}

export interface SmoothingResult {
  model: HoltModel;
  predictions: SmoothingPrediction[];
  fittedValues: number[];
  mse: number; // Mean squared error
}

export interface SmoothingOptions {
  alpha?: number; // Level smoothing (0-1), default 0.3
  beta?: number; // Trend smoothing (0-1), default 0.1
  optimizeParams?: boolean; // Auto-optimize parameters
}

// ============================================================================
// Exponential Smoothing Implementation
// ============================================================================

/**
 * Initialize Holt's model using first few data points
 */
function initializeHoltModel(data: DataPoint[], alpha: number, beta: number): HoltModel {
  if (data.length < 2) {
    return {
      level: data[0]?.value ?? 0,
      trend: 0,
      alpha,
      beta,
    };
  }

  // Initial level = first value
  const level = data[0].value;

  // Initial trend = average of first differences
  let trendSum = 0;
  for (let i = 1; i < Math.min(data.length, 5); i++) {
    trendSum += data[i].value - data[i - 1].value;
  }
  const trend = trendSum / Math.min(data.length - 1, 4);

  return { level, trend, alpha, beta };
}

/**
 * Fit Holt's linear exponential smoothing model
 */
export function fitHoltModel(
  data: DataPoint[],
  options: SmoothingOptions = {}
): { model: HoltModel; fittedValues: number[] } {
  const { alpha = 0.3, beta = 0.1 } = options;

  if (data.length < 2) {
    return {
      model: { level: data[0]?.value ?? 0, trend: 0, alpha, beta },
      fittedValues: data.map((d) => d.value),
    };
  }

  // Optionally optimize parameters
  const finalAlpha = options.optimizeParams ? optimizeAlpha(data, beta) : alpha;
  const finalBeta = options.optimizeParams ? optimizeBeta(data, finalAlpha) : beta;

  let model = initializeHoltModel(data, finalAlpha, finalBeta);
  const fittedValues: number[] = [model.level];

  // Update model for each data point
  for (let i = 1; i < data.length; i++) {
    const value = data[i].value;
    const prevLevel = model.level;
    const prevTrend = model.trend;

    // Update level
    model.level = model.alpha * value + (1 - model.alpha) * (prevLevel + prevTrend);

    // Update trend
    model.trend = model.beta * (model.level - prevLevel) + (1 - model.beta) * prevTrend;

    fittedValues.push(model.level);
  }

  return { model, fittedValues };
}

/**
 * Optimize alpha parameter using grid search
 */
function optimizeAlpha(data: DataPoint[], beta: number): number {
  let bestAlpha = 0.3;
  let bestMse = Infinity;

  for (let alpha = 0.1; alpha <= 0.9; alpha += 0.1) {
    const { fittedValues } = fitHoltModel(data, { alpha, beta, optimizeParams: false });
    const mse = calculateMSE(
      data.map((d) => d.value),
      fittedValues
    );

    if (mse < bestMse) {
      bestMse = mse;
      bestAlpha = alpha;
    }
  }

  return bestAlpha;
}

/**
 * Optimize beta parameter using grid search
 */
function optimizeBeta(data: DataPoint[], alpha: number): number {
  let bestBeta = 0.1;
  let bestMse = Infinity;

  for (let beta = 0.05; beta <= 0.5; beta += 0.05) {
    const { fittedValues } = fitHoltModel(data, { alpha, beta, optimizeParams: false });
    const mse = calculateMSE(
      data.map((d) => d.value),
      fittedValues
    );

    if (mse < bestMse) {
      bestMse = mse;
      bestBeta = beta;
    }
  }

  return bestBeta;
}

/**
 * Calculate mean squared error
 */
function calculateMSE(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) {
    return Infinity;
  }

  let sumSquaredError = 0;
  for (let i = 0; i < actual.length; i++) {
    sumSquaredError += (actual[i] - predicted[i]) ** 2;
  }

  return sumSquaredError / actual.length;
}

/**
 * Generate predictions using Holt's model
 */
export function predictHolt(
  model: HoltModel,
  baseTimestamp: number,
  horizonMs: number,
  steps: number = 10
): SmoothingPrediction[] {
  const predictions: SmoothingPrediction[] = [];
  const stepSize = horizonMs / steps;

  let level = model.level;
  let trend = model.trend;

  for (let i = 1; i <= steps; i++) {
    const timestamp = baseTimestamp + i * stepSize;

    // Project forward
    const projectedLevel = level + trend * i;
    const projectedTrend = trend;

    predictions.push({
      timestamp,
      value: projectedLevel,
      level: projectedLevel,
      trend: projectedTrend,
    });
  }

  return predictions;
}

/**
 * Fit and predict using Holt's exponential smoothing
 */
export function exponentialSmoothingPredict(
  data: DataPoint[],
  horizonMs: number,
  steps: number = 10,
  options: SmoothingOptions = {}
): SmoothingResult {
  const { model, fittedValues } = fitHoltModel(data, options);
  const baseTimestamp = Math.max(...data.map((d) => d.timestamp));
  const predictions = predictHolt(model, baseTimestamp, horizonMs, steps);

  const mse = calculateMSE(
    data.map((d) => d.value),
    fittedValues
  );

  return { model, predictions, fittedValues, mse };
}

/**
 * Calculate confidence based on model fit
 */
export function calculateSmoothingConfidence(mse: number, dataRange: number): number {
  if (dataRange === 0) return 50;

  // Normalize MSE by data range
  const normalizedMse = Math.sqrt(mse) / dataRange;

  // Convert to confidence score (lower MSE = higher confidence)
  const confidence = Math.max(0, 100 - normalizedMse * 200);

  return Math.round(confidence);
}

/**
 * Detect trend from Holt's model
 */
export function detectTrendFromHolt(
  model: HoltModel,
  threshold: number = 0.01
): 'improving' | 'stable' | 'declining' {
  const normalizedTrend = model.trend / Math.abs(model.level || 1);

  if (normalizedTrend > threshold) {
    return 'improving';
  } else if (normalizedTrend < -threshold) {
    return 'declining';
  }
  return 'stable';
}
