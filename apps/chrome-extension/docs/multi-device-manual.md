# 多设备协同测试用户手册

本手册介绍如何使用 AI Test Generator 的多设备协同测试功能，实现跨 Web、Android、iOS 设备的端到端自动化测试。

## 目录

1. [功能概述](#1-功能概述)
2. [快速开始](#2-快速开始)
3. [设备管理](#3-设备管理)
4. [脚本编写](#4-脚本编写)
5. [执行控制](#5-执行控制)
6. [数据共享](#6-数据共享)
7. [结果分析](#7-结果分析)
8. [API 参考](#8-api-参考)
9. [最佳实践](#9-最佳实践)

---

## 1. 功能概述

多设备协同测试提供以下核心能力：

- **多设备支持**：Web 浏览器、Android 设备、iOS 设备
- **同步协调**：同步点机制确保设备间的精确协调
- **数据共享**：跨设备变量传递和插值
- **并行执行**：最大化利用设备并行能力
- **失败隔离**：单设备失败不影响其他设备
- **可视化监控**：实时查看多设备执行状态
- **聚合报告**：生成综合测试报告（HTML/JSON/Markdown）

---

## 2. 快速开始

### 2.1 创建第一个多设备测试

最简单的多设备测试只需要两个浏览器窗口：

```yaml
name: 双设备同步测试
description: 在两个浏览器中同步执行操作
devices:
  device1:
    type: browser
    viewport: { width: 1920, height: 1080 }
    startUrl: https://example.com
  device2:
    type: browser
    viewport: { width: 375, height: 667 }
    startUrl: https://example.com
flow:
  - type: parallel
    blocks:
      - type: device
        device: device1
        steps:
          - ai: 点击登录按钮
          - ai: 输入用户名和密码
      - type: device
        device: device2
        steps:
          - ai: 打开登录页面
  - sync: both-ready
    timeout: 5000
  - type: device
    device: device1
    steps:
      - export:
          orderId: 获取订单号
  - type: device
    device: device2
    steps:
      - ai: 查看订单 ${orderId}
```

### 2.2 使用预设设备

系统提供常用设备预设，快速配置测试环境：

```typescript
import { testScenarios, createConfigsFromScenario } from './services/multiDevice';

// 使用预定义场景
const configs = createConfigsFromScenario('responsive-test');
// 自动生成：Mobile (iPhone)、Tablet (iPad)、Desktop (1920×1080)
```

### 2.3 运行测试

```typescript
import { createOrchestrator, createScriptParser } from './services/multiDevice';

// 解析脚本
const parser = createScriptParser();
const script = parser.parse(yamlContent);

// 创建协调器
const orchestrator = createOrchestrator({
  defaultTimeout: 30000,
});

// 执行测试
const result = await orchestrator.execute(script);
console.log(`测试完成，状态: ${result.success ? '成功' : '失败'}`);
```

---

## 3. 设备管理

### 3.1 设备类型

系统支持三种设备类型：

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `browser` | Web 浏览器 | 桌面 Web、移动 Web、响应式测试 |
| `android` | Android 设备 | Android App、移动端测试 |
| `ios` | iOS 设备 | iOS App、iPhone 测试 |

### 3.2 设备配置

#### 浏览器设备

```yaml
devices:
  desktop:
    type: browser
    viewport:
      width: 1920
      height: 1080
    deviceScaleFactor: 1
    userAgent: "custom-ua-string"
    startUrl: https://example.com
```

#### Android 设备

```yaml
devices:
  android-phone:
    type: android
    deviceId: emulator-5554  # ADB 设备 ID
    package: com.example.app
    activity: .MainActivity
    launch: true
```

#### iOS 设备

```yaml
devices:
  iphone:
    type: ios
    deviceId: iPhone 15 Pro
    bundleId: com.example.app
    wdaUrl: http://localhost:8100
```

### 3.3 设备预设

#### 移动设备预设

| 预设 ID | 名称 | 视口 |
|---------|------|------|
| `iphone-15-pro` | iPhone 15 Pro | 393×852 |
| `pixel-8` | Pixel 8 | 412×915 |
| `galaxy-s24` | Galaxy S24 | 360×780 |

#### 平板设备预设

| 预设 ID | 名称 | 视口 |
|---------|------|------|
| `ipad-pro-12.9` | iPad Pro 12.9" | 1024×1366 |
| `galaxy-tab-s9` | Galaxy Tab S9 | 800×1280 |

#### 桌面设备预设

| 预设 ID | 名称 | 视口 |
|---------|------|------|
| `desktop-1920` | Desktop 1920×1080 | 1920×1080 |
| `laptop-1366` | Laptop 1366×768 | 1366×768 |

### 3.4 测试场景

预定义的测试场景：

```typescript
import { testScenarios } from './services/multiDevice';

// 响应式设计测试
testScenarios.find(s => s.id === 'responsive-test');
// 设备：Mobile、Tablet、Desktop

// 跨平台移动测试
testScenarios.find(s => s.id === 'cross-platform-mobile');
// 设备：iOS、Android

// 多用户协作
testScenarios.find(s => s.id === 'multi-user-collaboration');
// 设备：Admin (Desktop)、Member (Laptop)、Mobile

// 电商用户旅程
testScenarios.find(s => s.id === 'ecommerce-flow');
// 设备：浏览 (Mobile)、结账 (Desktop)
```

---

## 4. 脚本编写

### 4.1 脚本结构

多设备测试脚本使用 YAML 格式：

```yaml
# 测试元数据
name: 测试名称
description: 测试描述
timeout: 60000  # 全局超时（毫秒）

# 设备配置
devices:
  deviceName:
    type: browser|android|ios
    # 设备特定配置...

# 全局变量
variables:
  varName: value

# 执行流程
flow:
  - # 步骤 1
  - # 步骤 2
```

### 4.2 流程步骤类型

#### device 步骤

在指定设备上执行操作：

```yaml
- type: device
  device: deviceName  # 目标设备
  continueOnError: false  # 失败是否继续
  steps:
    - ai: 使用自然语言描述操作
    - assert: 验证某个条件
    - export:
        varName: 提取数据的描述
```

#### parallel 步骤

并行执行多个操作块：

```yaml
- type: parallel
  blocks:
    - type: device
      device: device1
      steps:
        - ai: 操作 A
    - type: device
      device: device2
      steps:
        - ai: 操作 B
```

#### sync 步骤

同步点，等待所有相关设备到达：

```yaml
- sync: sync-point-name
  timeout: 5000  # 等待超时
  devices: [device1, device2]  # 可选，默认所有设备
```

#### conditional 步骤

条件执行：

```yaml
- type: conditional
  condition: ${status} == 'success'
  then:
    - type: device
      device: device1
      steps:
        - ai: 成功后的操作
  else:
    - type: device
      device: device1
      steps:
        - ai: 失败后的操作
```

### 4.3 变量插值

在脚本中使用 `${variableName}` 引用变量：

```yaml
variables:
  baseUrl: https://example.com
  username: test@example.com

flow:
  - type: device
    device: web
    steps:
      - ai: 打开 ${baseUrl}
      - ai: 输入用户名 ${username}
```

### 4.4 数据导出与引用

从一个设备导出数据，在其他设备使用：

```yaml
flow:
  - type: device
    device: web
    steps:
      - ai: 完成下单
      - export:
          orderId: 从页面获取订单号
          orderAmount: 获取订单金额

  - type: device
    device: mobile
    steps:
      - ai: 在移动端打开应用
      - ai: 查看订单 ${orderId}
      - assert: 金额为 ${orderAmount} 元
```

### 4.5 完整示例

跨平台电商购物流程：

```yaml
name: 跨平台购物流程
description: 移动端浏览商品，桌面端完成支付

devices:
  mobile:
    type: browser
    viewport: { width: 375, height: 667 }
    startUrl: https://shop.example.com
  desktop:
    type: browser
    viewport: { width: 1920, height: 1080 }
    startUrl: https://shop.example.com

variables:
  productUrl: /products/p-12345

flow:
  # 移动端浏览并加入购物车
  - type: device
    device: mobile
    steps:
      - ai: 打开商品页面 ${productUrl}
      - ai: 点击"加入购物车"
      - export:
          cartId: 获取购物车 ID

  # 同步点
  - sync: cart-ready
    timeout: 10000

  # 并行：移动端继续浏览，桌面端准备支付
  - type: parallel
    blocks:
      - type: device
        device: mobile
        steps:
          - ai: 继续浏览推荐商品
      - type: device
        device: desktop
        steps:
          - ai: 在桌面端打开购物车 ${cartId}
          - ai: 准备结算

  # 再次同步
  - sync: checkout-ready

  # 桌面端完成支付
  - type: device
    device: desktop
    steps:
      - ai: 填写收货地址
      - ai: 选择支付方式
      - ai: 确认支付
      - export:
          orderNumber: 获取订单号

  # 移动端验证订单
  - type: device
    device: mobile
    steps:
      - ai: 打开我的订单
      - assert: 显示订单 ${orderNumber}
```

---

## 5. 执行控制

### 5.1 协调器状态

协调器有以下状态：

| 状态 | 说明 |
|------|------|
| `idle` | 空闲，未执行 |
| `running` | 正在执行 |
| `paused` | 已暂停 |
| `completed` | 执行完成 |
| `failed` | 执行失败 |

### 5.2 生命周期控制

```typescript
import { createOrchestrator } from './services/multiDevice';

const orchestrator = createOrchestrator({
  defaultTimeout: 30000,
  continueOnDeviceFailure: true,  // 单设备失败是否继续
});

// 初始化
await orchestrator.initialize();

// 执行
const result = await orchestrator.execute(script);

// 暂停
await orchestrator.pause();

// 恢复
await orchestrator.resume();

// 停止
await orchestrator.stop();

// 清理
await orchestrator.cleanup();
```

### 5.3 事件监听

```typescript
// 监听状态变化
orchestrator.onStateChange((state) => {
  console.log('状态:', state);
});

// 监听进度
orchestrator.onProgress((progress) => {
  console.log('进度:', progress.currentStep, '/', progress.totalSteps);
});

// 监听设备事件
orchestrator.onDeviceEvent((event) => {
  if (event.type === 'step_complete') {
    console.log(`${event.deviceId}: ${event.data.step.instruction}`);
  }
});
```

### 5.4 同步点管理

```typescript
import { createSyncManager } from './services/multiDevice';

const syncManager = createSyncManager(5000);  // 默认超时

// 注册同步点
syncManager.registerSyncPoint(
  'checkout-sync',
  ['device-1', 'device-2'],
  10000  // 覆盖默认超时
);

// 等待同步
await syncManager.waitForSync('checkout-sync', 'device-1');

// 检查同步点状态
syncManager.isReleased('checkout-sync');  // true/false

// 获取等待中的设备
syncManager.getWaitingDevices('checkout-sync');
// ['device-2']

// 获取已到达的设备
syncManager.getArrivedDevices('checkout-sync');
// ['device-1']
```

---

## 6. 数据共享

### 6.1 DataChannel 基础

```typescript
import { createDataChannel } from './services/multiDevice';

const dataChannel = createDataChannel();

// 设置数据
dataChannel.set('orderId', 'ORD-12345', 'device-1');

// 获取数据
const orderId = dataChannel.get('orderId');  // 'ORD-12345'

// 检查存在
dataChannel.has('orderId');  // true

// 删除数据
dataChannel.delete('orderId');
```

### 6.2 变量插值

```typescript
// 简单插值
const interpolated = dataChannel.interpolate('订单 ${orderId} 已创建');
// '订单 ORD-12345 已创建'

// 多变量插值
dataChannel.set('username', 'Alice');
dataChannel.set('action', '登录');
const result = dataChannel.interpolate('${username} 完成了 ${action}');
// 'Alice 完成了 登录'

// 转换函数
dataChannel.set('price', '99.9');
const formatted = dataChannel.interpolate('价格: ${price|number}');
// '价格: 99.9'

dataChannel.set('timestamp', Date.now());
const dateStr = dataChannel.interpolate('时间: ${timestamp|date}');
// '时间: 2024-01-15 10:30:00'
```

### 6.3 数据订阅

```typescript
// 订阅特定 key 的变化
const unsubscribe = dataChannel.subscribe('orderId', (value) => {
  console.log('订单号更新:', value);
});

// 取消订阅
unsubscribe();

// 监听所有数据变化
dataChannel.addEventListener((event) => {
  console.log('数据变化:', event.key, event.value, event.source);
});
```

### 6.4 数据历史

```typescript
// 设置数据（自动记录历史）
dataChannel.set('status', 'pending', 'device-1');
dataChannel.set('status', 'processing', 'device-1');
dataChannel.set('status', 'completed', 'device-1');

// 获取历史
const history = dataChannel.getHistory('status');
// [
//   { key: 'status', value: 'pending', source: 'device-1', timestamp: ... },
//   { key: 'status', value: 'processing', source: 'device-1', timestamp: ... },
//   { key: 'status', value: 'completed', source: 'device-1', timestamp: ... }
// ]

// 获取变更记录
const change = dataChannel.getHistory('status')[2];
console.log('前值:', change.previousValue);  // 'processing'
console.log('新值:', change.value);  // 'completed'
```

---

## 7. 结果分析

### 7.1 结果聚合

```typescript
import { createResultAggregator } from './services/multiDevice';

const aggregator = createResultAggregator();

// 聚合执行结果
const aggregated = aggregator.aggregate(executionResult);

// 查看统计
console.log(aggregated.stats);
// {
//   totalSteps: 15,
//   successfulSteps: 14,
//   failedSteps: 1,
//   totalDuration: 12345,
//   deviceCount: 3,
//   syncPointCount: 2
// }

// 设备对比
console.log(aggregated.deviceComparisons);
// [
//   {
//     deviceId: 'device-1',
//     steps: 5,
//     duration: 4000,
//     success: true,
//     issues: []
//   },
//   ...
// ]

// 失败关联
console.log(aggregated.failureCorrelations);
// [
//   {
//     pattern: 'login_failed',
//     affectedDevices: ['device-1', 'device-2'],
//     steps: ['step-1', 'step-3']
//   }
// ]
```

### 7.2 报告生成

```typescript
import { createCollaborativeReportGenerator } from './services/multiDevice';

const generator = createCollaborativeReportGenerator();

// Markdown 报告
const mdReport = generator.generate(executionResult, {
  format: 'markdown',
  title: '多设备测试报告',
  includeTimeline: true,
});

// HTML 报告
const htmlReport = generator.generate(executionResult, {
  format: 'html',
  title: '多设备测试报告',
  includeTimeline: true,
  includeScreenshots: true,
});

// JSON 报告
const jsonReport = generator.generate(executionResult, {
  format: 'json',
  title: '多设备测试报告',
});

// 访问内容
console.log(mdReport.content);  // 报告字符串
console.log(mdReport.metadata);  // 元数据
```

### 7.3 报告内容

#### Markdown 报告结构

```markdown
# 多设备测试报告

## 执行摘要
- 总状态: ✅ 成功
- 总耗时: 12.3s
- 设备数: 3

## 设备结果
### device-1 (Desktop)
- 状态: ✅ 成功
- 步骤数: 5
- 耗时: 4.2s

### device-2 (Mobile)
- 状态: ✅ 成功
- 步骤数: 5
- 耗时: 4.5s

## 同步点
### sync-point-1
- 等待设备: device-1, device-2
- 耗时: 0.3s
- 状态: ✅ 成功

## 共享数据
- orderId: ORD-12345
- username: test@example.com

## 执行时间线
| 设备 | 0s | 2s | 4s | 6s |
|------|-----|-----|-----|-----|
| device-1 | Step1 | Step2 | Sync | Step3 |
| device-2 | Step1 | Sync | Step2 | Step3 |
```

---

## 8. API 参考

### 8.1 核心类型

```typescript
// 设备配置
interface DeviceConfig {
  id: string;
  alias: string;
  type: 'browser' | 'android' | 'ios';
  viewport?: { width: number; height: number };
  deviceId?: string;  // Android/iOS 设备 ID
  package?: string;   // Android 包名
  bundleId?: string;  // iOS Bundle ID
}

// 测试步骤
interface TestStep {
  instruction?: string;  // AI 自然语言指令
  assert?: string;      // 断言描述
  export?: Record<string, string>;  // 数据导出
}

// 协同脚本
interface CollaborativeScript {
  name: string;
  description?: string;
  timeout?: number;
  devices: Record<string, DeviceConfig>;
  variables?: Record<string, any>;
  flow: FlowStep[];
}

// 执行结果
interface CollaborativeExecutionResult {
  success: boolean;
  startTime: number;
  endTime: number;
  totalDuration: number;
  devices: DeviceExecutionResult[];
  syncPoints: SyncPointResult[];
  sharedData: Record<string, any>;
  errors: Array<{ device: string; error: string }>;
}
```

### 8.2 Orchestrator

```typescript
import { createOrchestrator } from './services/multiDevice';

// 创建协调器
const orchestrator = createOrchestrator(config?: OrchestratorConfig);

// 生命周期
orchestrator.initialize(): Promise<void>
orchestrator.execute(script: CollaborativeScript): Promise<CollaborativeExecutionResult>
orchestrator.pause(): Promise<void>
orchestrator.resume(): Promise<void>
orchestrator.stop(): Promise<void>
orchestrator.cleanup(): Promise<void>

// 状态查询
orchestrator.getState(): OrchestratorState
orchestrator.getStatus(): OrchestratorStatus
orchestrator.getSession(deviceId: string): DeviceSession | undefined
orchestrator.getAllSessions(): Map<string, DeviceSession>

// 数据操作
orchestrator.setSharedData(key: string, value: any): void
orchestrator.getSharedData(key: string): any

// 事件监听
orchestrator.onStateChange(callback: (state: OrchestratorState) => void): () => void
orchestrator.onProgress(callback: (progress: ProgressInfo) => void): () => void
orchestrator.onDeviceEvent(callback: (event: SessionEvent) => void): () => void
```

### 8.3 DeviceSession

```typescript
// 通用会话接口
interface DeviceSession {
  readonly id: string;
  readonly alias: string;
  readonly type: DeviceType;
  status: DeviceStatus;

  // 生命周期
  connect(): Promise<void>
  disconnect(): Promise<void>
  reconnect(): Promise<void>

  // 执行
  executeStep(step: TestStep): Promise<StepResult>

  // 数据操作
  extractData(query: string): Promise<any>
  injectData(data: Record<string, any>): void

  // 截图
  captureScreenshot(): Promise<string | undefined>

  // 事件
  addEventListener(listener: SessionEventListener): void
  removeEventListener(listener: SessionEventListener): void

  // 信息
  getInfo(): DeviceInfo
}

// 创建会话
import {
  createBrowserSession,
  createAndroidSession,
  createiOSSession
} from './services/multiDevice';

const browser = createBrowserSession({
  id: 'web-1',
  alias: 'Desktop',
  viewport: { width: 1920, height: 1080 },
});
```

### 8.4 SyncManager

```typescript
import { createSyncManager } from './services/multiDevice';

const syncManager = createSyncManager(defaultTimeout: number);

// 同步点操作
syncManager.registerSyncPoint(
  id: string,
  devices: string[],
  timeout?: number
): void

syncManager.waitForSync(
  syncPointId: string,
  deviceId: string
): Promise<void>

syncManager.release(syncPointId: string): void

// 状态查询
syncManager.getState(syncPointId: string): SyncPointState
syncManager.isReleased(syncPointId: string): boolean
syncManager.getWaitingDevices(syncPointId: string): string[]
syncManager.getArrivedDevices(syncPointId: string): string[]

// 清理
syncManager.clear(): void
```

### 8.5 DataChannel

```typescript
import { createDataChannel } from './services/multiDevice';

const dataChannel = createDataChannel();

// 基本操作
dataChannel.set(key: string, value: any, source?: string): void
dataChannel.get(key: string): any
dataChannel.has(key: string): boolean
dataChannel.delete(key: string): boolean
dataChannel.clear(): void

// 插值
dataChannel.interpolate(template: string): string

// 订阅
dataChannel.subscribe(
  key: string,
  callback: (value: any) => void
): () => void

dataChannel.addEventListener(
  listener: (event: DataChangeEvent) => void
): () => void

// 历史
dataChannel.getHistory(key?: string): ChangeRecord[]
dataChannel.clearHistory(): void
```

### 8.6 ScriptParser

```typescript
import { createScriptParser } from './services/multiDevice';

const parser = createScriptParser();

// 解析
parser.parse(yamlContent: string): ParseResult

// 验证
parser.validate(script: CollaborativeScript): ParseResult

// 类型
interface ParseResult {
  success: boolean;
  script?: CollaborativeScript;
  errors?: ParseError[];
}

interface ParseError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}
```

---

## 9. 最佳实践

### 9.1 设备选择

| 场景 | 推荐设备组合 |
|------|-------------|
| 响应式测试 | iPhone 15 Pro + iPad Pro + Desktop 1920 |
| 跨平台 App | Android (Pixel) + iOS (iPhone) |
| 多用户协作 | 3× Desktop 不同视口 |
| 电商流程 | Mobile (浏览) + Desktop (支付) |

### 9.2 同步点设计

1. **合理设置超时**：根据操作复杂度设置，默认 5000ms
2. **命名语义化**：使用 `checkout-ready` 而非 `sync-1`
3. **避免死锁**：确保所有设备都能到达同步点
4. **处理超时**：设置合理的继续策略

```yaml
# 好的同步点设计
- sync: order-created
  timeout: 10000  # 订单创建可能需要时间

- sync: payment-confirmed
  timeout: 5000   # 支付确认较快
```

### 9.3 数据共享策略

1. **明确数据流向**：数据产生者 → 消费者
2. **使用语义化命名**：`orderId` 而非 `data1`
3. **及时清理**：测试结束后清理共享数据
4. **记录历史**：便于调试数据流

```yaml
# 好的数据共享设计
flow:
  - type: device
    device: web
    steps:
      - export:
          orderId: 从订单确认页获取  # 清晰描述
          paymentId: 从支付响应获取

  - type: device
    device: mobile
    steps:
      - ai: 使用 ${orderId} 验证订单
```

### 9.4 错误处理

```typescript
// 配置失败策略
const orchestrator = createOrchestrator({
  continueOnDeviceFailure: true,  // 单设备失败继续
  maxRetries: 2,                  // 失败重试次数
  retryDelay: 1000,               // 重试延迟
});

// 监听错误
orchestrator.onDeviceEvent((event) => {
  if (event.type === 'step_failed') {
    console.error(`${event.deviceId} 失败:`, event.data.error);
    // 记录到日志系统
    logError(event.deviceId, event.data.error);
  }
});
```

### 9.5 性能优化

```typescript
import {
  createScreenshotCompressor,
  createMessageBatcher,
  createMemoryPool
} from './services/multiDevice';

// 截图压缩
const compressor = createScreenshotCompressor({
  quality: 0.75,
  maxWidth: 1920,
  maxHeight: 1080,
});

// 消息批量发送
const batcher = createMessageBatcher({
  maxBatchSize: 10,
  maxWaitTime: 100,
  maxSize: 1024 * 1024,
});

// 内存池管理
const pool = createMemoryPool(
  50 * 1024 * 1024,  // 最大 50MB
  5 * 60 * 1000      // 5 分钟过期
);
```

### 9.6 调试技巧

1. **使用日志记录**：记录每个步骤的开始和结束
2. **截图保存**：关键步骤保存截图
3. **状态导出**：定期导出 DataChannel 状态
4. **单设备测试**：先单独测试每个设备
5. **逐步集成**：从 2 设备开始，逐步增加

```yaml
# 调试友好的脚本
flow:
  - type: device
    device: web
    steps:
      - ai: 打开页面  # 基础步骤
      - ai: 点击登录  # 关键交互
      - assert: 看到登录成功提示  # 验证点
      - export:
          sessionToken: 获取会话令牌  # 数据导出点
```

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2024-01 | 初始版本，支持 Web/Android/iOS 多设备协同 |

---

## 相关文档

- [需求规格说明书](../../../.spec-workflow/specs/multi-device/requirements.md)
- [设计文档](../../../.spec-workflow/specs/multi-device/design.md)
- [开发任务](../../../.spec-workflow/specs/multi-device/tasks.md)
