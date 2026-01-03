# 监控告警集成 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**多通道覆盖，智能收敛**
- 支持多种告警通道确保送达
- 智能收敛减少告警噪音
- 升级机制确保问题不被忽略

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| 告警管理器 | 扩展多通道支持 |
| 分析引擎 | 提供告警数据源 |
| 异常检测 | 触发告警事件 |
| 执行引擎 | 暴露监控指标 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│               Monitoring & Alert Integration                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  MetricsExporter │     │  AlertDispatcher │              │
│  │   (指标导出器)    │────▶│   (告警分发器)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│  ┌────────┴─────────────────────────┴───────┐               │
│  │            Alert Channels                │               │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │               │
│  │  │WeChat│  │DingTalk│ │Slack│  │Email │ │               │
│  │  └──────┘  └──────┘  └──────┘  └──────┘ │               │
│  └──────────────────────────────────────────┘               │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │AlertAggregator   │     │EscalationManager │              │
│  │  (告警收敛器)     │◀───▶│  (升级管理器)    │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │ Prometheus /  │  ← 外部监控系统
    │ Grafana       │
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **MetricsExporter** | 暴露监控指标 |
| **AlertDispatcher** | 分发告警到各通道 |
| **AlertChannels** | 各告警通道实现 |
| **AlertAggregator** | 告警收敛和去重 |
| **EscalationManager** | 告警升级管理 |

---

## 3. 核心数据结构

### 3.1 监控指标

```typescript
interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

interface MetricsConfig {
  enabled: boolean;
  endpoint: string;
  format: 'prometheus' | 'statsd' | 'json';
  interval: number;
  labels: Record<string, string>;
}
```

### 3.2 告警定义

```typescript
interface Alert {
  id: string;
  name: string;
  severity: Severity;
  status: AlertStatus;
  condition: string;
  message: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: number;
  endsAt?: number;
  fingerprint: string;
}

type Severity = 'info' | 'warning' | 'high' | 'critical';
type AlertStatus = 'firing' | 'acknowledged' | 'resolved' | 'silenced';
```

### 3.3 告警策略

```typescript
interface AlertPolicy {
  id: string;
  name: string;
  enabled: boolean;
  condition: AlertCondition;
  severity: Severity;
  channels: string[];
  recipients: Recipient[];
  aggregation?: AggregationConfig;
  escalation?: EscalationConfig;
  silence?: SilenceConfig;
}

interface AlertCondition {
  type: ConditionType;
  metric?: string;
  operator?: ComparisonOperator;
  threshold?: number;
  duration?: number;
  expression?: string;
}

type ConditionType =
  | 'threshold'
  | 'rate_change'
  | 'consecutive'
  | 'pattern'
  | 'custom';

interface AggregationConfig {
  enabled: boolean;
  window: number;
  groupBy: string[];
  maxAlerts: number;
}

interface EscalationConfig {
  enabled: boolean;
  levels: EscalationLevel[];
}

interface EscalationLevel {
  waitMinutes: number;
  recipients: Recipient[];
  channels: string[];
}
```

### 3.4 告警通道

```typescript
interface AlertChannel {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  config: ChannelConfig;
  rateLimit?: RateLimitConfig;
}

type ChannelType =
  | 'wechat'
  | 'dingtalk'
  | 'feishu'
  | 'slack'
  | 'email'
  | 'sms'
  | 'phone'
  | 'webhook'
  | 'pagerduty'
  | 'opsgenie';

interface ChannelConfig {
  // 企业微信
  wechat?: {
    webhookUrl: string;
    mentionUsers?: string[];
  };

  // 钉钉
  dingtalk?: {
    webhookUrl: string;
    secret?: string;
    atMobiles?: string[];
  };

  // 邮件
  email?: {
    smtpHost: string;
    smtpPort: number;
    username: string;
    password: string;
    from: string;
  };

  // Webhook
  webhook?: {
    url: string;
    method: 'POST' | 'PUT';
    headers?: Record<string, string>;
    template?: string;
  };
}
```

---

## 4. 核心流程

### 4.1 指标采集流程

```
执行事件
      │
      ▼
┌─────────────────────────┐
│ 1. 收集执行数据         │
│    - 执行状态           │
│    - 执行时间           │
│    - 错误类型           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 更新指标             │
│    - Counter 增加       │
│    - Gauge 设置         │
│    - Histogram 记录     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 暴露指标             │
│    - HTTP 端点          │
│    - Push Gateway       │
└───────────┬─────────────┘
            │
            ▼
   监控系统抓取
```

### 4.2 告警触发流程

```
告警条件满足
      │
      ▼
┌─────────────────────────┐
│ 1. 创建告警实例         │
│    - 生成 ID            │
│    - 计算指纹           │
│    - 设置标签           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 收敛处理             │
│    - 检查是否重复       │
│    - 聚合相似告警       │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │需要发送？│
       └────┬────┘
       是   │   否
       │    │    │
       ▼    │    ▼
┌─────────┐ │  更新计数
│获取策略 │ │
│接收人   │ │
└────┬────┘ │
     │      │
     ▼      │
┌─────────────────────────┐
│ 3. 分发到通道           │
│    - 格式化消息         │
│    - 调用通道 API       │
│    - 记录发送状态       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 启动升级计时         │
│    - 设置超时           │
│    - 监控确认状态       │
└─────────────────────────┘
```

### 4.3 告警升级流程

```
升级计时器触发
      │
      ▼
┌─────────────────────────┐
│ 1. 检查告警状态         │
│    - 是否已确认         │
│    - 是否已解决         │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │未处理？ │
       └────┬────┘
       是   │   否
       │    │    │
       ▼    │    ▼
┌─────────┐ │  取消升级
│获取下一 │ │
│升级级别 │ │
└────┬────┘ │
     │      │
     ▼      │
┌─────────────────────────┐
│ 2. 发送升级通知         │
│    - 通知新接收人       │
│    - 标记升级记录       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 设置下一级计时       │
│    - 或标记最终升级     │
└─────────────────────────┘
```

---

## 5. 告警通道实现

### 5.1 企业微信

```typescript
class WeChatChannel implements IAlertChannel {
  async send(alert: Alert, config: WeChatConfig): Promise<void> {
    const message = this.formatMessage(alert);

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          content: message,
          mentioned_list: config.mentionUsers,
        },
      }),
    });
  }

  private formatMessage(alert: Alert): string {
    return `
## ${this.getSeverityEmoji(alert.severity)} ${alert.name}

**状态**: ${alert.status}
**严重程度**: ${alert.severity}
**时间**: ${new Date(alert.startsAt).toLocaleString()}

${alert.message}

${Object.entries(alert.labels)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}
    `;
  }
}
```

### 5.2 钉钉

```typescript
class DingTalkChannel implements IAlertChannel {
  async send(alert: Alert, config: DingTalkConfig): Promise<void> {
    const message = this.formatMessage(alert);
    const timestamp = Date.now();
    const sign = this.calculateSign(config.secret, timestamp);

    await fetch(`${config.webhookUrl}&timestamp=${timestamp}&sign=${sign}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: alert.name,
          text: message,
        },
        at: {
          atMobiles: config.atMobiles,
        },
      }),
    });
  }
}
```

### 5.3 Webhook

```typescript
class WebhookChannel implements IAlertChannel {
  async send(alert: Alert, config: WebhookConfig): Promise<void> {
    const body = config.template
      ? this.renderTemplate(config.template, alert)
      : alert;

    await fetch(config.url, {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(body),
    });
  }
}
```

---

## 6. API 设计

### 6.1 MetricsExporter

```typescript
interface IMetricsExporter {
  register(metric: MetricDefinition): void;

  increment(name: string, labels?: Record<string, string>): void;

  set(name: string, value: number, labels?: Record<string, string>): void;

  observe(name: string, value: number, labels?: Record<string, string>): void;

  getMetrics(): string;

  pushMetrics(): Promise<void>;
}
```

### 6.2 AlertDispatcher

```typescript
interface IAlertDispatcher {
  dispatch(alert: Alert): Promise<DispatchResult>;

  addChannel(channel: AlertChannel): void;

  removeChannel(channelId: string): void;

  getChannels(): AlertChannel[];

  testChannel(channelId: string): Promise<boolean>;
}
```

### 6.3 AlertAggregator

```typescript
interface IAlertAggregator {
  aggregate(alert: Alert): AggregatedAlert | null;

  getActiveGroups(): AlertGroup[];

  flush(): Alert[];

  configure(config: AggregationConfig): void;
}
```

### 6.4 EscalationManager

```typescript
interface IEscalationManager {
  startEscalation(alert: Alert, policy: AlertPolicy): void;

  acknowledgeAlert(alertId: string, by: string): void;

  resolveAlert(alertId: string): void;

  getEscalationStatus(alertId: string): EscalationStatus;
}
```

---

## 7. 监控指标

### 7.1 Prometheus 格式

```
# HELP midscene_executions_total Total number of test executions
# TYPE midscene_executions_total counter
midscene_executions_total{status="passed"} 1234
midscene_executions_total{status="failed"} 56
midscene_executions_total{status="skipped"} 78

# HELP midscene_execution_duration_seconds Duration of test executions
# TYPE midscene_execution_duration_seconds histogram
midscene_execution_duration_seconds_bucket{le="1"} 100
midscene_execution_duration_seconds_bucket{le="5"} 500
midscene_execution_duration_seconds_bucket{le="10"} 800
midscene_execution_duration_seconds_bucket{le="+Inf"} 1000

# HELP midscene_pass_rate Current test pass rate
# TYPE midscene_pass_rate gauge
midscene_pass_rate 0.956

# HELP midscene_flaky_tests_count Number of flaky tests
# TYPE midscene_flaky_tests_count gauge
midscene_flaky_tests_count 5
```

### 7.2 Grafana 仪表板

```json
{
  "title": "Midscene Test Dashboard",
  "panels": [
    {
      "title": "Pass Rate",
      "type": "gauge",
      "targets": [
        { "expr": "midscene_pass_rate * 100" }
      ]
    },
    {
      "title": "Executions Over Time",
      "type": "graph",
      "targets": [
        { "expr": "rate(midscene_executions_total[5m])" }
      ]
    }
  ]
}
```

---

## 8. 集成方案

### 8.1 Prometheus 集成

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'midscene'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 8.2 Alertmanager 集成

```yaml
# alertmanager.yml
route:
  group_by: ['alertname']
  receiver: 'midscene-alerts'

receivers:
  - name: 'midscene-alerts'
    webhook_configs:
      - url: 'http://midscene/api/alerts/webhook'
```

---

## 9. 优势总结

1. **多通道覆盖**：主流即时通讯和监控平台全覆盖
2. **智能收敛**：减少告警噪音提高效率
3. **升级机制**：确保重要问题不被忽略
4. **灵活配置**：支持复杂的告警策略
5. **标准兼容**：支持 Prometheus 等标准格式
