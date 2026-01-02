# 合规性检查 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**规则驱动，自动执行**
- 声明式规则定义
- 自动化检查执行
- 智能修复建议

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| 用例存储 | 添加合规性标记 |
| 执行引擎 | 执行前合规检查 |
| 报告生成 | 集成合规报告 |
| 分析引擎 | 复用统计能力 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                   Compliance Check System                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │   RuleEngine     │     │  ComplianceChecker│             │
│  │   (规则引擎)      │────▶│   (合规检查器)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │   RuleRegistry   │     │  ViolationReporter│             │
│  │   (规则注册表)    │◀───▶│   (违规报告器)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │   AutoFixer      │     │  TrendAnalyzer   │              │
│  │   (自动修复器)    │     │   (趋势分析器)   │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │  TestCaseData │  ← 复用用例存储
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **RuleEngine** | 规则执行和匹配 |
| **RuleRegistry** | 规则注册和管理 |
| **ComplianceChecker** | 合规性检查协调 |
| **ViolationReporter** | 违规报告生成 |
| **AutoFixer** | 自动修复建议 |
| **TrendAnalyzer** | 趋势统计分析 |

---

## 3. 核心数据结构

### 3.1 规则定义

```typescript
interface Rule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: Severity;
  enabled: boolean;
  matcher: RuleMatcher;
  fixer?: RuleFixer;
  metadata?: RuleMetadata;
}

type RuleCategory =
  | 'naming'           // 命名规范
  | 'structure'        // 结构规范
  | 'security'         // 安全规范
  | 'performance'      // 性能规范
  | 'accessibility'    // 可访问性
  | 'documentation'    // 文档规范
  | 'best_practice';   // 最佳实践

type Severity = 'error' | 'warning' | 'info';

interface RuleMatcher {
  type: MatcherType;
  config: MatcherConfig;
}

type MatcherType =
  | 'regex'            // 正则匹配
  | 'ast'              // AST 匹配
  | 'semantic'         // 语义匹配
  | 'custom';          // 自定义函数

interface MatcherConfig {
  pattern?: string;           // 正则模式
  target?: MatchTarget;       // 匹配目标
  condition?: string;         // 条件表达式
  validator?: (ctx: MatchContext) => boolean;
}

type MatchTarget =
  | 'case_name'
  | 'step_description'
  | 'step_action'
  | 'step_target'
  | 'assertion'
  | 'full_case';
```

### 3.2 违规记录

```typescript
interface Violation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: Severity;
  caseId: string;
  caseName: string;
  location: ViolationLocation;
  message: string;
  suggestion?: string;
  fixable: boolean;
  fixAction?: FixAction;
  timestamp: number;
}

interface ViolationLocation {
  type: 'case' | 'step' | 'assertion';
  stepIndex?: number;
  field?: string;
  line?: number;
  column?: number;
}

interface FixAction {
  type: FixActionType;
  original: string;
  fixed: string;
  auto: boolean;
}

type FixActionType =
  | 'replace'
  | 'insert'
  | 'delete'
  | 'reorder';
```

### 3.3 检查结果

```typescript
interface ComplianceResult {
  caseId: string;
  caseName: string;
  checkTime: number;
  duration: number;
  status: ComplianceStatus;
  summary: ComplianceSummary;
  violations: Violation[];
  suggestions: Suggestion[];
}

type ComplianceStatus = 'compliant' | 'warning' | 'non_compliant';

interface ComplianceSummary {
  totalRules: number;
  passed: number;
  warnings: number;
  errors: number;
  skipped: number;
  score: number;  // 0-100
}

interface Suggestion {
  type: SuggestionType;
  priority: Priority;
  description: string;
  impact: string;
  actionItems: string[];
}

type SuggestionType =
  | 'add_assertion'
  | 'improve_description'
  | 'add_cleanup'
  | 'add_negative_case'
  | 'optimize_steps';
```

### 3.4 规则集

```typescript
interface RuleSet {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  rules: Rule[];
  extends?: string[];  // 继承其他规则集
  metadata: RuleSetMetadata;
}

interface RuleSetMetadata {
  standard?: string;         // 对应标准（如 WCAG, OWASP）
  industry?: string;         // 行业
  organization?: string;     // 组织
  lastUpdated: number;
}

interface RuleSetConfig {
  ruleSetId: string;
  enabled: boolean;
  overrides?: RuleOverride[];
}

interface RuleOverride {
  ruleId: string;
  enabled?: boolean;
  severity?: Severity;
  config?: Partial<MatcherConfig>;
}
```

### 3.5 趋势数据

```typescript
interface ComplianceTrend {
  period: TrendPeriod;
  dataPoints: TrendDataPoint[];
  improvement: number;
  topViolations: ViolationSummary[];
  recommendations: string[];
}

interface TrendDataPoint {
  timestamp: number;
  score: number;
  totalCases: number;
  compliantCases: number;
  errorCount: number;
  warningCount: number;
}

interface ViolationSummary {
  ruleId: string;
  ruleName: string;
  count: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  affectedCases: number;
}

type TrendPeriod = 'daily' | 'weekly' | 'monthly';
```

---

## 4. 核心流程

### 4.1 合规检查流程

```
触发检查
      │
      ▼
┌─────────────────────────┐
│ 1. 加载规则集           │
│    - 内置规则           │
│    - 自定义规则         │
│    - 规则覆盖配置       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 解析用例             │
│    - 提取结构信息       │
│    - 构建检查上下文     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 执行规则匹配         │
│    - 按类别分组执行     │
│    - 记录违规信息       │
│    - 收集修复建议       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 生成检查结果         │
│    - 汇总违规           │
│    - 计算合规分数       │
│    - 生成建议           │
└───────────┬─────────────┘
            │
            ▼
   输出合规报告
```

### 4.2 自动修复流程

```
违规列表
      │
      ▼
┌─────────────────────────┐
│ 1. 筛选可修复项         │
│    - 检查 fixable 标记  │
│    - 验证修复安全性     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 生成修复预览         │
│    - 计算修复内容       │
│    - 展示前后对比       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 用户确认             │
│    - 单项确认           │
│    - 批量确认           │
│    - 跳过选项           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 应用修复             │
│    - 更新用例           │
│    - 记录修复历史       │
│    - 触发重新检查       │
└───────────┬─────────────┘
            │
            ▼
   返回修复结果
```

---

## 5. 规则引擎

### 5.1 规则执行器

```typescript
class RuleEngine {
  private registry: RuleRegistry;
  private matchers: Map<MatcherType, IMatcher>;

  async checkCase(
    testCase: TestCase,
    options?: CheckOptions
  ): Promise<ComplianceResult> {
    const rules = this.registry.getEnabledRules(options?.ruleSetId);
    const context = this.buildContext(testCase);
    const violations: Violation[] = [];

    for (const rule of rules) {
      const matcher = this.matchers.get(rule.matcher.type);
      const result = await matcher.match(context, rule);

      if (!result.passed) {
        violations.push(this.createViolation(rule, result, testCase));
      }
    }

    return this.buildResult(testCase, violations);
  }

  private buildContext(testCase: TestCase): MatchContext {
    return {
      caseName: testCase.name,
      caseDescription: testCase.description,
      steps: testCase.steps.map(this.normalizeStep),
      assertions: this.extractAssertions(testCase),
      metadata: testCase.metadata,
    };
  }
}
```

### 5.2 匹配器实现

```typescript
class RegexMatcher implements IMatcher {
  async match(
    context: MatchContext,
    rule: Rule
  ): Promise<MatchResult> {
    const { pattern, target } = rule.matcher.config;
    const regex = new RegExp(pattern);
    const value = this.getTargetValue(context, target);

    const passed = regex.test(value);

    return {
      passed,
      location: passed ? undefined : { type: target },
      details: passed ? undefined : `不匹配模式: ${pattern}`,
    };
  }
}

class SemanticMatcher implements IMatcher {
  async match(
    context: MatchContext,
    rule: Rule
  ): Promise<MatchResult> {
    // 使用 AI 进行语义级别的匹配
    const analysis = await this.analyzeSemantics(context, rule);

    return {
      passed: analysis.compliant,
      location: analysis.location,
      details: analysis.reason,
      confidence: analysis.confidence,
    };
  }
}
```

---

## 6. API 设计

### 6.1 ComplianceChecker

```typescript
interface IComplianceChecker {
  checkCase(caseId: string): Promise<ComplianceResult>;

  checkCases(caseIds: string[]): Promise<ComplianceResult[]>;

  checkAll(options?: CheckOptions): Promise<BatchCheckResult>;

  getViolations(caseId: string): Promise<Violation[]>;

  getComplianceScore(scope?: ScoreScope): Promise<number>;
}

interface CheckOptions {
  ruleSetId?: string;
  categories?: RuleCategory[];
  severity?: Severity[];
  skipCache?: boolean;
}

interface BatchCheckResult {
  total: number;
  compliant: number;
  nonCompliant: number;
  results: ComplianceResult[];
  duration: number;
}
```

### 6.2 RuleRegistry

```typescript
interface IRuleRegistry {
  registerRule(rule: Rule): void;

  registerRuleSet(ruleSet: RuleSet): void;

  getRule(ruleId: string): Rule | undefined;

  getRuleSet(ruleSetId: string): RuleSet | undefined;

  getEnabledRules(ruleSetId?: string): Rule[];

  enableRule(ruleId: string): void;

  disableRule(ruleId: string): void;

  updateRuleConfig(ruleId: string, config: Partial<MatcherConfig>): void;
}
```

### 6.3 AutoFixer

```typescript
interface IAutoFixer {
  getFixableViolations(
    violations: Violation[]
  ): Violation[];

  previewFix(violation: Violation): Promise<FixPreview>;

  applyFix(
    violation: Violation,
    confirm?: boolean
  ): Promise<FixResult>;

  applyFixes(
    violations: Violation[],
    mode: FixMode
  ): Promise<BatchFixResult>;
}

interface FixPreview {
  violation: Violation;
  original: string;
  fixed: string;
  diff: string;
  safe: boolean;
  warnings?: string[];
}

type FixMode = 'interactive' | 'safe_only' | 'all';

interface FixResult {
  success: boolean;
  violation: Violation;
  applied: boolean;
  error?: string;
}
```

### 6.4 TrendAnalyzer

```typescript
interface ITrendAnalyzer {
  getTrend(period: TrendPeriod): Promise<ComplianceTrend>;

  getTeamComparison(): Promise<TeamComparison[]>;

  getTopViolations(limit?: number): Promise<ViolationSummary[]>;

  getImprovementSuggestions(): Promise<Suggestion[]>;
}
```

---

## 7. 内置规则示例

### 7.1 命名规范规则

```typescript
const namingRules: Rule[] = [
  {
    id: 'NAMING-001',
    name: '用例命名规范',
    description: '用例名称必须使用中文描述且包含功能模块',
    category: 'naming',
    severity: 'warning',
    enabled: true,
    matcher: {
      type: 'regex',
      config: {
        target: 'case_name',
        pattern: '^[\\u4e00-\\u9fa5]+[_-][\\u4e00-\\u9fa5]+',
      },
    },
    fixer: {
      type: 'suggest',
      template: '{{module}}_{{action}}_{{scenario}}',
    },
  },
  {
    id: 'NAMING-002',
    name: '步骤描述规范',
    description: '步骤描述应清晰具体，避免使用模糊词汇',
    category: 'naming',
    severity: 'info',
    enabled: true,
    matcher: {
      type: 'custom',
      config: {
        validator: (ctx) => {
          const vagueWords = ['点击', '操作', '处理'];
          return !ctx.steps.some(s =>
            vagueWords.some(w => s.description === w)
          );
        },
      },
    },
  },
];
```

### 7.2 结构规范规则

```typescript
const structureRules: Rule[] = [
  {
    id: 'STRUCT-001',
    name: '必须包含断言',
    description: '每个测试用例必须至少包含一个断言步骤',
    category: 'structure',
    severity: 'error',
    enabled: true,
    matcher: {
      type: 'custom',
      config: {
        validator: (ctx) => ctx.assertions.length > 0,
      },
    },
    fixer: {
      type: 'suggest',
      message: '建议在用例末尾添加结果验证断言',
    },
  },
  {
    id: 'STRUCT-002',
    name: '步骤数量限制',
    description: '单个用例步骤不应超过20步',
    category: 'structure',
    severity: 'warning',
    enabled: true,
    matcher: {
      type: 'custom',
      config: {
        validator: (ctx) => ctx.steps.length <= 20,
      },
    },
  },
];
```

---

## 8. 优势总结

1. **规则驱动**：声明式规则定义，易于维护
2. **自动化执行**：减少人工审查工作量
3. **可扩展性**：支持自定义规则和规则集
4. **智能修复**：提供自动修复建议
5. **趋势分析**：持续跟踪合规性改进
