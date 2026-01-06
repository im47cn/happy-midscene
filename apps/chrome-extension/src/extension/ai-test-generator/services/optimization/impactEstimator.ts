/**
 * Impact Estimator
 * Estimates the impact of optimization recommendations
 */

import type {
  Effort,
  Impact,
  Priority,
  Recommendation,
  RecommendationType,
} from '../../types/optimization';
import type { IImpactEstimator } from './interfaces';

// Average test duration for estimation (ms)
const AVG_TEST_DURATION = 30000;

// Effort multipliers (hours)
const EFFORT_HOURS: Record<Effort, number> = {
  low: 0.5,
  medium: 2,
  high: 8,
};

// Impact coefficients by recommendation type
const IMPACT_COEFFICIENTS: Record<
  RecommendationType,
  {
    time: number;
    quality: number;
    effort: Effort;
  }
> = {
  efficiency: { time: 0.3, quality: 0.1, effort: 'medium' },
  redundancy: { time: 0.25, quality: 0.15, effort: 'low' },
  coverage: { time: 0.05, quality: 0.35, effort: 'medium' },
  stability: { time: 0.1, quality: 0.3, effort: 'high' },
  maintainability: { time: 0.15, quality: 0.25, effort: 'medium' },
  priority: { time: 0.2, quality: 0.1, effort: 'low' },
  resource: { time: 0.15, quality: 0.05, effort: 'low' },
};

class ImpactEstimator implements IImpactEstimator {
  /**
   * Estimate time savings from a recommendation
   */
  estimateTimeSaving(recommendation: Recommendation): number {
    const coefficient = IMPACT_COEFFICIENTS[recommendation.type]?.time || 0.1;

    // Base saving depends on priority and affected cases
    const priorityMultiplier = this.getPriorityMultiplier(
      recommendation.priority,
    );
    const caseCount = recommendation.relatedCases.length || 1;

    // Calculate saving per test execution
    const savingPerCase = AVG_TEST_DURATION * coefficient * priorityMultiplier;

    // Total saving across affected cases
    return Math.round(savingPerCase * caseCount);
  }

  /**
   * Estimate quality improvement from a recommendation
   */
  estimateQualityImprovement(recommendation: Recommendation): number {
    const coefficient =
      IMPACT_COEFFICIENTS[recommendation.type]?.quality || 0.1;

    const priorityMultiplier = this.getPriorityMultiplier(
      recommendation.priority,
    );

    // Quality improvement as a percentage
    const improvement = coefficient * priorityMultiplier * 100;

    return Math.round(Math.min(50, improvement)); // Cap at 50%
  }

  /**
   * Calculate ROI for implementing a recommendation
   */
  calculateROI(recommendation: Recommendation): number {
    const timeSaving = this.estimateTimeSaving(recommendation);
    const qualityImprovement = this.estimateQualityImprovement(recommendation);
    const effort = EFFORT_HOURS[recommendation.effort];

    // Time saving value (assuming 1 hour = 1000 units)
    const timeSavingValue = (timeSaving / 3600000) * 1000;

    // Quality improvement value
    const qualityValue = qualityImprovement * 10;

    // Total benefit
    const totalBenefit = timeSavingValue + qualityValue;

    // Cost (effort in hours)
    const cost = effort * 100;

    // ROI = (benefit - cost) / cost * 100
    return cost > 0 ? Math.round(((totalBenefit - cost) / cost) * 100) : 0;
  }

  /**
   * Estimate overall impact of a recommendation
   */
  estimateImpact(recommendation: Recommendation): Impact {
    const timeSaving = this.estimateTimeSaving(recommendation);
    const qualityImprovement = this.estimateQualityImprovement(recommendation);
    const roi = this.calculateROI(recommendation);

    // Generate description
    const description = this.generateImpactDescription(
      recommendation,
      timeSaving,
      qualityImprovement,
      roi,
    );

    return {
      timeReduction: timeSaving,
      qualityImprovement,
      description,
    };
  }

  /**
   * Estimate effort for a recommendation
   */
  estimateEffort(recommendation: Recommendation): Effort {
    // Use type-based default effort
    return IMPACT_COEFFICIENTS[recommendation.type]?.effort || 'medium';
  }

  /**
   * Compare recommendations by impact
   */
  compareByImpact(a: Recommendation, b: Recommendation): number {
    const roiA = this.calculateROI(a);
    const roiB = this.calculateROI(b);

    // Higher ROI first
    if (roiA !== roiB) {
      return roiB - roiA;
    }

    // Then by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  }

  /**
   * Get priority multiplier for calculations
   */
  private getPriorityMultiplier(priority: Priority): number {
    const multipliers: Record<Priority, number> = {
      critical: 2.0,
      high: 1.5,
      medium: 1.0,
      low: 0.5,
    };
    return multipliers[priority];
  }

  /**
   * Generate impact description
   */
  private generateImpactDescription(
    recommendation: Recommendation,
    timeSaving: number,
    qualityImprovement: number,
    roi: number,
  ): string {
    const parts: string[] = [];

    // Time saving
    if (timeSaving > 0) {
      const seconds = Math.round(timeSaving / 1000);
      if (seconds > 60) {
        parts.push(`节省约 ${Math.round(seconds / 60)} 分钟执行时间`);
      } else {
        parts.push(`节省约 ${seconds} 秒执行时间`);
      }
    }

    // Quality improvement
    if (qualityImprovement > 0) {
      parts.push(`提升 ${qualityImprovement}% 测试质量`);
    }

    // ROI
    if (roi > 100) {
      parts.push(`投资回报率 ${roi}%`);
    }

    return parts.length > 0 ? parts.join('，') : '改进测试套件质量';
  }

  /**
   * Estimate total impact of multiple recommendations
   */
  estimateTotalImpact(recommendations: Recommendation[]): {
    totalTimeSaving: number;
    avgQualityImprovement: number;
    avgROI: number;
  } {
    if (recommendations.length === 0) {
      return {
        totalTimeSaving: 0,
        avgQualityImprovement: 0,
        avgROI: 0,
      };
    }

    const totalTimeSaving = recommendations.reduce(
      (sum, r) => sum + this.estimateTimeSaving(r),
      0,
    );

    const avgQualityImprovement = Math.round(
      recommendations.reduce(
        (sum, r) => sum + this.estimateQualityImprovement(r),
        0,
      ) / recommendations.length,
    );

    const avgROI = Math.round(
      recommendations.reduce((sum, r) => sum + this.calculateROI(r), 0) /
        recommendations.length,
    );

    return {
      totalTimeSaving,
      avgQualityImprovement,
      avgROI,
    };
  }
}

export const impactEstimator = new ImpactEstimator();
