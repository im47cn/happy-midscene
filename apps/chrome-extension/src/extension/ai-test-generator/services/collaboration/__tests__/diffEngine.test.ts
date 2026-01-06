/**
 * Diff Engine Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { DiffEngine } from '../diffEngine';

describe('DiffEngine', () => {
  let engine: DiffEngine;

  beforeEach(() => {
    engine = new DiffEngine();
  });

  describe('computeDiff', () => {
    it('should generate empty diff for identical strings', () => {
      const result = engine.computeDiff('same content', 'same content');

      expect(result).toHaveLength(0);
    });

    it('should detect simple addition', () => {
      const result = engine.computeDiff('line1', 'line1\nline2');

      expect(result).toHaveLength(1);
      expect(result[0].lines.some((l) => l.type === 'addition')).toBe(true);
    });

    it('should detect simple deletion', () => {
      const result = engine.computeDiff('line1\nline2', 'line1');

      expect(result).toHaveLength(1);
      expect(result[0].lines.some((l) => l.type === 'deletion')).toBe(true);
    });

    it('should detect mixed additions and deletions', () => {
      const result = engine.computeDiff(
        'line1\nline2\nline3',
        'line1\nline2-modified\nline3\nline4',
      );

      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle multi-line content', () => {
      const result = engine.computeDiff(
        'function old() {\n  return 1;\n}',
        'function new() {\n  return 2;\n  return 3;\n}',
      );

      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty strings', () => {
      const result = engine.computeDiff('', 'new content');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle complete replacement', () => {
      const result = engine.computeDiff('old content', 'new content');

      expect(result).toHaveLength(1);
    });
  });

  describe('toUnifiedDiff', () => {
    it('should generate unified diff format', () => {
      const result = engine.toUnifiedDiff(
        'line1\nline2',
        'line1\nline2-modified',
        'test.txt',
      );

      expect(result).toContain('--- a/test.txt');
      expect(result).toContain('+++ b/test.txt');
      expect(result).toContain('@@');
    });

    it('should include context lines', () => {
      const result = engine.toUnifiedDiff(
        'line1\nline2\nline3\nline4\nline5',
        'line1\nline2-modified\nline3\nline4\nline5',
        'test.txt',
      );

      expect(result).toContain('line1'); // Context
      expect(result).toContain('line3'); // Context
    });
  });

  describe('applyPatch', () => {
    it('should apply simple addition patch', () => {
      const patch = engine.toUnifiedDiff('line1', 'line1\nline2', 'test.txt');
      const result = engine.applyPatch('line1', patch);

      expect(result).toContain('line2');
    });

    it('should apply simple deletion patch', () => {
      const patch = engine.toUnifiedDiff('line1\nline2', 'line1', 'test.txt');
      const result = engine.applyPatch('line1\nline2', patch);

      expect(result).not.toContain('line2');
    });

    it('should handle patch with no changes', () => {
      const patch = engine.toUnifiedDiff('same', 'same', 'test.txt');
      const result = engine.applyPatch('same', patch);

      expect(result).toBe('same');
    });
  });

  describe('threeWayMerge', () => {
    it('should merge non-conflicting changes', async () => {
      const result = await engine.threeWayMerge(
        'line1\nline2\nline3',
        'line1\nline2-modified\nline3',
        'line1\nline2\nline3-modified',
      );

      expect(result).not.toBeNull();
      expect(result).toContain('line2-modified');
      expect(result).toContain('line3-modified');
    });

    it('should return null for conflicting changes', async () => {
      const result = await engine.threeWayMerge(
        'line1\nline2\nline3',
        'line1\nline2-version-a\nline3',
        'line1\nline2-version-b\nline3',
      );

      expect(result).toBeNull();
    });

    it('should merge when one side makes no changes', async () => {
      const result = await engine.threeWayMerge(
        'line1\nline2',
        'line1\nline2',
        'line1\nline2\nline3',
      );

      expect(result).not.toBeNull();
      expect(result).toContain('line3');
    });
  });

  describe('hasMergeConflicts', () => {
    it('should detect overlapping changes', () => {
      const hunksA = engine.computeDiff(
        'line1\nline2\nline3',
        'line1\nline2-a\nline3',
      );
      const hunksB = engine.computeDiff(
        'line1\nline2\nline3',
        'line1\nline2-b\nline3',
      );

      expect(engine.hasMergeConflicts(hunksA, hunksB)).toBe(true);
    });

    it('should not conflict for non-overlapping changes', () => {
      const hunksA = engine.computeDiff(
        'line1\nline2\nline3',
        'line1-a\nline2\nline3',
      );
      const hunksB = engine.computeDiff(
        'line1\nline2\nline3',
        'line1\nline2\nline3-b',
      );

      expect(engine.hasMergeConflicts(hunksA, hunksB)).toBe(false);
    });
  });

  describe('charDiff', () => {
    it('should return added and removed characters', () => {
      const result = engine.charDiff('hello', 'halp');

      expect(result.removed).toContain('e');
      expect(result.removed).toContain('l');
      expect(result.removed).toContain('o');
      expect(result.added).toContain('a');
      expect(result.added).toContain('p');
    });

    it('should return empty for identical strings', () => {
      const result = engine.charDiff('same', 'same');

      expect(result.added).toBe('');
      expect(result.removed).toBe('');
    });
  });

  describe('getSimilarity', () => {
    it('should return 1 for identical strings', () => {
      const ratio = engine.getSimilarity('same content', 'same content');
      expect(ratio).toBe(1);
    });

    it('should return less than 1 for partially different strings', () => {
      const ratio = engine.getSimilarity(
        'line1\nline2\nline3',
        'line1\nline2-modified\nline3',
      );
      expect(ratio).toBeLessThan(1);
      expect(ratio).toBeGreaterThan(0);
    });

    it('should return 0 for completely different strings', () => {
      const ratio = engine.getSimilarity('', 'content');
      expect(ratio).toBe(0);
    });
  });
});
