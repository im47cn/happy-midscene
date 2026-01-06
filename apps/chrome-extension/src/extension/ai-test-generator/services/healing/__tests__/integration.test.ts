/**
 * Self-Healing Integration Tests
 * End-to-end tests for the complete self-healing pipeline
 * Tests UI change scenarios and full healing workflow
 */

import type { ChromeExtensionProxyPageAgent } from '@midscene/web/chrome-extension';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  HealingHistoryEntry,
  HealingResult,
  SemanticFingerprint,
} from '../../../types/healing';
import { HealingEngine } from '../healingEngine';
import { healingStorage } from '../storage';

// Mock storage
vi.mock('../storage', () => {
  const mockStorage = {
    // Fingerprint storage
    fingerprints: new Map<string, SemanticFingerprint>(),
    history: [] as HealingHistoryEntry[],

    // IFingerprintStorage methods
    get: vi.fn(async (stepId: string) => {
      return mockStorage.fingerprints.get(stepId) || null;
    }),
    save: vi.fn(async (fingerprint: SemanticFingerprint) => {
      mockStorage.fingerprints.set(fingerprint.stepId, fingerprint);
    }),
    update: vi.fn(async (fingerprint: SemanticFingerprint) => {
      mockStorage.fingerprints.set(fingerprint.stepId, fingerprint);
    }),
    delete: vi.fn(async (stepId: string) => {
      mockStorage.fingerprints.delete(stepId);
    }),
    getAllFingerprints: vi.fn(async () => {
      return Array.from(mockStorage.fingerprints.values());
    }),
    clear: vi.fn(async () => {
      mockStorage.fingerprints.clear();
    }),
    cleanupExpired: vi.fn(async () => 0),

    // IHealingHistoryStorage methods
    add: vi.fn(async (entry: HealingHistoryEntry) => {
      mockStorage.history.push(entry);
    }),
    getByStepId: vi.fn(async (stepId: string) => {
      return mockStorage.history.filter((h) => h.stepId === stepId);
    }),
    getAllHistoryEntries: vi.fn(async () => {
      return [...mockStorage.history];
    }),
    clearHistory: vi.fn(async () => {
      mockStorage.history = [];
    }),
    getHistoryByHealingId: vi.fn(async (healingId: string) => {
      return (
        mockStorage.history.find((h) => h.result.healingId === healingId) ||
        null
      );
    }),
    updateHistoryEntry: vi.fn(async (entry: HealingHistoryEntry) => {
      const index = mockStorage.history.findIndex((h) => h.id === entry.id);
      if (index >= 0) {
        mockStorage.history[index] = entry;
      }
    }),
  };

  return {
    healingStorage: mockStorage,
  };
});

import { healingStorage } from '../storage';

// Helper to create a mock agent
function createMockAgent(overrides = {}) {
  return {
    describeElementAtPoint: vi.fn().mockResolvedValue({
      prompt: 'Submit button with blue background',
      deepThink: false,
      verifyResult: true,
    }),
    aiLocate: vi.fn().mockResolvedValue({
      center: [150, 150],
      rect: { left: 100, top: 125, width: 100, height: 50 },
    }),
    ...overrides,
  } as unknown as ChromeExtensionProxyPageAgent;
}

// Helper to reset mock storage
function resetMockStorage() {
  (healingStorage as any).fingerprints.clear();
  (healingStorage as any).history = [];
  vi.clearAllMocks();
}

describe('Self-Healing Integration Tests', () => {
  let engine: HealingEngine;
  let mockAgent: ChromeExtensionProxyPageAgent;

  beforeEach(() => {
    engine = new HealingEngine();
    mockAgent = createMockAgent();
    resetMockStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Healing Flow', () => {
    it('should complete full healing workflow: collect -> fail -> heal -> confirm', async () => {
      // Step 1: Execute successful step and collect fingerprint
      engine.setAgent(mockAgent);

      const initialFingerprint = await engine.collectFingerprint(
        'submit-button',
        [100, 100],
        { left: 50, top: 75, width: 100, height: 50 },
      );

      expect(initialFingerprint.stepId).toBe('submit-button');
      expect(initialFingerprint.semanticDescription).toBe(
        'Submit button with blue background',
      );
      expect(initialFingerprint.healingCount).toBe(0);

      // Step 2: Simulate element not found (original location fails)
      // The mock agent will return a new location
      const healingResult = await engine.heal(
        'submit-button',
        'Click the submit button',
      );

      // Step 3: Verify healing succeeded
      expect(healingResult.success).toBe(true);
      expect(healingResult.strategy).toBe('normal');
      expect(healingResult.confidence).toBeGreaterThan(0);
      expect(healingResult.element).toBeDefined();
      expect(healingResult.element?.center).toEqual([150, 150]);

      // Step 4: Confirm the healing
      const confirmedElement = await engine.confirmHealing(
        healingResult.healingId,
        true,
      );

      expect(confirmedElement).not.toBeNull();
      expect(confirmedElement?.center).toEqual([150, 150]);

      // Step 5: Verify fingerprint was updated with new location
      const updatedFingerprint = await healingStorage.get('submit-button');
      expect(updatedFingerprint?.lastKnownCenter).toEqual([150, 150]);
      expect(updatedFingerprint?.lastKnownRect).toEqual({
        left: 100,
        top: 125,
        width: 100,
        height: 50,
      });
      expect(updatedFingerprint?.healingCount).toBe(1);

      // Step 6: Verify statistics reflect the healing
      const stats = await engine.getStatistics();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.normalSuccessCount).toBe(1);
    });

    it('should handle healing rejection correctly', async () => {
      engine.setAgent(mockAgent);

      // Collect fingerprint
      await engine.collectFingerprint('login-input', [200, 150], {
        left: 150,
        top: 125,
        width: 100,
        height: 50,
      });

      // Trigger healing
      const healingResult = await engine.heal(
        'login-input',
        'Enter username in login input',
      );

      expect(healingResult.success).toBe(true);

      // Reject the healing
      const confirmedElement = await engine.confirmHealing(
        healingResult.healingId,
        false,
      );

      expect(confirmedElement).toBeNull();

      // Verify fingerprint was NOT updated
      const fingerprint = await healingStorage.get('login-input');
      expect(fingerprint?.lastKnownCenter).toEqual([200, 150]); // Original location
      expect(fingerprint?.healingCount).toBe(0); // No increment

      // Verify history shows rejection
      const history = await healingStorage.getAllHistoryEntries();
      expect(history[0].userConfirmed).toBe(false);
      expect(history[0].fingerprintUpdated).toBe(false);
    });

    it('should retry with DeepThink mode after normal mode fails', async () => {
      // Mock agent: normal mode fails, deepThink succeeds
      const deepThinkAgent = createMockAgent({
        aiLocate: vi
          .fn()
          .mockRejectedValueOnce(new Error('Element not found')) // Normal mode fails
          .mockResolvedValueOnce({
            // DeepThink succeeds
            center: [180, 140],
            rect: { left: 130, top: 115, width: 100, height: 50 },
          }),
      });

      engine.setAgent(deepThinkAgent);

      // Collect fingerprint first
      await engine.collectFingerprint('deep-link', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // Trigger healing - should try normal, then deepThink
      const healingResult = await engine.heal(
        'deep-link',
        'Click the deep link',
      );

      expect(healingResult.success).toBe(true);
      expect(healingResult.strategy).toBe('deepThink');
      expect(healingResult.attemptsCount).toBe(2);
      expect(healingResult.element?.center).toEqual([180, 140]);
    });

    it('should fail when all strategies fail', async () => {
      const failingAgent = createMockAgent({
        aiLocate: vi.fn().mockRejectedValue(new Error('Element not found')),
      });

      engine.setAgent(failingAgent);

      // Collect fingerprint
      await engine.collectFingerprint('missing-element', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // Try healing - all strategies should fail
      const healingResult = await engine.heal(
        'missing-element',
        'Click the missing element',
      );

      expect(healingResult.success).toBe(false);
      expect(healingResult.confidence).toBe(0);

      // Verify statistics reflect the failure
      const stats = await engine.getStatistics();
      expect(stats.failureCount).toBe(1);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('UI Change Scenarios', () => {
    it('should handle element position change (small shift)', async () => {
      engine.setAgent(mockAgent);

      // Original element at [100, 100]
      await engine.collectFingerprint('moved-button', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // Element moved to [120, 110] - small shift
      const movedAgent = createMockAgent({
        aiLocate: vi.fn().mockResolvedValue({
          center: [120, 110],
          rect: { left: 70, top: 85, width: 100, height: 50 },
        }),
      });
      engine.setAgent(movedAgent);

      const result = await engine.heal('moved-button', 'Click moved button');

      // Small shift should have high confidence
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80); // High confidence for small shift

      // Distance: sqrt(20^2 + 10^2) = sqrt(500) ≈ 22.36 pixels
      // Expected distance score: 100 - (22.36 * 0.5) ≈ 89
    });

    it('should handle element position change (large shift)', async () => {
      engine.setAgent(mockAgent);

      // Original element at [100, 100]
      await engine.collectFingerprint('far-moved-button', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // Element moved to [300, 300] - large shift
      const farMovedAgent = createMockAgent({
        aiLocate: vi.fn().mockResolvedValue({
          center: [300, 300],
          rect: { left: 250, top: 275, width: 100, height: 50 },
        }),
      });
      engine.setAgent(farMovedAgent);

      const result = await engine.heal(
        'far-moved-button',
        'Click far moved button',
      );

      // Large shift should have lower confidence
      expect(result.success).toBe(true);
      expect(result.confidence).toBeLessThan(80); // Lower confidence for large shift

      // Distance: sqrt(200^2 + 200^2) = sqrt(80000) ≈ 283 pixels
      // Expected distance score: 0 (capped at minimum)
    });

    it('should handle element size change', async () => {
      engine.setAgent(mockAgent);

      // Original element: 100x50
      await engine.collectFingerprint('resized-button', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // Element resized to 80x40 (smaller)
      const resizedAgent = createMockAgent({
        aiLocate: vi.fn().mockResolvedValue({
          center: [100, 100],
          rect: { left: 60, top: 80, width: 80, height: 40 },
        }),
      });
      engine.setAgent(resizedAgent);

      const result = await engine.heal(
        'resized-button',
        'Click resized button',
      );

      expect(result.success).toBe(true);
      // Size change affects confidence
      // Original area: 5000, New area: 3200, Difference: 1800 (36% change)
      // Expected size score should reflect this change
    });

    it('should handle both position and size change', async () => {
      engine.setAgent(mockAgent);

      // Original element
      await engine.collectFingerprint('moved-and-resized', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // Element moved and resized
      const changedAgent = createMockAgent({
        aiLocate: vi.fn().mockResolvedValue({
          center: [150, 130],
          rect: { left: 110, top: 110, width: 80, height: 40 },
        }),
      });
      engine.setAgent(changedAgent);

      const result = await engine.heal(
        'moved-and-resized',
        'Click changed element',
      );

      expect(result.success).toBe(true);
      // Both distance and size factors should affect confidence
      expect(result.confidenceFactors.distanceScore).toBeDefined();
      expect(result.confidenceFactors.sizeScore).toBeDefined();
    });

    it('should track unstable elements across multiple healings', async () => {
      engine.setAgent(mockAgent);

      const stepId = 'unstable-button';

      // First execution - collect fingerprint
      await engine.collectFingerprint(stepId, [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // First healing
      await engine.heal(stepId, 'Click button');
      await engine.confirmHealing(
        (await healingStorage.getAllHistoryEntries())[0].result.healingId,
        true,
      );

      // Second healing (element moved again)
      const movedAgent = createMockAgent({
        aiLocate: vi.fn().mockResolvedValue({
          center: [130, 120],
          rect: { left: 80, top: 95, width: 100, height: 50 },
        }),
      });
      engine.setAgent(movedAgent);

      await engine.heal(stepId, 'Click button');
      const history = await healingStorage.getAllHistoryEntries();
      await engine.confirmHealing(history[1].result.healingId, true);

      // Third healing
      await engine.heal(stepId, 'Click button');
      await engine.confirmHealing(history[2].result.healingId, true);

      // Check statistics
      const stats = await engine.getStatistics();

      expect(stats.totalAttempts).toBe(3);
      expect(stats.unstableElements).toHaveLength(1);
      expect(stats.unstableElements[0].stepId).toBe(stepId);
      expect(stats.unstableElements[0].healingCount).toBe(3);
    });
  });

  describe('Strategy Selection', () => {
    it('should use DeepThink for better confidence on difficult cases', async () => {
      engine.setAgent(mockAgent);

      await engine.collectFingerprint('complex-element', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // Normal mode finds element with low confidence location
      // DeepThink mode finds better location
      const strategyAgent = createMockAgent({
        aiLocate: vi
          .fn()
          .mockResolvedValueOnce({
            // Normal mode - far location
            center: [250, 250],
            rect: { left: 200, top: 225, width: 100, height: 50 },
          })
          .mockResolvedValueOnce({
            // DeepThink - closer location
            center: [110, 105],
            rect: { left: 60, top: 80, width: 100, height: 50 },
          }),
      });
      engine.setAgent(strategyAgent);

      const result = await engine.heal(
        'complex-element',
        'Find complex element',
      );

      // Should have tried both strategies
      expect(result.attemptsCount).toBe(2);
      expect(result.strategy).toBe('deepThink');

      // DeepThink result should be used (better confidence due to closer location)
      expect(result.element?.center).toEqual([110, 105]);
    });

    it('should disable DeepThink when configured', async () => {
      engine.updateConfig({ enableDeepThink: false });
      engine.setAgent(mockAgent);

      await engine.collectFingerprint('no-deepthink', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // Normal mode fails
      const failingAgent = createMockAgent({
        aiLocate: vi.fn().mockRejectedValue(new Error('Not found')),
      });
      engine.setAgent(failingAgent);

      const result = await engine.heal('no-deepthink', 'Find element');

      // Should only try once (normal mode)
      expect(result.attemptsCount).toBe(1);
      expect(result.success).toBe(false);
    });
  });

  describe('Statistics Tracking', () => {
    it('should accurately calculate success rate over multiple attempts', async () => {
      engine.setAgent(mockAgent);

      // Create 5 fingerprints
      for (let i = 1; i <= 5; i++) {
        await engine.collectFingerprint(`step-${i}`, [100, 100], {
          left: 50,
          top: 75,
          width: 100,
          height: 50,
        });
      }

      // 3 successful healings, 2 failures
      for (let i = 1; i <= 3; i++) {
        await engine.heal(`step-${i}`, `Execute step ${i}`);
      }

      const failingAgent = createMockAgent({
        aiLocate: vi.fn().mockRejectedValue(new Error('Not found')),
      });
      engine.setAgent(failingAgent);

      for (let i = 4; i <= 5; i++) {
        await engine.heal(`step-${i}`, `Execute step ${i}`);
      }

      const stats = await engine.getStatistics();

      expect(stats.totalAttempts).toBe(5);
      expect(stats.successCount).toBe(3);
      expect(stats.failureCount).toBe(2);
      expect(stats.successRate).toBe(60);
    });

    it('should calculate average confidence and time cost', async () => {
      engine.setAgent(mockAgent);

      await engine.collectFingerprint('metrics-test', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      // Simulate healing with different results
      const metricsAgent = createMockAgent({
        aiLocate: vi
          .fn()
          .mockResolvedValueOnce({
            // First: high confidence, fast
            center: [105, 102],
            rect: { left: 55, top: 77, width: 100, height: 50 },
          })
          .mockResolvedValueOnce({
            // Second: medium confidence, slower
            center: [130, 120],
            rect: { left: 80, top: 95, width: 100, height: 50 },
          })
          .mockResolvedValueOnce({
            // Third: low confidence, slow
            center: [200, 180],
            rect: { left: 150, top: 155, width: 100, height: 50 },
          }),
      });
      engine.setAgent(metricsAgent);

      await engine.heal('metrics-test', 'Test 1');
      await engine.heal('metrics-test', 'Test 2');
      await engine.heal('metrics-test', 'Test 3');

      const stats = await engine.getStatistics();

      expect(stats.totalAttempts).toBe(3);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeLessThan(100);
      expect(stats.averageTimeCost).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle healing without prior fingerprint gracefully', async () => {
      engine.setAgent(mockAgent);

      // Don't collect fingerprint first
      const result = await engine.heal(
        'no-fingerprint',
        'Try to heal without fingerprint',
      );

      expect(result.success).toBe(false);
    });

    it('should handle multiple confirmations for same healing id', async () => {
      engine.setAgent(mockAgent);

      await engine.collectFingerprint('double-confirm', [100, 100], {
        left: 50,
        top: 75,
        width: 100,
        height: 50,
      });

      const result = await engine.heal('double-confirm', 'Test');

      // First confirmation
      const firstConfirm = await engine.confirmHealing(result.healingId, true);
      expect(firstConfirm).not.toBeNull();

      // Second confirmation (should still work but not change anything)
      const secondConfirm = await engine.confirmHealing(result.healingId, true);
      expect(secondConfirm).not.toBeNull();

      // Healing count should only be incremented once
      const fingerprint = await healingStorage.get('double-confirm');
      expect(fingerprint?.healingCount).toBe(1);
    });
  });
});
