# 执行过程元素高亮 - 用户手册

## 功能概述

执行过程元素高亮功能为 AI Test Generator 提供实时视觉反馈，在测试执行过程中自动高亮当前操作的元素，并通过颜色区分执行状态（成功/失败）。

### 核心能力

- **实时元素高亮**：执行过程中自动高亮当前操作的元素
- **状态视觉反馈**：成功（绿色）、失败（红色）、当前（蓝色）、等待（黄色）不同颜色区分
- **脉冲动画**：当前高亮元素带脉冲动画，吸引用户注意
- **失败抖动**：失败时带抖动动画，增强警示效果
- **自动清理**：成功后1秒自动淡出，失败高亮保持可见

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                 Chrome Extension Background                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ExecutionEngine                         │   │
│  │                                                      │   │
│  │  executeStep() ──▶ aiAct() ──▶ Element Extraction   │   │
│  │                            │                         │   │
│  │                            ▼                         │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │         ExecutionHighlightManager            │   │   │
│  │  │                                             │   │   │
│  │  │  • initialize()  - 注入到目标页面           │   │   │
│  │  │  • highlightCurrent() - 高亮当前元素       │   │   │
│  │  │  • markAsSuccess() - 标记成功              │   │   │
│  │  │  • markAsFailed()  - 标记失败              │   │   │
│  │  │  • clearAll()      - 清除所有高亮          │   │   │
│  │  │  • cleanup()       - 移除注入脚本          │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          chrome.scripting.executeScript             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Target Page Context                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Window Message Event Listener                │   │
│  │                      │                              │   │
│  │                      ▼                              │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │     In-Page Highlighter API                  │   │   │
│  │  │                                             │   │   │
│  │  │  • createHighlight() - 创建高亮元素        │   │   │
│  │  │  • removeHighlight() - 移除高亮            │   │   │
│  │  │  • clearAll()       - 清除所有              │   │   │
│  │  │  • markSuccess()    - 标记成功              │   │   │
│  │  │  • markFailed()     - 标记失败              │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                       │                              │   │
│  │                       ▼                              │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Overlay Container (z-index: 2147483645)     │   │   │
│  │  │                                             │   │   │
│  │  │  ┌─────────────────────────────────────┐    │   │   │
│  │  │  │  Highlight Elements                  │    │   │   │
│  │  │  │  • Border: 3px solid color           │    │   │   │
│  │  │  │  • Background: color20 (12% opacity) │    │   │   │
│  │  │  │  • Animation: pulse / shake          │    │   │   │
│  │  │  │  • Transition: 0.3s ease             │    │   │   │
│  │  │  └─────────────────────────────────────┘    │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 高亮类型

| 类型 | 颜色 | 说明 | 动画 | 自动移除 |
|------|------|------|------|----------|
| `current` | 蓝色 #1890ff | 当前正在操作的元素 | 脉冲 | 按配置时长 |
| `success` | 绿色 #52c41a | 操作成功 | 无 | 1秒后淡出 |
| `failed` | 红色 #ff4d4f | 操作失败 | 抖动 | 保持可见 |
| `pending` | 黄色 #faad14 | 等待中 | 脉冲 | 按配置时长 |

## 高亮生命周期

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ aiAct()  │────▶│ Extract  │────▶│ Highlight │────▶│ Execute  │
│ Start    │     │ Element  │     │ Current  │     │ Action   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                          │              │
                                          ▼              ▼
                                   ┌─────────────┐ ┌─────────────┐
                                   │ Blue Border │ │ Action      │
                                   │ + Pulse     │ │ Result      │
                                   │             │ └──────┬──────┘
                                   └─────────────┘        │
                                                          │
                                    ┌─────────────────────┴─────────────────────┐
                                    ▼                                           ▼
                             ┌─────────────┐                             ┌─────────────┐
                             │ Success     │                             │ Failed      │
                             │ Green       │                             │ Red         │
                             │ Fade 1s     │                             │ Shake       │
                             └─────────────┘                             └─────────────┘
```

## 快速开始

### 基础用法

```typescript
import { ExecutionEngine } from './services/executionEngine';

const engine = new ExecutionEngine(getAgent);

// 启用元素高亮（默认已启用）
engine.setHighlightingEnabled(true);

// 执行测试用例
const result = await engine.executeTestCase(testCase, {
  url: 'https://example.com',
});
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

## API 参考

### ExecutionEngine 方法

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
   * 执行测试用例（会自动处理高亮）
   */
  async executeTestCase(
    testCase: TestCase,
    context?: ExecutionContext
  ): Promise<ExecutionResult>;
}
```

### ExecutionHighlightManager 方法

```typescript
class ExecutionHighlightManager {
  /**
   * 初始化高亮器（注入到目标页面）
   */
  async initialize(): Promise<boolean>;

  /**
   * 高亮指定区域的元素
   */
  async highlight(
    rect: HighlightRect,
    type: HighlightType
  ): Promise<void>;

  /**
   * 高亮当前元素（替换之前的高亮）
   */
  async highlightCurrent(rect: HighlightRect): Promise<void>;

  /**
   * 标记当前高亮为成功
   */
  async markAsSuccess(): Promise<void>;

  /**
   * 标记当前高亮为失败
   */
  async markAsFailed(): Promise<void>;

  /**
   * 清除所有高亮
   */
  async clearAll(): Promise<void>;

  /**
   * 清理（移除注入的脚本和元素）
   */
  async cleanup(): Promise<void>;

  /**
   * 设置配置
   */
  setConfig(config: Partial<HighlightManagerConfig>): void;

  /**
   * 获取当前配置
   */
  getConfig(): HighlightManagerConfig;
}
```

### 类型定义

```typescript
interface HighlightRect {
  x: number;           // X 坐标
  y: number;           // Y 坐标
  width: number;       // 宽度
  height: number;      // 高度
  color?: string;      // 自定义颜色（可选）
  duration?: number;   // 自动移除时长，毫秒（可选）
}

type HighlightType = 'success' | 'failed' | 'pending' | 'current';

interface HighlightManagerConfig {
  enabled: boolean;              // 是否启用
  autoRemoveDuration: number;     // 自动移除时长（毫秒）
  showSuccessHighlights: boolean; // 是否显示成功高亮
  showFailedHighlights: boolean;  // 是否显示失败高亮
}
```

## 工作原理

### 1. 初始化流程

```typescript
// 1. ExecutionEngine 启动时初始化高亮器
if (this.highlightManager.getConfig().enabled) {
  await this.highlightManager.initialize();
}

// 2. ExecutionHighlightManager 通过 Chrome Scripting API 注入脚本
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: initHighlighterInPage,  // 序列化函数注入
});
```

### 2. 高亮注入机制

目标页面注入的内容：

```javascript
// 创建覆盖层容器（z-index: 2147483645）
const overlay = document.createElement('div');
overlay.id = 'midscene-execution-highlighter';
document.body.appendChild(overlay);

// 创建动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes midscene-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.02); }
  }
  @keyframes midshake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }
`;
document.head.appendChild(style);
```

### 3. 跨上下文通信

```typescript
// Background 通过 postMessage 发送指令
window.postMessage({
  type: 'highlightCurrent',
  rect: { x, y, width, height }
}, '*');

// 目标页面监听消息
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const { type, rect } = event.data;

  switch (type) {
    case 'highlightCurrent':
      // 创建高亮元素
      createHighlight(rect);
      break;
    case 'markAsSuccess':
      // 标记为成功
      markSuccess();
      break;
  }
});
```

## 最佳实践

### 1. 调试时启用详细反馈

```typescript
// 确保所有高亮功能启用
engine.setHighlightingEnabled(true);

// 配置较长显示时间以便观察
getHighlightManager().setConfig({
  autoRemoveDuration: 5000,
  showSuccessHighlights: true,
  showFailedHighlights: true,
});
```

### 2. 生产环境缩短显示时间

```typescript
// 快速执行：缩短显示时间减少干扰
getHighlightManager().setConfig({
  autoRemoveDuration: 500,
});
```

### 3. 仅保留失败高亮

```typescript
// 仅关注失败步骤
getHighlightManager().setConfig({
  showSuccessHighlights: false,  // 关闭成功高亮
  showFailedHighlights: true,    // 保留失败高亮
});
```

### 4. 手动控制高亮

```typescript
import { getHighlightManager } from './services/executionHighlightManager';

const manager = getHighlightManager();

// 初始化
await manager.initialize();

// 高亮特定区域
await manager.highlightCurrent({
  x: 100,
  y: 200,
  width: 150,
  height: 50,
});

// 标记结果
await manager.markAsSuccess();  // 或 markAsFailed()

// 清理
await manager.cleanup();
```

## 常见问题

### Q: 高亮不显示怎么办？

A: 检查以下几点：
1. 确认 `setHighlightingEnabled(true)` 已调用
2. 检查页面是否有更高 z-index 的元素遮挡
3. 确认扩展在当前标签页有权限
4. 查看控制台是否有错误信息

### Q: 如何自定义高亮颜色？

A: 使用 `HighlightRect` 的 `color` 参数：

```typescript
await manager.highlight({
  x: 100, y: 100, width: 50, height: 50,
  color: '#ff00ff'  // 自定义颜色
}, 'current');
```

### Q: 高亮元素会影响页面交互吗？

A: 不会。高亮元素的 `pointer-events: none` 确保所有鼠标事件穿透到下层元素。

### Q: 如何持久化失败高亮？

A: 失败高亮默认保持可见，不会被自动移除。只有调用 `clearAll()` 或 `cleanup()` 才会清除。

## 技术细节

### Z-Index 层级

```
2147483647 (MAX) - 元素选择器
2147483646        - (保留)
2147483645        - 执行高亮层
2147483644        - (保留)
...
0                 - 页面内容
```

### 动画性能

- 使用 CSS `transform` 实现动画，GPU 加速
- 动画持续时间短（1s 脉冲，0.5s 抖动），性能影响小
- 过渡效果 0.3s，视觉流畅

### 内存管理

- 成功高亮 1 秒后自动移除 DOM 元素
- 失败高亮保持直到手动清理
- `cleanup()` 会移除所有注入的元素和样式

## 版本历史

### v1.0.0 (2025-01)

- 初始版本发布
- 实时元素高亮：当前操作高亮、成功/失败状态反馈
- Chrome Scripting API 集成
- 跨上下文 postMessage 通信
- 脉冲和抖动动画效果
- 自动清理机制
