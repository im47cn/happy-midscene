/**
 * input: Time series data points
 * output: Simplified ARIMA predictions
 * pos: Lightweight ARIMA-like model for trend prediction
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// ============================================================================
// Types
// ============================================================================

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface ArimaModel {
  ar: number[]; // Autoregressive coefficients
  ma: number[]; // Moving average coefficients
  d: number; // Differencing order
  mean: number;
  variance: number;
}

export interface ArimaPrediction {
  timestamp: number;
  value: number;
  standardError: number;
}

export interface ArimaResult {
  model: ArimaModel;
  predictions: ArimaPrediction[];
  fittedValues: number[];
  aic: number; // Akaike Information Criterion
}

export interface ArimaOptions {
  p?: number; // AR order (default 1)
  d?: number; // Differencing order (default 1)
  q?: number; // MA order (default 1)
}

// ============================================================================
// ARIMA Implementation (Simplified)
// ============================================================================

/**
 * Difference a time series
 */
function difference(values: number[], d: number = 1): number[] {
  let result = [...values];

  for (let i = 0; i < d; i++) {
    const diffed: number[] = [];
    for (let j = 1; j < result.length; j++) {
      diffed.push(result[j] - result[j - 1]);
    }
    result = diffed;
  }

  return result;
}

/**
 * Inverse difference to restore original scale
 */
function inverseDifference(lastOriginal: number, predicted: number[], d: number = 1): number[] {
  let result = [...predicted];

  for (let i = 0; i < d; i++) {
    const restored: number[] = [];
    let cumsum = lastOriginal;
    for (const val of result) {
      cumsum += val;
      restored.push(cumsum);
    }
    result = restored;
  }

  return result;
}

/**
 * Calculate autocorrelation at lag k
 */
function autocorrelation(values: number[], lag: number): number {
  const n = values.length;
  if (lag >= n) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    denominator += (values[i] - mean) ** 2;
    if (i >= lag) {
      numerator += (values[i] - mean) * (values[i - lag] - mean);
    }
  }

  return denominator !== 0 ? numerator / denominator : 0;
}

/**
 * Estimate AR coefficients using Yule-Walker equations
 */
function estimateAR(values: number[], p: number): number[] {
  if (p === 0) return [];
  if (values.length < p + 1) return Array(p).fill(0);

  // Simplified: use autocorrelations directly as approximation
  const ar: number[] = [];
  for (let i = 1; i <= p; i++) {
    ar.push(autocorrelation(values, i));
  }

  return ar;
}

/**
 * Estimate MA coefficients from residuals
 */
function estimateMA(residuals: number[], q: number): number[] {
  if (q === 0 || residuals.length < q + 1) return [];

  // Simplified: use autocorrelation of residuals
  const ma: number[] = [];
  for (let i = 1; i <= q; i++) {
    ma.push(autocorrelation(residuals, i) * 0.5); // Dampened
  }

  return ma;
}

/**
 * Calculate residuals from AR fit
 */
function calculateResiduals(values: number[], ar: number[]): number[] {
  const residuals: number[] = [];
  const p = ar.length;

  for (let i = p; i < values.length; i++) {
    let predicted = 0;
    for (let j = 0; j < p; j++) {
      predicted += ar[j] * values[i - j - 1];
    }
    residuals.push(values[i] - predicted);
  }

  return residuals;
}

/**
 * Fit a simplified ARIMA model
 */
export function fitArimaModel(data: DataPoint[], options: ArimaOptions = {}): ArimaModel {
  const { p = 1, d = 1, q = 1 } = options;
  const values = data.map((d) => d.value);

  if (values.length < 3) {
    return {
      ar: [],
      ma: [],
      d,
      mean: values.length > 0 ? values[values.length - 1] : 0,
      variance: 0,
    };
  }

  // Apply differencing
  const diffed = difference(values, d);

  if (diffed.length < 2) {
    return {
      ar: [],
      ma: [],
      d,
      mean: values[values.length - 1],
      variance: 0,
    };
  }

  // Calculate mean of differenced series
  const mean = diffed.reduce((sum, v) => sum + v, 0) / diffed.length;

  // Center the series
  const centered = diffed.map((v) => v - mean);

  // Estimate AR coefficients
  const ar = estimateAR(centered, p);

  // Calculate residuals
  const residuals = calculateResiduals(centered, ar);

  // Estimate MA coefficients
  const ma = estimateMA(residuals, q);

  // Calculate variance of residuals
  const variance =
    residuals.length > 0 ? residuals.reduce((sum, r) => sum + r ** 2, 0) / residuals.length : 0;

  return { ar, ma, d, mean, variance };
}

/**
 * Generate predictions using ARIMA model
 */
export function predictArima(
  model: ArimaModel,
  data: DataPoint[],
  horizonMs: number,
  steps: number = 10
): ArimaPrediction[] {
  const values = data.map((d) => d.value);
  const baseTimestamp = Math.max(...data.map((d) => d.timestamp));
  const stepSize = horizonMs / steps;

  // Get differenced values for prediction
  const diffed = difference(values, model.d);
  const recentDiffed = diffed.slice(-Math.max(model.ar.length, 3));

  // Generate predictions in differenced space
  const diffPredictions: number[] = [];

  for (let i = 0; i < steps; i++) {
    let prediction = model.mean;

    // AR component
    for (let j = 0; j < model.ar.length; j++) {
      const idx = recentDiffed.length + i - j - 1;
      const value =
        idx >= recentDiffed.length
          ? diffPredictions[idx - recentDiffed.length]
          : idx >= 0
            ? recentDiffed[idx]
            : 0;
      prediction += model.ar[j] * (value - model.mean);
    }

    diffPredictions.push(prediction);
  }

  // Inverse difference to get actual predictions
  const lastOriginal = values[values.length - 1];
  const actualPredictions = inverseDifference(lastOriginal, diffPredictions, model.d);

  // Create prediction objects
  const predictions: ArimaPrediction[] = actualPredictions.map((value, i) => ({
    timestamp: baseTimestamp + (i + 1) * stepSize,
    value,
    standardError: Math.sqrt(model.variance) * Math.sqrt(i + 1),
  }));

  return predictions;
}

/**
 * Calculate fitted values for the training data
 */
function calculateFittedValues(data: DataPoint[], model: ArimaModel): number[] {
  const values = data.map((d) => d.value);
  const diffed = difference(values, model.d);

  // Calculate fitted differenced values
  const fittedDiffed: number[] = Array(model.ar.length).fill(0);

  for (let i = model.ar.length; i < diffed.length; i++) {
    let fitted = model.mean;
    for (let j = 0; j < model.ar.length; j++) {
      fitted += model.ar[j] * (diffed[i - j - 1] - model.mean);
    }
    fittedDiffed.push(fitted);
  }

  // Pad to match original length
  while (fittedDiffed.length < diffed.length) {
    fittedDiffed.unshift(diffed[fittedDiffed.length] || 0);
  }

  // Inverse difference
  const fitted = inverseDifference(values[0], fittedDiffed, model.d);

  // Adjust to match original length
  while (fitted.length < values.length) {
    fitted.unshift(values[values.length - fitted.length - 1]);
  }

  return fitted.slice(0, values.length);
}

/**
 * Calculate AIC for model comparison
 */
function calculateAIC(n: number, k: number, mse: number): number {
  if (mse <= 0) return Infinity;
  return n * Math.log(mse) + 2 * k;
}

/**
 * Fit and predict using ARIMA
 */
export function arimaPredict(
  data: DataPoint[],
  horizonMs: number,
  steps: number = 10,
  options: ArimaOptions = {}
): ArimaResult {
  const model = fitArimaModel(data, options);
  const predictions = predictArima(model, data, horizonMs, steps);
  const fittedValues = calculateFittedValues(data, model);

  // Calculate MSE
  const values = data.map((d) => d.value);
  let mse = 0;
  for (let i = 0; i < values.length; i++) {
    mse += (values[i] - fittedValues[i]) ** 2;
  }
  mse /= values.length;

  // Calculate AIC
  const k = model.ar.length + model.ma.length + 1;
  const aic = calculateAIC(values.length, k, mse);

  return { model, predictions, fittedValues, aic };
}

/**
 * Calculate confidence from ARIMA model
 */
export function calculateArimaConfidence(model: ArimaModel, mse: number): number {
  if (mse <= 0) return 50;

  // Use coefficient of variation as quality measure
  const cv = Math.sqrt(model.variance) / Math.abs(model.mean || 1);
  const confidence = Math.max(0, 100 - cv * 100);

  return Math.round(confidence);
}
