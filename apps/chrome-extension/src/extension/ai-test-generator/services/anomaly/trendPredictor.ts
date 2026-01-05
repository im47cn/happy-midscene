/**
 * input: Historical metrics data, prediction horizon
 * output: Trend predictions with confidence intervals
 * pos: Core trend prediction orchestrator combining multiple models
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type {
  TrendDirection,
  PredictionPoint,
  TrendFactor,
  TrendPrediction,
} from '../../types/anomaly';
import { anomalyStorage } from './storage';
import {
  linearRegressionPredict,
  calculateLinearConfidence,
  detectTrendFromSlope,
  exponentialSmoothingPredict,
  calculateSmoothingConfidence,
  detectTrendFromHolt,
  arimaPredict,
  calculateArimaConfidence,
} from './models';

// ============================================================================
// Types
// ============================================================================

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface PredictOptions {
  horizon?: number; // Prediction horizon in milliseconds (default: 7 days)
  steps?: number; // Number of prediction points (default: 10)
  method?: 'linear' | 'exponential' | 'arima' | 'ensemble'; // Prediction method
  confidenceLevel?: number; // Confidence level for intervals (default: 0.95)
}

export interface CasePrediction extends TrendPrediction {
  caseId: string;
  metrics: {
    passRate: TrendPrediction;
    avgDuration: TrendPrediction;
    failureRate: TrendPrediction;
  };
}

export interface OverallTrend {
  direction: TrendDirection;
  confidence: number;
  summary: string;
  topImproving: string[];
  topDeclining: string[];
  predictions: {
    passRate: TrendPrediction;
    totalExecutions: TrendPrediction;
    avgDuration: TrendPrediction;
  };
}

export interface ModelComparison {
  model: string;
  mse: number;
  confidence: number;
  trend: TrendDirection;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_HORIZON_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_STEPS = 10;
const MIN_DATA_POINTS = 5;

// ============================================================================
// Trend Predictor Class
// ============================================================================

class TrendPredictor {
  /**
   * Predict trend for a specific metric
   */
  async predict(
    metricName: string,
    data: DataPoint[],
    options: PredictOptions = {}
  ): Promise<TrendPrediction> {
    const { horizon = DEFAULT_HORIZON_MS, steps = DEFAULT_STEPS, method = 'ensemble' } = options;

    if (data.length < MIN_DATA_POINTS) {
      return this.createInsufficientDataPrediction(metricName, data);
    }

    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

    // Run prediction based on method
    let predictions: PredictionPoint[];
    let trend: TrendDirection;
    let confidence: number;
    let factors: TrendFactor[];

    if (method === 'ensemble') {
      const result = this.ensemblePredict(sortedData, horizon, steps);
      predictions = result.predictions;
      trend = result.trend;
      confidence = result.confidence;
      factors = result.factors;
    } else {
      const result = this.singleModelPredict(sortedData, horizon, steps, method);
      predictions = result.predictions;
      trend = result.trend;
      confidence = result.confidence;
      factors = this.analyzeTrendFactors(sortedData, trend);
    }

    return {
      metricName,
      currentValue: sortedData[sortedData.length - 1].value,
      predictions,
      trend,
      confidence,
      factors,
    };
  }

  /**
   * Predict trends for a specific test case
   */
  async predictForCase(
    caseId: string,
    options: PredictOptions = {}
  ): Promise<CasePrediction | null> {
    // Get historical data for the case
    const baseline = await anomalyStorage.getBaseline(caseId, 'pass_rate');
    if (!baseline) {
      return null;
    }

    // Create data points from baseline history
    const passRateData = baseline.history.map((h, i) => ({
      timestamp: baseline.updatedAt - (baseline.history.length - i) * 24 * 60 * 60 * 1000,
      value: h,
    }));

    // Get duration baseline if available
    const durationBaseline = await anomalyStorage.getBaseline(caseId, 'duration');
    const durationData = durationBaseline
      ? durationBaseline.history.map((h, i) => ({
          timestamp:
            durationBaseline.updatedAt - (durationBaseline.history.length - i) * 24 * 60 * 60 * 1000,
          value: h,
        }))
      : [];

    // Predict each metric
    const passRatePrediction = await this.predict(`${caseId}:pass_rate`, passRateData, options);
    const durationPrediction =
      durationData.length >= MIN_DATA_POINTS
        ? await this.predict(`${caseId}:duration`, durationData, options)
        : this.createInsufficientDataPrediction(`${caseId}:duration`, durationData);

    // Calculate failure rate prediction (inverse of pass rate)
    const failureRatePrediction: TrendPrediction = {
      metricName: `${caseId}:failure_rate`,
      currentValue: 1 - passRatePrediction.currentValue,
      predictions: passRatePrediction.predictions.map((p) => ({
        ...p,
        value: 1 - p.value,
        lowerBound: 1 - p.upperBound,
        upperBound: 1 - p.lowerBound,
      })),
      trend: this.invertTrend(passRatePrediction.trend),
      confidence: passRatePrediction.confidence,
      factors: passRatePrediction.factors.map((f) => ({
        ...f,
        impact: -f.impact,
      })),
    };

    // Determine overall trend for the case
    const overallTrend = this.combineMetricTrends([passRatePrediction, durationPrediction]);

    return {
      caseId,
      metricName: `${caseId}:overall`,
      currentValue: passRatePrediction.currentValue,
      predictions: passRatePrediction.predictions,
      trend: overallTrend.direction,
      confidence: overallTrend.confidence,
      factors: passRatePrediction.factors,
      metrics: {
        passRate: passRatePrediction,
        avgDuration: durationPrediction,
        failureRate: failureRatePrediction,
      },
    };
  }

  /**
   * Get overall trend across all test cases
   */
  async getOverallTrend(options: PredictOptions = {}): Promise<OverallTrend> {
    // Get all baselines
    const baselines = await anomalyStorage.getAllBaselines();

    // Group by case
    const caseBaselines = new Map<string, typeof baselines>();
    for (const baseline of baselines) {
      const existing = caseBaselines.get(baseline.caseId) ?? [];
      existing.push(baseline);
      caseBaselines.set(baseline.caseId, existing);
    }

    // Predict for each case with pass_rate baseline
    const casePredictions: CasePrediction[] = [];
    for (const [caseId] of caseBaselines) {
      const prediction = await this.predictForCase(caseId, options);
      if (prediction) {
        casePredictions.push(prediction);
      }
    }

    if (casePredictions.length === 0) {
      return this.createEmptyOverallTrend();
    }

    // Aggregate pass rates
    const avgPassRates = this.aggregateMetric(casePredictions, 'passRate');
    const avgDurations = this.aggregateMetric(casePredictions, 'avgDuration');

    // Find top improving and declining cases
    const improving = casePredictions
      .filter((p) => p.trend === 'improving')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((p) => p.caseId);

    const declining = casePredictions
      .filter((p) => p.trend === 'declining')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
      .map((p) => p.caseId);

    // Determine overall direction
    const improvingCount = casePredictions.filter((p) => p.trend === 'improving').length;
    const decliningCount = casePredictions.filter((p) => p.trend === 'declining').length;

    let direction: TrendDirection;
    if (improvingCount > decliningCount * 1.5) {
      direction = 'improving';
    } else if (decliningCount > improvingCount * 1.5) {
      direction = 'declining';
    } else {
      direction = 'stable';
    }

    const avgConfidence = Math.round(
      casePredictions.reduce((sum, p) => sum + p.confidence, 0) / casePredictions.length
    );

    // Create total executions prediction (placeholder based on pass rate trend)
    const totalExecutionsPrediction: TrendPrediction = {
      metricName: 'total_executions',
      currentValue: casePredictions.length,
      predictions: avgPassRates.predictions.map((p) => ({
        ...p,
        value: casePredictions.length,
      })),
      trend: 'stable',
      confidence: 50,
      factors: [],
    };

    return {
      direction,
      confidence: avgConfidence,
      summary: this.generateOverallSummary(direction, improving, declining, avgConfidence),
      topImproving: improving,
      topDeclining: declining,
      predictions: {
        passRate: avgPassRates,
        totalExecutions: totalExecutionsPrediction,
        avgDuration: avgDurations,
      },
    };
  }

  /**
   * Compare different prediction models for a dataset
   */
  compareModels(data: DataPoint[], horizon: number = DEFAULT_HORIZON_MS): ModelComparison[] {
    if (data.length < MIN_DATA_POINTS) {
      return [];
    }

    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
    const comparisons: ModelComparison[] = [];

    // Linear regression
    try {
      const linear = linearRegressionPredict(sortedData, horizon);
      const mse =
        linear.residuals.reduce((sum, r) => sum + r ** 2, 0) / linear.residuals.length || 0;
      comparisons.push({
        model: 'linear',
        mse,
        confidence: calculateLinearConfidence(linear.model),
        trend: detectTrendFromSlope(linear.model.slope),
      });
    } catch {
      // Skip if model fails
    }

    // Exponential smoothing
    try {
      const exp = exponentialSmoothingPredict(sortedData, horizon);
      const dataRange = Math.max(...sortedData.map((d) => d.value)) - Math.min(...sortedData.map((d) => d.value));
      comparisons.push({
        model: 'exponential',
        mse: exp.mse,
        confidence: calculateSmoothingConfidence(exp.mse, dataRange),
        trend: detectTrendFromHolt(exp.model),
      });
    } catch {
      // Skip if model fails
    }

    // ARIMA
    try {
      const arima = arimaPredict(sortedData, horizon);
      const values = sortedData.map((d) => d.value);
      let mse = 0;
      for (let i = 0; i < values.length; i++) {
        mse += (values[i] - arima.fittedValues[i]) ** 2;
      }
      mse /= values.length;
      comparisons.push({
        model: 'arima',
        mse,
        confidence: calculateArimaConfidence(arima.model, mse),
        trend: this.detectArimaTrend(arima.predictions),
      });
    } catch {
      // Skip if model fails
    }

    return comparisons.sort((a, b) => a.mse - b.mse);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Ensemble prediction combining multiple models
   */
  private ensemblePredict(
    data: DataPoint[],
    horizon: number,
    steps: number
  ): { predictions: PredictionPoint[]; trend: TrendDirection; confidence: number; factors: TrendFactor[] } {
    const comparisons = this.compareModels(data, horizon);

    if (comparisons.length === 0) {
      return {
        predictions: this.generateFlatPredictions(data, horizon, steps),
        trend: 'stable',
        confidence: 0,
        factors: [],
      };
    }

    // Get predictions from each model
    const linearResult = linearRegressionPredict(data, horizon, steps);
    const expResult = exponentialSmoothingPredict(data, horizon, steps, { optimizeParams: true });
    const arimaResult = arimaPredict(data, horizon, steps);

    // Weight by inverse MSE
    const linearWeight = 1 / (linearResult.residuals.reduce((s, r) => s + r ** 2, 0) / linearResult.residuals.length + 0.001);
    const expWeight = 1 / (expResult.mse + 0.001);
    const arimaWeight = 1 / (arimaResult.aic + 0.001);
    const totalWeight = linearWeight + expWeight + arimaWeight;

    // Combine predictions
    const predictions: PredictionPoint[] = [];
    for (let i = 0; i < steps; i++) {
      const linearVal = linearResult.predictions[i]?.value ?? 0;
      const expVal = expResult.predictions[i]?.value ?? 0;
      const arimaVal = arimaResult.predictions[i]?.value ?? 0;

      const value =
        (linearVal * linearWeight + expVal * expWeight + arimaVal * arimaWeight) / totalWeight;

      const linearStdErr = linearResult.predictions[i]?.standardError ?? 0;
      const arimaStdErr = arimaResult.predictions[i]?.standardError ?? 0;
      const stdErr = (linearStdErr + arimaStdErr) / 2;

      predictions.push({
        timestamp: linearResult.predictions[i]?.timestamp ?? Date.now() + (i + 1) * (horizon / steps),
        value,
        lowerBound: value - 1.96 * stdErr,
        upperBound: value + 1.96 * stdErr,
      });
    }

    // Determine consensus trend
    const trends = comparisons.map((c) => c.trend);
    const trend = this.consensusTrend(trends);

    // Calculate weighted confidence
    const confidence = Math.round(
      comparisons.reduce((sum, c, i) => {
        const weight = 1 / (c.mse + 0.001);
        return sum + c.confidence * weight;
      }, 0) / comparisons.reduce((sum, c) => sum + 1 / (c.mse + 0.001), 0)
    );

    const factors = this.analyzeTrendFactors(data, trend);

    return { predictions, trend, confidence, factors };
  }

  /**
   * Single model prediction
   */
  private singleModelPredict(
    data: DataPoint[],
    horizon: number,
    steps: number,
    method: 'linear' | 'exponential' | 'arima'
  ): { predictions: PredictionPoint[]; trend: TrendDirection; confidence: number } {
    switch (method) {
      case 'linear': {
        const result = linearRegressionPredict(data, horizon, steps);
        return {
          predictions: result.predictions.map((p) => ({
            timestamp: p.timestamp,
            value: p.value,
            lowerBound: p.value - 1.96 * p.standardError,
            upperBound: p.value + 1.96 * p.standardError,
          })),
          trend: detectTrendFromSlope(result.model.slope),
          confidence: calculateLinearConfidence(result.model),
        };
      }

      case 'exponential': {
        const result = exponentialSmoothingPredict(data, horizon, steps, { optimizeParams: true });
        const dataRange = Math.max(...data.map((d) => d.value)) - Math.min(...data.map((d) => d.value));
        const stdErr = Math.sqrt(result.mse);
        return {
          predictions: result.predictions.map((p) => ({
            timestamp: p.timestamp,
            value: p.value,
            lowerBound: p.value - 1.96 * stdErr,
            upperBound: p.value + 1.96 * stdErr,
          })),
          trend: detectTrendFromHolt(result.model),
          confidence: calculateSmoothingConfidence(result.mse, dataRange),
        };
      }

      case 'arima': {
        const result = arimaPredict(data, horizon, steps);
        const values = data.map((d) => d.value);
        let mse = 0;
        for (let i = 0; i < values.length; i++) {
          mse += (values[i] - result.fittedValues[i]) ** 2;
        }
        mse /= values.length;
        return {
          predictions: result.predictions.map((p) => ({
            timestamp: p.timestamp,
            value: p.value,
            lowerBound: p.value - 1.96 * p.standardError,
            upperBound: p.value + 1.96 * p.standardError,
          })),
          trend: this.detectArimaTrend(result.predictions),
          confidence: calculateArimaConfidence(result.model, mse),
        };
      }
    }
  }

  /**
   * Generate flat predictions for insufficient data
   */
  private generateFlatPredictions(
    data: DataPoint[],
    horizon: number,
    steps: number
  ): PredictionPoint[] {
    const lastValue = data.length > 0 ? data[data.length - 1].value : 0;
    const baseTimestamp = data.length > 0 ? data[data.length - 1].timestamp : Date.now();
    const stepSize = horizon / steps;

    return Array.from({ length: steps }, (_, i) => ({
      timestamp: baseTimestamp + (i + 1) * stepSize,
      value: lastValue,
      lowerBound: lastValue,
      upperBound: lastValue,
    }));
  }

  /**
   * Create prediction result for insufficient data
   */
  private createInsufficientDataPrediction(metricName: string, data: DataPoint[]): TrendPrediction {
    const lastValue = data.length > 0 ? data[data.length - 1].value : 0;

    return {
      metricName,
      currentValue: lastValue,
      predictions: this.generateFlatPredictions(data, DEFAULT_HORIZON_MS, DEFAULT_STEPS),
      trend: 'stable',
      confidence: 0,
      factors: [
        {
          name: 'Insufficient Data',
          impact: 0,
          description: `Only ${data.length} data points available. Need at least ${MIN_DATA_POINTS} for prediction.`,
        },
      ],
    };
  }

  /**
   * Create empty overall trend
   */
  private createEmptyOverallTrend(): OverallTrend {
    const emptyPrediction: TrendPrediction = {
      metricName: '',
      currentValue: 0,
      predictions: [],
      trend: 'stable',
      confidence: 0,
      factors: [],
    };

    return {
      direction: 'stable',
      confidence: 0,
      summary: 'No test data available for trend analysis.',
      topImproving: [],
      topDeclining: [],
      predictions: {
        passRate: { ...emptyPrediction, metricName: 'pass_rate' },
        totalExecutions: { ...emptyPrediction, metricName: 'total_executions' },
        avgDuration: { ...emptyPrediction, metricName: 'avg_duration' },
      },
    };
  }

  /**
   * Detect trend from ARIMA predictions
   */
  private detectArimaTrend(
    predictions: { value: number }[]
  ): TrendDirection {
    if (predictions.length < 2) return 'stable';

    const first = predictions[0].value;
    const last = predictions[predictions.length - 1].value;
    const change = (last - first) / (Math.abs(first) || 1);

    if (change > 0.05) return 'improving';
    if (change < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Get consensus trend from multiple models
   */
  private consensusTrend(trends: TrendDirection[]): TrendDirection {
    const counts = { improving: 0, stable: 0, declining: 0 };
    for (const t of trends) {
      counts[t]++;
    }

    if (counts.improving > counts.declining && counts.improving > counts.stable) {
      return 'improving';
    }
    if (counts.declining > counts.improving && counts.declining > counts.stable) {
      return 'declining';
    }
    return 'stable';
  }

  /**
   * Invert trend direction
   */
  private invertTrend(trend: TrendDirection): TrendDirection {
    if (trend === 'improving') return 'declining';
    if (trend === 'declining') return 'improving';
    return 'stable';
  }

  /**
   * Combine metric trends to determine overall trend
   */
  private combineMetricTrends(
    predictions: TrendPrediction[]
  ): { direction: TrendDirection; confidence: number } {
    const validPredictions = predictions.filter((p) => p.confidence > 0);

    if (validPredictions.length === 0) {
      return { direction: 'stable', confidence: 0 };
    }

    // Weight by confidence
    let improvingScore = 0;
    let decliningScore = 0;
    let totalConfidence = 0;

    for (const p of validPredictions) {
      totalConfidence += p.confidence;
      if (p.trend === 'improving') {
        improvingScore += p.confidence;
      } else if (p.trend === 'declining') {
        decliningScore += p.confidence;
      }
    }

    const avgConfidence = Math.round(totalConfidence / validPredictions.length);

    if (improvingScore > decliningScore * 1.2) {
      return { direction: 'improving', confidence: avgConfidence };
    }
    if (decliningScore > improvingScore * 1.2) {
      return { direction: 'declining', confidence: avgConfidence };
    }
    return { direction: 'stable', confidence: avgConfidence };
  }

  /**
   * Aggregate metric across multiple cases
   */
  private aggregateMetric(
    predictions: CasePrediction[],
    metric: 'passRate' | 'avgDuration'
  ): TrendPrediction {
    const metricPredictions = predictions
      .map((p) => p.metrics[metric])
      .filter((m) => m.confidence > 0);

    if (metricPredictions.length === 0) {
      return {
        metricName: `aggregate_${metric}`,
        currentValue: 0,
        predictions: [],
        trend: 'stable',
        confidence: 0,
        factors: [],
      };
    }

    // Average current values
    const avgCurrent =
      metricPredictions.reduce((sum, m) => sum + m.currentValue, 0) / metricPredictions.length;

    // Average predictions at each step
    const maxSteps = Math.max(...metricPredictions.map((m) => m.predictions.length));
    const avgPredictions: PredictionPoint[] = [];

    for (let i = 0; i < maxSteps; i++) {
      const pointsAtStep = metricPredictions
        .map((m) => m.predictions[i])
        .filter((p): p is PredictionPoint => p !== undefined);

      if (pointsAtStep.length === 0) continue;

      avgPredictions.push({
        timestamp: pointsAtStep[0].timestamp,
        value: pointsAtStep.reduce((sum, p) => sum + p.value, 0) / pointsAtStep.length,
        lowerBound: pointsAtStep.reduce((sum, p) => sum + p.lowerBound, 0) / pointsAtStep.length,
        upperBound: pointsAtStep.reduce((sum, p) => sum + p.upperBound, 0) / pointsAtStep.length,
      });
    }

    // Determine aggregate trend
    const trends = metricPredictions.map((m) => m.trend);
    const trend = this.consensusTrend(trends);

    const avgConfidence = Math.round(
      metricPredictions.reduce((sum, m) => sum + m.confidence, 0) / metricPredictions.length
    );

    return {
      metricName: `aggregate_${metric}`,
      currentValue: avgCurrent,
      predictions: avgPredictions,
      trend,
      confidence: avgConfidence,
      factors: this.aggregateTrendFactors(metricPredictions),
    };
  }

  /**
   * Aggregate trend factors from multiple predictions
   */
  private aggregateTrendFactors(predictions: TrendPrediction[]): TrendFactor[] {
    const factorMap = new Map<string, { impact: number; count: number; description: string }>();

    for (const p of predictions) {
      for (const f of p.factors) {
        const existing = factorMap.get(f.name);
        if (existing) {
          existing.impact += f.impact;
          existing.count++;
        } else {
          factorMap.set(f.name, { impact: f.impact, count: 1, description: f.description });
        }
      }
    }

    return Array.from(factorMap.entries())
      .map(([name, data]) => ({
        name,
        impact: data.impact / data.count,
        description: data.description,
      }))
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 5);
  }

  /**
   * Analyze factors contributing to the trend
   */
  private analyzeTrendFactors(data: DataPoint[], trend: TrendDirection): TrendFactor[] {
    const factors: TrendFactor[] = [];

    if (data.length < 3) {
      return factors;
    }

    // Calculate recent vs historical averages
    const recentCount = Math.min(Math.floor(data.length / 3), 5);
    const historicalCount = data.length - recentCount;

    const recentAvg =
      data.slice(-recentCount).reduce((sum, d) => sum + d.value, 0) / recentCount;
    const historicalAvg =
      data.slice(0, historicalCount).reduce((sum, d) => sum + d.value, 0) / historicalCount;

    const change = ((recentAvg - historicalAvg) / (historicalAvg || 1)) * 100;

    factors.push({
      name: 'Recent Performance',
      impact: change,
      description: `Recent average ${change >= 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% compared to historical`,
    });

    // Check volatility
    const values = data.map((d) => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const cv = Math.sqrt(variance) / (mean || 1); // Coefficient of variation

    if (cv > 0.3) {
      factors.push({
        name: 'High Volatility',
        impact: -cv * 50,
        description: `High variability in data (CV: ${(cv * 100).toFixed(1)}%) reduces prediction confidence`,
      });
    } else if (cv < 0.1) {
      factors.push({
        name: 'Stable Pattern',
        impact: (1 - cv) * 20,
        description: `Low variability (CV: ${(cv * 100).toFixed(1)}%) indicates stable and predictable pattern`,
      });
    }

    // Check for recent spikes or drops
    const recentValues = values.slice(-5);
    const recentMax = Math.max(...recentValues);
    const recentMin = Math.min(...recentValues);
    const overallMax = Math.max(...values);
    const overallMin = Math.min(...values);

    if (recentMax === overallMax && recentMax > mean * 1.5) {
      factors.push({
        name: 'Recent Peak',
        impact: 15,
        description: 'Recent values reached an all-time high',
      });
    }

    if (recentMin === overallMin && recentMin < mean * 0.5) {
      factors.push({
        name: 'Recent Trough',
        impact: -15,
        description: 'Recent values reached an all-time low',
      });
    }

    return factors.slice(0, 5);
  }

  /**
   * Generate overall summary text
   */
  private generateOverallSummary(
    direction: TrendDirection,
    improving: string[],
    declining: string[],
    confidence: number
  ): string {
    const parts: string[] = [];

    if (direction === 'improving') {
      parts.push('Overall test health is improving');
    } else if (direction === 'declining') {
      parts.push('Overall test health shows declining trends');
    } else {
      parts.push('Overall test health is stable');
    }

    parts.push(`(${confidence}% confidence)`);

    if (improving.length > 0) {
      parts.push(`Top improving: ${improving.slice(0, 2).join(', ')}`);
    }

    if (declining.length > 0) {
      parts.push(`Needs attention: ${declining.slice(0, 2).join(', ')}`);
    }

    return parts.join('. ');
  }
}

// Export singleton instance
export const trendPredictor = new TrendPredictor();
