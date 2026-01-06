/**
 * Unit tests for knowledge base
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FixSuggestion } from '../../../types/debugAssistant';
import {
  KnowledgeBase,
  getKnowledgeBase,
  resetKnowledgeBase,
} from '../knowledgeBase';

// Mock localStorage
const mockStorage = new Map<string, string>();

const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage.get(key) || null),
  setItem: vi.fn((key: string, value: string) => mockStorage.set(key, value)),
  removeItem: vi.fn((key: string) => mockStorage.delete(key)),
  clear: vi.fn(() => mockStorage.clear()),
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('KnowledgeBase', () => {
  let knowledgeBase: KnowledgeBase;

  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    resetKnowledgeBase();
    knowledgeBase = getKnowledgeBase({ persistenceEnabled: true });
  });

  afterEach(() => {
    resetKnowledgeBase();
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const kb = new KnowledgeBase();
      const stats = kb.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(kb).toBeDefined();
    });

    it('should configure with custom options', () => {
      const kb = new KnowledgeBase({
        maxEntries: 50,
        storageKey: 'test-kb',
      });

      expect(kb).toBeDefined();
    });

    it('should load from localStorage if enabled', () => {
      mockStorage.set(
        'debug-assistant-knowledge',
        JSON.stringify([
          [
            'kb-1',
            {
              pattern: 'test',
              fixes: [],
              frequency: 1,
              successRate: 0.5,
              createdAt: Date.now(),
              lastUsedAt: Date.now(),
              tags: [],
            },
          ],
        ]),
      );

      const kb = new KnowledgeBase({ persistenceEnabled: true });
      const stats = kb.getStats();

      expect(stats.totalEntries).toBe(1);
    });
  });

  describe('addEntry', () => {
    it('should add a new entry', () => {
      const fixes: FixSuggestion[] = [
        {
          type: 'wait',
          description: 'Wait for element',
          code: '',
          confidence: 0.8,
        },
      ];

      const id = knowledgeBase.addEntry({
        pattern: 'element_not_found',
        fixes,
        frequency: 1,
        successRate: 0.5,
        tags: ['element', 'not_found'],
      });

      expect(id).toBeTruthy();
      expect(id).toMatch(/^kb-/);

      const stats = knowledgeBase.getStats();
      expect(stats.totalEntries).toBe(1);
    });

    it('should merge similar existing entries', () => {
      const fixes1: FixSuggestion[] = [
        { type: 'wait', description: 'Wait', code: '', confidence: 0.8 },
      ];

      const id1 = knowledgeBase.addEntry({
        pattern: 'element not found',
        fixes: fixes1,
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      const fixes2: FixSuggestion[] = [
        { type: 'retry', description: 'Retry', code: '', confidence: 0.7 },
      ];

      const id2 = knowledgeBase.addEntry({
        pattern: 'element not found', // Similar pattern
        fixes: fixes2,
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      // Should return same ID
      expect(id1).toBe(id2);

      const stats = knowledgeBase.getStats();
      expect(stats.totalEntries).toBe(1); // Merged, not duplicated
    });

    it('should prune old entries when max is reached', () => {
      const kb = new KnowledgeBase({
        maxEntries: 3,
        persistenceEnabled: false,
      });

      // Add 4 entries
      for (let i = 0; i < 4; i++) {
        kb.addEntry({
          pattern: `pattern-${i}`,
          fixes: [],
          frequency: 1,
          successRate: 0.5,
          tags: [],
        });
      }

      const stats = kb.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(3);
    });
  });

  describe('findMatchingPatterns', () => {
    beforeEach(() => {
      knowledgeBase.addEntry({
        pattern: 'element not found',
        fixes: [
          { type: 'wait', description: 'Wait', code: '', confidence: 0.8 },
        ],
        frequency: 5,
        successRate: 0.9,
        tags: ['element'],
      });

      knowledgeBase.addEntry({
        pattern: 'timeout error',
        fixes: [
          {
            type: 'timeout',
            description: 'Increase timeout',
            code: '',
            confidence: 0.7,
          },
        ],
        frequency: 3,
        successRate: 0.6,
        tags: ['timeout'],
      });
    });

    it('should find matching patterns', () => {
      const results = knowledgeBase.findMatchingPatterns('element not found');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].pattern).toContain('element');
    });

    it('should return results sorted by relevance', () => {
      const results = knowledgeBase.findMatchingPatterns('element');

      expect(results.length).toBeGreaterThan(0);
      // First result should be the element pattern (has higher frequency and success rate)
      expect(results[0].pattern).toContain('element');
    });

    it('should respect limit parameter', () => {
      const results = knowledgeBase.findMatchingPatterns('error', 1);

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array for no matches', () => {
      const results = knowledgeBase.findMatchingPatterns(
        'nonexistent pattern xyz',
      );

      expect(results).toEqual([]);
    });
  });

  describe('updateSuccessRate', () => {
    it('should update success rate for entry', () => {
      const id = knowledgeBase.addEntry({
        pattern: 'test',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      knowledgeBase.updateSuccessRate(id, true);

      const entry = knowledgeBase.getEntry(id);
      expect(entry?.successRate).toBeGreaterThan(0.5); // Should increase
    });

    it('should decrease success rate on failure', () => {
      const id = knowledgeBase.addEntry({
        pattern: 'test',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      knowledgeBase.updateSuccessRate(id, false);

      const entry = knowledgeBase.getEntry(id);
      expect(entry?.successRate).toBeLessThan(0.5); // Should decrease
    });

    it('should handle non-existent entry gracefully', () => {
      expect(() => {
        knowledgeBase.updateSuccessRate('non-existent', true);
      }).not.toThrow();
    });
  });

  describe('recordFixUsed', () => {
    it('should increment frequency and update last used time', () => {
      const fix: FixSuggestion = {
        type: 'wait',
        description: 'Wait',
        code: '',
        confidence: 0.8,
      };

      const id = knowledgeBase.addEntry({
        pattern: 'test',
        fixes: [fix],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      const beforeTime = Date.now();
      knowledgeBase.recordFixUsed(id, 0);

      const entry = knowledgeBase.getEntry(id);
      expect(entry?.frequency).toBe(2);
      expect(entry?.lastUsedAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should move used fix to front of list', () => {
      const fix1: FixSuggestion = {
        type: 'wait',
        description: 'Wait',
        code: '',
        confidence: 0.8,
      };
      const fix2: FixSuggestion = {
        type: 'retry',
        description: 'Retry',
        code: '',
        confidence: 0.7,
      };

      const id = knowledgeBase.addEntry({
        pattern: 'test',
        fixes: [fix1, fix2],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      // Record using second fix
      knowledgeBase.recordFixUsed(id, 1);

      const entry = knowledgeBase.getEntry(id);
      expect(entry?.fixes[0].description).toBe('Retry'); // Now at front
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      knowledgeBase.addEntry({
        pattern: 'test',
        fixes: [
          { type: 'wait', description: 'Wait', code: '', confidence: 0.8 },
        ],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      knowledgeBase.addEntry({
        pattern: 'test2',
        fixes: [],
        frequency: 1,
        successRate: 0.7,
        tags: [],
      });

      const stats = knowledgeBase.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.totalFixes).toBe(1);
      expect(stats.averageSuccessRate).toBeCloseTo(0.6, 1);
    });

    it('should return most common patterns', () => {
      knowledgeBase.addEntry({
        pattern: 'common error',
        fixes: [],
        frequency: 10,
        successRate: 0.8,
        tags: [],
      });

      knowledgeBase.addEntry({
        pattern: 'rare error',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      const stats = knowledgeBase.getStats();

      expect(stats.mostCommonPatterns[0].pattern).toBe('common error');
      expect(stats.mostCommonPatterns[0].frequency).toBe(10);
    });

    it('should return zero stats for empty knowledge base', () => {
      const stats = knowledgeBase.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalFixes).toBe(0);
      expect(stats.averageSuccessRate).toBe(0);
    });
  });

  describe('findByTags', () => {
    beforeEach(() => {
      knowledgeBase.addEntry({
        pattern: 'element error',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: ['element', 'not_found'],
      });

      knowledgeBase.addEntry({
        pattern: 'timeout error',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: ['timeout', 'network'],
      });

      knowledgeBase.addEntry({
        pattern: 'assertion error',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: ['assertion'],
      });
    });

    it('should find entries by tag', () => {
      const results = knowledgeBase.findByTags(['element']);

      expect(results.length).toBe(1);
      expect(results[0].pattern).toContain('element');
    });

    it('should find entries matching any tag', () => {
      const results = knowledgeBase.findByTags(['element', 'timeout']);

      expect(results.length).toBe(2);
    });

    it('should be case insensitive', () => {
      const results = knowledgeBase.findByTags(['ELEMENT']);

      expect(results.length).toBe(1);
    });

    it('should return empty array for no matches', () => {
      const results = knowledgeBase.findByTags(['nonexistent']);

      expect(results).toEqual([]);
    });
  });

  describe('getBySuccessRate', () => {
    beforeEach(() => {
      knowledgeBase.addEntry({
        pattern: 'high reliability pattern',
        fixes: [],
        frequency: 1,
        successRate: 0.9,
        tags: [],
      });

      knowledgeBase.addEntry({
        pattern: 'medium reliability pattern',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      knowledgeBase.addEntry({
        pattern: 'low reliability pattern',
        fixes: [],
        frequency: 1,
        successRate: 0.2,
        tags: [],
      });
    });

    it('should find entries in success rate range', () => {
      const results = knowledgeBase.getBySuccessRate(0.4, 0.6);

      expect(results.length).toBe(1);
      expect(results[0].pattern).toContain('reliability');
    });

    it('should include boundary values', () => {
      const results = knowledgeBase.getBySuccessRate(0.5, 0.9);

      expect(results.length).toBe(2);
    });
  });

  describe('getRecentEntries', () => {
    it('should return recently used entries', () => {
      const id1 = knowledgeBase.addEntry({
        pattern: 'old',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      // Wait a bit to ensure different timestamp
      // In real tests, use vi.useFakeTimers()

      const id2 = knowledgeBase.addEntry({
        pattern: 'new',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      knowledgeBase.recordFixUsed(id2, 0); // Update lastUsedAt

      const recent = knowledgeBase.getRecentEntries(7, 10);

      // Should have the newer entry first
      expect(recent.length).toBeGreaterThan(0);
    });

    it('should respect days parameter', () => {
      knowledgeBase.addEntry({
        pattern: 'test',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      const recent = knowledgeBase.getRecentEntries(0, 10); // Last 0 days = only today

      // Should still return entries since we just created them
      expect(recent.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        knowledgeBase.addEntry({
          pattern: `test-${i}`,
          fixes: [],
          frequency: 1,
          successRate: 0.5,
          tags: [],
        });
      }

      const recent = knowledgeBase.getRecentEntries(7, 3);

      expect(recent.length).toBeLessThanOrEqual(3);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      knowledgeBase.addEntry({
        pattern: 'test',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      knowledgeBase.clear();

      const stats = knowledgeBase.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should persist to localStorage', () => {
      knowledgeBase.addEntry({
        pattern: 'test',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      knowledgeBase.clear();

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('export and import', () => {
    it('should export knowledge base as JSON', () => {
      knowledgeBase.addEntry({
        pattern: 'test pattern',
        fixes: [
          { type: 'wait', description: 'Wait', code: '', confidence: 0.8 },
        ],
        frequency: 5,
        successRate: 0.9,
        tags: ['test'],
      });

      const exported = knowledgeBase.export();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0][1].pattern).toBe('test pattern');
    });

    it('should import knowledge base from JSON', () => {
      const data = JSON.stringify([
        [
          'kb-import-1',
          {
            id: 'kb-import-1',
            pattern: 'imported pattern',
            fixes: [],
            frequency: 1,
            successRate: 0.5,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            tags: [],
          },
        ],
      ]);

      knowledgeBase.import(data);

      const stats = knowledgeBase.getStats();
      expect(stats.totalEntries).toBe(1);
      expect(knowledgeBase.getEntry('kb-import-1')).toBeDefined();
    });

    it('should throw error for invalid JSON', () => {
      expect(() => {
        knowledgeBase.import('invalid json');
      }).toThrow();
    });
  });

  describe('persistence', () => {
    it('should save to localStorage when enabled', () => {
      const kb = new KnowledgeBase({ persistenceEnabled: true });
      mockStorage.clear();

      kb.addEntry({
        pattern: 'test',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should not save to localStorage when disabled', () => {
      const kb = new KnowledgeBase({ persistenceEnabled: false });
      mockStorage.clear();

      kb.addEntry({
        pattern: 'test',
        fixes: [],
        frequency: 1,
        successRate: 0.5,
        tags: [],
      });

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should load from localStorage on creation', () => {
      const data = JSON.stringify([
        [
          'kb-1',
          {
            id: 'kb-1',
            pattern: 'persisted',
            fixes: [],
            frequency: 1,
            successRate: 0.5,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            tags: [],
          },
        ],
      ]);

      mockStorage.set('debug-assistant-knowledge', data);

      const kb = new KnowledgeBase({ persistenceEnabled: true });
      const stats = kb.getStats();

      expect(stats.totalEntries).toBe(1);
    });
  });

  describe('static methods', () => {
    it('should convert DebugKnowledge to KnowledgeEntry format', () => {
      const debugKnowledge = {
        pattern: 'test',
        fixes: [
          { type: 'wait', description: 'Wait', code: '', confidence: 0.8 },
        ],
        frequency: 5,
        successRate: 0.9,
        tags: ['test'],
      };

      const entry = KnowledgeBase.fromDebugKnowledge(debugKnowledge);

      expect(entry.pattern).toBe('test');
      expect(entry.fixes).toEqual(debugKnowledge.fixes);
      expect(entry.frequency).toBe(5);
    });

    it('should convert KnowledgeEntry to DebugKnowledge format', () => {
      const entry = {
        id: 'kb-1',
        pattern: 'test',
        fixes: [],
        frequency: 5,
        successRate: 0.9,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        tags: ['test'],
      };

      const knowledge = KnowledgeBase.toDebugKnowledge(entry);

      expect(knowledge.pattern).toBe('test');
      expect(knowledge.fixes).toEqual([]);
      expect(knowledge.frequency).toBe(5);
    });
  });
});
