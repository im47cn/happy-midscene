/**
 * Unit tests for Confidence Calculator
 * Run with: npx vitest run apps/chrome-extension/src/extension/ai-test-generator/services/healing/__tests__/
 */

import { describe, it, expect } from 'vitest';
import { calculateConfidence, determineAction } from '../confidenceCalculator';
import type { SemanticFingerprint } from '../../../types/healing';

// Helper to create test fingerprint
function createFingerprint(overrides: Partial<SemanticFingerprint> = {}): SemanticFingerprint {
  return {
    id: 'test-id',
    stepId: 'step-1',
    semanticDescription: 'Test button',
    lastKnownCenter: [100, 100],
    lastKnownRect: { left: 50, top: 50, width: 100, height: 50 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    healingCount: 0,
    ...overrides,
  };
}

describe('calculateConfidence', () => {
  describe('distance scoring', () => {
    it('should give high score when element is at same position', () => {
      const fingerprint = createFingerprint({ lastKnownCenter: [100, 100] });
      const result = calculateConfidence([100, 100], fingerprint.lastKnownRect, fingerprint, 'normal');

      expect(result.factors.distanceScore).toBe(100);
    });

    it('should reduce score as distance increases', () => {
      const fingerprint = createFingerprint({ lastKnownCenter: [100, 100] });

      // 20 pixels away - should lose 10 points (0.5 * 20)
      const result1 = calculateConfidence([120, 100], fingerprint.lastKnownRect, fingerprint, 'normal');
      expect(result1.factors.distanceScore).toBe(90);

      // 50 pixels away - should lose 25 points
      const result2 = calculateConfidence([150, 100], fingerprint.lastKnownRect, fingerprint, 'normal');
      expect(result2.factors.distanceScore).toBe(75);

      // 100 pixels away - should lose 50 points
      const result3 = calculateConfidence([200, 100], fingerprint.lastKnownRect, fingerprint, 'normal');
      expect(result3.factors.distanceScore).toBe(50);
    });

    it('should not go below 0 for large distances', () => {
      const fingerprint = createFingerprint({ lastKnownCenter: [100, 100] });

      // 300 pixels away - would be -50 but capped at 0
      const result = calculateConfidence([400, 100], fingerprint.lastKnownRect, fingerprint, 'normal');
      expect(result.factors.distanceScore).toBe(0);
    });
  });

  describe('size scoring', () => {
    it('should give high score for identical size', () => {
      const fingerprint = createFingerprint({
        lastKnownRect: { left: 0, top: 0, width: 100, height: 50 },
      });
      const newRect = { left: 0, top: 0, width: 100, height: 50 };

      const result = calculateConfidence([100, 100], newRect, fingerprint, 'normal');
      expect(result.factors.sizeScore).toBe(100);
    });

    it('should reduce score for size changes', () => {
      const fingerprint = createFingerprint({
        lastKnownRect: { left: 0, top: 0, width: 100, height: 50 },
      });

      // Width doubled - ratio = 0.5 * 1.0 = 0.5 -> 50%
      const newRect1 = { left: 0, top: 0, width: 200, height: 50 };
      const result1 = calculateConfidence([100, 100], newRect1, fingerprint, 'normal');
      expect(result1.factors.sizeScore).toBe(50);

      // Both dimensions halved - ratio = 0.5 * 0.5 = 0.25 -> 25%
      const newRect2 = { left: 0, top: 0, width: 50, height: 25 };
      const result2 = calculateConfidence([100, 100], newRect2, fingerprint, 'normal');
      expect(result2.factors.sizeScore).toBe(25);
    });
  });

  describe('strategy scoring', () => {
    it('should give full score for normal strategy', () => {
      const fingerprint = createFingerprint();
      const result = calculateConfidence([100, 100], fingerprint.lastKnownRect, fingerprint, 'normal');

      expect(result.factors.strategyScore).toBe(100);
    });

    it('should penalize deepThink strategy', () => {
      const fingerprint = createFingerprint();
      const result = calculateConfidence([100, 100], fingerprint.lastKnownRect, fingerprint, 'deepThink');

      expect(result.factors.strategyScore).toBe(90);
    });
  });

  describe('overall confidence', () => {
    it('should calculate weighted average correctly', () => {
      const fingerprint = createFingerprint({
        lastKnownCenter: [100, 100],
        lastKnownRect: { left: 50, top: 75, width: 100, height: 50 },
      });

      // Same position, same size, normal strategy
      // Distance: 100, Size: 100, Strategy: 100
      // Weighted: 100 * 0.4 + 100 * 0.3 + 100 * 0.3 = 100
      const result = calculateConfidence([100, 100], fingerprint.lastKnownRect, fingerprint, 'normal');
      expect(result.confidence).toBe(100);
    });

    it('should properly weight all factors', () => {
      const fingerprint = createFingerprint({
        lastKnownCenter: [100, 100],
        lastKnownRect: { left: 50, top: 75, width: 100, height: 50 },
      });

      // 100px away (distance score = 50)
      // Same size (size score = 100)
      // DeepThink (strategy score = 90)
      // Weighted: 50 * 0.4 + 100 * 0.3 + 90 * 0.3 = 20 + 30 + 27 = 77
      const newRect = { left: 150, top: 75, width: 100, height: 50 };
      const result = calculateConfidence([200, 100], newRect, fingerprint, 'deepThink');
      expect(result.confidence).toBe(77);
    });
  });
});

describe('determineAction', () => {
  it('should auto_accept for high confidence', () => {
    expect(determineAction(90, 80)).toBe('auto_accept');
    expect(determineAction(80, 80)).toBe('auto_accept');
    expect(determineAction(100, 80)).toBe('auto_accept');
  });

  it('should request_confirmation for medium confidence', () => {
    expect(determineAction(79, 80)).toBe('request_confirmation');
    expect(determineAction(60, 80)).toBe('request_confirmation');
    expect(determineAction(50, 80)).toBe('request_confirmation');
  });

  it('should reject for low confidence', () => {
    expect(determineAction(49, 80)).toBe('reject');
    expect(determineAction(30, 80)).toBe('reject');
    expect(determineAction(0, 80)).toBe('reject');
  });

  it('should respect custom threshold', () => {
    // With threshold 90
    expect(determineAction(85, 90)).toBe('request_confirmation');
    expect(determineAction(90, 90)).toBe('auto_accept');

    // With threshold 60
    expect(determineAction(60, 60)).toBe('auto_accept');
    expect(determineAction(55, 60)).toBe('request_confirmation');
  });
});
