# 异常检测预警 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**预防优于治疗，智能优于规则**
- 基于统计学方法建立动态基线
- 结合机器学习识别复杂异常模式
- 提供可解释的根因分析

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| 分析引擎 | 作为数据源和计算基础 |
| 告警管理 | 复用告警触发和通知机制 |
| 报告生成 | 集成异常检测结果 |
| 执行历史 | 提供时序数据 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Anomaly Detection System                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │ AnomalyDetector  │     │  TrendPredictor  │              │
│  │   (异常检测器)    │────▶│   (趋势预测器)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  BaselineBuilder │     │ RootCauseAnalyzer│              │
│  │   (基线构建器)    │     │   (根因分析器)   │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  PatternLearner  │     │  HealthScorer    │              │
│  │   (模式学习器)    │     │   (健康评分器)   │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │  AlertManager │  ← 复用现有告警管理
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **AnomalyDetector** | 检测各类异常 |
| **BaselineBuilder** | 构建和维护动态基线 |
| **TrendPredictor** | 预测未来趋势 |
| **RootCauseAnalyzer** | 分析问题根因 |
| **PatternLearner** | 学习异常模式 |
| **HealthScorer** | 计算健康度评分 |

---

## 3. 核心数据结构

### 3.1 异常定义

```typescript
interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: Severity;
  detectedAt: number;
  metric: MetricInfo;
  baseline: BaselineInfo;
  deviation: DeviationInfo;
  impact: ImpactInfo;
  rootCauses: RootCause[];
  status: AnomalyStatus;
}

type AnomalyType =
  | 'pass_rate_drop'        // 通过率下降
  | 'duration_spike'        // 执行时间飙升
  | 'consecutive_failures'  // 连续失败
  | 'flaky_detected'        // Flaky 检测
  | 'resource_anomaly'      // 资源异常
  | 'pattern_break';        // 模式打破

type Severity = 'info' | 'warning' | 'critical' | 'emergency';

type AnomalyStatus = 'active' | 'acknowledged' | 'resolved' | 'ignored';

interface MetricInfo {
  name: string;
  currentValue: number;
  unit: string;
  timestamp: number;
}

interface BaselineInfo {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  period: string;
}

interface DeviationInfo {
  absoluteDeviation: number;
  percentageDeviation: number;
  zScore: number;
}

interface ImpactInfo {
  affectedCases: string[];
  affectedFeatures: string[];
  estimatedScope: 'low' | 'medium' | 'high';
}
```

### 3.2 基线配置

```typescript
interface BaselineConfig {
  metricName: string;
  calculationMethod: BaselineMethod;
  windowSize: number;              // 窗口大小（天）
  excludeAnomalies: boolean;       // 排除历史异常
  seasonality: SeasonalityConfig;
}

type BaselineMethod =
  | 'moving_average'
  | 'exponential_smoothing'
  | 'percentile'
  | 'median';

interface SeasonalityConfig {
  enabled: boolean;
  patterns: SeasonalPattern[];
}

interface SeasonalPattern {
  type: 'daily' | 'weekly' | 'monthly';
  adjustments: Record<string, number>;
}
```

### 3.3 根因分析

```typescript
interface RootCause {
  id: string;
  category: RootCauseCategory;
  description: string;
  confidence: number;              // 置信度 0-100
  evidence: Evidence[];
  suggestions: Suggestion[];
}

type RootCauseCategory =
  | 'locator_change'               // 元素定位变化
  | 'timing_issue'                 // 时序问题
  | 'environment_change'           // 环境变化
  | 'code_change'                  // 代码变更
  | 'data_issue'                   // 数据问题
  | 'network_issue'                // 网络问题
  | 'resource_constraint';         // 资源约束

interface Evidence {
  type: string;
  description: string;
  data: Record<string, any>;
  weight: number;
}

interface Suggestion {
  action: string;
  priority: number;
  effort: 'low' | 'medium' | 'high';
}
```

### 3.4 趋势预测

```typescript
interface TrendPrediction {
  metricName: string;
  currentValue: number;
  predictions: PredictionPoint[];
  trend: TrendDirection;
  confidence: number;
  factors: TrendFactor[];
}

interface PredictionPoint {
  timestamp: number;
  value: number;
  lowerBound: number;
  upperBound: number;
}

type TrendDirection = 'improving' | 'stable' | 'declining';

interface TrendFactor {
  name: string;
  impact: number;              // 正值表示正向影响
  description: string;
}
```

### 3.5 健康评分

```typescript
interface HealthScore {
  overall: number;             // 0-100
  dimensions: HealthDimension[];
  trend: TrendDirection;
  comparedTo: {
    lastWeek: number;
    lastMonth: number;
  };
  recommendations: string[];
}

interface HealthDimension {
  name: string;
  score: number;
  weight: number;
  factors: HealthFactor[];
}

interface HealthFactor {
  name: string;
  value: number;
  impact: 'positive' | 'neutral' | 'negative';
}
```

---

## 4. 核心流程

### 4.1 异常检测流程

```
执行数据输入
      │
      ▼
┌─────────────────────────┐
│ 1. 获取当前指标值       │
│    - 通过率             │
│    - 执行时间           │
│    - 失败分布           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 获取基线数据         │
│    - 历史均值           │
│    - 标准差             │
│    - 季节性调整         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 计算偏差             │
│    - Z-Score            │
│    - 百分比偏差         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 判断是否异常         │
│    - 阈值检测           │
│    - 模式匹配           │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │ 是异常？ │
       └────┬────┘
       是   │   否
       │    │    │
       ▼    │    ▼
┌─────────┐ │  正常记录
│触发告警 │ │
└────┬────┘ │
     │      │
     ▼      │
┌─────────┐ │
│根因分析 │ │
└─────────┘ │
```

### 4.2 基线构建流程

```
历史执行数据
      │
      ▼
┌─────────────────────────┐
│ 1. 数据清洗             │
│    - 移除异常值         │
│    - 处理缺失值         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 季节性分析           │
│    - 识别周期模式       │
│    - 计算调整系数       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 计算统计量           │
│    - 均值/中位数        │
│    - 标准差             │
│    - 分位数             │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 构建基线模型         │
│    - 动态阈值           │
│    - 置信区间           │
└───────────┬─────────────┘
            │
            ▼
   存储基线数据
```

### 4.3 根因分析流程

```
异常事件
      │
      ▼
┌─────────────────────────┐
│ 1. 收集上下文           │
│    - 失败详情           │
│    - 时间点数据         │
│    - 环境信息           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 特征提取             │
│    - 错误类型           │
│    - 失败模式           │
│    - 时间相关性         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 原因匹配             │
│    - 规则匹配           │
│    - 模式匹配           │
│    - 历史相似度         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 置信度计算           │
│    - 证据权重           │
│    - 排他性分析         │
└───────────┬─────────────┘
            │
            ▼
   输出根因报告
```

---

## 5. 检测算法

### 5.1 Z-Score 检测

```typescript
function detectByZScore(
  value: number,
  baseline: BaselineInfo,
  threshold: number = 3
): boolean {
  const zScore = (value - baseline.mean) / baseline.stdDev;
  return Math.abs(zScore) > threshold;
}
```

### 5.2 移动平均检测

```typescript
function detectByMovingAverage(
  values: number[],
  windowSize: number,
  threshold: number
): AnomalyPoint[] {
  const anomalies: AnomalyPoint[] = [];

  for (let i = windowSize; i < values.length; i++) {
    const window = values.slice(i - windowSize, i);
    const avg = window.reduce((a, b) => a + b, 0) / windowSize;
    const deviation = Math.abs(values[i] - avg) / avg;

    if (deviation > threshold) {
      anomalies.push({ index: i, value: values[i], deviation });
    }
  }

  return anomalies;
}
```

### 5.3 连续失败检测

```typescript
function detectConsecutiveFailures(
  results: ExecutionResult[],
  threshold: number = 3
): Anomaly | null {
  let consecutiveFailures = 0;

  for (const result of results.reverse()) {
    if (result.status === 'failed') {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  if (consecutiveFailures >= threshold) {
    return createAnomaly('consecutive_failures', consecutiveFailures);
  }

  return null;
}
```

---

## 6. API 设计

### 6.1 AnomalyDetector

```typescript
interface IAnomalyDetector {
  detect(options?: DetectOptions): Promise<Anomaly[]>;

  detectForCase(caseId: string): Promise<Anomaly[]>;

  getActiveAnomalies(): Promise<Anomaly[]>;

  acknowledgeAnomaly(id: string): Promise<void>;

  resolveAnomaly(id: string, resolution: string): Promise<void>;
}

interface DetectOptions {
  scope?: 'all' | 'recent' | 'specific';
  caseIds?: string[];
  types?: AnomalyType[];
  minSeverity?: Severity;
}
```

### 6.2 BaselineBuilder

```typescript
interface IBaselineBuilder {
  buildBaseline(
    metricName: string,
    config: BaselineConfig
  ): Promise<BaselineInfo>;

  updateBaseline(metricName: string): Promise<void>;

  getBaseline(metricName: string): Promise<BaselineInfo | null>;

  adjustForSeasonality(
    baseline: BaselineInfo,
    timestamp: number
  ): BaselineInfo;
}
```

### 6.3 TrendPredictor

```typescript
interface ITrendPredictor {
  predict(
    metricName: string,
    horizon: number
  ): Promise<TrendPrediction>;

  predictForCase(
    caseId: string,
    horizon: number
  ): Promise<TrendPrediction>;

  getOverallTrend(): Promise<TrendPrediction>;
}
```

### 6.4 RootCauseAnalyzer

```typescript
interface IRootCauseAnalyzer {
  analyze(anomaly: Anomaly): Promise<RootCause[]>;

  analyzeFailure(
    caseId: string,
    executionId: string
  ): Promise<RootCause[]>;

  getSuggestions(rootCauses: RootCause[]): Suggestion[];
}
```

### 6.5 HealthScorer

```typescript
interface IHealthScorer {
  calculateScore(): Promise<HealthScore>;

  getScoreHistory(days: number): Promise<HealthScore[]>;

  getRecommendations(): Promise<string[]>;
}
```

---

## 7. 集成方案

### 7.1 与分析引擎集成

```typescript
class AnomalyDetectionService {
  constructor(
    private analysisEngine: AnalysisEngine,
    private alertManager: AlertManager
  ) {}

  async runDetection(): Promise<void> {
    // 获取分析数据
    const overview = await this.analysisEngine.getDashboardOverview();

    // 检测异常
    const anomalies = await this.detector.detect();

    // 触发告警
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical' || anomaly.severity === 'emergency') {
        await this.alertManager.trigger(this.createAlert(anomaly));
      }
    }
  }
}
```

### 7.2 与执行引擎集成

```typescript
// 执行后自动检测
executionEngine.on('executionComplete', async (result) => {
  // 实时检测
  const anomalies = await anomalyDetector.detectForCase(result.caseId);

  if (anomalies.length > 0) {
    // 记录异常
    await anomalyStorage.save(anomalies);

    // 实时通知
    notifyAnomalies(anomalies);
  }
});
```

---

## 8. UI 组件设计

### 8.1 异常仪表板

```typescript
interface AnomalyDashboardProps {
  anomalies: Anomaly[];
  healthScore: HealthScore;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

// 展示内容
// - 健康度评分卡
// - 活跃异常列表
// - 异常趋势图
// - 根因分析详情
```

### 8.2 趋势预测图

```typescript
interface TrendChartProps {
  predictions: TrendPrediction[];
  metric: string;
  showConfidenceBands: boolean;
}

// 展示内容
// - 历史数据线
// - 预测数据线
// - 置信区间带
// - 趋势指示器
```

---

## 9. 优势总结

1. **智能检测**：基于统计学方法自动识别异常
2. **预测能力**：提前预警潜在问题
3. **根因分析**：帮助快速定位问题原因
4. **自适应学习**：持续学习优化检测准确性
5. **可配置性**：灵活的阈值和规则配置
