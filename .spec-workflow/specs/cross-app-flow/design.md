# 跨应用自动化 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**统一接口，平台适配**
- 提供一致的 API 抽象
- 通过适配器模式支持多平台
- 支持灵活的编排和协调

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| 执行引擎 | 扩展为编排引擎 |
| 变量存储 | 扩展跨应用作用域 |
| AI 定位 | 复用于各平台 |
| 报告生成 | 支持多应用视图 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Cross-App Automation System                  │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │ OrchestrationEngine│   │  AppRegistry     │              │
│  │   (编排引擎)      │────▶│   (应用注册表)   │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  ContextManager  │     │  DataBridge      │              │
│  │   (上下文管理)    │◀───▶│   (数据桥接)     │              │
│  └────────┬─────────┘     └──────────────────┘              │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────┐               │
│  │            Platform Adapters             │               │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │               │
│  │  │ Web  │  │Mobile│  │Desktop│ │ H5   │ │               │
│  │  └──────┘  └──────┘  └──────┘  └──────┘ │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **OrchestrationEngine** | 协调多应用执行流程 |
| **AppRegistry** | 管理应用配置和状态 |
| **ContextManager** | 管理跨应用执行上下文 |
| **DataBridge** | 处理跨应用数据传递 |
| **PlatformAdapters** | 各平台的具体实现 |

---

## 3. 核心数据结构

### 3.1 应用定义

```typescript
interface AppDefinition {
  id: string;
  name: string;
  platform: Platform;
  config: PlatformConfig;
  status: AppStatus;
  capabilities: Capability[];
}

type Platform = 'web' | 'android' | 'ios' | 'windows' | 'macos' | 'h5';

type AppStatus = 'not_started' | 'starting' | 'running' | 'suspended' | 'stopped';

interface PlatformConfig {
  // Web 配置
  web?: {
    url: string;
    browser: 'chrome' | 'firefox' | 'edge';
    headless?: boolean;
  };

  // 移动端配置
  mobile?: {
    appId: string;
    deviceId?: string;
    platform: 'android' | 'ios';
  };

  // 桌面端配置
  desktop?: {
    appPath: string;
    arguments?: string[];
  };
}

type Capability =
  | 'screenshot'
  | 'gesture'
  | 'keyboard'
  | 'clipboard'
  | 'file_access'
  | 'notification';
```

### 3.2 编排流程

```typescript
interface OrchestrationFlow {
  id: string;
  name: string;
  apps: AppDefinition[];
  phases: Phase[];
  variables: GlobalVariables;
  errorHandlers: ErrorHandler[];
}

interface Phase {
  id: string;
  name: string;
  targetApp: string;           // 目标应用 ID
  steps: Step[];
  syncPoints: SyncPoint[];
}

interface SyncPoint {
  id: string;
  type: 'wait_all' | 'wait_any' | 'barrier';
  timeout: number;
  participants: string[];      // 参与的应用 ID
}

interface GlobalVariables {
  shared: Record<string, any>; // 全局共享变量
  perApp: Record<string, Record<string, any>>; // 各应用独立变量
}
```

### 3.3 上下文管理

```typescript
interface CrossAppContext {
  currentApp: string;
  appContexts: Map<string, AppContext>;
  sharedVariables: Map<string, any>;
  executionStack: ExecutionFrame[];
}

interface AppContext {
  appId: string;
  adapter: PlatformAdapter;
  localVariables: Map<string, any>;
  state: AppState;
}

interface AppState {
  isActive: boolean;
  lastActiveAt: number;
  screenshot?: string;
  error?: Error;
}
```

### 3.4 数据桥接

```typescript
interface DataBridge {
  transferData(
    sourceApp: string,
    targetApp: string,
    data: TransferData
  ): Promise<void>;

  getSharedData(key: string): any;
  setSharedData(key: string, value: any): void;
}

interface TransferData {
  type: 'variable' | 'clipboard' | 'file';
  key: string;
  value: any;
  format?: string;
}
```

---

## 4. 核心流程

### 4.1 应用切换流程

```
切换应用请求
      │
      ▼
┌─────────────────────────┐
│ 1. 保存当前应用状态     │
│    - 截图               │
│    - 变量               │
│    - 位置               │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 检查目标应用状态     │
│    - 是否已启动         │
│    - 是否可访问         │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │需要启动？│
       └────┬────┘
       是   │   否
       │    │    │
       ▼    │    ▼
┌─────────┐ │  ┌─────────┐
│启动应用 │ │  │激活应用 │
└────┬────┘ │  └────┬────┘
     │      │       │
     └──────┴───────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 恢复应用上下文       │
│    - 恢复变量           │
│    - 验证状态           │
└───────────┬─────────────┘
            │
            ▼
   更新当前应用指针
```

### 4.2 变量传递流程

```
变量传递请求
      │
      ▼
┌─────────────────────────┐
│ 1. 确定传递方式         │
│    - 内存传递           │
│    - 剪贴板传递         │
│    - 文件传递           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 数据格式转换         │
│    - 序列化             │
│    - 类型转换           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 写入目标应用         │
│    - 更新变量存储       │
│    - 触发更新事件       │
└───────────┬─────────────┘
            │
            ▼
   验证传递成功
```

### 4.3 并行执行流程

```
并行任务列表
      │
      ▼
┌─────────────────────────┐
│ 1. 初始化并行上下文     │
│    - 创建子上下文       │
│    - 分配资源           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 并行启动任务         │
│    ├── 任务A            │
│    ├── 任务B            │
│    └── 任务C            │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 同步等待             │
│    - 等待所有完成       │
│    - 或等待首个完成     │
│    - 或超时             │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 合并结果             │
│    - 收集各任务结果     │
│    - 合并变量           │
└───────────┬─────────────┘
            │
            ▼
   返回并行执行结果
```

---

## 5. 平台适配器

### 5.1 适配器接口

```typescript
interface PlatformAdapter {
  // 生命周期
  launch(config: PlatformConfig): Promise<void>;
  activate(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;

  // 基础操作
  screenshot(): Promise<string>;
  click(target: string): Promise<void>;
  type(target: string, text: string): Promise<void>;
  scroll(direction: Direction, amount: number): Promise<void>;

  // 状态查询
  isRunning(): boolean;
  getState(): AppState;

  // 平台特定操作
  executeNative(action: NativeAction): Promise<any>;
}
```

### 5.2 Web 适配器

```typescript
class WebAdapter implements PlatformAdapter {
  private browser: Browser;
  private page: Page;

  async launch(config: PlatformConfig): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: config.web?.headless,
    });
    this.page = await this.browser.newPage();
    await this.page.goto(config.web!.url);
  }

  async click(target: string): Promise<void> {
    // 使用 AI 定位
    const element = await this.locate(target);
    await element.click();
  }

  // ... 其他方法实现
}
```

### 5.3 移动适配器

```typescript
class MobileAdapter implements PlatformAdapter {
  private driver: AppiumDriver;

  async launch(config: PlatformConfig): Promise<void> {
    this.driver = await createAppiumDriver({
      platformName: config.mobile!.platform,
      app: config.mobile!.appId,
      udid: config.mobile!.deviceId,
    });
  }

  async executeNative(action: NativeAction): Promise<any> {
    switch (action.type) {
      case 'swipe':
        return this.driver.swipe(action.params);
      case 'permission':
        return this.handlePermission(action.params);
      // ...
    }
  }
}
```

---

## 6. API 设计

### 6.1 OrchestrationEngine

```typescript
interface IOrchestrationEngine {
  execute(flow: OrchestrationFlow): Promise<FlowResult>;

  switchApp(appId: string): Promise<void>;

  getCurrentApp(): string;

  pauseExecution(): Promise<void>;

  resumeExecution(): Promise<void>;

  abortExecution(): Promise<void>;
}
```

### 6.2 AppRegistry

```typescript
interface IAppRegistry {
  register(app: AppDefinition): Promise<void>;

  unregister(appId: string): Promise<void>;

  get(appId: string): AppDefinition | undefined;

  list(): AppDefinition[];

  updateStatus(appId: string, status: AppStatus): Promise<void>;
}
```

### 6.3 ContextManager

```typescript
interface IContextManager {
  createContext(flow: OrchestrationFlow): CrossAppContext;

  switchContext(appId: string): Promise<void>;

  getVariable(name: string, scope?: string): any;

  setVariable(name: string, value: any, scope?: string): void;

  saveSnapshot(): Promise<ContextSnapshot>;

  restoreSnapshot(snapshot: ContextSnapshot): Promise<void>;
}
```

---

## 7. 集成方案

### 7.1 语法扩展

```markdown
## 跨应用测试示例

### 配置应用
```yaml
apps:
  - id: mobile-app
    platform: android
    config:
      appId: com.example.shop
  - id: web-admin
    platform: web
    config:
      url: https://admin.example.com
```

### 测试步骤
- 切换到 [mobile-app]
- 点击 "添加商品"
- 获取 [商品ID] 保存到 $productId

- 切换到 [web-admin]
- 搜索商品 $productId
- 验证商品状态为 "待审核"
```

### 7.2 与现有执行引擎集成

```typescript
class CrossAppExecutionEngine extends ExecutionEngine {
  private orchestrator: OrchestrationEngine;
  private registry: AppRegistry;

  async executeStep(step: Step): Promise<void> {
    if (step.type === 'switch_app') {
      await this.orchestrator.switchApp(step.targetApp);
    } else {
      // 使用当前应用的适配器执行
      const adapter = this.getCurrentAdapter();
      await super.executeStep(step, adapter);
    }
  }
}
```

---

## 8. 错误恢复

### 8.1 恢复策略

```typescript
interface RecoveryStrategy {
  type: 'restart' | 'reconnect' | 'skip' | 'abort';
  maxRetries: number;
  backoffMs: number;
  conditions: RecoveryCondition[];
}

interface RecoveryCondition {
  errorType: string;
  strategy: RecoveryStrategy;
}
```

### 8.2 自动恢复

```typescript
async function executeWithRecovery(
  step: Step,
  strategy: RecoveryStrategy
): Promise<StepResult> {
  for (let attempt = 0; attempt <= strategy.maxRetries; attempt++) {
    try {
      return await executeStep(step);
    } catch (error) {
      if (!isRecoverable(error, strategy)) {
        throw error;
      }

      await performRecovery(strategy.type);
      await sleep(strategy.backoffMs * Math.pow(2, attempt));
    }
  }

  throw new MaxRetriesError();
}
```

---

## 9. 优势总结

1. **统一接口**：一致的 API 跨多平台使用
2. **灵活编排**：支持串行和并行执行模式
3. **数据共享**：变量可在应用间无缝传递
4. **智能恢复**：自动处理应用切换和错误恢复
5. **可扩展性**：易于添加新平台支持
