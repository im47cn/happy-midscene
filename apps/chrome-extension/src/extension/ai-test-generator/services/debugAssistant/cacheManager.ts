/**
 * Cache Manager for Debug Assistant
 * Provides caching for LLM responses, page diagnostics, and other expensive operations
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  enabled?: boolean;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  evictedCount: number;
}

/**
 * Generic LRU cache with TTL support
 */
class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number;
  private enabled: boolean;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize ?? 100;
    this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes default
    this.enabled = options.enabled ?? true;
  }

  /**
   * Generate cache key from arguments
   */
  private generateKey(...args: Array<string | number | object>): string {
    return args
      .map((arg) => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg);
        }
        return String(arg);
      })
      .join(':');
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    if (this.ttl === 0) return false;
    return Date.now() - entry.timestamp > this.ttl;
  }

  /**
   * Evict oldest entry if cache is full
   */
  private evictIfNeeded(): void {
    if (this.cache.size >= this.maxSize) {
      // Find entry with lowest access count and oldest access time
      let oldestKey: string | null = null;
      let oldestScore = Infinity;

      for (const [key, entry] of this.cache.entries()) {
        const score = entry.lastAccess / (entry.accessCount + 1);
        if (score < oldestScore) {
          oldestScore = score;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }
  }

  /**
   * Get value from cache
   */
  get(...args: Parameters<typeof this.generateKey>): T | null {
    if (!this.enabled) return null;

    const key = this.generateKey(...args);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccess = Date.now();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(...args: [...prefix: Parameters<typeof this.generateKey>, value: T]): void {
    if (!this.enabled) return;

    const value = args.pop() as T;
    const key = this.generateKey(...args as Parameters<typeof this.generateKey>);

    this.evictIfNeeded();

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccess: Date.now(),
    });
  }

  /**
   * Check if key exists and is valid
   */
  has(...args: Parameters<typeof this.generateKey>): boolean {
    if (!this.enabled) return false;

    const key = this.generateKey(...args);
    const entry = this.cache.get(key);

    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific entry
   */
  delete(...args: Parameters<typeof this.generateKey>): boolean {
    const key = this.generateKey(...args);
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      evictedCount: this.stats.evictions,
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * Get or set pattern (common pattern for caching expensive computations)
   */
  async getOrSet(
    key: string,
    factory: () => Promise<T> | T,
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value);
    return value;
  }
}

/**
 * Cache Manager for Debug Assistant
 * Manages multiple cache instances for different data types
 */
export class CacheManager {
  private llmResponseCache: LRUCache<string>;
  private pageDiagnosticsCache: LRUCache<any>;
  private screenshotCache: LRUCache<string>;
  private contextCache: LRUCache<any>;
  private elementLocateCache: LRUCache<any>;
  private fixSuggestionCache: LRUCache<any>;
  private enabled: boolean;

  constructor(options: {
    llmCacheSize?: number;
    llmCacheTTL?: number;
    diagCacheSize?: number;
    diagCacheTTL?: number;
    screenshotCacheSize?: number;
    screenshotCacheTTL?: number;
    enabled?: boolean;
  } = {}) {
    this.llmResponseCache = new LRUCache<string>({
      maxSize: options.llmCacheSize ?? 50,
      ttl: options.llmCacheTTL ?? 10 * 60 * 1000, // 10 minutes
      enabled: options.enabled ?? true,
    });

    this.pageDiagnosticsCache = new LRUCache<any>({
      maxSize: options.diagCacheSize ?? 20,
      ttl: options.diagCacheTTL ?? 30 * 1000, // 30 seconds - page changes frequently
      enabled: options.enabled ?? true,
    });

    this.screenshotCache = new LRUCache<string>({
      maxSize: options.screenshotCacheSize ?? 10,
      ttl: options.screenshotCacheTTL ?? 60 * 1000, // 1 minute
      enabled: options.enabled ?? true,
    });

    this.contextCache = new LRUCache<any>({
      maxSize: 30,
      ttl: 60 * 1000, // 1 minute
      enabled: options.enabled ?? true,
    });

    this.elementLocateCache = new LRUCache<any>({
      maxSize: 100,
      ttl: 2 * 60 * 1000, // 2 minutes - elements can move
      enabled: options.enabled ?? true,
    });

    this.fixSuggestionCache = new LRUCache<any>({
      maxSize: 40,
      ttl: 15 * 60 * 1000, // 15 minutes - fixes stay relevant
      enabled: options.enabled ?? true,
    });

    this.enabled = options.enabled ?? true;

    // Periodic cleanup
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanExpired(), 60 * 1000); // Every minute
    }
  }

  /**
   * Enable or disable all caches
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.llmResponseCache = new LRUCache({ enabled });
    this.pageDiagnosticsCache = new LRUCache({ enabled });
    this.screenshotCache = new LRUCache({ enabled });
    this.contextCache = new LRUCache({ enabled });
    this.elementLocateCache = new LRUCache({ enabled });
    this.fixSuggestionCache = new LRUCache({ enabled });
  }

  /**
   * Cache LLM response
   */
  cacheLLMResponse(query: string, context: any, response: string): void {
    const key = this.generateQueryKey(query, context);
    this.llmResponseCache.set(key, response);
  }

  /**
   * Get cached LLM response
   */
  getLLMResponse(query: string, context: any): string | null {
    const key = this.generateQueryKey(query, context);
    return this.llmResponseCache.get(key);
  }

  /**
   * Get or create LLM response
   */
  async getOrCallLLM(
    query: string,
    context: any,
    factory: () => Promise<string>,
  ): Promise<string> {
    const cached = this.getLLMResponse(query, context);
    if (cached !== null) {
      return cached;
    }
    const response = await factory();
    this.cacheLLMResponse(query, context, response);
    return response;
  }

  /**
   * Cache page diagnostics
   */
  cachePageDiagnostics(url: string, diagnostics: any): void {
    this.pageDiagnosticsCache.set(url, diagnostics);
  }

  /**
   * Get cached page diagnostics
   */
  getPageDiagnostics(url: string): any | null {
    return this.pageDiagnosticsCache.get(url);
  }

  /**
   * Get or fetch page diagnostics
   */
  async getOrFetchDiagnostics(
    url: string,
    factory: () => Promise<any>,
  ): Promise<any> {
    const cached = this.getPageDiagnostics(url);
    if (cached !== null) {
      return cached;
    }
    const diagnostics = await factory();
    this.cachePageDiagnostics(url, diagnostics);
    return diagnostics;
  }

  /**
   * Cache screenshot
   */
  cacheScreenshot(label: string, screenshot: string): void {
    this.screenshotCache.set(label, screenshot);
  }

  /**
   * Get cached screenshot
   */
  getScreenshot(label: string): string | null {
    return this.screenshotCache.get(label);
  }

  /**
   * Cache debug context
   */
  cacheContext(sessionId: string, context: any): void {
    this.contextCache.set(sessionId, context);
  }

  /**
   * Get cached context
   */
  getContext(sessionId: string): any | null {
    return this.contextCache.get(sessionId);
  }

  /**
   * Cache element location
   */
  cacheElementLocation(selector: string, location: any): void {
    this.elementLocateCache.set(selector, location);
  }

  /**
   * Get cached element location
   */
  getElementLocation(selector: string): any | null {
    return this.elementLocateCache.get(selector);
  }

  /**
   * Invalidate element locations (call when page changes)
   */
  invalidateElementLocations(): void {
    this.elementLocateCache.clear();
  }

  /**
   * Cache fix suggestions
   */
  cacheFixSuggestions(errorPattern: string, suggestions: any[]): void {
    this.fixSuggestionCache.set(errorPattern, suggestions);
  }

  /**
   * Get cached fix suggestions
   */
  getFixSuggestions(errorPattern: string): any[] | null {
    return this.fixSuggestionCache.get(errorPattern);
  }

  /**
   * Generate consistent cache key from query and context
   */
  private generateQueryKey(query: string, context: any): string {
    // Create a simplified context hash for caching
    const contextKey = {
      errorType: context?.lastError?.type,
      hasScreenshot: !!context?.screenshot,
      stepIndex: context?.currentStep?.index,
    };
    return `${query}:${JSON.stringify(contextKey)}`;
  }

  /**
   * Clean all expired entries
   */
  cleanExpired(): number {
    let total = 0;
    total += this.llmResponseCache.cleanExpired();
    total += this.pageDiagnosticsCache.cleanExpired();
    total += this.screenshotCache.cleanExpired();
    total += this.contextCache.cleanExpired();
    total += this.elementLocateCache.cleanExpired();
    total += this.fixSuggestionCache.cleanExpired();
    return total;
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.llmResponseCache.clear();
    this.pageDiagnosticsCache.clear();
    this.screenshotCache.clear();
    this.contextCache.clear();
    this.elementLocateCache.clear();
    this.fixSuggestionCache.clear();
  }

  /**
   * Get combined cache statistics
   */
  getAllStats(): {
    llm: CacheStats;
    diagnostics: CacheStats;
    screenshots: CacheStats;
    context: CacheStats;
    elements: CacheStats;
    fixes: CacheStats;
    totalSize: number;
    overallHitRate: number;
  } {
    const llm = this.llmResponseCache.getStats();
    const diagnostics = this.pageDiagnosticsCache.getStats();
    const screenshots = this.screenshotCache.getStats();
    const context = this.contextCache.getStats();
    const elements = this.elementLocateCache.getStats();
    const fixes = this.fixSuggestionCache.getStats();

    const totalSize = llm.size + diagnostics.size + screenshots.size + context.size + elements.size + fixes.size;
    const totalHits = llm.totalHits + diagnostics.totalHits + screenshots.totalHits + context.totalHits + elements.totalHits + fixes.totalHits;
    const totalMisses = llm.totalMisses + diagnostics.totalMisses + screenshots.totalMisses + context.totalMisses + elements.totalMisses + fixes.totalMisses;
    const overallHitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;

    return {
      llm,
      diagnostics,
      screenshots,
      context,
      elements,
      fixes,
      totalSize,
      overallHitRate,
    };
  }

  /**
   * Export cache state for persistence
   */
  exportState(): {
    llmResponses: Array<{ key: string; value: string }>;
    fixSuggestions: Array<{ key: string; value: any }>;
  } {
    // Only export persistable caches
    return {
      llmResponses: [], // LLM responses are large, skip for now
      fixSuggestions: [], // Would need to serialize from the cache
    };
  }

  /**
   * Import cache state
   */
  importState(state: ReturnType<typeof this.exportState>): void {
    // Import logic for persisted cache state
    // For now, this is a placeholder
  }
}

// Singleton instance
let cacheManagerInstance: CacheManager | null = null;

/**
 * Get or create the cache manager instance
 */
export function getCacheManager(options?: Parameters<typeof CacheManager.prototype.constructor>[0]): CacheManager {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager(options);
  }
  return cacheManagerInstance;
}

/**
 * Reset the cache manager instance
 */
export function resetCacheManager(): void {
  cacheManagerInstance = null;
}
