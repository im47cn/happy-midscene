# 合规性检查 - 任务清单

## 设计决策

**采用规则引擎 + 智能分析方案**：通过声明式规则定义和 AI 辅助的语义分析，实现全面的合规性检查。

核心特点：
- 声明式规则定义
- 多层次匹配引擎
- 自动修复建议
- 趋势分析报告

---

## Phase 1: 类型定义与核心接口

### 1.1 类型定义
- [ ] **类型文件** (`types/compliance.ts`)
  - `Rule` 接口
  - `RuleSet` 接口
  - `Violation` 接口
  - `ComplianceResult` 接口
  - `FixAction` 接口

### 1.2 核心接口
- [ ] **接口定义** (`services/compliance/interfaces.ts`)
  - `IComplianceChecker` 接口
  - `IRuleRegistry` 接口
  - `IAutoFixer` 接口
  - `IMatcher` 接口

---

## Phase 2: 规则引擎

### 2.1 规则引擎
- [ ] **RuleEngine** (`services/compliance/ruleEngine.ts`)
  - `checkCase()` 检查单个用例
  - `checkCases()` 批量检查
  - `buildContext()` 构建检查上下文
  - `createViolation()` 创建违规记录

### 2.2 规则注册表
- [ ] **RuleRegistry** (`services/compliance/ruleRegistry.ts`)
  - `registerRule()` 注册规则
  - `registerRuleSet()` 注册规则集
  - `getEnabledRules()` 获取启用规则
  - `enableRule()` / `disableRule()` 规则开关

### 2.3 规则存储
- [ ] **RuleStorage** (`services/compliance/ruleStorage.ts`)
  - 规则持久化
  - 规则集导入导出
  - 用户配置存储

---

## Phase 3: 匹配器实现

### 3.1 正则匹配器
- [ ] **RegexMatcher** (`services/compliance/matchers/regexMatcher.ts`)
  - 正则表达式匹配
  - 多目标支持
  - 匹配结果详情

### 3.2 AST 匹配器
- [ ] **AstMatcher** (`services/compliance/matchers/astMatcher.ts`)
  - 用例结构解析
  - 模式匹配
  - 位置定位

### 3.3 语义匹配器
- [ ] **SemanticMatcher** (`services/compliance/matchers/semanticMatcher.ts`)
  - AI 语义分析
  - 置信度评估
  - 上下文理解

### 3.4 自定义匹配器
- [ ] **CustomMatcher** (`services/compliance/matchers/customMatcher.ts`)
  - 函数式验证
  - 复杂逻辑支持
  - 组合条件

---

## Phase 4: 内置规则

### 4.1 命名规范规则
- [ ] **NamingRules** (`services/compliance/rules/namingRules.ts`)
  - 用例命名规范
  - 步骤描述规范
  - 变量命名规范

### 4.2 结构规范规则
- [ ] **StructureRules** (`services/compliance/rules/structureRules.ts`)
  - 断言要求检查
  - 步骤数量限制
  - 清理步骤检查

### 4.3 安全规范规则
- [ ] **SecurityRules** (`services/compliance/rules/securityRules.ts`)
  - 敏感数据检查
  - 权限验证检查
  - 输入验证检查

### 4.4 最佳实践规则
- [ ] **BestPracticeRules** (`services/compliance/rules/bestPracticeRules.ts`)
  - 等待策略检查
  - 重试机制检查
  - 日志记录检查

---

## Phase 5: 合规检查器

### 5.1 合规检查器
- [ ] **ComplianceChecker** (`services/compliance/complianceChecker.ts`)
  - `checkCase()` 单用例检查
  - `checkAll()` 全量检查
  - `getComplianceScore()` 合规分数
  - 增量检查支持

### 5.2 检查调度器
- [ ] **CheckScheduler** (`services/compliance/checkScheduler.ts`)
  - 定时检查任务
  - 触发器管理
  - 检查队列

### 5.3 结果缓存
- [ ] **ResultCache** (`services/compliance/resultCache.ts`)
  - 检查结果缓存
  - 缓存失效策略
  - 增量更新

---

## Phase 6: 违规报告

### 6.1 违规报告器
- [ ] **ViolationReporter** (`services/compliance/violationReporter.ts`)
  - `generateReport()` 生成报告
  - `formatViolation()` 格式化违规
  - 多格式导出

### 6.2 报告模板
- [ ] **ReportTemplates** (`services/compliance/reportTemplates.ts`)
  - 摘要模板
  - 详情模板
  - 对比模板

### 6.3 报告导出
- [ ] **ReportExporter** (`services/compliance/reportExporter.ts`)
  - HTML 导出
  - PDF 导出
  - JSON 导出

---

## Phase 7: 自动修复

### 7.1 自动修复器
- [ ] **AutoFixer** (`services/compliance/autoFixer.ts`)
  - `getFixableViolations()` 获取可修复项
  - `previewFix()` 预览修复
  - `applyFix()` 应用修复
  - `applyFixes()` 批量修复

### 7.2 修复策略
- [ ] **FixStrategies** (`services/compliance/fixStrategies.ts`)
  - 替换策略
  - 插入策略
  - 删除策略
  - 重排策略

### 7.3 修复验证
- [ ] **FixValidator** (`services/compliance/fixValidator.ts`)
  - 修复安全性检查
  - 修复效果验证
  - 回滚支持

---

## Phase 8: 趋势分析

### 8.1 趋势分析器
- [ ] **TrendAnalyzer** (`services/compliance/trendAnalyzer.ts`)
  - `getTrend()` 获取趋势数据
  - `getTeamComparison()` 团队对比
  - `getTopViolations()` 热点违规

### 8.2 统计计算
- [ ] **StatisticsCalculator** (`services/compliance/statisticsCalculator.ts`)
  - 合规率计算
  - 改进率计算
  - 分布统计

### 8.3 建议生成
- [ ] **SuggestionGenerator** (`services/compliance/suggestionGenerator.ts`)
  - 改进建议生成
  - 优先级排序
  - 影响评估

---

## Phase 9: UI 组件

### 9.1 合规检查面板
- [ ] **CompliancePanel** (`components/CompliancePanel.tsx`)
  - 检查触发
  - 结果概览
  - 违规列表

### 9.2 规则配置
- [ ] **RuleConfigView** (`components/RuleConfigView.tsx`)
  - 规则列表
  - 规则开关
  - 严重级别调整

### 9.3 违规详情
- [ ] **ViolationDetail** (`components/ViolationDetail.tsx`)
  - 违规详情展示
  - 修复预览
  - 一键修复

### 9.4 趋势图表
- [ ] **ComplianceTrendChart** (`components/ComplianceTrendChart.tsx`)
  - 趋势折线图
  - 分布饼图
  - 团队对比图

---

## Phase 10: 测试

### 10.1 单元测试
- [ ] `ruleEngine.test.ts` - 规则引擎测试
- [ ] `matchers.test.ts` - 匹配器测试
- [ ] `complianceChecker.test.ts` - 合规检查测试
- [ ] `autoFixer.test.ts` - 自动修复测试
- [ ] `trendAnalyzer.test.ts` - 趋势分析测试

### 10.2 集成测试
- [ ] 端到端合规检查测试
- [ ] 规则集导入导出测试
- [ ] 批量修复测试
- [ ] 性能基准测试

---

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── types/
│   └── compliance.ts               # 类型定义
├── services/
│   ├── compliance/
│   │   ├── index.ts                # 模块导出
│   │   ├── interfaces.ts           # 接口定义
│   │   ├── ruleEngine.ts           # 规则引擎
│   │   ├── ruleRegistry.ts         # 规则注册表
│   │   ├── ruleStorage.ts          # 规则存储
│   │   ├── complianceChecker.ts    # 合规检查器
│   │   ├── checkScheduler.ts       # 检查调度器
│   │   ├── violationReporter.ts    # 违规报告器
│   │   ├── autoFixer.ts            # 自动修复器
│   │   ├── trendAnalyzer.ts        # 趋势分析器
│   │   ├── matchers/
│   │   │   ├── regexMatcher.ts
│   │   │   ├── astMatcher.ts
│   │   │   ├── semanticMatcher.ts
│   │   │   └── customMatcher.ts
│   │   ├── rules/
│   │   │   ├── namingRules.ts
│   │   │   ├── structureRules.ts
│   │   │   ├── securityRules.ts
│   │   │   └── bestPracticeRules.ts
│   │   └── __tests__/
│   │       ├── ruleEngine.test.ts
│   │       ├── matchers.test.ts
│   │       └── complianceChecker.test.ts
└── components/
    ├── CompliancePanel.tsx         # 合规检查面板
    ├── RuleConfigView.tsx          # 规则配置
    ├── ViolationDetail.tsx         # 违规详情
    └── ComplianceTrendChart.tsx    # 趋势图表
```

---

## 依赖关系

```
types/compliance.ts
       │
       ▼
interfaces.ts
       │
       ├─────────────────────────────────────┐
       ▼                                     ▼
ruleEngine.ts ◀── ruleRegistry.ts    matchers/
       │              │                     │
       │              ▼                     │
       │       ruleStorage.ts               │
       │              │                     │
       └──────────────┼─────────────────────┘
                      ▼
           complianceChecker.ts ◀── checkScheduler.ts
                      │
                      ▼
           violationReporter.ts
                      │
                      ├─────────────────┐
                      ▼                 ▼
              autoFixer.ts       trendAnalyzer.ts
                      │                 │
                      └────────┬────────┘
                               ▼
              components/CompliancePanel.tsx
```

---

## 验收标准

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 规则匹配准确率 | > 99% | 待开发 |
| 误报率 | < 5% | 待开发 |
| 单用例检查时间 | < 1s | 待开发 |
| 批量检查吞吐量 | > 100/秒 | 待开发 |
| 修复建议采纳率 | > 70% | 待开发 |

---

## 实现进度

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 | 待开始 | 类型定义与核心接口 |
| Phase 2 | 待开始 | 规则引擎 |
| Phase 3 | 待开始 | 匹配器实现 |
| Phase 4 | 待开始 | 内置规则 |
| Phase 5 | 待开始 | 合规检查器 |
| Phase 6 | 待开始 | 违规报告 |
| Phase 7 | 待开始 | 自动修复 |
| Phase 8 | 待开始 | 趋势分析 |
| Phase 9 | 待开始 | UI 组件 |
| Phase 10 | 待开始 | 测试 |
