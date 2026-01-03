# 智能断言生成 技术方案设计文档

## 1. 项目背景与目标

测试断言是保证测试有效性的关键，但手动编写断言费时费力，且容易遗漏关键验证点。本模块通过 AI 分析操作上下文，自动推荐合适的断言，目标是将断言覆盖率提升 50%，同时减少 70% 的断言编写时间。

## 2. 系统架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                Smart Assertion Module                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Context    │  │  Assertion   │  │   Template   │       │
│  │   Analyzer   │  │  Generator   │  │   Manager    │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └────────────┬────┴─────────────────┘               │
│                      │                                       │
│              ┌───────▼───────┐                              │
│              │  Assertion    │                              │
│              │  Validator    │                              │
│              └───────────────┘                              │
└─────────────────────────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Midscene │  │ Execution│  │   YAML   │
   │   Core   │  │  Engine  │  │ Generator│
   └──────────┘  └──────────┘  └──────────┘
```

### 2.2 技术栈选型

* **上下文分析**: Midscene AI Vision API
* **模板存储**: IndexedDB
* **规则引擎**: 自定义 DSL 解析器
* **UI 组件**: React + Framer Motion (动画)

---

## 3. 核心模块设计

### 3.1 上下文分析器 (Context Analyzer)

#### 3.1.1 数据结构

```typescript
interface ActionContext {
  // 操作信息
  action: {
    type: 'click' | 'input' | 'select' | 'scroll' | 'navigate';
    target: ElementInfo;
    value?: string;              // 输入值
    timestamp: number;
  };

  // 页面状态
  pageState: {
    beforeScreenshot: Uint8Array;
    afterScreenshot: Uint8Array;
    beforeUrl: string;
    afterUrl: string;
    visibleChanges: VisualChange[];
  };

  // 语义信息
  semantic: {
    actionIntent: string;        // AI 推断的操作意图
    targetSemantics: string;     // 目标元素语义
    expectedOutcome: string;     // 预期结果
  };
}

interface VisualChange {
  type: 'appeared' | 'disappeared' | 'modified';
  region: BoundingBox;
  description: string;
  confidence: number;
}

interface ElementInfo {
  text: string;
  tagName: string;
  attributes: Record<string, string>;
  boundingBox: BoundingBox;
}
```

#### 3.1.2 分析流程

```typescript
class ContextAnalyzer {
  async analyze(context: ActionContext): Promise<AnalysisResult> {
    // 1. 识别操作意图
    const intent = await this.inferIntent(context.action);

    // 2. 检测页面变化
    const changes = await this.detectChanges(
      context.pageState.beforeScreenshot,
      context.pageState.afterScreenshot
    );

    // 3. 判断是否需要断言
    const needsAssertion = this.shouldAssert(intent, changes);

    // 4. 确定断言类型
    const assertionTypes = this.determineAssertionTypes(intent, changes);

    return {
      needsAssertion,
      assertionTypes,
      changes,
      intent,
    };
  }

  private shouldAssert(intent: string, changes: VisualChange[]): boolean {
    // 高价值断言时机
    const highValueIntents = [
      'submit_form',
      'login',
      'add_to_cart',
      'delete_item',
      'save_data',
      'navigate_to',
    ];

    return (
      highValueIntents.includes(intent) ||
      changes.some(c => c.type === 'appeared' && c.confidence > 0.8)
    );
  }
}
```

### 3.2 断言生成器 (Assertion Generator)

#### 3.2.1 推荐数据结构

```typescript
interface AssertionRecommendation {
  id: string;
  type: AssertionType;
  description: string;           // 自然语言描述
  confidence: number;            // 置信度 0-100
  reason: string;                // 推荐理由
  parameters: AssertionParams;   // 断言参数
  yamlOutput: string;            // YAML 格式输出
  previewResult?: boolean;       // 预执行结果
}

type AssertionType =
  | 'element_exists'
  | 'element_visible'
  | 'text_contains'
  | 'text_equals'
  | 'attribute_equals'
  | 'state_check'
  | 'url_contains'
  | 'count_equals';

interface AssertionParams {
  target?: string;               // 目标描述
  expectedValue?: string;        // 预期值
  attribute?: string;            // 属性名
  operator?: 'equals' | 'contains' | 'matches' | 'gt' | 'lt';
}
```

#### 3.2.2 生成策略

```typescript
class AssertionGenerator {
  private strategies: AssertionStrategy[] = [
    new SuccessMessageStrategy(),
    new NavigationStrategy(),
    new StateChangeStrategy(),
    new DataValidationStrategy(),
    new ErrorPreventionStrategy(),
  ];

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const recommendations: AssertionRecommendation[] = [];

    for (const strategy of this.strategies) {
      if (strategy.applies(context, analysis)) {
        const assertions = await strategy.generate(context, analysis);
        recommendations.push(...assertions);
      }
    }

    // 按置信度排序，去重，限制数量
    return this.deduplicate(recommendations)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }
}
```

#### 3.2.3 内置生成策略

```typescript
// 策略 1: 成功提示检测
class SuccessMessageStrategy implements AssertionStrategy {
  applies(context: ActionContext, analysis: AnalysisResult): boolean {
    return ['submit_form', 'login', 'save_data'].includes(analysis.intent);
  }

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const newElements = analysis.changes.filter(c => c.type === 'appeared');

    return newElements
      .filter(el => this.looksLikeSuccessMessage(el))
      .map(el => ({
        id: generateId(),
        type: 'text_contains',
        description: `验证成功提示 "${el.description}" 出现`,
        confidence: el.confidence * 100,
        reason: '表单提交后通常会显示成功提示',
        parameters: {
          target: el.description,
          operator: 'contains',
        },
        yamlOutput: `- assert: "页面包含文本 '${el.description}'"`,
      }));
  }

  private looksLikeSuccessMessage(change: VisualChange): boolean {
    const successKeywords = ['成功', '完成', 'success', '已保存', '已提交'];
    return successKeywords.some(kw =>
      change.description.toLowerCase().includes(kw)
    );
  }
}

// 策略 2: 导航验证
class NavigationStrategy implements AssertionStrategy {
  applies(context: ActionContext, analysis: AnalysisResult): boolean {
    return context.pageState.beforeUrl !== context.pageState.afterUrl;
  }

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const newUrl = context.pageState.afterUrl;
    const urlPath = new URL(newUrl).pathname;

    return [{
      id: generateId(),
      type: 'url_contains',
      description: `验证页面跳转到 ${urlPath}`,
      confidence: 95,
      reason: '检测到页面导航，应验证目标 URL',
      parameters: {
        expectedValue: urlPath,
        operator: 'contains',
      },
      yamlOutput: `- assert: "当前 URL 包含 '${urlPath}'"`,
    }];
  }
}

// 策略 3: 状态变化验证
class StateChangeStrategy implements AssertionStrategy {
  applies(context: ActionContext, analysis: AnalysisResult): boolean {
    return analysis.changes.some(c => c.type === 'modified');
  }

  async generate(
    context: ActionContext,
    analysis: AnalysisResult
  ): Promise<AssertionRecommendation[]> {
    const modifications = analysis.changes.filter(c => c.type === 'modified');

    return modifications.map(mod => ({
      id: generateId(),
      type: 'state_check',
      description: `验证 ${mod.description} 状态变化`,
      confidence: mod.confidence * 90,
      reason: '元素状态发生变化，应验证新状态',
      parameters: {
        target: mod.description,
      },
      yamlOutput: `- ai: "验证 ${mod.description} 状态正确"`,
    }));
  }
}
```

### 3.3 断言验证器 (Assertion Validator)

```typescript
class AssertionValidator {
  async validate(assertion: AssertionRecommendation): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const result = await this.executeAssertion(assertion);
      return {
        success: result,
        duration: Date.now() - startTime,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async executeAssertion(
    assertion: AssertionRecommendation
  ): Promise<boolean> {
    switch (assertion.type) {
      case 'text_contains':
        return this.checkTextContains(assertion.parameters);
      case 'element_exists':
        return this.checkElementExists(assertion.parameters);
      case 'url_contains':
        return this.checkUrlContains(assertion.parameters);
      // ... 其他类型
    }
  }
}
```

### 3.4 模板管理器 (Template Manager)

```typescript
interface AssertionTemplate {
  id: string;
  name: string;
  description: string;
  category: 'system' | 'user' | 'team';
  trigger: {
    actionType?: string;
    elementPattern?: string;
    urlPattern?: string;
  };
  assertion: {
    type: AssertionType;
    parameters: Partial<AssertionParams>;
  };
  usageCount: number;
  createdAt: number;
}

class TemplateManager {
  async findMatchingTemplates(
    context: ActionContext
  ): Promise<AssertionTemplate[]> {
    const templates = await this.storage.getAll();

    return templates.filter(t => this.matches(t.trigger, context));
  }

  async saveAsTemplate(
    assertion: AssertionRecommendation,
    name: string
  ): Promise<AssertionTemplate> {
    const template: AssertionTemplate = {
      id: generateId(),
      name,
      description: assertion.description,
      category: 'user',
      trigger: this.inferTrigger(assertion),
      assertion: {
        type: assertion.type,
        parameters: assertion.parameters,
      },
      usageCount: 0,
      createdAt: Date.now(),
    };

    await this.storage.save(template);
    return template;
  }
}
```

---

## 4. YAML 输出格式

```yaml
# 存在性断言
- assert: "元素 '提交按钮' 存在"
- assert: "页面包含文本 '登录成功'"

# 内容断言
- ai: "验证用户名显示为 'admin'"
- assert: "输入框值等于 'test@example.com'"

# 状态断言
- ai: "验证提交按钮处于禁用状态"
- assert: "复选框 '记住我' 已选中"

# 导航断言
- assert: "当前 URL 包含 '/dashboard'"
- ai: "验证页面标题为 '控制台'"

# 数据断言
- ai: "验证表格显示 5 条数据"
- assert: "列表按时间降序排列"
```

---

## 5. UI 设计

### 5.1 推荐卡片组件

```
┌────────────────────────────────────────────────────┐
│ 💡 断言推荐                               置信度 92% │
├────────────────────────────────────────────────────┤
│                                                    │
│  验证登录成功提示 "欢迎回来，admin" 出现            │
│                                                    │
│  推荐理由: 登录操作后检测到成功提示消息出现          │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ - assert: "页面包含文本 '欢迎回来'"           │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  [✓ 验证通过]                                      │
│                                                    │
│  [采用 (Enter)]  [修改]  [跳过 (Esc)]             │
└────────────────────────────────────────────────────┘
```

### 5.2 快捷键

| 快捷键 | 操作 |
|--------|------|
| `Enter` | 采用当前推荐 |
| `Esc` | 跳过当前推荐 |
| `Tab` | 切换到下一个推荐 |
| `E` | 编辑当前推荐 |
| `S` | 保存为模板 |

---

## 6. 实施计划

1. **Week 1**: 上下文分析器，页面变化检测
2. **Week 2**: 断言生成器，核心策略实现
3. **Week 3**: 模板管理，YAML 集成
4. **Week 4**: UI 组件，快捷键，测试优化
