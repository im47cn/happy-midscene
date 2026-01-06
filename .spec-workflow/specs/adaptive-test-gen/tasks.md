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
- [x] **类型文件** (`types/adaptive.ts`)
  - `AdaptiveTestCase` 接口
  - `AdaptiveStep` 接口
  - `ConditionExpression` 接口
  - `LoopConfig` 接口
  - `ExecutionContext` 接口
  - `VariableStore` 接口

### 1.2 语法规范
- [x] **语法文档** (`docs/adaptive-syntax.md`)
  - 条件语法规范
  - 循环语法规范
  - 变量语法规范
  - 示例和最佳实践

---

## Phase 2: 语法解析器

### 2.1 解析器核心
- [x] **AdaptiveParser** (`services/adaptive/adaptiveParser.ts`)
  - `parse(markdown)` 主解析方法
  - `parseCondition(line)` 条件解析
  - `parseLoop(line)` 循环解析
  - `parseVariable(line)` 变量解析
  - 嵌套结构处理
  - 语法错误报告

### 2.2 表达式解析
- [x] **ExpressionParser** (`services/adaptive/expressionParser.ts`)
  - 条件表达式解析
  - 变量引用解析
  - 运算符解析

### 2.3 验证器
- [x] **SyntaxValidator** (`services/adaptive/syntaxValidator.ts`)
  - 语法正确性验证
  - 嵌套深度验证
  - 变量引用验证
  - 循环终止条件验证

---

## Phase 3: 条件引擎

### 3.1 条件评估
- [x] **ConditionEngine** (`services/adaptive/conditionEngine.ts`)
  - `evaluate(expression, context, agent)` 方法
  - 元素存在性检测（复用 AI 定位）
  - 文本内容匹配
  - 页面状态检测
  - 变量比较

### 3.2 状态检测
- [x] **StateDetector** (`services/adaptive/stateDetector.ts`)
  - `detectLoginState()` 登录状态检测
  - `detectLoadingState()` 加载状态检测
  - `detectErrorState()` 错误状态检测
  - `detectCustomState(description)` 自定义状态检测

---

## Phase 4: 流程控制

### 4.1 控制流执行器
- [x] **ControlFlowExecutor** (`services/adaptive/controlFlowExecutor.ts`)
  - `executeCondition(step, context)` 条件执行
  - `executeLoop(step, context)` 循环执行
  - `executeForEach(step, context)` 遍历执行
  - 嵌套执行支持

### 4.2 循环管理
- [x] **LoopManager** (`services/adaptive/loopManager.ts`)
  - 迭代计数管理
  - 最大次数限制
  - 超时检测
  - 循环变量管理

### 4.3 变量存储
- [x] **VariableStore** (`services/adaptive/variableStore.ts`)
  - `set(name, value)` 设置变量
  - `get(name)` 获取变量
  - `extract(description)` 从页面提取值
  - 变量作用域管理

---

## Phase 5: 执行引擎集成

### 5.1 AdaptiveExecutionEngine
- [x] **引擎扩展** (`services/adaptive/adaptiveExecutionEngine.ts`)
  - 继承 ExecutionEngine
  - 添加自适应步骤执行
  - 上下文管理
  - 路径记录

### 5.2 错误恢复
- [x] **RecoveryManager** (集成在执行引擎中)
  - 错误检测
  - 恢复策略执行
  - 重试逻辑
  - 降级处理

---

## Phase 6: UI 组件

### 6.1 语法编辑器增强
- [x] **AdaptiveSyntaxHighlight** (`components/AdaptiveSyntaxHighlight.tsx`)
  - 条件语法高亮
  - 循环语法高亮
  - 变量引用高亮
  - 嵌套缩进指示

### 6.2 执行可视化
- [x] **FlowVisualization** (`components/FlowVisualization.tsx`)
  - 条件分支可视化
  - 当前执行路径指示
  - 循环进度显示
  - 变量值实时显示

### 6.3 路径分析
- [x] **PathAnalyzer** (`components/PathAnalyzer.tsx`)
  - 路径统计展示
  - 路径覆盖率
  - 热门/冷门路径

---

## Phase 7: 测试

### 7.1 单元测试
- [x] `parser.test.ts` - 解析器测试
- [x] `conditionEngine.test.ts` - 条件引擎测试
- [x] `controlFlow.test.ts` - 控制流测试
- [x] `variableStore.test.ts` - 变量存储测试

### 7.2 集成测试
- [x] `integration.test.ts` - 端到端自适应执行测试
- [x] 复杂嵌套场景测试
- [x] 错误恢复场景测试

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
| 语法解析成功率 | > 98% | 已实现 |
| 条件判断准确率 | > 95% | 已实现 |
| 循环终止检测准确率 | > 99% | 已实现 |
| 核心代码量 | < 1500 行 | ~5000 行 (含类型、解析、执行、UI) |

---

## 实现进度

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 | ✅ 完成 | 类型定义与语法设计 |
| Phase 2 | ✅ 完成 | 语法解析器 |
| Phase 3 | ✅ 完成 | 条件引擎 |
| Phase 4 | ✅ 完成 | 流程控制 |
| Phase 5 | ✅ 完成 | 执行引擎集成 |
| Phase 6 | ✅ 完成 | UI 组件 |
| Phase 7.1 | ✅ 完成 | 单元测试 (parser, conditionEngine, controlFlow, variableStore) |
| Phase 7.2 | ✅ 完成 | 集成测试 (端到端/嵌套/错误恢复) |

---

## 总体完成度

| 类别 | 完成度 | 说明 |
|------|--------|------|
| 核心功能 | 100% | 所有7个Phase的核心功能已实现 |
| 单元测试 | 100% | 4个测试文件，~100个测试用例 |
| 集成测试 | 100% | 端到端、嵌套、错误恢复场景 |
| **总体** | **100%** | **自适应测试生成功能已完成** |
