# 执行分析仪表板 技术方案设计文档

## 1. 项目背景与目标

测试执行产生大量数据，但缺乏有效的分析手段会导致问题被忽视。本模块通过数据可视化和智能分析，帮助用户快速定位测试问题、评估测试质量、优化测试策略。

## 2. 系统架构设计

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Analytics Dashboard                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Data      │  │   Analysis   │  │    Report    │       │
│  │  Collector   │  │    Engine    │  │  Generator   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └────────────┬────┴─────────────────┘               │
│                      │                                       │
│              ┌───────▼───────┐                              │
│              │  TimeSeries   │                              │
│              │   Storage     │                              │
│              └───────────────┘                              │
└─────────────────────────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Dashboard│  │  Charts  │  │  Alerts  │
   │    UI    │  │  Library │  │  System  │
   └──────────┘  └──────────┘  └──────────┘
```

### 2.2 技术栈选型

* **数据存储**: IndexedDB + Dexie.js (ORM)
* **图表库**: ECharts (丰富的图表类型)
* **UI 框架**: React + TailwindCSS
* **状态管理**: Zustand
* **报告导出**: jsPDF + html2canvas

---

## 3. 数据模型设计

### 3.1 执行记录

```typescript
interface ExecutionRecord {
  id: string;
  caseId: string;                // 关联的用例 ID
  caseName: string;              // 用例名称
  startTime: number;             // 开始时间戳
  endTime: number;               // 结束时间戳
  duration: number;              // 总耗时 (ms)
  status: 'passed' | 'failed' | 'skipped' | 'error';

  // 步骤详情
  steps: StepRecord[];

  // 失败信息
  failure?: {
    type: FailureType;
    message: string;
    stepIndex: number;
    screenshot?: string;         // Base64
  };

  // 自愈信息
  healing?: {
    attempted: boolean;
    success: boolean;
    strategy?: string;
  };

  // 环境信息
  environment: {
    browser: string;
    viewport: { width: number; height: number };
    url: string;
  };
}

interface StepRecord {
  index: number;
  description: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  aiResponseTime?: number;       // AI 响应耗时
  retryCount: number;
}

type FailureType =
  | 'locator_failed'
  | 'assertion_failed'
  | 'timeout'
  | 'network_error'
  | 'script_error'
  | 'unknown';
```

### 3.2 聚合数据

```typescript
interface DailyStats {
  date: string;                  // YYYY-MM-DD
  totalExecutions: number;
  passed: number;
  failed: number;
  skipped: number;
  avgDuration: number;
  failuresByType: Record<FailureType, number>;
}

interface CaseStats {
  caseId: string;
  caseName: string;
  totalRuns: number;
  passRate: number;
  avgDuration: number;
  lastRun: number;
  stabilityScore: number;        // 0-100, 越高越稳定
  isFlakey: boolean;
  recentResults: ('passed' | 'failed')[];  // 最近 10 次结果
}

interface HealthScore {
  overall: number;               // 0-100
  components: {
    passRate: number;
    stability: number;
    performance: number;
    coverage: number;
  };
  trend: 'improving' | 'stable' | 'declining';
}
```

---

## 4. 核心模块设计

### 4.1 数据采集器 (Data Collector)

```typescript
class DataCollector {
  private db: Dexie;

  async recordExecution(record: ExecutionRecord): Promise<void> {
    // 存储执行记录
    await this.db.executions.add(record);

    // 更新每日统计
    await this.updateDailyStats(record);

    // 更新用例统计
    await this.updateCaseStats(record);

    // 检查告警规则
    await this.checkAlerts(record);
  }

  private async updateDailyStats(record: ExecutionRecord): Promise<void> {
    const date = this.formatDate(record.startTime);
    const existing = await this.db.dailyStats.get(date);

    if (existing) {
      existing.totalExecutions++;
      existing[record.status]++;
      // 更新平均耗时...
      await this.db.dailyStats.put(existing);
    } else {
      await this.db.dailyStats.add({
        date,
        totalExecutions: 1,
        passed: record.status === 'passed' ? 1 : 0,
        // ...
      });
    }
  }
}
```

### 4.2 分析引擎 (Analysis Engine)

```typescript
class AnalysisEngine {
  // 计算健康度评分
  async calculateHealthScore(): Promise<HealthScore> {
    const recent = await this.getRecentStats(7); // 最近 7 天

    const passRate = this.calculatePassRate(recent);
    const stability = this.calculateStability(recent);
    const performance = this.calculatePerformance(recent);

    const overall = passRate * 0.4 + stability * 0.35 + performance * 0.25;

    return {
      overall: Math.round(overall),
      components: { passRate, stability, performance, coverage: 0 },
      trend: this.calculateTrend(recent),
    };
  }

  // 识别 Flaky 测试
  async identifyFlakyTests(): Promise<CaseStats[]> {
    const cases = await this.db.caseStats.toArray();

    return cases.filter(c => {
      // 如果最近 10 次中有通过也有失败，且失败率在 20%-80% 之间
      const results = c.recentResults;
      const failCount = results.filter(r => r === 'failed').length;
      const failRate = failCount / results.length;

      return failRate > 0.2 && failRate < 0.8;
    });
  }

  // 分析失败热点
  async analyzeFailureHotspots(): Promise<Hotspot[]> {
    const failures = await this.db.executions
      .where('status').equals('failed')
      .limit(1000)
      .toArray();

    // 按失败步骤分组统计
    const stepFailures = new Map<string, number>();
    for (const f of failures) {
      if (f.failure) {
        const key = `${f.failure.stepIndex}:${f.steps[f.failure.stepIndex]?.description}`;
        stepFailures.set(key, (stepFailures.get(key) || 0) + 1);
      }
    }

    // 排序返回 Top 10
    return Array.from(stepFailures.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({
        description: key.split(':')[1],
        failureCount: count,
        percentage: count / failures.length * 100,
      }));
  }
}
```

### 4.3 报告生成器 (Report Generator)

```typescript
class ReportGenerator {
  async generateDailyReport(date: string): Promise<Report> {
    const stats = await this.analysisEngine.getDailyStats(date);
    const failures = await this.analysisEngine.getFailures(date);
    const hotspots = await this.analysisEngine.analyzeFailureHotspots();

    return {
      title: `测试执行日报 - ${date}`,
      summary: {
        totalExecutions: stats.totalExecutions,
        passRate: `${(stats.passed / stats.totalExecutions * 100).toFixed(1)}%`,
        avgDuration: `${(stats.avgDuration / 1000).toFixed(1)}s`,
      },
      failureAnalysis: {
        byType: stats.failuresByType,
        hotspots,
      },
      recommendations: this.generateRecommendations(stats, failures),
    };
  }

  async exportToPDF(report: Report): Promise<Blob> {
    const doc = new jsPDF();
    // 渲染报告内容...
    return doc.output('blob');
  }

  private generateRecommendations(stats: DailyStats, failures: any[]): string[] {
    const recommendations: string[] = [];

    if (stats.passed / stats.totalExecutions < 0.8) {
      recommendations.push('通过率低于 80%，建议检查失败用例并修复');
    }

    if (stats.failuresByType.locator_failed > 5) {
      recommendations.push('多个定位失败，建议启用自愈功能或更新元素定位');
    }

    return recommendations;
  }
}
```

---

## 5. UI 组件设计

### 5.1 仪表板布局

```
┌────────────────────────────────────────────────────────────────┐
│  📊 测试分析仪表板                    [今日] [7天] [30天] [自定义]│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 执行次数  │ │  通过率   │ │ 平均耗时  │ │  健康度   │          │
│  │   127    │ │  89.7%   │ │  12.3s   │ │    85    │          │
│  │  ↑ 12%   │ │  ↓ 2.1%  │ │  → 0%    │ │  ↑ 3     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                    执行趋势图                           │   │
│  │    ▂▃▅▆▇█▆▅▃▂▁▂▃▅▆▇█▆▅▃▂                              │   │
│  │    1  2  3  4  5  6  7  8  9  10 11 12 13 14          │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐ │
│  │   失败类型分布       │  │        失败热点                   │ │
│  │   ┌───┐             │  │  1. 点击登录按钮 (23次)           │ │
│  │   │   │  定位 45%   │  │  2. 验证成功提示 (18次)           │ │
│  │   └───┘             │  │  3. 输入用户名 (12次)             │ │
│  │   ┌─┐               │  │  ...                             │ │
│  │   └─┘  断言 30%     │  │                                  │ │
│  └─────────────────────┘  └─────────────────────────────────┘ │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  用例列表                              [稳定] [Flaky] [全部]│
│  ├────────────────────────────────────────────────────────┤   │
│  │  用例名称           通过率    耗时    稳定性   最后执行    │   │
│  │  用户登录流程       95%      8.2s    ⬤ 稳定   2分钟前    │   │
│  │  商品搜索测试       72%      15.1s   ⬤ Flaky  1小时前    │   │
│  │  订单提交流程       100%     22.3s   ⬤ 稳定   3小时前    │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 图表配置

```typescript
// 执行趋势图配置
const trendChartOption = {
  tooltip: { trigger: 'axis' },
  legend: { data: ['通过', '失败'] },
  xAxis: {
    type: 'category',
    data: dates, // ['12-01', '12-02', ...]
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: '通过',
      type: 'bar',
      stack: 'total',
      data: passedCounts,
      itemStyle: { color: '#10B981' },
    },
    {
      name: '失败',
      type: 'bar',
      stack: 'total',
      data: failedCounts,
      itemStyle: { color: '#EF4444' },
    },
  ],
};

// 失败类型饼图配置
const failureTypePieOption = {
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    data: [
      { value: 45, name: '定位失败' },
      { value: 30, name: '断言失败' },
      { value: 15, name: '超时' },
      { value: 10, name: '其他' },
    ],
  }],
};
```

---

## 6. 告警系统设计

```typescript
interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: AlertCondition;
  notification: NotificationConfig;
}

interface AlertCondition {
  type: 'pass_rate' | 'consecutive_failures' | 'duration' | 'flaky_detected';
  threshold: number;
  timeWindow?: number;           // 时间窗口 (分钟)
}

interface NotificationConfig {
  channels: ('browser' | 'email' | 'webhook')[];
  webhookUrl?: string;
  emailRecipients?: string[];
}

class AlertSystem {
  async checkAlerts(record: ExecutionRecord): Promise<void> {
    const rules = await this.getEnabledRules();

    for (const rule of rules) {
      if (await this.evaluateCondition(rule.condition, record)) {
        await this.sendNotification(rule, record);
      }
    }
  }

  private async evaluateCondition(
    condition: AlertCondition,
    record: ExecutionRecord
  ): Promise<boolean> {
    switch (condition.type) {
      case 'pass_rate':
        const rate = await this.calculateRecentPassRate(condition.timeWindow);
        return rate < condition.threshold;

      case 'consecutive_failures':
        const failures = await this.getConsecutiveFailures(record.caseId);
        return failures >= condition.threshold;

      // ...
    }
  }
}
```

---

## 7. 实施计划

1. **Week 1**: 数据模型设计，采集器实现，存储层
2. **Week 2**: 分析引擎核心算法，健康度计算
3. **Week 3**: UI 组件开发，图表集成
4. **Week 4**: 报告生成，告警系统，测试优化
