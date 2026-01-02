/**
 * History Service for AI Test Generator
 * Manages execution history storage using IndexedDB
 */

import type { TestCase, ExecutionResult } from '../types';

const DB_NAME = 'midscene-ai-test-generator';
const DB_VERSION = 1;
const HISTORY_STORE = 'execution-history';

const MAX_HISTORY_ITEMS = 50;

export interface ExecutionHistoryItem {
  id: string;
  createdAt: number;
  updatedAt: number;
  markdownInput: string;
  testCases: TestCase[];
  results: ExecutionResult[];
  generatedYaml: string;
  status: 'success' | 'partial' | 'failed' | 'cancelled';
  totalSteps: number;
  successSteps: number;
  failedSteps: number;
  duration: number; // in milliseconds
}

class HistoryService {
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
        console.error('History IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error('History database not initialized');
    }
    return this.db;
  }

  async getAllHistory(): Promise<ExecutionHistoryItem[]> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HISTORY_STORE], 'readonly');
        const store = transaction.objectStore(HISTORY_STORE);
        const index = store.index('createdAt');
        const request = index.getAll();

        request.onsuccess = () => {
          // Sort by createdAt descending (newest first)
          const items = request.result.sort(
            (a, b) => b.createdAt - a.createdAt
          );
          resolve(items);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get history:', error);
      return [];
    }
  }

  async getHistoryItem(id: string): Promise<ExecutionHistoryItem | null> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([HISTORY_STORE], 'readonly');
        const store = transaction.objectStore(HISTORY_STORE);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get history item:', error);
      return null;
    }
  }

  async addHistoryItem(item: ExecutionHistoryItem): Promise<void> {
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
        const request = store.add(item);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to add history item:', error);
    }
  }

  async deleteHistoryItem(id: string): Promise<void> {
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

  async clearAllHistory(): Promise<void> {
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

  // Helper to create a history item from current execution state
  createHistoryItem(
    markdownInput: string,
    testCases: TestCase[],
    results: ExecutionResult[],
    generatedYaml: string,
    startTime: number
  ): ExecutionHistoryItem {
    const now = Date.now();
    const successSteps = results.filter((r) => r.success).length;
    const failedSteps = results.filter((r) => !r.success).length;
    const totalSteps = results.length;

    let status: ExecutionHistoryItem['status'];
    if (failedSteps === 0 && successSteps === totalSteps && totalSteps > 0) {
      status = 'success';
    } else if (successSteps > 0 && failedSteps > 0) {
      status = 'partial';
    } else if (failedSteps > 0) {
      status = 'failed';
    } else {
      status = 'cancelled';
    }

    return {
      id: `history-${now}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: startTime,
      updatedAt: now,
      markdownInput,
      testCases,
      results,
      generatedYaml,
      status,
      totalSteps,
      successSteps,
      failedSteps,
      duration: now - startTime,
    };
  }
}

export const historyService = new HistoryService();
