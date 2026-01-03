/**
 * Rating System Service
 * Manages template reviews and ratings (local storage mode)
 */

import type {
  IRatingSystem,
  TemplateReview,
} from '../types';

const STORAGE_KEY = 'marketplace:reviews';

/**
 * Rating system implementation using local storage
 * Note: In production, this would connect to a backend API
 */
export class RatingSystem implements IRatingSystem {
  /**
   * Get all reviews from storage
   */
  private getReviewsMap(): Map<string, TemplateReview[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as Record<string, TemplateReview[]>;
        return new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
    return new Map();
  }

  /**
   * Save reviews map to storage
   */
  private saveReviewsMap(map: Map<string, TemplateReview[]>): void {
    try {
      const data = Object.fromEntries(map);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save reviews:', error);
    }
  }

  /**
   * Generate a unique review ID
   */
  private generateId(): string {
    return `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Submit a new review
   */
  async submitReview(
    review: Omit<TemplateReview, 'id' | 'createdAt' | 'helpful' | 'notHelpful'>
  ): Promise<TemplateReview> {
    const map = this.getReviewsMap();
    const templateReviews = map.get(review.templateId) || [];

    // Check if user already reviewed
    const existingIndex = templateReviews.findIndex(
      (r) => r.userId === review.userId
    );

    const newReview: TemplateReview = {
      ...review,
      id: existingIndex >= 0 ? templateReviews[existingIndex].id : this.generateId(),
      helpful: existingIndex >= 0 ? templateReviews[existingIndex].helpful : 0,
      notHelpful: existingIndex >= 0 ? templateReviews[existingIndex].notHelpful : 0,
      createdAt: existingIndex >= 0 ? templateReviews[existingIndex].createdAt : Date.now(),
      updatedAt: existingIndex >= 0 ? Date.now() : undefined,
    };

    if (existingIndex >= 0) {
      templateReviews[existingIndex] = newReview;
    } else {
      templateReviews.unshift(newReview);
    }

    map.set(review.templateId, templateReviews);
    this.saveReviewsMap(map);

    return newReview;
  }

  /**
   * Vote on a review's helpfulness
   */
  async voteHelpful(reviewId: string, helpful: boolean): Promise<void> {
    const map = this.getReviewsMap();

    for (const [templateId, reviews] of map) {
      const reviewIndex = reviews.findIndex((r) => r.id === reviewId);
      if (reviewIndex >= 0) {
        if (helpful) {
          reviews[reviewIndex].helpful += 1;
        } else {
          reviews[reviewIndex].notHelpful += 1;
        }
        map.set(templateId, reviews);
        this.saveReviewsMap(map);
        return;
      }
    }
  }

  /**
   * Get a user's review for a template
   */
  async getUserReview(templateId: string, userId: string): Promise<TemplateReview | null> {
    const map = this.getReviewsMap();
    const reviews = map.get(templateId) || [];
    return reviews.find((r) => r.userId === userId) || null;
  }

  /**
   * Get review statistics for a template
   */
  async getReviewStats(templateId: string): Promise<{
    average: number;
    count: number;
    distribution: Record<number, number>;
  }> {
    const map = this.getReviewsMap();
    const reviews = map.get(templateId) || [];

    if (reviews.length === 0) {
      return {
        average: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const review of reviews) {
      sum += review.rating;
      distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    }

    return {
      average: sum / reviews.length,
      count: reviews.length,
      distribution,
    };
  }

  /**
   * Get all reviews for a template
   */
  async getTemplateReviews(
    templateId: string,
    sortBy: 'recent' | 'helpful' | 'rating' = 'recent'
  ): Promise<TemplateReview[]> {
    const map = this.getReviewsMap();
    const reviews = [...(map.get(templateId) || [])];

    switch (sortBy) {
      case 'helpful':
        reviews.sort((a, b) => b.helpful - a.helpful);
        break;
      case 'rating':
        reviews.sort((a, b) => b.rating - a.rating);
        break;
      case 'recent':
      default:
        reviews.sort((a, b) => b.createdAt - a.createdAt);
    }

    return reviews;
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string, userId: string): Promise<boolean> {
    const map = this.getReviewsMap();

    for (const [templateId, reviews] of map) {
      const reviewIndex = reviews.findIndex(
        (r) => r.id === reviewId && r.userId === userId
      );
      if (reviewIndex >= 0) {
        reviews.splice(reviewIndex, 1);
        map.set(templateId, reviews);
        this.saveReviewsMap(map);
        return true;
      }
    }

    return false;
  }

  /**
   * Clear all reviews (for testing)
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Export singleton instance
export const ratingSystem = new RatingSystem();
