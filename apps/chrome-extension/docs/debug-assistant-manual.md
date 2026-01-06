# 自然语言调试助手 - 用户手册

## 功能概述

自然语言调试助手（Natural Language Debug Assistant）为 AI Test Generator 提供了智能化的测试调试体验。通过自然语言交互，用户可以快速诊断测试失败原因、获取修复建议、执行调试操作，无需手动编写调试代码。

### 核心能力

- **自然语言交互**：用中文或自然语言描述问题，AI 智能理解并响应
- **智能故障诊断**：自动分析错误类型（元素未找到、超时、断言失败等）
- **修复建议生成**：基于错误模式和历史数据生成高置信度修复建议
- **知识库学习**：从成功的修复中学习，持续优化建议质量
- **实时调试操作**：直接执行点击、输入、滚动、截图等调试动作
- **元素对比分析**：对比执行前后的页面状态，定位问题根源
- **上下文感知**：智能注入页面状态、执行历史等上下文信息

## 工作原理

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     NL Debug Assistant System                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    User Interaction Layer                        │   │
│  │                                                                  │   │
│  │  ┌────────────────┐    ┌────────────────┐    ┌──────────────┐  │   │
│  │  │ Chat Interface │───▶│ Quick Questions │───▶│ Status Panel │  │   │
│  │  └────────────────┘    └────────────────┘    └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   Conversation Manager                            │   │
│  │                                                                  │   │
│  │  • Manage conversation history                                   │   │
│  │  • Track conversation state                                       │   │
│  │  • Handle context switching                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Context Builder                             │   │
│  │                                                                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │   │
│  │  │ Page State │  │ Test Info  │  │ Error Info │  │ Exec Hist │ │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │   │
│  │                                                                  │   │
│  │  智能上下文注入：根据用户问题动态选择相关上下文                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        LLM Engine                                │   │
│  │                                                                  │   │
│  │  ┌────────────────┐    ┌────────────────┐    ┌──────────────┐  │   │
│  │  │ Token Mgmt     │───▶│ Context Window │───▶│ Cost Tracking│  │   │
│  │  └────────────────┘    └────────────────┘    └──────────────┘  │   │
│  │                                                                  │   │
│  │  sendRequest() ──▶ [LLM Provider] ──▶ LLM Response                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Response Parser                             │   │
│  │                                                                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │   │
│  │  │ Actions    │  │ Suggestions│  │ Context    │  │ Text      │ │   │
│  │  │ Extraction │  │ Parsing    │  │ Requests   │  │ Formatting│ │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                  ┌─────────────────┴─────────────────┐                  │
│                  ▼                                   ▼                  │
│  ┌─────────────────────────────┐   ┌─────────────────────────────────┐ │
│  │     Action Executor         │   │   Fix Suggestion Generator      │ │
│  │                             │   │                                 │ │
│  │  • click                    │   │  • Pattern Matching             │ │
│  │  • input                    │   │  • Knowledge Base Lookup        │ │
│  │  • scroll                   │   │  • Confidence Scoring           │ │
│  │  • screenshot               │   │  • Context-Aware Suggestions   │ │
│  │  • highlight                │   │                                 │ │
│  │  • compare                  │   │  ┌─────────────────────────┐   │ │
│  │  • wait                     │   │  │    Knowledge Base        │   │ │
│  │  • locate                   │   │  │                         │   │ │
│  │  • describe                 │   │  │  • Pattern Storage      │   │ │
│  │                             │   │  │  • Success Rate Track   │   │ │
│  └─────────────────────────────┘   │  │  • Auto Learning        │   │ │
│                                    │  └─────────────────────────┘   │ │
│                                    └─────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 快速开始

### 基础使用

```typescript
import { getDebugAssistantService } from './services/debugAssistant';

// 获取调试助手实例
const assistant = getDebugAssistantService({
  getAgent: () => midsceneAgent,
});

// 设置调试上下文
await assistant.setContext({
  screenshot: 'base64-image...',
  pageState: {
    url: 'https://example.com',
    title: '登录页面',
  },
  lastError: {
    type: 'element_not_found',
    message: '无法找到登录按钮',
    stack: '...',
  },
});

// 发送问题
const response = await assistant.ask('为什么找不到登录按钮？');

console.log(response.text);
// "根据页面分析，登录按钮可能还未加载完成。建议：\n
//  1. 添加显式等待\n
//  2. 检查按钮选择器\n
//  3. 尝试滚动到按钮位置"

// 执行建议的操作
for (const action of response.actions) {
  const result = await assistant.executeAction(action);
  console.log(result.message);
}
```

### 快捷问题

```typescript
// 获取快捷问题列表
const quickQuestions = assistant.getQuickQuestions();

// [
//   "为什么测试失败了？",
//   "如何修复这个错误？",
//   "当前页面状态如何？",
//   "执行历史是什么？",
//   ...
// ]

// 点击快捷问题
const response = await assistant.ask(quickQuestions[0]);
```

## 调试上下文

### DebugContext 结构

```typescript
interface DebugContext {
  // 页面截图（Base64）
  screenshot?: string;

  // 页面状态
  pageState?: {
    url: string;
    title: string;
    // 其他页面信息...
  };

  // 最后的错误
  lastError?: {
    type: string;           // 'element_not_found' | 'timeout' | 'assertion_failed' ...
    message: string;
    stack?: string;
  };

  // 失败的步骤
  failedStep?: string;

  // 控制台错误
  consoleErrors?: string[];

  // 执行历史
  executionHistory?: Array<{
    action: string;
    result: string;
    timestamp: number;
  }>;

  // 可见元素
  visibleElements?: Array<{
    text: string;
    selector: string;
    visible: boolean;
    rect: DOMRect;
  }>;

  // 网络请求
  networkRequests?: Array<{
    url: string;
    method: string;
    status: number;
    timestamp: number;
  }>;
}
```

### 更新上下文

```typescript
// 完全替换上下文
await assistant.setContext(newContext);

// 增量更新上下文
await assistant.updateContext({
  lastError: {
    type: 'timeout',
    message: '操作超时',
    stack: '...',
  },
});

// 清除上下文
await assistant.clearContext();
```

## 自然语言交互

### 支持的问题类型

| 类型 | 示例问题 | 响应内容 |
|------|---------|---------|
| 错误诊断 | "为什么测试失败了？" | 错误原因分析 |
| 修复建议 | "如何修复这个错误？" | 具体修复代码 |
| 页面状态 | "当前页面有什么元素？" | 页面元素列表 |
| 执行操作 | "点击提交按钮" | 执行结果 |
| 对比分析 | "和之前有什么不同？" | 对比结果 |
| 历史查询 | "执行了哪些步骤？" | 执行历史 |

### 智能上下文注入

调试助手会根据问题内容自动注入相关上下文：

```typescript
// 问题包含"网络" → 自动注入 networkErrors
const response1 = await assistant.ask('有网络问题吗？');

// 问题包含"元素" → 自动注入 visibleElements
const response2 = await assistant.ask('页面上有哪些按钮？');

// 问题包含"历史" → 自动注入 executionHistory
const response3 = await assistant.ask('之前的执行步骤是什么？');
```

### 对话历史

```typescript
// 获取对话历史
const history = assistant.getConversationHistory();

// [
//   { role: 'user', content: '为什么测试失败了？' },
//   { role: 'assistant', content: '根据分析...' },
//   { role: 'user', content: '如何修复？' },
//   ...
// ]

// 清除历史
assistant.clearHistory();

// 重置会话
assistant.reset();
```

## 调试操作

### 支持的操作类型

| 操作 | 说明 | 示例 |
|------|------|------|
| `click` | 点击元素 | `[ACTION:click:登录按钮]` |
| `input` | 输入文本 | `[ACTION:input:用户名:testuser]` |
| `scroll` | 滚动页面 | `[ACTION:scroll:down]` |
| `highlight` | 高亮元素 | `[ACTION:highlight:提交按钮]` |
| `screenshot` | 截图 | `[ACTION:screenshot]` |
| `wait` | 等待 | `[ACTION:wait:2000]` |
| `locate` | 定位元素 | `[ACTION:locate:登录表单]` |
| `describe` | 描述元素 | `[ACTION:describe:页面]` |
| `refresh` | 刷新页面 | `[ACTION:refresh]` |
| `compare` | 对比状态 | `[ACTION:compare:previous]` |

### 执行操作

```typescript
// 方式1：从响应中提取并执行
const response = await assistant.ask('点击登录按钮');
for (const action of response.actions) {
  const result = await assistant.executeAction(action);
  console.log(result.success, result.message);
}

// 方式2：手动创建操作
const result = await assistant.executeAction({
  id: 'action-1',
  type: 'click',
  target: '登录按钮',
});

// 方式3：通过自然语言触发
const response = await assistant.ask('帮我点击登录按钮');
// AI 会返回包含 click action 的响应
```

### 操作选项

```typescript
// 点击操作
await assistant.executeAction({
  type: 'click',
  target: '提交按钮',
  options: {
    button: 'right',       // left | right | middle
    clickCount: 2,         // 双击
    index: 0,              // 第几个匹配元素
  },
});

// 输入操作
await assistant.executeAction({
  type: 'input',
  target: '用户名输入框',
  value: 'test@example.com',
  options: {
    clearFirst: true,      // 先清空
    submit: true,          // 输入后按回车
  },
});

// 滚动操作
await assistant.executeAction({
  type: 'scroll',
  options: {
    scrollDirection: 'down', // up | down | left | right
    scrollAmount: 500,
  },
});

// 等待操作
await assistant.executeAction({
  type: 'wait',
  options: {
    timeout: 3000,          // 毫秒
    waitFor: 'visible',     // visible | hidden | stable
  },
});
```

## 修复建议

### 建议类型

| 类型 | 说明 | 典型场景 |
|------|------|---------|
| `wait` | 添加等待 | 元素未加载完成 |
| `locator` | 改进选择器 | 选择器不稳定 |
| `timeout` | 增加超时 | 网络慢或加载久 |
| `retry` | 添加重试 | 间歇性失败 |
| `assertion` | 调整断言 | 断言条件错误 |
| `action` | 修改操作 | 操作步骤问题 |
| `auth` | 处理认证 | 登录状态失效 |
| `navigation` | 页面导航 | 未导航到目标页 |

### 获取建议

```typescript
// 自动获取建议
const response = await assistant.ask('为什么找不到元素？');

for (const suggestion of response.suggestions) {
  console.log(`${suggestion.type}: ${suggestion.description}`);
  console.log(`置信度: ${suggestion.confidence}`);
  console.log(`代码: ${suggestion.code}`);
}

// 示例输出：
// wait: 添加显式等待，等待元素出现
// 置信度: 0.85
// 代码: await waitFor(element, { state: 'visible' });
```

### 应用修复

```typescript
import { getFixApplier } from './services/debugAssistant';

const fixApplier = getFixApplier({
  getAgent: () => midsceneAgent,
});

// 应用建议的修复
const result = await fixApplier.applyFix(suggestion, {
  testCaseId: 'test-123',
  stepIndex: 5,
});

// 记录成功修复（用于知识库学习）
if (result.success) {
  await assistant.learnFromSuccess(
    assistant.getContext(),
    suggestion,
    originalError
  );
}
```

## 知识库

### 知识库结构

```typescript
interface KnowledgeEntry {
  id: string;
  pattern: string;        // 错误模式
  fixes: FixSuggestion[]; // 修复方案
  frequency: number;      // 出现频率
  successRate: number;    // 成功率 (0-1)
  createdAt: number;
  lastUsedAt: number;
  tags: string[];         // 标签
}
```

### 知识库操作

```typescript
import { getKnowledgeBase } from './services/debugAssistant';

const kb = getKnowledgeBase();

// 查找匹配的模式
const matches = kb.findMatchingPatterns('element not found submit button', 5);

// 获取统计信息
const stats = kb.getStats();
console.log(stats);
// {
//   totalEntries: 42,
//   totalFixes: 87,
//   averageSuccessRate: 0.78,
//   mostCommonPatterns: [
//     { pattern: 'element not found', frequency: 15 },
//     ...
//   ]
// }

// 按标签查找
const entries = kb.findByTags(['timeout', 'network']);

// 按成功率查找
const effectiveFixes = kb.getBySuccessRate(0.8, 1.0);

// 添加新条目
kb.addEntry({
  pattern: 'timeout waiting for element',
  fixes: [
    {
      type: 'timeout',
      description: '增加超时时间',
      code: 'await action({ timeout: 30000 });',
      confidence: 0.8,
    },
  ],
  frequency: 1,
  successRate: 1.0,
  tags: ['timeout', 'element'],
});

// 更新成功率
kb.updateSuccessRate(entryId, true); // 修复成功

// 记录使用
kb.recordFixUsed(entryId, fixIndex);
```

### 导入/导出

```typescript
// 导出知识库
const json = kb.export();
console.log(json);

// 导入知识库
kb.import(json);

// 清空知识库
kb.clear();
```

## API 参考

### DebugAssistantService

```typescript
class DebugAssistantService {
  /**
   * 设置调试上下文
   */
  async setContext(context: DebugContext): Promise<void>;

  /**
   * 更新调试上下文
   */
  async updateContext(updates: Partial<DebugContext>): Promise<void>;

  /**
   * 获取当前上下文
   */
  getContext(): DebugContext;

  /**
   * 清除上下文
   */
  async clearContext(): Promise<void>;

  /**
   * 发送问题/消息
   */
  async ask(question: string): Promise<ParsedResponse>;

  /**
   * 执行调试操作
   */
  async executeAction(action: DebugAction): Promise<ActionResult>;

  /**
   * 批量执行操作
   */
  async executeActions(actions: DebugAction[]): Promise<ActionResult[]>;

  /**
   * 获取快捷问题列表
   */
  getQuickQuestions(): QuickQuestion[];

  /**
   * 获取对话历史
   */
  getConversationHistory(): Message[];

  /**
   * 清除对话历史
   */
  clearHistory(): void;

  /**
   * 重置会话
   */
  reset(): void;

  /**
   * 从成功中学习
   */
  async learnFromSuccess(
    context: DebugContext,
    appliedFix: FixSuggestion,
    originalError: string
  ): Promise<void>;

  /**
   * 获取使用统计
   */
  getStats(): {
    totalQuestions: number;
    totalActions: number;
    totalTokensUsed: number;
    averageConfidence: number;
  };
}
```

### ParsedResponse

```typescript
interface ParsedResponse {
  // 格式化后的文本回复
  text: string;

  // 提取的操作列表
  actions: DebugAction[];

  // 提取的建议列表
  suggestions: FixSuggestion[];

  // 原始响应
  rawResponse: string;

  // 置信度 (0-1)
  confidence: number;

  // 上下文请求（如果 AI 需要更多信息）
  contextRequest: {
    type: string;
    details: string;
  } | null;
}
```

### DebugAction

```typescript
interface DebugAction {
  id: string;
  type: DebugActionType;
  target?: string;
  value?: string | number;
  options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    index?: number;
    clearFirst?: boolean;
    delay?: number;
    submit?: boolean;
    scrollDirection?: 'up' | 'down' | 'left' | 'right';
    scrollAmount?: number;
    timeout?: number;
    waitFor?: 'visible' | 'hidden' | 'stable';
  };
}
```

### FixSuggestion

```typescript
interface FixSuggestion {
  id: string;
  type: FixSuggestionType;
  description: string;
  code: string;
  confidence: number;
  beforeAfter?: {
    before: string;
    after: string;
  };
}
```

## 最佳实践

### 1. 提供丰富的上下文

```typescript
// 好的上下文
await assistant.setContext({
  screenshot: pageScreenshot,
  pageState: { url, title },
  lastError: { type, message, stack },
  consoleErrors: browserErrors,
  executionHistory: stepHistory,
  visibleElements: elementList,
});

// 差的上下文
await assistant.setContext({
  lastError: { message: 'failed' },
});
```

### 2. 使用具体的问题描述

```typescript
// 好的问题
const response1 = await assistant.ask(
  '登录按钮找不到，页面显示 "加载中..."，需要等待吗？'
);

// 差的问题
const response2 = await assistant.ask('不工作了');
```

### 3. 利用快捷问题

对于常见场景，使用预定义的快捷问题可以更快获得答案：

```typescript
const quickQuestions = assistant.getQuickQuestions();
// 在 UI 中展示为可点击的按钮
```

### 4. 及时记录成功修复

```typescript
// 修复成功后记录，让知识库学习
if (fixApplied && testPassed) {
  await assistant.learnFromSuccess(
    originalContext,
    appliedSuggestion,
    originalError
  );
}
```

### 5. 定期清理知识库

```typescript
const kb = getKnowledgeBase();

// 移除低成功率条目
const lowSuccessEntries = kb.getBySuccessRate(0, 0.3);
for (const entry of lowSuccessEntries) {
  // 可以选择删除或标记为需要审查
}

// 清理长时间未使用的条目
const oldEntries = kb.getRecentEntries(365); // 一年以上未使用
```

## 常见问题

### Q: AI 响应很慢怎么办？

A: 可以通过以下方式优化：
```typescript
// 1. 减少上下文
assistant.updateContext({
  executionHistory: executionHistory.slice(-5), // 只保留最近5条
});

// 2. 使用更简洁的问题
await assistant.ask('失败原因？'); // 而不是长句子

// 3. 启用缓存
const assistant = getDebugAssistantService({
  getAgent: () => agent,
  cacheEnabled: true,
  cacheMaxSize: 100,
});
```

### Q: AI 返回的操作执行失败？

A: 检查以下几点：
```typescript
// 1. 确认 agent 可用
const agent = assistant.getAgent();
if (!agent) {
  console.error('Agent 未初始化');
}

// 2. 检查页面状态
const context = assistant.getContext();
console.log('当前 URL:', context.pageState?.url);

// 3. 尝试重新定位元素
const result = await assistant.executeAction({
  type: 'locate',
  target: '目标元素',
});
```

### Q: 建议的置信度很低？

A: 低置信度可能因为：
1. 错误模式不常见
2. 知识库中没有相似案例
3. 上下文信息不足

解决方法：
```typescript
// 1. 补充上下文
await assistant.updateContext({
  consoleErrors: errors,
  networkRequests: requests,
});

// 2. 使用更具体的问题
await assistant.ask('元素选择器是 .btn-submit，为什么找不到？');

// 3. 手动添加知识库条目
kb.addEntry({
  pattern: 'specific error pattern',
  fixes: [customFix],
  frequency: 1,
  successRate: 1.0,
  tags: ['custom'],
});
```

### Q: 如何禁用某些功能？

A: 通过配置选项：
```typescript
const assistant = getDebugAssistantService({
  getAgent: () => agent,
  enableKnowledgeBase: false,     // 禁用知识库
  enableActions: false,           // 禁用操作执行
  enableContextInjection: false,  // 禁用上下文注入
  maxSuggestions: 3,              // 限制建议数量
  minConfidence: 0.7,             // 提高置信度阈值
});
```

### Q: 如何自定义提示词？

A: 继承并扩展：
```typescript
import { getDebugAssistantService, DebugAssistantService } from './services/debugAssistant';

class CustomDebugAssistant extends DebugAssistantService {
  protected buildSystemPrompt(): string {
    const basePrompt = super.buildSystemPrompt();
    return basePrompt + '\n\n' + `
自定义规则：
1. 优先使用 CSS 选择器而非 XPath
2. 避免使用硬编码等待时间
3. ...
`;
  }
}

const assistant = new CustomDebugAssistant({ getAgent: () => agent });
```

## 更新日志

### v1.0.0 (2025-01)

- 初始版本发布
- 自然语言交互：支持中英文混合对话
- 智能故障诊断：识别 7+ 种常见错误类型
- 修复建议生成：基于模式匹配和知识库
- 调试操作执行：支持 10+ 种调试操作
- 知识库学习：从成功修复中持续优化
- 上下文感知：智能注入相关页面和执行信息
- 元素对比分析：执行前后状态对比
