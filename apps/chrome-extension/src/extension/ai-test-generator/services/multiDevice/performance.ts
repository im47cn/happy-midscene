/**
 * Performance Optimization Utilities
 * Provides screenshot compression, message batching, and memory management
 */

/**
 * Compression configuration
 */
export interface CompressionConfig {
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

/**
 * Compression result
 */
export interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}

/**
 * Batch message configuration
 */
export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  maxSize: number;
}

/**
 * Batch entry
 */
interface BatchEntry<T> {
  id: string;
  data: T;
  timestamp: number;
  size: number;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalEntries: number;
  totalSize: number;
  compressionRatio: number;
  reclaimedCount: number;
  reclaimedSize: number;
}

/**
 * Memory pool entry
 */
interface MemoryPoolEntry<T> {
  data: T;
  size: number;
  lastUsed: number;
  accessCount: number;
}

/**
 * Default compression config
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  quality: 0.75,
  maxWidth: 1920,
  maxHeight: 1080,
  format: 'jpeg',
};

/**
 * Screenshot Compressor
 * Optimizes screenshots for storage and transmission
 */
export class ScreenshotCompressor {
  private config: CompressionConfig;
  private cache: Map<string, CompressionResult> = new Map();
  private maxCacheSize: number;
  private cacheSize = 0;

  constructor(
    config: Partial<CompressionConfig> = {},
    maxCacheSize = 50 * 1024 * 1024,
  ) {
    this.config = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Compress a base64 screenshot
   */
  async compress(base64: string): Promise<CompressionResult> {
    const cacheKey = this.hashBase64(base64);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const originalSize = this.base64Size(base64);
    let compressed = base64;

    try {
      compressed = await this.resizeAndCompress(base64);
    } catch (error) {
      console.warn('Screenshot compression failed, using original:', error);
      compressed = base64;
    }

    const compressedSize = this.base64Size(compressed);
    const result: CompressionResult = {
      compressed,
      originalSize,
      compressedSize,
      ratio: originalSize > 0 ? compressedSize / originalSize : 1,
    };

    this.cacheResult(cacheKey, result, compressedSize);

    return result;
  }

  /**
   * Compress multiple screenshots in parallel
   */
  async compressBatch(base64List: string[]): Promise<CompressionResult[]> {
    return Promise.all(base64List.map((b64) => this.compress(b64)));
  }

  /**
   * Resize and compress screenshot
   */
  private async resizeAndCompress(base64: string): Promise<string> {
    const dataUrlRegex = /^data:image\/([a-z+]+);base64,/i;
    const matches = base64.match(dataUrlRegex);

    if (!matches) {
      return base64;
    }

    const format = matches[1];
    const base64Data = base64.slice(matches[0].length);

    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: `image/${format}` });
      const bitmap = await createImageBitmap(blob);

      const {
        maxWidth = Number.POSITIVE_INFINITY,
        maxHeight = Number.POSITIVE_INFINITY,
      } = this.config;

      let width = bitmap.width;
      let height = bitmap.height;

      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }

      if (width !== bitmap.width || height !== bitmap.height) {
        const resizedBitmap = await createImageBitmap(bitmap, {
          width,
          height,
        });
        bitmap.close();
        return await this.bitmapToBase64(
          resizedBitmap,
          this.config.format || 'jpeg',
        );
      }

      bitmap.close();
      return await this.bitmapToBase64(bitmap, this.config.format || 'jpeg');
    } catch (error) {
      console.warn('Image processing failed:', error);
      return base64;
    }
  }

  /**
   * Convert ImageBitmap to base64
   */
  private async bitmapToBase64(
    bitmap: ImageBitmap,
    format: string,
  ): Promise<string> {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    ctx.drawImage(bitmap, 0, 0);

    const quality = format === 'png' ? undefined : this.config.quality;
    const blob = await canvas.convertToBlob({
      type: `image/${format}`,
      quality,
    });

    const base64Data = await blobToBase64(blob);
    return `data:image/${format};base64,${base64Data}`;
  }

  /**
   * Calculate base64 size in bytes
   */
  private base64Size(base64: string): number {
    const base64Data = base64.split(',')[1] || base64;
    return Math.floor((base64Data.length * 3) / 4);
  }

  /**
   * Hash base64 for caching
   */
  private hashBase64(base64: string): string {
    let hash = 0;
    const str = base64.slice(0, 1000);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return String(hash);
  }

  /**
   * Cache compression result
   */
  private cacheResult(
    key: string,
    result: CompressionResult,
    size: number,
  ): void {
    while (this.cacheSize + size > this.maxCacheSize && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value;
      const first = this.cache.get(firstKey);
      if (first) {
        this.cacheSize -= first.compressedSize;
      }
      this.cache.delete(firstKey);
    }

    this.cache.set(key, result);
    this.cacheSize += size;
  }

  /**
   * Clear compression cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheSize = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { entries: number; size: number } {
    return {
      entries: this.cache.size,
      size: this.cacheSize,
    };
  }
}

/**
 * Message Batcher
 * Batches messages for efficient transmission
 */
export class MessageBatcher<T> {
  private config: BatchConfig;
  private batch: BatchEntry<T>[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private callbacks: Set<(batch: T[]) => void> = new Set();
  private currentSize = 0;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      maxBatchSize: 10,
      maxWaitTime: 100,
      maxSize: 1024 * 1024,
      ...config,
    };
  }

  /**
   * Add a message to the batch
   */
  add(id: string, data: T, size = this.estimateSize(data)): void {
    this.batch.push({
      id,
      data,
      timestamp: Date.now(),
      size,
    });
    this.currentSize += size;

    if (this.shouldFlush()) {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  /**
   * Register callback for flushed batches
   */
  onFlush(callback: (batch: T[]) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Check if batch should be flushed
   */
  private shouldFlush(): boolean {
    return (
      this.batch.length >= this.config.maxBatchSize ||
      this.currentSize >= this.config.maxSize
    );
  }

  /**
   * Schedule a delayed flush
   */
  private scheduleFlush(): void {
    if (this.timer) {
      return;
    }

    this.timer = setTimeout(() => {
      this.flush();
    }, this.config.maxWaitTime);
  }

  /**
   * Flush the current batch
   */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    if (this.batch.length === 0) {
      return;
    }

    const batch = this.batch;
    const data = batch.map((entry) => entry.data);

    this.batch = [];
    this.currentSize = 0;

    for (const callback of this.callbacks) {
      try {
        callback(data);
      } catch (error) {
        console.warn('Batch callback error:', error);
      }
    }
  }

  /**
   * Force flush immediately
   */
  forceFlush(): void {
    this.flush();
  }

  /**
   * Estimate size of data
   */
  private estimateSize(data: T): number {
    return JSON.stringify(data).length * 2;
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.batch.length;
  }

  /**
   * Clear pending batch
   */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.batch = [];
    this.currentSize = 0;
  }
}

/**
 * Memory Pool
 * Manages memory with automatic cleanup
 */
export class MemoryPool<T> {
  private pool: Map<string, MemoryPoolEntry<T>> = new Map();
  private maxSize: number;
  private maxAge: number;
  private totalSize = 0;
  private reclaimedCount = 0;
  private reclaimedSize = 0;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(maxSize = 100 * 1024 * 1024, maxAge = 300000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    this.startCleanup();
  }

  /**
   * Store data in the pool
   */
  set(key: string, data: T, size = this.estimateSize(data)): void {
    const existing = this.pool.get(key);
    if (existing) {
      this.totalSize -= existing.size;
    }

    const entry: MemoryPoolEntry<T> = {
      data,
      size,
      lastUsed: Date.now(),
      accessCount: existing ? existing.accessCount + 1 : 1,
    };

    this.pool.set(key, entry);
    this.totalSize += size;

    if (this.totalSize > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Get data from the pool
   */
  get(key: string): T | undefined {
    const entry = this.pool.get(key);
    if (entry) {
      entry.lastUsed = Date.now();
      entry.accessCount++;
      return entry.data;
    }
    return undefined;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.pool.has(key);
  }

  /**
   * Delete data from the pool
   */
  delete(key: string): boolean {
    const entry = this.pool.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.reclaimedCount++;
      this.reclaimedSize += entry.size;
      return this.pool.delete(key);
    }
    return false;
  }

  /**
   * Clear all data
   */
  clear(): void {
    for (const entry of this.pool.values()) {
      this.reclaimedCount++;
      this.reclaimedSize += entry.size;
    }
    this.pool.clear();
    this.totalSize = 0;
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    return {
      totalEntries: this.pool.size,
      totalSize: this.totalSize,
      compressionRatio: 0,
      reclaimedCount: this.reclaimedCount,
      reclaimedSize: this.reclaimedSize,
    };
  }

  /**
   * Estimate size of data
   */
  private estimateSize(data: T): number {
    try {
      return JSON.stringify(data).length * 2;
    } catch {
      return 1024;
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestTime = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.pool) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.pool) {
      if (now - entry.lastUsed > this.maxAge) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }
}

/**
 * Utility function to convert blob to base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Create a screenshot compressor
 */
export function createScreenshotCompressor(
  config?: Partial<CompressionConfig>,
): ScreenshotCompressor {
  return new ScreenshotCompressor(config);
}

/**
 * Create a message batcher
 */
export function createMessageBatcher<T>(
  config?: Partial<BatchConfig>,
): MessageBatcher<T> {
  return new MessageBatcher<T>(config);
}

/**
 * Create a memory pool
 */
export function createMemoryPool<T>(
  maxSize?: number,
  maxAge?: number,
): MemoryPool<T> {
  return new MemoryPool<T>(maxSize, maxAge);
}

/**
 * Performance monitor for tracking operations
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private maxSamples = 100;

  /**
   * Record a metric value
   */
  record(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const samples = this.metrics.get(name)!;
    samples.push(value);

    if (samples.length > this.maxSamples) {
      samples.shift();
    }
  }

  /**
   * Time a function execution
   */
  async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      this.record(name, performance.now() - start);
    }
  }

  /**
   * Get statistics for a metric
   */
  getStats(
    name: string,
  ): { min: number; max: number; avg: number; count: number } | null {
    const samples = this.metrics.get(name);
    if (!samples || samples.length === 0) {
      return null;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let sum = 0;

    for (const value of samples) {
      if (value < min) min = value;
      if (value > max) max = value;
      sum += value;
    }

    return {
      min,
      max,
      avg: sum / samples.length,
      count: samples.length,
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}

/**
 * Create a performance monitor
 */
export function createPerformanceMonitor(): PerformanceMonitor {
  return new PerformanceMonitor();
}
