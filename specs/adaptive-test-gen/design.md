# 自适应测试生成 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**声明式优先，命令式补充**
- 用户用自然语言描述期望行为
- 系统自动转换为可执行逻辑
- 复杂场景提供显式控制语法

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| Markdown 解析器 | 扩展语法支持条件/循环 |
| 执行引擎 | 添加分支控制和状态管理 |
| AI 定位 | 复用于条件判断 |
| 步骤执行 | 添加上下文和变量支持 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Adaptive Test Generator                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  AdaptiveParser  │     │  ConditionEngine │              │
│  │   (语法解析器)    │────▶│   (条件引擎)     │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │   ControlFlow    │     │   StateDetector  │              │
│  │   (流程控制器)    │◀───▶│   (状态检测器)   │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  VariableStore   │     │  PathOptimizer   │              │
│  │   (变量存储)      │     │   (路径优化)     │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │ ExecutionEngine│  ← 复用现有执行引擎
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **AdaptiveParser** | 解析扩展的 Markdown 语法 |
| **ConditionEngine** | 评估条件表达式 |
| **ControlFlow** | 管理分支和循环执行 |
| **StateDetector** | 使用 AI 检测页面状态 |
| **VariableStore** | 管理测试变量和上下文 |
| **PathOptimizer** | 分析历史数据优化路径 |

---

## 3. 核心数据结构

### 3.1 扩展的测试用例结构

```typescript
interface AdaptiveTestCase {
  id: string;
  name: string;
  steps: AdaptiveStep[];
  variables: Record<string, any>;  // 初始变量
  errorHandlers: ErrorHandler[];   // 错误处理器
}

interface AdaptiveStep {
  type: 'action' | 'condition' | 'loop' | 'variable';

  // 基础操作
  action?: {
    type: 'click' | 'input' | 'assert' | 'wait' | 'navigate';
    target: string;
    value?: string;
  };

  // 条件分支
  condition?: {
    expression: string;         // 条件表达式
    thenSteps: AdaptiveStep[];  // 满足时执行
    elseSteps?: AdaptiveStep[]; // 不满足时执行
  };

  // 循环
  loop?: {
    type: 'count' | 'while' | 'forEach';
    count?: number;             // 计数循环次数
    condition?: string;         // 条件表达式
    collection?: string;        // 遍历目标
    itemVar?: string;           // 循环变量名
    body: AdaptiveStep[];       // 循环体
    maxIterations: number;      // 最大迭代次数
  };

  // 变量操作
  variable?: {
    operation: 'set' | 'get' | 'increment';
    name: string;
    value?: any;
    source?: string;            // 从页面获取时的描述
  };
}
```

### 3.2 条件表达式

```typescript
interface ConditionExpression {
  type: 'element' | 'text' | 'state' | 'variable' | 'compound';

  // 元素条件
  element?: {
    target: string;             // 元素描述
    check: 'exists' | 'visible' | 'enabled' | 'selected';
  };

  // 文本条件
  text?: {
    target: string;             // 元素描述
    operator: 'equals' | 'contains' | 'matches';
    value: string;
  };

  // 状态条件
  state?: {
    type: 'logged_in' | 'loading' | 'error' | 'empty' | 'custom';
    customDescription?: string;
  };

  // 变量条件
  variable?: {
    name: string;
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
    value: any;
  };

  // 复合条件
  compound?: {
    operator: 'and' | 'or' | 'not';
    operands: ConditionExpression[];
  };
}
```

### 3.3 执行上下文

```typescript
interface ExecutionContext {
  variables: Map<string, any>;
  loopStack: LoopContext[];
  pathHistory: string[];
  errorStack: Error[];
}

interface LoopContext {
  loopId: string;
  currentIteration: number;
  maxIterations: number;
  collection?: any[];
  currentItem?: any;
}
```

---

## 4. 核心流程

### 4.1 语法解析流程

```
Markdown 输入
      │
      ▼
┌─────────────────────────┐
│ 1. 识别扩展语法标记     │
│    - 如果/否则          │
│    - 重复/直到          │
│    - 设置/获取变量      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 构建 AST             │
│    - 解析嵌套结构       │
│    - 验证语法正确性     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 转换为 AdaptiveStep  │
│    - 提取条件表达式     │
│    - 绑定动作步骤       │
└───────────┬─────────────┘
            │
            ▼
   AdaptiveTestCase
```

### 4.2 条件评估流程

```
条件表达式
      │
      ▼
┌─────────────────────────┐
│ 1. 解析表达式类型       │
└───────────┬─────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
┌─────────┐   ┌─────────┐
│元素条件 │   │变量条件 │
└────┬────┘   └────┬────┘
     │             │
     ▼             ▼
┌─────────┐   ┌─────────┐
│ AI 定位 │   │变量查询 │
│ 检测    │   │ 比较    │
└────┬────┘   └────┬────┘
     │             │
     └──────┬──────┘
            ▼
┌─────────────────────────┐
│ 2. 返回布尔结果         │
└─────────────────────────┘
```

### 4.3 循环执行流程

```
Loop Step
    │
    ▼
┌─────────────────────────┐
│ 1. 初始化循环上下文     │
│    - 设置迭代计数器     │
│    - 准备集合（forEach）│
└───────────┬─────────────┘
            │
            ▼
       ┌────┴────┐
       │检查终止 │
       │条件     │
       └────┬────┘
       继续 │   终止
       │    │    │
       ▼    │    ▼
┌─────────┐ │  退出循环
│执行循环 │ │
│体步骤   │ │
└────┬────┘ │
     │      │
     ▼      │
┌─────────┐ │
│更新计数 │ │
│/项目    │ │
└────┬────┘ │
     │      │
     └──────┘
```

---

## 5. 扩展语法规范

### 5.1 条件语法

```markdown
# 基础条件
- 如果 [登录按钮可见]
  - 点击"登录按钮"

# 带否则分支
- 如果 [已登录状态]
  - 直接进入主页
- 否则
  - 执行登录流程

# 嵌套条件
- 如果 [管理员用户]
  - 如果 [有待审批任务]
    - 进入审批页面
  - 否则
    - 进入管理面板
```

### 5.2 循环语法

```markdown
# 计数循环
- 重复 5 次
  - 点击"加载更多"

# 条件循环
- 直到 [列表为空] 执行
  - 选择第一项
  - 删除选中项

# 遍历循环
- 对于 [商品列表] 中的每个项目
  - 点击该项目
  - 验证价格显示
  - 返回列表
```

### 5.3 变量语法

```markdown
# 设置变量
- 设置 $count = 0

# 从页面获取
- 获取 [购物车数量] 保存到 $cartCount

# 使用变量
- 输入 [$username] 到 [用户名输入框]

# 变量运算
- 设置 $total = $price * $quantity
```

---

## 6. API 设计

### 6.1 AdaptiveParser

```typescript
interface IAdaptiveParser {
  parse(markdown: string): AdaptiveTestCase;
  validate(testCase: AdaptiveTestCase): ValidationResult;
  toMarkdown(testCase: AdaptiveTestCase): string;
}
```

### 6.2 ConditionEngine

```typescript
interface IConditionEngine {
  evaluate(
    expression: ConditionExpression,
    context: ExecutionContext,
    agent: MidsceneAgent
  ): Promise<boolean>;

  parseExpression(text: string): ConditionExpression;
}
```

### 6.3 ControlFlowExecutor

```typescript
interface IControlFlowExecutor {
  executeStep(
    step: AdaptiveStep,
    context: ExecutionContext,
    agent: MidsceneAgent
  ): Promise<StepResult>;

  executeLoop(
    loop: AdaptiveStep['loop'],
    context: ExecutionContext,
    agent: MidsceneAgent
  ): Promise<void>;
}
```

---

## 7. 集成方案

### 7.1 与 MarkdownParser 集成

```typescript
// 扩展现有解析器
class AdaptiveMarkdownParser extends MarkdownParser {
  parseAdaptiveStep(line: string): AdaptiveStep | null {
    // 检测自适应语法
    if (line.startsWith('- 如果')) {
      return this.parseCondition(line);
    }
    if (line.startsWith('- 重复') || line.startsWith('- 直到')) {
      return this.parseLoop(line);
    }
    if (line.startsWith('- 设置') || line.startsWith('- 获取')) {
      return this.parseVariable(line);
    }
    return null;
  }
}
```

### 7.2 与 ExecutionEngine 集成

```typescript
class AdaptiveExecutionEngine extends ExecutionEngine {
  private conditionEngine: IConditionEngine;
  private controlFlow: IControlFlowExecutor;
  private context: ExecutionContext;

  async executeAdaptiveStep(step: AdaptiveStep): Promise<void> {
    switch (step.type) {
      case 'condition':
        await this.executeCondition(step);
        break;
      case 'loop':
        await this.executeLoop(step);
        break;
      case 'variable':
        await this.executeVariable(step);
        break;
      default:
        await super.executeStep(step.action!);
    }
  }
}
```

---

## 8. 错误处理

### 8.1 循环保护

```typescript
const LOOP_GUARDS = {
  maxIterations: 50,          // 最大迭代次数
  maxNestedLoops: 3,          // 最大嵌套层数
  timeoutPerIteration: 30000, // 单次迭代超时
  totalTimeout: 300000,       // 总超时时间
};
```

### 8.2 条件评估失败处理

```typescript
async function evaluateWithFallback(
  expression: ConditionExpression,
  context: ExecutionContext
): Promise<boolean> {
  try {
    return await conditionEngine.evaluate(expression, context);
  } catch (error) {
    console.warn('条件评估失败，使用默认值 false', error);
    return false;
  }
}
```

---

## 9. 存储设计

### 9.1 路径统计数据

```typescript
interface PathStatistics {
  testCaseId: string;
  pathId: string;              // 路径标识（条件组合）
  executionCount: number;
  successCount: number;
  avgDuration: number;
  lastExecuted: number;
}
```

### 9.2 变量快照

```typescript
interface VariableSnapshot {
  executionId: string;
  stepId: string;
  timestamp: number;
  variables: Record<string, any>;
}
```

---

## 10. 优势总结

1. **声明式语法**：自然语言描述，易于理解和维护
2. **灵活控制**：支持复杂的条件和循环逻辑
3. **智能适应**：自动响应页面状态变化
4. **安全保护**：内置循环限制和超时机制
5. **无缝集成**：扩展现有架构，保持向后兼容
