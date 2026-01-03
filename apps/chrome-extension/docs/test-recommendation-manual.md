# 测试推荐系统用户手册

本手册介绍 AI Test Generator 的测试推荐功能，通过多维评分算法智能推荐需要优先执行的测试用例。

## 目录

1. [功能概述](#1-功能概述)
2. [快速开始](#2-快速开始)
3. [推荐引擎](#3-推荐引擎)
4. [优先级排序](#4-优先级排序)
5. [变更影响分析](#5-变更影响分析)
6. [覆盖率分析](#6-覆盖率分析)
7. [关联分析](#7-关联分析)
8. [反馈追踪](#8-反馈追踪)
9. [API 参考](#9-api-参考)
10. [最佳实践](#10-最佳实践)

---

## 1. 功能概述

测试推荐系统提供以下核心能力：

- **智能推荐**：基于多维评分算法推荐需要优先执行的测试用例
- **优先级排序**：综合风险、业务价值、执行成本等因素对用例排序
- **变更影响分析**：分析代码变更对测试用例的影响范围
- **覆盖率分析**：识别功能、页面、用户路径的测试覆盖缺口
- **关联分析**：发现测试用例间的关联关系和共同失效模式
- **反馈学习**：收集推荐反馈，持续优化推荐质量

---

## 2. 快速开始

### 2.1 基础用法

```typescript
import { recommendEngine } from './services/recommendation';

// 获取推荐测试用例
const recommendations = await recommendEngine.getRecommendations({
  limit: 10,
  filters: {
    minPriority: 'high',
  },
});

// 结果示例
// [
//   { caseId: 'TC001', caseName: '用户登录', priority: 'high', score: 72, reasons: [...] },
//   { caseId: 'TC002', caseName: '支付流程', priority: 'high', score: 68, reasons: [...] }
// ]
```

### 2.2 场景化推荐

```typescript
// 获取回归测试集（基于变更影响）
const regressionSet = await recommendEngine.getRegressionSet([
  { type: 'file', target: 'src/components/Button.tsx', description: 'Button组件变更' },
]);

// 获取覆盖率缺口建议
const gapSuggestions = await recommendEngine.getCoverageGapSuggestions();
```

---

## 3. 推荐引擎

### 3.1 评分算法

推荐引擎使用多维加权评分算法：

```
综合评分 = (风险 × 30% + 业务价值 × 20% + 最近执行 × 15% + 变更影响 × 25% + 覆盖率 × 10%) × 100
```

### 3.2 优先级阈值

| 优先级 | 评分范围 | 说明 |
|--------|----------|------|
| critical | >= 80 | 严重问题或高影响变更 |
| high | 60 - 79 | 重要但非紧急 |
| medium | 40 - 59 | 常规优先级 |
| low | < 40 | 低优先级 |

### 3.3 配置选项

```typescript
import { RecommendEngine } from './services/recommendation';

const engine = new RecommendEngine({
  thresholds: {
    critical: 85,  // 自定义临界阈值
    high: 65,
    medium: 45,
  },
  weights: {
    riskFactor: 0.35,      // 调整风险权重
    businessValue: 0.25,
    executionCost: 0.1,
    changeImpact: 0.2,
    recency: 0.1,
  },
});
```

### 3.4 风险评分计算

风险评分由三个子维度组成：

```
风险评分 = 稳定性风险 × 40% + 近期失败风险 × 40% + Flaky 风险 × 20%
```

- **稳定性风险**：`1 - (stabilityScore / 100)`
- **近期失败风险**：基于最近5次执行结果计算
- **Flaky 风险**：用例标记为 Flaky 时增加额外风险

---

## 4. 优先级排序

### 4.1 获取排序结果

```typescript
import { priorityRanker } from './services/recommendation';

// 获取所有用例的排序结果
const ranked = await priorityRanker.rankCases();

// 只排序指定用例
const rankedSubset = await priorityRanker.rankCases(['TC001', 'TC002', 'TC003']);
```

### 4.2 获取单个用例优先级

```typescript
const priority = await priorityRanker.getPriority('TC001');
// 结果: 'critical' | 'high' | 'medium' | 'low'
```

### 4.3 优先级分布

```typescript
const distribution = await priorityRanker.getPriorityDistribution();
// 结果: { critical: 2, high: 8, medium: 25, low: 45 }
```

### 4.4 业务价值评分

业务价值考虑以下因素：

1. **关键词匹配**：包含 `payment`、`login`、`checkout` 等关键词加分
2. **执行频率**：高频执行的用例业务价值更高
3. **失败影响**：核心流程失败影响更大

```typescript
// 业务价值计算示例
// 关键词加分: payment(+0.3), login(+0.25), checkout(+0.3), search(+0.15)
// 频率加分: 每执行10次加0.1，上限0.3
```

---

## 5. 变更影响分析

### 5.1 解析变更信息

```typescript
import { ChangeAnalyzer } from './services/recommendation';

// 从 Git diff 解析
const diff = `
diff --git a/src/components/Button.tsx b/src/components/Button.tsx
diff --git a/src/pages/Login.tsx b/src/pages/Login.tsx
`;
const changes = ChangeAnalyzer.parseChangesFromDiff(diff);

// 从文件路径解析
const changes2 = ChangeAnalyzer.parseChangesFromPaths([
  'src/components/Button.tsx',
  'src/pages/Login.tsx',
]);
```

### 5.2 分析影响范围

```typescript
import { changeAnalyzer } from './services/recommendation';

// 分析变更影响
const impacts = await changeAnalyzer.analyzeImpact(changes);
// 结果: [
//   {
//     change: { type: 'file', target: 'Button.tsx', description: '...' },
//     affectedCases: ['TC001', 'TC002', ...],
//     impactLevel: 'high',
//     reasoning: ['影响用例数: 15', '高风险变更，建议全面回归测试']
//   }
// ]
```

### 5.3 推荐回归测试

```typescript
// 基于变更推荐测试用例
const suggestedTests = await changeAnalyzer.suggestTests(changes, 20);
// 返回受影响最大的前20个用例ID
```

### 5.4 自定义映射

```typescript
// 添加自定义文件到用例的映射
changeAnalyzer.addCustomMapping('src/api/user.ts', ['user-login', 'user-profile']);

// 清除所有自定义映射
changeAnalyzer.clearCustomMappings();

// 获取当前映射
const mappings = changeAnalyzer.getCustomMappings();
```

### 5.5 组件依赖映射

系统内置常用组件依赖关系：

| 组件 | 影响范围 |
|------|----------|
| Button | 所有测试 |
| Modal | 所有测试 |
| Input | form, login, search |
| Form | login, signup, checkout |
| Table | dashboard, list |

---

## 6. 覆盖率分析

### 6.1 功能覆盖率

```typescript
import { coverageAnalyzer } from './services/recommendation';

const featureCoverage = await coverageAnalyzer.analyzeFeatureCoverage();
// 结果: [
//   {
//     featureId: 'authentication',
//     featureName: '身份认证',
//     coveredCases: ['login-1', 'login-2'],
//     coveragePercent: 85
//   }
// ]
```

### 6.2 页面覆盖率

```typescript
const pageCoverage = await coverageAnalyzer.analyzePageCoverage();
// 结果: [
//   {
//     url: 'https://example.com/login',
//     pageName: '登录页',
//     coveredCases: ['login-1'],
//     coveragePercent: 90
//   }
// ]
```

### 6.3 用户路径覆盖率

```typescript
const pathCoverage = await coverageAnalyzer.analyzePathCoverage();
// 结果: [
//   {
//     pathId: 'checkout-flow',
//     pathName: '结算流程',
//     steps: ['浏览商品', '加入购物车', '结算', '支付'],
//     coveredCases: ['checkout-1'],
//     coveragePercent: 75
//   }
// ]
```

### 6.4 识别覆盖缺口

```typescript
const gaps = await coverageAnalyzer.identifyGaps();
// 结果: [
//   {
//     type: 'feature',
//     target: 'search',
//     description: '搜索功能覆盖率低 (30%)',
//     suggestedCases: ['搜索基本功能', '搜索结果排序', '搜索筛选']
//   }
// ]
```

### 6.5 综合覆盖度

```typescript
const overall = await coverageAnalyzer.getOverallCoverage();
// 结果: {
//   features: [...],
//   pages: [...],
//   userPaths: [...],
//   overallScore: 72,
//   gaps: [...]
// }
```

---

## 7. 关联分析

### 7.1 发现失效关联

```typescript
import { correlationFinder } from './services/recommendation';

// 发现共同失效的用例
const correlations = await correlationFinder.findCoFailureCorrelations();
// 结果: [
//   {
//     caseId: 'TC001',
//     correlatedCases: ['TC002', 'TC005'],
//     correlationType: 'co-failure',
//     strength: 0.85,
//     pattern: '当 TC001 失败时，TC002 和 TC005 也有 85% 概率失败'
//   }
// ]
```

### 7.2 发现共享前置条件

```typescript
const preconditions = await correlationFinder.findSharedPreconditions();
// 结果: [
//   {
//     caseId: 'TC001',
//     precondition: '用户已登录',
//     correlatedCases: ['TC003', 'TC007'],
//     strength: 0.9
//   }
// ]
```

### 7.3 获取用例关联

```typescript
const caseCorrelations = await correlationFinder.getCorrelationsForCase('TC001');
// 返回与指定用例相关的所有关联
```

### 7.4 关联强度解释

| 强度范围 | 说明 |
|----------|------|
| > 0.8 | 强关联 - 很可能存在依赖关系 |
| 0.5 - 0.8 | 中等关联 - 可能存在关联 |
| < 0.5 | 弱关联 - 关联不明显 |

---

## 8. 反馈追踪

### 8.1 记录推荐反馈

```typescript
import { feedbackTracker } from './services/recommendation';

// 记录反馈
await feedbackTracker.recordFeedback({
  recommendationId: 'rec-123',
  caseId: 'TC001',
  accepted: true,      // 是否采纳推荐
  executed: true,      // 是否执行
  result: 'passed',    // 执行结果
  rating: 5,           // 用户评分 1-5
  timestamp: Date.now(),
});
```

### 8.2 查询反馈数据

```typescript
// 获取指定用例的反馈
const caseFeedback = feedbackTracker.getFeedbackForCase('TC001');

// 获取指定推荐的反馈
const recFeedback = feedbackTracker.getFeedbackForRecommendation('rec-123');

// 获取最近反馈
const recent = feedbackTracker.getRecentFeedback(20);
```

### 8.3 反馈分析

```typescript
// 分析总体反馈
const summary = feedbackTracker.analyzeFeedback();
// 结果: {
//   total: 150,
//   accepted: 120,
//   rejected: 30,
//   acceptanceRate: 80,
//   averageRating: 4.2
// }
```

### 8.4 权重调整建议

```typescript
const adjustment = feedbackTracker.calculateWeightAdjustments();
// 结果: {
//   confidence: 0.75,  // 建议可信度
//   weights: { riskFactor: 0.35, businessValue: 0.2, ... },
//   reasoning: ['接受率良好', '建议维持当前权重配置']
// }
```

### 8.5 反馈导入导出

```typescript
// 导出反馈数据
const exported = feedbackTracker.exportFeedback();

// 导入反馈数据
feedbackTracker.importFeedback(exported);

// 清空数据
feedbackTracker.clearAllFeedback();
feedbackTracker.clearCaseFeedback('TC001');
```

---

## 9. API 参考

### 9.1 RecommendEngine

```typescript
class RecommendEngine {
  constructor(config?: RecommendConfig);

  // 获取推荐用例
  getRecommendations(options: RecommendOptions): Promise<Recommendation[]>;

  // 获取回归测试集
  getRegressionSet(changes: ChangeInfo[]): Promise<RegressionSet>;

  // 获取覆盖缺口建议
  getCoverageGapSuggestions(): Promise<GapSuggestion[]>;

  // 更新配置
  updateConfig(config: Partial<RecommendConfig>): void;

  // 获取当前配置
  getConfig(): RecommendConfig;
}
```

### 9.2 PriorityRanker

```typescript
class PriorityRanker {
  // 排序用例
  rankCases(caseIds?: string[]): Promise<RankedCase[]>;

  // 获取单个用例优先级
  getPriority(caseId: string): Promise<Priority>;

  // 获取优先级分布
  getPriorityDistribution(caseIds?: string[]): Promise<PriorityDistribution>;

  // 更新配置
  updateConfig(config: Partial<RankerConfig>): void;

  // 获取配置
  getConfig(): RankerConfig;
}
```

### 9.3 ChangeAnalyzer

```typescript
class ChangeAnalyzer {
  // 分析变更影响
  analyzeImpact(changes: ChangeInfo[]): Promise<ChangeImpact[]>;

  // 映射变更到用例
  mapChangesToCases(changes: ChangeInfo[]): Promise<Map<string, string[]>>;

  // 推荐测试
  suggestTests(changes: ChangeInfo[], limit?: number): Promise<string[]>;

  // 自定义映射
  addCustomMapping(pattern: string, caseIds: string[]): void;
  clearCustomMappings(): void;
  getCustomMappings(): Map<string, string[]>;

  // 静态方法
  static parseChangesFromDiff(diff: string): ChangeInfo[];
  static parseChangesFromPaths(paths: string[]): ChangeInfo[];
  static inferChangeType(filePath: string): ChangeInfo['type'];
}
```

### 9.4 CoverageAnalyzer

```typescript
class CoverageAnalyzer {
  // 分析功能覆盖
  analyzeFeatureCoverage(): Promise<FeatureCoverage[]>;

  // 分析页面覆盖
  analyzePageCoverage(): Promise<PageCoverage[]>;

  // 分析路径覆盖
  analyzePathCoverage(): Promise<PathCoverage[]>;

  // 识别覆盖缺口
  identifyGaps(): Promise<CoverageGap[]>;

  // 获取综合覆盖
  getOverallCoverage(): Promise<OverallCoverage>;

  // 缓存管理
  clearCache(): void;
}
```

### 9.5 CorrelationFinder

```typescript
class CorrelationFinder {
  // 发现共同失效
  findCoFailureCorrelations(): Promise<Correlation[]>;

  // 发现共享前置条件
  findSharedPreconditions(): Promise<PreconditionCorrelation[]>;

  // 获取用例关联
  getCorrelationsForCase(caseId: string): Promise<CaseCorrelation>;

  // 缓存管理
  clearCache(): void;
}
```

### 9.6 FeedbackTracker

```typescript
class FeedbackTracker {
  // 记录反馈
  recordFeedback(feedback: Feedback): Promise<void>;

  // 查询反馈
  getFeedbackForCase(caseId: string): Feedback[];
  getFeedbackForRecommendation(recId: string): Feedback[];
  getAllFeedback(): Feedback[];
  getRecentFeedback(limit?: number): Feedback[];

  // 分析反馈
  analyzeFeedback(): FeedbackSummary;
  calculateWeightAdjustments(): WeightAdjustment;
  getCaseStats(caseId: string): CaseFeedbackStats | null;

  // 导入导出
  exportFeedback(): string;
  importFeedback(json: string): void;

  // 清空数据
  clearCaseFeedback(caseId: string): void;
  clearAllFeedback(): void;
}
```

---

## 10. 最佳实践

### 10.1 推荐场景选择

| 场景 | 推荐方法 | 说明 |
|------|----------|------|
| 日常测试 | `getRecommendations()` | 综合考虑所有因素 |
| 代码变更后 | `getRegressionSet()` | 重点测试受影响用例 |
| 新功能开发 | `getCoverageGapSuggestions()` | 补充覆盖缺口 |
| CI/CD 加速 | 使用高优先级子集 | 只执行 critical/high 用例 |

### 10.2 配置调优建议

**快速反馈场景**（如开发环境）：
```typescript
{
  weights: {
    riskFactor: 0.4,      // 侧重风险
    changeImpact: 0.3,    // 变更影响
    executionCost: 0.15,
    businessValue: 0.1,
    recency: 0.05,
  }
}
```

**全面保障场景**（如生产发布）：
```typescript
{
  weights: {
    businessValue: 0.35,  // 侧重业务价值
    riskFactor: 0.25,
    changeImpact: 0.2,
    coverage: 0.15,
    recency: 0.05,
  }
}
```

### 10.3 反馈收集建议

1. **自动化收集**：测试执行后自动记录结果
2. **人工评分**：定期收集人工评分 1-5 分
3. **定期回顾**：每月分析反馈数据，调整权重

### 10.4 性能优化

- 使用 `clearCache()` 定期清理缓存
- 对于大量用例，使用 `limit` 参数限制返回数量
- 预热：首次调用较慢，后续使用缓存会更快

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2025-01 | 初始版本，包含完整推荐功能 |

---

## 相关文档

- [需求规格说明书](../../../specs/test-recommendation/requirements.md)
- [设计文档](../../../specs/test-recommendation/design.md)
- [开发任务](../../../specs/test-recommendation/tasks.md)
