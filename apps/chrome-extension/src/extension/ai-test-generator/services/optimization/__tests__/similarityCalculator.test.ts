/**
 * SimilarityCalculator Tests
 */

import { describe, expect, it } from 'vitest';
import { similarityCalculator } from '../similarityCalculator';

describe('SimilarityCalculator', () => {
  describe('calculateStepSimilarity', () => {
    it('should return 1 for identical steps', () => {
      const steps = ['Click login button', 'Enter username', 'Submit form'];
      expect(similarityCalculator.calculateStepSimilarity(steps, steps)).toBe(
        1,
      );
    });

    it('should return 0 for completely different steps', () => {
      const steps1 = ['Click login button', 'Enter username'];
      const steps2 = ['Navigate to settings', 'Change password'];
      expect(similarityCalculator.calculateStepSimilarity(steps1, steps2)).toBe(
        0,
      );
    });

    it('should return value between 0 and 1 for partial overlap', () => {
      const steps1 = ['Click login button', 'Enter username', 'Submit form'];
      const steps2 = ['Click login button', 'Enter password', 'Submit form'];
      const similarity = similarityCalculator.calculateStepSimilarity(
        steps1,
        steps2,
      );
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle empty arrays', () => {
      expect(similarityCalculator.calculateStepSimilarity([], [])).toBe(1);
      expect(similarityCalculator.calculateStepSimilarity(['step'], [])).toBe(
        0,
      );
      expect(similarityCalculator.calculateStepSimilarity([], ['step'])).toBe(
        0,
      );
    });
  });

  describe('normalizeStep', () => {
    it('should lowercase text', () => {
      expect(similarityCalculator.normalizeStep('Click BUTTON')).toBe(
        'click button',
      );
    });

    it('should remove quoted strings', () => {
      const result = similarityCalculator.normalizeStep(
        'type "username" in input',
      );
      expect(result).toBe('type "" in input');
    });

    it('should normalize numbers', () => {
      const result = similarityCalculator.normalizeStep('wait 3000 ms');
      expect(result).toBe('wait N ms');
    });

    it('should normalize whitespace', () => {
      const result = similarityCalculator.normalizeStep(
        'click   the    button',
      );
      expect(result).toBe('click the button');
    });
  });

  describe('extractActionType', () => {
    it('should extract click action', () => {
      expect(similarityCalculator.extractActionType('Click the button')).toBe(
        'click',
      );
    });

    it('should extract type action', () => {
      expect(similarityCalculator.extractActionType('Type in username')).toBe(
        'type',
      );
    });

    it('should extract verify action', () => {
      expect(
        similarityCalculator.extractActionType('Verify text appears'),
      ).toBe('verify');
    });

    it('should return other for unknown actions', () => {
      expect(similarityCalculator.extractActionType('Do something')).toBe(
        'other',
      );
    });
  });

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(similarityCalculator.levenshteinDistance('test', 'test')).toBe(0);
    });

    it('should return correct distance for different strings', () => {
      expect(
        similarityCalculator.levenshteinDistance('kitten', 'sitting'),
      ).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(similarityCalculator.levenshteinDistance('', 'test')).toBe(4);
      expect(similarityCalculator.levenshteinDistance('test', '')).toBe(4);
    });
  });

  describe('stringSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(similarityCalculator.stringSimilarity('test', 'test')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(similarityCalculator.stringSimilarity('abcd', 'wxyz')).toBe(0);
    });

    it('should handle empty strings', () => {
      expect(similarityCalculator.stringSimilarity('', '')).toBe(1);
    });
  });

  describe('calculateSequenceSimilarity', () => {
    it('should return 1 for identical sequences', () => {
      const steps = ['step1', 'step2', 'step3'];
      expect(
        similarityCalculator.calculateSequenceSimilarity(steps, steps),
      ).toBe(1);
    });

    it('should return correct value for partial match', () => {
      const steps1 = ['a', 'b', 'c', 'd'];
      const steps2 = ['a', 'x', 'c', 'y'];
      // LCS is ['a', 'c'], length 2, max length 4
      expect(
        similarityCalculator.calculateSequenceSimilarity(steps1, steps2),
      ).toBe(0.5);
    });
  });

  describe('findCommonPrefix', () => {
    it('should find common prefix', () => {
      const steps1 = ['login', 'navigate', 'click'];
      const steps2 = ['login', 'navigate', 'type'];
      const prefix = similarityCalculator.findCommonPrefix(steps1, steps2);
      expect(prefix).toEqual(['login', 'navigate']);
    });

    it('should return empty for no common prefix', () => {
      const steps1 = ['click', 'type'];
      const steps2 = ['navigate', 'scroll'];
      expect(similarityCalculator.findCommonPrefix(steps1, steps2)).toEqual([]);
    });
  });

  describe('findCommonSuffix', () => {
    it('should find common suffix', () => {
      const steps1 = ['click', 'submit', 'verify'];
      const steps2 = ['type', 'submit', 'verify'];
      const suffix = similarityCalculator.findCommonSuffix(steps1, steps2);
      expect(suffix).toEqual(['submit', 'verify']);
    });

    it('should return empty for no common suffix', () => {
      const steps1 = ['click', 'type'];
      const steps2 = ['navigate', 'scroll'];
      expect(similarityCalculator.findCommonSuffix(steps1, steps2)).toEqual([]);
    });
  });
});
