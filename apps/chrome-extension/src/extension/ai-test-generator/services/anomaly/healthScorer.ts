/**
 * input: Anomaly storage, baseline data, test execution metrics
 * output: Health scores with dimension breakdown and recommendations
 * pos: Health assessment layer for test suite quality
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type {
  Anomaly,
  BaselineInfo,
  HealthDimension,
  HealthFactor,
  HealthScore,
  TrendDirection,
} from '../../types/anomaly';
import { anomalyStorage } from './storage';

// ============================================================================
// Types
// ============================================================================

export interface MetricData {
  passRate?: number; // 0-100
  avgDuration?: number; // ms
  durationVariance?: number;
  consecutiveFailures?: number;
  flakyCount?: number;
  totalCases?: number;
  coveredCases?: number;
  recentAnomalies?: number;
}

export interface CalculateOptions {
  metrics?: MetricData;
  includeHistory?: boolean;
  historyDays?: number;
}

export interface ScoreTrend {
  direction: TrendDirection;
  change: number; // percentage change
  period: string;
}

export interface ScoreComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  improved: boolean;
}

export interface DimensionTrend {
  dimension: string;
  trend: ScoreTrend;
  isAtRisk: boolean;
  riskReason?: string;
}

export interface ScoreTrendAnalysis {
  overall: ScoreTrend;
  dimensions: DimensionTrend[];
  comparison: {
    lastWeek: ScoreComparison;
    lastMonth: ScoreComparison;
  };
  alerts: string[];
}

// ============================================================================
// Constants
// ============================================================================

// Dimension weights (must sum to 1.0)
const DIMENSION_WEIGHTS = {
  reliability: 0.35,
  stability: 0.25,
  efficiency: 0.2,
  coverage: 0.2,
};

// Score thresholds
const SCORE_THRESHOLDS = {
  excellent: 90,
  good: 75,
  fair: 60,
  poor: 40,
  critical: 0,
};

// Alert thresholds
const ALERT_THRESHOLDS = {
  overallDrop: 10, // % drop from last week
  dimensionDrop: 15, // % drop in any dimension
  criticalScore: 40, // score below this triggers alert
};

// ============================================================================
// Health Scorer Class
// ============================================================================

class HealthScorer {
  /**
   * Calculate overall health score
   */
  async calculateScore(options: CalculateOptions = {}): Promise<HealthScore> {
    const metrics = options.metrics ?? (await this.gatherMetrics());

    // Calculate each dimension
    const reliability = this.calculateReliability(metrics);
    const stability = this.calculateStability(metrics);
    const efficiency = this.calculateEfficiency(metrics);
    const coverage = this.calculateCoverage(metrics);

    const dimensions: HealthDimension[] = [
      reliability,
      stability,
      efficiency,
      coverage,
    ];

    // Calculate weighted overall score
    const overall = Math.round(
      dimensions.reduce((sum, d) => sum + d.score * d.weight, 0),
    );

    // Get historical data for comparison
    const [lastWeekScores, lastMonthScores] = await Promise.all([
      anomalyStorage.getHealthScoreHistory(7),
      anomalyStorage.getHealthScoreHistory(30),
    ]);

    const lastWeekAvg = this.calculateAverage(
      lastWeekScores.map((s) => s.overall),
    );
    const lastMonthAvg = this.calculateAverage(
      lastMonthScores.map((s) => s.overall),
    );

    // Determine trend
    const trend = this.determineTrend(overall, lastWeekScores);

    // Generate recommendations
    const recommendations = this.generateRecommendations(dimensions, metrics);

    const healthScore: HealthScore = {
      overall,
      dimensions,
      trend,
      comparedTo: {
        lastWeek: lastWeekAvg,
        lastMonth: lastMonthAvg,
      },
      recommendations,
      calculatedAt: Date.now(),
    };

    // Save to storage
    await anomalyStorage.saveHealthScore(healthScore);

    return healthScore;
  }

  /**
   * Get score history for specified days
   */
  async getScoreHistory(days: number): Promise<HealthScore[]> {
    return anomalyStorage.getHealthScoreHistory(days);
  }

  /**
   * Get the latest health score without recalculating
   */
  async getLatestScore(): Promise<HealthScore | null> {
    return anomalyStorage.getLatestHealthScore();
  }

  /**
   * Get recommendations based on current state
   */
  async getRecommendations(): Promise<string[]> {
    const latestScore = await this.getLatestScore();
    if (!latestScore) {
      return ['No health score available. Run calculateScore() first.'];
    }

    const metrics = await this.gatherMetrics();
    return this.generateRecommendations(latestScore.dimensions, metrics);
  }

  /**
   * Analyze score trends
   */
  async analyzeTrends(days = 30): Promise<ScoreTrendAnalysis> {
    const history = await this.getScoreHistory(days);
    const latest = history[0];
    const alerts: string[] = [];

    if (!latest || history.length < 2) {
      return {
        overall: { direction: 'stable', change: 0, period: `${days} days` },
        dimensions: [],
        comparison: {
          lastWeek: {
            current: 0,
            previous: 0,
            change: 0,
            changePercent: 0,
            improved: false,
          },
          lastMonth: {
            current: 0,
            previous: 0,
            change: 0,
            changePercent: 0,
            improved: false,
          },
        },
        alerts: ['Insufficient data for trend analysis'],
      };
    }

    // Overall trend
    const overallTrend = this.calculateTrend(
      history.map((s) => s.overall),
      `${days} days`,
    );

    // Dimension trends
    const dimensionTrends: DimensionTrend[] = latest.dimensions.map((dim) => {
      const dimHistory = history.map(
        (s) => s.dimensions.find((d) => d.name === dim.name)?.score ?? 0,
      );
      const trend = this.calculateTrend(dimHistory, `${days} days`);

      const isAtRisk =
        dim.score < ALERT_THRESHOLDS.criticalScore ||
        trend.change < -ALERT_THRESHOLDS.dimensionDrop;

      let riskReason: string | undefined;
      if (dim.score < ALERT_THRESHOLDS.criticalScore) {
        riskReason = `Score below critical threshold (${ALERT_THRESHOLDS.criticalScore})`;
        alerts.push(`${dim.name}: ${riskReason}`);
      } else if (trend.change < -ALERT_THRESHOLDS.dimensionDrop) {
        riskReason = `Significant decline (${trend.change.toFixed(1)}%)`;
        alerts.push(`${dim.name}: ${riskReason}`);
      }

      return {
        dimension: dim.name,
        trend,
        isAtRisk,
        riskReason,
      };
    });

    // Comparisons
    const weekAgo = history.find(
      (s) => s.calculatedAt < Date.now() - 7 * 24 * 60 * 60 * 1000,
    );
    const monthAgo = history.find(
      (s) => s.calculatedAt < Date.now() - 30 * 24 * 60 * 60 * 1000,
    );

    const lastWeekComparison = this.compareScores(
      latest.overall,
      weekAgo?.overall,
    );
    const lastMonthComparison = this.compareScores(
      latest.overall,
      monthAgo?.overall,
    );

    // Check for significant drops
    if (lastWeekComparison.changePercent < -ALERT_THRESHOLDS.overallDrop) {
      alerts.push(
        `Overall score dropped ${Math.abs(lastWeekComparison.changePercent).toFixed(1)}% from last week`,
      );
    }

    return {
      overall: overallTrend,
      dimensions: dimensionTrends,
      comparison: {
        lastWeek: lastWeekComparison,
        lastMonth: lastMonthComparison,
      },
      alerts,
    };
  }

  /**
   * Get score level description
   */
  getScoreLevel(score: number): string {
    if (score >= SCORE_THRESHOLDS.excellent) return 'excellent';
    if (score >= SCORE_THRESHOLDS.good) return 'good';
    if (score >= SCORE_THRESHOLDS.fair) return 'fair';
    if (score >= SCORE_THRESHOLDS.poor) return 'poor';
    return 'critical';
  }

  // ============================================================================
  // Private Methods - Dimension Calculations
  // ============================================================================

  private calculateReliability(metrics: MetricData): HealthDimension {
    const factors: HealthFactor[] = [];
    let score = 100;

    // Pass rate factor (most important)
    const passRate = metrics.passRate ?? 100;
    const passRateImpact =
      passRate < 95 ? 'negative' : passRate < 99 ? 'neutral' : 'positive';
    factors.push({
      name: 'Pass Rate',
      value: passRate,
      impact: passRateImpact,
    });
    score -= Math.max(0, (100 - passRate) * 2); // Double penalty for low pass rate

    // Consecutive failures factor
    const consecutiveFailures = metrics.consecutiveFailures ?? 0;
    if (consecutiveFailures > 0) {
      const failureImpact = consecutiveFailures >= 3 ? 'negative' : 'neutral';
      factors.push({
        name: 'Consecutive Failures',
        value: consecutiveFailures,
        impact: failureImpact,
      });
      score -= consecutiveFailures * 5; // 5 points per consecutive failure
    }

    // Recent anomalies factor
    const recentAnomalies = metrics.recentAnomalies ?? 0;
    if (recentAnomalies > 0) {
      const anomalyImpact = recentAnomalies >= 5 ? 'negative' : 'neutral';
      factors.push({
        name: 'Recent Anomalies',
        value: recentAnomalies,
        impact: anomalyImpact,
      });
      score -= recentAnomalies * 2;
    }

    return {
      name: 'Reliability',
      score: Math.max(0, Math.min(100, Math.round(score))),
      weight: DIMENSION_WEIGHTS.reliability,
      factors,
    };
  }

  private calculateStability(metrics: MetricData): HealthDimension {
    const factors: HealthFactor[] = [];
    let score = 100;

    // Flaky tests factor
    const flakyCount = metrics.flakyCount ?? 0;
    const totalCases = metrics.totalCases ?? 1;
    const flakyPercent = (flakyCount / totalCases) * 100;

    if (flakyCount > 0) {
      const flakyImpact =
        flakyPercent > 5
          ? 'negative'
          : flakyPercent > 2
            ? 'neutral'
            : 'positive';
      factors.push({
        name: 'Flaky Tests',
        value: flakyCount,
        impact: flakyImpact,
      });
      score -= flakyPercent * 5; // 5 points per percent flaky
    } else {
      factors.push({
        name: 'Flaky Tests',
        value: 0,
        impact: 'positive',
      });
    }

    // Duration variance factor (stability indicator)
    const durationVariance = metrics.durationVariance ?? 0;
    const variancePercent = Math.min(100, durationVariance);
    const varianceImpact =
      variancePercent > 30
        ? 'negative'
        : variancePercent > 15
          ? 'neutral'
          : 'positive';
    factors.push({
      name: 'Duration Variance',
      value: Math.round(variancePercent),
      impact: varianceImpact,
    });
    score -= variancePercent * 0.5;

    return {
      name: 'Stability',
      score: Math.max(0, Math.min(100, Math.round(score))),
      weight: DIMENSION_WEIGHTS.stability,
      factors,
    };
  }

  private calculateEfficiency(metrics: MetricData): HealthDimension {
    const factors: HealthFactor[] = [];
    let score = 100;

    // Average duration factor
    const avgDuration = metrics.avgDuration ?? 0;
    // Assume good execution time is under 1000ms, bad is over 5000ms
    let durationScore: number;
    let durationImpact: 'positive' | 'neutral' | 'negative';

    if (avgDuration <= 1000) {
      durationScore = 100;
      durationImpact = 'positive';
    } else if (avgDuration <= 3000) {
      durationScore = 80;
      durationImpact = 'neutral';
    } else if (avgDuration <= 5000) {
      durationScore = 60;
      durationImpact = 'neutral';
    } else {
      durationScore = Math.max(20, 100 - (avgDuration - 5000) / 100);
      durationImpact = 'negative';
    }

    factors.push({
      name: 'Avg Duration (ms)',
      value: Math.round(avgDuration),
      impact: durationImpact,
    });
    score = durationScore;

    // Total cases factor (efficiency at scale)
    const totalCases = metrics.totalCases ?? 0;
    const caseImpact =
      totalCases > 100 ? 'positive' : totalCases > 50 ? 'neutral' : 'negative';
    factors.push({
      name: 'Total Test Cases',
      value: totalCases,
      impact: caseImpact,
    });
    // Slight boost for having more tests
    if (totalCases > 100) {
      score = Math.min(100, score + 5);
    }

    return {
      name: 'Efficiency',
      score: Math.max(0, Math.min(100, Math.round(score))),
      weight: DIMENSION_WEIGHTS.efficiency,
      factors,
    };
  }

  private calculateCoverage(metrics: MetricData): HealthDimension {
    const factors: HealthFactor[] = [];
    let score = 100;

    const totalCases = metrics.totalCases ?? 0;
    const coveredCases = metrics.coveredCases ?? 0;

    // Coverage percentage
    const coveragePercent =
      totalCases > 0 ? (coveredCases / totalCases) * 100 : 0;
    const coverageImpact =
      coveragePercent >= 80
        ? 'positive'
        : coveragePercent >= 60
          ? 'neutral'
          : 'negative';

    factors.push({
      name: 'Coverage %',
      value: Math.round(coveragePercent),
      impact: coverageImpact,
    });

    score = coveragePercent;

    // Bonus for high coverage
    if (coveragePercent >= 95) {
      factors.push({
        name: 'High Coverage Bonus',
        value: 5,
        impact: 'positive',
      });
      score = Math.min(100, score + 5);
    }

    return {
      name: 'Coverage',
      score: Math.max(0, Math.min(100, Math.round(score))),
      weight: DIMENSION_WEIGHTS.coverage,
      factors,
    };
  }

  // ============================================================================
  // Private Methods - Helpers
  // ============================================================================

  private async gatherMetrics(): Promise<MetricData> {
    // Gather metrics from storage
    const [anomalies, baselines] = await Promise.all([
      anomalyStorage.getActive(),
      anomalyStorage.getAllBaselines(),
    ]);

    // Calculate metrics from available data
    const passRateBaseline = baselines.find((b) =>
      b.metricName.includes('passRate'),
    );
    const durationBaseline = baselines.find((b) =>
      b.metricName.includes('duration'),
    );

    return {
      passRate: passRateBaseline?.baseline.mean ?? 95,
      avgDuration: durationBaseline?.baseline.mean ?? 1000,
      durationVariance: durationBaseline?.baseline.stdDev ?? 10,
      consecutiveFailures: this.countConsecutiveFailures(anomalies),
      flakyCount: anomalies.filter((a) => a.type === 'flaky_detected').length,
      totalCases: this.estimateTotalCases(baselines),
      coveredCases: this.estimateCoveredCases(baselines),
      recentAnomalies: anomalies.length,
    };
  }

  private countConsecutiveFailures(anomalies: Anomaly[]): number {
    const consecutiveAnomalies = anomalies.filter(
      (a) => a.type === 'consecutive_failures',
    );
    if (consecutiveAnomalies.length === 0) return 0;

    // Get max from metric values
    return Math.max(...consecutiveAnomalies.map((a) => a.metric.currentValue));
  }

  private estimateTotalCases(
    baselines: Array<{ metricName: string; baseline: BaselineInfo }>,
  ): number {
    // Estimate from unique case prefixes in baselines
    const caseIds = new Set<string>();
    for (const b of baselines) {
      const parts = b.metricName.split(':');
      if (parts.length >= 2) {
        caseIds.add(parts[0]);
      }
    }
    return Math.max(caseIds.size, 10); // Minimum 10 for reasonable scoring
  }

  private estimateCoveredCases(
    baselines: Array<{ metricName: string; baseline: BaselineInfo }>,
  ): number {
    // Cases with baselines are considered "covered"
    const caseIds = new Set<string>();
    for (const b of baselines) {
      const parts = b.metricName.split(':');
      if (parts.length >= 2) {
        caseIds.add(parts[0]);
      }
    }
    return caseIds.size;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  }

  private determineTrend(
    current: number,
    history: HealthScore[],
  ): TrendDirection {
    if (history.length < 2) return 'stable';

    const recent = history.slice(0, 3).map((s) => s.overall);
    const avgRecent = this.calculateAverage(recent);

    const diff = current - avgRecent;
    if (diff > 5) return 'improving';
    if (diff < -5) return 'degrading';
    return 'stable';
  }

  private calculateTrend(values: number[], period: string): ScoreTrend {
    if (values.length < 2) {
      return { direction: 'stable', change: 0, period };
    }

    const current = values[0];
    const previous = values[values.length - 1];
    const change = previous !== 0 ? ((current - previous) / previous) * 100 : 0;

    let direction: TrendDirection;
    if (change > 5) direction = 'improving';
    else if (change < -5) direction = 'degrading';
    else direction = 'stable';

    return { direction, change, period };
  }

  private compareScores(current: number, previous?: number): ScoreComparison {
    const prev = previous ?? 0;
    const change = current - prev;
    const changePercent = prev !== 0 ? (change / prev) * 100 : 0;

    return {
      current,
      previous: prev,
      change,
      changePercent,
      improved: change > 0,
    };
  }

  private generateRecommendations(
    dimensions: HealthDimension[],
    metrics: MetricData,
  ): string[] {
    const recommendations: string[] = [];

    // Check each dimension
    for (const dim of dimensions) {
      if (dim.score < SCORE_THRESHOLDS.fair) {
        recommendations.push(...this.getDimensionRecommendations(dim, metrics));
      }
    }

    // General recommendations based on overall state
    const overallScore = dimensions.reduce(
      (sum, d) => sum + d.score * d.weight,
      0,
    );

    if (overallScore < SCORE_THRESHOLDS.poor) {
      recommendations.push(
        'Critical: Overall health score is very low. Prioritize fixing failing tests.',
      );
    }

    if (metrics.consecutiveFailures && metrics.consecutiveFailures >= 3) {
      recommendations.push(
        'High Priority: Multiple consecutive failures detected. Investigate root cause immediately.',
      );
    }

    if (metrics.flakyCount && metrics.flakyCount > 5) {
      recommendations.push(
        'Address flaky tests to improve test reliability and team confidence.',
      );
    }

    // Limit recommendations
    return recommendations.slice(0, 5);
  }

  private getDimensionRecommendations(
    dimension: HealthDimension,
    metrics: MetricData,
  ): string[] {
    const recs: string[] = [];

    switch (dimension.name) {
      case 'Reliability':
        if ((metrics.passRate ?? 100) < 95) {
          recs.push(
            `Improve pass rate from ${metrics.passRate?.toFixed(1)}% to at least 95%.`,
          );
        }
        if ((metrics.consecutiveFailures ?? 0) > 0) {
          recs.push('Fix consecutive failures to restore test reliability.');
        }
        break;

      case 'Stability':
        if ((metrics.flakyCount ?? 0) > 0) {
          recs.push(
            `Reduce flaky tests (currently ${metrics.flakyCount}) by adding proper waits and retries.`,
          );
        }
        if ((metrics.durationVariance ?? 0) > 30) {
          recs.push(
            'Investigate high duration variance - tests may have timing issues.',
          );
        }
        break;

      case 'Efficiency':
        if ((metrics.avgDuration ?? 0) > 3000) {
          recs.push(
            `Optimize test execution time (avg ${(metrics.avgDuration! / 1000).toFixed(1)}s is above target).`,
          );
        }
        break;

      case 'Coverage':
        const coveragePercent =
          metrics.totalCases && metrics.coveredCases
            ? (metrics.coveredCases / metrics.totalCases) * 100
            : 0;
        if (coveragePercent < 80) {
          recs.push(
            `Increase test coverage from ${coveragePercent.toFixed(0)}% to at least 80%.`,
          );
        }
        break;
    }

    return recs;
  }
}

// Export singleton instance
export const healthScorer = new HealthScorer();
