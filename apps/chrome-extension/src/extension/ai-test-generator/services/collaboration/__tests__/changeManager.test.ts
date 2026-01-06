/**
 * Change Manager Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Change, Review } from '../../types/collaboration';
import { ChangeManager } from '../changeManager';

describe('ChangeManager', () => {
  let cm: ChangeManager;

  beforeEach(() => {
    cm = new ChangeManager();
  });

  describe('collectChanges', () => {
    it('should return empty array (placeholder implementation)', async () => {
      const changes = await cm.collectChanges('file1', 'v1', 'v2');

      expect(changes).toEqual([]);
    });
  });

  describe('generateDiff', () => {
    it('should generate diff for identical content', () => {
      const content = 'line1\nline2\nline3';
      const diff = cm.generateDiff(content, content);

      expect(diff).toContain('--- a/file');
      expect(diff).toContain('+++ b/file');
    });

    it('should generate diff for modified content', () => {
      const contentA = 'line1\nline2\nline3';
      const contentB = 'line1\nline2-modified\nline3';

      const diff = cm.generateDiff(contentA, contentB);

      expect(diff).toContain('-line2');
      expect(diff).toContain('+line2-modified');
    });

    it('should generate diff for added content', () => {
      const contentA = 'line1';
      const contentB = 'line1\nline2\nline3';

      const diff = cm.generateDiff(contentA, contentB);

      expect(diff).toContain('+line2');
      expect(diff).toContain('+line3');
    });

    it('should generate diff for removed content', () => {
      const contentA = 'line1\nline2\nline3';
      const contentB = 'line1';

      const diff = cm.generateDiff(contentA, contentB);

      expect(diff).toContain('-line2');
      expect(diff).toContain('-line3');
    });

    it('should generate diff for completely new content', () => {
      const diff = cm.generateDiff('', 'new content');

      expect(diff).toContain('+new content');
    });

    it('should generate diff for deleted content', () => {
      const diff = cm.generateDiff('deleted content', '');

      expect(diff).toContain('-deleted content');
    });
  });

  describe('applyDiff', () => {
    it('should apply diff to content', () => {
      const content = 'line1\nline2\nline3';
      const diff = `--- a/file
+++ b/file
@@ -1,3 +1,3 @@
 line1
-line2
+line2-modified
 line3`;

      const result = cm.applyDiff(content, diff);

      expect(result).toContain('line2-modified');
      expect(result).not.toContain('line2\n');
    });

    it('should handle empty diff', () => {
      const content = 'line1\nline2\nline3';
      const diff = '';

      const result = cm.applyDiff(content, diff);

      expect(result).toBe(content);
    });

    it('should apply multiple hunks', () => {
      const content = 'line1\nline2\nline3\nline4\nline5';
      const diff = `--- a/file
+++ b/file
@@ -1,5 +1,5 @@
-line1
+line1-modified
 line2
 line3
-line4
+line4-modified
 line5`;

      const result = cm.applyDiff(content, diff);

      expect(result).toContain('line1-modified');
      expect(result).toContain('line4-modified');
    });

    it('should apply additions', () => {
      const content = 'line1\nline3';
      const diff = `--- a/file
+++ b/file
@@ -1,2 +1,3 @@
 line1
+line2
 line3`;

      const result = cm.applyDiff(content, diff);

      expect(result).toContain('line1\nline2\nline3');
    });
  });

  describe('calculateStats', () => {
    it('should calculate stats for empty diff', () => {
      const stats = cm.calculateStats('');

      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBe(0);
    });

    it('should calculate additions', () => {
      const diff = '+line1\n+line2\n+line3';
      const stats = cm.calculateStats(diff);

      expect(stats.additions).toBe(3);
      expect(stats.deletions).toBe(0);
    });

    it('should calculate deletions', () => {
      const diff = '-line1\n-line2\n-line3';
      const stats = cm.calculateStats(diff);

      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBe(3);
    });

    it('should calculate mixed changes', () => {
      const diff = '-line1\n+line2\n line3\n-line4\n+line5';
      const stats = cm.calculateStats(diff);

      expect(stats.additions).toBe(2);
      expect(stats.deletions).toBe(2);
    });

    it('should not count diff headers', () => {
      const diff = `--- a/file
+++ b/file
@@ -1,1 +1,1 @@
-old
+new`;

      const stats = cm.calculateStats(diff);

      expect(stats.additions).toBe(1);
      expect(stats.deletions).toBe(1);
    });
  });

  describe('createChange', () => {
    it('should create modified change', () => {
      const change = cm.createChange(
        'file1',
        'test.ts',
        'old content',
        'new content',
      );

      expect(change.fileId).toBe('file1');
      expect(change.fileName).toBe('test.ts');
      expect(change.changeType).toBe('modified');
      expect(change.diff).toBeDefined();
    });

    it('should create added change', () => {
      const change = cm.createChange('file1', 'test.ts', '', 'new content');

      expect(change.changeType).toBe('added');
    });

    it('should create deleted change', () => {
      const change = cm.createChange('file1', 'test.ts', 'old content', '');

      expect(change.changeType).toBe('deleted');
    });
  });

  describe('compareFiles', () => {
    it('should compare two file contents', () => {
      const change = cm.compareFiles('file1', 'test.ts', 'old', 'new');

      expect(change.fileId).toBe('file1');
      expect(change.fileName).toBe('test.ts');
      expect(change.diff).toBeDefined();
    });
  });

  describe('getChangedFiles', () => {
    it('should return file IDs from review', async () => {
      const review: Review = {
        id: 'review1',
        workspaceId: 'ws1',
        title: 'Test Review',
        description: 'Test',
        createdBy: 'user1',
        createdAt: Date.now(),
        status: 'pending',
        changes: [
          {
            fileId: 'file1',
            fileName: 'test1.ts',
            changeType: 'modified',
            diff: '',
          },
          {
            fileId: 'file2',
            fileName: 'test2.ts',
            changeType: 'added',
            diff: '',
          },
        ],
        reviewers: [],
      };

      const fileIds = await cm.getChangedFiles(review);

      expect(fileIds).toEqual(['file1', 'file2']);
    });

    it('should return empty array for review with no changes', async () => {
      const review: Review = {
        id: 'review1',
        workspaceId: 'ws1',
        title: 'Test Review',
        description: 'Test',
        createdBy: 'user1',
        createdAt: Date.now(),
        status: 'pending',
        changes: [],
        reviewers: [],
      };

      const fileIds = await cm.getChangedFiles(review);

      expect(fileIds).toEqual([]);
    });
  });

  describe('hasChanges', () => {
    it('should return true for diff with additions', () => {
      const diff = '+line1\n+line2';

      expect(cm.hasChanges(diff)).toBe(true);
    });

    it('should return true for diff with deletions', () => {
      const diff = '-line1\n-line2';

      expect(cm.hasChanges(diff)).toBe(true);
    });

    it('should return false for empty diff', () => {
      expect(cm.hasChanges('')).toBe(false);
    });

    it('should return false for diff with only context', () => {
      const diff = ' line1\n line2\n line3';

      expect(cm.hasChanges(diff)).toBe(false);
    });
  });

  describe('getChangeSummary', () => {
    it('should calculate summary of changes', () => {
      const changes: Change[] = [
        {
          fileId: 'file1',
          fileName: 'test1.ts',
          changeType: 'added',
          diff: '+line1\n+line2\n+line3',
        },
        {
          fileId: 'file2',
          fileName: 'test2.ts',
          changeType: 'modified',
          diff: '-old\n+new',
        },
        {
          fileId: 'file3',
          fileName: 'test3.ts',
          changeType: 'deleted',
          diff: '-line1\n-line2',
        },
      ];

      const summary = cm.getChangeSummary(changes);

      expect(summary.totalFiles).toBe(3);
      expect(summary.additions).toBe(4); // 3 + 1
      expect(summary.deletions).toBe(3); // 1 + 2
      expect(summary.fileCountByType.added).toBe(1);
      expect(summary.fileCountByType.modified).toBe(1);
      expect(summary.fileCountByType.deleted).toBe(1);
    });

    it('should handle empty changes array', () => {
      const summary = cm.getChangeSummary([]);

      expect(summary.totalFiles).toBe(0);
      expect(summary.additions).toBe(0);
      expect(summary.deletions).toBe(0);
      expect(summary.fileCountByType.added).toBe(0);
      expect(summary.fileCountByType.modified).toBe(0);
      expect(summary.fileCountByType.deleted).toBe(0);
    });
  });

  describe('round-trip diff apply', () => {
    it('should generate and apply diff consistently', () => {
      const original = 'line1\nline2\nline3';
      const modified = 'line1\nline2-modified\nline3\nline4';

      const diff = cm.generateDiff(original, modified);
      const result = cm.applyDiff(original, diff);

      expect(result).toBe(modified);
    });

    it('should handle complex multi-hunk changes', () => {
      const original = 'header\nsection1\nsection2\nsection3\nfooter';
      const modified =
        'header\nsection1-modified\nsection2\nsection3-modified\nfooter\nnew-section';

      const diff = cm.generateDiff(original, modified);
      const result = cm.applyDiff(original, diff);

      expect(result).toBe(modified);
    });
  });
});
