/**
 * Analytics Storage Service
 * IndexedDB-based storage for execution analytics data
 */

import type {
  AlertEvent,
  AlertRule,
  CaseStats,
  DEFAULT_FAILURES_BY_TYPE,
  DailyStats,
  ExecutionRecord,
  Report,
} from '../../types/analytics';

const DB_NAME = 'midscene-analytics';
const DB_VERSION = 1;

const STORES = {
  EXECUTIONS: 'executions',
  DAILY_STATS: 'daily-stats',
  CASE_STATS: 'case-stats',
  ALERT_RULES: 'alert-rules',
  ALERT_EVENTS: 'alert-events',
  REPORTS: 'reports',
} as const;

// Data retention: 90 days
const RETENTION_DAYS = 90;

class AnalyticsStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Analytics IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Executions store
        if (!db.objectStoreNames.contains(STORES.EXECUTIONS)) {
          const execStore = db.createObjectStore(STORES.EXECUTIONS, {
            keyPath: 'id',
          });
          execStore.createIndex('caseId', 'caseId', { unique: false });
          execStore.createIndex('startTime', 'startTime', { unique: false });
          execStore.createIndex('status', 'status', { unique: false });
        }

        // Daily stats store
        if (!db.objectStoreNames.contains(STORES.DAILY_STATS)) {
          db.createObjectStore(STORES.DAILY_STATS, { keyPath: 'date' });
        }

        // Case stats store
        if (!db.objectStoreNames.contains(STORES.CASE_STATS)) {
          const caseStore = db.createObjectStore(STORES.CASE_STATS, {
            keyPath: 'caseId',
          });
          caseStore.createIndex('isFlaky', 'isFlaky', { unique: false });
          caseStore.createIndex('stabilityScore', 'stabilityScore', {
            unique: false,
          });
        }

        // Alert rules store
        if (!db.objectStoreNames.contains(STORES.ALERT_RULES)) {
          const alertStore = db.createObjectStore(STORES.ALERT_RULES, {
            keyPath: 'id',
          });
          alertStore.createIndex('enabled', 'enabled', { unique: false });
        }

        // Alert events store
        if (!db.objectStoreNames.contains(STORES.ALERT_EVENTS)) {
          const eventStore = db.createObjectStore(STORES.ALERT_EVENTS, {
            keyPath: 'id',
          });
          eventStore.createIndex('ruleId', 'ruleId', { unique: false });
          eventStore.createIndex('triggeredAt', 'triggeredAt', {
            unique: false,
          });
          eventStore.createIndex('acknowledged', 'acknowledged', {
            unique: false,
          });
        }

        // Reports store
        if (!db.objectStoreNames.contains(STORES.REPORTS)) {
          const reportStore = db.createObjectStore(STORES.REPORTS, {
            keyPath: 'id',
          });
          reportStore.createIndex('generatedAt', 'generatedAt', {
            unique: false,
          });
          reportStore.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error('Analytics database not initialized');
    }
    return this.db;
  }

  // ============ Execution Records ============

  async addExecution(record: ExecutionRecord): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.EXECUTIONS], 'readwrite');
      const store = tx.objectStore(STORES.EXECUTIONS);
      const request = store.add(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getExecution(id: string): Promise<ExecutionRecord | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.EXECUTIONS], 'readonly');
      const store = tx.objectStore(STORES.EXECUTIONS);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getExecutionsByTimeRange(
    startTime: number,
    endTime: number,
  ): Promise<ExecutionRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.EXECUTIONS], 'readonly');
      const store = tx.objectStore(STORES.EXECUTIONS);
      const index = store.index('startTime');
      const range = IDBKeyRange.bound(startTime, endTime);
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getExecutionsByCaseId(caseId: string): Promise<ExecutionRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.EXECUTIONS], 'readonly');
      const store = tx.objectStore(STORES.EXECUTIONS);
      const index = store.index('caseId');
      const request = index.getAll(caseId);
      request.onsuccess = () =>
        resolve(
          (request.result || []).sort((a, b) => b.startTime - a.startTime),
        );
      request.onerror = () => reject(request.error);
    });
  }

  async getRecentExecutions(limit = 100): Promise<ExecutionRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.EXECUTIONS], 'readonly');
      const store = tx.objectStore(STORES.EXECUTIONS);
      const index = store.index('startTime');
      const results: ExecutionRecord[] = [];

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

  async getFailedExecutions(limit = 1000): Promise<ExecutionRecord[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.EXECUTIONS], 'readonly');
      const store = tx.objectStore(STORES.EXECUTIONS);
      const index = store.index('status');
      const range = IDBKeyRange.only('failed');
      const results: ExecutionRecord[] = [];

      const request = index.openCursor(range, 'prev');
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

  // ============ Daily Stats ============

  async getDailyStats(date: string): Promise<DailyStats | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.DAILY_STATS], 'readonly');
      const store = tx.objectStore(STORES.DAILY_STATS);
      const request = store.get(date);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveDailyStats(stats: DailyStats): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.DAILY_STATS], 'readwrite');
      const store = tx.objectStore(STORES.DAILY_STATS);
      const request = store.put(stats);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDailyStatsRange(
    startDate: string,
    endDate: string,
  ): Promise<DailyStats[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.DAILY_STATS], 'readonly');
      const store = tx.objectStore(STORES.DAILY_STATS);
      const range = IDBKeyRange.bound(startDate, endDate);
      const request = store.getAll(range);
      request.onsuccess = () =>
        resolve(
          (request.result || []).sort((a, b) => a.date.localeCompare(b.date)),
        );
      request.onerror = () => reject(request.error);
    });
  }

  // ============ Case Stats ============

  async getCaseStats(caseId: string): Promise<CaseStats | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.CASE_STATS], 'readonly');
      const store = tx.objectStore(STORES.CASE_STATS);
      const request = store.get(caseId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveCaseStats(stats: CaseStats): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.CASE_STATS], 'readwrite');
      const store = tx.objectStore(STORES.CASE_STATS);
      const request = store.put(stats);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCaseStats(): Promise<CaseStats[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.CASE_STATS], 'readonly');
      const store = tx.objectStore(STORES.CASE_STATS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getFlakyCases(): Promise<CaseStats[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.CASE_STATS], 'readonly');
      const store = tx.objectStore(STORES.CASE_STATS);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        resolve(all.filter((c: CaseStats) => c.isFlaky === true));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ============ Alert Rules ============

  async getAlertRule(id: string): Promise<AlertRule | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.ALERT_RULES], 'readonly');
      const store = tx.objectStore(STORES.ALERT_RULES);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveAlertRule(rule: AlertRule): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.ALERT_RULES], 'readwrite');
      const store = tx.objectStore(STORES.ALERT_RULES);
      const request = store.put(rule);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteAlertRule(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.ALERT_RULES], 'readwrite');
      const store = tx.objectStore(STORES.ALERT_RULES);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllAlertRules(): Promise<AlertRule[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.ALERT_RULES], 'readonly');
      const store = tx.objectStore(STORES.ALERT_RULES);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getEnabledAlertRules(): Promise<AlertRule[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.ALERT_RULES], 'readonly');
      const store = tx.objectStore(STORES.ALERT_RULES);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        resolve(all.filter((r: AlertRule) => r.enabled === true));
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ============ Alert Events ============

  async addAlertEvent(event: AlertEvent): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.ALERT_EVENTS], 'readwrite');
      const store = tx.objectStore(STORES.ALERT_EVENTS);
      const request = store.add(event);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRecentAlertEvents(limit = 50): Promise<AlertEvent[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.ALERT_EVENTS], 'readonly');
      const store = tx.objectStore(STORES.ALERT_EVENTS);
      const index = store.index('triggeredAt');
      const results: AlertEvent[] = [];

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

  async acknowledgeAlertEvent(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.ALERT_EVENTS], 'readwrite');
      const store = tx.objectStore(STORES.ALERT_EVENTS);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const event = getRequest.result;
        if (event) {
          event.acknowledged = true;
          const putRequest = store.put(event);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // ============ Reports ============

  async saveReport(report: Report): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.REPORTS], 'readwrite');
      const store = tx.objectStore(STORES.REPORTS);
      const request = store.put(report);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getReport(id: string): Promise<Report | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.REPORTS], 'readonly');
      const store = tx.objectStore(STORES.REPORTS);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getRecentReports(limit = 20): Promise<Report[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.REPORTS], 'readonly');
      const store = tx.objectStore(STORES.REPORTS);
      const index = store.index('generatedAt');
      const results: Report[] = [];

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

  // ============ Cleanup ============

  async cleanupOldData(): Promise<{ deleted: number }> {
    const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const cutoffDate = this.formatDate(cutoffTime);
    let deleted = 0;

    // Clean old executions
    const db = await this.ensureDB();

    // Delete old executions
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.EXECUTIONS], 'readwrite');
      const store = tx.objectStore(STORES.EXECUTIONS);
      const index = store.index('startTime');
      const range = IDBKeyRange.upperBound(cutoffTime);

      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    // Delete old daily stats
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.DAILY_STATS], 'readwrite');
      const store = tx.objectStore(STORES.DAILY_STATS);
      const range = IDBKeyRange.upperBound(cutoffDate);

      const request = store.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    return { deleted };
  }

  async clearAllData(): Promise<void> {
    const db = await this.ensureDB();

    const stores = Object.values(STORES);
    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  // ============ Utility ============

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0];
  }
}

export const analyticsStorage = new AnalyticsStorage();
