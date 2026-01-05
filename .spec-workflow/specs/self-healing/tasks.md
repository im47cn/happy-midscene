# 测试用例自愈 (Self-Healing) - 任务清单

## 设计决策

**采用简化方案**：完全复用 Midscene AI 能力，不实现传统视觉/文本匹配策略。

核心变化：
- 4 种策略 → 2 层策略（Normal + DeepThink）
- 复杂指纹 → 轻量语义指纹
- 零额外依赖

---

## API 可用性确认 ✅

### ChromeExtensionProxyPageAgent 继承链
```
ChromeExtensionProxyPageAgent
    └── extends Agent<AbstractInterface>  (@midscene/core)
```

### 可用 API

| API | 用途 | 说明 |
|-----|------|------|
| `describeElementAtPoint(center, opt)` | 生成语义指纹 | 返回 `{ prompt, deepThink, verifyResult }` |
| `aiLocate(prompt, opt)` | 自愈重定位 | 支持 `{ deepThink: true }` 选项 |
| `agent.dump` | 获取执行记录 | 包含 Locate 任务的元素坐标 |

### 元素坐标获取方案

`aiAct` 执行后，从 `agent.dump` 中提取定位信息：

```typescript
// 从 dump 中提取最后一次 Locate 任务的结果
const lastExecution = agent.dump.executions[agent.dump.executions.length - 1];
const locateTasks = lastExecution.tasks.filter(t => t.subType === 'Locate');
const lastLocate = locateTasks[locateTasks.length - 1];
const element = lastLocate?.output?.element;  // { center, rect, description }
```

**结论**：无需修改 Midscene core，所有 API 均可在 Chrome Extension 中直接使用。

---

## Phase 1: 核心类型与存储 ✅

### 1.1 类型定义
- [x] **类型文件** (`types/healing.ts`)
  - `SemanticFingerprint` 接口
  - `HealingResult` 接口
  - `HealingHistoryEntry` 接口
  - `SelfHealingConfig` 接口
  - `HealingStatistics` 接口

### 1.2 存储层
- [x] **存储抽象** (`services/healing/storage.ts`)
  - `IFingerprintStorage` 接口定义
  - `IHealingHistoryStorage` 接口定义
  - CRUD 操作抽象

- [x] **IndexedDB 实现** (`services/healing/storage.ts`)
  - Schema 定义与迁移
  - `fingerprints` store 实现
  - `healing-history` store 实现
  - 自动清理过期数据

- [ ] **文件系统实现** [可选，未实现]
  - JSON 文件存储
  - 用于 CLI/Node.js 环境

---

## Phase 2: 自愈引擎核心 ✅

### 2.1 指纹采集
- [x] **指纹采集** (`services/healing/healingEngine.ts`)
  - `collectFingerprint(stepId, elementCenter, elementRect)` 方法
  - 调用 `agent.describeElementAtPoint()` 生成语义描述
  - 存储指纹到 IndexedDB

### 2.2 置信度计算
- [x] **置信度计算器** (`services/healing/confidenceCalculator.ts`)
  - `calculateConfidence(newCenter, newRect, fingerprint, strategy)` 方法
  - 距离评分 (40%)
  - 尺寸评分 (30%)
  - 策略评分 (30%)
  - `determineAction(confidence, threshold)` 方法

### 2.3 自愈引擎
- [x] **自愈引擎** (`services/healing/healingEngine.ts`)
  - `heal(stepId, originalDescription)` 方法
  - Normal 模式尝试
  - DeepThink 模式尝试
  - 置信度计算与判断
  - `confirmHealing(healingId, accepted)` 方法
  - `getStatistics()` 方法

---

## Phase 3: 集成 ✅

### 3.1 ExecutionEngine 集成
- [x] **修改 ExecutionEngine** (`services/executionEngine.ts`)
  - 添加 `selfHealingConfig` 配置
  - 添加 `extractElementFromDump()` 方法提取元素坐标
  - 步骤成功时调用指纹采集
  - 定位失败时触发自愈 (`tryHealing` 方法)
  - 根据置信度决定自动采用或请求确认
  - 添加 `onHealingAttempt` 和 `onHealingConfirmRequest` 回调

### 3.2 配置集成
- [x] **配置管理**
  - `DEFAULT_SELF_HEALING_CONFIG` 默认配置
  - `setSelfHealingConfig()` 方法
  - `getSelfHealingConfig()` 方法

---

## Phase 4: UI 组件 ✅

### 4.1 确认弹窗
- [x] **自愈确认弹窗** (`components/HealingConfirmDialog.tsx`)
  - 展示原始描述和新定位
  - 展示置信度分数（带进度条和颜色编码）
  - 展示策略信息（标准模式/深度思考）
  - 展示置信度因子明细
  - 确认/拒绝 操作

### 4.2 ExecutionView 集成
- [x] **ExecutionView 更新** (`components/ExecutionView.tsx`)
  - 添加自愈状态管理
  - 添加自愈回调处理
  - 显示自愈加载提示
  - 显示自愈成功消息

### 4.3 统计面板 ✅
- [x] **自愈统计面板** (`components/HealingStatistics.tsx`)
  - 成功率展示
  - 高频自愈元素列表
  - 策略使用统计

---

## Phase 5: 测试 ✅

- [x] **单元测试**
  - `confidenceCalculator.test.ts` (13 tests)
  - `healingEngine.test.ts` (19 tests)
  - 测试覆盖：配置、指纹采集、自愈流程、置信度计算、统计

- [x] **集成测试** [可选]
  - `integration.test.ts` (15 tests)
  - 端到端自愈流程测试
  - 模拟 UI 变化场景

---

## 文件结构（实际实现）

```
apps/chrome-extension/src/extension/ai-test-generator/
├── types/
│   └── healing.ts                    # 类型定义 ✅
├── services/
│   ├── healing/
│   │   ├── index.ts                  # 模块导出 ✅
│   │   ├── storage.ts                # IndexedDB 存储 ✅
│   │   ├── confidenceCalculator.ts   # 置信度计算 ✅
│   │   ├── healingEngine.ts          # 自愈引擎 ✅
│   │   └── __tests__/
│   │       ├── confidenceCalculator.test.ts  # 13 tests ✅
│   │       ├── healingEngine.test.ts         # 19 tests ✅
│   │       └── integration.test.ts          # 15 integration tests ✅
│   ├── executionEngine.ts            # 已集成自愈 ✅
│   └── index.ts                      # 已导出 healing ✅
└── components/
    ├── HealingConfirmDialog.tsx      # 确认弹窗 ✅
    ├── ExecutionView.tsx             # 已集成自愈 ✅
    └── index.ts                      # 已导出组件 ✅
```

---

## 依赖关系

```
types/healing.ts
       │
       ▼
services/healing/storage.ts
       │
       ▼
services/healing/confidenceCalculator.ts
       │
       ▼
services/healing/healingEngine.ts
       │
       ▼
services/executionEngine.ts (集成)
       │
       ▼
components/ExecutionView.tsx
       │
       ▼
components/HealingConfirmDialog.tsx
```

---

## 验收标准

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 指纹采集成功率 | > 95% | 待测试 |
| 自愈成功率 | > 80% | 待测试 |
| 单次自愈耗时 | < 10s | 待测试 |
| 误修复率 | < 5% | 待测试 |
| 核心代码量 | < 500 行 | ✅ 约 400 行 |

---

## 实现进度

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 | ✅ 完成 | 类型定义和 IndexedDB 存储 |
| Phase 2 | ✅ 完成 | 自愈引擎核心逻辑 |
| Phase 3 | ✅ 完成 | ExecutionEngine 集成 |
| Phase 4 | ✅ 完成 | UI 组件（确认弹窗） |
| Phase 5 | ✅ 完成 | 单元测试 (47 tests passing) |

**功能完成**：所有 MVP 功能已实现并通过测试
