/**
 * Version Control Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VersionControl } from '../versionControl';

describe('VersionControl', () => {
  let vc: VersionControl;

  beforeEach(() => {
    vc = new VersionControl();
  });

  afterEach(() => {
    vc.clear();
  });

  describe('createVersion', () => {
    it('should create a new version', async () => {
      const version = await vc.createVersion(
        'file1',
        'Content line 1\nContent line 2',
        'Initial commit',
        'user1',
      );

      expect(version.id).toBeDefined();
      expect(version.fileId).toBe('file1');
      expect(version.content).toBe('Content line 1\nContent line 2');
      expect(version.author).toBe('user1');
      expect(version.message).toBe('Initial commit');
      expect(version.version).toMatch(/^v\d+\.\d+\.\d+$/);
    });

    it('should increment version numbers', async () => {
      const v1 = await vc.createVersion('file1', 'content', 'v1', 'user1');
      const v2 = await vc.createVersion('file1', 'new content', 'v2', 'user1');
      const v3 = await vc.createVersion(
        'file1',
        'newer content',
        'v3',
        'user1',
      );

      expect(v1.version).toBe('v1.0.0');
      expect(v2.version).toBe('v2.0.0');
      expect(v3.version).toBe('v3.0.0');
    });

    it('should link to parent version', async () => {
      const v1 = await vc.createVersion('file1', 'content', 'v1', 'user1');
      const v2 = await vc.createVersion('file1', 'new content', 'v2', 'user1');

      expect(v2.parentVersion).toBe(v1.id);
    });

    it('should maintain separate version sequences per file', async () => {
      const f1 = await vc.createVersion('file1', 'content', 'v1', 'user1');
      const f2 = await vc.createVersion('file2', 'content', 'v1', 'user1');

      expect(f1.version).toBe('v1.0.0');
      expect(f2.version).toBe('v1.0.0');
    });
  });

  describe('getVersion', () => {
    it('should retrieve version by ID', async () => {
      const created = await vc.createVersion(
        'file1',
        'content',
        'message',
        'user1',
      );
      const retrieved = await vc.getVersion(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.content).toBe('content');
    });

    it('should return null for non-existent version', async () => {
      const result = await vc.getVersion('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getLatest', () => {
    it('should get latest version of file', async () => {
      await vc.createVersion('file1', 'v1', 'first', 'user1');
      await vc.createVersion('file1', 'v2', 'second', 'user1');
      const v3 = await vc.createVersion('file1', 'v3', 'third', 'user1');

      const latest = await vc.getLatest('file1');

      expect(latest).toBeDefined();
      expect(latest?.content).toBe('v3');
      expect(latest?.version).toBe('v3.0.0');
    });

    it('should return null for file with no versions', async () => {
      const latest = await vc.getLatest('non-existent');
      expect(latest).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should get version history for file', async () => {
      const v1 = await vc.createVersion('file1', 'content1', 'first', 'user1');
      const v2 = await vc.createVersion('file1', 'content2', 'second', 'user2');
      const v3 = await vc.createVersion('file1', 'content3', 'third', 'user1');

      const history = await vc.getHistory('file1');

      expect(history).toHaveLength(3);
      // History is returned in creation order
      expect(history[0].id).toBe(v1.id);
      expect(history[1].id).toBe(v2.id);
      expect(history[2].id).toBe(v3.id);
    });

    it('should return empty array for file with no history', async () => {
      const history = await vc.getHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('getByVersionString', () => {
    it('should get version by version string', async () => {
      await vc.createVersion('file1', 'v1', 'first', 'user1');
      const v2 = await vc.createVersion('file1', 'v2', 'second', 'user1');

      const version = await vc.getByVersionString('file1', 'v2.0.0');

      expect(version).toBeDefined();
      expect(version?.id).toBe(v2.id);
    });

    it('should return null for non-existent version string', async () => {
      const version = await vc.getByVersionString('file1', 'v99.0.0');
      expect(version).toBeNull();
    });
  });

  describe('deleteVersion', () => {
    it('should delete a version', async () => {
      const v1 = await vc.createVersion('file1', 'content1', 'first', 'user1');
      const v2 = await vc.createVersion('file1', 'content2', 'second', 'user1');

      await vc.deleteVersion(v1.id);

      const version = await vc.getVersion(v1.id);
      expect(version).toBeNull();

      // Latest should still be v2
      const latest = await vc.getLatest('file1');
      expect(latest?.id).toBe(v2.id);
    });

    it('should not delete current version', async () => {
      const v1 = await vc.createVersion('file1', 'content1', 'first', 'user1');
      const v2 = await vc.createVersion('file1', 'content2', 'second', 'user1');

      await expect(vc.deleteVersion(v2.id)).rejects.toThrow(
        'Cannot delete current version',
      );
    });
  });

  describe('getVersionsByAuthor', () => {
    it('should get versions by author', async () => {
      await vc.createVersion('file1', 'content1', 'v1', 'user1');
      await vc.createVersion('file1', 'content2', 'v2', 'user2');
      await vc.createVersion('file2', 'content3', 'v3', 'user1');

      const user1Versions = await vc.getVersionsByAuthor('user1');
      expect(user1Versions).toHaveLength(2);

      const user2Versions = await vc.getVersionsByAuthor('user2');
      expect(user2Versions).toHaveLength(1);
    });
  });

  describe('diff', () => {
    it('should compare two versions', async () => {
      const v1 = await vc.createVersion(
        'file1',
        'line1\nline2\nline3',
        'v1',
        'user1',
      );
      const v2 = await vc.createVersion(
        'file1',
        'line1\nline2-modified\nline3\nline4',
        'v2',
        'user1',
      );

      const diff = await vc.diff(v1.id, v2.id);

      expect(diff).toBeDefined();
      expect(diff.versionA).toBe(v1.id);
      expect(diff.versionB).toBe(v2.id);
      expect(diff.additions).toBeGreaterThan(0);
      expect(diff.deletions).toBeGreaterThan(0);
      expect(diff.hunks.length).toBeGreaterThan(0);
    });

    it('should return empty diff for identical versions', async () => {
      const v1 = await vc.createVersion('file1', 'same content', 'v1', 'user1');
      const v2 = await vc.createVersion('file1', 'same content', 'v2', 'user1');

      const diff = await vc.diff(v1.id, v2.id);

      expect(diff).toBeDefined();
      expect(diff.additions).toBe(0);
      expect(diff.deletions).toBe(0);
    });
  });

  describe('revert', () => {
    it('should revert to previous version', async () => {
      const v1 = await vc.createVersion(
        'file1',
        'original content',
        'v1',
        'user1',
      );
      const v2 = await vc.createVersion(
        'file1',
        'modified content',
        'v2',
        'user1',
      );

      // revert takes fileId and versionId
      await vc.revert('file1', v1.id);

      const latest = await vc.getLatest('file1');
      expect(latest?.content).toBe('original content');
    });

    it('should throw error for non-existent version', async () => {
      // First create a file so we can test revert to non-existent version
      await vc.createVersion('file1', 'content', 'v1', 'user1');

      await expect(vc.revert('file1', 'non-existent-version')).rejects.toThrow(
        'Version not found',
      );
    });
  });

  describe('getVersionStats', () => {
    it('should get version statistics', async () => {
      await vc.createVersion('file1', 'content1', 'v1', 'user1');
      await vc.createVersion('file1', 'content2 longer', 'v2', 'user2');
      await vc.createVersion('file2', 'content3', 'v3', 'user1');

      const stats = await vc.getVersionStats('file1');

      expect(stats.totalVersions).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.authors).toContain('user1');
      expect(stats.authors).toContain('user2');
    });

    it('should return empty stats for file with no versions', async () => {
      const stats = await vc.getVersionStats('non-existent');

      expect(stats.totalVersions).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.authors).toHaveLength(0);
    });
  });
});
