/**
 * Screenshot Storage Service
 * Manages persistent storage of execution screenshots
 */

import type { MaskRegion } from '../types/masking';

/**
 * Screenshot metadata
 */
export interface ScreenshotMetadata {
  id: string;
  timestamp: number;
  testCaseId?: string;
  stepId?: string;
  stepIndex?: number;
  stepDescription?: string;
  url?: string;
  viewport?: {
    width: number;
    height: number;
  };
  hasMaskedRegions: boolean;
  maskedRegions?: MaskRegion[];
  status: 'success' | 'failed';
  errorMessage?: string;
}

/**
 * Screenshot data with metadata
 */
export interface StoredScreenshot {
  metadata: ScreenshotMetadata;
  dataUrl: string;
  thumbnailUrl?: string;
}

/**
 * Screenshot storage configuration
 */
export interface ScreenshotStorageConfig {
  enabled: boolean;
  maxScreenshots: number;
  maxThumbnailSize: number;
  compressionQuality: number;
  generateThumbnails: boolean;
  retentionDays: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ScreenshotStorageConfig = {
  enabled: true,
  maxScreenshots: 500,
  maxThumbnailSize: 150,
  compressionQuality: 0.8,
  generateThumbnails: true,
  retentionDays: 30,
};

/**
 * Storage key for screenshots
 */
const STORAGE_KEY = 'midscene_screenshots';
const METADATA_KEY = 'midscene_screenshots_meta';

/**
 * ScreenshotStorage class
 */
export class ScreenshotStorage {
  private config: ScreenshotStorageConfig;
  private metadataCache: Map<string, ScreenshotMetadata> = new Map();
  private initialized = false;

  constructor(config: Partial<ScreenshotStorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize storage and load metadata
   */
  private async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load metadata from chrome.storage.local
      const result = await chrome.storage.local.get(METADATA_KEY);
      const stored = result[METADATA_KEY];

      if (Array.isArray(stored)) {
        for (const meta of stored) {
          this.metadataCache.set(meta.id, meta);
        }
      }

      this.initialized = true;

      // Clean up old screenshots
      await this.cleanupOldScreenshots();
    } catch (error) {
      console.warn('[ScreenshotStorage] Failed to initialize:', error);
      this.initialized = true;
    }
  }

  /**
   * Save metadata to storage
   */
  private async saveMetadata(): Promise<void> {
    const metadata = Array.from(this.metadataCache.values());

    try {
      await chrome.storage.local.set({
        [METADATA_KEY]: metadata,
      });
    } catch (error) {
      console.warn('[ScreenshotStorage] Failed to save metadata:', error);
    }
  }

  /**
   * Generate thumbnail from data URL
   */
  private async generateThumbnail(
    dataUrl: string,
    maxSize = this.config.maxThumbnailSize,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate scaled dimensions
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', this.config.compressionQuality));
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Compress screenshot data
   */
  private async compressScreenshot(
    dataUrl: string,
  ): Promise<{ dataUrl: string; size: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0);

          // Get compressed data URL
          const compressed = canvas.toDataURL('image/jpeg', this.config.compressionQuality);

          // Calculate approximate size
          const base64Length = compressed.length - 'data:image/jpeg;base64,'.length;
          const sizeInBytes = (base64Length * 3) / 4;

          resolve({
            dataUrl: compressed,
            size: Math.round(sizeInBytes),
          });
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Store a screenshot
   */
  async store(
    dataUrl: string,
    metadata: Partial<ScreenshotMetadata> & { status: 'success' | 'failed' },
  ): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    await this.init();

    const id = metadata.id || `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = metadata.timestamp || Date.now();

    const fullMetadata: ScreenshotMetadata = {
      id,
      timestamp,
      hasMaskedRegions: false,
      ...metadata,
    };

    try {
      // Compress screenshot
      const { dataUrl: compressedDataUrl } = await this.compressScreenshot(dataUrl);

      // Generate thumbnail
      let thumbnailUrl: string | undefined;
      if (this.config.generateThumbnails) {
        try {
          thumbnailUrl = await this.generateThumbnail(compressedDataUrl);
        } catch {
          // Thumbnail generation is optional
        }
      }

      // Store in IndexedDB for larger data
      const screenshot: StoredScreenshot = {
        metadata: fullMetadata,
        dataUrl: compressedDataUrl,
        thumbnailUrl,
      };

      // Use IndexedDB for storage
      await this.storeToIndexedDB(id, screenshot);

      // Update metadata cache
      this.metadataCache.set(id, fullMetadata);

      // Enforce max limit
      await this.enforceLimit();

      // Save metadata
      await this.saveMetadata();

      return id;
    } catch (error) {
      console.error('[ScreenshotStorage] Failed to store screenshot:', error);
      return '';
    }
  }

  /**
   * Store screenshot in IndexedDB
   */
  private async storeToIndexedDB(id: string, screenshot: StoredScreenshot): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MidsceneScreenshots', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction(['screenshots'], 'readwrite');
          const store = transaction.objectStore('screenshots');
          store.put(screenshot, id);

          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error);
          };
        } catch (error) {
          db.close();
          reject(error);
        }
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('screenshots')) {
          db.createObjectStore('screenshots');
        }
      };
    });
  }

  /**
   * Retrieve a screenshot
   */
  async retrieve(id: string): Promise<StoredScreenshot | null> {
    if (!this.config.enabled) {
      return null;
    }

    await this.init();

    try {
      return await this.retrieveFromIndexedDB(id);
    } catch (error) {
      console.error('[ScreenshotStorage] Failed to retrieve screenshot:', error);
      return null;
    }
  }

  /**
   * Retrieve screenshot from IndexedDB
   */
  private async retrieveFromIndexedDB(id: string): Promise<StoredScreenshot | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MidsceneScreenshots', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction(['screenshots'], 'readonly');
          const store = transaction.objectStore('screenshots');
          const getRequest = store.get(id);

          getRequest.onsuccess = () => {
            db.close();
            resolve(getRequest.result || null);
          };
          getRequest.onerror = () => {
            db.close();
            reject(getRequest.error);
          };
        } catch (error) {
          db.close();
          reject(error);
        }
      };
    });
  }

  /**
   * List all screenshots metadata
   */
  async list(
    filter?: Partial<ScreenshotMetadata>,
  ): Promise<ScreenshotMetadata[]> {
    await this.init();

    let metadata = Array.from(this.metadataCache.values());

    if (filter) {
      metadata = metadata.filter((meta) => {
        for (const [key, value] of Object.entries(filter)) {
          if ((meta as any)[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    // Sort by timestamp descending
    metadata.sort((a, b) => b.timestamp - a.timestamp);

    return metadata;
  }

  /**
   * Delete a screenshot
   */
  async delete(id: string): Promise<boolean> {
    await this.init();

    try {
      await this.deleteFromIndexedDB(id);
      this.metadataCache.delete(id);
      await this.saveMetadata();
      return true;
    } catch (error) {
      console.error('[ScreenshotStorage] Failed to delete screenshot:', error);
      return false;
    }
  }

  /**
   * Delete from IndexedDB
   */
  private async deleteFromIndexedDB(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MidsceneScreenshots', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction(['screenshots'], 'readwrite');
          const store = transaction.objectStore('screenshots');
          store.delete(id);

          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error);
          };
        } catch (error) {
          db.close();
          reject(error);
        }
      };
    });
  }

  /**
   * Clear all screenshots
   */
  async clear(): Promise<void> {
    await this.init();

    try {
      // Clear IndexedDB
      await this.clearIndexedDB();

      // Clear metadata cache
      this.metadataCache.clear();

      // Save empty metadata
      await this.saveMetadata();
    } catch (error) {
      console.error('[ScreenshotStorage] Failed to clear screenshots:', error);
    }
  }

  /**
   * Clear IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MidsceneScreenshots', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction(['screenshots'], 'readwrite');
          const store = transaction.objectStore('screenshots');
          store.clear();

          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error);
          };
        } catch (error) {
          db.close();
          reject(error);
        }
      };
    });
  }

  /**
   * Enforce max screenshots limit
   */
  private async enforceLimit(): Promise<void> {
    const metadata = Array.from(this.metadataCache.values());
    if (metadata.length <= this.config.maxScreenshots) {
      return;
    }

    // Sort by timestamp, oldest first
    metadata.sort((a, b) => a.timestamp - b.timestamp);

    // Delete oldest screenshots
    const toDelete = metadata.slice(0, metadata.length - this.config.maxScreenshots);
    for (const meta of toDelete) {
      await this.deleteFromIndexedDB(meta.id);
      this.metadataCache.delete(meta.id);
    }
  }

  /**
   * Clean up old screenshots based on retention policy
   */
  private async cleanupOldScreenshots(): Promise<void> {
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = now - retentionMs;

    const toDelete: string[] = [];

    for (const [id, meta] of this.metadataCache.entries()) {
      if (meta.timestamp < cutoffTime) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      await this.deleteFromIndexedDB(id);
      this.metadataCache.delete(id);
    }

    if (toDelete.length > 0) {
      await this.saveMetadata();
      console.log(`[ScreenshotStorage] Cleaned up ${toDelete.length} old screenshots`);
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStats(): Promise<{
    count: number;
    totalSize: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  }> {
    await this.init();

    const metadata = Array.from(this.metadataCache.values());
    let totalSize = 0;

    // Calculate total size from IndexedDB
    try {
      totalSize = await this.calculateIndexedDBSize();
    } catch {
      // Size calculation failed, return 0
    }

    return {
      count: metadata.length,
      totalSize,
      oldestTimestamp: metadata.length > 0
        ? Math.min(...metadata.map((m) => m.timestamp))
        : 0,
      newestTimestamp: metadata.length > 0
        ? Math.max(...metadata.map((m) => m.timestamp))
        : 0,
    };
  }

  /**
   * Calculate IndexedDB size
   */
  private async calculateIndexedDBSize(): Promise<number> {
    return new Promise((resolve) => {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((estimate) => {
          // This is a rough estimate
          resolve(estimate.usage || 0);
        }).catch(() => resolve(0));
      } else {
        resolve(0);
      }
    });
  }

  /**
   * Export screenshots as a zip file (for download)
   */
  async export(testCaseId?: string): Promise<Blob | null> {
    await this.init();

    const metadata = testCaseId
      ? Array.from(this.metadataCache.values()).filter((m) => m.testCaseId === testCaseId)
      : Array.from(this.metadataCache.values());

    if (metadata.length === 0) {
      return null;
    }

    // For now, just return the first screenshot
    // Full zip export would require JSZip library
    const first = await this.retrieve(metadata[0].id);
    if (!first) {
      return null;
    }

    // Convert data URL to blob
    const byteString = atob(first.dataUrl.split(',')[1]);
    const array = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      array[i] = byteString.charCodeAt(i);
    }

    return new Blob([array], { type: 'image/png' });
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ScreenshotStorageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): ScreenshotStorageConfig {
    return { ...this.config };
  }
}

/**
 * Default screenshot storage instance
 */
export const screenshotStorage = new ScreenshotStorage();

/**
 * Utility function to store a screenshot
 */
export async function storeExecutionScreenshot(
  dataUrl: string,
  metadata: {
    testCaseId?: string;
    stepId?: string;
    stepIndex?: number;
    stepDescription?: string;
    status: 'success' | 'failed';
    errorMessage?: string;
  },
): Promise<string> {
  return screenshotStorage.store(dataUrl, metadata);
}
