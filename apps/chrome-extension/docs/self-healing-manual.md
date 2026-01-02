# 测试用例自愈用户手册

本手册介绍如何使用 AI Test Generator 的测试用例自愈功能，通过 AI 驱动的语义指纹机制自动修复因 UI 变化导致的元素定位失败。

## 目录

1. [功能概述](#1-功能概述)
2. [工作原理](#2-工作原理)
3. [快速开始](#3-快速开始)
4. [语义指纹](#4-语义指纹)
5. [修复策略](#5-修复策略)
6. [置信度计算](#6-置信度计算)
7. [配置管理](#7-配置管理)
8. [API 参考](#8-api-参考)
9. [最佳实践](#9-最佳实践)

---

## 1. 功能概述

测试用例自愈模块提供以下核心能力：

- **语义指纹采集**：自动收集元素的自然语言描述
- **失败检测**：识别元素定位失败并触发自愈
- **两层修复**：Normal 模式 + DeepThink 模式
- **置信度评估**：基于距离、尺寸、策略计算修复置信度
- **人工确认**：中等置信度修复需用户确认

---

## 2. 工作原理

### 2.1 自愈流程

```
测试步骤执行
    │
    ▼
元素定位
    │
    ├── 成功 ──► 采集/更新语义指纹 ──► 继续执行
    │
    └── 失败 ──► 检查历史指纹
                    │
                    ├── 无指纹 ──► 返回失败
                    │
                    └── 有指纹 ──► 触发自愈流程
                                    │
                                    ▼
                            Normal 模式尝试
                                    │
                                    ├── 成功 ──► 计算置信度
                                    │
                                    └── 失败 ──► DeepThink 模式
                                                    │
                                                    ├── 成功 ──► 计算置信度
                                                    │
                                                    └── 失败 ──► 修复失败
```

### 2.2 核心理念

系统完全复用 Midscene.js 的 AI 定位能力：
- 语义化描述天然具备定位鲁棒性
- 不依赖传统的 XPath、CSS 选择器
- 无需额外的视觉相似度算法

---

## 3. 快速开始

### 3.1 启用自愈

自愈功能默认启用，无需额外配置：

```typescript
import { healingEngine } from './services/healing';

// 检查是否启用
const enabled = healingEngine.isEnabled(); // true
```

### 3.2 查看自愈结果

执行测试后，可在执行记录中查看自愈详情：

```
步骤: 点击"提交订单"按钮
状态: ✓ 自愈成功
原因: 按钮文本从"提交订单"变为"确认订单"
置信度: 92%
策略: Normal 模式
```

### 3.3 确认修复

当置信度在 50-80% 之间时，系统会暂停并请求确认：

```
⚠️ 自愈建议需要确认

原始描述: 点击"登录"按钮
新定位元素: "Sign In" 按钮
置信度: 68%

[确认采用] [忽略并失败]
```

---

## 4. 语义指纹

### 4.1 指纹结构

```typescript
interface SemanticFingerprint {
  stepId: string;           // 测试步骤 ID
  description: string;      // 语义描述（AI 生成）
  originalLocator: string;  // 原始定位描述
  lastKnownRect: BoundingBox; // 最后已知位置
  lastKnownCenter: Point;   // 最后已知中心点
  healingCount: number;     // 自愈次数
  createdAt: number;        // 创建时间
  updatedAt: number;        // 更新时间
}
```

### 4.2 指纹采集

首次执行成功时自动采集：

```typescript
import { fingerprintCollector } from './services/healing';

// 手动采集指纹（通常自动完成）
const fingerprint = await fingerprintCollector.collect({
  stepId: 'step_001',
  element: targetElement,
  screenshot: currentScreenshot,
});
```

### 4.3 指纹验证

采集时验证描述可反向定位到同一元素：

```typescript
// 验证流程
1. AI 生成描述: "蓝色的登录按钮"
2. 使用描述定位: aiLocate("蓝色的登录按钮")
3. 比较定位结果与原始元素
4. 匹配则保存，不匹配则重试（最多 3 次）
```

### 4.4 指纹管理

```typescript
import { fingerprintStorage } from './services/healing';

// 获取指纹
const fp = await fingerprintStorage.get('step_001');

// 更新指纹
await fingerprintStorage.update('step_001', {
  lastKnownRect: newRect,
  healingCount: fp.healingCount + 1,
});

// 删除过期指纹（默认 90 天）
await fingerprintStorage.cleanup(90);
```

---

## 5. 修复策略

### 5.1 Normal 模式

使用语义描述直接调用 AI 定位：

```typescript
// Normal 模式定位
const result = await aiLocate(fingerprint.description);
```

**特点**：
- 速度快（约 2-3 秒）
- 适用于 UI 小幅变化
- 置信度基础分满分

### 5.2 DeepThink 模式

先定位搜索区域，再在子区域内精确定位：

```typescript
// DeepThink 模式定位
const result = await aiLocate(fingerprint.description, {
  deepThink: true,
});
```

**特点**：
- 更精确（约 5-8 秒）
- 适用于 UI 较大变化
- 置信度基础分扣 10 分

### 5.3 策略优先级

```
1. Normal 模式（首选）
   ├── 成功 ──► 使用结果
   └── 失败 ──► 尝试 DeepThink

2. DeepThink 模式（降级）
   ├── 成功 ──► 使用结果（置信度 -10）
   └── 失败 ──► 标记修复失败
```

---

## 6. 置信度计算

### 6.1 计算公式

```
置信度 = 距离评分 × 40% + 尺寸评分 × 30% + 策略评分 × 30%
```

### 6.2 距离评分

基于新旧定位中心点的像素距离：

| 距离 (px) | 评分 |
|-----------|------|
| 0-10 | 100 |
| 10-50 | 90 |
| 50-100 | 70 |
| 100-200 | 50 |
| > 200 | 30 |

### 6.3 尺寸评分

基于新旧元素边界框的尺寸比例：

| 尺寸比例 | 评分 |
|----------|------|
| 90%-110% | 100 |
| 80%-120% | 80 |
| 70%-130% | 60 |
| < 70% 或 > 130% | 40 |

### 6.4 策略评分

| 策略 | 评分 |
|------|------|
| Normal 模式 | 100 |
| DeepThink 模式 | 90 |

### 6.5 置信度阈值

| 置信度 | 处理方式 |
|--------|----------|
| >= 80 | 自动采用修复结果 |
| 50-79 | 暂停执行，请求用户确认 |
| < 50 | 标记为修复失败 |

```typescript
import { confidenceCalculator } from './services/healing';

// 计算置信度
const confidence = confidenceCalculator.calculate({
  originalRect: fingerprint.lastKnownRect,
  newRect: healedElement.rect,
  strategy: 'normal',
});
// 结果: { score: 85, breakdown: { distance: 90, size: 80, strategy: 100 } }
```

---

## 7. 配置管理

### 7.1 配置项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `enabled` | `true` | 是否启用自愈功能 |
| `autoAcceptThreshold` | `80` | 自动采用的置信度阈值 |
| `enableDeepThink` | `true` | 是否启用 DeepThink 模式 |
| `fingerprintRetentionDays` | `90` | 指纹保留天数 |
| `maxHealingAttempts` | `2` | 最大自愈尝试次数 |

### 7.2 修改配置

```typescript
import { healingConfig } from './services/healing';

// 更新配置
healingConfig.update({
  autoAcceptThreshold: 85,
  enableDeepThink: false,
});

// 获取当前配置
const config = healingConfig.get();
```

### 7.3 禁用自愈

```typescript
// 全局禁用
healingConfig.update({ enabled: false });

// 单个步骤禁用
await executeStep(step, { disableHealing: true });
```

---

## 8. API 参考

### 8.1 HealingEngine

```typescript
import { healingEngine } from './services/healing';

// 尝试自愈
attemptHealing(
  stepId: string,
  originalLocator: string
): Promise<HealingResult>

// 确认修复
confirmHealing(
  healingId: string,
  accepted: boolean
): Promise<void>

// 获取自愈统计
getStatistics(timeRange?: TimeRange): HealingStatistics
```

### 8.2 FingerprintCollector

```typescript
import { fingerprintCollector } from './services/healing';

// 采集指纹
collect(options: CollectOptions): Promise<SemanticFingerprint>

// 验证指纹
validate(fingerprint: SemanticFingerprint): Promise<boolean>

// 更新指纹
update(stepId: string, element: Element): Promise<void>
```

### 8.3 ConfidenceCalculator

```typescript
import { confidenceCalculator } from './services/healing';

// 计算置信度
calculate(params: ConfidenceParams): ConfidenceResult

// 获取阈值建议
getThresholdRecommendation(history: HealingHistory[]): number
```

### 8.4 HealingStorage

```typescript
import { healingStorage } from './services/healing';

// 指纹操作
getFingerprint(stepId: string): Promise<SemanticFingerprint>
saveFingerprint(fingerprint: SemanticFingerprint): Promise<void>
deleteFingerprint(stepId: string): Promise<void>

// 历史记录
getHealingHistory(filter?: HistoryFilter): Promise<HealingRecord[]>
```

---

## 9. 最佳实践

### 9.1 提高自愈成功率

1. **使用语义化描述**
   ```
   推荐: 点击"提交订单"按钮
   避免: 点击第三个按钮
   ```

2. **避免依赖位置**
   ```
   推荐: 点击导航栏中的"设置"图标
   避免: 点击页面右上角的图标
   ```

3. **使用唯一标识**
   ```
   推荐: 点击用户名旁边的"编辑"链接
   避免: 点击"编辑"链接
   ```

### 9.2 置信度阈值调整

| 场景 | 建议阈值 |
|------|----------|
| 生产环境回归测试 | 85-90 |
| 开发环境测试 | 70-80 |
| 探索性测试 | 50-60 |

### 9.3 指纹维护

- **定期清理**：删除 90 天以上的旧指纹
- **高频自愈监控**：关注 `healingCount` 高的步骤
- **UI 重构后重置**：大规模 UI 变更后清理相关指纹

### 9.4 性能优化

- Normal 模式优先，减少 DeepThink 调用
- 批量执行时关闭自动确认，最后统一处理
- 合理设置超时时间

---

## 10. 自愈统计

### 10.1 查看统计

```typescript
const stats = await healingEngine.getStatistics('7d');
// 结果: {
//   totalAttempts: 150,
//   successCount: 120,
//   successRate: 80,
//   normalModeCount: 100,
//   deepThinkCount: 50,
//   avgConfidence: 82,
//   avgHealingTime: 3200 // ms
// }
```

### 10.2 高频自愈元素

```typescript
const hotspots = await healingEngine.getHealingHotspots('30d');
// 结果: [
//   { stepId: 'step_001', healingCount: 15, lastHealed: ... },
//   { stepId: 'step_023', healingCount: 12, lastHealed: ... },
// ]
```

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2024-01 | 初始版本，支持两层修复策略 |

---

## 相关文档

- [需求规格说明书](../../../specs/self-healing/requirements.md)
- [设计文档](../../../specs/self-healing/design.md)
- [开发任务](../../../specs/self-healing/tasks.md)
