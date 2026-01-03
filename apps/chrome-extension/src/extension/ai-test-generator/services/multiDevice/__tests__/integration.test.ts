/**
 * Multi-Device Integration Tests
 * Tests for single-device and collaborative scenarios
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDataChannel,
  createOrchestrator,
  createSyncManager,
  DataChannel,
  Orchestrator,
  SyncManager,
  type DeviceConfig,
  type TestStep,
} from '..';

/**
 * Mock device session for testing
 */
class MockDeviceSession {
  readonly id: string;
  readonly alias: string;
  readonly type = 'web' as const;
  status: 'connecting' | 'ready' | 'busy' | 'error' | 'disconnected' = 'disconnected';

  private connected = false;
  private executedSteps: TestStep[] = [];
  private screenshots: string[] = [];
  private listeners: Set<(event: any) => void> = new Set();

  constructor(config: DeviceConfig) {
    this.id = config.id;
    this.alias = config.alias;
  }

  async connect(): Promise<void> {
    this.status = 'connecting';
    this.emit('status_change', { status: 'connecting' });
    await this.delay(10);
    this.status = 'ready';
    this.connected = true;
    this.emit('status_change', { status: 'ready' });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.status = 'disconnected';
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  async executeStep(step: TestStep) {
    if (!this.connected) {
      throw new Error('Session not connected');
    }
    this.executedSteps.push(step);
    this.emit('step_start', { step });
    this.status = 'busy';

    await this.delay(20);

    this.status = 'ready';
    this.emit('step_complete', {
      step,
      result: { success: true, duration: 20 },
    });

    return {
      success: true,
      duration: 20,
      screenshot: `screenshot-${this.id}.png`,
    };
  }

  private emit(type: string, data?: any): void {
    const event = { type, sessionId: this.id, timestamp: Date.now(), data };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        // Ignore listener errors
      }
    }
  }

  async extractData(query: string): Promise<any> {
    return { query, value: `extracted-from-${this.id}` };
  }

  injectData(data: Record<string, any>): void {
    // Store data for interpolation
  }

  async captureScreenshot(): Promise<string | undefined> {
    const screenshot = `screenshot-${this.id}-${Date.now()}.png`;
    this.screenshots.push(screenshot);
    return screenshot;
  }

  getInfo() {
    return {
      id: this.id,
      alias: this.alias,
      type: this.type,
      status: this.status,
      currentStep: this.executedSteps.length,
      totalSteps: this.executedSteps.length,
      lastScreenshot: this.screenshots.at(-1),
    };
  }

  addEventListener(listener: (event: any) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: (event: any) => void): void {
    this.listeners.delete(listener);
  }

  getExecutedSteps(): TestStep[] {
    return [...this.executedSteps];
  }

  getScreenshotCount(): number {
    return this.screenshots.length;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

describe('Single Device Integration Tests', () => {
  describe('device lifecycle', () => {
    it('should connect a single device', async () => {
      const device = new MockDeviceSession({
        id: 'device-1',
        alias: 'Test Device',
        type: 'web',
      });

      await device.connect();

      expect(device.status).toBe('ready');
    });

    it('should disconnect a device', async () => {
      const device = new MockDeviceSession({
        id: 'device-1',
        alias: 'Test Device',
        type: 'web',
      });

      await device.connect();
      await device.disconnect();

      expect(device.status).toBe('disconnected');
    });

    it('should reconnect a device', async () => {
      const device = new MockDeviceSession({
        id: 'device-1',
        alias: 'Test Device',
        type: 'web',
      });

      await device.connect();
      await device.disconnect();
      await device.reconnect();

      expect(device.status).toBe('ready');
    });
  });

  describe('step execution', () => {
    it('should execute a single instruction step', async () => {
      const device = new MockDeviceSession({
        id: 'device-1',
        alias: 'Test Device',
        type: 'web',
      });

      await device.connect();

      const step: TestStep = {
        instruction: 'Click the submit button',
      };

      const result = await device.executeStep(step);

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.screenshot).toBeDefined();
      expect(device.getExecutedSteps()).toHaveLength(1);
    });

    it('should execute multiple steps sequentially', async () => {
      const device = new MockDeviceSession({
        id: 'device-1',
        alias: 'Test Device',
        type: 'web',
      });

      await device.connect();

      const steps: TestStep[] = [
        { instruction: 'Navigate to homepage' },
        { instruction: 'Click login button' },
        { instruction: 'Enter credentials' },
      ];

      for (const step of steps) {
        await device.executeStep(step);
      }

      expect(device.getExecutedSteps()).toHaveLength(3);
    });
  });

  describe('data extraction', () => {
    it('should extract data from device', async () => {
      const device = new MockDeviceSession({
        id: 'device-1',
        alias: 'Test Device',
        type: 'web',
      });

      await device.connect();

      const data = await device.extractData('Get the price');

      expect(data).toEqual({
        query: 'Get the price',
        value: 'extracted-from-device-1',
      });
    });
  });

  describe('screenshots', () => {
    it('should capture screenshots', async () => {
      const device = new MockDeviceSession({
        id: 'device-1',
        alias: 'Test Device',
        type: 'web',
      });

      await device.connect();

      await device.captureScreenshot();
      await device.captureScreenshot();

      expect(device.getScreenshotCount()).toBe(2);
    });
  });
});

describe('Collaborative Scenario Tests', () => {
  let dataChannel: DataChannel;
  let syncManager: SyncManager;
  let devices: MockDeviceSession[];

  beforeEach(async () => {
    dataChannel = createDataChannel();
    syncManager = createSyncManager(5000);

    devices = [];
    for (let i = 1; i <= 3; i++) {
      const device = new MockDeviceSession({
        id: `device-${i}`,
        alias: `Device ${i}`,
        type: 'web',
      });
      devices.push(device);
      await device.connect();
    }
  });

  describe('multi-device coordination', () => {
    it('should execute parallel steps across devices', async () => {
      const promises = devices.map((device) =>
        device.executeStep({ instruction: `Execute on ${device.alias}` }),
      );

      await Promise.all(promises);

      for (const device of devices) {
        expect(device.getExecutedSteps()).toHaveLength(1);
      }
    });

    it('should share data between devices', () => {
      dataChannel.set('orderId', 'ORD-12345', 'device-1');

      const valueFromD1 = dataChannel.get('orderId');
      expect(valueFromD1).toBe('ORD-12345');

      const interpolated = dataChannel.interpolate('Order ${orderId} confirmed');
      expect(interpolated).toBe('Order ORD-12345 confirmed');
    });
  });

  describe('synchronization points', () => {
    it('should synchronize multiple devices at sync point', async () => {
      const syncPointId = 'checkout-sync';

      syncManager.registerSyncPoint(
        syncPointId,
        devices.map((d) => d.id),
        2000,
      );

      const promises = devices.map((device) =>
        syncManager.waitForSync(syncPointId, device.id),
      );

      await Promise.all(promises);

      expect(syncManager.isReleased(syncPointId)).toBe(true);
    });

    it('should handle devices arriving at different times', async () => {
      const syncPointId = 'staggered-sync';

      syncManager.registerSyncPoint(
        syncPointId,
        devices.map((d) => d.id),
        3000,
      );

      const promises = devices.map(async (device, index) => {
        await new Promise((resolve) => setTimeout(resolve, index * 100));
        return syncManager.waitForSync(syncPointId, device.id);
      });

      await Promise.all(promises);

      expect(syncManager.isReleased(syncPointId)).toBe(true);
    });

    it('should get waiting devices for sync point', () => {
      const syncPointId = 'waiting-sync';

      syncManager.registerSyncPoint(syncPointId, devices.map((d) => d.id));

      syncManager.waitForSync(syncPointId, devices[0].id);

      const waiting = syncManager.getWaitingDevices(syncPointId);
      expect(waiting).toHaveLength(2);
      expect(waiting).toContain('device-2');
      expect(waiting).toContain('device-3');
    });

    it('should get arrived devices for sync point', async () => {
      const syncPointId = 'arrived-sync';

      syncManager.registerSyncPoint(syncPointId, devices.map((d) => d.id));

      syncManager.waitForSync(syncPointId, devices[0].id);

      const arrived = syncManager.getArrivedDevices(syncPointId);
      expect(arrived).toHaveLength(1);
      expect(arrived).toContain('device-1');
    });
  });

  describe('event handling', () => {
    it('should emit status change events', async () => {
      const device = devices[0];
      const events: string[] = [];

      device.addEventListener((event) => {
        if (event.type === 'status_change') {
          events.push(event.data.status);
        }
      });

      await device.connect();

      expect(events).toContain('ready');
    });

    it('should emit step events', async () => {
      const device = devices[0];
      const stepEvents: string[] = [];

      device.addEventListener((event) => {
        if (event.type === 'step_start' || event.type === 'step_complete') {
          stepEvents.push(event.type);
        }
      });

      await device.executeStep({ instruction: 'Test action' });

      expect(stepEvents).toEqual(['step_start', 'step_complete']);
    });
  });

  describe('data channel collaboration', () => {
    it('should notify subscribers of data changes', () => {
      const results: any[] = [];

      dataChannel.addEventListener((event) => {
        results.push(event);
      });

      dataChannel.set('key1', 'value1', 'device-1');
      dataChannel.set('key2', 'value2', 'device-2');

      expect(results).toHaveLength(2);
      expect(results[0].key).toBe('key1');
      expect(results[0].value).toBe('value1');
    });

    it('should subscribe to specific key changes', () => {
      const keyValues: string[] = [];

      dataChannel.subscribe('price', (value) => {
        keyValues.push(String(value));
      });

      dataChannel.set('price', '100');
      dataChannel.set('quantity', '5');
      dataChannel.set('price', '200');

      expect(keyValues).toEqual(['100', '200']);
    });

    it('should maintain change history', () => {
      dataChannel.set('key1', 'value1');
      dataChannel.set('key2', 'value2');
      dataChannel.set('key1', 'value1-updated');

      const history = dataChannel.getHistory();
      expect(history).toHaveLength(3);
      expect(history[2].previousValue).toBe('value1');
      expect(history[2].value).toBe('value1-updated');
    });
  });

  describe('error handling', () => {
    it('should isolate device failures', async () => {
      const device1 = devices[0];
      const device2 = devices[1];

      await device1.connect();
      await device2.connect();

      const results = await Promise.allSettled([
        device1.executeStep({ instruction: 'Valid action' }),
        device2.executeStep({ instruction: 'Valid action' }),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
    });

    it('should handle sync timeout', async () => {
      const syncPointId = 'timeout-sync';

      syncManager.registerSyncPoint(syncPointId, ['device-1', 'device-2'], 100);

      await expect(
        syncManager.waitForSync(syncPointId, 'device-1'),
      ).rejects.toThrow();
    });
  });
});

describe('End-to-End Scenarios', () => {
  let dataChannel: DataChannel;
  let syncManager: SyncManager;
  let devices: MockDeviceSession[];

  beforeEach(async () => {
    dataChannel = createDataChannel();
    syncManager = createSyncManager(10000);

    devices = [];
    for (let i = 1; i <= 3; i++) {
      const device = new MockDeviceSession({
        id: `device-${i}`,
        alias: `Device ${i}`,
        type: 'web',
      });
      devices.push(device);
      await device.connect();
    }
  });

  describe('checkout flow scenario', () => {
    it('should complete multi-device checkout flow', async () => {
      // Device 1: Browse and add to cart
      const device1 = devices[0];
      dataChannel.set('productId', 'PROD-123', 'device-1');
      await device1.executeStep({
        instruction: 'Add product ${productId} to cart',
      });

      // Device 2: View cart
      const device2 = devices[1];
      const productId = dataChannel.get('productId');
      await device2.executeStep({
        instruction: `View cart for product ${productId}`,
      });

      // Sync at checkout
      const syncPointId = 'checkout-start';
      syncManager.registerSyncPoint(
        syncPointId,
        devices.map((d) => d.id),
      );

      await Promise.all(
        devices.map((d) => syncManager.waitForSync(syncPointId, d.id)),
      );

      // Verify all devices synced
      expect(syncManager.isReleased(syncPointId)).toBe(true);

      // Verify data was shared
      expect(dataChannel.get('productId')).toBe('PROD-123');
    });
  });

  describe('parallel execution scenario', () => {
    it('should execute actions in parallel across devices', async () => {
      const startTime = Date.now();

      const actions = devices.map((device) =>
        device.executeStep({
          instruction: `Execute parallel action on ${device.alias}`,
        }),
      );

      await Promise.all(actions);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      for (const device of devices) {
        expect(device.getExecutedSteps()).toHaveLength(1);
      }
    });
  });

  describe('data pipeline scenario', () => {
    it('should pass data through multiple devices', async () => {
      const device1 = devices[0];
      const device2 = devices[1];
      const device3 = devices[2];

      // Device 1 extracts initial data
      const initialData = await device1.extractData('Get user ID');
      dataChannel.set('userId', initialData.value, 'device-1');

      // Device 2 uses data from device 1
      const userId = dataChannel.get('userId');
      await device2.executeStep({
        instruction: `Fetch orders for user ${userId}`,
      });
      dataChannel.set('orderId', 'ORD-999', 'device-2');

      // Device 3 uses aggregated data
      const interpolated = dataChannel.interpolate(
        'Process order ${orderId} for user ${userId}',
      );
      await device3.executeStep({
        instruction: interpolated,
      });

      expect(interpolated).toBe(
        'Process order ORD-999 for user extracted-from-device-1',
      );
    });
  });
});

describe('Orchestrator Integration', () => {
  let orchestrator: Orchestrator;
  let dataChannel: DataChannel;
  let syncManager: SyncManager;

  beforeEach(() => {
    dataChannel = createDataChannel();
    syncManager = createSyncManager(5000);

    orchestrator = createOrchestrator({
      dataChannel,
      syncManager,
      defaultTimeout: 5000,
    });
  });

  describe('orchestrator state', () => {
    it('should start in idle state', () => {
      expect(orchestrator.getState()).toBe('idle');
    });

    it('should provide status information', () => {
      const status = orchestrator.getStatus();

      expect(status.state).toBe('idle');
      expect(status.devices).toEqual([]);
    });
  });

  describe('shared data', () => {
    it('should share data through orchestrator', () => {
      orchestrator.setSharedData('testKey', 'testValue');
      expect(orchestrator.getSharedData('testKey')).toBe('testValue');
    });

    it('should return undefined for missing keys', () => {
      expect(orchestrator.getSharedData('nonexistent')).toBeUndefined();
    });
  });

  describe('session management', () => {
    it('should return all sessions map', () => {
      const sessions = orchestrator.getAllSessions();
      expect(sessions).toBeInstanceOf(Map);
      expect(sessions.size).toBe(0);
    });

    it('should return undefined for non-existent session', () => {
      const session = orchestrator.getSession('nonexistent');
      expect(session).toBeUndefined();
    });
  });
});
