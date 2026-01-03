/**
 * IndexedDB Storage for Self-Healing
 * Manages fingerprints and healing history
 */

import type {
  HealingHistoryEntry,
  IFingerprintStorage,
  IHealingHistoryStorage,
  SemanticFingerprint,
} from '../../types/healing';

const DB_NAME = 'midscene-self-healing';
const DB_VERSION = 1;
const FINGERPRINT_STORE = 'fingerprints';
const HISTORY_STORE = 'healing-history';

const MAX_HISTORY_ITEMS = 1000;

class HealingStorage implements IFingerprintStorage, IHealingHistoryStorage {
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
        console.error('Healing IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Fingerprints store
        if (!db.objectStoreNames.contains(FINGERPRINT_STORE)) {
          const store = db.createObjectStore(FINGERPRINT_STORE, {
            keyPath: 'id',
          });
          store.createIndex('stepId', 'stepId', { unique: true });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Healing history store
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
          store.createIndex('stepId', 'stepId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error('Healing database not initialized');
    }
    return this.db;
  }

  // ==================== Fingerprint Operations ====================

  async get(stepId: string): Promise<SemanticFingerprint | null> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([FINGERPRINT_STORE], 'readonly');
        const store = transaction.objectStore(FINGERPRINT_STORE);
        const index = store.index('stepId');
        const request = index.get(stepId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get fingerprint:', error);
      return null;
    }
  }

  async save(fingerprint: SemanticFingerprint): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([FINGERPRINT_STORE], 'readwrite');
        const store = transaction.objectStore(FINGERPRINT_STORE);
        const request = store.add(fingerprint);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to save fingerprint:', error);
    }
  }

  async update(fingerprint: SemanticFingerprint): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([FINGERPRINT_STORE], 'readwrite');
        const store = transaction.objectStore(FINGERPRINT_STORE);
        const request = store.put(fingerprint);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to update fingerprint:', error);
    }
  }

  async delete(stepId: string): Promise<void> {
    try {
      const fingerprint = await this.get(stepId);
      if (!fingerprint) return;

      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([FINGERPRINT_STORE], 'readwrite');
        const store = transaction.objectStore(FINGERPRINT_STORE);
        const request = store.delete(fingerprint.id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete fingerprint:', error);
    }
  }

  async getAllFingerprints(): Promise<SemanticFingerprint[]> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([FINGERPRINT_STORE], 'readonly');
        const store = transaction.objectStore(FINGERPRINT_STORE);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get all fingerprints:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([FINGERPRINT_STORE], 'readwrite');
        const store = transaction.objectStore(FINGERPRINT_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear fingerprints:', error);
    }
  }

  async cleanupExpired(retentionDays: number): Promise<number> {
    try {
      const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      const all = await this.getAllFingerprints();
      const expired = all.filter((f) => f.updatedAt < cutoffTime);

      const db = await this.ensureDB();

      for (const fingerprint of expired) {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([FINGERPRINT_STORE], 'readwrite');
          const store = transaction.objectStore(FINGERPRINT_STORE);
          const request = store.delete(fingerprint.id);

          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      return expired.length;
    } catch (error) {
      console.error('Failed to cleanup expired fingerprints:', error);
      return 0;
    }
  }

  // ==================== History Operations ====================

  async add(entry: HealingHistoryEntry): Promise<void> {
    try {
      const db = await this.ensureDB();

      // Check if we need to remove old items
      const allItems = await this.getAllHistory();
      if (allItems.length >= MAX_HISTORY_ITEMS) {
        const itemsToRemove = allItems.slice(MAX_HISTORY_ITEMS - 1);
        for (const oldItem of itemsToRemove) {
          await this.deleteHistoryItem(oldItem.id);
        }
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HISTORY_STORE], 'readwrite');
        const store = transaction.objectStore(HISTORY_STORE);
        const request = store.add(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to add history entry:', error);
    }
  }

  async getByStepId(stepId: string): Promise<HealingHistoryEntry[]> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HISTORY_STORE], 'readonly');
        const store = transaction.objectStore(HISTORY_STORE);
        const index = store.index('stepId');
        const request = index.getAll(stepId);

        request.onsuccess = () => {
          const items = request.result || [];
          items.sort((a, b) => b.timestamp - a.timestamp);
          resolve(items);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get history by stepId:', error);
      return [];
    }
  }

  private async getAllHistory(): Promise<HealingHistoryEntry[]> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HISTORY_STORE], 'readonly');
        const store = transaction.objectStore(HISTORY_STORE);
        const index = store.index('timestamp');
        const request = index.getAll();

        request.onsuccess = () => {
          const items = request.result || [];
          items.sort((a, b) => b.timestamp - a.timestamp);
          resolve(items);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get all history:', error);
      return [];
    }
  }

  async getAllHistoryEntries(): Promise<HealingHistoryEntry[]> {
    return this.getAllHistory();
  }

  private async deleteHistoryItem(id: string): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HISTORY_STORE], 'readwrite');
        const store = transaction.objectStore(HISTORY_STORE);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete history item:', error);
    }
  }

  async clearHistory(): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HISTORY_STORE], 'readwrite');
        const store = transaction.objectStore(HISTORY_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }

  /**
   * Update a history entry (for userConfirmed and fingerprintUpdated tracking)
   */
  async updateHistoryEntry(entry: HealingHistoryEntry): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HISTORY_STORE], 'readwrite');
        const store = transaction.objectStore(HISTORY_STORE);
        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to update history entry:', error);
    }
  }

  /**
   * Get a history entry by healingId
   */
  async getHistoryByHealingId(
    healingId: string,
  ): Promise<HealingHistoryEntry | null> {
    try {
      const allHistory = await this.getAllHistory();
      return allHistory.find((h) => h.result.healingId === healingId) || null;
    } catch (error) {
      console.error('Failed to get history by healingId:', error);
      return null;
    }
  }
}

// Export singleton instance
export const healingStorage = new HealingStorage();
