# 自然语言调试助手 技术方案设计文档

## 1. 项目背景与目标

测试调试是耗时且需要经验的工作。本模块通过 AI 对话能力，让调试过程变得直观易懂。用户只需描述问题，AI 即可分析原因、提供建议、执行修复。

## 2. 系统架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  NL Debug Assistant                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Conversation│  │   Context    │  │    Action    │       │
│  │   Manager    │  │   Builder    │  │   Executor   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └────────────┬────┴─────────────────┘               │
│                      │                                       │
│              ┌───────▼───────┐                              │
│              │   LLM Engine  │                              │
│              │  (Midscene AI)│                              │
│              └───────────────┘                              │
└─────────────────────────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  Debug   │  │  Fix     │  │ Knowledge│
   │    UI    │  │ Applier  │  │   Base   │
   └──────────┘  └──────────┘  └──────────┘
```

### 2.2 技术栈选型

* **LLM 调用**: Midscene AI API (Vision + Text)
* **对话管理**: 自定义对话状态机
* **UI**: React + 对话气泡组件
* **知识库**: IndexedDB + 向量相似度 (可选)

---

## 3. 核心模块设计

### 3.1 对话管理器 (Conversation Manager)

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    screenshots?: string[];
    actions?: DebugAction[];
    suggestions?: FixSuggestion[];
  };
}

interface ConversationState {
  sessionId: string;
  messages: Message[];
  debugContext: DebugContext;
  pendingAction?: DebugAction;
}

class ConversationManager {
  private state: ConversationState;
  private llmEngine: LLMEngine;
  private contextBuilder: ContextBuilder;
  private actionExecutor: ActionExecutor;

  async sendMessage(userInput: string): Promise<Message> {
    // 1. 添加用户消息
    const userMessage = this.createMessage('user', userInput);
    this.state.messages.push(userMessage);

    // 2. 构建 LLM 上下文
    const llmContext = await this.contextBuilder.build(
      this.state.debugContext,
      this.state.messages
    );

    // 3. 调用 LLM
    const response = await this.llmEngine.chat(llmContext, userInput);

    // 4. 解析响应
    const parsed = this.parseResponse(response);

    // 5. 执行动作（如果有）
    if (parsed.actions.length > 0) {
      await this.executeActions(parsed.actions);
    }

    // 6. 创建助手消息
    const assistantMessage = this.createMessage('assistant', parsed.text, {
      actions: parsed.actions,
      suggestions: parsed.suggestions,
    });
    this.state.messages.push(assistantMessage);

    return assistantMessage;
  }

  private parseResponse(response: string): ParsedResponse {
    // 解析 LLM 响应中的特殊标记
    // [ACTION:click:selector] - 操作指令
    // [SUGGESTION:...] - 修复建议
    // 普通文本 - 对话内容
    // ...
  }
}
```

### 3.2 上下文构建器 (Context Builder)

```typescript
interface DebugContext {
  // 当前状态
  currentScreenshot: string;
  currentUrl: string;
  currentStep: TestStep;

  // 失败信息
  error?: {
    type: string;
    message: string;
    stack?: string;
  };

  // 历史信息
  executionHistory: StepResult[];
  previousScreenshots: string[];

  // 页面信息
  visibleElements?: ElementInfo[];
  consoleErrors?: string[];
  networkErrors?: NetworkError[];
}

class ContextBuilder {
  async build(
    debugContext: DebugContext,
    messages: Message[]
  ): Promise<LLMContext> {
    const systemPrompt = this.buildSystemPrompt(debugContext);
    const conversationHistory = this.buildConversationHistory(messages);

    // 根据最新用户消息动态添加上下文
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const additionalContext = await this.getAdditionalContext(
      lastUserMessage?.content || '',
      debugContext
    );

    return {
      systemPrompt,
      conversationHistory,
      images: [debugContext.currentScreenshot],
      additionalContext,
    };
  }

  private buildSystemPrompt(context: DebugContext): string {
    return `你是一个专业的 UI 自动化测试调试助手。

当前调试上下文：
- 页面 URL: ${context.currentUrl}
- 当前步骤: ${context.currentStep.description}
- 错误信息: ${context.error?.message || '无'}

你的能力：
1. 分析页面截图，识别 UI 元素
2. 解释测试失败的原因
3. 提供修复建议
4. 执行调试操作（使用 [ACTION:...] 标记）
5. 记住对话上下文，支持多轮交互

回复格式：
- 普通文本：直接回复
- 执行操作：[ACTION:type:target:value]
- 修复建议：[SUGGESTION:description|code]

请用简洁清晰的中文回答用户问题。`;
  }

  private async getAdditionalContext(
    userMessage: string,
    context: DebugContext
  ): Promise<string> {
    // 根据用户问题动态获取相关上下文
    if (userMessage.includes('网络') || userMessage.includes('请求')) {
      return `网络错误: ${JSON.stringify(context.networkErrors)}`;
    }
    if (userMessage.includes('控制台') || userMessage.includes('日志')) {
      return `控制台错误: ${context.consoleErrors?.join('\n')}`;
    }
    return '';
  }
}
```

### 3.3 动作执行器 (Action Executor)

```typescript
type DebugActionType =
  | 'click'
  | 'input'
  | 'scroll'
  | 'refresh'
  | 'highlight'
  | 'screenshot'
  | 'wait'
  | 'compare';

interface DebugAction {
  type: DebugActionType;
  target?: string;
  value?: any;
}

class ActionExecutor {
  private midscene: MidsceneAgent;

  async execute(action: DebugAction): Promise<ActionResult> {
    switch (action.type) {
      case 'click':
        return this.executeClick(action.target!);

      case 'input':
        return this.executeInput(action.target!, action.value);

      case 'highlight':
        return this.executeHighlight(action.target!);

      case 'screenshot':
        return this.captureScreenshot();

      case 'compare':
        return this.compareScreenshots(action.value);

      case 'refresh':
        return this.refreshPage();

      case 'wait':
        return this.wait(action.value || 1000);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeHighlight(description: string): Promise<ActionResult> {
    // 使用 Midscene 定位元素并添加高亮样式
    const elements = await this.midscene.locate(description);

    for (const el of elements) {
      await this.addHighlight(el.boundingBox);
    }

    return {
      success: true,
      message: `已高亮 ${elements.length} 个元素`,
      data: elements,
    };
  }

  private async compareScreenshots(
    previousScreenshot: string
  ): Promise<ActionResult> {
    const currentScreenshot = await this.captureScreenshot();

    // 调用图像对比服务
    const diff = await this.imageDiff(previousScreenshot, currentScreenshot.data);

    return {
      success: true,
      message: `发现 ${diff.changedRegions.length} 处变化`,
      data: diff,
    };
  }
}
```

### 3.4 修复建议系统 (Fix Suggestion System)

```typescript
interface FixSuggestion {
  id: string;
  type: 'code_change' | 'wait_time' | 'locator_change' | 'retry';
  description: string;
  confidence: number;
  code?: string;
  beforeAfter?: {
    before: string;
    after: string;
  };
}

class FixSuggestionSystem {
  async generateSuggestions(
    error: DebugError,
    context: DebugContext
  ): Promise<FixSuggestion[]> {
    const suggestions: FixSuggestion[] = [];

    // 基于错误类型生成建议
    switch (error.type) {
      case 'locator_failed':
        suggestions.push(...await this.suggestLocatorFixes(error, context));
        break;

      case 'timeout':
        suggestions.push(this.suggestWaitTime(error));
        break;

      case 'assertion_failed':
        suggestions.push(...await this.suggestAssertionFixes(error, context));
        break;
    }

    // 查询知识库
    const kbSuggestions = await this.queryKnowledgeBase(error);
    suggestions.push(...kbSuggestions);

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  async applySuggestion(suggestion: FixSuggestion): Promise<ApplyResult> {
    switch (suggestion.type) {
      case 'code_change':
        return this.applyCodeChange(suggestion);

      case 'wait_time':
        return this.applyWaitTime(suggestion);

      case 'locator_change':
        return this.applyLocatorChange(suggestion);

      case 'retry':
        return this.retryExecution();
    }
  }
}
```

### 3.5 知识库 (Knowledge Base)

```typescript
interface DebugKnowledge {
  id: string;
  pattern: {
    errorType: string;
    errorMessage?: RegExp;
    elementType?: string;
    pagePattern?: string;
  };
  solution: FixSuggestion;
  successCount: number;
  failureCount: number;
  lastUsed: number;
}

class KnowledgeBase {
  private storage: IndexedDB;

  async query(error: DebugError): Promise<DebugKnowledge[]> {
    const allKnowledge = await this.storage.getAll();

    return allKnowledge
      .filter(k => this.matches(k.pattern, error))
      .sort((a, b) => {
        // 按成功率和最近使用排序
        const aSuccessRate = a.successCount / (a.successCount + a.failureCount);
        const bSuccessRate = b.successCount / (b.successCount + b.failureCount);
        return bSuccessRate - aSuccessRate;
      });
  }

  async recordResult(
    knowledgeId: string,
    success: boolean
  ): Promise<void> {
    const knowledge = await this.storage.get(knowledgeId);
    if (knowledge) {
      if (success) {
        knowledge.successCount++;
      } else {
        knowledge.failureCount++;
      }
      knowledge.lastUsed = Date.now();
      await this.storage.put(knowledge);
    }
  }

  async learnFromSuccess(
    error: DebugError,
    appliedFix: FixSuggestion
  ): Promise<void> {
    const knowledge: DebugKnowledge = {
      id: generateId(),
      pattern: this.extractPattern(error),
      solution: appliedFix,
      successCount: 1,
      failureCount: 0,
      lastUsed: Date.now(),
    };
    await this.storage.add(knowledge);
  }
}
```

---

## 4. LLM 提示工程

### 4.1 系统提示模板

```
你是 Midscene 测试调试助手，专门帮助用户调试 UI 自动化测试。

## 能力范围
1. 分析截图识别 UI 元素位置和状态
2. 解释测试失败原因（定位失败、断言失败、超时等）
3. 提供可执行的修复建议
4. 执行调试操作（点击、高亮、截图等）
5. 对比前后截图发现变化

## 响应格式
- 直接回答问题时使用清晰的中文
- 需要执行操作时使用: [ACTION:操作类型:目标:参数]
- 提供修复建议时使用: [SUGGESTION:描述|代码]

## 操作类型
- click: 点击元素
- input: 输入文本
- highlight: 高亮元素
- scroll: 滚动页面
- refresh: 刷新页面
- wait: 等待
- compare: 对比截图

## 注意事项
- 始终基于截图中实际看到的内容回答
- 不确定时要诚实说明
- 复杂问题分步骤解释
- 提供修复建议时要具体可执行
```

### 4.2 对话示例

```
用户: 为什么登录按钮点不了？

助手: 我来分析一下当前页面截图...

[ACTION:highlight:登录按钮]

根据截图分析，登录按钮点击失败可能有以下原因：

1. **元素被遮挡**: 我看到页面上有一个 Cookie 同意弹窗覆盖在登录按钮上方
2. **按钮状态**: 登录按钮目前显示为灰色，可能处于禁用状态

建议的修复方案：

[SUGGESTION:关闭弹窗后再点击|在点击登录按钮前，先关闭 Cookie 弹窗]

```yaml
- ai: "点击接受 Cookie 按钮"
- ai: "点击登录按钮"
```

需要我帮你应用这个修复吗？
```

---

## 5. UI 设计

```
┌────────────────────────────────────────────────────────────────┐
│  🔍 调试助手                                        [清除] [最小化] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🤖 测试在步骤 3 "点击登录按钮" 失败了。                     │ │
│  │    错误: 无法定位元素                                      │ │
│  │                                                          │ │
│  │    [查看截图] [查看日志]                                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 👤 为什么登录按钮点不了？                                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🤖 根据截图分析，登录按钮被 Cookie 弹窗遮挡。              │ │
│  │                                                          │ │
│  │    💡 修复建议:                                           │ │
│  │    ┌────────────────────────────────────────────────┐    │ │
│  │    │ - ai: "关闭 Cookie 弹窗"                        │    │ │
│  │    │ - ai: "点击登录按钮"                            │    │ │
│  │    └────────────────────────────────────────────────┘    │ │
│  │    [应用修复] [修改建议]                                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 💬 输入问题或指令...                              [发送] │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  快捷问题: [为什么失败?] [怎么修复?] [显示元素] [重试]         │
└────────────────────────────────────────────────────────────────┘
```

---

## 6. 实施计划

1. **Week 1**: 对话管理器，上下文构建
2. **Week 2**: 动作执行器，LLM 集成
3. **Week 3**: 修复建议系统，知识库
4. **Week 4**: UI 组件，测试优化
