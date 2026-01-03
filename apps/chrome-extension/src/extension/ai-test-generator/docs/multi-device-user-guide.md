# 多设备协同测试用户手册

## 概述

多设备协同测试模块提供了一个完整的跨设备端到端测试框架，支持在 Web 浏览器、Android 和 iOS 设备之间协调执行测试用例。

### 核心能力

- **跨设备协调**：同时在多个设备上执行测试步骤
- **数据共享**：设备间通过数据通道共享测试数据
- **同步点**：确保多个设备在特定步骤同步执行
- **设备会话管理**：统一管理 Web、Android、iOS 设备连接
- **结果聚合**：自动汇总多设备执行结果
- **性能优化**：截图压缩、消息批处理、内存管理

### 支持的设备类型

| 设备类型 | 说明 | 代理方式 |
|---------|------|---------|
| Web | Chrome/Edge/Firefox 浏览器 | Midscene Web Agent |
| Android | Android 设备/模拟器 | ADB + Midscene Android Agent |
| iOS | iPhone/iPad/模拟器 | WebDriverAgent + Midscene iOS Agent |

---

## 快速开始

### 1. 创建编排器

```typescript
import { createOrchestrator, createDataChannel, createSyncManager } from './services/multiDevice';

// 创建数据通道和同步管理器
const dataChannel = createDataChannel();
const syncManager = createSyncManager(30000); // 30秒超时

// 创建编排器
const orchestrator = createOrchestrator({
  dataChannel,
  syncManager,
  defaultTimeout: 10000,
});
```

### 2. 添加设备会话

```typescript
import { createBrowserSession, createAndroidSession, createiOSSession } from './services/multiDevice';

// 添加 Web 设备
const webSession = createBrowserSession({
  id: 'web-1',
  alias: 'Chrome Desktop',
  type: 'web',
  browserName: 'chrome',
  viewport: { width: 1920, height: 1080 },
}, () => midsceneWebAgent);

await orchestrator.addDevice(webSession);
await webSession.connect();

// 添加 Android 设备
const androidSession = createAndroidSession({
  id: 'android-1',
  alias: 'Pixel 6',
  type: 'android',
  deviceId: 'emulator-5554',
  package: 'com.example.app',
}, () => midsceneAndroidAgent);

await orchestrator.addDevice(androidSession);
await androidSession.connect();
```

### 3. 执行协同测试脚本

```typescript
const script = {
  name: '跨端购物流程测试',
  devices: ['web-1', 'android-1'],
  steps: [
    {
      device: 'web-1',
      instruction: '在网页上搜索商品',
    },
    {
      device: 'web-1',
      instruction: '添加商品到购物车',
      export: { orderId: '获取订单号' },
    },
    {
      device: 'android-1',
      instruction: '在移动端查看购物车 ${orderId}',
    },
    {
      sync: 'checkout',
      devices: ['web-1', 'android-1'],
    },
    {
      device: 'android-1',
      instruction: '完成支付',
    },
  ],
};

const result = await orchestrator.executeCollaborative(script);
console.log('测试结果:', result);
```

---

## 功能详解

### 设备会话

#### Web 会话

```typescript
import { createBrowserSession, type BrowserSessionConfig } from './services/multiDevice';

const config: BrowserSessionConfig = {
  id: 'web-1',
  alias: '测试浏览器',
  type: 'web',
  browserName: 'chrome',
  viewport: { width: 1920, height: 1080 },
  headless: false,
  userAgent: 'custom-user-agent',
};

const session = createBrowserSession(config, getMidsceneAgent);

// 连接
await session.connect();

// 执行步骤
const result = await session.executeStep({
  instruction: '点击登录按钮',
});

// 截图
const screenshot = await session.captureScreenshot();

// 提取数据
const data = await session.extractData('获取用户名');

// 断开连接
await session.disconnect();
```

#### Android 会话

```typescript
import { createAndroidSession, type AndroidSessionConfig } from './services/multiDevice';

const config: AndroidSessionConfig = {
  id: 'android-1',
  alias: '测试手机',
  type: 'android',
  deviceId: 'emulator-5554', // ADB 设备 ID
  package: 'com.example.app', // 应用包名
  activity: '.MainActivity',
  screenshotQuality: 0.8,
  enableMirroring: true,
};

const session = createAndroidSession(config, getAndroidAgent);

await session.connect();

// 执行步骤
await session.executeStep({
  instruction: '点击登录按钮',
});

// 特定操作
await session.touch(500, 800); // 点击坐标
await session.swipe({
  start: { x: 500, y: 800 },
  end: { x: 500, y: 200 },
  duration: 300,
});
await session.typeText('hello world');
await session.pressBack();
await session.pressHome();

// 应用管理
await session.launchApp('com.example.app');
await session.closeApp('com.example.app');
await session.installApp('/path/to/app.apk');
await session.uninstallApp('com.example.app');
```

#### iOS 会话

```typescript
import { createiOSSession, type iOSSessionConfig } from './services/multiDevice';

const config: iOSSessionConfig = {
  id: 'ios-1',
  alias: 'iPhone 测试',
  type: 'ios',
  bundleId: 'com.example.app',
  useSimulator: true,
  simulatorDevice: 'iPhone 14 Pro',
  simulatorOS: '16.0',
  wdaHost: 'localhost',
  wdaPort: 8100,
};

const session = createiOSSession(config, getIOSAgent);

await session.connect();

// 执行步骤
await session.executeStep({
  instruction: '点击登录按钮',
});

// iOS 特定操作
await session.tap(500, 800);
await session.doubleTap(500, 800);
await session.longPress(500, 800, 1000);
await session.swipe({
  start: { x: 500, y: 800 },
  end: { x: 500, y: 200 },
});
await session.pinch(2.0, 500, 800); // 放大
await session.pressHome();
await session.shake();
```

### 数据通道

数据通道允许设备间共享测试数据：

```typescript
import { createDataChannel } from './services/multiDevice';

const channel = createDataChannel();

// 设置数据
channel.set('userId', 'user-123', 'web-1');
channel.set('orderId', 'order-456', 'android-1');

// 获取数据
const userId = channel.get('userId'); // 'user-123'

// 字符串插值
const message = channel.interpolate('用户 ${userId} 的订单 ${orderId}');
// '用户 user-123 的订单 order-456'

// 订阅特定键的变化
channel.subscribe('userId', (value) => {
  console.log('用户 ID 变更:', value);
});

// 监听所有变化
channel.addEventListener((event) => {
  console.log('数据变化:', event.key, event.value);
});

// 获取历史记录
const history = channel.getHistory();

// 批量操作
channel.batch({
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
});
```

### 同步管理

同步点确保多个设备在特定位置同步执行：

```typescript
import { createSyncManager } from './services/multiDevice';

const syncManager = createSyncManager(30000); // 30秒超时

// 注册同步点
syncManager.registerSyncPoint(
  'checkout-start',
  ['web-1', 'android-1', 'ios-1'],
  30000,
);

// 设备等待同步
await syncManager.waitForSync('checkout-start', 'web-1');
await syncManager.waitForSync('checkout-start', 'android-1');
await syncManager.waitForSync('checkout-start', 'ios-1');
// 所有设备都到达后才继续

// 获取等待中的设备
const waiting = syncManager.getWaitingDevices('checkout-start');

// 获取已到达的设备
const arrived = syncManager.getArrivedDevices('checkout-start');

// 检查是否已释放
const isReleased = syncManager.isReleased('checkout-start');

// 取消同步点
syncManager.unregisterSyncPoint('checkout-start');
```

### 测试脚本解析

支持结构化的协同测试脚本：

```typescript
import { createScriptParser } from './services/multiDevice';

const parser = createScriptParser();

const script = {
  name: '跨端测试',
  devices: [
    { id: 'web-1', type: 'web' },
    { id: 'mobile-1', type: 'android' },
  ],
  steps: [
    {
      device: 'web-1',
      instruction: '打开首页',
    },
    {
      device: 'mobile-1',
      instruction: '打开应用',
      waitFor: { device: 'web-1', step: 0 },
    },
    {
      parallel: [
        { device: 'web-1', instruction: '点击搜索' },
        { device: 'mobile-1', instruction: '点击搜索' },
      ],
    },
    {
      sync: 'search-complete',
      devices: ['web-1', 'mobile-1'],
    },
  ],
};

const result = parser.parse(script);
if (!result.valid) {
  console.error('解析错误:', result.errors);
}
```

### 结果聚合

自动汇总多设备执行结果：

```typescript
import { createResultAggregator } from './services/multiDevice';

const aggregator = createResultAggregator();

// 添加设备结果
aggregator.addDeviceResult('web-1', {
  success: true,
  duration: 5000,
  steps: [...],
});

aggregator.addDeviceResult('android-1', {
  success: false,
  error: '元素未找到',
  duration: 3000,
  steps: [...],
});

// 获取聚合结果
const aggregated = aggregator.getAggregatedResult();

console.log('总体状态:', aggregated.overallStatus); // 'partial'
console.log('统计:', aggregated.stats);
// {
//   totalDevices: 2,
//   successful: 1,
//   failed: 1,
//   totalDuration: 8000,
//   totalSteps: 20
// }

// 设备对比
const comparison = aggregator.getDeviceComparison();

// 失败关联分析
const correlations = aggregator.findFailureCorrelations();
```

### 报告生成

生成多种格式的测试报告：

```typescript
import { createCollaborativeReportGenerator } from './services/multiDevice';

const generator = createCollaborativeReportGenerator();

const report = generator.generate({
  results: aggregatedResult,
  script: testScript,
  timeline: timelineEvents,
});

// 生成 Markdown
const markdown = generator.toMarkdown(report);

// 生成 HTML
const html = generator.toHTML(report);

// 生成 JSON
const json = generator.toJSON(report);

// 自定义选项
const customReport = generator.generate({
  results: aggregatedResult,
  script: testScript,
  options: {
    includeScreenshots: true,
    includeTimeline: true,
    includeStepDetails: true,
    groupByDevice: true,
  },
});
```

---

## 性能优化

### 截图压缩

自动压缩截图以减少内存占用：

```typescript
import { createScreenshotCompressor } from './services/multiDevice';

const compressor = createScreenshotCompressor({
  quality: 0.75,
  maxWidth: 1920,
  maxHeight: 1080,
  format: 'jpeg',
});

// 压缩单个截图
const result = await compressor.compress(base64Screenshot);
console.log('压缩率:', result.ratio); // 0.3 表示压缩到 30%

// 批量压缩
const results = await compressor.compressBatch([
  screenshot1,
  screenshot2,
  screenshot3,
]);

// 清除缓存
compressor.clearCache();

// 获取缓存统计
const stats = compressor.getCacheStats();
```

### 消息批处理

批量处理消息以提升传输效率：

```typescript
import { createMessageBatcher } from './services/multiDevice';

const batcher = createMessageBatcher({
  maxBatchSize: 10,
  maxWaitTime: 100,
  maxSize: 1024 * 1024,
});

// 订阅批处理事件
const unsubscribe = batcher.onFlush((batch) => {
  console.log('处理批次:', batch.length);
  // 发送到服务器
  sendToServer(batch);
});

// 添加消息
batcher.add('msg-1', { type: 'log', data: '...' });
batcher.add('msg-2', { type: 'log', data: '...' });
// 自动在达到限制时刷新

// 手动刷新
batcher.forceFlush();

// 清除
batcher.clear();
unsubscribe();
```

### 内存池

LRU 内存管理，自动清理过期数据：

```typescript
import { createMemoryPool } from './services/multiDevice';

const pool = createMemoryPool(
  100 * 1024 * 1024, // 最大 100MB
  300000, // 5分钟过期
);

// 存储数据
pool.set('screenshot-1', base64Data, estimateSize);

// 获取数据
const data = pool.get('screenshot-1');

// 检查是否存在
if (pool.has('screenshot-1')) {
  // ...
}

// 删除数据
pool.delete('screenshot-1');

// 获取统计
const stats = pool.getStats();
console.log('总条目:', stats.totalEntries);
console.log('总大小:', stats.totalSize);
console.log('回收:', stats.reclaimedCount);

// 清空
pool.clear();

// 销毁（停止定时器）
pool.destroy();
```

### 性能监控

追踪操作性能指标：

```typescript
import { createPerformanceMonitor } from './services/multiDevice';

const monitor = createPerformanceMonitor();

// 记录指标
monitor.record('step-execution', 150);
monitor.record('step-execution', 200);
monitor.record('step-execution', 180);

// 计时函数
const result = await monitor.time('database-query', async () => {
  return await db.query('SELECT * FROM users');
});

// 获取统计
const stats = monitor.getStats('step-execution');
console.log('最小:', stats.min); // 150
console.log('最大:', stats.max); // 200
console.log('平均:', stats.avg); // 176.67
console.log('次数:', stats.count); // 3

// 清除
monitor.clear();
```

---

## 设备预设

使用预设快速创建常见设备配置：

```typescript
import {
  getPresetsByType,
  getPresetsByCategory,
  getPresetById,
  createConfigFromPreset,
  createConfigsFromScenario,
  testScenarios,
} from './services/multiDevice';

// 获取所有桌面预设
const desktopPresets = getPresetsByCategory('desktop');

// 获取所有移动设备预设
const mobilePresets = getPresetsByType('android');

// 获取特定预设
const preset = getPresetById('chrome-desktop-1920');
if (preset) {
  const config = createConfigFromPreset(preset, {
    id: 'my-device',
    alias: '我的设备',
  });
}

// 使用场景预设
const scenario = testScenarios.find(s => s.id === 'responsive-check');
if (scenario) {
  const configs = createConfigsFromScenario(scenario);
  // 自动创建适合响应式测试的多设备配置
}
```

### 可用预设

#### 桌面浏览器

| 预设 ID | 描述 | 分辨率 |
|---------|------|--------|
| chrome-desktop-1920 | Chrome Desktop (FHD) | 1920×1080 |
| chrome-desktop-2560 | Chrome Desktop (2K) | 2560×1440 |
| chrome-desktop-3840 | Chrome Desktop (4K) | 3840×2160 |
| firefox-desktop-1920 | Firefox Desktop (FHD) | 1920×1080 |
| edge-desktop-1920 | Edge Desktop (FHD) | 1920×1080 |

#### 移动设备

| 预设 ID | 描述 | 尺寸 |
|---------|------|------|
| android-phone-small | Android Phone (小) | 360×640 |
| android-phone-medium | Android Phone (中) | 375×667 |
| android-phone-large | Android Phone (大) | 414×896 |
| android-tablet | Android Tablet | 768×1024 |
| ios-iphone-se | iPhone SE | 375×667 |
| ios-iphone-14-pro | iPhone 14 Pro | 393×852 |
| ios-ipad | iPad | 810×1080 |

#### 测试场景

| 场景 ID | 描述 | 包含设备 |
|---------|------|---------|
| responsive-check | 响应式设计检查 | 桌面 + 平板 + 手机 |
| cross-platform | 跨平台测试 | Chrome + Firefox + Safari |
| mobile-first | 移动优先测试 | Android + iOS 手机 |

---

## API 参考

### 编排器 (Orchestrator)

```typescript
import { createOrchestrator, type OrchestratorConfig } from './services/multiDevice';

const config: OrchestratorConfig = {
  dataChannel,
  syncManager,
  defaultTimeout: 10000,
  callbacks: {
    onStepStart: (deviceId, step) => console.log('步骤开始'),
    onStepComplete: (deviceId, step, result) => console.log('步骤完成'),
    onDeviceError: (deviceId, error) => console.error('设备错误'),
    onSyncPointReached: (syncPointId, deviceId) => console.log('同步点到达'),
  },
};

const orchestrator = createOrchestrator(config);

// 添加设备
await orchestrator.addDevice(session);

// 移除设备
await orchestrator.removeDevice('device-id');

// 执行协同脚本
const result = await orchestrator.executeCollaborative(script);

// 获取状态
const status = orchestrator.getStatus();
const state = orchestrator.getState();

// 共享数据
orchestrator.setSharedData('key', 'value');
const value = orchestrator.getSharedData('key');

// 获取会话
const session = orchestrator.getSession('device-id');
const sessions = orchestrator.getAllSessions();

// 暂停/恢复
orchestrator.pause();
orchestrator.resume();

// 停止
await orchestrator.stop();
```

### 设备会话接口

所有设备会话实现以下接口：

```typescript
interface DeviceSession {
  // 基本信息
  readonly id: string;
  readonly alias: string;
  readonly type: DeviceType;
  status: DeviceStatus;

  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;

  // 步骤执行
  executeStep(step: TestStep): Promise<StepResult>;

  // 数据操作
  extractData(query: string): Promise<any>;
  injectData(data: Record<string, any>): void;

  // 截图
  captureScreenshot(): Promise<string | undefined>;

  // 事件监听
  addEventListener(listener: SessionEventListener): void;
  removeEventListener(listener: SessionEventListener): void;

  // 信息获取
  getInfo(): DeviceInfo;
}
```

### 测试步骤类型

```typescript
type TestStep =
  | InstructionStep      // 普通指令步骤
  | WaitForStep          // 等待步骤
  | AssertStep           // 断言步骤
  | ExportStep           // 数据导出步骤
  | SyncStep             // 同步点步骤
  | ParallelStep;        // 并行执行步骤

// 指令步骤
interface InstructionStep {
  instruction: string;  // AI 理解的自然语言指令
  timeout?: number;
}

// 等待步骤
interface WaitForStep {
  waitFor: string;      // 等待条件
  timeout?: number;
}

// 断言步骤
interface AssertStep {
  assert: string;       // 断言条件
  timeout?: number;
}

// 数据导出步骤
interface ExportStep {
  instruction: string;
  export: Record<string, string>; // key -> query
}

// 同步点步骤
interface SyncStep {
  sync: string;         // 同步点 ID
  devices: string[];    // 参与设备
  timeout?: number;
}

// 并行步骤
interface ParallelStep {
  parallel: TestStep[];
}
```

---

## 常见问题

### Q: 如何处理设备连接失败？

A: 编排器会自动重试连接。可以通过配置重试策略：

```typescript
const session = createBrowserSession(config, getAgent, {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
});
```

### Q: 数据通道的数据会过期吗？

A: 默认不会过期。如需 TTL，可以使用 MemoryPool 包装：

```typescript
const pool = createMemoryPool(100 * 1024 * 1024, 60000);
pool.setFromChannel(channel, 'key', 'value', 60000);
```

### Q: 同步点超时后如何处理？

A: 超时会抛出错误，可以捕获后决定是否继续：

```typescript
try {
  await syncManager.waitForSync('checkout', deviceId);
} catch (error) {
  // 决定是跳过还是终止
  if (canContinue) {
    console.warn('同步超时，继续执行');
  } else {
    throw error;
  }
}
```

### Q: 如何调试协同测试？

A: 使用事件监听器跟踪执行过程：

```typescript
orchestrator.addDeviceEventListener('device-1', (event) => {
  console.log('[设备事件]', event.type, event.data);
});

dataChannel.addEventListener((event) => {
  console.log('[数据变化]', event.key, event.value);
});

syncManager.addEventListener((event) => {
  console.log('[同步事件]', event.syncPointId, event.type);
});
```

### Q: 截图压缩会影响测试调试吗？

A: 压缩只影响存储和传输，AI 分析仍使用原始截图。可在配置中关闭压缩：

```typescript
const compressor = createScreenshotCompressor({
  quality: 1.0, // 无损
  format: 'png',
});
```

---

## 更新日志

### v1.0.0 (2025-01)

- 初始版本发布
- 支持 Web、Android、iOS 设备会话
- 协同测试执行引擎
- 数据通道和同步点管理
- 截图压缩、消息批处理、内存池
- 性能监控和指标收集
- 设备预设和测试场景
- 测试报告生成（Markdown/HTML/JSON）
- 177+ 单元测试和集成测试
