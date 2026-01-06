# 自适应测试生成 - 用户手册

## 功能概述

自适应测试生成（Adaptive Test Generation）是 AI Test Generator 的核心功能之一，它允许测试用例根据页面状态动态调整执行路径。通过扩展的 Markdown 语法，您可以：

- **条件分支**：根据页面状态选择不同的执行路径
- **循环控制**：重复执行步骤直到满足条件
- **变量管理**：存储和复用测试过程中的数据
- **动态响应**：根据实际页面状态调整测试行为

与传统线性测试不同，自适应测试可以：

1. 处理不确定的页面状态
2. 根据实际执行结果调整后续步骤
3. 减少测试用例数量（一个测试覆盖多种场景）
4. 提高测试的健壮性和可维护性

## 工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│                     自适应测试执行流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │ Markdown│ ──▶│  语法   │ ──▶│ 控制流  │ ──▶│ AI 执行 │      │
│  │ 测试步骤│    │  解析   │    │  引擎   │    │  引擎   │      │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│                                  │                              │
│                                  ▼                              │
│                        ┌──────────────────┐                      │
│                        │   条件评估       │                      │
│                        │ (aiLocate + AI)  │                      │
│                        └──────────────────┘                      │
│                                  │                              │
│                                  ▼                              │
│                        ┌──────────────────┐                      │
│                        │   变量存储       │                      │
│                        │  (VariableStore) │                      │
│                        └──────────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 核心组件

1. **AdaptiveParser**：解析扩展 Markdown 语法，提取控制流结构
2. **ConditionEngine**：评估条件表达式，使用 AI 检测页面状态
3. **ControlFlowExecutor**：执行条件分支和循环逻辑
4. **VariableStore**：管理测试过程中的变量存储和替换
5. **AdaptiveExecutionEngine**：集成所有组件，提供完整的执行环境

## 快速开始

### 基本条件分支

```markdown
name: "登录测试"

steps:
  - 如果 "登录按钮存在"
    - 点击"登录按钮"
  - 否则
    - 点击"注册按钮"
```

### 基本循环

```markdown
name: "分页数据加载"

steps:
  - 重复 3 次
    - 点击"下一页按钮"
    - 等待"数据加载完成"
```

### 使用变量

```markdown
name: "用户信息填写"

variables:
  username: "testuser"
  email: "test@example.com"

steps:
  - 在"用户名输入框"中输入 $username
  - 在"邮箱输入框"中输入 $email
```

## 扩展语法

### 条件语法

#### 如果-否则（if-else）

使用 `如果` 关键字开始条件分支，`否则` 处理不满足条件的情况：

```markdown
- 如果 [条件表达式]
  - 步骤 A
  - 步骤 B
- 否则
  - 步骤 C
```

#### 条件表达式

条件表达式使用自然语言描述，AI 会自动解析：

```markdown
# 存在性检测
- 如果 "登录按钮存在"

# 可见性检测
- 如果 "弹窗可见"

# 数量检测
- 如果 "列表项数量大于 5"

# 文本检测
- 如果 "标题包含'成功'"
- 如果 "错误消息等于'登录失败'"

# 状态检测
- 如果 "按钮已禁用"
- 如果 "复选框已选中"
```

### 循环语法

#### 计数循环（重复 N 次）

```markdown
- 重复 3 次
  - 点击"下一页"
  - 等待"加载完成"
```

#### 条件循环（直到满足条件）

```markdown
- 重复直到"加载完成提示可见"
  - 点击"刷新按钮"
  - 等待 1 秒
```

#### 条件循环（当满足条件时）

```markdown
- 重复当"还有更多数据"
  - 点击"下一页"
  - 收集数据
```

#### 遍历循环（对于每个元素）

```markdown
- 对于每个"列表项"
  - 点击"当前项"
  - 验证"详情页显示"
  - 返回"列表页"
```

### 变量语法

#### 变量定义

在测试用例开头定义初始变量：

```markdown
variables:
  username: "testuser"
  password: "pass123"
  count: 0
```

#### 变量设置

在执行过程中设置变量：

```markdown
- 设置 $username = "admin"
- 设置 $count = $count + 1
```

#### 变量提取

从页面元素提取值到变量：

```markdown
- 设置 $orderId = [订单号文本]
- 设置 $totalPrice = [总价数字]
```

#### 变量使用

在步骤中使用变量：

```markdown
- 在"用户名输入框"中输入 $username
- 点击"订单 $orderId 按钮"
```

## 条件与循环

### 嵌套条件

支持多层嵌套的条件判断：

```markdown
- 如果 "用户已登录"
  - 如果 "有购物车商品"
    - 点击"结算按钮"
  - 否则
    - 点击"继续购物按钮"
- 否则
  - 点击"登录按钮"
```

### 嵌套循环

支持循环内部嵌套条件或其他循环：

```markdown
- 对于每个"商品分类"
  - 点击"分类"
  - 重复直到"到达页面底部"
    - 点击"下一页"
    - 对于每个"商品卡片"
      - 如果 "商品有货"
        - 点击"加入购物车"
```

### 安全限制

为防止无限循环，系统设置了以下安全限制：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `maxLoopIterations` | 100 | 单个循环最大迭代次数 |
| `maxNestedDepth` | 5 | 最大嵌套深度 |
| `totalTimeout` | 300000ms | 总执行超时时间 |
| `stepTimeout` | 30000ms | 单步执行超时时间 |

## 变量系统

### 变量类型

支持多种变量类型：

```javascript
// 字符串
$username = "testuser"

// 数字
$count = 10
$price = 99.99

// 布尔值
$isActive = true

// 数组
$items = ["item1", "item2", "item3"]

// 对象
$user = {
  name: "John",
  age: 30
}
```

### 变量作用域

- **测试用例级别**：在 `variables` 中定义的变量在整个测试用例中可用
- **步骤级别**：使用 `设置` 创建的变量在后续步骤中可用
- **循环作用域**：循环变量（如遍历循环的当前项）仅在循环体内可用

### 变量插值

在文本中使用 `${变量名}` 进行插值：

```markdown
- 在"搜索框"中输入 "搜索关键词: ${keyword}"
- 点击"第 ${page} 页按钮"
```

### 变量快照

系统会在关键节点自动保存变量快照：

- 条件分支前
- 循环迭代前后
- 每个步骤执行后

这有助于调试和回溯执行历史。

## API 参考

### AdaptiveExecutionEngine

主要的执行引擎类。

```typescript
import { getAdaptiveExecutionEngine } from './services/adaptive';

const engine = getAdaptiveExecutionEngine(getAgent, {
  totalTimeout: 300000,
  stepTimeout: 30000,
  debug: true
});
```

#### 方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `executeAdaptiveTestCase()` | `testCase`, `context` | `Promise<AdaptiveExecutionResult>` | 执行自适应测试用例 |
| `pause()` | - | `void` | 暂停执行 |
| `resume()` | - | `void` | 恢复执行 |
| `stop()` | - | `void` | 停止执行 |
| `getVariables()` | - | `Record<string, any>` | 获取当前所有变量 |
| `getConfig()` | - | `AdaptiveConfig` | 获取当前配置 |

### 类型定义

```typescript
interface AdaptiveTestCase {
  name: string;
  description?: string;
  variables: Record<string, any>;
  steps: AdaptiveStep[];
}

interface AdaptiveStep {
  id: string;
  description: string;
  action?: string;
  condition?: {
    expression: string;
  };
  loop?: {
    type: 'count' | 'while' | 'until' | 'forEach';
    count?: number;
    target?: string;
  };
  variable?: {
    name: string;
    operation: 'set' | 'extract';
    value?: any;
    source?: string;
  };
}

interface AdaptiveExecutionResult {
  success: boolean;
  results: ExtendedStepResult[];
  executionStats: {
    totalSteps: number;
    executedBranches: number;
    loopIterations: number;
    maxDepth: number;
    totalDuration: number;
  };
  finalContext: Partial<AdaptiveExecutionContext>;
  pathHistory: string[];
  yamlContent: string;
}
```

### 回调事件

```typescript
interface AdaptiveExecutionCallbacks {
  // 步骤生命周期
  onAdaptiveStepStart?: (step: AdaptiveStep, depth: number) => void;
  onAdaptiveStepComplete?: (step: AdaptiveStep, result: ExtendedStepResult) => void;
  onAdaptiveStepFailed?: (step: AdaptiveStep, error: Error) => void;

  // 流程控制事件
  onConditionEvaluated?: (stepId: string, expression: string, result: boolean) => void;
  onLoopIteration?: (stepId: string, iteration: number, total: number) => void;
  onVariableChanged?: (event: VariableChangeEvent) => void;

  // 路径事件
  onBranchTaken?: (stepId: string, branch: 'then' | 'else') => void;
  onPathChanged?: (path: string[]) => void;

  // 进度事件
  onDepthChanged?: (currentDepth: number, maxDepth: number) => void;
}
```

## 最佳实践

### 1. 保持条件简洁

使用清晰、简洁的条件表达式：

```markdown
# ✅ 好的做法
- 如果 "登录按钮可见"

# ❌ 避免
- 如果 "登录按钮在页面顶部中央位置可见且没有其他元素遮挡"
```

### 2. 合理使用变量

为重复使用的值定义变量：

```markdown
variables:
  baseUrl: "https://example.com"
  userCredentials:
    username: "testuser"
    password: "pass123"

steps:
  - 访问 $baseUrl
  - 在"用户名输入框"中输入 $userCredentials.username
```

### 3. 避免过深嵌套

嵌套深度不宜超过 3 层，考虑将复杂逻辑拆分为多个测试用例：

```markdown
# ❌ 避免：过深嵌套
- 如果 "条件A"
  - 如果 "条件B"
    - 如果 "条件C"
      - 如果 "条件D"
        - 执行操作

# ✅ 推荐：拆分测试用例
测试用例 A：验证条件 A 和 B
测试用例 B：验证条件 C 和 D
```

### 4. 使用循环避免重复

对于重复性操作，使用循环而不是复制粘贴：

```markdown
# ❌ 避免
- 点击"下一页"
- 等待"加载完成"
- 点击"下一页"
- 等待"加载完成"
- 点击"下一页"
- 等待"加载完成"

# ✅ 推荐
- 重复 3 次
  - 点击"下一页"
  - 等待"加载完成"
```

### 5. 添加描述性注释

为复杂的条件或循环添加注释：

```markdown
# 处理动态弹窗：可能存在广告弹窗或更新提示
- 如果 "关闭按钮存在"
  - 点击"关闭按钮"

# 分页加载所有数据，最多 10 页
- 重复直到"没有更多数据或到达第10页"
  - 点击"下一页"
  - 收集数据
```

### 6. 错误处理

为可能失败的操作添加条件判断：

```markdown
- 如果 "元素存在"
  - 与"元素"交互
- 否则
  - 记录"元素未找到，跳过此步骤"
```

### 7. 性能优化

- 使用 `直到` 循环代替固定 `重复` 当条件可能提前满足时
- 避免在循环内执行耗时操作（如长时间等待）
- 合理设置超时时间，避免无限等待

## 常见问题

### Q: 如何调试条件判断？

A: 启用调试模式查看详细的条件评估信息：

```typescript
const engine = getAdaptiveExecutionEngine(getAgent, {
  debug: true,
  verbose: true
});
```

### Q: 循环执行次数超出预期怎么办？

A: 检查循环终止条件是否正确，或调整安全限制配置：

```typescript
engine.setConfig({
  maxLoopIterations: 50,  // 降低最大迭代次数
  totalTimeout: 60000     // 缩短总超时时间
});
```

### Q: 变量在条件中不生效？

A: 确保变量在使用前已正确设置，并使用正确的插值语法 `${变量名}`：

```markdown
# ✅ 正确
- 如果 "标题包含 ${searchTerm}"

# ❌ 错误
- 如果 "标题包含 $searchTerm"
```

### Q: 如何处理异步加载的内容？

A: 使用 `重复直到` 循环配合等待条件：

```markdown
- 重复直到"内容加载完成或超时30秒"
  - 等待 1 秒
  - 如果 "加载中提示不可见"
    - 跳出循环
```

## 更新日志

### v1.0.0 (2025-01)

- 初始版本发布
- 支持条件分支（如果-否则）
- 支持循环控制（重复/直到/当/对于）
- 支持变量系统（设置/获取/插值）
- 集成 AI 状态检测
- 安全限制和超时保护
