# 执行过程可视化 - 用户手册

## 功能概述

执行过程可视化功能为 AI Test Generator 提供了实时视觉反馈和自动截图记录能力。通过元素高亮和截图保存，用户可以清晰了解测试执行过程，便于调试和问题定位。

### 核心能力

- **实时元素高亮**：执行过程中自动高亮当前操作的元素
- **状态视觉反馈**：成功（绿色）、失败（红色）不同颜色区分
- **自动截图保存**：每个步骤执行完成后自动保存截图
- **敏感信息遮蔽**：自动遮蔽密码、邮箱等敏感信息
- **历史记录管理**：基于 IndexedDB 的持久化存储
- **压缩与缩略图**：自动压缩图片，生成缩略图节省空间

## 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│              Execution Visualization System                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 ExecutionEngine                      │   │
│  │                                                      │   │
│  │  ┌──────────────┐    ┌──────────────┐              │   │
│  │  │ Step Start   │───▶│ aiAct()      │              │   │
│  │  └──────────────┘    └──────┬───────┘              │   │
│  │                              │                        │   │
│  │                              ▼                        │   │
│  │                    ┌─────────────────┐              │   │
│  │                    │ Element Info    │              │   │
│  │                    │ Extraction      │              │   │
│  │                    └────────┬────────┘              │   │
│  │                             │                        │   │
│  │         ┌───────────────────┴───────────────────┐  │   │
│  │         ▼                                       ▼  │   │
│  │  ┌─────────────────┐                    ┌───────────┐ │   │
│  │  │ Highlight       │                    │ Screenshot│ │   │
│  │  │ Manager         │                    │ Storage   │ │   │
│  │  │                 │                    │           │ │   │
│  │  │ • Highlight     │                    │ • Capture │ │   │
│  │  │   Current       │                    │ • Mask    │ │   │
│  │  │ • Mark Success  │                    │ • Compress│ │   │
│  │  │ • Mark Failed   │                    │ • Store   │ │   │
│  │  └─────────────────┘                    └───────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Page Context (Content Script)           │   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  Highlight Overlay (z-index: 2147483645)    │    │   │
│  │  │  • Pulse Animation                          │    │   │
│  │  │  • Color-coded feedback                     │    │   │
│  │  │  • Auto-remove after duration               │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

### 启用功能

执行过程可视化功能默认启用。如需配置：

```typescript
import { ExecutionEngine } from './services/executionEngine';

const engine = new ExecutionEngine(getAgent);

// 启用/禁用元素高亮
engine.setHighlightingEnabled(true);

// 启用/禁用截图保存
engine.setScreenshotStorageEnabled(true);
```

### 执行测试

```typescript
const result = await engine.executeTestCase(testCase, {
  url: 'https://example.com',
});
```

执行过程中会自动：
1. 高亮当前操作的元素（蓝色边框 + 脉冲动画）
2. 步骤成功后显示绿色高亮，1秒后淡出
3. 步骤失败后显示红色高亮 + 抖动动画
4. 保存执行截图到 IndexedDB

## 执行过程元素高亮

### 高亮类型

| 类型 | 颜色 | 说明 | 动画 |
|------|------|------|------|
| `current` | 蓝色 #1890ff | 当前正在操作的元素 | 脉冲 |
| `success` | 绿色 #52c41a | 操作成功 | 淡出 |
| `failed` | 红色 #ff4d4f | 操作失败 | 抖动 |
| `pending` | 黄色 #faad14 | 等待中（预留） | 脉冲 |

### 高亮生命周期

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ aiAct()  │────▶│ Extract  │────▶│ Highlight │────▶│ Mark     │
│ Start    │     │ Element  │     │ Current  │     │ Result   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                          │              │
                                          ▼              ▼
                                   ┌─────────────┐ ┌─────────────┐
                                   │ Blue Border │ │ Green/Red   │
                                   │ + Pulse     │ │ + Fade/     │
                                   │             │ │ Shake       │
                                   └─────────────┘ └─────────────┘
```

### 配置选项

```typescript
import { getHighlightManager } from './services/executionHighlightManager';

const highlighter = getHighlightManager();

// 配置高亮行为
highlighter.setConfig({
  enabled: true,              // 是否启用
  autoRemoveDuration: 2000,   // 自动移除时间（毫秒）
  showSuccessHighlights: true,// 显示成功高亮
  showFailedHighlights: true, // 显示失败高亮
});
```

### 高亮 API

```typescript
import { getHighlightManager } from './services/executionHighlightManager';

const highlighter = getHighlightManager();

// 初始化高亮器（注入到页面）
await highlighter.initialize();

// 高亮当前元素
await highlighter.highlightCurrent({
  x: 100,
  y: 200,
  width: 150,
  height: 50,
});

// 标记为成功
await highlighter.markAsSuccess();

// 标记为失败
await highlighter.markAsFailed();

// 清除所有高亮
await highlighter.clearAll();

// 清理（移除注入的脚本）
await highlighter.cleanup();
```

## 执行截图保存

### 存储机制

截图存储使用 IndexedDB 进行持久化：

```
┌─────────────────────────────────────────────────────────────┐
│                    ScreenshotStorage                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              IndexedDB Database                      │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │ Screenshots │  │ Thumbnails │  │ Metadata   │    │   │
│  │  │ Store       │  │ Store      │  │ Store      │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  功能：                                                      │
│  • 自动压缩（质量 0.8）                                     │
│  • 缩略图生成（宽度 200px）                                 │
│  • 过期清理（默认 7 天）                                    │
│  • 存储配额管理                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 截图元数据

```typescript
interface ScreenshotMetadata {
  testCaseId?: string;      // 测试用例 ID
  stepId: string;           // 步骤 ID
  stepIndex: number;        // 步骤索引
  stepDescription: string;  // 步骤描述
  status: 'success' | 'failed'; // 执行状态
  timestamp: number;        // 时间戳
  errorMessage?: string;    // 错误信息（失败时）
  masked: boolean;          // 是否已遮蔽敏感信息
}
```

### 保存时机

| 时机 | 说明 |
|------|------|
| 步骤成功后 | `aiAct()` 成功执行后立即截图 |
| 步骤失败后 | 捕获失败现场，便于调试 |
| 自定义截图 | 可通过 `takeScreenshot()` 手动触发 |

### 敏感信息遮蔽

截图会自动遮蔽以下敏感区域：

| 选择器 | 类型 | 说明 |
|--------|------|------|
| `input[type="password"]` | 模糊 | 密码输入框 |
| `input[type="email"]` | 模糊 | 邮箱输入框 |
| `input[type="tel"]` | 模糊 | 电话输入框 |
| `input[autocomplete="cc-number"]` | 模糊 | 信用卡号 |
| `input[name*="password"]` | 模糊 | 密码相关字段 |
| `input[name*="token"]` | 模糊 | Token 相关字段 |

### 存储管理 API

```typescript
import { screenshotStorage } from './services/screenshotStorage';

// 存储截图
await screenshotStorage.store(base64Image, {
  testCaseId: 'case-123',
  stepId: 'step-1',
  stepIndex: 0,
  stepDescription: '点击登录按钮',
  status: 'success',
});

// 查询截图
const screenshots = await screenshotStorage.query({
  testCaseId: 'case-123',
  startDate: Date.now() - 24 * 60 * 60 * 1000,
});

// 获取截图
const screenshot = await screenshotStorage.get('screenshot-id');

// 删除截图
await screenshotStorage.delete('screenshot-id');

// 清理过期截图
await screenshotStorage.cleanup();

// 获取存储统计
const stats = await screenshotStorage.getStats();
console.log(stats);
// {
//   totalCount: 150,
//   totalSize: 52428800,  // 字节
//   oldestTimestamp: 1234567890,
//   newestTimestamp: 1234567890,
// }
```

## API 参考

### ExecutionEngine

```typescript
class ExecutionEngine {
  /**
   * 启用/禁用元素高亮
   */
  setHighlightingEnabled(enabled: boolean): void;

  /**
   * 检查高亮是否启用
   */
  isHighlightingEnabled(): boolean;

  /**
   * 启用/禁用截图保存
   */
  setScreenshotStorageEnabled(enabled: boolean): void;

  /**
   * 检查截图保存是否启用
   */
  isScreenshotStorageEnabled(): boolean;

  /**
   * 执行测试用例
   */
  async executeTestCase(
    testCase: TestCase,
    context?: ExecutionContext
  ): Promise<ExecutionResult>;
}
```

### ExecutionHighlightManager

```typescript
class ExecutionHighlightManager {
  /**
   * 初始化高亮器
   */
  async initialize(): Promise<boolean>;

  /**
   * 高亮当前元素
   */
  async highlightCurrent(rect: HighlightRect): Promise<void>;

  /**
   * 标记为成功
   */
  async markAsSuccess(): Promise<void>;

  /**
   * 标记为失败
   */
  async markAsFailed(): Promise<void>;

  /**
   * 清除所有高亮
   */
  async clearAll(): Promise<void>;

  /**
   * 清理
   */
  async cleanup(): Promise<void>;

  /**
   * 设置配置
   */
  setConfig(config: Partial<HighlightManagerConfig>): void;

  /**
   * 获取配置
   */
  getConfig(): HighlightManagerConfig;
}

interface HighlightManagerConfig {
  enabled: boolean;
  autoRemoveDuration: number;
  showSuccessHighlights: boolean;
  showFailedHighlights: boolean;
}
```

### ScreenshotStorage

```typescript
class ScreenshotStorage {
  /**
   * 存储截图
   */
  async store(
    base64Image: string,
    metadata: ScreenshotMetadata
  ): Promise<string>;

  /**
   * 获取截图
   */
  async get(id: string): Promise<ScreenshotEntry | null>;

  /**
   * 查询截图
   */
  async query(options: QueryOptions): Promise<ScreenshotEntry[]>;

  /**
   * 删除截图
   */
  async delete(id: string): Promise<boolean>;

  /**
   * 批量删除
   */
  async batchDelete(ids: string[]): Promise<number>;

  /**
   * 清理过期截图
   */
  async cleanup(options?: CleanupOptions): Promise<number>;

  /**
   * 获取存储统计
   */
  async getStats(): Promise<StorageStats>;
}
```

## 最佳实践

### 1. 调试时启用详细反馈

在调试测试用例时，确保启用所有可视化功能：

```typescript
engine.setHighlightingEnabled(true);
engine.setScreenshotStorageEnabled(true);
```

### 2. 定期清理截图

避免截图累积占用过多存储空间：

```typescript
// 清理 7 天前的截图
await screenshotStorage.cleanup({
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

// 或保留最近 N 条
await screenshotStorage.cleanup({
  keepLatest: 100,
});
```

### 3. 使用截图分析失败

测试失败时，查看截图可以快速定位问题：

```typescript
const failedScreenshots = await screenshotStorage.query({
  status: 'failed',
  startDate: Date.now() - 24 * 60 * 60 * 1000,
});

// 分析失败截图
failedScreenshots.forEach(screenshot => {
  console.log('失败步骤:', screenshot.stepDescription);
  console.log('错误信息:', screenshot.errorMessage);
  // 显示截图或进行分析
});
```

### 4. 调整高亮持续时间

根据测试执行速度调整高亮显示时间：

```typescript
// 快速执行：缩短显示时间
highlighter.setConfig({ autoRemoveDuration: 500 });

// 慢速执行：延长显示时间
highlighter.setConfig({ autoRemoveDuration: 5000 });
```

### 5. 配置存储策略

根据项目需求配置截图存储：

```typescript
// 仅保留失败截图
const storeFilter = (metadata: ScreenshotMetadata) => {
  return metadata.status === 'failed';
};

// 或按重要性保留
const storeFilter = (metadata: ScreenshotMetadata) => {
  return metadata.stepDescription.includes('支付') ||
         metadata.stepDescription.includes('登录');
};
```

## 常见问题

### Q: 高亮不显示怎么办？

A: 检查以下几点：
1. 确认 `setHighlightingEnabled(true)` 已调用
2. 检查页面是否有更高 z-index 的元素遮挡
3. 确认扩展在当前标签页有权限
4. 查看控制台是否有错误信息

### Q: 截图模糊怎么办？

A: 可能是设备像素比（DPR）问题：
1. 检查 `deviceScaleFactor` 设置是否正确
2. 调整截图质量参数
3. 确认页面缩放比例为 100%

### Q: 存储空间不足怎么办？

A: 使用清理策略：
```typescript
// 激进清理：仅保留失败截图
await screenshotStorage.cleanup({ maxAge: 1 * 24 * 60 * 60 * 1000 });
await screenshotStorage.batchDelete(
  (await screenshotStorage.query({ status: 'success' }))
    .map(s => s.id)
);

// 或使用配额限制
await screenshotStorage.setQuota({
  maxSize: 50 * 1024 * 1024, // 50MB
  strategy: 'fifo', // 先入先出
});
```

### Q: 如何导出截图？

A: 使用查询和下载：
```typescript
const screenshots = await screenshotStorage.query({
  testCaseId: 'case-123',
});

screenshots.forEach(screenshot => {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${screenshot.data}`;
  link.download = `${screenshot.stepDescription}.png`;
  link.click();
});
```

### Q: 敏感信息没有被遮蔽？

A: 检查：
1. 确认遮蔽配置已启用：`maskerEngine.setConfig({ enabled: true })`
2. 检查元素选择器是否匹配
3. 自定义遮蔽规则：
```typescript
maskerEngine.addCustomRule({
  selector: '.sensitive-field',
  type: 'blur',
  category: 'custom',
});
```

## 更新日志

### v1.0.0 (2025-01)

- 初始版本发布
- 实时元素高亮：当前操作高亮、成功/失败状态反馈
- 自动截图保存：每步执行后截图、元数据记录
- 敏感信息遮蔽：自动识别和遮蔽敏感字段
- 存储管理：IndexedDB 持久化、压缩、缩略图
- 清理策略：过期清理、配额管理
