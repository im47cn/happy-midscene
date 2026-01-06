/**
 * Performance Utilities Unit Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CompressionConfig,
  DEFAULT_COMPRESSION_CONFIG,
  MemoryPool,
  MessageBatcher,
  PerformanceMonitor,
  ScreenshotCompressor,
  createMemoryPool,
  createMessageBatcher,
  createPerformanceMonitor,
  createScreenshotCompressor,
} from '../performance';

describe('ScreenshotCompressor', () => {
  let compressor: ScreenshotCompressor;

  beforeEach(() => {
    compressor = createScreenshotCompressor();
  });

  describe('compression', () => {
    it('should calculate base64 size correctly', () => {
      const base64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const size = compressor['base64Size'](base64);
      expect(size).toBeGreaterThan(0);
    });

    it('should hash base64 for caching', () => {
      const base64 = 'data:image/png;base64,test123';
      const hash1 = compressor['hashBase64'](base64);
      const hash2 = compressor['hashBase64'](base64);
      expect(hash1).toBe(hash2);
    });

    it('should return original image if invalid format', async () => {
      const invalidBase64 = 'not-a-valid-image';
      const result = await compressor.compress(invalidBase64);
      expect(result.compressed).toBe(invalidBase64);
    });

    it('should handle PNG data URLs', async () => {
      const pngBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = await compressor.compress(pngBase64);
      expect(result.originalSize).toBeGreaterThan(0);
    });
  });

  describe('caching', () => {
    it('should cache compression results', async () => {
      const base64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result1 = await compressor.compress(base64);
      const result2 = await compressor.compress(base64);

      expect(result1).toBe(result2);
    });

    it('should provide cache statistics', () => {
      const stats = compressor.getCacheStats();
      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('size');
    });

    it('should clear cache', () => {
      compressor.clearCache();
      const stats = compressor.getCacheStats();
      expect(stats.entries).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('batch compression', () => {
    it('should compress multiple screenshots in parallel', async () => {
      const screenshots = [
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      ];

      const results = await compressor.compressBatch(screenshots);
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('compressed');
      expect(results[0]).toHaveProperty('originalSize');
      expect(results[0]).toHaveProperty('compressedSize');
      expect(results[0]).toHaveProperty('ratio');
    });
  });

  describe('configuration', () => {
    it('should accept custom compression config', () => {
      const config: Partial<CompressionConfig> = {
        quality: 0.5,
        maxWidth: 1280,
        maxHeight: 720,
        format: 'jpeg',
      };
      const customCompressor = createScreenshotCompressor(config);
      expect(customCompressor).toBeInstanceOf(ScreenshotCompressor);
    });
  });
});

describe('MessageBatcher', () => {
  let batcher: MessageBatcher<{ message: string }>;

  beforeEach(() => {
    batcher = createMessageBatcher<{ message: string }>({
      maxBatchSize: 3,
      maxWaitTime: 50,
      maxSize: 1000,
    });
  });

  afterEach(() => {
    batcher.clear();
  });

  describe('batching', () => {
    it('should add messages to batch', () => {
      batcher.add('1', { message: 'hello' });
      expect(batcher.getBatchSize()).toBe(1);
    });

    it('should flush when batch size limit reached', () => {
      const callback = vi.fn();
      batcher.onFlush(callback);

      batcher.add('1', { message: 'first' });
      batcher.add('2', { message: 'second' });
      batcher.add('3', { message: 'third' });

      expect(callback).toHaveBeenCalledWith([
        { message: 'first' },
        { message: 'second' },
        { message: 'third' },
      ]);
    });

    it('should flush on timeout', async () => {
      const callback = vi.fn();
      batcher.onFlush(callback);

      batcher.add('1', { message: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(callback).toHaveBeenCalledWith([{ message: 'test' }]);
    });

    it('should flush manually', () => {
      const callback = vi.fn();
      batcher.onFlush(callback);

      batcher.add('1', { message: 'test' });
      batcher.forceFlush();

      expect(callback).toHaveBeenCalledWith([{ message: 'test' }]);
    });
  });

  describe('callbacks', () => {
    it('should support multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      batcher.onFlush(callback1);
      batcher.onFlush(callback2);

      batcher.add('1', { message: 'test' });
      batcher.add('2', { message: 'test2' });
      batcher.add('3', { message: 'test3' });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should unsubscribe callback', () => {
      const callback = vi.fn();
      const unsubscribe = batcher.onFlush(callback);

      unsubscribe();
      batcher.add('1', { message: 'test' });
      batcher.forceFlush();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('size estimation', () => {
    it('should estimate size for data', () => {
      batcher.add('1', { message: 'x'.repeat(100) }, 200);
      batcher.add('2', { message: 'y' }, 50);

      const estimatedSize = batcher['estimateSize']({ message: 'test' });
      expect(estimatedSize).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear pending batch and timer', () => {
      batcher.add('1', { message: 'test' });
      batcher.clear();

      expect(batcher.getBatchSize()).toBe(0);
    });
  });
});

describe('MemoryPool', () => {
  let pool: MemoryPool<any>;

  beforeEach(() => {
    pool = createMemoryPool(1024, 5000);
  });

  afterEach(() => {
    pool.destroy();
  });

  describe('basic operations', () => {
    it('should store and retrieve data', () => {
      pool.set('key1', { value: 'data1' });
      expect(pool.get('key1')).toEqual({ value: 'data1' });
    });

    it('should return undefined for missing keys', () => {
      expect(pool.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      pool.set('key1', { value: 'data1' });
      expect(pool.has('key1')).toBe(true);
      expect(pool.has('key2')).toBe(false);
    });

    it('should delete entries', () => {
      pool.set('key1', { value: 'data1' });
      expect(pool.delete('key1')).toBe(true);
      expect(pool.has('key1')).toBe(false);
      expect(pool.delete('key1')).toBe(false);
    });

    it('should clear all data', () => {
      pool.set('key1', { value: 'data1' });
      pool.set('key2', { value: 'data2' });
      pool.clear();

      expect(pool.has('key1')).toBe(false);
      expect(pool.has('key2')).toBe(false);
    });
  });

  describe('memory management', () => {
    it('should track access count', () => {
      pool.set('key1', { value: 'data1' });
      pool.get('key1');
      pool.get('key1');

      const entry = pool['pool'].get('key1');
      expect(entry?.accessCount).toBe(3);
    });

    it('should update last used time on access', async () => {
      pool.set('key1', { value: 'data1' });
      const entry1 = pool['pool'].get('key1');
      const time1 = entry1?.lastUsed || 0;

      await new Promise((resolve) => setTimeout(resolve, 10));
      pool.get('key1');

      const entry2 = pool['pool'].get('key1');
      const time2 = entry2?.lastUsed || 0;

      expect(time2).toBeGreaterThan(time1);
    });

    it('should evict LRU entry when full', () => {
      const smallPool = createMemoryPool(100, 10000);

      smallPool.set('key1', 'data1', 40);
      smallPool.set('key2', 'data2', 40);
      smallPool.set('key3', 'data3', 40);

      expect(smallPool.has('key1')).toBe(false);
      expect(smallPool.has('key2')).toBe(true);
      expect(smallPool.has('key3')).toBe(true);

      smallPool.destroy();
    });
  });

  describe('statistics', () => {
    it('should provide memory statistics', () => {
      pool.set('key1', { value: 'data1' });
      pool.set('key2', { value: 'data2' });

      const stats = pool.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.reclaimedCount).toBe(0);
    });

    it('should track reclaimed memory', () => {
      pool.set('key1', { value: 'data1' });
      pool.delete('key1');

      const stats = pool.getStats();
      expect(stats.reclaimedCount).toBe(1);
      expect(stats.reclaimedSize).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      const shortLivedPool = createMemoryPool(10000, 100);

      shortLivedPool.set('key1', 'data1');
      await new Promise((resolve) => setTimeout(resolve, 150));

      shortLivedPool['cleanup']();
      expect(shortLivedPool.has('key1')).toBe(false);

      shortLivedPool.destroy();
    });
  });
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = createPerformanceMonitor();
  });

  describe('metrics', () => {
    it('should record metric values', () => {
      monitor.record('operation1', 100);
      monitor.record('operation1', 200);
      monitor.record('operation1', 150);

      const stats = monitor.getStats('operation1');
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(3);
      expect(stats?.min).toBe(100);
      expect(stats?.max).toBe(200);
      expect(stats?.avg).toBeCloseTo(150);
    });

    it('should return null for non-existent metrics', () => {
      expect(monitor.getStats('nonexistent')).toBeNull();
    });

    it('should limit sample size', () => {
      const samples = 150;
      for (let i = 0; i < samples; i++) {
        monitor.record('operation', i);
      }

      const stats = monitor.getStats('operation');
      expect(stats?.count).toBe(100);
    });

    it('should clear all metrics', () => {
      monitor.record('op1', 100);
      monitor.record('op2', 200);
      monitor.clear();

      expect(monitor.getStats('op1')).toBeNull();
      expect(monitor.getStats('op2')).toBeNull();
    });
  });

  describe('timing', () => {
    it('should time async operations', async () => {
      const result = await monitor.time('slowOp', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'result';
      });

      expect(result).toBe('result');

      const stats = monitor.getStats('slowOp');
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(1);
      expect(stats?.min).toBeGreaterThan(0);
    });

    it('should handle errors in timed operations', async () => {
      await expect(
        monitor.time('failingOp', async () => {
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');

      const stats = monitor.getStats('failingOp');
      expect(stats?.count).toBe(1);
    });
  });

  describe('multiple metrics', () => {
    it('should track multiple operations independently', () => {
      monitor.record('fastOp', 10);
      monitor.record('fastOp', 20);
      monitor.record('slowOp', 1000);
      monitor.record('slowOp', 2000);

      const fastStats = monitor.getStats('fastOp');
      const slowStats = monitor.getStats('slowOp');

      expect(fastStats?.avg).toBeCloseTo(15);
      expect(slowStats?.avg).toBeCloseTo(1500);
    });
  });
});

describe('constants', () => {
  it('should export default compression config', () => {
    expect(DEFAULT_COMPRESSION_CONFIG).toEqual({
      quality: 0.75,
      maxWidth: 1920,
      maxHeight: 1080,
      format: 'jpeg',
    });
  });
});

describe('factory functions', () => {
  it('should create screenshot compressor', () => {
    const compressor = createScreenshotCompressor({ quality: 0.5 });
    expect(compressor).toBeInstanceOf(ScreenshotCompressor);
  });

  it('should create message batcher', () => {
    const batcher = createMessageBatcher({ maxBatchSize: 5 });
    expect(batcher).toBeInstanceOf(MessageBatcher);
  });

  it('should create memory pool', () => {
    const pool = createMemoryPool(1000, 1000);
    expect(pool).toBeInstanceOf(MemoryPool);
    pool.destroy();
  });

  it('should create performance monitor', () => {
    const monitor = createPerformanceMonitor();
    expect(monitor).toBeInstanceOf(PerformanceMonitor);
  });
});
