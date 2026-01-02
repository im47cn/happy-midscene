# 测试用例自愈 (Self-Healing) 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念：复用 Midscene AI 能力

Midscene.js 的核心价值是**用自然语言定位元素**。这意味着：

- 如果原始描述足够语义化，**直接重试就是自愈**
- 不需要额外的视觉相似度、文本模糊匹配等传统策略
- 完全复用已验证的 AI 定位能力，而非重新发明轮子

### 1.2 简化 vs 原设计

| 原设计 | 简化方案 |
|--------|----------|
| 4 种独立策略（视觉/文本/位置/AI） | 2 层策略（Midscene 原生 + deepThink） |
| 视觉 SSIM、文本编辑距离算法 | 直接用 AI 语义理解 |
| 复杂指纹（截图+哈希+位置+语义） | 轻量指纹（语义描述为主） |
| 需要额外图像处理库 | 零额外依赖 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Self-Healing Module                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │ FingerprintStore │     │  HealingEngine   │              │
│  │   (语义指纹存储)   │◀───▶│   (自愈协调器)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           │         ┌──────────────┴──────────────┐         │
│           │         ▼                             ▼         │
│           │  ┌─────────────┐              ┌─────────────┐   │
│           │  │ AiLocate    │              │ AiLocate    │   │
│           │  │ (Normal)    │              │ (DeepThink) │   │
│           │  └─────────────┘              └─────────────┘   │
│           │         │                             │         │
│           │         └──────────────┬──────────────┘         │
│           │                        ▼                        │
│           │              ┌─────────────────┐                │
│           │              │ ConfidenceCalc  │                │
│           │              │  (置信度计算)    │                │
│           │              └─────────────────┘                │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │ Midscene Core │  ← 复用现有能力
    │ - describe()  │
    │ - aiLocate()  │
    │ - verify()    │
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **FingerprintStore** | 存储和检索语义指纹 |
| **HealingEngine** | 协调自愈流程，管理重试策略 |
| **ConfidenceCalc** | 基于距离和区域计算置信度 |

---

## 3. 核心数据结构

### 3.1 语义指纹 (Semantic Fingerprint)

```typescript
interface SemanticFingerprint {
  id: string;                        // 唯一标识
  stepId: string;                    // 关联的测试步骤 ID

  // 核心：语义描述（由 Midscene describe 生成）
  semanticDescription: string;       // e.g., "Login button with text 'Sign In'"

  // 辅助信息（用于置信度计算）
  lastKnownRect: Rect;               // 上次成功定位的边界框
  lastKnownCenter: [number, number]; // 上次成功定位的中心点

  // 元数据
  createdAt: number;
  updatedAt: number;
  healingCount: number;              // 被自愈修复的次数
}
```

**设计决策**：
- 不存储截图，节省存储空间
- 语义描述是核心，其他都是辅助
- `healingCount` 用于识别不稳定元素

### 3.2 自愈结果 (Healing Result)

```typescript
interface HealingResult {
  success: boolean;
  healingId: string;

  // 定位结果
  element?: LocatedElement;

  // 策略信息
  strategy: 'normal' | 'deepThink';
  attemptsCount: number;

  // 置信度
  confidence: number;               // 0-100
  confidenceFactors: {
    distanceScore: number;          // 位置偏移评分
    sizeScore: number;              // 尺寸变化评分
  };

  // 性能
  timeCost: number;                 // ms
}
```

### 3.3 自愈历史记录

```typescript
interface HealingHistoryEntry {
  id: string;
  stepId: string;
  timestamp: number;

  // 失败信息
  originalDescription: string;
  failureReason: string;

  // 修复信息
  result: HealingResult;
  userConfirmed: boolean;

  // 指纹更新
  fingerprintUpdated: boolean;
  newDescription?: string;
}
```

---

## 4. 核心流程

### 4.1 指纹采集流程

```
步骤执行成功
      │
      ▼
┌─────────────────────────┐
│ 调用 describeElementAt  │ ← 复用 Midscene agent.describeElementAtPoint
│ Point(center, {verify}) │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 验证描述可反向定位       │ ← verifyPrompt: true 确保描述质量
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │ 验证通过？│
       └────┬────┘
       是   │   否
       │    │    │
       ▼    │    ▼
  存储指纹  │  重试 (最多3次)
            │    │
            │    ▼
            │  使用原始描述作为降级
            │
            ▼
┌─────────────────────────┐
│ 存储到 FingerprintStore │
└─────────────────────────┘
```

### 4.2 自愈流程

```
元素定位失败
      │
      ▼
┌─────────────────────────┐
│ 1. 加载历史语义指纹      │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │指纹存在？│
       └────┬────┘
       否   │   是
       │    │    │
       ▼    │    ▼
   返回失败 │  ┌─────────────────────────┐
   等待人工 │  │ 2. Normal 模式重定位     │
            │  │    aiLocate(description) │
            │  └───────────┬─────────────┘
            │              │
            │         ┌────┴────┐
            │         │ 成功？  │
            │         └────┬────┘
            │         是   │   否
            │         │    │    │
            │         ▼    │    ▼
            │     计算置信度│  ┌─────────────────────────┐
            │              │  │ 3. DeepThink 模式重定位  │
            │              │  │    aiLocate(desc,       │
            │              │  │      {deepThink: true}) │
            │              │  └───────────┬─────────────┘
            │              │              │
            │              │         ┌────┴────┐
            │              │         │ 成功？  │
            │              │         └────┬────┘
            │              │         是   │   否
            │              │         │    │    │
            │              │         ▼    │    ▼
            │              │     计算置信度│  返回失败
            │              │              │
            └──────────────┼──────────────┘
                           │
                           ▼
            ┌─────────────────────────────┐
            │ 4. 根据置信度决定下一步       │
            │   >= 80: 自动采用            │
            │   50-79: 请求用户确认        │
            │   < 50:  标记失败            │
            └─────────────────────────────┘
```

---

## 5. 置信度计算

### 5.1 计算公式

```typescript
function calculateConfidence(
  healingResult: LocateResult,
  fingerprint: SemanticFingerprint
): number {
  const { element } = healingResult;
  if (!element) return 0;

  // 1. 距离评分 (40%)
  const distance = distanceOfTwoPoints(
    element.center,
    fingerprint.lastKnownCenter
  );
  const distanceScore = Math.max(0, 100 - distance * 0.5);  // 每像素扣0.5分

  // 2. 尺寸评分 (30%)
  const sizeRatio = Math.min(
    element.rect.width / fingerprint.lastKnownRect.width,
    fingerprint.lastKnownRect.width / element.rect.width
  ) * Math.min(
    element.rect.height / fingerprint.lastKnownRect.height,
    fingerprint.lastKnownRect.height / element.rect.height
  );
  const sizeScore = sizeRatio * 100;

  // 3. 策略惩罚 (30%)
  // Normal 模式满分，DeepThink 模式扣 10 分
  const strategyScore = healingResult.strategy === 'normal' ? 100 : 90;

  // 加权计算
  const confidence =
    distanceScore * 0.4 +
    sizeScore * 0.3 +
    strategyScore * 0.3;

  return Math.round(confidence);
}
```

### 5.2 阈值说明

| 置信度范围 | 行为 | 说明 |
|-----------|------|------|
| >= 80 | 自动采用 | 高置信度，直接继续执行 |
| 50-79 | 请求确认 | 中等置信度，展示对比让用户决定 |
| < 50 | 标记失败 | 低置信度，可能是错误匹配 |

---

## 6. API 设计

### 6.1 HealingEngine 接口

```typescript
interface IHealingEngine {
  // 采集指纹
  collectFingerprint(
    stepId: string,
    element: LocatedElement
  ): Promise<SemanticFingerprint>;

  // 尝试自愈
  heal(
    stepId: string,
    originalDescription: string
  ): Promise<HealingResult>;

  // 确认修复结果
  confirmHealing(
    healingId: string,
    accepted: boolean,
    newDescription?: string  // 用户可手动修正描述
  ): Promise<void>;

  // 获取统计
  getStatistics(): HealingStatistics;
}
```

### 6.2 集成到 ExecutionEngine

```typescript
class ExecutionEngine {
  private healingEngine: IHealingEngine;

  async executeLocateStep(step: LocateStep): Promise<LocateResult> {
    try {
      const result = await this.agent.aiLocate(step.description);

      // 成功时采集指纹
      if (result.element) {
        await this.healingEngine.collectFingerprint(step.id, result.element);
      }

      return result;
    } catch (error) {
      if (this.isLocateError(error) && this.config.selfHealing.enabled) {
        // 触发自愈
        const healingResult = await this.healingEngine.heal(
          step.id,
          step.description
        );

        if (healingResult.success) {
          if (healingResult.confidence >= this.config.selfHealing.autoAcceptThreshold) {
            // 自动采用
            return this.retryWithHealedElement(step, healingResult);
          } else if (healingResult.confidence >= 50) {
            // 请求用户确认
            const confirmed = await this.requestUserConfirmation(healingResult);
            if (confirmed) {
              return this.retryWithHealedElement(step, healingResult);
            }
          }
        }
      }
      throw error;
    }
  }
}
```

---

## 7. 存储设计

### 7.1 IndexedDB Schema (Chrome Extension)

```typescript
const dbSchema = {
  name: 'MidsceneSelfHealing',
  version: 1,
  stores: {
    fingerprints: {
      keyPath: 'id',
      indexes: [
        { name: 'stepId', keyPath: 'stepId', unique: true },
        { name: 'updatedAt', keyPath: 'updatedAt' },
      ],
    },
    healingHistory: {
      keyPath: 'id',
      indexes: [
        { name: 'stepId', keyPath: 'stepId' },
        { name: 'timestamp', keyPath: 'timestamp' },
      ],
    },
  },
};
```

### 7.2 存储优化

- 指纹数据轻量，单条约 500 bytes
- 自动清理 90 天未更新的指纹
- 历史记录保留最近 1000 条

---

## 8. 配置项

```typescript
interface SelfHealingConfig {
  enabled: boolean;                  // 是否启用，默认 true
  autoAcceptThreshold: number;       // 自动采用阈值，默认 80
  maxAttempts: number;               // 最大尝试次数，默认 2 (normal + deepThink)
  enableDeepThink: boolean;          // 是否启用 deepThink，默认 true
  fingerprintRetentionDays: number;  // 指纹保留天数，默认 90
}
```

---

## 9. 复用的 Midscene 能力

| Midscene 能力 | 自愈中的用途 |
|--------------|-------------|
| `agent.describeElementAtPoint()` | 生成语义指纹 |
| `agent.aiLocate()` | Normal 模式重定位 |
| `agent.aiLocate({ deepThink: true })` | DeepThink 模式重定位 |
| `verifyLocator()` | 验证描述质量 |
| `distanceOfTwoPoints()` | 置信度计算 |

---

## 10. 优势总结

1. **实现简单**：复用现有能力，核心代码 < 500 行
2. **零额外依赖**：不需要 SSIM、图像处理库
3. **与 Midscene 一致**：AI 定位逻辑复用，行为可预测
4. **存储高效**：纯文本指纹，占用极小
5. **易于调试**：语义描述人类可读
