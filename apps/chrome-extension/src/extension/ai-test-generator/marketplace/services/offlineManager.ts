/**
 * Offline Manager Service
 * Handles offline support with intelligent caching and sync
 */

import type { Template, TemplateSummary } from '../types';

const STORAGE_KEYS = {
  CACHE_PREFIX: 'marketplace_cache_',
  SYNC_QUEUE: 'marketplace_sync_queue',
  OFFLINE_STATUS: 'marketplace_offline_status',
  CACHE_MANIFEST: 'marketplace_cache_manifest',
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  version: string;
}

interface SyncQueueItem {
  id: string;
  action: 'download' | 'review' | 'rating';
  data: unknown;
  timestamp: number;
  retries: number;
}

interface CacheManifest {
  templates: string[];
  lastSync: number;
  version: string;
}

export class OfflineManager {
  private readonly cacheVersion = '1.0.0';
  private readonly defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxRetries = 3;
  private isOnline = true;
  private listeners: Set<(online: boolean) => void> = new Set();

  constructor() {
    this.initializeNetworkListener();
  }

  private initializeNetworkListener(): void {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;

      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners(true);
        this.processSyncQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners(false);
      });
    }
  }

  /**
   * Subscribe to online/offline status changes
   */
  onStatusChange(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(online: boolean): void {
    this.listeners.forEach((cb) => cb(online));
  }

  /**
   * Get current online status
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Cache a template for offline use
   */
  cacheTemplate(template: Template, ttl: number = this.defaultTTL): void {
    const key = `${STORAGE_KEYS.CACHE_PREFIX}template_${template.id}`;
    const entry: CacheEntry<Template> = {
      data: template,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      version: this.cacheVersion,
    };

    try {
      localStorage.setItem(key, JSON.stringify(entry));
      this.updateManifest(template.id, 'add');
    } catch (error) {
      console.warn('Failed to cache template:', error);
      // Try to free up space
      this.pruneCache();
      try {
        localStorage.setItem(key, JSON.stringify(entry));
        this.updateManifest(template.id, 'add');
      } catch (retryError) {
        console.error('Failed to cache template after pruning:', retryError);
      }
    }
  }

  /**
   * Get a cached template
   */
  getCachedTemplate(id: string): Template | null {
    const key = `${STORAGE_KEYS.CACHE_PREFIX}template_${id}`;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const entry: CacheEntry<Template> = JSON.parse(stored);

      // Check version compatibility
      if (entry.version !== this.cacheVersion) {
        localStorage.removeItem(key);
        return null;
      }

      // Check expiration
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(key);
        this.updateManifest(id, 'remove');
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Cache template list for offline browsing
   */
  cacheTemplateList(templates: TemplateSummary[], key: string): void {
    const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}list_${key}`;
    const entry: CacheEntry<TemplateSummary[]> = {
      data: templates,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.defaultTTL,
      version: this.cacheVersion,
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to cache template list:', error);
    }
  }

  /**
   * Get cached template list
   */
  getCachedTemplateList(key: string): TemplateSummary[] | null {
    const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}list_${key}`;
    try {
      const stored = localStorage.getItem(cacheKey);
      if (!stored) return null;

      const entry: CacheEntry<TemplateSummary[]> = JSON.parse(stored);

      if (entry.version !== this.cacheVersion || Date.now() > entry.expiresAt) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Add an action to the sync queue for when we're back online
   */
  addToSyncQueue(action: SyncQueueItem['action'], data: unknown): void {
    const queue = this.getSyncQueue();
    const item: SyncQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action,
      data,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(item);
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  }

  /**
   * Get the sync queue
   */
  private getSyncQueue(): SyncQueueItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Process the sync queue when back online
   */
  async processSyncQueue(): Promise<void> {
    if (!this.isOnline) return;

    const queue = this.getSyncQueue();
    if (queue.length === 0) return;

    const remaining: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        await this.processQueueItem(item);
      } catch (error) {
        item.retries++;
        if (item.retries < this.maxRetries) {
          remaining.push(item);
        } else {
          console.error('Failed to process sync item after max retries:', item);
        }
      }
    }

    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(remaining));
  }

  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    // This would integrate with the actual API to sync
    // For now, just log the action
    console.log('Processing sync item:', item.action, item.data);

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Update the cache manifest
   */
  private updateManifest(
    templateId: string,
    action: 'add' | 'remove'
  ): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CACHE_MANIFEST);
      const manifest: CacheManifest = stored
        ? JSON.parse(stored)
        : { templates: [], lastSync: 0, version: this.cacheVersion };

      if (action === 'add') {
        if (!manifest.templates.includes(templateId)) {
          manifest.templates.push(templateId);
        }
      } else {
        manifest.templates = manifest.templates.filter((id) => id !== templateId);
      }

      manifest.lastSync = Date.now();
      localStorage.setItem(STORAGE_KEYS.CACHE_MANIFEST, JSON.stringify(manifest));
    } catch (error) {
      console.warn('Failed to update cache manifest:', error);
    }
  }

  /**
   * Get all cached template IDs
   */
  getCachedTemplateIds(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CACHE_MANIFEST);
      if (!stored) return [];
      const manifest: CacheManifest = JSON.parse(stored);
      return manifest.templates;
    } catch {
      return [];
    }
  }

  /**
   * Prune expired cache entries
   */
  pruneCache(): void {
    const keysToRemove: string[] = [];
    const prefix = STORAGE_KEYS.CACHE_PREFIX;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const entry: CacheEntry<unknown> = JSON.parse(stored);
            if (
              entry.version !== this.cacheVersion ||
              Date.now() > entry.expiresAt
            ) {
              keysToRemove.push(key);
            }
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      // Extract template ID and update manifest
      const match = key.match(/template_(.+)$/);
      if (match) {
        this.updateManifest(match[1], 'remove');
      }
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    const keysToRemove: string[] = [];
    const prefix = STORAGE_KEYS.CACHE_PREFIX;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(STORAGE_KEYS.CACHE_MANIFEST);
    localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    templateCount: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
    pendingSyncItems: number;
  } {
    let templateCount = 0;
    let totalSize = 0;
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    const prefix = STORAGE_KEYS.CACHE_PREFIX;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length * 2; // Approximate byte size
          try {
            const entry: CacheEntry<unknown> = JSON.parse(value);
            if (key.includes('template_')) {
              templateCount++;
            }
            if (oldestEntry === null || entry.timestamp < oldestEntry) {
              oldestEntry = entry.timestamp;
            }
            if (newestEntry === null || entry.timestamp > newestEntry) {
              newestEntry = entry.timestamp;
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
    }

    const syncQueue = this.getSyncQueue();

    return {
      templateCount,
      totalSize,
      oldestEntry,
      newestEntry,
      pendingSyncItems: syncQueue.length,
    };
  }

  /**
   * Prefetch templates for offline use
   */
  async prefetchTemplates(
    fetchTemplate: (id: string) => Promise<Template>,
    templateIds: string[]
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const id of templateIds) {
      // Skip if already cached and valid
      if (this.getCachedTemplate(id)) {
        success.push(id);
        continue;
      }

      try {
        const template = await fetchTemplate(id);
        this.cacheTemplate(template);
        success.push(id);
      } catch (error) {
        console.warn(`Failed to prefetch template ${id}:`, error);
        failed.push(id);
      }
    }

    return { success, failed };
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager();
