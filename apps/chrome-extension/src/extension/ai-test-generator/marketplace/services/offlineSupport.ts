/**
 * Offline Support Service
 * Provides offline caching and synchronization for marketplace data
 */

import type {
  CategoryInfo,
  SearchResult,
  Template,
  TemplateSummary,
  TemplateVersion,
} from '../types';

const CACHE_VERSION = 1;
const CACHE_PREFIX = 'marketplace_offline_';
const CACHE_EXPIRY_HOURS = 24;
const DB_NAME = 'MarketplaceOfflineDB';
const DB_VERSION = 1;

interface CachedData<T> {
  data: T;
  timestamp: number;
  version: number;
}

interface OfflineQueueItem {
  id: string;
  action: 'favorite' | 'download' | 'review' | 'usage';
  data: any;
  timestamp: number;
  retryCount: number;
}

/**
 * IndexedDB wrapper for offline storage
 */
class OfflineDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Templates store
        if (!db.objectStoreNames.contains('templates')) {
          const templateStore = db.createObjectStore('templates', {
            keyPath: 'id',
          });
          templateStore.createIndex('category', 'category', { unique: false });
          templateStore.createIndex('timestamp', 'timestamp', {
            unique: false,
          });
        }

        // Template summaries store
        if (!db.objectStoreNames.contains('summaries')) {
          const summaryStore = db.createObjectStore('summaries', {
            keyPath: 'id',
          });
          summaryStore.createIndex('category', 'category', { unique: false });
        }

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }

        // Offline queue store
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
      };
    });
  }

  async get<T>(storeName: string, key: string): Promise<T | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(
    storeName: string,
    indexName?: string,
    query?: IDBKeyRange,
  ): Promise<T[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = query ? source.getAll(query) : source.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: string, data: T): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Offline support implementation
 */
export class OfflineSupport {
  private db: OfflineDatabase;
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.db = new OfflineDatabase();
    this.startPeriodicSync();
  }

  /**
   * Check if data is expired
   */
  private isExpired(timestamp: number): boolean {
    const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    return Date.now() - timestamp > expiryMs;
  }

  /**
   * Cache template data
   */
  async cacheTemplate(template: Template): Promise<void> {
    const cached: CachedData<Template> = {
      data: template,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    await this.db.put('templates', {
      ...template,
      timestamp: cached.timestamp,
    });
  }

  /**
   * Get cached template
   */
  async getCachedTemplate(id: string): Promise<Template | null> {
    const cached = await this.db.get<Template & { timestamp: number }>(
      'templates',
      id,
    );
    if (!cached || this.isExpired(cached.timestamp)) {
      return null;
    }
    const { timestamp, ...template } = cached;
    return template as Template;
  }

  /**
   * Cache template summaries
   */
  async cacheSummaries(summaries: TemplateSummary[]): Promise<void> {
    const timestamp = Date.now();
    for (const summary of summaries) {
      await this.db.put('summaries', { ...summary, timestamp });
    }
  }

  /**
   * Get cached summaries
   */
  async getCachedSummaries(category?: string): Promise<TemplateSummary[]> {
    let summaries: Array<TemplateSummary & { timestamp: number }>;

    if (category) {
      summaries = await this.db.getAll(
        'summaries',
        'category',
        IDBKeyRange.only(category),
      );
    } else {
      summaries = await this.db.getAll('summaries');
    }

    // Filter out expired entries
    return summaries
      .filter((s) => !this.isExpired(s.timestamp))
      .map(({ timestamp, ...summary }) => summary as TemplateSummary);
  }

  /**
   * Cache categories
   */
  async cacheCategories(categories: CategoryInfo[]): Promise<void> {
    const timestamp = Date.now();
    for (const category of categories) {
      await this.db.put('categories', { ...category, timestamp });
    }
  }

  /**
   * Get cached categories
   */
  async getCachedCategories(): Promise<CategoryInfo[]> {
    const categories = await this.db.getAll<
      CategoryInfo & { timestamp: number }
    >('categories');
    return categories
      .filter((c) => !this.isExpired(c.timestamp))
      .map(({ timestamp, ...category }) => category as CategoryInfo);
  }

  /**
   * Queue an offline action
   */
  async queueAction(
    action: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>,
  ): Promise<void> {
    const item: OfflineQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...action,
      timestamp: Date.now(),
      retryCount: 0,
    };
    await this.db.put('queue', item);
  }

  /**
   * Get queued actions
   */
  async getQueuedActions(): Promise<OfflineQueueItem[]> {
    return await this.db.getAll('queue');
  }

  /**
   * Process offline queue
   */
  async processQueue(
    onlineCallback: (item: OfflineQueueItem) => Promise<boolean>,
  ): Promise<void> {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    try {
      const items = await this.getQueuedActions();

      for (const item of items) {
        try {
          const success = await onlineCallback(item);
          if (success) {
            await this.db.delete('queue', item.id);
          } else {
            // Increment retry count
            item.retryCount++;
            if (item.retryCount >= 3) {
              // Remove after 3 failed attempts
              await this.db.delete('queue', item.id);
            } else {
              await this.db.put('queue', item);
            }
          }
        } catch (error) {
          console.error('Failed to process queued action:', error);
        }
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Check if offline mode is enabled
   */
  isOfflineMode(): boolean {
    return !navigator.onLine;
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    await this.db.clear('templates');
    await this.db.clear('summaries');
    await this.db.clear('categories');
    await this.db.clear('metadata');
  }

  /**
   * Clear expired cache entries
   */
  async cleanupExpiredCache(): Promise<void> {
    const stores = ['templates', 'summaries', 'categories'];

    for (const storeName of stores) {
      const items = await this.db.getAll<any>(storeName);
      for (const item of items) {
        if (item.timestamp && this.isExpired(item.timestamp)) {
          await this.db.delete(storeName, item.id);
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    templates: number;
    summaries: number;
    categories: number;
    queuedActions: number;
    sizeEstimate: number;
  }> {
    const templates = await this.db.getAll('templates');
    const summaries = await this.db.getAll('summaries');
    const categories = await this.db.getAll('categories');
    const queue = await this.db.getAll('queue');

    // Rough size estimate in bytes
    const sizeEstimate =
      JSON.stringify(templates).length +
      JSON.stringify(summaries).length +
      JSON.stringify(categories).length +
      JSON.stringify(queue).length;

    return {
      templates: templates.length,
      summaries: summaries.length,
      categories: categories.length,
      queuedActions: queue.length,
      sizeEstimate,
    };
  }

  /**
   * Prefetch popular templates for offline use
   */
  async prefetchPopular(
    fetchCallback: () => Promise<TemplateSummary[]>,
  ): Promise<void> {
    try {
      const popular = await fetchCallback();
      await this.cacheSummaries(popular);
    } catch (error) {
      console.error('Failed to prefetch popular templates:', error);
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    // Clean up expired cache every hour
    this.syncInterval = setInterval(
      () => {
        this.cleanupExpiredCache();
      },
      60 * 60 * 1000,
    );

    // Listen to online/offline events
    window.addEventListener('online', () => {
      console.log('Back online - processing queued actions');
      // Trigger queue processing when back online
    });

    window.addEventListener('offline', () => {
      console.log('Gone offline - actions will be queued');
    });
  }

  /**
   * Stop periodic sync
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

// Export singleton instance
export const offlineSupport = new OfflineSupport();
