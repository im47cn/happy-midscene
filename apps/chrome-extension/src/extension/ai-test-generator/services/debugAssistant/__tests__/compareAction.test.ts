/**
 * Unit tests for Compare Action
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CompareAction,
  getCompareAction,
  resetCompareAction,
} from '../compareAction';
import type { SnapshotInfo } from '../compareAction';

// Mock agent
const mockPage = {
  screenshot: vi.fn(),
  evaluate: vi.fn(),
  url: vi.fn(),
  title: vi.fn(),
};

const mockAgent = {
  page: mockPage,
};

describe('CompareAction', () => {
  let compareAction: CompareAction;

  beforeEach(() => {
    vi.clearAllMocks();
    resetCompareAction();
    compareAction = getCompareAction({
      getAgent: () => mockAgent,
    });
  });

  describe('takeSnapshot', () => {
    it('should take a snapshot of current page', async () => {
      mockPage.screenshot.mockResolvedValue('base64screenshot');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Example Page');

      const snapshot = await compareAction.takeSnapshot();

      expect(snapshot.id).toBeTruthy();
      expect(snapshot.id).toContain('snapshot-');
      expect(snapshot.screenshot).toBe('base64screenshot');
      expect(snapshot.url).toBe('https://example.com');
      expect(snapshot.title).toBe('Example Page');
      expect(snapshot.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should create snapshot with custom label', async () => {
      mockPage.screenshot.mockResolvedValue('screenshotdata');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');

      await compareAction.takeSnapshot('before-action');

      const retrieved = compareAction.getSnapshot('before-action');
      expect(retrieved).toBeDefined();
      expect(retrieved?.screenshot).toBe('screenshotdata');
    });
  });

  describe('getSnapshot', () => {
    it('should retrieve snapshot by ID', async () => {
      mockPage.screenshot.mockResolvedValue('data');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');

      const snapshot = await compareAction.takeSnapshot();
      const retrieved = compareAction.getSnapshot(snapshot.id);

      expect(retrieved).toEqual(snapshot);
    });

    it('should return undefined for non-existent snapshot', () => {
      const retrieved = compareAction.getSnapshot('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('should retrieve snapshot by label', async () => {
      mockPage.screenshot.mockResolvedValue('data');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');

      await compareAction.takeSnapshot('my-label');
      const retrieved = compareAction.getSnapshot('my-label');

      expect(retrieved).toBeDefined();
      expect(retrieved?.screenshot).toBe('data');
    });
  });

  describe('compareScreenshots', () => {
    it('should compare two identical screenshots', async () => {
      // Mock identical images
      mockPage.evaluate.mockResolvedValue({
        score: 1.0,
        totalPixels: 1000,
        differentPixels: 0,
        differencePercentage: 0,
        diffImage: '',
      });

      const result = await compareAction.compareScreenshots(
        'sameimg',
        'sameimg',
      );

      expect(result.similar).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.details?.differentPixels).toBe(0);
    });

    it('should compare two different screenshots', async () => {
      mockPage.evaluate.mockResolvedValue({
        score: 0.85,
        totalPixels: 1000,
        differentPixels: 150,
        differencePercentage: 15,
        diffImage: 'base64diff',
      });

      const result = await compareAction.compareScreenshots('before', 'after', {
        threshold: 0.9,
      });

      expect(result.similar).toBe(false);
      expect(result.score).toBe(0.85);
      expect(result.details?.differencePercentage).toBe(15);
    });

    it('should generate diff image when requested', async () => {
      mockPage.evaluate.mockResolvedValue({
        score: 0.9,
        totalPixels: 1000,
        differentPixels: 100,
        differencePercentage: 10,
        diffImage: 'base64diffimage',
      });

      const result = await compareAction.compareScreenshots('before', 'after', {
        createDiffImage: true,
      });

      expect(result.diff).toBe('base64diffimage');
    });

    it('should use custom threshold', async () => {
      mockPage.evaluate.mockResolvedValue({
        score: 0.92,
        totalPixels: 1000,
        differentPixels: 80,
        differencePercentage: 8,
        diffImage: '',
      });

      const result = await compareAction.compareScreenshots('before', 'after', {
        threshold: 0.95,
      });

      expect(result.similar).toBe(false);
    });

    it('should handle comparison errors', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Comparison failed'));

      const result = await compareAction.compareScreenshots('before', 'after');

      expect(result.similar).toBe(false);
      expect(result.score).toBe(0);
      expect(result.message).toContain('对比失败');
    });
  });

  describe('compareWithSnapshot', () => {
    it('should compare current page with stored snapshot', async () => {
      // Create a snapshot first
      mockPage.screenshot.mockResolvedValue('beforeimg');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');
      const snapshot = await compareAction.takeSnapshot();

      // Then compare
      mockPage.screenshot.mockResolvedValue('afterimg');
      mockPage.evaluate.mockResolvedValue({
        score: 0.98,
        totalPixels: 1000,
        differentPixels: 20,
        differencePercentage: 2,
        diffImage: '',
      });

      const result = await compareAction.compareWithSnapshot(snapshot.id);

      expect(result.similar).toBe(true);
      expect(result.score).toBe(0.98);
    });

    it('should return error for non-existent snapshot', async () => {
      const result = await compareAction.compareWithSnapshot('nonexistent');

      expect(result.similar).toBe(false);
      expect(result.message).toContain('快照不存在');
    });
  });

  describe('compare', () => {
    it('should get current screenshot without previous', async () => {
      mockPage.screenshot.mockResolvedValue('currentscreenshot');

      const result = await compareAction.compare();

      expect(result.success).toBe(true);
      expect(result.screenshot).toBe('currentscreenshot');
      expect(result.data?.current).toBe('currentscreenshot');
    });

    it('should compare with previous screenshot', async () => {
      mockPage.screenshot.mockResolvedValueOnce('previousscreenshot');
      mockPage.evaluate.mockResolvedValue({
        score: 0.95,
        totalPixels: 1000,
        differentPixels: 50,
        differencePercentage: 5,
        diffImage: 'diffimg',
      });

      const result = await compareAction.compare({
        previousScreenshot: 'previousscreenshot',
      });

      expect(result.success).toBe(true);
      expect(result.data?.previous).toBe('previousscreenshot');
      expect(result.data?.current).toBeTruthy();
    });

    it('should compare with snapshot ID', async () => {
      // Store a snapshot
      mockPage.screenshot.mockResolvedValueOnce('storedsnapshot');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');
      const snapshot = await compareAction.takeSnapshot();

      // Compare with it
      mockPage.screenshot.mockResolvedValueOnce('current');
      mockPage.evaluate.mockResolvedValue({
        score: 1.0,
        totalPixels: 1000,
        differentPixels: 0,
        differencePercentage: 0,
        diffImage: '',
      });

      const result = await compareAction.compare({ snapshotId: snapshot.id });

      expect(result.success).toBe(true);
    });
  });

  describe('snapshot management', () => {
    it('should create before snapshot', async () => {
      mockPage.screenshot.mockResolvedValue('data');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');

      const id = await compareAction.createBeforeSnapshot('test-label');

      expect(id).toContain('snapshot-');
      const snapshot = compareAction.getSnapshot(id);
      expect(snapshot).toBeDefined();
    });

    it('should create after snapshot and compare', async () => {
      // Before snapshot
      mockPage.screenshot.mockResolvedValue('before');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');
      const beforeId = await compareAction.createBeforeSnapshot();

      // After snapshot and compare
      mockPage.screenshot.mockResolvedValue('after');
      mockPage.evaluate.mockResolvedValue({
        score: 0.9,
        totalPixels: 1000,
        differentPixels: 100,
        differencePercentage: 10,
        diffImage: '',
      });

      const result = await compareAction.createAfterSnapshot(beforeId);

      expect(result.score).toBe(0.9);
    });

    it('should delete snapshot', async () => {
      mockPage.screenshot.mockResolvedValue('data');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');
      const snapshot = await compareAction.takeSnapshot();

      const deleted = compareAction.deleteSnapshot(snapshot.id);

      expect(deleted).toBe(true);
      expect(compareAction.getSnapshot(snapshot.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent snapshot', () => {
      const deleted = compareAction.deleteSnapshot('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should clear all snapshots', async () => {
      mockPage.screenshot.mockResolvedValue('data');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');

      await compareAction.takeSnapshot('snap1');
      await compareAction.takeSnapshot('snap2');
      await compareAction.takeSnapshot('snap3');

      expect(compareAction.getSnapshotCount()).toBe(3);

      compareAction.clearSnapshots();

      expect(compareAction.getSnapshotCount()).toBe(0);
    });

    it('should get all snapshot IDs', async () => {
      mockPage.screenshot.mockResolvedValue('data');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');

      const snap1 = await compareAction.takeSnapshot();
      const snap2 = await compareAction.takeSnapshot();

      const ids = compareAction.getSnapshotIds();

      expect(ids).toContain(snap1.id);
      expect(ids).toContain(snap2.id);
    });

    it('should get snapshot count', async () => {
      mockPage.screenshot.mockResolvedValue('data');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test');

      expect(compareAction.getSnapshotCount()).toBe(0);

      await compareAction.takeSnapshot();
      await compareAction.takeSnapshot();

      expect(compareAction.getSnapshotCount()).toBe(2);
    });
  });

  describe('compareElement', () => {
    it('should compare element position', async () => {
      // First create a snapshot with element position data
      mockPage.screenshot.mockResolvedValue('screenshot-data');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test Page');
      const snapshot = await compareAction.takeSnapshot('snapshot-id');

      mockPage.evaluate.mockResolvedValue({
        currentRect: {
          left: 100,
          top: 200,
          width: 50,
          height: 30,
        },
      });

      const result = await compareAction.compareElement('.button', snapshot.id);

      expect(result.similar).toBe(true);
      expect(result.message).toContain('(100, 200)');
      expect(result.message).toContain('50x30');
    });

    it('should handle element not found', async () => {
      // First create a snapshot
      mockPage.screenshot.mockResolvedValue('screenshot-data');
      mockPage.url.mockReturnValue('https://example.com');
      mockPage.title.mockResolvedValue('Test Page');
      const snapshot = await compareAction.takeSnapshot('snapshot-id');

      mockPage.evaluate.mockResolvedValue({
        error: '元素不存在',
      });

      const result = await compareAction.compareElement(
        '.nonexistent',
        snapshot.id,
      );

      expect(result.similar).toBe(false);
      expect(result.message).toContain('元素不存在');
    });

    it('should handle non-existent snapshot for element compare', async () => {
      const result = await compareAction.compareElement(
        '.button',
        'nonexistent',
      );

      expect(result.similar).toBe(false);
      expect(result.message).toContain('快照不存在');
    });
  });

  describe('error handling', () => {
    it('should throw error when agent unavailable', () => {
      const badCompare = new CompareAction({
        getAgent: () => null,
      });

      expect(() => badCompare['getPage']()).toThrow('无法获取');
    });

    it('should throw error when page unavailable', () => {
      const badCompare = new CompareAction({
        getAgent: () => ({}),
      });

      expect(() => badCompare['getPage']()).toThrow('无法获取页面实例');
    });
  });
});
