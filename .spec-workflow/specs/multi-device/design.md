# 多设备协同测试 技术方案设计文档

## 1. 项目背景与目标

现代应用常涉及多端交互场景，传统单设备测试无法覆盖完整业务流程。本模块通过设备协调器和数据通道，实现跨 Web/Android/iOS 的端到端测试能力。

## 2. 系统架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Device Testing                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Orchestrator                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐          │   │
│  │  │   Script   │  │    Sync    │  │    Data    │          │   │
│  │  │   Parser   │  │  Manager   │  │  Channel   │          │   │
│  │  └────────────┘  └────────────┘  └────────────┘          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Browser    │  │   Android    │  │     iOS      │          │
│  │   Session    │  │   Session    │  │   Session    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Midscene    │  │  Midscene    │  │  Midscene    │          │
│  │  Web Agent   │  │ Android Agent│  │  iOS Agent   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 通信架构

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │◄───────►│ Orchestrator│◄───────►│   Android   │
│   Session   │  Event  │             │  Event  │   Session   │
└─────────────┘  Bus    └──────┬──────┘  Bus    └─────────────┘
                               │
                               │ WebSocket
                               ▼
                        ┌─────────────┐
                        │     iOS     │
                        │   Session   │
                        └─────────────┘
```

### 2.3 技术栈选型

* **协调器**: Node.js / Service Worker
* **设备会话**: Midscene.js 各平台适配器
* **通信**: BroadcastChannel (本地) / WebSocket (远程)
* **脚本解析**: YAML.js + 自定义扩展

---

## 3. 核心模块设计

### 3.1 协调器 (Orchestrator)

```typescript
interface Orchestrator {
  // 初始化设备会话
  initializeSessions(config: DeviceConfig[]): Promise<void>;

  // 执行协同脚本
  execute(script: CollaborativeScript): Promise<ExecutionResult>;

  // 获取执行状态
  getStatus(): OrchestratorStatus;

  // 控制执行
  pause(): void;
  resume(): void;
  stop(): void;
}

interface OrchestratorStatus {
  state: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  devices: DeviceStatus[];
  currentSyncPoint?: string;
  sharedData: Record<string, any>;
  timeline: TimelineEvent[];
}
```

### 3.2 设备会话 (Device Session)

```typescript
interface DeviceSession {
  id: string;
  alias: string;
  type: 'browser' | 'android' | 'ios' | 'remote';
  status: 'connecting' | 'ready' | 'busy' | 'error' | 'disconnected';

  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;

  // 执行操作
  executeStep(step: TestStep): Promise<StepResult>;

  // 数据操作
  extractData(query: string): Promise<any>;
  injectData(data: Record<string, any>): void;

  // 截图
  captureScreenshot(): Promise<Uint8Array>;
}

class BrowserSession implements DeviceSession {
  private midscene: MidsceneAgent;

  async executeStep(step: TestStep): Promise<StepResult> {
    return await this.midscene.aiAction(step.instruction);
  }

  async extractData(query: string): Promise<any> {
    return await this.midscene.aiQuery(query);
  }
}

class AndroidSession implements DeviceSession {
  private midscene: AndroidAgent;
  private deviceId: string;

  async connect(): Promise<void> {
    await this.midscene.connect(this.deviceId);
  }
}
```

### 3.3 同步管理器 (Sync Manager)

```typescript
class SyncManager {
  private syncPoints: Map<string, SyncPointState> = new Map();
  private waitingDevices: Map<string, Set<string>> = new Map();

  async waitForSync(
    syncPointId: string,
    deviceId: string,
    timeout: number = 60000
  ): Promise<void> {
    // 注册等待
    if (!this.waitingDevices.has(syncPointId)) {
      this.waitingDevices.set(syncPointId, new Set());
    }
    this.waitingDevices.get(syncPointId)!.add(deviceId);

    // 检查是否所有设备都已到达
    const expectedDevices = this.syncPoints.get(syncPointId)!.expectedDevices;
    const waitingSet = this.waitingDevices.get(syncPointId)!;

    if (this.allDevicesReached(expectedDevices, waitingSet)) {
      // 释放所有等待的设备
      this.releaseSyncPoint(syncPointId);
      return;
    }

    // 等待其他设备
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Sync point ${syncPointId} timeout`));
      }, timeout);

      this.once(`sync:${syncPointId}:released`, () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private releaseSyncPoint(syncPointId: string): void {
    this.emit(`sync:${syncPointId}:released`);
    this.waitingDevices.delete(syncPointId);
  }
}
```

### 3.4 数据通道 (Data Channel)

```typescript
class DataChannel {
  private sharedData: Map<string, any> = new Map();
  private subscribers: Map<string, Set<(value: any) => void>> = new Map();

  // 设置共享数据
  set(key: string, value: any): void {
    this.sharedData.set(key, value);

    // 通知订阅者
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach(callback => callback(value));
    }

    // 广播到其他设备
    this.broadcast({ type: 'data_update', key, value });
  }

  // 获取共享数据
  get(key: string): any {
    return this.sharedData.get(key);
  }

  // 变量插值
  interpolate(template: string): string {
    return template.replace(/\$\{(\w+)(?:\s*\|\s*(\w+)(?::'([^']*)')?)?\}/g,
      (match, key, transformer, arg) => {
        let value = this.get(key);

        if (transformer) {
          value = this.transform(value, transformer, arg);
        }

        return value ?? match;
      }
    );
  }

  private transform(value: any, transformer: string, arg?: string): any {
    switch (transformer) {
      case 'trim':
        return String(value).trim();
      case 'number':
        return Number(value);
      case 'format':
        return this.formatDate(value, arg);
      default:
        return value;
    }
  }
}
```

### 3.5 脚本执行引擎

```typescript
class CollaborativeExecutor {
  private orchestrator: Orchestrator;
  private syncManager: SyncManager;
  private dataChannel: DataChannel;

  async execute(script: CollaborativeScript): Promise<ExecutionResult> {
    // 1. 初始化设备
    await this.initializeDevices(script.devices);

    // 2. 解析执行计划
    const plan = this.parseExecutionPlan(script.flow);

    // 3. 执行
    for (const step of plan) {
      if (step.type === 'device_step') {
        await this.executeDeviceStep(step);
      } else if (step.type === 'sync') {
        await this.handleSync(step);
      } else if (step.type === 'parallel') {
        await this.executeParallel(step.steps);
      }
    }

    return this.collectResults();
  }

  private async executeDeviceStep(step: DeviceStep): Promise<void> {
    const session = this.getSession(step.device);

    // 变量插值
    const instruction = this.dataChannel.interpolate(step.instruction);

    // 执行
    const result = await session.executeStep({ instruction });

    // 数据导出
    if (step.export) {
      for (const [key, query] of Object.entries(step.export)) {
        const value = await session.extractData(query);
        this.dataChannel.set(key, value);
      }
    }
  }

  private async executeParallel(steps: DeviceStep[]): Promise<void> {
    await Promise.all(steps.map(step => this.executeDeviceStep(step)));
  }

  private async handleSync(step: SyncStep): Promise<void> {
    // 所有当前活跃设备等待同步
    const activeDevices = this.getActiveDevices();
    await Promise.all(
      activeDevices.map(d =>
        this.syncManager.waitForSync(step.id, d.id)
      )
    );
  }
}
```

---

## 4. YAML 脚本扩展语法

```yaml
# 完整示例
name: "跨端订单流程测试"
description: "验证 Web 下单 -> 移动端查看 -> 后台审核流程"

devices:
  customer_web:
    type: browser
    viewport: { width: 1920, height: 1080 }
    startUrl: "https://shop.example.com"

  customer_mobile:
    type: android
    device: "emulator-5554"
    package: "com.example.shop"

  admin_web:
    type: browser
    viewport: { width: 1440, height: 900 }
    startUrl: "https://admin.example.com"

variables:
  testUser: "test@example.com"
  testPassword: "Test123456"

flow:
  # 阶段1: Web 端下单
  - name: "Web端登录并下单"
    device: customer_web
    steps:
      - ai: "点击登录按钮"
      - ai: "输入邮箱 ${testUser}"
      - ai: "输入密码 ${testPassword}"
      - ai: "点击提交登录"
      - assert: "登录成功"
      - ai: "搜索 'iPhone 15'"
      - ai: "点击第一个商品"
      - ai: "点击加入购物车"
      - ai: "前往结算"
      - ai: "选择货到付款"
      - ai: "点击提交订单"
      - export:
          orderId: "获取订单编号"
          totalAmount: "获取订单金额"

  - sync: "order_created"

  # 阶段2: 移动端验证 (与后台并行)
  - name: "移动端查看订单"
    device: customer_mobile
    steps:
      - ai: "点击我的订单"
      - ai: "找到订单 ${orderId}"
      - assert: "订单金额为 ${totalAmount}"
      - assert: "订单状态为待审核"

  # 阶段2: 后台审核 (并行)
  - name: "后台审核订单"
    device: admin_web
    parallel: true
    steps:
      - ai: "输入管理员账号登录"
      - ai: "进入订单管理"
      - ai: "搜索订单 ${orderId}"
      - ai: "点击审核通过"
      - assert: "审核成功提示出现"

  - sync: "order_approved"

  # 阶段3: 验证最终状态
  - name: "验证订单状态更新"
    device: customer_mobile
    steps:
      - ai: "下拉刷新页面"
      - assert: "订单 ${orderId} 状态为已审核"
```

---

## 5. 监控 UI 设计

```
┌────────────────────────────────────────────────────────────────┐
│  🔗 多设备协同测试                                    [暂停] [停止] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │ customer_web│   │customer_mobile│  │  admin_web  │          │
│  │    🟢 执行中 │   │    ⏸️ 等待同步 │   │    🟢 执行中 │          │
│  │             │   │              │   │             │          │
│  │ [截图预览]  │   │  [截图预览]   │   │ [截图预览]  │          │
│  │             │   │              │   │             │          │
│  │ 步骤 5/8    │   │  步骤 2/4    │   │  步骤 3/5   │          │
│  └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                │
│  ── 时间线 ──────────────────────────────────────────────────  │
│  │                                                            │
│  │  web ●────●────●────●═══════════════●                      │
│  │  mobile      ●════════════●────●                           │
│  │  admin            ●────●────●                              │
│  │        ↑         ↑              ↑                          │
│  │      开始    sync:order     sync:approved                  │
│  │                                                            │
│  ── 共享数据 ────────────────────────────────────────────────  │
│  │  orderId: "ORD-2024-001234"                                │
│  │  totalAmount: "¥6,999.00"                                  │
│  │                                                            │
└────────────────────────────────────────────────────────────────┘
```

---

## 6. 实施计划

1. **Week 1**: 协调器核心，设备会话抽象
2. **Week 2**: 同步管理器，数据通道
3. **Week 3**: YAML 扩展解析，执行引擎
4. **Week 4**: 监控 UI，报告聚合，测试
