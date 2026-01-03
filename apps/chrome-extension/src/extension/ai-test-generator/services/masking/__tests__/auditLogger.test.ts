/**
 * Audit Logger Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditLogger } from '../auditLogger';

// Mock IndexedDB
const mockIDBDatabase = {
  transaction: vi.fn(),
  objectStoreNames: {
    contains: vi.fn(() => false),
  },
  createObjectStore: vi.fn(() => ({
    createIndex: vi.fn(),
  })),
};

const mockIDBRequest = {
  result: mockIDBDatabase,
  error: null,
  onsuccess: null as (() => void) | null,
  onerror: null as (() => void) | null,
  onupgradeneeded: null as ((event: unknown) => void) | null,
};

describe('AuditLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the internal memory log by accessing the private property
    (auditLogger as any).memoryLog = [];
    (auditLogger as any).db = null;
    (auditLogger as any).initPromise = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log', () => {
    it('should log entry to memory when IndexedDB is not available', async () => {
      // IndexedDB is not available in Node.js test environment
      // The logger should fall back to memory storage automatically

      await auditLogger.log({
        type: 'text',
        ruleId: 'password',
        category: 'credential',
        source: 'test',
        matchCount: 1,
      });

      const recent = await auditLogger.getRecentEntries(10);
      expect(recent.length).toBeGreaterThan(0);
      expect(recent[0].ruleId).toBe('password');
    });
  });

  describe('getStats', () => {
    it('should return empty stats when no entries', async () => {
      const stats = await auditLogger.getStats(0, Date.now());

      expect(stats.totalMasked).toBe(0);
      expect(stats.byType.text).toBe(0);
      expect(stats.byType.screenshot).toBe(0);
    });

    it('should aggregate stats correctly', async () => {
      // Log multiple entries
      await auditLogger.log({
        type: 'text',
        ruleId: 'password',
        category: 'credential',
        source: 'test1',
        matchCount: 3,
      });

      await auditLogger.log({
        type: 'screenshot',
        ruleId: 'email',
        category: 'pii',
        source: 'test2',
        matchCount: 2,
      });

      await auditLogger.log({
        type: 'text',
        ruleId: 'phone',
        category: 'pii',
        source: 'test3',
        matchCount: 1,
      });

      const stats = await auditLogger.getStats(0, Date.now() + 1000);

      expect(stats.totalMasked).toBe(6);
      expect(stats.byType.text).toBe(4);
      expect(stats.byType.screenshot).toBe(2);
      expect(stats.byCategory.credential).toBe(3);
      expect(stats.byCategory.pii).toBe(3);
    });
  });

  describe('getRecentEntries', () => {
    it('should return entries in reverse chronological order', async () => {
      await auditLogger.log({
        type: 'text',
        ruleId: 'first',
        category: 'credential',
        source: 'test',
        matchCount: 1,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await auditLogger.log({
        type: 'text',
        ruleId: 'second',
        category: 'credential',
        source: 'test',
        matchCount: 1,
      });

      const recent = await auditLogger.getRecentEntries(10);

      expect(recent.length).toBe(2);
      expect(recent[0].ruleId).toBe('second');
      expect(recent[1].ruleId).toBe('first');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await auditLogger.log({
          type: 'text',
          ruleId: `rule-${i}`,
          category: 'credential',
          source: 'test',
          matchCount: 1,
        });
      }

      const recent = await auditLogger.getRecentEntries(3);

      expect(recent.length).toBe(3);
    });
  });

  describe('getEntriesByCategory', () => {
    it('should filter entries by category', async () => {
      await auditLogger.log({
        type: 'text',
        ruleId: 'password',
        category: 'credential',
        source: 'test',
        matchCount: 1,
      });

      await auditLogger.log({
        type: 'text',
        ruleId: 'email',
        category: 'pii',
        source: 'test',
        matchCount: 1,
      });

      await auditLogger.log({
        type: 'text',
        ruleId: 'token',
        category: 'credential',
        source: 'test',
        matchCount: 1,
      });

      const credentialEntries = await auditLogger.getEntriesByCategory(
        'credential',
        10,
      );

      expect(credentialEntries.length).toBe(2);
      expect(credentialEntries.every((e) => e.category === 'credential')).toBe(
        true,
      );
    });
  });

  describe('exportToJSON', () => {
    it('should export entries and stats to JSON', async () => {
      await auditLogger.log({
        type: 'text',
        ruleId: 'password',
        category: 'credential',
        source: 'test',
        matchCount: 5,
      });

      const jsonString = await auditLogger.exportToJSON();
      const exported = JSON.parse(jsonString);

      expect(exported.exportedAt).toBeDefined();
      expect(exported.stats).toBeDefined();
      expect(exported.entries).toHaveLength(1);
      expect(exported.stats.totalMasked).toBe(5);
    });
  });

  describe('clear', () => {
    it('should clear all entries', async () => {
      await auditLogger.log({
        type: 'text',
        ruleId: 'password',
        category: 'credential',
        source: 'test',
        matchCount: 1,
      });

      await auditLogger.clear();

      const recent = await auditLogger.getRecentEntries(10);
      expect(recent.length).toBe(0);
    });
  });
});
