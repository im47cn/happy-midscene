/**
 * Feedback Tracker
 * Collects and analyzes user feedback on recommendations
 */

import type {
  Feedback,
  RecommendReason,
  PriorityWeights,
} from '../../types/recommendation';

/**
 * Feedback summary statistics
 */
interface FeedbackSummary {
  total: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number;
  averageRating: number;
  byReasonType: Map<string, FeedbackStats>;
}

/**
 * Feedback stats for a specific category
 */
interface FeedbackStats {
  total: number;
  accepted: number;
  averageRating: number;
}

/**
 * Recommended weight adjustments based on feedback
 */
interface WeightAdjustment {
  weights: PriorityWeights;
  confidence: number;
  reasoning: string[];
}

/**
 * Feedback Tracker class
 */
export class FeedbackTracker {
  private feedback: Map<string, Feedback[]> = new Map();

  /**
   * Record user feedback
   */
  async recordFeedback(feedback: Feedback): Promise<void> {
    // Store feedback in memory
    // In production, this would be persisted to IndexedDB or a backend
    const caseFeedback = this.feedback.get(feedback.caseId) ?? [];
    caseFeedback.push(feedback);
    this.feedback.set(feedback.caseId, caseFeedback);

    // TODO: Persist to storage
    console.log('[FeedbackTracker] Recorded feedback:', feedback);
  }

  /**
   * Get feedback for a specific recommendation
   */
  getFeedbackForRecommendation(recommendationId: string): Feedback[] {
    const all: Feedback[] = [];
    for (const caseFeedback of this.feedback.values()) {
      for (const fb of caseFeedback) {
        if (fb.recommendationId === recommendationId) {
          all.push(fb);
        }
      }
    }
    return all;
  }

  /**
   * Get feedback for a specific case
   */
  getFeedbackForCase(caseId: string): Feedback[] {
    return this.feedback.get(caseId) ?? [];
  }

  /**
   * Get all feedback
   */
  getAllFeedback(): Feedback[] {
    const all: Feedback[] = [];
    for (const caseFeedback of this.feedback.values()) {
      all.push(...caseFeedback);
    }
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Analyze feedback data
   */
  analyzeFeedback(): FeedbackSummary {
    const all = this.getAllFeedback();

    const total = all.length;
    const accepted = all.filter((f) => f.accepted).length;
    const rejected = total - accepted;
    const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;

    const rated = all.filter((f) => f.rating !== undefined);
    const averageRating =
      rated.length > 0 ? rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length : 0;

    // Group by reason type
    const byReasonType = new Map<string, FeedbackStats>();

    for (const fb of all) {
      // We need to look at the recommendation to get the reason types
      // For now, we'll skip this or track it separately
    }

    return {
      total,
      accepted,
      rejected,
      acceptanceRate,
      averageRating,
      byReasonType,
    };
  }

  /**
   * Calculate suggested weight adjustments based on feedback
   */
  calculateWeightAdjustments(): WeightAdjustment {
    const summary = this.analyzeFeedback();

    if (summary.total < 10) {
      return {
        weights: {
          riskFactor: 0.3,
          businessValue: 0.2,
          executionCost: 0.1,
          changeImpact: 0.25,
          recency: 0.15,
        },
        confidence: 0,
        reasoning: ['数据量不足，需要更多反馈'],
      };
    }

    const reasoning: string[] = [];

    // Analyze acceptance rate to adjust weights
    const weights: PriorityWeights = {
      riskFactor: 0.3,
      businessValue: 0.2,
      executionCost: 0.1,
      changeImpact: 0.25,
      recency: 0.15,
    };

    if (summary.acceptanceRate > 70) {
      reasoning.push('推荐采纳率较高，当前权重配置良好');
    } else if (summary.acceptanceRate < 40) {
      reasoning.push('推荐采纳率较低，可能需要调整权重策略');
      // Suggest adjusting towards more reliable signals
      weights.riskFactor += 0.1;
      weights.recency += 0.05;
      weights.changeImpact -= 0.1;
      weights.businessValue -= 0.05;
    }

    // Normalize weights
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(weights) as Array<keyof PriorityWeights>) {
      weights[key] /= total;
    }

    const confidence = Math.min(1, summary.total / 100);

    return { weights, confidence, reasoning };
  }

  /**
   * Get recent feedback (last N items)
   */
  getRecentFeedback(limit = 50): Feedback[] {
    return this.getAllFeedback().slice(0, limit);
  }

  /**
   * Get feedback statistics for a specific case
   */
  getCaseStats(caseId: string): FeedbackStats | null {
    const caseFeedback = this.getFeedbackForCase(caseId);

    if (caseFeedback.length === 0) return null;

    const total = caseFeedback.length;
    const accepted = caseFeedback.filter((f) => f.accepted).length;

    const rated = caseFeedback.filter((f) => f.rating !== undefined);
    const averageRating =
      rated.length > 0 ? rated.reduce((sum, f) => sum + (f.rating ?? 0), 0) / rated.length : 0;

    return { total, accepted, averageRating };
  }

  /**
   * Clear feedback for a case
   */
  clearCaseFeedback(caseId: string): void {
    this.feedback.delete(caseId);
  }

  /**
   * Clear all feedback
   */
  clearAllFeedback(): void {
    this.feedback.clear();
  }

  /**
   * Export feedback data as JSON
   */
  exportFeedback(): string {
    const data = Array.from(this.feedback.entries());
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import feedback data from JSON
   */
  importFeedback(json: string): void {
    try {
      const data = JSON.parse(json) as Array<[string, Feedback[]]>;
      for (const [caseId, feedbackList] of data) {
        this.feedback.set(caseId, feedbackList);
      }
    } catch (error) {
      console.error('[FeedbackTracker] Failed to import feedback:', error);
      throw new Error('Invalid feedback data format');
    }
  }

  /**
   * Get feedback trends over time
   */
  getFeedbackTrends(days = 30): Array<{ date: string; acceptanceRate: number; count: number }> {
    const all = this.getAllFeedback();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const recent = all.filter((f) => f.timestamp >= cutoff);
    const byDate = new Map<string, { accepted: number; total: number }>();

    for (const fb of recent) {
      const date = new Date(fb.timestamp).toISOString().split('T')[0];
      const stats = byDate.get(date) ?? { accepted: 0, total: 0 };
      stats.total++;
      if (fb.accepted) stats.accepted++;
      byDate.set(date, stats);
    }

    return Array.from(byDate.entries())
      .map(([date, stats]) => ({
        date,
        acceptanceRate: stats.total > 0 ? (stats.accepted / stats.total) * 100 : 0,
        count: stats.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

// Export singleton instance
export const feedbackTracker = new FeedbackTracker();
