/**
 * input: Time series data points
 * output: Linear regression model and predictions
 * pos: Basic trend prediction using linear regression
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// ============================================================================
// Types
// ============================================================================

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface LinearRegressionModel {
  slope: number;
  intercept: number;
  r2: number; // R-squared (coefficient of determination)
  standardError: number;
}

export interface LinearPrediction {
  timestamp: number;
  value: number;
  standardError: number;
}

export interface RegressionResult {
  model: LinearRegressionModel;
  predictions: LinearPrediction[];
  residuals: number[];
}

// ============================================================================
// Linear Regression Implementation
// ============================================================================

/**
 * Fit a linear regression model to data points
 */
export function fitLinearRegression(data: DataPoint[]): LinearRegressionModel {
  if (data.length < 2) {
    return { slope: 0, intercept: data[0]?.value ?? 0, r2: 0, standardError: 0 };
  }

  const n = data.length;

  // Normalize timestamps to start from 0
  const minTimestamp = Math.min(...data.map((d) => d.timestamp));
  const normalizedData = data.map((d) => ({
    x: (d.timestamp - minTimestamp) / 1000 / 3600, // Convert to hours
    y: d.value,
  }));

  // Calculate means
  const sumX = normalizedData.reduce((sum, d) => sum + d.x, 0);
  const sumY = normalizedData.reduce((sum, d) => sum + d.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Calculate slope and intercept using least squares
  let numerator = 0;
  let denominator = 0;

  for (const d of normalizedData) {
    numerator += (d.x - meanX) * (d.y - meanY);
    denominator += (d.x - meanX) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared
  let ssRes = 0; // Sum of squared residuals
  let ssTot = 0; // Total sum of squares

  for (const d of normalizedData) {
    const predicted = slope * d.x + intercept;
    ssRes += (d.y - predicted) ** 2;
    ssTot += (d.y - meanY) ** 2;
  }

  const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  // Calculate standard error
  const standardError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;

  return {
    slope: slope / 3600, // Convert back to per-millisecond
    intercept,
    r2: Math.max(0, Math.min(1, r2)),
    standardError,
  };
}

/**
 * Predict future values using a linear model
 */
export function predictLinear(
  model: LinearRegressionModel,
  baseTimestamp: number,
  horizonMs: number,
  steps: number = 10
): LinearPrediction[] {
  const predictions: LinearPrediction[] = [];
  const stepSize = horizonMs / steps;

  for (let i = 1; i <= steps; i++) {
    const timestamp = baseTimestamp + i * stepSize;
    const deltaMs = timestamp - baseTimestamp;
    const value = model.intercept + model.slope * deltaMs;

    predictions.push({
      timestamp,
      value,
      standardError: model.standardError * Math.sqrt(1 + 1 / steps + (i / steps) ** 2),
    });
  }

  return predictions;
}

/**
 * Fit and predict using linear regression
 */
export function linearRegressionPredict(
  data: DataPoint[],
  horizonMs: number,
  steps: number = 10
): RegressionResult {
  const model = fitLinearRegression(data);
  const baseTimestamp = Math.max(...data.map((d) => d.timestamp));
  const predictions = predictLinear(model, baseTimestamp, horizonMs, steps);

  // Calculate residuals for the training data
  const minTimestamp = Math.min(...data.map((d) => d.timestamp));
  const residuals = data.map((d) => {
    const predicted = model.intercept + model.slope * (d.timestamp - minTimestamp);
    return d.value - predicted;
  });

  return { model, predictions, residuals };
}

/**
 * Calculate prediction confidence based on model fit
 */
export function calculateLinearConfidence(model: LinearRegressionModel): number {
  // Combine R-squared with a penalty for high standard error
  const r2Weight = 0.7;
  const seWeight = 0.3;

  const r2Score = model.r2 * 100;
  const seScore = Math.max(0, 100 - model.standardError * 10);

  return Math.round(r2Weight * r2Score + seWeight * seScore);
}

/**
 * Detect trend direction from slope
 */
export function detectTrendFromSlope(
  slope: number,
  threshold: number = 0.001
): 'improving' | 'stable' | 'declining' {
  const normalizedSlope = slope * 3600 * 1000; // Convert to per-hour

  if (normalizedSlope > threshold) {
    return 'improving';
  } else if (normalizedSlope < -threshold) {
    return 'declining';
  }
  return 'stable';
}
