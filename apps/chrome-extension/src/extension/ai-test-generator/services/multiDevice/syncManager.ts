/**
 * Sync Manager
 * Manages synchronization points across multiple device sessions
 */

import type { EventEmitter } from 'events';

/**
 * Sync point state
 */
export interface SyncPointState {
  id: string;
  expectedDevices: Set<string>;
  arrivedDevices: Set<string>;
  timeout: number;
  createdAt: number;
  releasedAt?: number;
}

/**
 * Sync event types
 */
export type SyncEventType = 'device_arrived' | 'sync_released' | 'sync_timeout';

/**
 * Sync event
 */
export interface SyncEvent {
  type: SyncEventType;
  syncPointId: string;
  deviceId?: string;
  timestamp: number;
}

/**
 * Sync event listener
 */
export type SyncEventListener = (event: SyncEvent) => void;

/**
 * Sync Manager for coordinating device synchronization
 */
export class SyncManager {
  private syncPoints: Map<string, SyncPointState> = new Map();
  private waitPromises: Map<string, Map<string, Promise<void>>> = new Map();
  private waitResolvers: Map<string, Map<string, () => void>> = new Map();
  private waitRejectors: Map<string, Map<string, (error: Error) => void>> =
    new Map();
  private listeners: Set<SyncEventListener> = new Set();
  private defaultTimeout: number;

  constructor(defaultTimeout = 60000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Register a sync point
   */
  registerSyncPoint(
    syncPointId: string,
    expectedDevices: string[],
    timeout?: number,
  ): void {
    if (this.syncPoints.has(syncPointId)) {
      throw new Error(`Sync point ${syncPointId} already exists`);
    }

    this.syncPoints.set(syncPointId, {
      id: syncPointId,
      expectedDevices: new Set(expectedDevices),
      arrivedDevices: new Set(),
      timeout: timeout ?? this.defaultTimeout,
      createdAt: Date.now(),
    });

    this.waitPromises.set(syncPointId, new Map());
    this.waitResolvers.set(syncPointId, new Map());
    this.waitRejectors.set(syncPointId, new Map());
  }

  /**
   * Wait for a sync point
   * Returns when all expected devices have arrived
   */
  async waitForSync(syncPointId: string, deviceId: string): Promise<void> {
    const syncPoint = this.syncPoints.get(syncPointId);

    if (!syncPoint) {
      throw new Error(`Sync point ${syncPointId} not found`);
    }

    if (!syncPoint.expectedDevices.has(deviceId)) {
      throw new Error(
        `Device ${deviceId} is not expected at sync point ${syncPointId}`,
      );
    }

    // Check if already released
    if (syncPoint.releasedAt) {
      return;
    }

    // Create wait promise if not exists
    let waitPromises = this.waitPromises.get(syncPointId);
    if (!waitPromises) {
      waitPromises = new Map();
      this.waitPromises.set(syncPointId, waitPromises);
    }

    if (!waitPromises.has(deviceId)) {
      const promise = new Promise<void>((resolve, reject) => {
        this.waitResolvers.get(syncPointId)!.set(deviceId, resolve);
        this.waitRejectors.get(syncPointId)!.set(deviceId, reject);
      });
      waitPromises.set(deviceId, promise);
    }

    // Mark device as arrived
    syncPoint.arrivedDevices.add(deviceId);
    this.emit({
      type: 'device_arrived',
      syncPointId,
      deviceId,
      timestamp: Date.now(),
    });

    // Check if all devices have arrived
    if (this.allDevicesArrived(syncPoint)) {
      this.releaseSyncPoint(syncPointId);
      return;
    }

    // Set up timeout
    const timeoutId = setTimeout(() => {
      const rejector = this.waitRejectors.get(syncPointId)?.get(deviceId);
      if (rejector) {
        rejector(
          new Error(
            `Sync point ${syncPointId} timeout after ${syncPoint.timeout}ms`,
          ),
        );
      }
      this.emit({
        type: 'sync_timeout',
        syncPointId,
        deviceId,
        timestamp: Date.now(),
      });
    }, syncPoint.timeout);

    try {
      await waitPromises.get(deviceId);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if all expected devices have arrived
   */
  private allDevicesArrived(syncPoint: SyncPointState): boolean {
    if (syncPoint.arrivedDevices.size !== syncPoint.expectedDevices.size) {
      return false;
    }

    for (const device of syncPoint.expectedDevices) {
      if (!syncPoint.arrivedDevices.has(device)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Release a sync point
   */
  private releaseSyncPoint(syncPointId: string): void {
    const syncPoint = this.syncPoints.get(syncPointId);
    if (!syncPoint || syncPoint.releasedAt) {
      return;
    }

    syncPoint.releasedAt = Date.now();

    // Resolve all waiting promises
    const resolvers = this.waitResolvers.get(syncPointId);
    if (resolvers) {
      for (const resolve of resolvers.values()) {
        resolve();
      }
    }

    this.emit({
      type: 'sync_released',
      syncPointId,
      timestamp: Date.now(),
    });
  }

  /**
   * Force release a sync point (for cancellation)
   */
  forceRelease(syncPointId: string): void {
    this.releaseSyncPoint(syncPointId);
  }

  /**
   * Get sync point status
   */
  getSyncPointStatus(syncPointId: string): SyncPointState | undefined {
    return this.syncPoints.get(syncPointId);
  }

  /**
   * Get waiting devices for a sync point
   */
  getWaitingDevices(syncPointId: string): string[] {
    const syncPoint = this.syncPoints.get(syncPointId);
    if (!syncPoint) {
      return [];
    }

    const waiting: string[] = [];
    for (const device of syncPoint.expectedDevices) {
      if (!syncPoint.arrivedDevices.has(device)) {
        waiting.push(device);
      }
    }
    return waiting;
  }

  /**
   * Get arrived devices for a sync point
   */
  getArrivedDevices(syncPointId: string): string[] {
    const syncPoint = this.syncPoints.get(syncPointId);
    if (!syncPoint) {
      return [];
    }
    return Array.from(syncPoint.arrivedDevices);
  }

  /**
   * Check if sync point is released
   */
  isReleased(syncPointId: string): boolean {
    const syncPoint = this.syncPoints.get(syncPointId);
    return syncPoint?.releasedAt !== undefined;
  }

  /**
   * Reset sync manager
   */
  reset(): void {
    // Cancel all pending waits
    for (const [syncPointId, rejectors] of this.waitRejectors) {
      for (const rejector of rejectors.values()) {
        rejector(new Error('Sync manager reset'));
      }
    }

    this.syncPoints.clear();
    this.waitPromises.clear();
    this.waitResolvers.clear();
    this.waitRejectors.clear();
  }

  /**
   * Add event listener
   */
  addEventListener(listener: SyncEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: SyncEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit event
   */
  private emit(event: SyncEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('Sync event listener error:', error);
      }
    }
  }
}

/**
 * Create sync manager instance
 */
export function createSyncManager(defaultTimeout?: number): SyncManager {
  return new SyncManager(defaultTimeout);
}
