# 测试用例推荐 - 任务清单

## 设计决策

**采用混合推荐策略**：结合规则引擎和机器学习方法，实现高准确率的测试用例推荐。

核心特点：
- 基于历史数据的智能推荐
- 多维度优先级排序
- 用户反馈持续优化

---

## Phase 1: 类型定义与数据模型

### 1.1 类型定义
- [ ] **类型文件** (`types/recommendation.ts`)
  - `Recommendation` 接口
  - `RecommendReason` 接口
  - `PriorityConfig` 接口
  - `CaseCorrelation` 接口
  - `CoverageData` 接口
  - `Feedback` 接口

### 1.2 存储扩展
- [ ] **推荐数据存储** (`services/recommendation/storage.ts`)
  - 用户反馈存储
  - 关联关系缓存
  - 推荐历史记录

---

## Phase 2: 推荐引擎核心

### 2.1 推荐引擎
- [ ] **RecommendEngine** (`services/recommendation/recommendEngine.ts`)
  - `getRecommendations(options)` 获取推荐列表
  - `getRecommendationsForChange(changeInfo)` 变更影响推荐
  - `getRegressionSet(type)` 回归测试集
  - `recordFeedback(id, feedback)` 记录反馈
  - 推荐策略管理

### 2.2 评分计算
- [ ] **ScoreCalculator** (`services/recommendation/scoreCalculator.ts`)
  - `calculateRecommendScore()` 综合评分
  - `calculateRiskScore()` 风险评分
  - `calculateRecencyScore()` 时效评分
  - `calculateCoverageScore()` 覆盖率评分

---

## Phase 3: 优先级排序

### 3.1 优先级排序器
- [ ] **PriorityRanker** (`services/recommendation/priorityRanker.ts`)
  - `rankCases(caseIds, config)` 批量排序
  - `getPriority(caseId)` 获取单个优先级
  - `updateConfig(config)` 更新配置
  - 多因素权重计算

### 3.2 优先级配置
- [ ] **PriorityConfigManager** (`services/recommendation/configManager.ts`)
  - 默认配置管理
  - 用户自定义配置
  - 配置持久化

---

## Phase 4: 关联分析

### 4.1 关联发现器
- [ ] **CorrelationFinder** (`services/recommendation/correlationFinder.ts`)
  - `findCorrelations(caseId)` 查找关联
  - `getRelatedCases(caseId, depth)` 获取相关用例
  - `refreshCorrelations()` 刷新关联数据
  - 共同失败模式识别
  - 执行顺序依赖分析

### 4.2 关联图谱
- [ ] **CorrelationGraph** (`services/recommendation/correlationGraph.ts`)
  - 图结构构建
  - 路径查找算法
  - 聚类分析

---

## Phase 5: 覆盖率分析

### 5.1 覆盖率分析器
- [ ] **CoverageAnalyzer** (`services/recommendation/coverageAnalyzer.ts`)
  - `analyzeFeatureCoverage()` 功能覆盖率
  - `analyzePageCoverage()` 页面覆盖率
  - `analyzePathCoverage()` 路径覆盖率
  - `identifyGaps()` 识别覆盖盲区

### 5.2 覆盖率报告
- [ ] **CoverageReporter** (`services/recommendation/coverageReporter.ts`)
  - 覆盖率统计
  - 趋势分析
  - 改进建议

---

## Phase 6: 变更影响分析

### 6.1 变更分析器
- [ ] **ChangeAnalyzer** (`services/recommendation/changeAnalyzer.ts`)
  - `analyzeImpact(changes)` 分析变更影响
  - `mapChangesToCases()` 变更-用例映射
  - `suggestTests(changes)` 推荐测试
  - 依赖关系追踪

### 6.2 变更规则
- [ ] **ChangeRules** (`services/recommendation/changeRules.ts`)
  - 文件-用例映射规则
  - 组件依赖规则
  - 自定义规则配置

---

## Phase 7: 反馈系统

### 7.1 反馈追踪器
- [ ] **FeedbackTracker** (`services/recommendation/feedbackTracker.ts`)
  - `recordFeedback(feedback)` 记录反馈
  - `analyzeFeedback()` 分析反馈数据
  - `adjustWeights()` 调整权重
  - 反馈统计

### 7.2 学习优化
- [ ] **LearningOptimizer** (`services/recommendation/learningOptimizer.ts`)
  - 反馈学习算法
  - 权重自动调整
  - A/B 测试支持

---

## Phase 8: UI 组件

### 8.1 推荐面板
- [ ] **RecommendationPanel** (`components/RecommendationPanel.tsx`)
  - 推荐列表展示
  - 分类视图
  - 理由说明
  - 快速选择

### 8.2 优先级视图
- [ ] **PriorityView** (`components/PriorityView.tsx`)
  - 优先级分布图
  - 权重调节器
  - 因素分析图

### 8.3 覆盖率仪表板
- [ ] **CoverageDashboard** (`components/CoverageDashboard.tsx`)
  - 覆盖率概览
  - 盲区高亮
  - 改进建议

### 8.4 关联图可视化
- [ ] **CorrelationGraphView** (`components/CorrelationGraphView.tsx`)
  - 交互式图谱
  - 节点详情
  - 路径高亮

---

## Phase 9: 测试

### 9.1 单元测试
- [ ] `recommendEngine.test.ts` - 推荐引擎测试
- [ ] `priorityRanker.test.ts` - 优先级排序测试
- [ ] `correlationFinder.test.ts` - 关联分析测试
- [ ] `coverageAnalyzer.test.ts` - 覆盖率分析测试
- [ ] `feedbackTracker.test.ts` - 反馈追踪测试

### 9.2 集成测试
- [ ] 端到端推荐流程测试
- [ ] 反馈学习效果测试
- [ ] 性能基准测试

---

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── types/
│   └── recommendation.ts            # 类型定义
├── services/
│   ├── recommendation/
│   │   ├── index.ts                 # 模块导出
│   │   ├── recommendEngine.ts       # 推荐引擎
│   │   ├── scoreCalculator.ts       # 评分计算
│   │   ├── priorityRanker.ts        # 优先级排序
│   │   ├── configManager.ts         # 配置管理
│   │   ├── correlationFinder.ts     # 关联发现
│   │   ├── correlationGraph.ts      # 关联图谱
│   │   ├── coverageAnalyzer.ts      # 覆盖率分析
│   │   ├── changeAnalyzer.ts        # 变更分析
│   │   ├── feedbackTracker.ts       # 反馈追踪
│   │   ├── learningOptimizer.ts     # 学习优化
│   │   ├── storage.ts               # 数据存储
│   │   └── __tests__/
│   │       ├── recommendEngine.test.ts
│   │       ├── priorityRanker.test.ts
│   │       └── correlationFinder.test.ts
└── components/
    ├── RecommendationPanel.tsx      # 推荐面板
    ├── PriorityView.tsx             # 优先级视图
    ├── CoverageDashboard.tsx        # 覆盖率仪表板
    └── CorrelationGraphView.tsx     # 关联图可视化
```

---

## 依赖关系

```
types/recommendation.ts
       │
       ▼
services/recommendation/storage.ts
       │
       ▼
services/recommendation/scoreCalculator.ts
       │
       ├───────────────────┐
       ▼                   ▼
priorityRanker.ts   correlationFinder.ts
       │                   │
       └─────────┬─────────┘
                 ▼
      recommendEngine.ts ◀── changeAnalyzer.ts
                 │            coverageAnalyzer.ts
                 │            feedbackTracker.ts
                 ▼
    components/RecommendationPanel.tsx
```

---

## 验收标准

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 推荐相关性 | > 80% | 待开发 |
| 推荐响应时间 | < 3s | 待开发 |
| 反馈采纳改进率 | > 10%/周 | 待开发 |
| 代码覆盖率 | > 85% | 待开发 |

---

## 实现进度

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 | 待开始 | 类型定义与数据模型 |
| Phase 2 | 待开始 | 推荐引擎核心 |
| Phase 3 | 待开始 | 优先级排序 |
| Phase 4 | 待开始 | 关联分析 |
| Phase 5 | 待开始 | 覆盖率分析 |
| Phase 6 | 待开始 | 变更影响分析 |
| Phase 7 | 待开始 | 反馈系统 |
| Phase 8 | 待开始 | UI 组件 |
| Phase 9 | 待开始 | 测试 |
