/**
 * Performance utilities
 * Provides performance monitoring and optimization tools
 */

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  warning: number; // ms
  critical: number; // ms
}

/**
 * Default thresholds for different operations
 */
const DEFAULT_THRESHOLDS: Record<string, PerformanceThresholds> = {
  ai_description: { warning: 2000, critical: 5000 },
  screenshot: { warning: 500, critical: 1000 },
  element_detection: { warning: 100, critical: 300 },
  markdown_parse: { warning: 100, critical: 300 },
  yaml_generation: { warning: 50, critical: 100 },
};

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private activeTimers: Map<string, number> = new Map();
  private maxMetrics = 1000;

  /**
   * Start timing an operation
   */
  start(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeTimers.set(timerId, performance.now());
    return timerId;
  }

  /**
   * End timing an operation
   */
  end(timerId: string, metadata?: Record<string, unknown>): PerformanceMetrics | null {
    const startTime = this.activeTimers.get(timerId);
    if (!startTime) {
      return null;
    }

    const duration = performance.now() - startTime;
    const metrics: PerformanceMetrics = {
      name: timerId.split('_')[0],
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.addMetric(metrics);
    this.activeTimers.delete(timerId);

    return metrics;
  }

  /**
   * Add a metric directly
   */
  addMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Enforce max limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(name?: string): PerformanceMetrics[] {
    if (name) {
      return this.metrics.filter((m) => m.name === name);
    }
    return [...this.metrics];
  }

  /**
   * Get statistics for a specific operation
   */
  getStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } | null {
    const filtered = this.getMetrics(name);
    if (filtered.length === 0) {
      return null;
    }

    const durations = filtered.map((m) => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((a, b) => a + b, 0);

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * count) - 1;
      return durations[Math.max(0, index)];
    };

    return {
      count,
      avg: sum / count,
      min: durations[0],
      max: durations[count - 1],
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  /**
   * Check if performance is within thresholds
   */
  checkThreshold(name: string, duration: number): 'ok' | 'warning' | 'critical' {
    const thresholds = DEFAULT_THRESHOLDS[name];
    if (!thresholds) {
      return 'ok';
    }

    if (duration >= thresholds.critical) {
      return 'critical';
    }
    if (duration >= thresholds.warning) {
      return 'warning';
    }
    return 'ok';
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.activeTimers.clear();
  }

  /**
   * Get metrics summary
   */
  getSummary(): Record<string, {
    count: number;
    avg: number;
    max: number;
    status: 'ok' | 'warning' | 'critical';
  }> {
    const summary: Record<string, any> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = {
          count: 0,
          total: 0,
          max: 0,
        };
      }

      summary[metric.name].count++;
      summary[metric.name].total += metric.duration;
      summary[metric.name].max = Math.max(summary[metric.name].max, metric.duration);
    }

    // Calculate averages and check thresholds
    for (const name in summary) {
      const data = summary[name];
      data.avg = data.total / data.count;
      data.status = this.checkThreshold(name, data.avg);
      delete data.total;
    }

    return summary;
  }
}

/**
 * Global performance monitor instance
 */
export const perfMonitor = new PerformanceMonitor();

/**
 * Decorator to measure function performance
 */
export function measurePerformance<T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  options?: {
    logThreshold?: number;
    metadata?: (...args: Parameters<T>) => Record<string, unknown>;
  },
): T {
  return ((...args: Parameters<T>) => {
    const timerId = perfMonitor.start(name);
    const metadata = options?.metadata?.(...args);

    try {
      const result = fn(...args);
      const metrics = perfMonitor.end(timerId, metadata);

      if (metrics && options?.logThreshold && metrics.duration > options.logThreshold) {
        console.warn(`[Performance] ${name} took ${metrics.duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      perfMonitor.end(timerId, { error: String(error) });
      throw error;
    }
  }) as T;
}

/**
 * Async decorator to measure async function performance
 */
export function measureAsyncPerformance<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  options?: {
    logThreshold?: number;
    metadata?: (...args: Parameters<T>) => Record<string, unknown>;
  },
): T {
  return (async (...args: Parameters<T>) => {
    const timerId = perfMonitor.start(name);
    const metadata = options?.metadata?.(...args);

    try {
      const result = await fn(...args);
      const metrics = perfMonitor.end(timerId, metadata);

      if (metrics && options?.logThreshold && metrics.duration > options.logThreshold) {
        console.warn(`[Performance] ${name} took ${metrics.duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      perfMonitor.end(timerId, { error: String(error) });
      throw error;
    }
  }) as T;
}

/**
 * Simple LRU cache for memoization
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists (will be re-added at end)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Remove oldest if at capacity
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Memoize a function with LRU cache
 */
export function memoize<F extends (...args: any[]) => any>(
  fn: F,
  options?: {
    keyFn?: (...args: Parameters<F>) => string;
    maxSize?: number;
  },
): F {
  const cache = new LRUCache<string, ReturnType<F>>(options?.maxSize || 100);

  return ((...args: Parameters<F>) => {
    const key = options?.keyFn
      ? options.keyFn(...args)
      : JSON.stringify(args);

    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as F;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= interval) {
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, interval - (now - lastCall));
    }
  };
}

/**
 * Batch multiple operations into a single execution
 */
export function batch<T>(
  fn: (items: T[]) => void | Promise<void>,
  options?: {
    maxSize?: number;
    maxDelay?: number;
  },
): (item: T) => void {
  const { maxSize = 10, maxDelay = 100 } = options || {};
  let batch: T[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingResolve: (() => void) | null = null;
  let pendingPromise: Promise<void> | null = null;

  const flush = async () => {
    if (batch.length === 0) return;

    const items = batch;
    batch = [];

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    await fn(items);

    if (pendingResolve) {
      pendingResolve();
      pendingResolve = null;
      pendingPromise = null;
    }
  };

  return (item: T) => {
    batch.push(item);

    // Flush immediately if batch is full
    if (batch.length >= maxSize) {
      flush();
      return;
    }

    // Otherwise, schedule a flush
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        flush();
      }, maxDelay);
    }
  };
}

/**
 * Request animation frame throttle
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  fn: T,
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          fn(...lastArgs);
        }
        rafId = null;
        lastArgs = null;
      });
    }
  };
}

/**
 * Idle callback throttle (runs when browser is idle)
 */
export function idleThrottle<T extends (...args: any[]) => any>(
  fn: T,
  options?: { timeout?: number },
): (...args: Parameters<T>) => void {
  let lastArgs: Parameters<T> | null = null;
  let scheduled = false;

  const run = () => {
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
    scheduled = false;
  };

  return (...args: Parameters<T>) => {
    lastArgs = args;

    if (!scheduled) {
      scheduled = true;

      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => run(), options);
      } else {
        // Fallback to setTimeout
        setTimeout(() => run(), 0);
      }
    }
  };
}

/**
 * Measure memory usage (if available)
 */
export function getMemoryUsage(): {
  used: number;
  total: number;
  limit: number;
} | null {
  if (
    'memory' in performance &&
    (performance as any).memory &&
    (performance as any).memory.usedJSHeapSize
  ) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
    };
  }
  return null;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Format milliseconds to human-readable string
 */
export function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Get performance entry by name
 */
export function getPerformanceEntry(name: string): PerformanceEntry | undefined {
  const entries = performance.getEntriesByName(name);
  return entries[0];
}

/**
 * Get all performance entries of a specific type
 */
export function getPerformanceEntries(type?: string): PerformanceEntryList {
  if (type) {
    return performance.getEntriesByType(type);
  }
  return performance.getEntries();
}

/**
 * Clear performance entries
 */
export function clearPerformanceEntries(type?: string): void {
  if (type) {
    performance.clearMarks(type);
  } else {
    performance.clearMarks();
    performance.clearMeasures();
    performance.clearResourceTimings();
  }
}

/**
 * Create a performance mark
 */
export function mark(name: string): void {
  performance.mark(name);
}

/**
 * Create a performance measure
 */
export function measure(name: string, startMark: string, endMark: string): number {
  performance.measure(name, startMark, endMark);
  const entry = getPerformanceEntry(name);
  return entry?.duration || 0;
}

/**
 * Observe performance entries
 */
export function observePerformance(
  type: string,
  callback: (entries: PerformanceEntry[]) => void,
): PerformanceObserver {
  const observer = new PerformanceObserver((list) => {
    callback(list.getEntries());
  });
  observer.observe({ type, buffered: true });
  return observer;
}
