/**
 * Self-Healing Types for AI Test Generator
 * Provides type definitions for the self-healing feature
 */

import type { Rect } from '@midscene/core';

/**
 * Semantic fingerprint for element identification
 * Core data structure for self-healing
 */
export interface SemanticFingerprint {
  id: string;
  stepId: string;

  // Core: AI-generated semantic description
  semanticDescription: string;

  // Auxiliary info for confidence calculation
  lastKnownRect: Rect;
  lastKnownCenter: [number, number];

  // Metadata
  createdAt: number;
  updatedAt: number;
  healingCount: number;
}

/**
 * Healing strategy type
 */
export type HealingStrategy = 'normal' | 'deepThink';

/**
 * Result of a healing attempt
 */
export interface HealingResult {
  success: boolean;
  healingId: string;

  // Located element (if successful)
  element?: {
    center: [number, number];
    rect: Rect;
  };

  // Strategy info
  strategy: HealingStrategy;
  attemptsCount: number;

  // Confidence score (0-100)
  confidence: number;
  confidenceFactors: {
    distanceScore: number;
    sizeScore: number;
    strategyScore: number;
  };

  // Performance
  timeCost: number;
}

/**
 * History entry for a healing attempt
 */
export interface HealingHistoryEntry {
  id: string;
  stepId: string;
  timestamp: number;

  // Failure info
  originalDescription: string;
  failureReason: string;

  // Healing result
  result: HealingResult;
  userConfirmed: boolean;

  // Fingerprint update
  fingerprintUpdated: boolean;
  newDescription?: string;
}

/**
 * Configuration for self-healing feature
 */
export interface SelfHealingConfig {
  enabled: boolean;
  autoAcceptThreshold: number;
  enableDeepThink: boolean;
  fingerprintRetentionDays: number;
}

/**
 * Default configuration
 */
export const DEFAULT_SELF_HEALING_CONFIG: SelfHealingConfig = {
  enabled: true,
  autoAcceptThreshold: 80,
  enableDeepThink: true,
  fingerprintRetentionDays: 90,
};

/**
 * Statistics for self-healing
 */
export interface HealingStatistics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;

  // Strategy breakdown
  normalSuccessCount: number;
  deepThinkSuccessCount: number;

  // Average metrics
  averageConfidence: number;
  averageTimeCost: number;

  // Top unstable elements (by healingCount)
  unstableElements: Array<{
    stepId: string;
    description: string;
    healingCount: number;
  }>;
}

/**
 * Interface for healing engine
 */
export interface IHealingEngine {
  // Collect fingerprint after successful step execution
  collectFingerprint(
    stepId: string,
    elementCenter: [number, number],
    elementRect: Rect,
  ): Promise<SemanticFingerprint>;

  // Attempt to heal a failed step
  heal(stepId: string, originalDescription: string): Promise<HealingResult>;

  // Confirm healing result
  // Returns the healed element info if accepted and successful, null otherwise
  confirmHealing(
    healingId: string,
    accepted: boolean,
    newDescription?: string,
  ): Promise<{ center: [number, number]; rect: Rect } | null>;

  // Get statistics
  getStatistics(): Promise<HealingStatistics>;
}

/**
 * Interface for fingerprint storage
 */
export interface IFingerprintStorage {
  // CRUD operations
  get(stepId: string): Promise<SemanticFingerprint | null>;
  save(fingerprint: SemanticFingerprint): Promise<void>;
  update(fingerprint: SemanticFingerprint): Promise<void>;
  delete(stepId: string): Promise<void>;

  // Batch operations
  getAllFingerprints(): Promise<SemanticFingerprint[]>;
  clear(): Promise<void>;

  // Cleanup
  cleanupExpired(retentionDays: number): Promise<number>;
}

/**
 * Interface for healing history storage
 */
export interface IHealingHistoryStorage {
  add(entry: HealingHistoryEntry): Promise<void>;
  getByStepId(stepId: string): Promise<HealingHistoryEntry[]>;
  getAllHistoryEntries(): Promise<HealingHistoryEntry[]>;
  clearHistory(): Promise<void>;
}
