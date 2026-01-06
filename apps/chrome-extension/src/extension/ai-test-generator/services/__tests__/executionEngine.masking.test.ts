/**
 * ExecutionEngine Masking Integration Tests
 * Tests for screenshot and log masking functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the masking module
vi.mock('../masking', () => ({
  detectScreenshotMaskRegions: vi.fn(() => []),
  imageMasker: {
    maskScreenshot: vi.fn().mockResolvedValue({
      imageData: null,
      result: {
        originalSize: { width: 100, height: 100 },
        regions: [],
        processingTime: 10,
      },
    }),
  },
  logMasker: {
    wrapConsole: vi.fn(),
    unwrapConsole: vi.fn(),
  },
  maskerEngine: {
    setConfig: vi.fn(),
    maskText: vi.fn().mockResolvedValue({
      original: 'test',
      masked: 'test',
      matches: [],
      processingTime: 1,
    }),
  },
}));

// Mock healing module
vi.mock('../healing', () => ({
  healingEngine: {
    updateConfig: vi.fn(),
    setAgent: vi.fn(),
    collectFingerprint: vi.fn(),
  },
}));

// Mock analytics module
vi.mock('../analytics', () => ({
  alertManager: {
    checkAlerts: vi.fn(),
  },
  dataCollector: {
    createExecutionRecord: vi.fn(() => ({})),
    recordExecution: vi.fn(),
  },
}));

describe('ExecutionEngine Masking Integration', () => {
  let ExecutionEngine: typeof import('../executionEngine').ExecutionEngine;
  let logMasker: typeof import('../masking').logMasker;
  let imageMasker: typeof import('../masking').imageMasker;
  let maskerEngine: typeof import('../masking').maskerEngine;

  beforeEach(async () => {
    vi.resetModules();

    // Re-import after reset
    const executionModule = await import('../executionEngine');
    ExecutionEngine = executionModule.ExecutionEngine;

    const maskingModule = await import('../masking');
    logMasker = maskingModule.logMasker;
    imageMasker = maskingModule.imageMasker;
    maskerEngine = maskingModule.maskerEngine;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Masking Configuration', () => {
    it('should initialize with default masking config', () => {
      const engine = new ExecutionEngine(() => null);

      const config = engine.getMaskingConfig();
      expect(config.enabled).toBe(true);
      expect(config.screenshotMasking).toBeDefined();
      expect(config.logMasking).toBeDefined();
    });

    it('should accept custom masking config in constructor', () => {
      const engine = new ExecutionEngine(() => null, undefined, {
        enabled: false,
        screenshotMasking: 'strict',
      });

      const config = engine.getMaskingConfig();
      expect(config.enabled).toBe(false);
      expect(config.screenshotMasking).toBe('strict');
    });

    it('should update masking config via setMaskingConfig', () => {
      const engine = new ExecutionEngine(() => null);

      engine.setMaskingConfig({ logMasking: false });

      expect(maskerEngine.setConfig).toHaveBeenCalledWith({
        logMasking: false,
      });
    });
  });

  describe('Log Masking', () => {
    it('should wrap console when log masking is enabled', async () => {
      const mockAgent = {
        page: {
          goto: vi.fn(),
          screenshot: vi.fn().mockResolvedValue('base64screenshot'),
          evaluate: vi.fn().mockResolvedValue([]),
        },
        aiAct: vi.fn(),
        dump: { executions: [] },
      };

      const engine = new ExecutionEngine(() => mockAgent, undefined, {
        enabled: true,
        logMasking: true,
      });

      // Start execution (which should wrap console)
      const testCase = {
        id: 'test-1',
        name: 'Test Case',
        steps: [
          {
            id: 'step-1',
            originalText: 'Click button',
            status: 'pending' as const,
          },
        ],
        potentialParams: [],
      };

      try {
        await engine.executeTestCase(testCase);
      } catch {
        // Ignore errors, we just want to check if console was wrapped
      }

      expect(logMasker.wrapConsole).toHaveBeenCalled();
      expect(logMasker.unwrapConsole).toHaveBeenCalled();
    });

    it('should not wrap console when log masking is disabled', async () => {
      const mockAgent = {
        page: {
          goto: vi.fn(),
          screenshot: vi.fn().mockResolvedValue('base64screenshot'),
          evaluate: vi.fn().mockResolvedValue([]),
        },
        aiAct: vi.fn(),
        dump: { executions: [] },
      };

      const engine = new ExecutionEngine(() => mockAgent, undefined, {
        enabled: true,
        logMasking: false,
      });

      const testCase = {
        id: 'test-1',
        name: 'Test Case',
        steps: [
          {
            id: 'step-1',
            originalText: 'Click button',
            status: 'pending' as const,
          },
        ],
        potentialParams: [],
      };

      try {
        await engine.executeTestCase(testCase);
      } catch {
        // Ignore errors
      }

      expect(logMasker.wrapConsole).not.toHaveBeenCalled();
    });
  });

  describe('Screenshot Masking', () => {
    it('should call takeScreenshot with masking enabled', async () => {
      const mockAgent = {
        page: {
          goto: vi.fn(),
          screenshot: vi.fn().mockResolvedValue('base64screenshot'),
          evaluate: vi.fn().mockResolvedValue([]),
        },
        aiAct: vi.fn(),
        dump: { executions: [] },
      };

      const engine = new ExecutionEngine(() => mockAgent, undefined, {
        enabled: true,
        screenshotMasking: 'standard',
      });

      // Access the agent via executeTestCase flow
      const testCase = {
        id: 'test-1',
        name: 'Test Case',
        steps: [
          {
            id: 'step-1',
            originalText: 'Click button',
            status: 'pending' as const,
          },
        ],
        potentialParams: [],
      };

      try {
        await engine.executeTestCase(testCase);
      } catch {
        // Ignore errors
      }

      // Verify screenshot was taken and masking was attempted
      expect(mockAgent.page.screenshot).toHaveBeenCalled();
      expect(imageMasker.maskScreenshot).toHaveBeenCalled();
    });

    it('should not mask when screenshot masking is off', async () => {
      const mockAgent = {
        page: {
          goto: vi.fn(),
          screenshot: vi.fn().mockResolvedValue('base64screenshot'),
          evaluate: vi.fn().mockResolvedValue([]),
        },
        aiAct: vi.fn(),
        dump: { executions: [] },
      };

      const engine = new ExecutionEngine(() => mockAgent, undefined, {
        enabled: true,
        screenshotMasking: 'off',
      });

      const testCase = {
        id: 'test-1',
        name: 'Test Case',
        steps: [
          {
            id: 'step-1',
            originalText: 'Click button',
            status: 'pending' as const,
          },
        ],
        potentialParams: [],
      };

      try {
        await engine.executeTestCase(testCase);
      } catch {
        // Ignore errors
      }

      // Screenshot should be taken but not masked
      expect(mockAgent.page.screenshot).toHaveBeenCalled();
      expect(imageMasker.maskScreenshot).not.toHaveBeenCalled();
    });
  });

  describe('YAML Sensitive Data Check', () => {
    it('should detect sensitive data in YAML', async () => {
      vi.mocked(maskerEngine.maskText).mockResolvedValueOnce({
        original: 'password: secret123',
        masked: 'password: [PASSWORD]',
        matches: [
          {
            ruleId: 'password',
            ruleName: 'Password',
            category: 'credential',
            position: { start: 10, end: 19 },
            originalValue: 'secret123',
            maskedValue: '[PASSWORD]',
          },
        ],
        processingTime: 1,
      });

      const engine = new ExecutionEngine(() => null);

      const result = await engine.checkYamlForSensitiveData(
        'password: secret123',
      );

      expect(result.hasSensitiveData).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.maskedYaml).toBe('password: [PASSWORD]');
    });

    it('should return no warnings when YAML is clean', async () => {
      vi.mocked(maskerEngine.maskText).mockResolvedValueOnce({
        original: 'name: test',
        masked: 'name: test',
        matches: [],
        processingTime: 1,
      });

      const engine = new ExecutionEngine(() => null);

      const result = await engine.checkYamlForSensitiveData('name: test');

      expect(result.hasSensitiveData).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
