/**
 * input: Time series data points
 * output: Seasonal patterns and adjustment coefficients
 * pos: Seasonality detection for baseline adjustment
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type { SeasonalPattern, SeasonalityConfig } from '../../types/anomaly';
import { type DataPoint, calculateStats } from './dataPreprocessor';

// ============================================================================
// Types
// ============================================================================

export interface SeasonalAnalysisResult {
  hasSeasonality: boolean;
  patterns: SeasonalPattern[];
  confidence: number;
  dominantPeriod: 'daily' | 'weekly' | 'monthly' | 'none';
}

export interface CycleInfo {
  period: number; // Period in milliseconds
  strength: number; // 0-1, how strong the cycle is
  type: 'daily' | 'weekly' | 'monthly';
}

// ============================================================================
// Constants
// ============================================================================

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_MONTH = 30 * MS_PER_DAY; // Approximate

// Day names for weekly patterns
const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// Hour buckets for daily patterns
const HOUR_BUCKETS = ['night', 'morning', 'afternoon', 'evening']; // 0-5, 6-11, 12-17, 18-23

// ============================================================================
// Seasonality Analyzer Class
// ============================================================================

class SeasonalityAnalyzer {
  /**
   * Analyze time series data for seasonal patterns
   */
  analyze(data: DataPoint[], minDataPoints = 14): SeasonalAnalysisResult {
    if (data.length < minDataPoints) {
      return {
        hasSeasonality: false,
        patterns: [],
        confidence: 0,
        dominantPeriod: 'none',
      };
    }

    const patterns: SeasonalPattern[] = [];
    let maxStrength = 0;
    let dominantPeriod: 'daily' | 'weekly' | 'monthly' | 'none' = 'none';

    // Check for daily pattern (need at least 3 days of data)
    const dataSpan = data[data.length - 1].timestamp - data[0].timestamp;

    if (dataSpan >= 3 * MS_PER_DAY) {
      const dailyPattern = this.detectDailyPattern(data);
      if (dailyPattern.strength > 0.3) {
        patterns.push({
          type: 'daily',
          adjustments: dailyPattern.adjustments,
        });
        if (dailyPattern.strength > maxStrength) {
          maxStrength = dailyPattern.strength;
          dominantPeriod = 'daily';
        }
      }
    }

    // Check for weekly pattern (need at least 3 weeks of data)
    if (dataSpan >= 3 * MS_PER_WEEK) {
      const weeklyPattern = this.detectWeeklyPattern(data);
      if (weeklyPattern.strength > 0.3) {
        patterns.push({
          type: 'weekly',
          adjustments: weeklyPattern.adjustments,
        });
        if (weeklyPattern.strength > maxStrength) {
          maxStrength = weeklyPattern.strength;
          dominantPeriod = 'weekly';
        }
      }
    }

    // Check for monthly pattern (need at least 3 months of data)
    if (dataSpan >= 3 * MS_PER_MONTH) {
      const monthlyPattern = this.detectMonthlyPattern(data);
      if (monthlyPattern.strength > 0.3) {
        patterns.push({
          type: 'monthly',
          adjustments: monthlyPattern.adjustments,
        });
        if (monthlyPattern.strength > maxStrength) {
          maxStrength = monthlyPattern.strength;
          dominantPeriod = 'monthly';
        }
      }
    }

    return {
      hasSeasonality: patterns.length > 0,
      patterns,
      confidence: maxStrength,
      dominantPeriod,
    };
  }

  /**
   * Detect daily pattern (by hour buckets)
   */
  detectDailyPattern(data: DataPoint[]): {
    adjustments: Record<string, number>;
    strength: number;
  } {
    const bucketValues: Record<string, number[]> = {
      night: [],
      morning: [],
      afternoon: [],
      evening: [],
    };

    // Group values by hour bucket
    for (const point of data) {
      const date = new Date(point.timestamp);
      const hour = date.getHours();
      let bucket: string;

      if (hour >= 0 && hour < 6) bucket = 'night';
      else if (hour >= 6 && hour < 12) bucket = 'morning';
      else if (hour >= 12 && hour < 18) bucket = 'afternoon';
      else bucket = 'evening';

      bucketValues[bucket].push(point.value);
    }

    // Calculate overall mean
    const allValues = data.map((d) => d.value);
    const overallMean =
      allValues.reduce((sum, v) => sum + v, 0) / allValues.length;

    // Calculate adjustments and strength
    const adjustments: Record<string, number> = {};
    let variance = 0;
    let count = 0;

    for (const bucket of HOUR_BUCKETS) {
      if (bucketValues[bucket].length > 0) {
        const bucketMean =
          bucketValues[bucket].reduce((sum, v) => sum + v, 0) /
          bucketValues[bucket].length;
        adjustments[bucket] = overallMean !== 0 ? bucketMean / overallMean : 1;
        variance += Math.pow(adjustments[bucket] - 1, 2);
        count++;
      } else {
        adjustments[bucket] = 1;
      }
    }

    // Strength based on variance in adjustments
    const strength =
      count > 1 ? Math.min(1, Math.sqrt(variance / count) * 2) : 0;

    return { adjustments, strength };
  }

  /**
   * Detect weekly pattern (by day of week)
   */
  detectWeeklyPattern(data: DataPoint[]): {
    adjustments: Record<string, number>;
    strength: number;
  } {
    const dayValues: Record<string, number[]> = {};
    for (const day of DAY_NAMES) {
      dayValues[day] = [];
    }

    // Group values by day of week
    for (const point of data) {
      const date = new Date(point.timestamp);
      const dayIndex = date.getDay();
      dayValues[DAY_NAMES[dayIndex]].push(point.value);
    }

    // Calculate overall mean
    const allValues = data.map((d) => d.value);
    const overallMean =
      allValues.reduce((sum, v) => sum + v, 0) / allValues.length;

    // Calculate adjustments and strength
    const adjustments: Record<string, number> = {};
    let variance = 0;
    let count = 0;

    for (const day of DAY_NAMES) {
      if (dayValues[day].length > 0) {
        const dayMean =
          dayValues[day].reduce((sum, v) => sum + v, 0) / dayValues[day].length;
        adjustments[day] = overallMean !== 0 ? dayMean / overallMean : 1;
        variance += Math.pow(adjustments[day] - 1, 2);
        count++;
      } else {
        adjustments[day] = 1;
      }
    }

    // Strength based on variance in adjustments
    const strength =
      count > 1 ? Math.min(1, Math.sqrt(variance / count) * 2) : 0;

    return { adjustments, strength };
  }

  /**
   * Detect monthly pattern (by week of month)
   */
  detectMonthlyPattern(data: DataPoint[]): {
    adjustments: Record<string, number>;
    strength: number;
  } {
    const weekValues: Record<string, number[]> = {
      week1: [],
      week2: [],
      week3: [],
      week4: [],
      week5: [],
    };

    // Group values by week of month
    for (const point of data) {
      const date = new Date(point.timestamp);
      const dayOfMonth = date.getDate();
      let weekKey: string;

      if (dayOfMonth <= 7) weekKey = 'week1';
      else if (dayOfMonth <= 14) weekKey = 'week2';
      else if (dayOfMonth <= 21) weekKey = 'week3';
      else if (dayOfMonth <= 28) weekKey = 'week4';
      else weekKey = 'week5';

      weekValues[weekKey].push(point.value);
    }

    // Calculate overall mean
    const allValues = data.map((d) => d.value);
    const overallMean =
      allValues.reduce((sum, v) => sum + v, 0) / allValues.length;

    // Calculate adjustments and strength
    const adjustments: Record<string, number> = {};
    let variance = 0;
    let count = 0;

    for (const week of ['week1', 'week2', 'week3', 'week4', 'week5']) {
      if (weekValues[week].length > 0) {
        const weekMean =
          weekValues[week].reduce((sum, v) => sum + v, 0) /
          weekValues[week].length;
        adjustments[week] = overallMean !== 0 ? weekMean / overallMean : 1;
        variance += Math.pow(adjustments[week] - 1, 2);
        count++;
      } else {
        adjustments[week] = 1;
      }
    }

    // Strength based on variance in adjustments
    const strength =
      count > 1 ? Math.min(1, Math.sqrt(variance / count) * 2) : 0;

    return { adjustments, strength };
  }

  /**
   * Get seasonal adjustment factor for a specific timestamp
   */
  getAdjustment(timestamp: number, config: SeasonalityConfig): number {
    if (!config.enabled || config.patterns.length === 0) {
      return 1;
    }

    let totalAdjustment = 1;

    for (const pattern of config.patterns) {
      const key = this.getPatternKey(timestamp, pattern.type);
      const adjustment = pattern.adjustments[key] ?? 1;
      totalAdjustment *= adjustment;
    }

    return totalAdjustment;
  }

  /**
   * Get the pattern key for a timestamp
   */
  private getPatternKey(
    timestamp: number,
    type: 'daily' | 'weekly' | 'monthly',
  ): string {
    const date = new Date(timestamp);

    switch (type) {
      case 'daily': {
        const hour = date.getHours();
        if (hour >= 0 && hour < 6) return 'night';
        if (hour >= 6 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 18) return 'afternoon';
        return 'evening';
      }
      case 'weekly': {
        return DAY_NAMES[date.getDay()];
      }
      case 'monthly': {
        const dayOfMonth = date.getDate();
        if (dayOfMonth <= 7) return 'week1';
        if (dayOfMonth <= 14) return 'week2';
        if (dayOfMonth <= 21) return 'week3';
        if (dayOfMonth <= 28) return 'week4';
        return 'week5';
      }
    }
  }

  /**
   * Adjust a value for seasonality (deseasonalize)
   */
  deseasonalize(
    value: number,
    timestamp: number,
    config: SeasonalityConfig,
  ): number {
    const adjustment = this.getAdjustment(timestamp, config);
    return adjustment !== 0 ? value / adjustment : value;
  }

  /**
   * Restore seasonality to a value (reseasonalize)
   */
  reseasonalize(
    value: number,
    timestamp: number,
    config: SeasonalityConfig,
  ): number {
    const adjustment = this.getAdjustment(timestamp, config);
    return value * adjustment;
  }

  /**
   * Detect autocorrelation at different lags
   */
  detectAutocorrelation(
    data: DataPoint[],
    maxLag = 30,
  ): { lag: number; correlation: number }[] {
    if (data.length < maxLag + 10) {
      return [];
    }

    const values = data.map((d) => d.value);
    const stats = calculateStats(values);
    const results: { lag: number; correlation: number }[] = [];

    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      let count = 0;

      for (let i = 0; i < values.length - lag; i++) {
        sum += (values[i] - stats.mean) * (values[i + lag] - stats.mean);
        count++;
      }

      const correlation =
        stats.stdDev !== 0 ? sum / (count * stats.stdDev * stats.stdDev) : 0;
      results.push({ lag, correlation });
    }

    return results;
  }

  /**
   * Find dominant cycle period using autocorrelation
   */
  findDominantCycle(data: DataPoint[]): CycleInfo | null {
    const autocorr = this.detectAutocorrelation(data, 60);
    if (autocorr.length === 0) return null;

    // Find peaks in autocorrelation
    const peaks: { lag: number; correlation: number }[] = [];
    for (let i = 1; i < autocorr.length - 1; i++) {
      if (
        autocorr[i].correlation > autocorr[i - 1].correlation &&
        autocorr[i].correlation > autocorr[i + 1].correlation &&
        autocorr[i].correlation > 0.3
      ) {
        peaks.push(autocorr[i]);
      }
    }

    if (peaks.length === 0) return null;

    // Get the strongest peak
    const strongestPeak = peaks.reduce(
      (max, p) => (p.correlation > max.correlation ? p : max),
      peaks[0],
    );

    // Determine cycle type based on lag
    let type: 'daily' | 'weekly' | 'monthly';
    if (strongestPeak.lag <= 7) {
      type = 'daily';
    } else if (strongestPeak.lag <= 14) {
      type = 'weekly';
    } else {
      type = 'monthly';
    }

    // Estimate period in milliseconds
    const avgInterval =
      data.length > 1
        ? (data[data.length - 1].timestamp - data[0].timestamp) /
          (data.length - 1)
        : MS_PER_DAY;
    const period = strongestPeak.lag * avgInterval;

    return {
      period,
      strength: strongestPeak.correlation,
      type,
    };
  }

  /**
   * Build seasonality config from analysis
   */
  buildConfig(analysisResult: SeasonalAnalysisResult): SeasonalityConfig {
    return {
      enabled: analysisResult.hasSeasonality,
      patterns: analysisResult.patterns,
    };
  }

  /**
   * Check if today is a holiday (simplified - extend with real holiday data)
   */
  isHoliday(timestamp: number): boolean {
    const date = new Date(timestamp);
    const month = date.getMonth();
    const day = date.getDate();

    // Very simplified holiday detection (US-centric)
    // New Year's Day
    if (month === 0 && day === 1) return true;
    // Independence Day
    if (month === 6 && day === 4) return true;
    // Christmas
    if (month === 11 && day === 25) return true;

    return false;
  }

  /**
   * Get holiday adjustment factor
   */
  getHolidayAdjustment(timestamp: number, normalHolidayFactor = 0.5): number {
    return this.isHoliday(timestamp) ? normalHolidayFactor : 1;
  }
}

// Export singleton instance
export const seasonalityAnalyzer = new SeasonalityAnalyzer();
