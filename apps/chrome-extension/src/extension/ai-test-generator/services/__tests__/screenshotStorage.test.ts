/**
 * Unit tests for screenshot storage service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScreenshotStorage, type ScreenshotMetadata } from '../screenshotStorage';

// Mock chrome.storage.local
const mockChromeStorage = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
  remove: vi.fn(),
};

// Mock chrome API
global.chrome = {
  storage: {
    local: mockChromeStorage,
  },
} as any;

// Mock IndexedDB
const mockDB = {
  close: vi.fn(),
  objectStore: vi.fn(),
  transaction: vi.fn(),
  createObjectStore: vi.fn(),
};

const mockTransaction = {
  objectStore: vi.fn(),
  oncomplete: null as any,
  onerror: null as any,
};

const mockStore = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
};

const mockRequest = {
  result: mockDB,
  error: null,
  onsuccess: null as any,
  onerror: null as any,
  onupgradeneeded: null as any,
};

// Mock indexedDB.open
vi.stubGlobal('indexedDB', {
  open: vi.fn(() => mockRequest),
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  mockChromeStorage.get.mockResolvedValue({ midscene_screenshots_meta: [] });
  mockChromeStorage.set.mockResolvedValue(undefined);

  mockStore.put.mockImplementation((data) => {
    const request = { result: undefined, onsuccess: null, onerror: null };
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess({ target: request });
    }, 0);
    return request;
  });

  mockStore.get.mockImplementation((key) => {
    const request = { result: null, onsuccess: null, onerror: null };
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess({ target: request });
    }, 0);
    return request;
  });

  mockTransaction.objectStore.mockReturnValue(mockStore);
  mockDB.transaction.mockReturnValue(mockTransaction);
});

describe('ScreenshotStorage', () => {
  let storage: ScreenshotStorage;

  beforeEach(() => {
    storage = new ScreenshotStorage({
      maxScreenshots: 10,
      generateThumbnails: false,
    });
  });

  describe('constructor', () => {
    it('should use default config', () => {
      const defaultStorage = new ScreenshotStorage();
      const config = defaultStorage.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.maxScreenshots).toBe(500);
      expect(config.generateThumbnails).toBe(true);
      expect(config.retentionDays).toBe(30);
    });

    it('should merge custom config', () => {
      const customStorage = new ScreenshotStorage({
        maxScreenshots: 100,
        retentionDays: 7,
      });
      const config = customStorage.getConfig();

      expect(config.maxScreenshots).toBe(100);
      expect(config.retentionDays).toBe(7);
      expect(config.enabled).toBe(true); // default
    });
  });

  describe('setConfig', () => {
    it('should update config', () => {
      storage.setConfig({ maxScreenshots: 50 });

      const config = storage.getConfig();
      expect(config.maxScreenshots).toBe(50);
    });
  });

  describe('store', () => {
    it('should store screenshot with metadata', async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KG...';
      const metadata = {
        testCaseId: 'test-case-1',
        stepId: 'step-1',
        stepIndex: 0,
        stepDescription: 'Click button',
        status: 'success' as const,
      };

      const id = await storage.store(dataUrl, metadata);

      expect(id).toBeTruthy();
      expect(id).toMatch(/^screenshot_/);

      expect(mockChromeStorage.set).toHaveBeenCalled();
    });

    it('should not store when disabled', async () => {
      storage.setConfig({ enabled: false });

      const dataUrl = 'data:image/png;base64,iVBORw0KG...';
      const id = await storage.store(dataUrl, { status: 'success' });

      expect(id).toBe('');
    });

    it('should include timestamp in metadata', async () => {
      const beforeTime = Date.now();

      const dataUrl = 'data:image/png;base64,iVBORw0KG...';
      await storage.store(dataUrl, { status: 'success' });

      const afterTime = Date.now();

      const metadata = await storage.list();
      expect(metadata.length).toBeGreaterThan(0);

      const timestamp = metadata[0].timestamp;
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('retrieve', () => {
    it('should return null for non-existent screenshot', async () => {
      const result = await storage.retrieve('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return stored screenshot', async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KG...';
      const id = await storage.store(dataUrl, {
        stepDescription: 'Test step',
        status: 'success',
      });

      // Mock the retrieve to return the data
      mockStore.get.mockImplementation(() => {
        const request = {
          result: {
            metadata: {
              id,
              timestamp: Date.now(),
              stepDescription: 'Test step',
              status: 'success',
              hasMaskedRegions: false,
            },
            dataUrl,
          },
          onsuccess: null,
          onerror: null,
        };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: request });
        }, 0);
        return request;
      });

      const result = await storage.retrieve(id);
      expect(result).not.toBeNull();
      expect(result?.metadata.stepDescription).toBe('Test step');
    });
  });

  describe('list', () => {
    it('should return empty list initially', async () => {
      const list = await storage.list();
      expect(list).toEqual([]);
    });

    it('should return all metadata', async () => {
      await storage.store('data:image/png;base64,abc1', {
        stepDescription: 'Step 1',
        status: 'success',
      });
      await storage.store('data:image/png;base64,abc2', {
        stepDescription: 'Step 2',
        status: 'success',
      });

      const list = await storage.list();
      expect(list.length).toBe(2);
    });

    it('should filter by testCaseId', async () => {
      await storage.store('data:image/png;base64,abc1', {
        testCaseId: 'case-1',
        stepDescription: 'Step 1',
        status: 'success',
      });
      await storage.store('data:image/png;base64,abc2', {
        testCaseId: 'case-2',
        stepDescription: 'Step 2',
        status: 'success',
      });

      const list = await storage.list({ testCaseId: 'case-1' });
      expect(list.length).toBe(1);
      expect(list[0].testCaseId).toBe('case-1');
    });

    it('should sort by timestamp descending', async () => {
      const id1 = await storage.store('data:image/png;base64,abc1', {
        stepDescription: 'Step 1',
        status: 'success',
      });

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const id2 = await storage.store('data:image/png;base64,abc2', {
        stepDescription: 'Step 2',
        status: 'success',
      });

      const list = await storage.list();
      expect(list[0].id).toBe(id2); // Most recent first
      expect(list[1].id).toBe(id1);
    });
  });

  describe('delete', () => {
    it('should delete screenshot by id', async () => {
      const id = await storage.store('data:image/png;base64,abc', {
        stepDescription: 'Test',
        status: 'success',
      });

      // Mock successful delete
      mockStore.delete.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: request });
        }, 0);
        return request;
      });

      const deleted = await storage.delete(id);
      expect(deleted).toBe(true);
    });

    it('should handle non-existent id gracefully', async () => {
      const deleted = await storage.delete('non-existent');
      expect(deleted).toBe(true); // Still returns true (idempotent)
    });
  });

  describe('clear', () => {
    it('should clear all screenshots', async () => {
      await storage.store('data:image/png;base64,abc1', { status: 'success' });
      await storage.store('data:image/png;base64,abc2', { status: 'success' });

      // Mock clear
      mockStore.clear.mockImplementation(() => {
        const request = { onsuccess: null, onerror: null };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess({ target: request });
        }, 0);
        return request;
      });

      await storage.clear();

      const list = await storage.list();
      expect(list.length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return storage statistics', async () => {
      await storage.store('data:image/png;base64,abc1', {
        stepDescription: 'Step 1',
        status: 'success',
      });

      const stats = await storage.getStats();

      expect(stats.count).toBe(1);
      expect(typeof stats.totalSize).toBe('number');
      expect(stats.oldestTimestamp).toBeGreaterThan(0);
      expect(stats.newestTimestamp).toBeGreaterThan(0);
    });

    it('should return zero stats for empty storage', async () => {
      const stats = await storage.getStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.oldestTimestamp).toBe(0);
      expect(stats.newestTimestamp).toBe(0);
    });
  });
});
