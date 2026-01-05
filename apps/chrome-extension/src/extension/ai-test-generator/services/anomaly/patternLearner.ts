/**
 * input: Historical execution data, anomalies, metrics
 * output: Learned patterns with confidence scores
 * pos: Core pattern learning and recognition engine
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type { PatternType, LearnedPattern, Anomaly } from '../../types/anomaly';
import { anomalyStorage } from './storage';

// ============================================================================
// Types
// ============================================================================

export interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface PatternFeatures {
  // Time-based features
  hourOfDay?: number[];
  dayOfWeek?: number[];
  period?: number; // Period length in milliseconds

  // Value-based features
  threshold?: number;
  direction?: 'up' | 'down' | 'both';
  magnitude?: number;

  // Sequence features
  sequence?: number[];
  duration?: number;

  // Context features
  relatedCaseIds?: string[];
  preconditions?: string[];
}

export interface PatternMatch {
  pattern: LearnedPattern;
  similarity: number;
  matchedFeatures: string[];
  confidence: number;
}

export interface LearnOptions {
  minOccurrences?: number;
  minConfidence?: number;
  maxPatterns?: number;
  expirationDays?: number;
}

export interface RecognitionResult {
  type: PatternType;
  confidence: number;
  description: string;
  evidence: string[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LEARN_OPTIONS: LearnOptions = {
  minOccurrences: 3,
  minConfidence: 50,
  maxPatterns: 100,
  expirationDays: 90,
};

const PATTERN_EXPIRATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// ============================================================================
// Pattern Learner Class
// ============================================================================

class PatternLearner {
  private patterns: Map<string, LearnedPattern> = new Map();
  private initialized = false;

  /**
   * Initialize pattern learner by loading stored patterns
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const storedPatterns = await anomalyStorage.getAllPatterns();
    for (const pattern of storedPatterns) {
      this.patterns.set(pattern.id, pattern);
    }

    // Clean up expired patterns
    await this.cleanupExpiredPatterns();

    this.initialized = true;
  }

  /**
   * Learn patterns from historical data
   */
  async learnPatterns(
    data: DataPoint[],
    options: LearnOptions = {}
  ): Promise<LearnedPattern[]> {
    await this.initialize();

    const opts = { ...DEFAULT_LEARN_OPTIONS, ...options };
    const learnedPatterns: LearnedPattern[] = [];

    if (data.length < 10) {
      return learnedPatterns;
    }

    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

    // Detect different pattern types
    const periodicPattern = this.detectPeriodicPattern(sortedData);
    if (periodicPattern && periodicPattern.confidence >= (opts.minConfidence ?? 50)) {
      learnedPatterns.push(periodicPattern);
    }

    const suddenPatterns = this.detectSuddenPatterns(sortedData);
    learnedPatterns.push(
      ...suddenPatterns.filter((p) => p.confidence >= (opts.minConfidence ?? 50))
    );

    const gradualPatterns = this.detectGradualPatterns(sortedData);
    learnedPatterns.push(
      ...gradualPatterns.filter((p) => p.confidence >= (opts.minConfidence ?? 50))
    );

    const seasonalPattern = this.detectSeasonalPattern(sortedData);
    if (seasonalPattern && seasonalPattern.confidence >= (opts.minConfidence ?? 50)) {
      learnedPatterns.push(seasonalPattern);
    }

    // Save learned patterns
    for (const pattern of learnedPatterns) {
      await this.savePattern(pattern);
    }

    return learnedPatterns;
  }

  /**
   * Match current data against known patterns
   */
  async matchPattern(currentData: DataPoint[]): Promise<PatternMatch[]> {
    await this.initialize();

    if (currentData.length < 5) {
      return [];
    }

    const matches: PatternMatch[] = [];

    for (const pattern of this.patterns.values()) {
      const match = this.calculatePatternMatch(pattern, currentData);
      if (match.similarity > 0.5) {
        matches.push(match);
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Update patterns with new observations
   */
  async updatePatterns(
    patternId: string,
    observation: { matched: boolean; feedback?: 'positive' | 'negative' }
  ): Promise<void> {
    await this.initialize();

    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    // Update occurrence count
    if (observation.matched) {
      pattern.occurrences++;
      pattern.lastSeen = Date.now();
    }

    // Adjust confidence based on feedback
    if (observation.feedback === 'positive') {
      pattern.confidence = Math.min(100, pattern.confidence + 5);
    } else if (observation.feedback === 'negative') {
      pattern.confidence = Math.max(0, pattern.confidence - 10);
    }

    // Save updated pattern
    await this.savePattern(pattern);
  }

  /**
   * Get all learned patterns
   */
  async getPatterns(type?: PatternType): Promise<LearnedPattern[]> {
    await this.initialize();

    const patterns = Array.from(this.patterns.values());

    if (type) {
      return patterns.filter((p) => p.type === type);
    }

    return patterns;
  }

  /**
   * Delete a pattern
   */
  async deletePattern(patternId: string): Promise<void> {
    this.patterns.delete(patternId);
    await anomalyStorage.deletePattern(patternId);
  }

  /**
   * Learn from anomaly history
   */
  async learnFromAnomalies(anomalies: Anomaly[]): Promise<LearnedPattern[]> {
    await this.initialize();

    const learnedPatterns: LearnedPattern[] = [];

    // Group anomalies by type and time proximity
    const groups = this.groupAnomaliesByPattern(anomalies);

    for (const [key, group] of groups) {
      if (group.length >= 3) {
        const pattern = this.createPatternFromAnomalies(key, group);
        learnedPatterns.push(pattern);
        await this.savePattern(pattern);
      }
    }

    return learnedPatterns;
  }

  /**
   * Recognize pattern type from data
   */
  recognizePatternType(data: DataPoint[]): RecognitionResult {
    if (data.length < 5) {
      return {
        type: 'gradual',
        confidence: 0,
        description: 'Insufficient data for pattern recognition',
        evidence: [],
      };
    }

    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

    // Check for each pattern type
    const periodicCheck = this.checkPeriodicPattern(sortedData);
    const suddenCheck = this.checkSuddenPattern(sortedData);
    const gradualCheck = this.checkGradualPattern(sortedData);
    const seasonalCheck = this.checkSeasonalPattern(sortedData);

    // Return the most confident result
    const results = [periodicCheck, suddenCheck, gradualCheck, seasonalCheck];
    results.sort((a, b) => b.confidence - a.confidence);

    return results[0];
  }

  // ============================================================================
  // Private Methods - Pattern Detection
  // ============================================================================

  /**
   * Detect periodic patterns using autocorrelation
   */
  private detectPeriodicPattern(data: DataPoint[]): LearnedPattern | null {
    if (data.length < 20) return null;

    const values = data.map((d) => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const centered = values.map((v) => v - mean);

    // Calculate autocorrelation for different lags
    const maxLag = Math.floor(data.length / 2);
    const autocorrelations: { lag: number; correlation: number }[] = [];

    for (let lag = 2; lag <= maxLag; lag++) {
      let correlation = 0;
      let denom = 0;

      for (let i = 0; i < centered.length - lag; i++) {
        correlation += centered[i] * centered[i + lag];
      }

      for (let i = 0; i < centered.length; i++) {
        denom += centered[i] ** 2;
      }

      if (denom > 0) {
        autocorrelations.push({ lag, correlation: correlation / denom });
      }
    }

    // Find peak autocorrelation
    const peaks = autocorrelations
      .filter((a) => a.correlation > 0.3)
      .sort((a, b) => b.correlation - a.correlation);

    if (peaks.length === 0) return null;

    const bestPeak = peaks[0];
    const avgInterval =
      data.length > 1
        ? (data[data.length - 1].timestamp - data[0].timestamp) / (data.length - 1)
        : 0;
    const period = bestPeak.lag * avgInterval;

    return {
      id: `periodic_${Date.now()}`,
      type: 'periodic',
      description: `Periodic pattern with cycle of ${Math.round(period / 3600000)}h`,
      confidence: Math.round(bestPeak.correlation * 100),
      occurrences: Math.floor(data.length / bestPeak.lag),
      lastSeen: Date.now(),
      features: {
        period,
        lag: bestPeak.lag,
        correlation: bestPeak.correlation,
      },
    };
  }

  /**
   * Detect sudden change patterns (spikes and drops)
   */
  private detectSuddenPatterns(data: DataPoint[]): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];
    const values = data.map((d) => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    );

    if (stdDev === 0) return patterns;

    // Find sudden changes (> 2 std dev from previous value)
    const suddenChanges: { index: number; magnitude: number; direction: 'up' | 'down' }[] = [];

    for (let i = 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      if (Math.abs(change) > 2 * stdDev) {
        suddenChanges.push({
          index: i,
          magnitude: Math.abs(change),
          direction: change > 0 ? 'up' : 'down',
        });
      }
    }

    // Group consecutive sudden changes
    if (suddenChanges.length >= 2) {
      const avgMagnitude =
        suddenChanges.reduce((sum, c) => sum + c.magnitude, 0) / suddenChanges.length;
      const directions = new Set(suddenChanges.map((c) => c.direction));

      patterns.push({
        id: `sudden_${Date.now()}`,
        type: 'sudden',
        description: `Sudden ${directions.size === 1 ? directions.values().next().value : 'bidirectional'} changes detected`,
        confidence: Math.min(90, 50 + suddenChanges.length * 5),
        occurrences: suddenChanges.length,
        lastSeen: Date.now(),
        features: {
          avgMagnitude,
          direction: directions.size === 1 ? suddenChanges[0].direction : 'both',
          threshold: 2 * stdDev,
        },
      });
    }

    return patterns;
  }

  /**
   * Detect gradual trend patterns
   */
  private detectGradualPatterns(data: DataPoint[]): LearnedPattern[] {
    const patterns: LearnedPattern[] = [];
    if (data.length < 10) return patterns;

    const values = data.map((d) => d.value);

    // Calculate linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + v * i, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    let ssTot = 0;
    let ssRes = 0;

    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      ssTot += (values[i] - yMean) ** 2;
      ssRes += (values[i] - predicted) ** 2;
    }

    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // Only consider strong trends
    if (r2 > 0.5 && Math.abs(slope) > 0.01) {
      const direction = slope > 0 ? 'up' : 'down';
      const duration = data[data.length - 1].timestamp - data[0].timestamp;

      patterns.push({
        id: `gradual_${Date.now()}`,
        type: 'gradual',
        description: `Gradual ${direction}ward trend with R²=${r2.toFixed(2)}`,
        confidence: Math.round(r2 * 100),
        occurrences: 1,
        lastSeen: Date.now(),
        features: {
          slope,
          r2,
          direction,
          duration,
        },
      });
    }

    return patterns;
  }

  /**
   * Detect seasonal patterns (day of week, time of day)
   */
  private detectSeasonalPattern(data: DataPoint[]): LearnedPattern | null {
    if (data.length < 30) return null;

    // Group by hour of day
    const hourlyAvg = new Map<number, { sum: number; count: number }>();
    for (const d of data) {
      const hour = new Date(d.timestamp).getHours();
      const existing = hourlyAvg.get(hour) ?? { sum: 0, count: 0 };
      existing.sum += d.value;
      existing.count++;
      hourlyAvg.set(hour, existing);
    }

    // Group by day of week
    const dailyAvg = new Map<number, { sum: number; count: number }>();
    for (const d of data) {
      const day = new Date(d.timestamp).getDay();
      const existing = dailyAvg.get(day) ?? { sum: 0, count: 0 };
      existing.sum += d.value;
      existing.count++;
      dailyAvg.set(day, existing);
    }

    // Calculate variance between groups
    const overallMean = data.reduce((sum, d) => sum + d.value, 0) / data.length;

    // Hour variance
    let hourVariance = 0;
    for (const [, avg] of hourlyAvg) {
      const groupMean = avg.sum / avg.count;
      hourVariance += (groupMean - overallMean) ** 2;
    }
    hourVariance /= hourlyAvg.size;

    // Day variance
    let dayVariance = 0;
    for (const [, avg] of dailyAvg) {
      const groupMean = avg.sum / avg.count;
      dayVariance += (groupMean - overallMean) ** 2;
    }
    dayVariance /= dailyAvg.size;

    // Overall variance
    const overallVariance =
      data.reduce((sum, d) => sum + (d.value - overallMean) ** 2, 0) / data.length;

    if (overallVariance === 0) return null;

    // Check if group variance is significant
    const hourEffect = hourVariance / overallVariance;
    const dayEffect = dayVariance / overallVariance;

    if (hourEffect > 0.1 || dayEffect > 0.1) {
      const peakHours: number[] = [];
      const peakDays: number[] = [];

      // Find peak hours
      for (const [hour, avg] of hourlyAvg) {
        if (avg.sum / avg.count > overallMean * 1.2) {
          peakHours.push(hour);
        }
      }

      // Find peak days
      for (const [day, avg] of dailyAvg) {
        if (avg.sum / avg.count > overallMean * 1.2) {
          peakDays.push(day);
        }
      }

      const confidence = Math.round(Math.max(hourEffect, dayEffect) * 100);

      return {
        id: `seasonal_${Date.now()}`,
        type: 'seasonal',
        description: `Seasonal pattern: peaks at ${peakHours.length > 0 ? `hours ${peakHours.join(',')}` : 'no specific hours'}${peakDays.length > 0 ? `, days ${peakDays.join(',')}` : ''}`,
        confidence,
        occurrences: 1,
        lastSeen: Date.now(),
        features: {
          hourOfDay: peakHours,
          dayOfWeek: peakDays,
          hourEffect,
          dayEffect,
        },
      };
    }

    return null;
  }

  // ============================================================================
  // Private Methods - Pattern Recognition
  // ============================================================================

  private checkPeriodicPattern(data: DataPoint[]): RecognitionResult {
    const pattern = this.detectPeriodicPattern(data);
    if (pattern) {
      return {
        type: 'periodic',
        confidence: pattern.confidence,
        description: pattern.description,
        evidence: [`Autocorrelation peak at lag ${(pattern.features as PatternFeatures).lag}`],
      };
    }
    return { type: 'periodic', confidence: 0, description: 'No periodic pattern', evidence: [] };
  }

  private checkSuddenPattern(data: DataPoint[]): RecognitionResult {
    const patterns = this.detectSuddenPatterns(data);
    if (patterns.length > 0) {
      const best = patterns[0];
      return {
        type: 'sudden',
        confidence: best.confidence,
        description: best.description,
        evidence: [`${best.occurrences} sudden changes detected`],
      };
    }
    return { type: 'sudden', confidence: 0, description: 'No sudden changes', evidence: [] };
  }

  private checkGradualPattern(data: DataPoint[]): RecognitionResult {
    const patterns = this.detectGradualPatterns(data);
    if (patterns.length > 0) {
      const best = patterns[0];
      return {
        type: 'gradual',
        confidence: best.confidence,
        description: best.description,
        evidence: [`R² = ${((best.features as PatternFeatures & { r2: number }).r2 ?? 0).toFixed(3)}`],
      };
    }
    return { type: 'gradual', confidence: 0, description: 'No gradual trend', evidence: [] };
  }

  private checkSeasonalPattern(data: DataPoint[]): RecognitionResult {
    const pattern = this.detectSeasonalPattern(data);
    if (pattern) {
      return {
        type: 'seasonal',
        confidence: pattern.confidence,
        description: pattern.description,
        evidence: [
          `Hour effect: ${(((pattern.features as PatternFeatures & { hourEffect: number }).hourEffect ?? 0) * 100).toFixed(1)}%`,
          `Day effect: ${(((pattern.features as PatternFeatures & { dayEffect: number }).dayEffect ?? 0) * 100).toFixed(1)}%`,
        ],
      };
    }
    return { type: 'seasonal', confidence: 0, description: 'No seasonal pattern', evidence: [] };
  }

  // ============================================================================
  // Private Methods - Pattern Matching
  // ============================================================================

  private calculatePatternMatch(pattern: LearnedPattern, data: DataPoint[]): PatternMatch {
    const features = pattern.features as PatternFeatures;
    const matchedFeatures: string[] = [];
    let similaritySum = 0;
    let featureCount = 0;

    // Match based on pattern type
    switch (pattern.type) {
      case 'periodic': {
        const detected = this.detectPeriodicPattern(data);
        if (detected) {
          const detectedFeatures = detected.features as PatternFeatures;
          if (
            features.period &&
            detectedFeatures.period &&
            Math.abs(features.period - detectedFeatures.period) < features.period * 0.2
          ) {
            matchedFeatures.push('period');
            similaritySum += 0.8;
          }
          featureCount++;
        }
        break;
      }

      case 'sudden': {
        const detected = this.detectSuddenPatterns(data);
        if (detected.length > 0) {
          const detectedFeatures = detected[0].features as PatternFeatures;
          if (features.direction === detectedFeatures.direction) {
            matchedFeatures.push('direction');
            similaritySum += 0.6;
          }
          if (
            features.threshold &&
            detectedFeatures.threshold &&
            Math.abs(features.threshold - detectedFeatures.threshold) < features.threshold * 0.3
          ) {
            matchedFeatures.push('threshold');
            similaritySum += 0.4;
          }
          featureCount += 2;
        }
        break;
      }

      case 'gradual': {
        const detected = this.detectGradualPatterns(data);
        if (detected.length > 0) {
          const detectedFeatures = detected[0].features as PatternFeatures;
          if (features.direction === detectedFeatures.direction) {
            matchedFeatures.push('direction');
            similaritySum += 0.7;
          }
          featureCount++;
        }
        break;
      }

      case 'seasonal': {
        const detected = this.detectSeasonalPattern(data);
        if (detected) {
          const detectedFeatures = detected.features as PatternFeatures;
          if (features.hourOfDay && detectedFeatures.hourOfDay) {
            const overlap = features.hourOfDay.filter((h) =>
              detectedFeatures.hourOfDay?.includes(h)
            ).length;
            if (overlap > 0) {
              matchedFeatures.push('hourOfDay');
              similaritySum += overlap / features.hourOfDay.length;
            }
          }
          if (features.dayOfWeek && detectedFeatures.dayOfWeek) {
            const overlap = features.dayOfWeek.filter((d) =>
              detectedFeatures.dayOfWeek?.includes(d)
            ).length;
            if (overlap > 0) {
              matchedFeatures.push('dayOfWeek');
              similaritySum += overlap / features.dayOfWeek.length;
            }
          }
          featureCount += 2;
        }
        break;
      }
    }

    const similarity = featureCount > 0 ? similaritySum / featureCount : 0;
    const confidence = Math.round(similarity * pattern.confidence);

    return {
      pattern,
      similarity,
      matchedFeatures,
      confidence,
    };
  }

  // ============================================================================
  // Private Methods - Anomaly Pattern Learning
  // ============================================================================

  private groupAnomaliesByPattern(
    anomalies: Anomaly[]
  ): Map<string, Anomaly[]> {
    const groups = new Map<string, Anomaly[]>();

    for (const anomaly of anomalies) {
      // Group by type and similar characteristics
      const key = `${anomaly.type}_${anomaly.severity}_${Math.round(anomaly.deviation / 10) * 10}`;
      const existing = groups.get(key) ?? [];
      existing.push(anomaly);
      groups.set(key, existing);
    }

    return groups;
  }

  private createPatternFromAnomalies(key: string, anomalies: Anomaly[]): LearnedPattern {
    const [type, severity] = key.split('_');

    // Analyze timing patterns
    const hours = anomalies.map((a) => new Date(a.detectedAt).getHours());
    const days = anomalies.map((a) => new Date(a.detectedAt).getDay());

    // Find common hours and days
    const hourCounts = new Map<number, number>();
    const dayCounts = new Map<number, number>();

    for (const h of hours) {
      hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    }
    for (const d of days) {
      dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
    }

    const commonHours = Array.from(hourCounts.entries())
      .filter(([, count]) => count >= anomalies.length * 0.3)
      .map(([hour]) => hour);

    const commonDays = Array.from(dayCounts.entries())
      .filter(([, count]) => count >= anomalies.length * 0.3)
      .map(([day]) => day);

    return {
      id: `anomaly_${key}_${Date.now()}`,
      type: commonHours.length > 0 || commonDays.length > 0 ? 'seasonal' : 'sudden',
      description: `${type} anomalies with ${severity} severity`,
      confidence: Math.min(90, 50 + anomalies.length * 10),
      occurrences: anomalies.length,
      lastSeen: Math.max(...anomalies.map((a) => a.detectedAt)),
      features: {
        anomalyType: type,
        severity,
        hourOfDay: commonHours,
        dayOfWeek: commonDays,
        relatedCaseIds: [...new Set(anomalies.map((a) => a.caseId).filter(Boolean))],
      },
    };
  }

  // ============================================================================
  // Private Methods - Storage
  // ============================================================================

  private async savePattern(pattern: LearnedPattern): Promise<void> {
    this.patterns.set(pattern.id, pattern);
    await anomalyStorage.savePattern(pattern);
  }

  private async cleanupExpiredPatterns(): Promise<void> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, pattern] of this.patterns) {
      if (now - pattern.lastSeen > PATTERN_EXPIRATION_MS) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      this.patterns.delete(id);
      await anomalyStorage.deletePattern(id);
    }
  }
}

// Export singleton instance
export const patternLearner = new PatternLearner();
