/**
 * input: IndexedDB API, anomaly types
 * output: Persistent storage for anomalies, baselines, and patterns
 * pos: Data persistence layer for anomaly detection system
 * 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的CLAUDE.md。
 */

import type {
  Anomaly,
  AnomalyRecord,
  BaselineConfig,
  BaselineInfo,
  BaselineRecord,
  HealthScore,
  LearnedPattern,
  PatternRecord,
} from '../../types/anomaly';

const DB_NAME = 'midscene-anomaly-detection';
const DB_VERSION = 1;

// Store names
const ANOMALY_STORE = 'anomalies';
const BASELINE_STORE = 'baselines';
const PATTERN_STORE = 'patterns';
const HEALTH_SCORE_STORE = 'health-scores';

// Limits
const MAX_ANOMALY_ITEMS = 1000;
const MAX_HEALTH_SCORE_ITEMS = 365; // 1 year of daily scores

// ============================================================================
// Storage Interface Definitions
// ============================================================================

export interface IAnomalyStorage {
  save(anomaly: Anomaly): Promise<void>;
  get(id: string): Promise<Anomaly | null>;
  getAll(): Promise<Anomaly[]>;
  getActive(): Promise<Anomaly[]>;
  getByTimeRange(startTime: number, endTime: number): Promise<Anomaly[]>;
  getByMetric(metricName: string): Promise<Anomaly[]>;
  update(anomaly: Anomaly): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  // Aliases
  saveAnomaly(anomaly: Anomaly): Promise<void>;
  getAnomaly(id: string): Promise<Anomaly | null>;
  getAllAnomalies(): Promise<Anomaly[]>;
  getActiveAnomalies(): Promise<Anomaly[]>;
  getAnomaliesByTimeRange(
    startTime: number,
    endTime: number,
  ): Promise<Anomaly[]>;
  getAnomaliesByMetric(metricName: string): Promise<Anomaly[]>;
  deleteAnomaly(id: string): Promise<void>;
  clearAnomalies(): Promise<void>;
}

export interface IBaselineStorage {
  save(
    metricName: string,
    baseline: BaselineInfo,
    config: BaselineConfig,
  ): Promise<void>;
  get(metricName: string): Promise<BaselineRecord | null>;
  getAll(): Promise<BaselineRecord[]>;
  update(metricName: string, baseline: BaselineInfo): Promise<void>;
  delete(metricName: string): Promise<void>;
  clear(): Promise<void>;
}

export interface IPatternStorage {
  save(pattern: LearnedPattern): Promise<void>;
  get(id: string): Promise<LearnedPattern | null>;
  getAll(): Promise<LearnedPattern[]>;
  update(pattern: LearnedPattern): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface IHealthScoreStorage {
  save(score: HealthScore): Promise<void>;
  getLatest(): Promise<HealthScore | null>;
  getHistory(days: number): Promise<HealthScore[]>;
  clear(): Promise<void>;
}

// ============================================================================
// Anomaly Storage Implementation
// ============================================================================

class AnomalyStorage
  implements
    IAnomalyStorage,
    IBaselineStorage,
    IPatternStorage,
    IHealthScoreStorage
{
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Anomaly IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Anomalies store
        if (!db.objectStoreNames.contains(ANOMALY_STORE)) {
          const store = db.createObjectStore(ANOMALY_STORE, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('severity', 'severity', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('detectedAt', 'detectedAt', { unique: false });
          store.createIndex('_createdAt', '_createdAt', { unique: false });
        }

        // Baselines store
        if (!db.objectStoreNames.contains(BASELINE_STORE)) {
          const store = db.createObjectStore(BASELINE_STORE, {
            keyPath: 'metricName',
          });
          store.createIndex('_updatedAt', '_updatedAt', { unique: false });
        }

        // Patterns store
        if (!db.objectStoreNames.contains(PATTERN_STORE)) {
          const store = db.createObjectStore(PATTERN_STORE, { keyPath: 'id' });
          store.createIndex('type', 'pattern.type', { unique: false });
          store.createIndex('lastSeen', 'pattern.lastSeen', { unique: false });
        }

        // Health scores store
        if (!db.objectStoreNames.contains(HEALTH_SCORE_STORE)) {
          const store = db.createObjectStore(HEALTH_SCORE_STORE, {
            keyPath: 'calculatedAt',
          });
          store.createIndex('calculatedAt', 'calculatedAt', { unique: true });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error('Anomaly database not initialized');
    }
    return this.db;
  }

  // ==================== Anomaly Operations ====================

  async save(anomaly: Anomaly): Promise<void> {
    try {
      const db = await this.ensureDB();
      const now = Date.now();

      // Check if we need to remove old items
      const allItems = await this.getAll();
      if (allItems.length >= MAX_ANOMALY_ITEMS) {
        const itemsToRemove = allItems
          .sort(
            (a, b) =>
              (a as AnomalyRecord)._createdAt - (b as AnomalyRecord)._createdAt,
          )
          .slice(0, allItems.length - MAX_ANOMALY_ITEMS + 1);
        for (const item of itemsToRemove) {
          await this.delete(item.id);
        }
      }

      const record: AnomalyRecord = {
        ...anomaly,
        _createdAt: now,
        _updatedAt: now,
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([ANOMALY_STORE], 'readwrite');
        const store = transaction.objectStore(ANOMALY_STORE);
        const request = store.add(record);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to save anomaly:', error);
      throw error;
    }
  }

  async get(id: string): Promise<Anomaly | null> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([ANOMALY_STORE], 'readonly');
        const store = transaction.objectStore(ANOMALY_STORE);
        const request = store.get(id);

        request.onsuccess = () => {
          const record = request.result as AnomalyRecord | undefined;
          if (record) {
            // Remove internal fields
            const { _createdAt, _updatedAt, ...anomaly } = record;
            resolve(anomaly);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get anomaly:', error);
      return null;
    }
  }

  async getAll(): Promise<Anomaly[]> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([ANOMALY_STORE], 'readonly');
        const store = transaction.objectStore(ANOMALY_STORE);
        const index = store.index('detectedAt');
        const request = index.getAll();

        request.onsuccess = () => {
          const records = (request.result || []) as AnomalyRecord[];
          const anomalies = records
            .map(({ _createdAt, _updatedAt, ...anomaly }) => anomaly)
            .sort((a, b) => b.detectedAt - a.detectedAt);
          resolve(anomalies);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get all anomalies:', error);
      return [];
    }
  }

  async getActive(): Promise<Anomaly[]> {
    try {
      const all = await this.getAll();
      // Return all anomalies that are not resolved
      return all.filter((a) => a.status !== 'resolved');
    } catch (error) {
      console.error('Failed to get active anomalies:', error);
      return [];
    }
  }

  async getByTimeRange(startTime: number, endTime: number): Promise<Anomaly[]> {
    try {
      const all = await this.getAll();
      return all.filter(
        (a) => a.detectedAt >= startTime && a.detectedAt <= endTime,
      );
    } catch (error) {
      console.error('Failed to get anomalies by time range:', error);
      return [];
    }
  }

  async getByMetric(metricName: string): Promise<Anomaly[]> {
    try {
      const all = await this.getAll();
      return all.filter(
        (a) => a.metric === metricName || a.metric.includes(metricName),
      );
    } catch (error) {
      console.error('Failed to get anomalies by metric:', error);
      return [];
    }
  }

  // Aliases for compatibility with anomalyDetector
  async saveAnomaly(anomaly: Anomaly): Promise<void> {
    return this.save(anomaly);
  }

  async getAnomaly(id: string): Promise<Anomaly | null> {
    return this.get(id);
  }

  async getAllAnomalies(): Promise<Anomaly[]> {
    return this.getAll();
  }

  async getActiveAnomalies(): Promise<Anomaly[]> {
    return this.getActive();
  }

  async getAnomaliesByTimeRange(
    startTime: number,
    endTime: number,
  ): Promise<Anomaly[]> {
    return this.getByTimeRange(startTime, endTime);
  }

  async getAnomaliesByMetric(metricName: string): Promise<Anomaly[]> {
    return this.getByMetric(metricName);
  }

  async deleteAnomaly(id: string): Promise<void> {
    return this.delete(id);
  }

  async clearAnomalies(): Promise<void> {
    return this.clear();
  }

  async update(anomaly: Anomaly): Promise<void> {
    try {
      const db = await this.ensureDB();
      const existing = await this.get(anomaly.id);
      if (!existing) {
        throw new Error(`Anomaly not found: ${anomaly.id}`);
      }

      const record: AnomalyRecord = {
        ...anomaly,
        _createdAt: Date.now(), // Will be overwritten by existing value
        _updatedAt: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([ANOMALY_STORE], 'readwrite');
        const store = transaction.objectStore(ANOMALY_STORE);

        // First get the existing record to preserve _createdAt
        const getRequest = store.get(anomaly.id);
        getRequest.onsuccess = () => {
          const existingRecord = getRequest.result as AnomalyRecord;
          if (existingRecord) {
            record._createdAt = existingRecord._createdAt;
          }

          const putRequest = store.put(record);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    } catch (error) {
      console.error('Failed to update anomaly:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([ANOMALY_STORE], 'readwrite');
        const store = transaction.objectStore(ANOMALY_STORE);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete anomaly:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([ANOMALY_STORE], 'readwrite');
        const store = transaction.objectStore(ANOMALY_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear anomalies:', error);
      throw error;
    }
  }

  // ==================== Baseline Operations ====================

  async saveBaseline(
    metricName: string,
    baseline: BaselineInfo,
    config: BaselineConfig,
  ): Promise<void> {
    try {
      const db = await this.ensureDB();
      const now = Date.now();

      const record: BaselineRecord = {
        metricName,
        baseline,
        config,
        _createdAt: now,
        _updatedAt: now,
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([BASELINE_STORE], 'readwrite');
        const store = transaction.objectStore(BASELINE_STORE);
        const request = store.put(record); // Use put to allow updates

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to save baseline:', error);
      throw error;
    }
  }

  async getBaseline(metricName: string): Promise<BaselineRecord | null> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([BASELINE_STORE], 'readonly');
        const store = transaction.objectStore(BASELINE_STORE);
        const request = store.get(metricName);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get baseline:', error);
      return null;
    }
  }

  async getAllBaselines(): Promise<BaselineRecord[]> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([BASELINE_STORE], 'readonly');
        const store = transaction.objectStore(BASELINE_STORE);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get all baselines:', error);
      return [];
    }
  }

  async updateBaseline(
    metricName: string,
    baseline: BaselineInfo,
  ): Promise<void> {
    try {
      const existing = await this.getBaseline(metricName);
      if (!existing) {
        throw new Error(`Baseline not found: ${metricName}`);
      }

      await this.saveBaseline(metricName, baseline, existing.config);
    } catch (error) {
      console.error('Failed to update baseline:', error);
      throw error;
    }
  }

  async deleteBaseline(metricName: string): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([BASELINE_STORE], 'readwrite');
        const store = transaction.objectStore(BASELINE_STORE);
        const request = store.delete(metricName);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete baseline:', error);
      throw error;
    }
  }

  async clearBaselines(): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([BASELINE_STORE], 'readwrite');
        const store = transaction.objectStore(BASELINE_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear baselines:', error);
      throw error;
    }
  }

  // ==================== Pattern Operations ====================

  async savePattern(pattern: LearnedPattern): Promise<void> {
    try {
      const db = await this.ensureDB();
      const now = Date.now();

      const record: PatternRecord = {
        id: pattern.id,
        pattern,
        _createdAt: now,
        _updatedAt: now,
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PATTERN_STORE], 'readwrite');
        const store = transaction.objectStore(PATTERN_STORE);
        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to save pattern:', error);
      throw error;
    }
  }

  async getPattern(id: string): Promise<LearnedPattern | null> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PATTERN_STORE], 'readonly');
        const store = transaction.objectStore(PATTERN_STORE);
        const request = store.get(id);

        request.onsuccess = () => {
          const record = request.result as PatternRecord | undefined;
          resolve(record?.pattern || null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get pattern:', error);
      return null;
    }
  }

  async getAllPatterns(): Promise<LearnedPattern[]> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PATTERN_STORE], 'readonly');
        const store = transaction.objectStore(PATTERN_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
          const records = (request.result || []) as PatternRecord[];
          const patterns = records.map((r) => r.pattern);
          resolve(patterns);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get all patterns:', error);
      return [];
    }
  }

  async updatePattern(pattern: LearnedPattern): Promise<void> {
    await this.savePattern(pattern);
  }

  async deletePattern(id: string): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PATTERN_STORE], 'readwrite');
        const store = transaction.objectStore(PATTERN_STORE);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete pattern:', error);
      throw error;
    }
  }

  async clearPatterns(): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([PATTERN_STORE], 'readwrite');
        const store = transaction.objectStore(PATTERN_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear patterns:', error);
      throw error;
    }
  }

  // ==================== Health Score Operations ====================

  async saveHealthScore(score: HealthScore): Promise<void> {
    try {
      const db = await this.ensureDB();

      // Check if we need to remove old items
      const allScores = await this.getHealthScoreHistory(
        MAX_HEALTH_SCORE_ITEMS + 1,
      );
      if (allScores.length >= MAX_HEALTH_SCORE_ITEMS) {
        const scoresToRemove = allScores.slice(MAX_HEALTH_SCORE_ITEMS - 1);
        for (const oldScore of scoresToRemove) {
          await this.deleteHealthScore(oldScore.calculatedAt);
        }
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HEALTH_SCORE_STORE], 'readwrite');
        const store = transaction.objectStore(HEALTH_SCORE_STORE);
        const request = store.put(score);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to save health score:', error);
      throw error;
    }
  }

  async getLatestHealthScore(): Promise<HealthScore | null> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HEALTH_SCORE_STORE], 'readonly');
        const store = transaction.objectStore(HEALTH_SCORE_STORE);
        const index = store.index('calculatedAt');
        const request = index.openCursor(null, 'prev'); // Get newest first

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            resolve(cursor.value);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get latest health score:', error);
      return null;
    }
  }

  async getHealthScoreHistory(days: number): Promise<HealthScore[]> {
    try {
      const db = await this.ensureDB();
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HEALTH_SCORE_STORE], 'readonly');
        const store = transaction.objectStore(HEALTH_SCORE_STORE);
        const index = store.index('calculatedAt');
        const range = IDBKeyRange.lowerBound(cutoffTime);
        const request = index.getAll(range);

        request.onsuccess = () => {
          const scores = (request.result || []) as HealthScore[];
          scores.sort((a, b) => b.calculatedAt - a.calculatedAt);
          resolve(scores);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get health score history:', error);
      return [];
    }
  }

  private async deleteHealthScore(calculatedAt: number): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HEALTH_SCORE_STORE], 'readwrite');
        const store = transaction.objectStore(HEALTH_SCORE_STORE);
        const request = store.delete(calculatedAt);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete health score:', error);
    }
  }

  async clearHealthScores(): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HEALTH_SCORE_STORE], 'readwrite');
        const store = transaction.objectStore(HEALTH_SCORE_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear health scores:', error);
      throw error;
    }
  }

  // ==================== Utility Methods ====================

  /**
   * Clean up all old data
   */
  async cleanupOldData(
    retentionDays: number,
  ): Promise<{ anomalies: number; patterns: number }> {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let anomaliesRemoved = 0;
    let patternsRemoved = 0;

    // Clean old resolved/ignored anomalies
    const allAnomalies = await this.getAll();
    for (const anomaly of allAnomalies) {
      if (
        (anomaly.status === 'resolved' || anomaly.status === 'ignored') &&
        anomaly.detectedAt < cutoffTime
      ) {
        await this.delete(anomaly.id);
        anomaliesRemoved++;
      }
    }

    // Clean old patterns not seen recently
    const allPatterns = await this.getAllPatterns();
    for (const pattern of allPatterns) {
      if (pattern.lastSeen < cutoffTime) {
        await this.deletePattern(pattern.id);
        patternsRemoved++;
      }
    }

    return { anomalies: anomaliesRemoved, patterns: patternsRemoved };
  }

  /**
   * Get statistics about stored data
   */
  async getStorageStats(): Promise<{
    anomalyCount: number;
    activeAnomalyCount: number;
    baselineCount: number;
    patternCount: number;
    healthScoreCount: number;
  }> {
    const [anomalies, activeAnomalies, baselines, patterns, healthScores] =
      await Promise.all([
        this.getAll(),
        this.getActive(),
        this.getAllBaselines(),
        this.getAllPatterns(),
        this.getHealthScoreHistory(365),
      ]);

    return {
      anomalyCount: anomalies.length,
      activeAnomalyCount: activeAnomalies.length,
      baselineCount: baselines.length,
      patternCount: patterns.length,
      healthScoreCount: healthScores.length,
    };
  }
}

// Export singleton instance
export const anomalyStorage = new AnomalyStorage();
