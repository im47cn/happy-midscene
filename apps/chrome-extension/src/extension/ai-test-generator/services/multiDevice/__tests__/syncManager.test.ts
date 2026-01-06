/**
 * SyncManager Unit Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SyncManager, createSyncManager } from '../syncManager';

describe('SyncManager', () => {
  let syncManager: SyncManager;

  beforeEach(() => {
    syncManager = createSyncManager(5000); // 5s default timeout for tests
  });

  afterEach(() => {
    syncManager.reset();
  });

  describe('registerSyncPoint', () => {
    it('should register a sync point', () => {
      syncManager.registerSyncPoint('sync1', ['device1', 'device2']);

      const status = syncManager.getSyncPointStatus('sync1');
      expect(status).toBeDefined();
      expect(status?.id).toBe('sync1');
      expect(status?.expectedDevices.size).toBe(2);
    });

    it('should throw if sync point already exists', () => {
      syncManager.registerSyncPoint('sync1', ['device1']);

      expect(() => {
        syncManager.registerSyncPoint('sync1', ['device2']);
      }).toThrow('Sync point sync1 already exists');
    });
  });

  describe('waitForSync', () => {
    it('should resolve immediately when all devices arrive', async () => {
      syncManager.registerSyncPoint('sync1', ['device1']);

      await syncManager.waitForSync('sync1', 'device1');

      expect(syncManager.isReleased('sync1')).toBe(true);
    });

    it('should wait for all devices to arrive', async () => {
      syncManager.registerSyncPoint('sync1', ['device1', 'device2']);

      const wait1 = syncManager.waitForSync('sync1', 'device1');
      const wait2 = syncManager.waitForSync('sync1', 'device2');

      await Promise.all([wait1, wait2]);

      expect(syncManager.isReleased('sync1')).toBe(true);
    });

    it('should throw for unknown sync point', async () => {
      await expect(
        syncManager.waitForSync('unknown', 'device1'),
      ).rejects.toThrow('Sync point unknown not found');
    });

    it('should throw for unexpected device', async () => {
      syncManager.registerSyncPoint('sync1', ['device1']);

      await expect(syncManager.waitForSync('sync1', 'device2')).rejects.toThrow(
        'Device device2 is not expected',
      );
    });
  });

  describe('getWaitingDevices', () => {
    it('should return devices that have not arrived', async () => {
      syncManager.registerSyncPoint('sync1', ['device1', 'device2', 'device3']);

      // device1 arrives
      const wait1Promise = syncManager.waitForSync('sync1', 'device1');

      expect(syncManager.getWaitingDevices('sync1')).toEqual([
        'device2',
        'device3',
      ]);

      // Complete the sync
      const wait2Promise = syncManager.waitForSync('sync1', 'device2');
      const wait3Promise = syncManager.waitForSync('sync1', 'device3');

      await Promise.all([wait1Promise, wait2Promise, wait3Promise]);
    });

    it('should return empty for unknown sync point', () => {
      expect(syncManager.getWaitingDevices('unknown')).toEqual([]);
    });
  });

  describe('getArrivedDevices', () => {
    it('should return devices that have arrived', async () => {
      syncManager.registerSyncPoint('sync1', ['device1', 'device2']);

      // Start waiting for device1
      const waitPromise = syncManager.waitForSync('sync1', 'device1');

      // device1 should be in arrived list
      expect(syncManager.getArrivedDevices('sync1')).toContain('device1');

      // Complete the sync
      await syncManager.waitForSync('sync1', 'device2');
      await waitPromise;
    });
  });

  describe('forceRelease', () => {
    it('should release sync point immediately', async () => {
      syncManager.registerSyncPoint('sync1', ['device1', 'device2']);

      const waitPromise = syncManager.waitForSync('sync1', 'device1');

      // Force release without device2 arriving
      syncManager.forceRelease('sync1');

      await waitPromise;

      expect(syncManager.isReleased('sync1')).toBe(true);
    });
  });

  describe('events', () => {
    it('should emit device_arrived event', async () => {
      const listener = vi.fn();
      syncManager.addEventListener(listener);

      syncManager.registerSyncPoint('sync1', ['device1']);
      await syncManager.waitForSync('sync1', 'device1');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'device_arrived',
          syncPointId: 'sync1',
          deviceId: 'device1',
        }),
      );
    });

    it('should emit sync_released event', async () => {
      const listener = vi.fn();
      syncManager.addEventListener(listener);

      syncManager.registerSyncPoint('sync1', ['device1']);
      await syncManager.waitForSync('sync1', 'device1');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync_released',
          syncPointId: 'sync1',
        }),
      );
    });

    it('should remove event listener', async () => {
      const listener = vi.fn();
      syncManager.addEventListener(listener);
      syncManager.removeEventListener(listener);

      syncManager.registerSyncPoint('sync1', ['device1']);
      await syncManager.waitForSync('sync1', 'device1');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should clear all sync points', () => {
      syncManager.registerSyncPoint('sync1', ['device1']);
      syncManager.registerSyncPoint('sync2', ['device2']);

      syncManager.reset();

      expect(syncManager.getSyncPointStatus('sync1')).toBeUndefined();
      expect(syncManager.getSyncPointStatus('sync2')).toBeUndefined();
    });
  });

  describe('isReleased', () => {
    it('should return false for unreleased sync point', () => {
      syncManager.registerSyncPoint('sync1', ['device1', 'device2']);

      expect(syncManager.isReleased('sync1')).toBe(false);
    });

    it('should return true for released sync point', async () => {
      syncManager.registerSyncPoint('sync1', ['device1']);
      await syncManager.waitForSync('sync1', 'device1');

      expect(syncManager.isReleased('sync1')).toBe(true);
    });
  });
});
