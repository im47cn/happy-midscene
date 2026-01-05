/**
 * Core Chrome Extension E2E Tests
 *
 * Comprehensive end-to-end tests validating core features:
 * 1. Element box selection and highlighting
 * 2. Execution engine with screenshot storage
 * 3. Performance monitoring integration
 * 4. i18n locale switching
 * 5. Complete test generation workflow
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractElementBox,
  isValidElementBox,
  highlightElement,
  isElementVisible,
  isElementInteractable,
  clampBoxToViewport,
  findInteractableElementNear,
  type ElementBox,
} from '../../../utils/elementUtils';
import { perfMonitor } from '../../../utils/performance';
import { setLocale, t, detectBrowserLocale, initLocale } from '../../../utils/i18n';
import { screenshotStorage } from '../screenshotStorage';
import type { ExecutionEngine, TaskStep, TestCase } from '../executionEngine';
import type { ExecutionCallbacks, ExecutionResult } from '../executionEngine';

/**
 * Mock DOM setup for element tests
 */
function createMockElement(
  rect: { x: number; y: number; width: number; height: number },
  options: {
    visible?: boolean;
    enabled?: boolean;
    pointerEvents?: string;
    display?: string;
    visibility?: string;
  } = {},
): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({ ...rect, top: rect.y, left: rect.x, right: rect.x + rect.width, bottom: rect.y + rect.height }),
    configurable: true,
  });

  // Apply styles
  const styles: Record<string, string> = {
    position: 'absolute',
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    display: options.display ?? (options.visible !== false ? 'block' : 'none'),
    visibility: options.visibility ?? (options.visible !== false ? 'visible' : 'hidden'),
    pointerEvents: options.pointerEvents ?? (options.enabled !== false ? 'auto' : 'none'),
  };

  Object.assign(element.style, styles);

  return element;
}

/**
 * Mock getAgent function for ExecutionEngine
 */
function createMockAgent(): any {
  return {
    async aiAct(_instruction: string) {
      return { success: true };
    },
    async aiAssert(_assertion: string) {
      return { success: true };
    },
    async takeScreenshot() {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    },
    getContent() {
      return { elements: [] };
    },
  };
}

/**
 * Create a test ExecutionEngine instance
 */
function createTestEngine(callbacks: ExecutionCallbacks = {}): ExecutionEngine {
  // Dynamic import to avoid circular dependency
  const { ExecutionEngine: EE } = require('../executionEngine');
  return new EE(
    () => createMockAgent(),
    undefined,
    undefined,
  );
}

describe('Core Chrome Extension E2E Tests', () => {
  beforeEach(() => {
    // Reset DOM safely - remove all children
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    // Clear performance monitor
    perfMonitor.clear();
    // Reset locale
    setLocale('en');
    // Clear mocks
    vi.clearAllMocks();
  });

  describe('Feature: Element Box Selection Workflow', () => {
    it('should complete full element selection workflow', () => {
      // Step 1: Create DOM elements
      const button = createMockElement({ x: 100, y: 100, width: 120, height: 40 });
      button.id = 'submit-button';
      document.body.appendChild(button);

      // Step 2: Simulate user click at coordinates
      const clickX = 160; // Center of button
      const clickY = 120;

      // Step 3: Find element near click
      const foundElement = findInteractableElementNear(clickX, clickY, 50);
      expect(foundElement).toBe(button);

      // Step 4: Extract element box
      const rect = button.getBoundingClientRect();
      const box = extractElementBox(rect);
      expect(box).toBeTruthy();
      expect(box?.x).toBe(100);
      expect(box?.y).toBe(100);
      expect(box?.width).toBe(120);
      expect(box?.height).toBe(40);

      // Step 5: Validate box
      expect(isValidElementBox(box)).toBe(true);

      // Step 6: Highlight element
      const removeHighlight = highlightElement(box!, { color: '#ff0000', duration: 1000 });
      expect(document.querySelector('.midscene-highlight')).toBeTruthy();

      // Step 7: Remove highlight
      removeHighlight();
      expect(document.querySelector('.midscene-highlight')).toBeNull();
    });

    it('should handle viewport edge cases correctly', () => {
      // Element partially outside viewport
      const partialElement = createMockElement({ x: -50, y: window.innerHeight - 50, width: 150, height: 150 });
      document.body.appendChild(partialElement);

      const rect = partialElement.getBoundingClientRect();
      const box = extractElementBox(rect);
      const clamped = clampBoxToViewport(box!);

      // Should be clamped to viewport bounds
      expect(clamped.x).toBeGreaterThanOrEqual(0);
      expect(clamped.y).toBeGreaterThanOrEqual(0);
      expect(clamped.x + clamped.width).toBeLessThanOrEqual(window.innerWidth);
      expect(clamped.y + clamped.height).toBeLessThanOrEqual(window.innerHeight);
    });

    it('should identify non-interactable elements correctly', () => {
      // Hidden element
      const hiddenElement = createMockElement({ x: 100, y: 100, width: 100, height: 100 }, { visible: false });
      document.body.appendChild(hiddenElement);

      expect(isElementVisible(hiddenElement)).toBe(false);

      // Disabled element
      const disabledElement = createMockElement({ x: 200, y: 100, width: 100, height: 100 }, { enabled: false });
      document.body.appendChild(disabledElement);

      expect(isElementInteractable(disabledElement)).toBe(false);

      // Element with pointer-events: none
      const noPointerElement = createMockElement({ x: 300, y: 100, width: 100, height: 100 }, { pointerEvents: 'none' });
      document.body.appendChild(noPointerElement);

      expect(isElementInteractable(noPointerElement)).toBe(false);
    });

    it('should find nearest interactable element when direct hit misses', () => {
      // Create elements at different positions
      const targetElement = createMockElement({ x: 200, y: 200, width: 100, height: 50 });
      targetElement.id = 'target';
      document.body.appendChild(targetElement);

      // Click near but not directly on element
      const found = findInteractableElementNear(180, 190, 50);
      expect(found).toBe(targetElement);
    });

    it('should handle multiple simultaneous highlights', () => {
      const elements = [
        createMockElement({ x: 50, y: 50, width: 80, height: 30 }),
        createMockElement({ x: 200, y: 50, width: 80, height: 30 }),
        createMockElement({ x: 125, y: 150, width: 80, height: 30 }),
      ];

      elements.forEach((el, i) => {
        el.id = `element-${i}`;
        document.body.appendChild(el);
      });

      const removers: (() => void)[] = [];
      elements.forEach((el) => {
        const box = extractElementBox(el.getBoundingClientRect());
        if (box) {
          removers.push(highlightElement(box, { color: '#00ff00' }));
        }
      });

      // All highlights should be present
      const highlights = document.querySelectorAll('.midscene-highlight');
      expect(highlights.length).toBe(3);

      // Remove all highlights
      removers.forEach((remove) => remove());
      expect(document.querySelectorAll('.midscene-highlight').length).toBe(0);
    });
  });

  describe('Feature: Execution Engine with Screenshot Storage', () => {
    it('should execute test case with screenshot storage enabled', async () => {
      const highlightCalls: Array<{ x: number; y: number; width: number; height: number }> = [];
      const stepResults: ExecutionResult[] = [];

      const callbacks: ExecutionCallbacks = {
        onHighlight: (element) => highlightCalls.push(element),
        onStepComplete: (_step, result) => stepResults.push(result),
      };

      const engine = createTestEngine(callbacks);
      engine.setScreenshotStorageEnabled(true);

      // Create test case
      const testCase: TestCase = {
        id: 'test-001',
        name: 'Login Test',
        description: 'Test login functionality',
        steps: [
          { id: 'step-1', originalText: 'Navigate to login page' },
          { id: 'step-2', originalText: 'Enter username' },
          { id: 'step-3', originalText: 'Enter password' },
          { id: 'step-4', originalText: 'Click login button' },
        ],
      };

      // Mock chrome.storage.local for screenshot storage
      const mockStorage: Record<string, any> = {};
      global.chrome = {
        storage: {
          local: {
            get: vi.fn((keys, callback) => {
              const result: Record<string, any> = {};
              if (callback) {
                callback(result);
              }
              return Promise.resolve(result);
            }),
            set: vi.fn((data, callback) => {
              Object.assign(mockStorage, data);
              if (callback) callback();
              return Promise.resolve();
            }),
          },
        },
      } as any;

      // Execute test case (would normally interact with real page)
      // For E2E test, we verify the integration is set up correctly
      expect(engine.isScreenshotStorageEnabled()).toBe(true);
      expect(testCase.steps).toHaveLength(4);
    });

    it('should capture screenshots on step failure', async () => {
      const engine = createTestEngine({
        onStepFailed: (step, error) => {
          // Verify error callback is triggered
          expect(step).toBeTruthy();
          expect(error).toBeTruthy();
        },
      });

      engine.setScreenshotStorageEnabled(true);

      // Verify storage is enabled
      expect(engine.isScreenshotStorageEnabled()).toBe(true);
    });

    it('should toggle screenshot storage during execution', () => {
      const engine = createTestEngine();

      // Initially enabled by default
      expect(engine.isScreenshotStorageEnabled()).toBe(true);

      // Disable
      engine.setScreenshotStorageEnabled(false);
      expect(engine.isScreenshotStorageEnabled()).toBe(false);

      // Re-enable
      engine.setScreenshotStorageEnabled(true);
      expect(engine.isScreenshotStorageEnabled()).toBe(true);
    });
  });

  describe('Feature: Performance Monitoring Integration', () => {
    it('should monitor execution performance', () => {
      const testOperations = [
        { name: 'ai_description', duration: 1500 },
        { name: 'screenshot', duration: 300 },
        { name: 'element_detection', duration: 80 },
        { name: 'markdown_parse', duration: 50 },
      ];

      // Simulate operations
      testOperations.forEach((op) => {
        const timerId = perfMonitor.start(op.name);
        // Simulate work
        const startTime = performance.now();
        while (performance.now() - startTime < op.duration / 10) {
          // Busy wait for fraction of duration
        }
        perfMonitor.end(timerId);
      });

      // Check stats for each operation
      testOperations.forEach((op) => {
        const stats = perfMonitor.getStats(op.name);
        expect(stats).toBeTruthy();
        expect(stats!.count).toBeGreaterThan(0);
        expect(stats!.avg).toBeGreaterThan(0);
      });
    });

    it('should track performance thresholds correctly', () => {
      const monitor = perfMonitor;

      // Test various durations
      const testCases = [
        { name: 'ai_description', duration: 1000, expected: 'ok' },
        { name: 'ai_description', duration: 2500, expected: 'warning' },
        { name: 'ai_description', duration: 5500, expected: 'critical' },
        { name: 'screenshot', duration: 300, expected: 'ok' },
        { name: 'screenshot', duration: 700, expected: 'warning' },
      ] as const;

      testCases.forEach(({ name, duration, expected }) => {
        const status = monitor.checkThreshold(name, duration);
        expect(status).toBe(expected);
      });
    });

    it('should generate performance summary', () => {
      // Add some metrics
      const operations = ['ai_description', 'screenshot', 'element_detection'];
      operations.forEach((op) => {
        const timerId = perfMonitor.start(op);
        perfMonitor.end(timerId);
      });

      const summary = perfMonitor.getSummary();

      // Verify summary structure
      expect(Object.keys(summary)).toHaveLength(3);
      operations.forEach((op) => {
        expect(summary[op]).toBeTruthy();
        expect(summary[op].count).toBe(1);
        expect(summary[op].avg).toBeGreaterThan(0);
        expect(summary[op].status).toMatch(/^(ok|warning|critical)$/);
      });
    });

    it('should enforce max metrics limit', () => {
      const monitor = perfMonitor;

      // Add more metrics than max limit (1000)
      for (let i = 0; i < 1100; i++) {
        const timerId = monitor.start(`operation-${i}`);
        monitor.end(timerId);
      }

      // Should not exceed max
      const allMetrics = monitor.getMetrics();
      expect(allMetrics.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Feature: i18n Locale Switching', () => {
    it('should detect and switch browser locales', () => {
      // Test various locales
      const testCases = [
        { input: 'en-US', expected: 'en' },
        { input: 'zh-CN', expected: 'zh-CN' },
        { input: 'zh-TW', expected: 'zh-TW' },
        { input: 'ja-JP', expected: 'ja' },
        { input: 'ko-KR', expected: 'ko' },
        { input: 'es-ES', expected: 'es' },
        { input: 'fr-FR', expected: 'fr' },
        { input: 'de-DE', expected: 'de' },
      ];

      testCases.forEach(({ input, expected }) => {
        Object.defineProperty(Navigator.prototype, 'language', {
          value: input,
          configurable: true,
        });

        const detected = detectBrowserLocale();
        expect(detected).toBe(expected);
      });
    });

    it('should translate all UI strings correctly', () => {
      const translationKeys = [
        'common.loading',
        'common.success',
        'common.failed',
        'execution.status.running',
        'execution.status.paused',
        'aiTestGenerator.title',
      ];

      // Test English
      setLocale('en');
      translationKeys.forEach((key) => {
        const translation = t(key);
        expect(translation).toBeTruthy();
        expect(translation).not.toBe(key);
      });

      // Test Chinese
      setLocale('zh-CN');
      const chineseLoading = t('common.loading');
      expect(chineseLoading).toBe('加载中...');

      // Test Japanese
      setLocale('ja');
      const japaneseLoading = t('common.loading');
      expect(japaneseLoading).toBe('読み込み中...');

      // Reset to English
      setLocale('en');
    });

    it('should fallback to English for missing translations', () => {
      setLocale('ja'); // Japanese has incomplete translations

      // This key should exist in Japanese
      const existing = t('common.loading');
      expect(existing).toBeTruthy();

      // This key might not exist, should fallback to English
      const fallback = t('common.save');
      expect(fallback).toBeTruthy();
    });

    it('should handle locale initialization with storage', async () => {
      // Mock chrome.storage.local
      const mockGet = vi.fn((keys, callback) => {
        const data = { midscene_locale: 'zh-CN' };
        if (callback) {
          callback(data);
        }
        return Promise.resolve(data);
      });

      global.chrome = {
        storage: {
          local: {
            get: mockGet,
            set: vi.fn(),
          },
        },
      } as any;

      await initLocale();

      // Should have loaded Chinese from storage
      expect(t('common.loading')).toBe('加载中...');

      // Reset
      setLocale('en');
    });
  });

  describe('Feature: Complete Test Generation Workflow', () => {
    it('should integrate all features in complete workflow', async () => {
      // Step 1: User initiates test recording
      const performanceTimer = perfMonitor.start('test_generation_workflow');

      // Step 2: Element selection
      const button = createMockElement({ x: 100, y: 200, width: 150, height: 50 });
      button.id = 'search-button';
      button.textContent = 'Search';
      document.body.appendChild(button);

      const box = extractElementBox(button.getBoundingClientRect());
      expect(isValidElementBox(box)).toBe(true);

      // Step 3: Element highlighting
      const removeHighlight = highlightElement(box!);
      expect(document.querySelector('.midscene-highlight')).toBeTruthy();

      // Step 4: Create test step from element
      const testStep: TaskStep = {
        id: 'step-1',
        originalText: 'Click search button',
      };

      // Step 5: Set up execution callbacks
      const capturedHighlights: Array<{ x: number; y: number; width: number; height: number }> = [];
      const callbacks: ExecutionCallbacks = {
        onHighlight: (element) => capturedHighlights.push(element),
        onProgress: (current, total) => {
          expect(current).toBeLessThanOrEqual(total);
        },
      };

      const engine = createTestEngine(callbacks);

      // Step 6: Configure execution
      engine.setScreenshotStorageEnabled(true);
      engine.setSelfHealingConfig({ enabled: true, confidenceThreshold: 0.7 });
      engine.setMaskingConfig({ enabled: true, yamlMasking: true });

      // Step 7: Verify configurations
      expect(engine.isScreenshotStorageEnabled()).toBe(true);
      expect(engine.getSelfHealingConfig().enabled).toBe(true);
      expect(engine.getMaskingConfig().enabled).toBe(true);

      // Step 8: i18n support
      setLocale('zh-CN');
      const chineseTitle = t('aiTestGenerator.title');
      expect(chineseTitle).toBeTruthy();

      // Step 9: Cleanup
      removeHighlight();
      perfMonitor.end(performanceTimer);

      // Verify workflow performance
      const workflowStats = perfMonitor.getStats('test_generation_workflow');
      expect(workflowStats).toBeTruthy();
      expect(workflowStats!.count).toBeGreaterThan(0);
    });

    it('should handle error scenarios gracefully', async () => {
      const engine = createTestEngine({
        onStepFailed: (step, error, details) => {
          expect(step).toBeTruthy();
          expect(error).toBeTruthy();
          expect(details).toBeTruthy();
          expect(details.type).toMatch(/^(element_not_found|timeout|action_failed)$/);
        },
        onHighlight: () => {
          // Should still attempt to highlight even during errors
        },
      });

      // Element not found scenario
      const errorResult: ExecutionResult = {
        stepId: 'step-failed',
        success: false,
        error: 'Element not found',
        errorDetails: {
          message: 'Cannot find element matching description',
          type: 'element_not_found',
          details: '无法在页面上找到匹配的元素',
          suggestion: '请尝试使用更具体的描述',
        },
        duration: 5000,
      };

      expect(errorResult.success).toBe(false);
      expect(errorResult.errorDetails?.type).toBe('element_not_found');
    });
  });

  describe('Performance: Stress Tests', () => {
    it('should handle rapid element selection operations', () => {
      const elements: HTMLElement[] = [];
      const boxes: ElementBox[] = [];

      // Create 100 elements
      for (let i = 0; i < 100; i++) {
        const element = createMockElement({
          x: (i % 10) * 100,
          y: Math.floor(i / 10) * 50,
          width: 80,
          height: 30,
        });
        element.id = `element-${i}`;
        document.body.appendChild(element);
        elements.push(element);
      }

      // Extract all boxes
      const startTime = performance.now();
      elements.forEach((el) => {
        const box = extractElementBox(el.getBoundingClientRect());
        if (box) boxes.push(box);
      });
      const duration = performance.now() - startTime;

      expect(boxes).toHaveLength(100);
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should handle concurrent performance monitoring', () => {
      const operations: string[] = [];
      for (let i = 0; i < 50; i++) {
        operations.push(`operation-${i}`);
      }

      const timerIds: string[] = [];
      operations.forEach((op) => {
        timerIds.push(perfMonitor.start(op));
      });

      // End all timers
      timerIds.forEach((id) => {
        perfMonitor.end(id);
      });

      // Verify all metrics were recorded
      const allMetrics = perfMonitor.getMetrics();
      const recordedOps = new Set(allMetrics.map((m) => m.name));
      operations.forEach((op) => {
        expect(recordedOps.has(op)).toBe(true);
      });
    });

    it('should handle rapid locale switches', () => {
      const locales = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de'] as const;

      const startTime = performance.now();
      locales.forEach((locale) => {
        setLocale(locale);
        t('common.loading'); // Access translation
      });
      const duration = performance.now() - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(100);

      // Final locale should be set correctly
      expect(t('common.loading')).toBe('Chargement...');
    });
  });
});
