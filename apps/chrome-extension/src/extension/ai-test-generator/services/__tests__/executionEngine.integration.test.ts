/**
 * Integration Tests for ExecutionEngine
 * Tests the interaction between ExecutionEngine, Healing, and Analytics systems
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionRecord } from '../../types/analytics';
import type { HealingResult, SemanticFingerprint } from '../../types/healing';
import { ExecutionEngine } from '../executionEngine';
import type { TaskStep, TestCase } from '../markdownParser';

// Mock healing storage
vi.mock('../healing/storage', () => ({
  healingStorage: {
    get: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    getAllHistoryEntries: vi.fn().mockResolvedValue([]),
    getAllFingerprints: vi.fn().mockResolvedValue([]),
    cleanupExpired: vi.fn().mockResolvedValue(0),
    getHistoryByHealingId: vi.fn().mockResolvedValue(null),
    updateHistoryEntry: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock analytics storage
vi.mock('../analytics/analyticsStorage', () => ({
  analyticsStorage: {
    addExecution: vi.fn().mockResolvedValue(undefined),
    getDailyStats: vi.fn().mockResolvedValue(null),
    saveDailyStats: vi.fn().mockResolvedValue(undefined),
    getCaseStats: vi.fn().mockResolvedValue(null),
    saveCaseStats: vi.fn().mockResolvedValue(undefined),
    getExecutionsByTimeRange: vi.fn().mockResolvedValue([]),
    getAlertRules: vi.fn().mockResolvedValue([]),
    getAllAlertRules: vi.fn().mockResolvedValue([]),
    getEnabledAlertRules: vi.fn().mockResolvedValue([]),
    saveAlertRule: vi.fn().mockResolvedValue(undefined),
    saveAlertRules: vi.fn().mockResolvedValue(undefined),
    getAlertEvents: vi.fn().mockResolvedValue([]),
    addAlertEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

import { analyticsStorage } from '../analytics/analyticsStorage';
import { healingStorage } from '../healing/storage';

describe('ExecutionEngine Integration', () => {
  let mockAgent: any;
  let getAgent: () => any;
  let engine: ExecutionEngine;

  const createMockPage = () => ({
    goto: vi.fn().mockResolvedValue(undefined),
    mouse: {
      click: vi.fn().mockResolvedValue(undefined),
    },
    keyboard: {
      type: vi.fn().mockResolvedValue(undefined),
    },
    destroy: vi.fn().mockResolvedValue(undefined),
    sendCommandToDebugger: vi.fn().mockResolvedValue(undefined),
  });

  const createMockAgent = (overrides = {}) => ({
    aiAct: vi.fn().mockResolvedValue(undefined),
    page: createMockPage(),
    dump: {
      executions: [
        {
          tasks: [
            {
              type: 'Planning',
              subType: 'Locate',
              output: {
                element: {
                  center: [100, 100] as [number, number],
                  rect: { left: 50, top: 75, width: 100, height: 50 },
                  description: 'Login button',
                },
              },
            },
          ],
        },
      ],
    },
    describeElementAtPoint: vi.fn().mockResolvedValue({
      prompt: 'A blue login button',
      deepThink: false,
      verifyResult: true,
    }),
    aiLocate: vi.fn().mockResolvedValue({
      center: [100, 100],
      rect: { left: 50, top: 75, width: 100, height: 50 },
    }),
    ...overrides,
  });

  const createTestCase = (steps: Partial<TaskStep>[]): TestCase => ({
    id: 'test-case-1',
    name: 'Integration Test Case',
    description: 'Test case for integration testing',
    steps: steps.map((step, index) => ({
      id: `step-${index + 1}`,
      originalText: step.originalText || `Step ${index + 1}`,
      status: 'pending' as const,
      ...step,
    })),
    potentialParams: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent = createMockAgent();
    getAgent = vi.fn().mockReturnValue(mockAgent);
    engine = new ExecutionEngine(getAgent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Execution with Self-Healing', () => {
    it('should collect fingerprint after successful step execution', async () => {
      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      engine.setSelfHealingConfig({ enabled: true });

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      // Verify fingerprint was saved
      expect(healingStorage.save).toHaveBeenCalled();
    });

    it('should attempt healing when element not found', async () => {
      const elementNotFoundError = new Error(
        'Element not found: 无法找到目标元素',
      );
      mockAgent.aiAct.mockRejectedValueOnce(elementNotFoundError);

      // Setup existing fingerprint
      const existingFingerprint: SemanticFingerprint = {
        id: 'fp-1',
        stepId: 'step-1',
        semanticDescription: 'A blue login button',
        lastKnownCenter: [100, 100],
        lastKnownRect: { left: 50, top: 75, width: 100, height: 50 },
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
        healingCount: 0,
      };
      vi.mocked(healingStorage.get).mockResolvedValue(existingFingerprint);

      // Mock getHistoryByHealingId to return history entry for confirmHealing
      vi.mocked(healingStorage.getHistoryByHealingId).mockResolvedValue({
        id: 'history-1',
        stepId: 'step-1',
        timestamp: Date.now(),
        originalDescription: '点击登录按钮',
        failureReason: '',
        result: {
          success: true,
          healingId: 'healing-1',
          element: {
            center: [100, 100] as [number, number],
            rect: { left: 50, top: 75, width: 100, height: 50 },
          },
          strategy: 'normal',
          attemptsCount: 1,
          confidence: 80,
          confidenceFactors: {
            distanceScore: 90,
            sizeScore: 85,
            strategyScore: 100,
          },
          timeCost: 500,
        },
        userConfirmed: false,
        fingerprintUpdated: false,
      });

      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      engine.setSelfHealingConfig({
        enabled: true,
        autoAcceptThreshold: 50, // Low threshold for auto-accept
      });

      const healingAttemptCallback = vi.fn();
      engine.setCallbacks({
        onHealingAttempt: healingAttemptCallback,
      });

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      // Verify healing was attempted
      expect(mockAgent.aiLocate).toHaveBeenCalled();
    });

    it('should skip healing when disabled', async () => {
      const elementNotFoundError = new Error('Element not found');
      mockAgent.aiAct.mockRejectedValue(elementNotFoundError);

      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      engine.setSelfHealingConfig({ enabled: false });

      // Need to resume after failure to complete the test
      // IMPORTANT: Use setTimeout to ensure stop() is called after resumeResolve is assigned
      let resumeTriggered = false;
      engine.setCallbacks({
        onStepFailed: () => {
          if (!resumeTriggered) {
            resumeTriggered = true;
            // Stop execution asynchronously to allow resumeResolve to be assigned
            setTimeout(() => engine.stop(), 0);
          }
        },
      });

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      // Verify healing was not attempted
      expect(mockAgent.aiLocate).not.toHaveBeenCalled();
    });
  });

  describe('Execution with Analytics Recording', () => {
    it('should record execution to analytics after test completion', async () => {
      const testCase = createTestCase([
        { originalText: '点击登录按钮' },
        { originalText: '输入用户名' },
      ]);

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      // Verify execution was recorded
      expect(analyticsStorage.addExecution).toHaveBeenCalled();
      expect(analyticsStorage.saveDailyStats).toHaveBeenCalled();
      expect(analyticsStorage.saveCaseStats).toHaveBeenCalled();
    });

    it('should record failed execution with failure details', async () => {
      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      const error = new Error('Click failed: 元素被遮挡');
      mockAgent.aiAct.mockRejectedValue(error);

      engine.setCallbacks({
        onStepFailed: () => {
          // Stop execution asynchronously to allow resumeResolve to be assigned
          setTimeout(() => engine.stop(), 0);
        },
      });

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      // Verify execution was recorded even for failures
      expect(analyticsStorage.addExecution).toHaveBeenCalled();
    });

    it('should include healing info in analytics when healing succeeds', async () => {
      // First call fails (triggers healing)
      const elementNotFoundError = new Error('Element not found: 找不到元素');
      mockAgent.aiAct.mockRejectedValueOnce(elementNotFoundError);

      const existingFingerprint: SemanticFingerprint = {
        id: 'fp-1',
        stepId: 'step-1',
        semanticDescription: 'A login button',
        lastKnownCenter: [100, 100],
        lastKnownRect: { left: 50, top: 75, width: 100, height: 50 },
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
        healingCount: 0,
      };
      vi.mocked(healingStorage.get).mockResolvedValue(existingFingerprint);

      // Mock getHistoryByHealingId to return history entry for confirmHealing
      vi.mocked(healingStorage.getHistoryByHealingId).mockResolvedValue({
        id: 'history-1',
        stepId: 'step-1',
        timestamp: Date.now(),
        originalDescription: '点击登录按钮',
        failureReason: '',
        result: {
          success: true,
          healingId: 'healing-1',
          element: {
            center: [100, 100] as [number, number],
            rect: { left: 50, top: 75, width: 100, height: 50 },
          },
          strategy: 'normal',
          attemptsCount: 1,
          confidence: 80,
          confidenceFactors: {
            distanceScore: 90,
            sizeScore: 85,
            strategyScore: 100,
          },
          timeCost: 500,
        },
        userConfirmed: false,
        fingerprintUpdated: false,
      });

      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      engine.setSelfHealingConfig({
        enabled: true,
        autoAcceptThreshold: 50,
      });

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      // Verify analytics was recorded
      expect(analyticsStorage.addExecution).toHaveBeenCalled();
    });
  });

  describe('Execution Flow Control', () => {
    it('should pause on failure and resume when prompted', async () => {
      const testCase = createTestCase([
        { originalText: '点击登录按钮' },
        { originalText: '输入用户名' },
      ]);

      // First step fails
      mockAgent.aiAct
        .mockRejectedValueOnce(new Error('Element not found'))
        .mockResolvedValue(undefined);

      let pausedAtStep = -1;
      engine.setCallbacks({
        onStepFailed: (step, error) => {
          pausedAtStep = Number.parseInt(step.id.split('-')[1]) - 1;
          // Resume execution after a delay
          setTimeout(() => {
            engine.stop();
          }, 10);
        },
      });

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      expect(pausedAtStep).toBe(0);
    });

    it('should stop execution cleanly', async () => {
      const testCase = createTestCase([
        { originalText: '点击登录按钮' },
        { originalText: '输入用户名' },
        { originalText: '点击提交' },
      ]);

      let stepsExecuted = 0;
      mockAgent.aiAct.mockImplementation(async () => {
        stepsExecuted++;
        if (stepsExecuted === 1) {
          engine.stop();
        }
      });

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      expect(stepsExecuted).toBe(1);
    });
  });

  describe('YAML Generation', () => {
    it('should generate correct YAML from executed test case', async () => {
      const testCase = createTestCase([
        { originalText: '点击登录按钮' },
        { originalText: '在用户名框输入"testuser"' },
        { originalText: '验证页面标题' },
      ]);

      const result = await engine.executeTestCase(testCase, {
        url: 'https://example.com',
        viewportWidth: 1920,
        viewportHeight: 1080,
      });

      expect(result.yamlContent).toContain('target:');
      expect(result.yamlContent).toContain('url: "https://example.com"');
      expect(result.yamlContent).toContain('viewportWidth: 1920');
      expect(result.yamlContent).toContain('cases:');
      expect(result.yamlContent).toContain('flow:');
    });

    it('should generate YAML with ai actions', async () => {
      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      const result = await engine.executeTestCase(testCase, {
        url: 'https://example.com',
      });

      expect(result.yamlContent).toContain('ai:');
    });
  });

  describe('Device Emulation Integration', () => {
    it('should apply device emulation via CDP', async () => {
      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      await engine.executeTestCase(testCase, {
        url: 'https://example.com',
        deviceEmulation: {
          deviceId: 'iphone-14',
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          isMobile: true,
          hasTouch: true,
        },
      });

      // Verify CDP commands were sent
      expect(mockAgent.page.sendCommandToDebugger).toHaveBeenCalledWith(
        'Emulation.setDeviceMetricsOverride',
        expect.objectContaining({
          width: 390,
          height: 844,
          mobile: true,
        }),
      );

      expect(mockAgent.page.sendCommandToDebugger).toHaveBeenCalledWith(
        'Emulation.setUserAgentOverride',
        expect.objectContaining({
          userAgent: expect.stringContaining('iPhone'),
        }),
      );
    });

    it('should clear device emulation after execution', async () => {
      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      await engine.executeTestCase(testCase, {
        url: 'https://example.com',
        deviceEmulation: {
          deviceId: 'iphone-14',
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          userAgent: 'Mozilla/5.0 (iPhone)',
          isMobile: true,
          hasTouch: true,
        },
      });

      // Verify cleanup was called
      expect(mockAgent.page.sendCommandToDebugger).toHaveBeenCalledWith(
        'Emulation.clearDeviceMetricsOverride',
        {},
      );
    });
  });

  describe('Callbacks Integration', () => {
    it('should invoke all callbacks during execution', async () => {
      const callbacks = {
        onStepStart: vi.fn(),
        onStepComplete: vi.fn(),
        onProgress: vi.fn(),
      };

      engine.setCallbacks(callbacks);

      const testCase = createTestCase([
        { originalText: '点击登录按钮' },
        { originalText: '输入用户名' },
      ]);

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      expect(callbacks.onStepStart).toHaveBeenCalledTimes(2);
      expect(callbacks.onStepComplete).toHaveBeenCalledTimes(2);
      expect(callbacks.onProgress).toHaveBeenCalledWith(1, 2);
      expect(callbacks.onProgress).toHaveBeenCalledWith(2, 2);
    });

    it('should invoke onStepFailed callback on failure', async () => {
      const onStepFailed = vi.fn().mockImplementation(() => {
        // Stop execution asynchronously to allow resumeResolve to be assigned
        setTimeout(() => engine.stop(), 0);
      });

      engine.setCallbacks({ onStepFailed });

      mockAgent.aiAct.mockRejectedValue(new Error('Test error'));

      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      expect(onStepFailed).toHaveBeenCalled();
      expect(onStepFailed.mock.calls[0][1]).toBe('Test error');
    });
  });

  describe('Error Handling Integration', () => {
    it('should parse element_not_found errors correctly', async () => {
      mockAgent.aiAct.mockRejectedValue(new Error('Element not found'));

      let errorDetails: any;
      engine.setCallbacks({
        onStepFailed: (step, error, details) => {
          errorDetails = details;
          // Stop execution asynchronously to allow resumeResolve to be assigned
          setTimeout(() => engine.stop(), 0);
        },
      });

      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      expect(errorDetails?.type).toBe('element_not_found');
    });

    it('should parse timeout errors correctly', async () => {
      mockAgent.aiAct.mockRejectedValue(new Error('Operation timed out'));

      let errorDetails: any;
      engine.setCallbacks({
        onStepFailed: (step, error, details) => {
          errorDetails = details;
          // Stop execution asynchronously to allow resumeResolve to be assigned
          setTimeout(() => engine.stop(), 0);
        },
      });

      const testCase = createTestCase([{ originalText: '点击登录按钮' }]);

      await engine.executeTestCase(testCase, { url: 'https://example.com' });

      expect(errorDetails?.type).toBe('timeout');
    });
  });
});
