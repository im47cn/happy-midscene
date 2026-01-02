/**
 * Unit tests for Healing Engine
 * Tests the core healing logic without browser dependencies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealingEngine } from '../healingEngine';
import type { SelfHealingConfig, SemanticFingerprint } from '../../../types/healing';

// Mock storage
vi.mock('../storage', () => ({
  healingStorage: {
    get: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    add: vi.fn(),
    getAllHistoryEntries: vi.fn().mockResolvedValue([]),
    getAllFingerprints: vi.fn().mockResolvedValue([]),
    cleanupExpired: vi.fn().mockResolvedValue(0),
  },
}));

import { healingStorage } from '../storage';

// Mock agent
const createMockAgent = (overrides = {}) => ({
  describeElementAtPoint: vi.fn().mockResolvedValue({ prompt: 'A blue button', deepThink: false, verifyResult: true }),
  aiLocate: vi.fn().mockResolvedValue({ center: [150, 150], rect: { left: 100, top: 125, width: 100, height: 50 } }),
  ...overrides,
});

describe('HealingEngine', () => {
  let engine: HealingEngine;

  beforeEach(() => {
    engine = new HealingEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configuration', () => {
    it('should use default config when not provided', () => {
      const config = engine.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.autoAcceptThreshold).toBe(80);
      expect(config.enableDeepThink).toBe(true);
      expect(config.fingerprintRetentionDays).toBe(90);
    });

    it('should merge custom config with defaults', () => {
      const customEngine = new HealingEngine({ autoAcceptThreshold: 70 });
      const config = customEngine.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.autoAcceptThreshold).toBe(70);
    });

    it('should update config', () => {
      engine.updateConfig({ enabled: false, autoAcceptThreshold: 90 });
      const config = engine.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.autoAcceptThreshold).toBe(90);
    });
  });

  describe('collectFingerprint', () => {
    it('should throw if agent not set', async () => {
      await expect(
        engine.collectFingerprint('step-1', [100, 100], { left: 50, top: 75, width: 100, height: 50 })
      ).rejects.toThrow('Agent not set');
    });

    it('should create new fingerprint when none exists', async () => {
      const mockAgent = createMockAgent();
      engine.setAgent(mockAgent);

      vi.mocked(healingStorage.get).mockResolvedValue(null);

      const fingerprint = await engine.collectFingerprint(
        'step-1',
        [100, 100],
        { left: 50, top: 75, width: 100, height: 50 }
      );

      expect(mockAgent.describeElementAtPoint).toHaveBeenCalledWith(
        [100, 100],
        { verifyPrompt: true, retryLimit: 3 }
      );
      expect(healingStorage.save).toHaveBeenCalled();
      expect(fingerprint.stepId).toBe('step-1');
      expect(fingerprint.semanticDescription).toBe('A blue button');
      expect(fingerprint.lastKnownCenter).toEqual([100, 100]);
    });

    it('should update existing fingerprint', async () => {
      const mockAgent = createMockAgent();
      engine.setAgent(mockAgent);

      const existingFingerprint: SemanticFingerprint = {
        id: 'existing-id',
        stepId: 'step-1',
        semanticDescription: 'Old description',
        lastKnownCenter: [50, 50],
        lastKnownRect: { left: 25, top: 25, width: 50, height: 50 },
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 10000,
        healingCount: 2,
      };

      vi.mocked(healingStorage.get).mockResolvedValue(existingFingerprint);

      const fingerprint = await engine.collectFingerprint(
        'step-1',
        [100, 100],
        { left: 50, top: 75, width: 100, height: 50 }
      );

      expect(healingStorage.update).toHaveBeenCalled();
      expect(healingStorage.save).not.toHaveBeenCalled();
      expect(fingerprint.id).toBe('existing-id');
      expect(fingerprint.semanticDescription).toBe('A blue button');
      expect(fingerprint.healingCount).toBe(2); // Preserved
    });

    it('should use fallback description on AI failure', async () => {
      const mockAgent = createMockAgent({
        describeElementAtPoint: vi.fn().mockRejectedValue(new Error('AI failed')),
      });
      engine.setAgent(mockAgent);

      vi.mocked(healingStorage.get).mockResolvedValue(null);

      const fingerprint = await engine.collectFingerprint(
        'step-1',
        [100, 100],
        { left: 50, top: 75, width: 100, height: 50 }
      );

      expect(fingerprint.semanticDescription).toContain('Element at position');
    });
  });

  describe('heal', () => {
    it('should throw if agent not set', async () => {
      await expect(engine.heal('step-1', 'Click the button')).rejects.toThrow('Agent not set');
    });

    it('should return failed result when healing is disabled', async () => {
      engine.updateConfig({ enabled: false });
      engine.setAgent(createMockAgent());

      const result = await engine.heal('step-1', 'Click the button');

      expect(result.success).toBe(false);
    });

    it('should return failed result when no fingerprint exists', async () => {
      engine.setAgent(createMockAgent());
      vi.mocked(healingStorage.get).mockResolvedValue(null);

      const result = await engine.heal('step-1', 'Click the button');

      expect(result.success).toBe(false);
    });

    it('should attempt normal mode healing first', async () => {
      const mockAgent = createMockAgent();
      engine.setAgent(mockAgent);

      const fingerprint: SemanticFingerprint = {
        id: 'fp-1',
        stepId: 'step-1',
        semanticDescription: 'Submit button',
        lastKnownCenter: [100, 100],
        lastKnownRect: { left: 50, top: 75, width: 100, height: 50 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        healingCount: 0,
      };

      vi.mocked(healingStorage.get).mockResolvedValue(fingerprint);

      const result = await engine.heal('step-1', 'Click the button');

      expect(mockAgent.aiLocate).toHaveBeenCalledWith('Submit button');
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('normal');
      expect(result.attemptsCount).toBe(1);
    });

    it('should fallback to deepThink mode when normal fails', async () => {
      const mockAgent = createMockAgent({
        aiLocate: vi.fn()
          .mockRejectedValueOnce(new Error('Not found'))
          .mockResolvedValueOnce({ center: [150, 150], rect: { left: 100, top: 125, width: 100, height: 50 } }),
      });
      engine.setAgent(mockAgent);

      const fingerprint: SemanticFingerprint = {
        id: 'fp-1',
        stepId: 'step-1',
        semanticDescription: 'Submit button',
        lastKnownCenter: [100, 100],
        lastKnownRect: { left: 50, top: 75, width: 100, height: 50 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        healingCount: 0,
      };

      vi.mocked(healingStorage.get).mockResolvedValue(fingerprint);

      const result = await engine.heal('step-1', 'Click the button');

      expect(mockAgent.aiLocate).toHaveBeenCalledTimes(2);
      expect(mockAgent.aiLocate).toHaveBeenLastCalledWith('Submit button', { deepThink: true });
      expect(result.success).toBe(true);
      expect(result.strategy).toBe('deepThink');
      expect(result.attemptsCount).toBe(2);
    });

    it('should return failed result when both strategies fail', async () => {
      const mockAgent = createMockAgent({
        aiLocate: vi.fn().mockRejectedValue(new Error('Not found')),
      });
      engine.setAgent(mockAgent);

      const fingerprint: SemanticFingerprint = {
        id: 'fp-1',
        stepId: 'step-1',
        semanticDescription: 'Submit button',
        lastKnownCenter: [100, 100],
        lastKnownRect: { left: 50, top: 75, width: 100, height: 50 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        healingCount: 0,
      };

      vi.mocked(healingStorage.get).mockResolvedValue(fingerprint);

      const result = await engine.heal('step-1', 'Click the button');

      expect(result.success).toBe(false);
      expect(result.attemptsCount).toBe(2);
    });

    it('should skip deepThink when disabled', async () => {
      engine.updateConfig({ enableDeepThink: false });

      const mockAgent = createMockAgent({
        aiLocate: vi.fn().mockRejectedValue(new Error('Not found')),
      });
      engine.setAgent(mockAgent);

      const fingerprint: SemanticFingerprint = {
        id: 'fp-1',
        stepId: 'step-1',
        semanticDescription: 'Submit button',
        lastKnownCenter: [100, 100],
        lastKnownRect: { left: 50, top: 75, width: 100, height: 50 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        healingCount: 0,
      };

      vi.mocked(healingStorage.get).mockResolvedValue(fingerprint);

      const result = await engine.heal('step-1', 'Click the button');

      expect(mockAgent.aiLocate).toHaveBeenCalledTimes(1);
      expect(result.attemptsCount).toBe(1);
    });
  });

  describe('determineAction', () => {
    it('should reject when healing failed', () => {
      const result = engine.determineAction({
        success: false,
        healingId: 'h-1',
        strategy: 'normal',
        attemptsCount: 1,
        confidence: 0,
        confidenceFactors: { distanceScore: 0, sizeScore: 0, strategyScore: 0 },
        timeCost: 100,
      });

      expect(result).toBe('reject');
    });

    it('should auto_accept high confidence results', () => {
      const result = engine.determineAction({
        success: true,
        healingId: 'h-1',
        element: { center: [100, 100], rect: { left: 50, top: 75, width: 100, height: 50 } },
        strategy: 'normal',
        attemptsCount: 1,
        confidence: 90,
        confidenceFactors: { distanceScore: 90, sizeScore: 90, strategyScore: 100 },
        timeCost: 100,
      });

      expect(result).toBe('auto_accept');
    });

    it('should request_confirmation for medium confidence', () => {
      const result = engine.determineAction({
        success: true,
        healingId: 'h-1',
        element: { center: [100, 100], rect: { left: 50, top: 75, width: 100, height: 50 } },
        strategy: 'normal',
        attemptsCount: 1,
        confidence: 65,
        confidenceFactors: { distanceScore: 60, sizeScore: 70, strategyScore: 100 },
        timeCost: 100,
      });

      expect(result).toBe('request_confirmation');
    });

    it('should reject low confidence results', () => {
      const result = engine.determineAction({
        success: true,
        healingId: 'h-1',
        element: { center: [100, 100], rect: { left: 50, top: 75, width: 100, height: 50 } },
        strategy: 'normal',
        attemptsCount: 1,
        confidence: 40,
        confidenceFactors: { distanceScore: 30, sizeScore: 50, strategyScore: 100 },
        timeCost: 100,
      });

      expect(result).toBe('reject');
    });
  });

  describe('getStatistics', () => {
    it('should calculate statistics from history', async () => {
      vi.mocked(healingStorage.getAllHistoryEntries).mockResolvedValue([
        { id: '1', stepId: 's1', timestamp: Date.now(), originalDescription: '', failureReason: '', result: { success: true, healingId: 'h1', strategy: 'normal', attemptsCount: 1, confidence: 90, confidenceFactors: { distanceScore: 90, sizeScore: 90, strategyScore: 100 }, timeCost: 500 }, userConfirmed: true, fingerprintUpdated: true },
        { id: '2', stepId: 's2', timestamp: Date.now(), originalDescription: '', failureReason: '', result: { success: true, healingId: 'h2', strategy: 'deepThink', attemptsCount: 2, confidence: 70, confidenceFactors: { distanceScore: 60, sizeScore: 80, strategyScore: 90 }, timeCost: 1500 }, userConfirmed: true, fingerprintUpdated: true },
        { id: '3', stepId: 's3', timestamp: Date.now(), originalDescription: '', failureReason: '', result: { success: false, healingId: 'h3', strategy: 'normal', attemptsCount: 2, confidence: 0, confidenceFactors: { distanceScore: 0, sizeScore: 0, strategyScore: 0 }, timeCost: 2000 }, userConfirmed: false, fingerprintUpdated: false },
      ]);

      vi.mocked(healingStorage.getAllFingerprints).mockResolvedValue([
        { id: 'f1', stepId: 's1', semanticDescription: '', lastKnownCenter: [0, 0], lastKnownRect: { left: 0, top: 0, width: 0, height: 0 }, createdAt: 0, updatedAt: 0, healingCount: 3 },
        { id: 'f2', stepId: 's2', semanticDescription: '', lastKnownCenter: [0, 0], lastKnownRect: { left: 0, top: 0, width: 0, height: 0 }, createdAt: 0, updatedAt: 0, healingCount: 1 },
      ]);

      const stats = await engine.getStatistics();

      expect(stats.totalAttempts).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
      expect(stats.normalSuccessCount).toBe(1);
      expect(stats.deepThinkSuccessCount).toBe(1);
      expect(stats.averageConfidence).toBe(80); // (90 + 70) / 2
      expect(stats.unstableElements).toHaveLength(2);
      expect(stats.unstableElements[0].healingCount).toBe(3);
    });
  });
});
