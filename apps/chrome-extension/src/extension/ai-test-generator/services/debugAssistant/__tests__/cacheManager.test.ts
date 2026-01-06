/**
 * Unit tests for cache manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCacheManager, resetCacheManager, CacheManager } from '../cacheManager';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    resetCacheManager();
    cacheManager = getCacheManager({ enabled: true });
  });

  afterEach(() => {
    resetCacheManager();
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const manager = new CacheManager();
      const stats = manager.getAllStats();

      expect(stats).toBeDefined();
      expect(stats.totalSize).toBe(0);
    });

    it('should configure with custom options', () => {
      const manager = new CacheManager({
        llmCacheSize: 10,
        diagCacheSize: 5,
        screenshotCacheSize: 3,
        enabled: true,
      });

      expect(manager).toBeDefined();
    });
  });

  describe('LLM response caching', () => {
    it('should cache and retrieve LLM responses', () => {
      const query = 'Why did the test fail?';
      const context = { errorType: 'element_not_found' };
      const response = 'The element was not found on the page.';

      cacheManager.cacheLLMResponse(query, context, response);

      const retrieved = cacheManager.getLLMResponse(query, context);
      expect(retrieved).toBe(response);
    });

    it('should return null for non-existent cache', () => {
      const result = cacheManager.getLLMResponse('unknown query', {});
      expect(result).toBeNull();
    });

    it('should use getOrCallLLM to cache on miss', async () => {
      const query = 'Test query';
      const context = {};
      const response = 'Test response';
      const factory = vi.fn().mockResolvedValue(response);

      // First call - cache miss
      const result1 = await cacheManager.getOrCallLLM(query, context, factory);
      expect(result1).toBe(response);
      expect(factory).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      const result2 = await cacheManager.getOrCallLLM(query, context, factory);
      expect(result2).toBe(response);
      expect(factory).toHaveBeenCalledTimes(1); // No additional call
    });
  });

  describe('page diagnostics caching', () => {
    it('should cache and retrieve page diagnostics', () => {
      const url = 'https://example.com';
      const diagnostics = {
        visibleElements: [{ tag: 'button', text: 'Submit' }],
        consoleErrors: [],
      };

      cacheManager.cachePageDiagnostics(url, diagnostics);

      const retrieved = cacheManager.getPageDiagnostics(url);
      expect(retrieved).toEqual(diagnostics);
    });

    it('should fetch on cache miss', async () => {
      const url = 'https://example.com';
      const diagnostics = { visibleElements: [] };
      const factory = vi.fn().mockResolvedValue(diagnostics);

      // First call - cache miss
      const result1 = await cacheManager.getOrFetchDiagnostics(url, factory);
      expect(result1).toEqual(diagnostics);
      expect(factory).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      const result2 = await cacheManager.getOrFetchDiagnostics(url, factory);
      expect(result2).toEqual(diagnostics);
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('screenshot caching', () => {
    it('should cache and retrieve screenshots', () => {
      const label = 'before-action';
      const screenshot = 'data:image/png;base64,iVBORw0KG...';

      cacheManager.cacheScreenshot(label, screenshot);

      const retrieved = cacheManager.getScreenshot(label);
      expect(retrieved).toBe(screenshot);
    });

    it('should return null for non-existent screenshot', () => {
      const result = cacheManager.getScreenshot('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('context caching', () => {
    it('should cache and retrieve debug context', () => {
      const sessionId = 'session-123';
      const context = {
        currentUrl: 'https://example.com',
        lastError: { type: 'element_not_found', message: 'Not found' },
      };

      cacheManager.cacheContext(sessionId, context);

      const retrieved = cacheManager.getContext(sessionId);
      expect(retrieved).toEqual(context);
    });
  });

  describe('element location caching', () => {
    it('should cache and retrieve element locations', () => {
      const selector = '#submit-button';
      const location = { x: 100, y: 200, width: 80, height: 30 };

      cacheManager.cacheElementLocation(selector, location);

      const retrieved = cacheManager.getElementLocation(selector);
      expect(retrieved).toEqual(location);
    });

    it('should invalidate all element locations', () => {
      cacheManager.cacheElementLocation('#btn1', { x: 10, y: 20, width: 50, height: 20 });
      cacheManager.cacheElementLocation('#btn2', { x: 30, y: 40, width: 60, height: 25 });

      cacheManager.invalidateElementLocations();

      const result1 = cacheManager.getElementLocation('#btn1');
      const result2 = cacheManager.getElementLocation('#btn2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('fix suggestion caching', () => {
    it('should cache and retrieve fix suggestions', () => {
      const errorPattern = 'element_not_found';
      const suggestions = [
        { type: 'wait', description: 'Wait for element', confidence: 0.8 },
      ];

      cacheManager.cacheFixSuggestions(errorPattern, suggestions);

      const retrieved = cacheManager.getFixSuggestions(errorPattern);
      expect(retrieved).toEqual(suggestions);
    });
  });

  describe('cache statistics', () => {
    it('should track cache hits and misses', () => {
      const query = 'test query';
      const context = {};
      const response = 'test response';

      // Miss
      cacheManager.getLLMResponse(query, context);

      // Set and hit
      cacheManager.cacheLLMResponse(query, context, response);
      cacheManager.getLLMResponse(query, context);

      const stats = cacheManager.getAllStats();
      expect(stats.llm.totalHits).toBe(1);
      expect(stats.llm.totalMisses).toBe(1);
    });

    it('should calculate overall hit rate', () => {
      const query = 'test';
      const context = {};

      // 2 misses
      cacheManager.getLLMResponse(query, context);
      cacheManager.getLLMResponse(query + '2', context);

      // 1 hit
      cacheManager.cacheLLMResponse(query, context, 'response');
      cacheManager.getLLMResponse(query, context);

      const stats = cacheManager.getAllStats();
      expect(stats.overallHitRate).toBeCloseTo(0.33, 1);
    });

    it('should return cache sizes', () => {
      cacheManager.cacheLLMResponse('q1', {}, 'r1');
      cacheManager.cacheLLMResponse('q2', {}, 'r2');
      cacheManager.cachePageDiagnostics('url1', { elements: [] });

      const stats = cacheManager.getAllStats();
      expect(stats.llm.size).toBe(2);
      expect(stats.diagnostics.size).toBe(1);
      expect(stats.totalSize).toBe(3);
    });
  });

  describe('cache eviction', () => {
    it('should evict oldest entries when cache is full', () => {
      const manager = new CacheManager({ llmCacheSize: 2, enabled: true });

      manager.cacheLLMResponse('q1', {}, 'r1');
      manager.cacheLLMResponse('q2', {}, 'r2');
      manager.cacheLLMResponse('q3', {}, 'r3'); // Should evict q1 or q2

      const stats = manager.getAllStats();
      expect(stats.llm.size).toBeLessThanOrEqual(2);
      expect(stats.llm.evictedCount).toBeGreaterThan(0);
    });
  });

  describe('cache expiration', () => {
    it('should respect TTL for cached entries', () => {
      vi.useFakeTimers();

      const manager = new CacheManager({ llmCacheTTL: 1000, enabled: true });
      manager.cacheLLMResponse('query', {}, 'response');

      // Before expiration
      let result = manager.getLLMResponse('query', {});
      expect(result).toBe('response');

      // Advance time past TTL
      vi.advanceTimersByTime(1100);

      // After expiration
      result = manager.getLLMResponse('query', {});
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    it('should clean expired entries', () => {
      vi.useFakeTimers();

      const manager = new CacheManager({ llmCacheTTL: 500, enabled: true });
      manager.cacheLLMResponse('q1', {}, 'r1');
      manager.cacheLLMResponse('q2', {}, 'r2');

      vi.advanceTimersByTime(600);

      const cleaned = manager.cleanExpired();
      expect(cleaned).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe('cache clearing', () => {
    it('should clear all caches', () => {
      cacheManager.cacheLLMResponse('q', {}, 'r');
      cacheManager.cachePageDiagnostics('url', {});
      cacheManager.cacheScreenshot('label', 'data');
      cacheManager.cacheContext('session', {});
      cacheManager.cacheElementLocation('#el', {});
      cacheManager.cacheFixSuggestions('error', []);

      cacheManager.clearAll();

      const stats = cacheManager.getAllStats();
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('enable/disable', () => {
    it('should respect enabled flag', () => {
      const manager = new CacheManager({ enabled: false });

      manager.cacheLLMResponse('query', {}, 'response');

      const result = manager.getLLMResponse('query', {});
      expect(result).toBeNull();
    });

    it('should toggle enabled state', () => {
      cacheManager.cacheLLMResponse('query', {}, 'response');

      // Disable
      cacheManager.setEnabled(false);
      let result = cacheManager.getLLMResponse('query', {});
      expect(result).toBeNull();

      // Re-enable
      cacheManager.setEnabled(true);
      cacheManager.cacheLLMResponse('query2', {}, 'response2');
      result = cacheManager.getLLMResponse('query2', {});
      expect(result).toBe('response2');
    });
  });
});
