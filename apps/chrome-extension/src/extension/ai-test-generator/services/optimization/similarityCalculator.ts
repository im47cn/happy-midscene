/**
 * Similarity Calculator
 * Calculates similarity between test cases using multiple metrics
 */

import type { ISimilarityCalculator } from './interfaces';

// Weights for different similarity components
const WEIGHTS = {
  step: 0.5, // Step sequence similarity
  target: 0.3, // Target element similarity
  assertion: 0.2, // Assertion similarity
};

class SimilarityCalculator implements ISimilarityCalculator {
  /**
   * Calculate similarity between two test cases by their IDs
   */
  async calculateCaseSimilarity(
    case1Id: string,
    case2Id: string,
  ): Promise<number> {
    // This would need test case storage to be implemented
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Calculate similarity between two step sequences using Jaccard index
   */
  calculateStepSimilarity(steps1: string[], steps2: string[]): number {
    if (steps1.length === 0 && steps2.length === 0) return 1;
    if (steps1.length === 0 || steps2.length === 0) return 0;

    const normalized1 = steps1.map((s) => this.normalizeStep(s));
    const normalized2 = steps2.map((s) => this.normalizeStep(s));

    const set1 = new Set(normalized1);
    const set2 = new Set(normalized2);

    const intersection = [...set1].filter((s) => set2.has(s)).length;
    const union = new Set([...set1, ...set2]).size;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * Calculate sequence similarity using Longest Common Subsequence
   */
  calculateSequenceSimilarity(steps1: string[], steps2: string[]): number {
    if (steps1.length === 0 && steps2.length === 0) return 1;
    if (steps1.length === 0 || steps2.length === 0) return 0;

    const normalized1 = steps1.map((s) => this.normalizeStep(s));
    const normalized2 = steps2.map((s) => this.normalizeStep(s));

    const lcsLength = this.longestCommonSubsequence(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);

    return lcsLength / maxLength;
  }

  /**
   * Calculate weighted similarity combining multiple metrics
   */
  calculateWeightedSimilarity(
    steps1: string[],
    steps2: string[],
    targets1: string[],
    targets2: string[],
    assertions1: string[],
    assertions2: string[],
  ): number {
    const stepSim = this.calculateStepSimilarity(steps1, steps2);
    const targetSim = this.calculateStepSimilarity(targets1, targets2);
    const assertSim = this.calculateStepSimilarity(assertions1, assertions2);

    return (
      stepSim * WEIGHTS.step +
      targetSim * WEIGHTS.target +
      assertSim * WEIGHTS.assertion
    );
  }

  /**
   * Normalize step for comparison
   */
  normalizeStep(step: string): string {
    return (
      step
        .toLowerCase()
        .trim()
        // Remove specific values but keep structure
        .replace(/"[^"]*"/g, '""')
        .replace(/'[^']*'/g, "''")
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Remove common prefixes
        .replace(/^(click|tap|type|input|enter|select|check|verify)\s+/i, '$1 ')
        // Normalize numbers
        .replace(/\d+/g, 'N')
    );
  }

  /**
   * Extract action type from step
   */
  extractActionType(step: string): string {
    const lowerStep = step.toLowerCase();
    const actions = [
      'click',
      'tap',
      'type',
      'input',
      'enter',
      'select',
      'check',
      'verify',
      'assert',
      'wait',
      'scroll',
      'navigate',
      'hover',
      'drag',
    ];

    for (const action of actions) {
      if (lowerStep.includes(action)) {
        return action;
      }
    }

    return 'other';
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array(n + 1).fill(0),
    );

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Calculate string similarity (0-1) using Levenshtein
   */
  stringSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLength;
  }

  /**
   * Find longest common subsequence length
   */
  private longestCommonSubsequence(seq1: string[], seq2: string[]): number {
    const m = seq1.length;
    const n = seq2.length;

    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array(n + 1).fill(0),
    );

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (seq1[i - 1] === seq2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Find common prefix of two step sequences
   */
  findCommonPrefix(steps1: string[], steps2: string[]): string[] {
    const prefix: string[] = [];
    const normalized1 = steps1.map((s) => this.normalizeStep(s));
    const normalized2 = steps2.map((s) => this.normalizeStep(s));

    const minLength = Math.min(normalized1.length, normalized2.length);

    for (let i = 0; i < minLength; i++) {
      if (normalized1[i] === normalized2[i]) {
        prefix.push(steps1[i]);
      } else {
        break;
      }
    }

    return prefix;
  }

  /**
   * Find common suffix of two step sequences
   */
  findCommonSuffix(steps1: string[], steps2: string[]): string[] {
    const suffix: string[] = [];
    const normalized1 = steps1.map((s) => this.normalizeStep(s));
    const normalized2 = steps2.map((s) => this.normalizeStep(s));

    const len1 = normalized1.length;
    const len2 = normalized2.length;
    const minLength = Math.min(len1, len2);

    for (let i = 0; i < minLength; i++) {
      if (normalized1[len1 - 1 - i] === normalized2[len2 - 1 - i]) {
        suffix.unshift(steps1[len1 - 1 - i]);
      } else {
        break;
      }
    }

    return suffix;
  }
}

export const similarityCalculator = new SimilarityCalculator();
