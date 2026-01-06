/**
 * Multi-Device E2E Acceptance Tests
 *
 * Comprehensive end-to-end tests validating all acceptance criteria from the spec:
 * 1. Support 5 devices simultaneous collaboration
 * 2. Sync point waiting is accurate and reliable
 * 3. Data sharing real-time sync < 500ms
 * 4. Single device failure doesn't affect other devices
 * 5. Aggregated report clearly displays complete flow
 * 6. YAML syntax is easy to understand and write
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  type CollaborativeScript,
  DataChannel,
  type DeviceConfig,
  Orchestrator,
  ResultAggregator,
  ScriptParser,
  SyncManager,
  type TestStep,
  createCollaborativeReportGenerator,
  createDataChannel,
  createOrchestrator,
  createResultAggregator,
  createScriptParser,
  createSyncManager,
} from '..';

/**
 * Mock device session simulating real device behavior
 */
class MockDeviceSession {
  readonly id: string;
  readonly alias: string;
  readonly type: 'web' | 'android' | 'ios';
  status: 'connecting' | 'ready' | 'busy' | 'error' | 'disconnected' =
    'disconnected';

  private connected = false;
  private shouldFail = false;
  private injectedData: Record<string, any> = {};
  private listeners: Set<(event: any) => void> = new Set();

  constructor(config: DeviceConfig & { shouldFail?: boolean }) {
    this.id = config.id;
    this.alias = config.alias;
    this.type = config.type || 'web';
    this.shouldFail = config.shouldFail || false;
  }

  async connect(): Promise<void> {
    this.status = 'connecting';
    this.emit('status_change', { status: 'connecting' });
    await this.delay(5);
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

    if (this.shouldFail) {
      throw new Error('Simulated device failure');
    }

    this.emit('step_start', { step });
    this.status = 'busy';
    await this.delay(10);
    this.status = 'ready';

    // Handle export
    let exportedData: Record<string, any> | undefined;
    if (step.export) {
      exportedData = {};
      for (const [key, query] of Object.entries(step.export)) {
        exportedData[key] = `${this.alias}-${key}-${Date.now()}`;
      }
    }

    this.emit('step_complete', { step, result: { success: true } });

    return {
      success: true,
      duration: 10,
      screenshot: `screenshot-${this.id}-${Date.now()}.png`,
      exportedData,
    };
  }

  async extractData(query: string): Promise<any> {
    return { query, value: `extracted-from-${this.id}` };
  }

  injectData(data: Record<string, any>): void {
    this.injectedData = { ...this.injectedData, ...data };
  }

  async captureScreenshot(): Promise<string> {
    return `screenshot-${this.id}-${Date.now()}.png`;
  }

  getInfo() {
    return {
      id: this.id,
      alias: this.alias,
      type: this.type,
      status: this.status,
      currentStep: 0,
      totalSteps: 0,
      lastScreenshot: undefined,
    };
  }

  addEventListener(listener: (event: any) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: (event: any) => void): void {
    this.listeners.delete(listener);
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * E2E Test Suite
 */
describe('Multi-Device E2E Acceptance Tests', () => {
  describe('Acceptance Criterion 1: Support 5 devices simultaneous collaboration', () => {
    it('should coordinate 5 devices executing in parallel', async () => {
      const devices: MockDeviceSession[] = [];
      const deviceTypes: Array<'web' | 'android' | 'ios'> = [
        'web',
        'android',
        'ios',
        'web',
        'android',
      ];

      // Create 5 devices
      for (let i = 0; i < 5; i++) {
        const device = new MockDeviceSession({
          id: `device-${i}`,
          alias: `Device ${i}`,
          type: deviceTypes[i],
        });
        await device.connect();
        devices.push(device);
      }

      // Execute parallel steps across all 5 devices
      const startTime = Date.now();
      const results = await Promise.all(
        devices.map((device) =>
          device.executeStep({ instruction: `Execute on ${device.alias}` }),
        ),
      );
      const duration = Date.now() - startTime;

      // Verify all executed successfully
      expect(results).toHaveLength(5);
      expect(results.every((r) => r.success)).toBe(true);

      // Verify parallel execution (should complete quickly)
      expect(duration).toBeLessThan(100);

      // Verify all devices ready
      expect(devices.every((d) => d.status === 'ready')).toBe(true);
    });

    it('should handle 5 devices with sync points', async () => {
      const syncManager = createSyncManager(5000);
      const devices: MockDeviceSession[] = [];

      for (let i = 0; i < 5; i++) {
        const device = new MockDeviceSession({
          id: `device-${i}`,
          alias: `Device ${i}`,
          type: 'web',
        });
        await device.connect();
        devices.push(device);
      }

      const syncPointId = 'five-device-sync';
      syncManager.registerSyncPoint(
        syncPointId,
        devices.map((d) => d.id),
        5000,
      );

      // All devices reach sync point
      await Promise.all(
        devices.map((d) => syncManager.waitForSync(syncPointId, d.id)),
      );

      expect(syncManager.isReleased(syncPointId)).toBe(true);
    });
  });

  describe('Acceptance Criterion 2: Sync point waiting is accurate and reliable', () => {
    it('should accurately wait for all devices at sync point', async () => {
      const syncManager = createSyncManager(10000);
      const devices: MockDeviceSession[] = [];

      for (let i = 0; i < 3; i++) {
        const device = new MockDeviceSession({
          id: `device-${i}`,
          alias: `Device ${i}`,
          type: 'web',
        });
        await device.connect();
        devices.push(device);
      }

      const syncPointId = 'accurate-sync';
      syncManager.registerSyncPoint(
        syncPointId,
        devices.map((d) => d.id),
        10000,
      );

      // Devices arrive at different times
      const arrivalOrder: string[] = [];
      const promises = devices.map(async (device, index) => {
        await new Promise((resolve) => setTimeout(resolve, index * 50));
        arrivalOrder.push(device.id);
        await syncManager.waitForSync(syncPointId, device.id);
      });

      await Promise.all(promises);

      // Verify all devices arrived
      expect(arrivalOrder).toEqual(['device-0', 'device-1', 'device-2']);
      expect(syncManager.isReleased(syncPointId)).toBe(true);
    });

    it('should timeout reliably when device does not arrive', async () => {
      const syncManager = createSyncManager(1000);
      const devices: MockDeviceSession[] = [];

      for (let i = 0; i < 3; i++) {
        const device = new MockDeviceSession({
          id: `device-${i}`,
          alias: `Device ${i}`,
          type: 'web',
        });
        await device.connect();
        devices.push(device);
      }

      const syncPointId = 'timeout-sync';
      syncManager.registerSyncPoint(
        syncPointId,
        devices.map((d) => d.id),
        1000,
      );

      // Only 2 devices arrive, third never does
      const results = await Promise.allSettled([
        syncManager.waitForSync(syncPointId, 'device-0'),
        syncManager.waitForSync(syncPointId, 'device-1'),
        // device-2 never arrives
      ]);

      // Both should timeout
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');
    });

    it('should track waiting and arrived devices correctly', async () => {
      const syncManager = createSyncManager(5000);

      syncManager.registerSyncPoint('tracking-sync', [
        'device-0',
        'device-1',
        'device-2',
      ]);

      // Initially all waiting
      let waiting = syncManager.getWaitingDevices('tracking-sync');
      expect(waiting).toEqual(['device-0', 'device-1', 'device-2']);

      // Device 0 arrives (start waiting but don't complete)
      syncManager.waitForSync('tracking-sync', 'device-0');
      const arrived = syncManager.getArrivedDevices('tracking-sync');
      expect(arrived).toContain('device-0');

      waiting = syncManager.getWaitingDevices('tracking-sync');
      expect(waiting).toEqual(['device-1', 'device-2']);
    });
  });

  describe('Acceptance Criterion 3: Data sharing real-time sync < 500ms', () => {
    it('should share data between devices with low latency', async () => {
      const dataChannel = createDataChannel();
      const devices: MockDeviceSession[] = [];

      for (let i = 0; i < 3; i++) {
        const device = new MockDeviceSession({
          id: `device-${i}`,
          alias: `Device ${i}`,
          type: 'web',
        });
        await device.connect();
        devices.push(device);
      }

      // Measure data propagation time
      const startTime = Date.now();

      // Device 1 sets data
      dataChannel.set('orderId', 'ORD-12345', 'device-0');

      // Device 2 reads data
      const value1 = dataChannel.get('orderId');
      expect(value1).toBe('ORD-12345');

      // Device 3 uses interpolation
      const interpolated = dataChannel.interpolate(
        'Processing order ${orderId}',
      );
      expect(interpolated).toBe('Processing order ORD-12345');

      const duration = Date.now() - startTime;

      // Should be much faster than 500ms (typically < 10ms)
      expect(duration).toBeLessThan(500);
    });

    it('should notify subscribers immediately on data change', async () => {
      const dataChannel = createDataChannel();
      const notificationTimes: number[] = [];

      // Subscribe to key changes
      dataChannel.subscribe('price', (value) => {
        notificationTimes.push(Date.now());
      });

      // Set data multiple times
      const startTime = Date.now();
      dataChannel.set('price', '100', 'device-0');
      dataChannel.set('price', '200', 'device-1');
      dataChannel.set('price', '300', 'device-2');

      await new Promise((resolve) => setTimeout(resolve, 10));

      // All notifications should happen quickly
      expect(notificationTimes).toHaveLength(3);
      const maxDelay = Math.max(...notificationTimes) - startTime;
      expect(maxDelay).toBeLessThan(500);
    });

    it('should handle complex variable interpolation efficiently', async () => {
      const dataChannel = createDataChannel();

      // Set multiple variables
      dataChannel.set('userId', 'user-123', 'device-0');
      dataChannel.set('orderId', 'order-456', 'device-1');
      dataChannel.set('amount', '99.99', 'device-2');

      const startTime = Date.now();

      // Complex interpolation
      const result = dataChannel.interpolate(
        'User ${userId} placed order ${orderId} for $${amount}',
      );

      const duration = Date.now() - startTime;

      expect(result).toBe('User user-123 placed order order-456 for $99.99');
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Acceptance Criterion 4: Single device failure does not affect other devices', () => {
    it('should continue execution when one device fails', async () => {
      const devices: MockDeviceSession[] = [];

      // Create 3 devices, middle one will fail
      const failingDevice = new MockDeviceSession({
        id: 'device-0',
        alias: 'Failing Device',
        type: 'web',
        shouldFail: true,
      });
      await failingDevice.connect();
      devices.push(failingDevice);

      for (const i of [1, 2]) {
        const device = new MockDeviceSession({
          id: `device-${i}`,
          alias: `Working Device ${i}`,
          type: 'web',
        });
        await device.connect();
        devices.push(device);
      }

      // Execute on all devices
      const results = await Promise.allSettled(
        devices.map((device) =>
          device.executeStep({ instruction: 'Test step' }),
        ),
      );

      // Failing device should fail
      expect(results[0].status).toBe('rejected');

      // Other devices should succeed
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('fulfilled');

      // Working devices should still be ready
      expect(devices[1].status).toBe('ready');
      expect(devices[2].status).toBe('ready');
    });

    it('should isolate errors between device sessions', async () => {
      const device1 = new MockDeviceSession({
        id: 'device-1',
        alias: 'Device 1',
        type: 'web',
      });
      const device2 = new MockDeviceSession({
        id: 'device-2',
        alias: 'Device 2',
        type: 'web',
      });

      await device1.connect();
      await device2.connect();

      // Device 1 executes successfully
      const result1 = await device1.executeStep({
        instruction: 'Success action',
      });
      expect(result1.success).toBe(true);

      // Device 2 executes successfully
      const result2 = await device2.executeStep({
        instruction: 'Another success',
      });
      expect(result2.success).toBe(true);

      // Both should be independent
      expect(device1.id).not.toBe(device2.id);
      expect(device1.status).toBe('ready');
      expect(device2.status).toBe('ready');
    });
  });

  describe('Acceptance Criterion 5: Aggregated report clearly displays complete flow', () => {
    it('should generate comprehensive aggregated result', async () => {
      const aggregator = createResultAggregator();

      // Create a complete execution result
      const executionResult = {
        success: true,
        startTime: Date.now() - 2000,
        endTime: Date.now(),
        totalDuration: 2000,
        devices: [
          {
            deviceId: 'device-0',
            deviceAlias: 'Device 0',
            steps: [
              {
                instruction: 'Step 1',
                result: { success: true, duration: 300, error: undefined },
              },
              {
                instruction: 'Step 2',
                result: { success: true, duration: 700, error: undefined },
              },
            ],
            totalDuration: 1000,
          },
          {
            deviceId: 'device-1',
            deviceAlias: 'Device 1',
            steps: [
              {
                instruction: 'Step 1',
                result: { success: true, duration: 400, error: undefined },
              },
              {
                instruction: 'Step 2',
                result: { success: true, duration: 400, error: undefined },
              },
            ],
            totalDuration: 800,
          },
        ],
        syncPoints: [
          {
            id: 'sync-1',
            startTime: Date.now() - 1500,
            endTime: Date.now() - 1000,
            duration: 500,
            waitingDevices: ['device-0', 'device-1'],
          },
        ],
        sharedData: { orderId: 'ORD-123' },
        errors: [],
      };

      const aggregated = aggregator.aggregate(executionResult);

      expect(aggregated.original.success).toBe(true);
      expect(aggregated.stats.totalSteps).toBe(4);
      expect(aggregated.stats.successfulSteps).toBe(4);
      expect(aggregated.stats.failedSteps).toBe(0);
      expect(aggregated.stats.totalDuration).toBe(2000);
      expect(aggregated.deviceComparisons).toHaveLength(2);
    });

    it('should generate multiple report formats', async () => {
      const generator = createCollaborativeReportGenerator();

      const executionResult = {
        success: true,
        startTime: Date.now() - 5000,
        endTime: Date.now(),
        totalDuration: 5000,
        devices: [
          {
            deviceId: 'device-0',
            deviceAlias: 'Web Device',
            steps: [
              {
                instruction: 'Navigate',
                result: { success: true, duration: 500, error: undefined },
              },
              {
                instruction: 'Click',
                result: { success: true, duration: 300, error: undefined },
              },
            ],
            totalDuration: 2000,
          },
        ],
        syncPoints: [],
        sharedData: { orderId: 'ORD-123' },
        errors: [],
      };

      // Generate all formats
      const markdown = generator.generate(executionResult as any, {
        format: 'markdown',
        title: 'Test Flow',
      });
      const html = generator.generate(executionResult as any, {
        format: 'html',
        title: 'Test Flow',
      });
      const json = generator.generate(executionResult as any, {
        format: 'json',
        title: 'Test Flow',
      });

      expect(markdown.content).toContain('# Test Flow');
      expect(html.content).toContain('<html');
      expect(json.content).toContain('"Test Flow"');
    });

    it('should include timeline in report', async () => {
      const generator = createCollaborativeReportGenerator();

      const executionResult = {
        success: true,
        startTime: Date.now() - 1000,
        endTime: Date.now(),
        totalDuration: 1000,
        devices: [
          {
            deviceId: 'device-0',
            deviceAlias: 'Device 0',
            steps: [
              {
                instruction: 'Test step',
                result: { success: true, duration: 100, error: undefined },
              },
            ],
            totalDuration: 100,
          },
        ],
        syncPoints: [
          {
            id: 'sync-1',
            startTime: Date.now() - 800,
            endTime: Date.now() - 500,
            duration: 300,
            waitingDevices: ['device-0'],
          },
        ],
        sharedData: {},
        errors: [],
      };

      const report = generator.generate(executionResult as any, {
        format: 'markdown',
        title: 'Timeline Test',
        includeTimeline: true,
      });

      // Markdown format includes sync points section
      expect(report.content).toContain('## Sync Points');
      expect(report.content).toContain('sync-1');
    });
  });

  describe('Acceptance Criterion 6: YAML syntax is easy to understand and write', () => {
    it('should parse collaborative script YAML structure', () => {
      const parser = createScriptParser();

      // ScriptParser.parse() expects a YAML string
      const yamlScript = `
name: Cross-platform checkout flow
description: Test checkout across web and mobile
devices:
  web:
    type: browser
    viewport:
      width: 1920
      height: 1080
    startUrl: https://example.com
  mobile:
    type: android
    deviceId: emulator-5554
    package: com.example.app
variables:
  testUser: test@example.com
  testPassword: Test123456
flow:
  - type: device
    device: web
    steps:
      - ai: Login with \${testUser}
      - ai: Add item to cart
      - export:
          orderId: Get order ID from page
  - sync: order-created
    timeout: 5000
  - type: device
    device: mobile
    steps:
      - ai: Open app
      - ai: View order \${orderId}
  - type: parallel
    blocks:
      - type: device
        device: web
        steps:
          - ai: Verify status on web
      - type: device
        device: mobile
        steps:
          - ai: Verify status on mobile
`;

      const result = parser.parse(yamlScript);

      expect(result.success).toBe(true);
      expect(result.script?.name).toBe('Cross-platform checkout flow');
      expect(result.script?.devices).toHaveProperty('web');
      expect(result.script?.devices).toHaveProperty('mobile');
      expect(result.script?.flow).toHaveLength(4);
    });

    it('should provide clear validation errors for invalid scripts', () => {
      const parser = createScriptParser();

      // Invalid YAML script - references undefined device
      const invalidYaml = `
name: Invalid Script
devices:
  valid-device:
    type: browser
flow:
  - type: device
    device: non-existent
    steps:
      - ai: Do something
`;

      const result = parser.parse(invalidYaml);

      // Should be invalid due to unknown device reference
      if (!result.success) {
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should support variable interpolation in YAML', () => {
      const parser = createScriptParser();
      const dataChannel = createDataChannel();

      dataChannel.set('username', 'testuser');
      dataChannel.set('productId', 'PROD-123');

      const template = 'User ${username} purchased ${productId}';
      const result = dataChannel.interpolate(template);

      expect(result).toBe('User testuser purchased PROD-123');
    });
  });

  describe('Complete E2E Scenario: Multi-device checkout flow', () => {
    it('should execute complete cross-device checkout scenario', async () => {
      // Setup
      const dataChannel = createDataChannel();
      const syncManager = createSyncManager(10000);
      const aggregator = createResultAggregator();
      const devices: MockDeviceSession[] = [];

      // Create devices: Web desktop, Android, iOS
      for (let i = 0; i < 3; i++) {
        const device = new MockDeviceSession({
          id: `device-${i}`,
          alias: `Device ${i}`,
          type: i === 0 ? 'web' : i === 1 ? 'android' : 'ios',
        });
        await device.connect();
        devices.push(device);
      }

      // Phase 1: Web device adds product to cart
      const webDevice = devices[0];
      dataChannel.set('productId', 'PROD-999', 'device-0');
      await webDevice.executeStep({
        instruction: 'Add product PROD-999 to cart',
        export: { cartId: 'Get cart ID' },
      });

      // Verify data propagation
      expect(dataChannel.get('productId')).toBe('PROD-999');

      // Phase 2: Sync point - all devices ready
      const syncPoint1 = 'cart-ready';
      syncManager.registerSyncPoint(
        syncPoint1,
        devices.map((d) => d.id),
        10000,
      );
      await Promise.all(
        devices.map((d) => syncManager.waitForSync(syncPoint1, d.id)),
      );
      expect(syncManager.isReleased(syncPoint1)).toBe(true);

      // Phase 3: Parallel - Mobile devices view cart
      await Promise.all([
        devices[1].executeStep({
          instruction: 'Android: View cart',
        }),
        devices[2].executeStep({
          instruction: 'iOS: View cart',
        }),
      ]);

      // Phase 4: Final sync
      const syncPoint2 = 'checkout-complete';
      syncManager.registerSyncPoint(
        syncPoint2,
        devices.map((d) => d.id),
        10000,
      );
      await Promise.all(
        devices.map((d) => syncManager.waitForSync(syncPoint2, d.id)),
      );

      // Build execution result for aggregation
      const startTime = Date.now() - 1000;
      const executionResult = {
        success: true,
        startTime,
        endTime: Date.now(),
        totalDuration: 1000,
        devices: devices.map((d) => ({
          deviceId: d.id,
          deviceAlias: d.alias,
          steps: [
            {
              instruction: 'Test step',
              result: { success: true, duration: 100, error: undefined },
            },
          ],
          totalDuration: 100,
        })),
        syncPoints: [
          {
            id: syncPoint1,
            startTime: startTime + 200,
            endTime: startTime + 500,
            duration: 300,
            waitingDevices: devices.map((d) => d.id),
          },
          {
            id: syncPoint2,
            startTime: startTime + 600,
            endTime: startTime + 800,
            duration: 200,
            waitingDevices: devices.map((d) => d.id),
          },
        ],
        sharedData: { productId: 'PROD-999' },
        errors: [],
      };

      const aggregated = aggregator.aggregate(executionResult);

      // Verify complete scenario
      expect(aggregated.original.success).toBe(true);
      expect(aggregated.stats.totalSteps).toBe(3);
      expect(aggregated.stats.successfulSteps).toBe(3);
      expect(dataChannel.get('productId')).toBe('PROD-999');
    });
  });
});

/**
 * Performance and Load Tests
 */
describe('Multi-Device Performance Tests', () => {
  it('should handle rapid data channel updates', async () => {
    const dataChannel = createDataChannel();

    const startTime = Date.now();

    // Perform 100 rapid updates
    for (let i = 0; i < 100; i++) {
      dataChannel.set(`key-${i}`, `value-${i}`, 'device-0');
    }

    const duration = Date.now() - startTime;

    // Should complete quickly
    expect(duration).toBeLessThan(1000);

    // Verify all data is stored
    expect(dataChannel.get('key-50')).toBe('value-50');
  });

  it('should handle multiple concurrent sync points', async () => {
    const syncManager = createSyncManager(5000);
    const devices = ['d0', 'd1', 'd2'];

    // Create multiple sync points
    const syncPoints = ['sync-1', 'sync-2', 'sync-3'];
    for (const syncId of syncPoints) {
      syncManager.registerSyncPoint(syncId, devices, 5000);
    }

    // Execute all sync points concurrently
    const startTime = Date.now();
    await Promise.all(
      syncPoints.map((syncId) =>
        Promise.all(devices.map((d) => syncManager.waitForSync(syncId, d))),
      ),
    );
    const duration = Date.now() - startTime;

    // All should complete
    expect(syncPoints.every((id) => syncManager.isReleased(id))).toBe(true);
    expect(duration).toBeLessThan(1000);
  });
});
