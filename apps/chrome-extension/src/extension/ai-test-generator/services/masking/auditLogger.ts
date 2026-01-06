/**
 * Masking Audit Logger
 * Records and retrieves masking operations for audit purposes
 */

import type { MaskingAuditEntry, SensitiveCategory } from '../../types/masking';

const DB_NAME = 'midscene-masking-audit';
const DB_VERSION = 1;
const STORE_NAME = 'audit-entries';
const MAX_ENTRIES = 10000;
const RETENTION_DAYS = 30;

/**
 * Audit statistics summary
 */
export interface AuditStats {
  totalMasked: number;
  byCategory: Record<string, number>;
  byType: {
    text: number;
    screenshot: number;
    log: number;
    yaml: number;
  };
  dateRange: {
    start: number;
    end: number;
  };
}

class AuditLogger {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private memoryLog: MaskingAuditEntry[] = [];

  /**
   * Initialize IndexedDB for audit storage
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.warn('Failed to open audit database, using memory storage');
          resolve();
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('category', 'category', { unique: false });
            store.createIndex('ruleId', 'ruleId', { unique: false });
          }
        };
      } catch (error) {
        console.warn('IndexedDB not available, using memory storage');
        resolve();
      }
    });

    return this.initPromise;
  }

  /**
   * Log a masking operation
   */
  async log(entry: Omit<MaskingAuditEntry, 'id' | 'timestamp'>): Promise<void> {
    const fullEntry: MaskingAuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      ...entry,
    };

    await this.init();

    if (this.db) {
      try {
        await this.addToDB(fullEntry);
      } catch (error) {
        this.memoryLog.push(fullEntry);
      }
    } else {
      this.memoryLog.push(fullEntry);
      if (this.memoryLog.length > MAX_ENTRIES) {
        this.memoryLog = this.memoryLog.slice(-MAX_ENTRIES / 2);
      }
    }
  }

  private async addToDB(entry: MaskingAuditEntry): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get audit entries within a date range
   */
  async getEntries(
    startTime: number,
    endTime: number,
  ): Promise<MaskingAuditEntry[]> {
    await this.init();

    if (this.db) {
      return this.getEntriesFromDB(startTime, endTime);
    }

    return this.memoryLog.filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime,
    );
  }

  private async getEntriesFromDB(
    startTime: number,
    endTime: number,
  ): Promise<MaskingAuditEntry[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const range = IDBKeyRange.bound(startTime, endTime);
      const results: MaskingAuditEntry[] = [];

      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get audit statistics for a date range
   */
  async getStats(startTime: number, endTime: number): Promise<AuditStats> {
    const entries = await this.getEntries(startTime, endTime);

    const stats: AuditStats = {
      totalMasked: 0,
      byCategory: {},
      byType: {
        text: 0,
        screenshot: 0,
        log: 0,
        yaml: 0,
      },
      dateRange: {
        start: startTime,
        end: endTime,
      },
    };

    for (const entry of entries) {
      stats.totalMasked += entry.matchCount;
      stats.byCategory[entry.category] =
        (stats.byCategory[entry.category] || 0) + entry.matchCount;
      if (entry.type in stats.byType) {
        stats.byType[entry.type as keyof typeof stats.byType] +=
          entry.matchCount;
      }
    }

    return stats;
  }

  /**
   * Get recent audit entries
   */
  async getRecentEntries(limit = 100): Promise<MaskingAuditEntry[]> {
    await this.init();

    if (this.db) {
      return this.getRecentFromDB(limit);
    }

    return this.memoryLog.slice(-limit).reverse();
  }

  private async getRecentFromDB(limit: number): Promise<MaskingAuditEntry[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const results: MaskingAuditEntry[] = [];

      const request = index.openCursor(null, 'prev');
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clean up old entries
   */
  async cleanup(): Promise<number> {
    await this.init();

    const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    if (this.db) {
      deletedCount = await this.cleanupDB(cutoffTime);
    } else {
      const originalLength = this.memoryLog.length;
      this.memoryLog = this.memoryLog.filter((e) => e.timestamp >= cutoffTime);
      deletedCount = originalLength - this.memoryLog.length;
    }

    return deletedCount;
  }

  private async cleanupDB(cutoffTime: number): Promise<number> {
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTime);
      let deletedCount = 0;

      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get entries by category
   */
  async getEntriesByCategory(
    category: SensitiveCategory,
    limit = 100,
  ): Promise<MaskingAuditEntry[]> {
    await this.init();

    if (this.db) {
      return this.getEntriesByCategoryFromDB(category, limit);
    }

    return this.memoryLog
      .filter((e) => e.category === category)
      .slice(-limit)
      .reverse();
  }

  private async getEntriesByCategoryFromDB(
    category: SensitiveCategory,
    limit: number,
  ): Promise<MaskingAuditEntry[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('category');
      const results: MaskingAuditEntry[] = [];

      const request = index.openCursor(IDBKeyRange.only(category), 'prev');
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export audit log to JSON
   */
  async exportToJSON(startTime?: number, endTime?: number): Promise<string> {
    const start = startTime || 0;
    const end = endTime || Date.now();
    const entries = await this.getEntries(start, end);
    const stats = await this.getStats(start, end);

    return JSON.stringify(
      {
        exportedAt: Date.now(),
        dateRange: { start, end },
        stats,
        entries,
      },
      null,
      2,
    );
  }

  /**
   * Clear all audit entries
   */
  async clear(): Promise<void> {
    this.memoryLog = [];

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

export const auditLogger = new AuditLogger();
