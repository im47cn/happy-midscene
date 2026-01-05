/**
 * input: Individual prediction model modules
 * output: Unified prediction model exports
 * pos: Entry point for trend prediction models
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

// Linear Regression
export {
  fitLinearRegression,
  predictLinear,
  linearRegressionPredict,
  calculateLinearConfidence,
  detectTrendFromSlope,
  type DataPoint as LinearDataPoint,
  type LinearRegressionModel,
  type LinearPrediction,
  type RegressionResult,
} from './linearRegression';

// Exponential Smoothing (Holt's Method)
export {
  fitHoltModel,
  predictHolt,
  exponentialSmoothingPredict,
  calculateSmoothingConfidence,
  detectTrendFromHolt,
  type DataPoint as SmoothingDataPoint,
  type HoltModel,
  type SmoothingPrediction,
  type SmoothingResult,
  type SmoothingOptions,
} from './exponentialSmoothing';

// ARIMA
export {
  fitArimaModel,
  predictArima,
  arimaPredict,
  calculateArimaConfidence,
  type DataPoint as ArimaDataPoint,
  type ArimaModel,
  type ArimaPrediction,
  type ArimaResult,
  type ArimaOptions,
} from './arima';
