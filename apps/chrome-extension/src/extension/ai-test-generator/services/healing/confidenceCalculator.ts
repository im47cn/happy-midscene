/**
 * Confidence Calculator for Self-Healing
 * Calculates confidence score based on distance, size, and strategy
 */

import type { Rect } from '@midscene/core';
import type { HealingStrategy, SemanticFingerprint } from '../../types/healing';

/**
 * Calculate distance between two points
 */
function distanceOfTwoPoints(
  p1: [number, number],
  p2: [number, number],
): number {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  return Math.round(Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2));
}

/**
 * Calculate size ratio between two rects
 * Returns a value between 0 and 1, where 1 means identical size
 */
function sizeRatio(rect1: Rect, rect2: Rect): number {
  const widthRatio = Math.min(
    rect1.width / rect2.width,
    rect2.width / rect1.width,
  );
  const heightRatio = Math.min(
    rect1.height / rect2.height,
    rect2.height / rect1.height,
  );
  return widthRatio * heightRatio;
}

export interface ConfidenceResult {
  confidence: number;
  factors: {
    distanceScore: number;
    sizeScore: number;
    strategyScore: number;
  };
}

/**
 * Calculate confidence score for a healing result
 *
 * Scoring weights:
 * - Distance: 40% - How far the element moved from its original position
 * - Size: 30% - How much the element's size changed
 * - Strategy: 30% - Normal mode gets full score, DeepThink mode penalized slightly
 *
 * @param newCenter - Center point of the healed element
 * @param newRect - Bounding box of the healed element
 * @param fingerprint - Original fingerprint for comparison
 * @param strategy - Strategy used for healing
 * @returns Confidence score (0-100) and factor breakdown
 */
export function calculateConfidence(
  newCenter: [number, number],
  newRect: Rect,
  fingerprint: SemanticFingerprint,
  strategy: HealingStrategy,
): ConfidenceResult {
  // 1. Distance score (40%)
  // Each pixel of distance reduces score by 0.5
  // Max distance for any score: 200 pixels
  const distance = distanceOfTwoPoints(newCenter, fingerprint.lastKnownCenter);
  const distanceScore = Math.max(0, 100 - distance * 0.5);

  // 2. Size score (30%)
  // Based on how similar the new size is to the original
  const ratio = sizeRatio(newRect, fingerprint.lastKnownRect);
  const sizeScore = ratio * 100;

  // 3. Strategy score (30%)
  // Normal mode: 100 (full score)
  // DeepThink mode: 90 (10 point penalty for requiring more effort)
  const strategyScore = strategy === 'normal' ? 100 : 90;

  // Weighted average
  const confidence =
    distanceScore * 0.4 + sizeScore * 0.3 + strategyScore * 0.3;

  return {
    confidence: Math.round(confidence),
    factors: {
      distanceScore: Math.round(distanceScore),
      sizeScore: Math.round(sizeScore),
      strategyScore,
    },
  };
}

/**
 * Determine action based on confidence score
 */
export type ConfidenceAction =
  | 'auto_accept'
  | 'request_confirmation'
  | 'reject';

export function determineAction(
  confidence: number,
  autoAcceptThreshold: number,
): ConfidenceAction {
  if (confidence >= autoAcceptThreshold) {
    return 'auto_accept';
  }
  if (confidence >= 50) {
    return 'request_confirmation';
  }
  return 'reject';
}
