# 测试用例推荐 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**数据驱动，持续学习**
- 基于历史数据构建推荐模型
- 通过用户反馈持续优化
- 平衡准确性和响应速度

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| 执行历史 | 作为推荐数据源 |
| 分析引擎 | 复用统计计算能力 |
| 用例管理 | 添加推荐属性和标签 |
| UI 组件 | 新增推荐展示面板 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Test Recommendation System                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │ RecommendEngine  │     │  PriorityRanker  │              │
│  │   (推荐引擎)      │────▶│   (优先级排序)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │ CorrelationFinder│     │  CoveragAnalyzer │              │
│  │   (关联发现器)    │◀───▶│   (覆盖率分析)   │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  ChangeAnalyzer  │     │  FeedbackTracker │              │
│  │   (变更分析器)    │     │   (反馈追踪器)   │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │ AnalyticsData │  ← 复用现有分析数据
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **RecommendEngine** | 核心推荐算法和策略管理 |
| **PriorityRanker** | 多维度优先级计算 |
| **CorrelationFinder** | 发现用例间关联关系 |
| **CoverageAnalyzer** | 分析测试覆盖率 |
| **ChangeAnalyzer** | 代码变更影响分析 |
| **FeedbackTracker** | 收集和应用用户反馈 |

---

## 3. 核心数据结构

### 3.1 推荐结果

```typescript
interface Recommendation {
  id: string;
  caseId: string;
  caseName: string;
  score: number;                    // 推荐分数 0-100
  reasons: RecommendReason[];       // 推荐理由
  priority: Priority;               // 优先级
  category: RecommendCategory;      // 推荐类别
  estimatedDuration: number;        // 预估执行时间
  lastExecuted?: number;            // 上次执行时间
  lastResult?: 'passed' | 'failed'; // 上次执行结果
}

interface RecommendReason {
  type: ReasonType;
  description: string;
  weight: number;
  data?: Record<string, any>;
}

type ReasonType =
  | 'recent_failure'      // 最近失败
  | 'high_risk'           // 高风险
  | 'long_not_run'        // 长时间未执行
  | 'change_impact'       // 变更影响
  | 'correlation'         // 关联用例
  | 'coverage_gap'        // 覆盖率缺口
  | 'user_preference';    // 用户偏好

type RecommendCategory =
  | 'must_run'            // 必须执行
  | 'should_run'          // 建议执行
  | 'could_run'           // 可选执行
  | 'low_priority';       // 低优先级

type Priority = 'critical' | 'high' | 'medium' | 'low';
```

### 3.2 优先级配置

```typescript
interface PriorityConfig {
  weights: {
    riskFactor: number;          // 风险系数权重
    businessValue: number;       // 业务价值权重
    executionCost: number;       // 执行成本权重
    changeImpact: number;        // 变更影响权重
    recency: number;             // 时效性权重
  };
  thresholds: {
    critical: number;            // 关键优先级阈值
    high: number;                // 高优先级阈值
    medium: number;              // 中优先级阈值
  };
}
```

### 3.3 关联关系

```typescript
interface CaseCorrelation {
  caseId1: string;
  caseId2: string;
  correlationType: CorrelationType;
  strength: number;              // 关联强度 0-1
  evidence: CorrelationEvidence[];
}

type CorrelationType =
  | 'co_failure'                 // 共同失败
  | 'shared_precondition'        // 共享前置条件
  | 'execution_sequence'         // 执行顺序依赖
  | 'same_feature'               // 同一功能
  | 'similar_pattern';           // 相似模式

interface CorrelationEvidence {
  type: string;
  description: string;
  timestamp: number;
}
```

### 3.4 覆盖率数据

```typescript
interface CoverageData {
  features: FeatureCoverage[];
  pages: PageCoverage[];
  userPaths: PathCoverage[];
  overallScore: number;
  gaps: CoverageGap[];
}

interface FeatureCoverage {
  featureId: string;
  featureName: string;
  coveredCases: string[];
  coveragePercent: number;
}

interface CoverageGap {
  type: 'feature' | 'page' | 'path';
  target: string;
  description: string;
  suggestedCases: string[];
}
```

---

## 4. 核心流程

### 4.1 推荐生成流程

```
用户请求推荐
      │
      ▼
┌─────────────────────────┐
│ 1. 收集上下文信息       │
│    - 历史执行数据       │
│    - 当前时间           │
│    - 用户偏好           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 应用推荐策略         │
│    - 失败优先策略       │
│    - 风险评估策略       │
│    - 覆盖率策略         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 计算推荐分数         │
│    - 多因素加权         │
│    - 归一化处理         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 排序和分类           │
│    - 优先级排序         │
│    - 分类归档           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 5. 生成推荐理由         │
│    - 解释每条推荐       │
│    - 提供支持数据       │
└───────────┬─────────────┘
            │
            ▼
   返回推荐结果
```

### 4.2 关联分析流程

```
执行记录数据
      │
      ▼
┌─────────────────────────┐
│ 1. 提取特征             │
│    - 失败时间点         │
│    - 失败模式           │
│    - 执行环境           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 计算相似度           │
│    - 时间相关性         │
│    - 错误类型匹配       │
│    - 目标元素重叠       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 识别关联模式         │
│    - 共同失败模式       │
│    - 连锁失败模式       │
│    - 周期性失败模式     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 构建关联图谱         │
│    - 节点：用例         │
│    - 边：关联关系       │
└───────────┬─────────────┘
            │
            ▼
   存储关联数据
```

---

## 5. 推荐算法

### 5.1 综合评分算法

```typescript
function calculateRecommendScore(
  caseId: string,
  context: RecommendContext
): number {
  const weights = context.config.weights;

  // 各维度分数
  const riskScore = calculateRiskScore(caseId);
  const valueScore = calculateBusinessValue(caseId);
  const recencyScore = calculateRecencyScore(caseId);
  const impactScore = calculateChangeImpact(caseId, context.changes);
  const coverageScore = calculateCoverageContribution(caseId);

  // 加权求和
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const score = (
    riskScore * weights.riskFactor +
    valueScore * weights.businessValue +
    recencyScore * weights.recency +
    impactScore * weights.changeImpact +
    coverageScore * weights.coverage
  ) / totalWeight;

  return Math.round(score * 100);
}
```

### 5.2 风险评估算法

```typescript
function calculateRiskScore(caseId: string): number {
  const stats = getCaseStats(caseId);

  // 基于历史稳定性
  const stabilityRisk = 1 - (stats.stabilityScore / 100);

  // 基于最近失败
  const recentFailureRisk = stats.recentFailures > 0
    ? Math.min(stats.recentFailures / 5, 1)
    : 0;

  // 基于 Flaky 检测
  const flakyRisk = stats.isFlaky ? 0.5 : 0;

  return (stabilityRisk * 0.4 + recentFailureRisk * 0.4 + flakyRisk * 0.2);
}
```

---

## 6. API 设计

### 6.1 RecommendEngine

```typescript
interface IRecommendEngine {
  getRecommendations(
    options?: RecommendOptions
  ): Promise<Recommendation[]>;

  getRecommendationsForChange(
    changeInfo: ChangeInfo
  ): Promise<Recommendation[]>;

  getRegressionSet(
    type: RegressionType
  ): Promise<Recommendation[]>;

  recordFeedback(
    recommendId: string,
    feedback: Feedback
  ): Promise<void>;
}

interface RecommendOptions {
  limit?: number;
  categories?: RecommendCategory[];
  minScore?: number;
  timeLimit?: number;  // 时间预算（分钟）
}

type RegressionType = 'minimal' | 'standard' | 'full';
```

### 6.2 PriorityRanker

```typescript
interface IPriorityRanker {
  rankCases(
    caseIds: string[],
    config?: PriorityConfig
  ): Promise<RankedCase[]>;

  getPriority(caseId: string): Promise<Priority>;

  updateConfig(config: Partial<PriorityConfig>): Promise<void>;
}

interface RankedCase {
  caseId: string;
  priority: Priority;
  score: number;
  factors: Record<string, number>;
}
```

### 6.3 CorrelationFinder

```typescript
interface ICorrelationFinder {
  findCorrelations(caseId: string): Promise<CaseCorrelation[]>;

  getRelatedCases(
    caseId: string,
    depth?: number
  ): Promise<string[]>;

  getCorrelationGraph(): Promise<CorrelationGraph>;

  refreshCorrelations(): Promise<void>;
}
```

---

## 7. 集成方案

### 7.1 与执行引擎集成

```typescript
// 执行前获取推荐
const recommendations = await recommendEngine.getRecommendations({
  limit: 10,
  categories: ['must_run', 'should_run'],
});

// 展示推荐给用户
displayRecommendations(recommendations);

// 用户选择后执行
const selectedCases = userSelection.map(r => r.caseId);
await executionEngine.executeBatch(selectedCases);

// 执行后记录反馈
for (const rec of selectedRecommendations) {
  await recommendEngine.recordFeedback(rec.id, {
    accepted: true,
    result: getExecutionResult(rec.caseId),
  });
}
```

### 7.2 与分析引擎集成

```typescript
// 复用分析引擎的数据
class RecommendEngine {
  constructor(
    private analysisEngine: AnalysisEngine,
    private storage: AnalyticsStorage
  ) {}

  async getRecommendations(): Promise<Recommendation[]> {
    // 获取分析数据
    const caseStats = await this.storage.getAllCaseStats();
    const hotspots = await this.analysisEngine.analyzeFailureHotspots();

    // 基于分析数据生成推荐
    return this.generateRecommendations(caseStats, hotspots);
  }
}
```

---

## 8. UI 组件设计

### 8.1 推荐面板

```typescript
interface RecommendationPanelProps {
  recommendations: Recommendation[];
  onSelect: (ids: string[]) => void;
  onFeedback: (id: string, feedback: Feedback) => void;
  loading: boolean;
}

// 展示内容
// - 推荐列表（分类展示）
// - 每条推荐的理由
// - 预估执行时间
// - 一键选择按钮
// - 反馈按钮
```

### 8.2 优先级视图

```typescript
interface PriorityViewProps {
  cases: RankedCase[];
  config: PriorityConfig;
  onConfigChange: (config: PriorityConfig) => void;
}

// 展示内容
// - 优先级分布图
// - 权重调节滑块
// - 因素贡献度图表
```

---

## 9. 优势总结

1. **智能推荐**：基于多维数据生成精准推荐
2. **可解释性**：每条推荐都有清晰的理由
3. **持续优化**：通过反馈机制不断改进
4. **灵活配置**：支持自定义优先级权重
5. **无缝集成**：复用现有分析数据和组件
