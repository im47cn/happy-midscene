# 执行分析仪表板用户手册

本手册介绍如何使用 AI Test Generator 的执行分析仪表板功能，通过数据可视化洞察测试健康状况、识别问题模式、优化测试策略。

## 目录

1. [功能概述](#1-功能概述)
2. [快速开始](#2-快速开始)
3. [数据采集](#3-数据采集)
4. [仪表板概览](#4-仪表板概览)
5. [失败分析](#5-失败分析)
6. [告警规则](#6-告警规则)
7. [报告生成](#7-报告生成)
8. [API 参考](#8-api-参考)
9. [最佳实践](#9-最佳实践)

---

## 1. 功能概述

执行分析仪表板提供以下核心能力：

- **数据采集**：自动收集测试执行数据（结果、耗时、失败原因等）
- **健康度评分**：综合评估测试套件稳定性 (0-100 分)
- **趋势分析**：通过率、执行时长、失败模式的历史趋势
- **失败分析**：失败分类、热点识别、根因分析
- **告警系统**：可配置的告警规则和通知
- **报告生成**：每日/每周自动报告

---

## 2. 快速开始

### 2.1 访问仪表板

在 AI Test Generator 中，点击顶部导航栏的"分析"按钮，即可进入仪表板视图。

### 2.2 理解核心指标

仪表板首页展示四个核心 KPI 卡片：

| 指标 | 说明 | 健康范围 |
|------|------|----------|
| 总执行次数 | 选定时间段内的测试执行总数 | - |
| 通过率 | 成功执行的百分比 | > 90% 为健康 |
| 平均耗时 | 单个测试用例的平均执行时长 | < 历史均值 |
| 健康度 | 综合稳定性评分 | > 80 为健康 |

---

## 3. 数据采集

### 3.1 自动采集

系统在每次测试执行时自动采集以下数据：

```typescript
interface ExecutionRecord {
  id: string;              // 执行记录 ID
  testCaseId: string;      // 测试用例 ID
  status: 'passed' | 'failed' | 'skipped';
  duration: number;        // 执行耗时 (ms)
  startTime: number;       // 开始时间戳
  endTime: number;         // 结束时间戳
  error?: string;          // 失败原因
  stepResults: StepResult[]; // 每步执行结果
  healingRecords?: HealingRecord[]; // 自愈记录
}
```

### 3.2 手动采集

```typescript
import { dataCollector } from './services/analytics';

// 记录执行开始
const recordId = dataCollector.startExecution('test-case-id');

// 记录步骤结果
dataCollector.recordStepResult(recordId, {
  stepId: 'step-1',
  status: 'passed',
  duration: 1500,
});

// 记录执行结束
dataCollector.endExecution(recordId, 'passed');
```

### 3.3 数据存储

- 默认保留 90 天历史数据
- 数据存储在浏览器 IndexedDB 中
- 支持导出为 JSON 格式

---

## 4. 仪表板概览

### 4.1 KPI 卡片

每个 KPI 卡片显示：
- 当前值
- 与上一周期的对比（↑ 上升 / ↓ 下降）
- 趋势迷你图

```typescript
import { analysisEngine } from './services/analytics';

// 获取 KPI 数据
const kpis = await analysisEngine.calculateKPIs('7d');
// 结果: { totalExecutions, passRate, avgDuration, healthScore }
```

### 4.2 健康度评分

健康度评分基于以下权重计算：

| 指标 | 权重 | 满分条件 |
|------|------|----------|
| 通过率 | 40% | > 95% |
| 稳定性 | 30% | 无 Flaky 用例 |
| 平均耗时 | 20% | < 历史均值 |
| 自愈成功率 | 10% | > 80% |

```typescript
// 获取健康度详情
const health = await analysisEngine.calculateHealthScore('7d');
// 结果: { score: 85, breakdown: { passRate: 90, stability: 80, ... } }
```

### 4.3 趋势图表

仪表板提供三种趋势图表：

1. **执行量柱状图**：每日/每周执行次数
2. **通过率折线图**：历史通过率趋势
3. **耗时趋势图**：平均执行时长变化

### 4.4 时间范围筛选

支持以下时间范围：
- 今日
- 最近 7 天
- 最近 30 天
- 自定义范围

---

## 5. 失败分析

### 5.1 失败分类

系统自动将失败原因分为以下类别：

| 类别 | 说明 | 示例 |
|------|------|------|
| `locator_failed` | 元素定位失败 | 找不到按钮 |
| `assertion_failed` | 断言验证失败 | 文本不匹配 |
| `timeout` | 操作超时 | 页面加载超时 |
| `network_error` | 网络异常 | 请求失败 |
| `script_error` | 脚本错误 | JavaScript 异常 |

```typescript
import { failureAnalyzer } from './services/analytics';

// 获取失败分类统计
const failures = await failureAnalyzer.categorizeFailures('7d');
// 结果: { locator_failed: 15, assertion_failed: 8, ... }
```

### 5.2 失败热点

识别高频失败的元素和步骤：

```typescript
// 获取失败热点
const hotspots = await failureAnalyzer.getFailureHotspots('7d');
// 结果: [{ elementDesc: '提交按钮', failureCount: 12, lastFailed: ... }, ...]
```

### 5.3 Flaky 测试识别

系统自动识别 Flaky 测试（结果不稳定的用例）：

```typescript
// 获取 Flaky 测试列表
const flakyTests = await analysisEngine.getFlakyTests('30d');
// 结果: [{ testCaseId: 'TC001', flakyScore: 0.35, passRate: 65 }, ...]
```

**Flaky 评分规则**：
- 通过率在 30%-70% 之间
- 最近 10 次执行中状态交替变化 >= 3 次

---

## 6. 告警规则

### 6.1 内置告警规则

| 规则名称 | 条件 | 严重级别 |
|----------|------|----------|
| 通过率下降 | 通过率 < 80% | critical |
| 连续失败 | 同一用例连续失败 >= 3 次 | warning |
| 执行时长异常 | 耗时超过历史均值 50% | info |
| 新增 Flaky | 首次识别为 Flaky | warning |

### 6.2 配置告警规则

```typescript
import { alertManager } from './services/analytics';

// 创建自定义告警规则
alertManager.createRule({
  id: 'custom_pass_rate',
  name: '通过率低于 90%',
  enabled: true,
  condition: {
    metric: 'passRate',
    operator: '<',
    threshold: 90,
    timeWindow: '24h',
  },
  severity: 'warning',
  cooldown: 60 * 60 * 1000, // 1 小时冷却
  notifications: ['browser'],
});
```

### 6.3 通知方式

支持以下通知渠道：
- **浏览器通知**：桌面推送通知
- **控制台日志**：开发调试用
- **自定义回调**：集成第三方系统

```typescript
// 设置通知渠道
alertManager.setNotificationChannels({
  browser: true,
  console: true,
  callback: (alert) => {
    // 自定义处理逻辑
    sendToSlack(alert);
  },
});
```

---

## 7. 报告生成

### 7.1 自动报告

系统支持生成每日和每周报告：

```typescript
import { reportGenerator } from './services/analytics';

// 生成每日报告
const dailyReport = await reportGenerator.generateDailyReport();

// 生成每周报告
const weeklyReport = await reportGenerator.generateWeeklyReport();
```

### 7.2 报告内容

报告包含以下章节：

1. **执行摘要**
   - 总执行次数、通过/失败数
   - 与上一周期对比

2. **健康度分析**
   - 健康度评分及趋势
   - 各维度得分明细

3. **失败分析**
   - 失败分类统计
   - Top 5 失败热点
   - 新增 Flaky 用例

4. **性能分析**
   - 平均耗时趋势
   - 慢步骤排行

5. **建议事项**
   - 优化建议列表
   - 优先级排序

### 7.3 报告格式

支持以下导出格式：

```typescript
// HTML 格式
const htmlReport = await reportGenerator.exportReport(report, 'html');

// JSON 格式
const jsonReport = await reportGenerator.exportReport(report, 'json');

// Markdown 格式
const mdReport = await reportGenerator.exportReport(report, 'markdown');
```

---

## 8. API 参考

### 8.1 DataCollector

```typescript
import { dataCollector } from './services/analytics';

// 开始执行
startExecution(testCaseId: string): string

// 结束执行
endExecution(recordId: string, status: ExecutionStatus): void

// 记录步骤
recordStepResult(recordId: string, stepResult: StepResult): void

// 查询记录
getExecutionRecords(filter: RecordFilter): ExecutionRecord[]
```

### 8.2 AnalysisEngine

```typescript
import { analysisEngine } from './services/analytics';

// 计算 KPI
calculateKPIs(timeRange: TimeRange): Promise<KPIData>

// 计算健康度
calculateHealthScore(timeRange: TimeRange): Promise<HealthScore>

// 获取趋势数据
getTrendData(metric: string, timeRange: TimeRange): Promise<TrendPoint[]>

// 获取 Flaky 测试
getFlakyTests(timeRange: TimeRange): Promise<FlakyTest[]>
```

### 8.3 AlertManager

```typescript
import { alertManager } from './services/analytics';

// 创建规则
createRule(rule: AlertRule): void

// 检查告警
checkAlerts(data: ExecutionData): Promise<Alert[]>

// 启用/禁用规则
enableRule(ruleId: string, enabled: boolean): void
```

---

## 9. 最佳实践

### 9.1 数据分析策略

1. **每日检查**：查看当日通过率和失败热点
2. **每周回顾**：分析 Flaky 测试和性能趋势
3. **月度优化**：根据历史数据制定改进计划

### 9.2 告警配置建议

```
生产环境：
- 通过率 < 80% → critical
- 连续失败 >= 3 → warning

开发环境：
- 通过率 < 50% → warning
- 连续失败 >= 5 → info
```

### 9.3 性能优化

- 定期清理过期数据（超过 90 天）
- 避免一次查询过大时间范围
- 使用缓存减少重复计算

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2024-01 | 初始版本，包含完整分析功能 |

---

## 相关文档

- [需求规格说明书](../../../specs/analytics-dashboard/requirements.md)
- [设计文档](../../../specs/analytics-dashboard/design.md)
- [开发任务](../../../specs/analytics-dashboard/tasks.md)
