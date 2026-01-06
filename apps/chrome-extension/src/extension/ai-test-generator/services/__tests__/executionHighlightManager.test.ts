/**
 * Unit tests for ExecutionHighlightManager
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ExecutionHighlightManager,
  getHighlightManager,
  resetHighlightManager,
} from '../executionHighlightManager';
import type { HighlightRect } from '../executionHighlighter';

// Store original global chrome
const originalChrome = (globalThis as any).chrome;

// Mock Chrome scripting API
const mockExecuteScript = vi.fn();
const mockTabsQuery = vi.fn();

const mockChrome = {
  scripting: {
    executeScript: mockExecuteScript,
  },
  tabs: {
    query: mockTabsQuery,
  },
};

describe('ExecutionHighlightManager', () => {
  let manager: ExecutionHighlightManager;

  beforeEach(() => {
    // Reset singleton
    resetHighlightManager();

    // Stub chrome globally
    (globalThis as any).chrome = mockChrome;
    (mockTabsQuery as any).mockResolvedValue([{ id: 1 }]);
    (mockExecuteScript as any).mockResolvedValue([{ result: true }]);

    manager = getHighlightManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original chrome
    (globalThis as any).chrome = originalChrome;
  });

  describe('initialization', () => {
    it('should have default config', () => {
      const config = manager.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.autoRemoveDuration).toBe(2000);
      expect(config.showSuccessHighlights).toBe(true);
      expect(config.showFailedHighlights).toBe(true);
    });

    it('should accept custom config', () => {
      resetHighlightManager();
      manager = getHighlightManager({
        enabled: false,
        autoRemoveDuration: 5000,
      });

      const config = manager.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.autoRemoveDuration).toBe(5000);
    });

    it('should update config', () => {
      manager.setConfig({ enabled: false });

      expect(manager.getConfig().enabled).toBe(false);
    });

    it('should preserve other config when updating partial', () => {
      manager.setConfig({ enabled: false });

      const config = manager.getConfig();
      expect(config.autoRemoveDuration).toBe(2000); // preserved
      expect(config.enabled).toBe(false); // updated
    });
  });

  describe('initialize', () => {
    it('should inject script when enabled', async () => {
      const result = await manager.initialize();

      expect(mockTabsQuery).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        func: expect.any(Function),
      });
      expect(result).toBe(true);
    });

    it('should not inject when disabled', async () => {
      manager.setConfig({ enabled: false });

      const result = await manager.initialize();

      expect(mockExecuteScript).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should check if already initialized', async () => {
      // Use a fresh manager for this test
      resetHighlightManager();
      const freshManager = getHighlightManager();

      // First call - not initialized yet
      (mockExecuteScript as any).mockClear();
      (mockExecuteScript as any).mockResolvedValueOnce([{ result: false }]); // check call
      (mockExecuteScript as any).mockResolvedValueOnce([{ result: true }]); // inject call (returns true)
      await freshManager.initialize();

      // Second call - check existing
      (mockExecuteScript as any).mockResolvedValueOnce([{ result: true }]); // already initialized
      const result = await freshManager.initialize();

      // Total calls: first initialize (2 calls: check + inject) + second initialize (1 call: check)
      expect(mockExecuteScript).toHaveBeenCalledTimes(3);
      expect(result).toBe(true);
    });

    it('should handle missing tab', async () => {
      (mockTabsQuery as any).mockResolvedValue([]);

      const result = await manager.initialize();

      expect(result).toBe(false);
    });

    it('should handle script injection error', async () => {
      (mockExecuteScript as any).mockRejectedValue(
        new Error('Injection failed'),
      );

      const result = await manager.initialize();

      expect(result).toBe(false);
    });
  });

  describe('highlighting operations', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should send highlight message', async () => {
      const rect: HighlightRect = { x: 100, y: 200, width: 150, height: 50 };

      await manager.highlight(rect, 'current');

      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        args: [
          {
            type: 'highlight',
            rect: { x: 100, y: 200, width: 150, height: 50, duration: 2000 },
            highlightType: 'current',
          },
        ],
        func: expect.any(Function),
      });
    });

    it('should use custom duration from rect', async () => {
      const rect: HighlightRect = {
        x: 100,
        y: 200,
        width: 150,
        height: 50,
        duration: 5000,
      };

      await manager.highlightCurrent(rect);

      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        args: [
          expect.objectContaining({
            rect: expect.objectContaining({ duration: 5000 }),
          }),
        ],
        func: expect.any(Function),
      });
    });

    it('should not send when disabled', async () => {
      manager.setConfig({ enabled: false });

      await manager.highlightCurrent({ x: 0, y: 0, width: 100, height: 100 });

      expect(mockExecuteScript).toHaveBeenCalledTimes(1); // only from initialize
    });

    it('should send markAsSuccess message', async () => {
      await manager.markAsSuccess();

      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        args: [{ type: 'markAsSuccess' }],
        func: expect.any(Function),
      });
    });

    it('should not send markAsSuccess when disabled in config', async () => {
      manager.setConfig({ showSuccessHighlights: false });

      await manager.markAsSuccess();

      // Only initialize call, no markAsSuccess call
      expect(mockExecuteScript).toHaveBeenCalledTimes(1);
    });

    it('should send markAsFailed message', async () => {
      await manager.markAsFailed();

      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        args: [{ type: 'markAsFailed' }],
        func: expect.any(Function),
      });
    });

    it('should not send markAsFailed when disabled in config', async () => {
      manager.setConfig({ showFailedHighlights: false });

      await manager.markAsFailed();

      // Only initialize call, no markAsFailed call
      expect(mockExecuteScript).toHaveBeenCalledTimes(1);
    });

    it('should send clearAll message', async () => {
      await manager.clearAll();

      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        args: [{ type: 'clearAll' }],
        func: expect.any(Function),
      });
    });
  });

  describe('cleanup', () => {
    it('should send cleanup message', async () => {
      await manager.initialize();
      await manager.cleanup();

      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        args: [{ type: 'cleanup' }],
        func: expect.any(Function),
      });
    });

    it('should reset initialized flag', async () => {
      await manager.initialize();
      await manager.cleanup();

      expect(manager['initialized']).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle highlight errors gracefully', async () => {
      await manager.initialize();

      (mockExecuteScript as any).mockRejectedValue(new Error('Failed'));

      // Should not throw
      await expect(
        manager.highlightCurrent({ x: 0, y: 0, width: 100, height: 100 }),
      ).resolves.toBeUndefined();
    });

    it('should handle markAsSuccess errors gracefully', async () => {
      await manager.initialize();

      (mockExecuteScript as any).mockRejectedValue(new Error('Failed'));

      // Should not throw
      await expect(manager.markAsSuccess()).resolves.toBeUndefined();
    });

    it('should handle cleanup errors gracefully', async () => {
      await manager.initialize();

      (mockExecuteScript as any).mockRejectedValue(new Error('Failed'));

      // Should not throw
      await expect(manager.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getHighlightManager();
      const instance2 = getHighlightManager();

      expect(instance1).toBe(instance2);
    });

    it('should update existing instance config when passed', () => {
      const instance1 = getHighlightManager({ enabled: true });
      const instance2 = getHighlightManager({ enabled: false });

      expect(instance1).toBe(instance2);
      expect(instance2.getConfig().enabled).toBe(false);
    });

    it('should reset singleton', () => {
      const instance1 = getHighlightManager();
      resetHighlightManager();
      const instance2 = getHighlightManager();

      expect(instance1).not.toBe(instance2);
    });
  });
});
