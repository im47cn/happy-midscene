/**
 * Healing Engine for Self-Healing
 * Core orchestration logic for the self-healing feature
 */

import type { Rect } from '@midscene/core';
import type { ChromeExtensionProxyPageAgent } from '@midscene/web/chrome-extension';
import type {
  SemanticFingerprint,
  HealingResult,
  HealingHistoryEntry,
  HealingStatistics,
  SelfHealingConfig,
  IHealingEngine,
} from '../../types/healing';
import { DEFAULT_SELF_HEALING_CONFIG } from '../../types/healing';
import { healingStorage } from './storage';
import { calculateConfidence, determineAction } from './confidenceCalculator';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Healing Engine implementation
 */
export class HealingEngine implements IHealingEngine {
  private config: SelfHealingConfig;
  private agent: ChromeExtensionProxyPageAgent | null = null;

  constructor(config?: Partial<SelfHealingConfig>) {
    this.config = { ...DEFAULT_SELF_HEALING_CONFIG, ...config };
  }

  /**
   * Set the agent for AI operations
   */
  setAgent(agent: ChromeExtensionProxyPageAgent): void {
    this.agent = agent;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SelfHealingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SelfHealingConfig {
    return { ...this.config };
  }

  /**
   * Collect fingerprint after successful step execution
   */
  async collectFingerprint(
    stepId: string,
    elementCenter: [number, number],
    elementRect: Rect
  ): Promise<SemanticFingerprint> {
    if (!this.agent) {
      throw new Error('Agent not set. Call setAgent() first.');
    }

    // Check if fingerprint already exists
    const existing = await healingStorage.get(stepId);

    // Generate semantic description using Midscene AI
    let semanticDescription: string;
    try {
      const describeResult = await this.agent.describeElementAtPoint(elementCenter, {
        verifyPrompt: true,
        retryLimit: 3,
      });
      semanticDescription = describeResult.prompt;
    } catch (error) {
      console.warn('Failed to generate semantic description, using fallback:', error);
      // Fallback: use a generic description
      semanticDescription = `Element at position (${elementCenter[0]}, ${elementCenter[1]})`;
    }

    const now = Date.now();

    if (existing) {
      // Update existing fingerprint
      const updated: SemanticFingerprint = {
        ...existing,
        semanticDescription,
        lastKnownCenter: elementCenter,
        lastKnownRect: elementRect,
        updatedAt: now,
      };
      await healingStorage.update(updated);
      return updated;
    }

    // Create new fingerprint
    const fingerprint: SemanticFingerprint = {
      id: generateId(),
      stepId,
      semanticDescription,
      lastKnownCenter: elementCenter,
      lastKnownRect: elementRect,
      createdAt: now,
      updatedAt: now,
      healingCount: 0,
    };

    await healingStorage.save(fingerprint);
    return fingerprint;
  }

  /**
   * Attempt to heal a failed step
   */
  async heal(
    stepId: string,
    originalDescription: string
  ): Promise<HealingResult> {
    if (!this.agent) {
      throw new Error('Agent not set. Call setAgent() first.');
    }

    if (!this.config.enabled) {
      return this.createFailedResult('Self-healing is disabled');
    }

    const startTime = Date.now();
    const healingId = generateId();

    // Get fingerprint for this step
    const fingerprint = await healingStorage.get(stepId);
    if (!fingerprint) {
      return this.createFailedResult('No fingerprint found for this step');
    }

    let attemptsCount = 0;

    // Strategy 1: Normal mode
    try {
      attemptsCount++;
      const result = await this.agent.aiLocate(fingerprint.semanticDescription);

      if (result.center && result.rect) {
        const { confidence, factors } = calculateConfidence(
          result.center,
          result.rect,
          fingerprint,
          'normal'
        );

        const healingResult: HealingResult = {
          success: true,
          healingId,
          element: {
            center: result.center,
            rect: result.rect,
          },
          strategy: 'normal',
          attemptsCount,
          confidence,
          confidenceFactors: factors,
          timeCost: Date.now() - startTime,
        };

        // Record history
        await this.recordHistory(stepId, originalDescription, healingResult, fingerprint);

        return healingResult;
      }
    } catch (error) {
      console.debug('Normal mode healing failed:', error);
    }

    // Strategy 2: DeepThink mode
    if (this.config.enableDeepThink) {
      try {
        attemptsCount++;
        const result = await this.agent.aiLocate(fingerprint.semanticDescription, {
          deepThink: true,
        });

        if (result.center && result.rect) {
          const { confidence, factors } = calculateConfidence(
            result.center,
            result.rect,
            fingerprint,
            'deepThink'
          );

          const healingResult: HealingResult = {
            success: true,
            healingId,
            element: {
              center: result.center,
              rect: result.rect,
            },
            strategy: 'deepThink',
            attemptsCount,
            confidence,
            confidenceFactors: factors,
            timeCost: Date.now() - startTime,
          };

          // Record history
          await this.recordHistory(stepId, originalDescription, healingResult, fingerprint);

          return healingResult;
        }
      } catch (error) {
        console.debug('DeepThink mode healing failed:', error);
      }
    }

    // Both strategies failed
    const failedResult = this.createFailedResult(
      'All healing strategies failed',
      healingId,
      attemptsCount,
      Date.now() - startTime
    );

    // Record failed attempt
    await this.recordHistory(stepId, originalDescription, failedResult, fingerprint);

    return failedResult;
  }

  /**
   * Confirm healing result (accept or reject)
   */
  async confirmHealing(
    healingId: string,
    accepted: boolean,
    newDescription?: string
  ): Promise<void> {
    // Find the history entry
    const allHistory = await healingStorage.getAllHistoryEntries();
    const entry = allHistory.find((h) => h.result.healingId === healingId);

    if (!entry) {
      console.warn('Healing history entry not found:', healingId);
      return;
    }

    if (accepted && entry.result.success && entry.result.element) {
      // Update fingerprint with new location
      const fingerprint = await healingStorage.get(entry.stepId);
      if (fingerprint) {
        const updated: SemanticFingerprint = {
          ...fingerprint,
          lastKnownCenter: entry.result.element.center,
          lastKnownRect: entry.result.element.rect,
          healingCount: fingerprint.healingCount + 1,
          updatedAt: Date.now(),
        };

        // Update description if provided
        if (newDescription) {
          updated.semanticDescription = newDescription;
        }

        await healingStorage.update(updated);
      }
    }
  }

  /**
   * Get healing statistics
   */
  async getStatistics(): Promise<HealingStatistics> {
    const history = await healingStorage.getAllHistoryEntries();
    const fingerprints = await healingStorage.getAllFingerprints();

    const totalAttempts = history.length;
    const successCount = history.filter((h) => h.result.success).length;
    const failureCount = totalAttempts - successCount;

    const normalSuccessCount = history.filter(
      (h) => h.result.success && h.result.strategy === 'normal'
    ).length;
    const deepThinkSuccessCount = history.filter(
      (h) => h.result.success && h.result.strategy === 'deepThink'
    ).length;

    const successfulHeals = history.filter((h) => h.result.success);
    const averageConfidence =
      successfulHeals.length > 0
        ? successfulHeals.reduce((sum, h) => sum + h.result.confidence, 0) /
          successfulHeals.length
        : 0;

    const averageTimeCost =
      history.length > 0
        ? history.reduce((sum, h) => sum + h.result.timeCost, 0) / history.length
        : 0;

    // Get unstable elements (sorted by healingCount)
    const unstableElements = fingerprints
      .filter((f) => f.healingCount > 0)
      .sort((a, b) => b.healingCount - a.healingCount)
      .slice(0, 10)
      .map((f) => ({
        stepId: f.stepId,
        description: f.semanticDescription,
        healingCount: f.healingCount,
      }));

    return {
      totalAttempts,
      successCount,
      failureCount,
      successRate: totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0,
      normalSuccessCount,
      deepThinkSuccessCount,
      averageConfidence: Math.round(averageConfidence),
      averageTimeCost: Math.round(averageTimeCost),
      unstableElements,
    };
  }

  /**
   * Cleanup expired fingerprints
   */
  async cleanup(): Promise<number> {
    return healingStorage.cleanupExpired(this.config.fingerprintRetentionDays);
  }

  /**
   * Determine action based on healing result
   */
  determineAction(result: HealingResult): 'auto_accept' | 'request_confirmation' | 'reject' {
    if (!result.success) {
      return 'reject';
    }
    return determineAction(result.confidence, this.config.autoAcceptThreshold);
  }

  // ==================== Private Methods ====================

  private createFailedResult(
    reason: string,
    healingId?: string,
    attemptsCount = 0,
    timeCost = 0
  ): HealingResult {
    return {
      success: false,
      healingId: healingId || generateId(),
      strategy: 'normal',
      attemptsCount,
      confidence: 0,
      confidenceFactors: {
        distanceScore: 0,
        sizeScore: 0,
        strategyScore: 0,
      },
      timeCost,
    };
  }

  private async recordHistory(
    stepId: string,
    originalDescription: string,
    result: HealingResult,
    fingerprint: SemanticFingerprint
  ): Promise<void> {
    const entry: HealingHistoryEntry = {
      id: generateId(),
      stepId,
      timestamp: Date.now(),
      originalDescription,
      failureReason: result.success ? '' : 'Element not found after healing',
      result,
      userConfirmed: false,
      fingerprintUpdated: false,
    };

    await healingStorage.add(entry);
  }
}

// Export singleton instance with default config
export const healingEngine = new HealingEngine();
