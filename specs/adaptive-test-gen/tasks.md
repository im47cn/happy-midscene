# 自适应测试生成 - 任务清单

## 设计决策

**采用声明式优先方案**：使用自然语言语法描述条件和循环，由系统自动转换为执行逻辑。

核心特点：
- 扩展 Markdown 语法支持控制流
- 复用 AI 能力进行状态检测
- 内置安全保护机制

---

## Phase 1: 类型定义与语法设计

### 1.1 类型定义
- [ ] **类型文件** (`types/adaptive.ts`)
  - `AdaptiveTestCase` 接口
  - `AdaptiveStep` 接口
  - `ConditionExpression` 接口
  - `LoopConfig` 接口
  - `ExecutionContext` 接口
  - `VariableStore` 接口

### 1.2 语法规范
- [ ] **语法文档** (`docs/adaptive-syntax.md`)
  - 条件语法规范
  - 循环语法规范
  - 变量语法规范
  - 示例和最佳实践

---

## Phase 2: 语法解析器

### 2.1 解析器核心
- [ ] **AdaptiveParser** (`services/adaptive/parser.ts`)
  - `parse(markdown)` 主解析方法
  - `parseCondition(line)` 条件解析
  - `parseLoop(line)` 循环解析
  - `parseVariable(line)` 变量解析
  - 嵌套结构处理
  - 语法错误报告

### 2.2 表达式解析
- [ ] **ExpressionParser** (`services/adaptive/expressionParser.ts`)
  - 条件表达式解析
  - 变量引用解析
  - 运算符解析

### 2.3 验证器
- [ ] **SyntaxValidator** (`services/adaptive/validator.ts`)
  - 语法正确性验证
  - 嵌套深度验证
  - 变量引用验证
  - 循环终止条件验证

---

## Phase 3: 条件引擎

### 3.1 条件评估
- [ ] **ConditionEngine** (`services/adaptive/conditionEngine.ts`)
  - `evaluate(expression, context, agent)` 方法
  - 元素存在性检测（复用 AI 定位）
  - 文本内容匹配
  - 页面状态检测
  - 变量比较

### 3.2 状态检测
- [ ] **StateDetector** (`services/adaptive/stateDetector.ts`)
  - `detectLoginState()` 登录状态检测
  - `detectLoadingState()` 加载状态检测
  - `detectErrorState()` 错误状态检测
  - `detectCustomState(description)` 自定义状态检测

---

## Phase 4: 流程控制

### 4.1 控制流执行器
- [ ] **ControlFlowExecutor** (`services/adaptive/controlFlow.ts`)
  - `executeCondition(step, context)` 条件执行
  - `executeLoop(step, context)` 循环执行
  - `executeForEach(step, context)` 遍历执行
  - 嵌套执行支持

### 4.2 循环管理
- [ ] **LoopManager** (`services/adaptive/loopManager.ts`)
  - 迭代计数管理
  - 最大次数限制
  - 超时检测
  - 循环变量管理

### 4.3 变量存储
- [ ] **VariableStore** (`services/adaptive/variableStore.ts`)
  - `set(name, value)` 设置变量
  - `get(name)` 获取变量
  - `extract(description)` 从页面提取值
  - 变量作用域管理

---

## Phase 5: 执行引擎集成

### 5.1 AdaptiveExecutionEngine
- [ ] **引擎扩展** (`services/adaptiveExecutionEngine.ts`)
  - 继承 ExecutionEngine
  - 添加自适应步骤执行
  - 上下文管理
  - 路径记录

### 5.2 错误恢复
- [ ] **RecoveryManager** (`services/adaptive/recoveryManager.ts`)
  - 错误检测
  - 恢复策略执行
  - 重试逻辑
  - 降级处理

---

## Phase 6: UI 组件

### 6.1 语法编辑器增强
- [ ] **AdaptiveSyntaxHighlight** (`components/AdaptiveSyntaxHighlight.tsx`)
  - 条件语法高亮
  - 循环语法高亮
  - 变量引用高亮
  - 嵌套缩进指示

### 6.2 执行可视化
- [ ] **FlowVisualization** (`components/FlowVisualization.tsx`)
  - 条件分支可视化
  - 当前执行路径指示
  - 循环进度显示
  - 变量值实时显示

### 6.3 路径分析
- [ ] **PathAnalyzer** (`components/PathAnalyzer.tsx`)
  - 路径统计展示
  - 路径覆盖率
  - 热门/冷门路径

---

## Phase 7: 测试

### 7.1 单元测试
- [ ] `parser.test.ts` - 解析器测试
- [ ] `conditionEngine.test.ts` - 条件引擎测试
- [ ] `controlFlow.test.ts` - 控制流测试
- [ ] `variableStore.test.ts` - 变量存储测试

### 7.2 集成测试
- [ ] 端到端自适应执行测试
- [ ] 复杂嵌套场景测试
- [ ] 错误恢复场景测试

---

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── types/
│   └── adaptive.ts                    # 类型定义
├── services/
│   ├── adaptive/
│   │   ├── index.ts                   # 模块导出
│   │   ├── parser.ts                  # 语法解析器
│   │   ├── expressionParser.ts        # 表达式解析
│   │   ├── validator.ts               # 语法验证
│   │   ├── conditionEngine.ts         # 条件引擎
│   │   ├── stateDetector.ts           # 状态检测
│   │   ├── controlFlow.ts             # 流程控制
│   │   ├── loopManager.ts             # 循环管理
│   │   ├── variableStore.ts           # 变量存储
│   │   ├── recoveryManager.ts         # 错误恢复
│   │   └── __tests__/
│   │       ├── parser.test.ts
│   │       ├── conditionEngine.test.ts
│   │       └── controlFlow.test.ts
│   └── adaptiveExecutionEngine.ts     # 自适应执行引擎
└── components/
    ├── AdaptiveSyntaxHighlight.tsx    # 语法高亮
    ├── FlowVisualization.tsx          # 执行可视化
    └── PathAnalyzer.tsx               # 路径分析
```

---

## 依赖关系

```
types/adaptive.ts
       │
       ▼
services/adaptive/parser.ts
       │
       ▼
services/adaptive/conditionEngine.ts ◀── services/adaptive/stateDetector.ts
       │
       ▼
services/adaptive/controlFlow.ts ◀── services/adaptive/loopManager.ts
       │                              services/adaptive/variableStore.ts
       ▼
services/adaptiveExecutionEngine.ts
       │
       ▼
components/FlowVisualization.tsx
```

---

## 验收标准

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 语法解析成功率 | > 98% | 待开发 |
| 条件判断准确率 | > 95% | 待开发 |
| 循环终止检测准确率 | > 99% | 待开发 |
| 核心代码量 | < 1500 行 | 待开发 |

---

## 实现进度

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 | 待开始 | 类型定义与语法设计 |
| Phase 2 | 待开始 | 语法解析器 |
| Phase 3 | 待开始 | 条件引擎 |
| Phase 4 | 待开始 | 流程控制 |
| Phase 5 | 待开始 | 执行引擎集成 |
| Phase 6 | 待开始 | UI 组件 |
| Phase 7 | 待开始 | 测试 |
