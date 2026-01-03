/**
 * Performance Optimizations Service
 * Provides performance enhancements for marketplace operations
 */

import type { TemplateSummary } from '../types';

/**
 * Virtual scrolling configuration
 */
interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  bufferSize: number;
  scrollDebounceMs: number;
}

/**
 * Image lazy loading observer
 */
class LazyImageLoader {
  private observer: IntersectionObserver;
  private loadedImages = new Set<string>();

  constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            this.loadImage(img);
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );
  }

  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    if (!src || this.loadedImages.has(src)) return;

    // Create a new image to preload
    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      this.loadedImages.add(src);
      this.observer.unobserve(img);
    };
    tempImg.onerror = () => {
      img.classList.add('error');
      this.observer.unobserve(img);
    };
    tempImg.src = src;
  }

  observe(element: HTMLImageElement): void {
    if (element.dataset.src) {
      this.observer.observe(element);
    }
  }

  disconnect(): void {
    this.observer.disconnect();
  }
}

/**
 * Debounce utility
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Throttle utility
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Request animation frame based throttle
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return (...args: Parameters<T>) => {
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      func(...args);
      rafId = null;
    });
  };
}

/**
 * Virtual list manager for large template lists
 */
export class VirtualListManager<T> {
  private items: T[] = [];
  private visibleRange = { start: 0, end: 0 };
  private config: VirtualScrollConfig;
  private scrollHandler: ((scrollTop: number) => void) | null = null;

  constructor(config: Partial<VirtualScrollConfig> = {}) {
    this.config = {
      itemHeight: config.itemHeight || 100,
      containerHeight: config.containerHeight || 600,
      bufferSize: config.bufferSize || 5,
      scrollDebounceMs: config.scrollDebounceMs || 100,
    };
  }

  setItems(items: T[]): void {
    this.items = items;
    this.calculateVisibleRange(0);
  }

  private calculateVisibleRange(scrollTop: number): void {
    const { itemHeight, containerHeight, bufferSize } = this.config;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(this.items.length, start + visibleCount + bufferSize * 2);

    this.visibleRange = { start, end };
  }

  getVisibleItems(): { items: T[]; offsetY: number; totalHeight: number } {
    const { start, end } = this.visibleRange;
    const offsetY = start * this.config.itemHeight;
    const totalHeight = this.items.length * this.config.itemHeight;

    return {
      items: this.items.slice(start, end),
      offsetY,
      totalHeight,
    };
  }

  handleScroll(scrollTop: number): void {
    this.calculateVisibleRange(scrollTop);
    if (this.scrollHandler) {
      this.scrollHandler(scrollTop);
    }
  }

  onScroll(handler: (scrollTop: number) => void): void {
    this.scrollHandler = handler;
  }

  getItemIndex(item: T): number {
    return this.items.indexOf(item);
  }

  scrollToItem(index: number): number {
    const scrollTop = index * this.config.itemHeight;
    this.calculateVisibleRange(scrollTop);
    return scrollTop;
  }
}

/**
 * Memory cache with LRU eviction
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private accessOrder: K[] = [];
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to front (most recently used)
      this.updateAccessOrder(key);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.updateAccessOrder(key);
    } else {
      if (this.cache.size >= this.maxSize) {
        // Evict least recently used
        const lru = this.accessOrder.shift();
        if (lru !== undefined) {
          this.cache.delete(lru);
        }
      }
      this.cache.set(key, value);
      this.accessOrder.push(key);
    }
  }

  private updateAccessOrder(key: K): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Batch processor for API requests
 */
export class BatchProcessor<T, R> {
  private queue: Array<{ item: T; resolve: (result: R) => void; reject: (error: any) => void }> = [];
  private timer: NodeJS.Timeout | null = null;
  private processing = false;

  constructor(
    private batchSize: number,
    private batchDelay: number,
    private processBatch: (items: T[]) => Promise<R[]>
  ) {}

  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      this.scheduleProcess();
    });
  }

  private scheduleProcess(): void {
    if (this.timer) return;

    if (this.queue.length >= this.batchSize) {
      this.process();
    } else {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.process();
      }, this.batchDelay);
    }
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      const items = batch.map(b => b.item);
      const results = await this.processBatch(items);

      batch.forEach((b, i) => {
        b.resolve(results[i]);
      });
    } catch (error) {
      batch.forEach(b => {
        b.reject(error);
      });
    } finally {
      this.processing = false;

      if (this.queue.length > 0) {
        this.scheduleProcess();
      }
    }
  }
}

/**
 * Web Worker manager for heavy computations
 */
export class WorkerManager {
  private worker: Worker | null = null;
  private tasks = new Map<string, { resolve: Function; reject: Function }>();

  constructor(private workerScript: string) {}

  async init(): Promise<void> {
    const blob = new Blob([this.workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    this.worker = new Worker(workerUrl);

    this.worker.onmessage = (event) => {
      const { id, result, error } = event.data;
      const task = this.tasks.get(id);

      if (task) {
        if (error) {
          task.reject(error);
        } else {
          task.resolve(result);
        }
        this.tasks.delete(id);
      }
    };

    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
      this.tasks.forEach(task => task.reject(error));
      this.tasks.clear();
    };
  }

  async execute<T, R>(action: string, data: T): Promise<R> {
    if (!this.worker) {
      await this.init();
    }

    const id = Math.random().toString(36).substr(2, 9);

    return new Promise((resolve, reject) => {
      this.tasks.set(id, { resolve, reject });
      this.worker!.postMessage({ id, action, data });
    });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.tasks.clear();
  }
}

/**
 * Optimized search with indexing
 */
export class SearchIndex<T> {
  private index = new Map<string, Set<T>>();
  private tokenizer: (text: string) => string[];

  constructor(tokenizer?: (text: string) => string[]) {
    this.tokenizer = tokenizer || this.defaultTokenizer;
  }

  private defaultTokenizer(text: string): string[] {
    return text.toLowerCase().split(/\s+/).filter(token => token.length > 2);
  }

  addDocument(doc: T, fields: Record<string, string>): void {
    for (const [field, value] of Object.entries(fields)) {
      const tokens = this.tokenizer(value);

      for (const token of tokens) {
        const key = `${field}:${token}`;
        if (!this.index.has(key)) {
          this.index.set(key, new Set());
        }
        this.index.get(key)!.add(doc);
      }
    }
  }

  search(query: string, field?: string): T[] {
    const tokens = this.tokenizer(query);
    const results = new Map<T, number>();

    for (const token of tokens) {
      const keys = field ? [`${field}:${token}`] : Array.from(this.index.keys()).filter(k => k.endsWith(`:${token}`));

      for (const key of keys) {
        const docs = this.index.get(key);
        if (docs) {
          docs.forEach(doc => {
            results.set(doc, (results.get(doc) || 0) + 1);
          });
        }
      }
    }

    // Sort by relevance (number of matching tokens)
    return Array.from(results.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([doc]) => doc);
  }

  clear(): void {
    this.index.clear();
  }
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  mark(name: string): void {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark?: string): number {
    const measureName = `${name}_measure`;

    if (endMark) {
      performance.measure(measureName, startMark, endMark);
    } else {
      performance.measure(measureName, startMark);
    }

    const measure = performance.getEntriesByName(measureName)[0] as PerformanceMeasure;
    const duration = measure.duration;

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);

    // Clean up
    performance.clearMarks(startMark);
    if (endMark) performance.clearMarks(endMark);
    performance.clearMeasures(measureName);

    return duration;
  }

  getStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

// Export singleton instances
export const lazyImageLoader = new LazyImageLoader();
export const performanceMonitor = new PerformanceMonitor();