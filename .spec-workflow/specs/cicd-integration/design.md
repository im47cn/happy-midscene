# CI/CD 深度集成 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**原生集成，开箱即用**
- 为主流平台提供原生插件
- 统一的 CLI 支持所有平台
- 灵活的 API 支持自定义集成

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| CLI 工具 | 作为 CI 执行入口 |
| 执行引擎 | 支持无头模式执行 |
| 报告生成 | 输出 CI 兼容格式 |
| 分析引擎 | 提供质量门禁数据 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD Integration Layer                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │   CI Adapters    │     │   Test Executor  │              │
│  │  (平台适配器)     │────▶│   (测试执行器)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│  ┌────────┴─────────────────────────┴───────┐               │
│  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────┐ │               │
│  │ │ GitHub │ │ GitLab │ │Jenkins │ │Azure│ │               │
│  │ └────────┘ └────────┘ └────────┘ └─────┘ │               │
│  └──────────────────────────────────────────┘               │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  QualityGate     │     │  ReportGenerator │              │
│  │   (质量门禁)      │◀───▶│   (报告生成)     │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │    CLI Tool   │  ← 统一命令行接口
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **CIAdapters** | 各 CI/CD 平台适配 |
| **TestExecutor** | 测试执行管理 |
| **QualityGate** | 质量门禁评估 |
| **ReportGenerator** | 多格式报告生成 |
| **ShardManager** | 并行分片管理 |
| **EnvManager** | 环境配置管理 |

---

## 3. 核心数据结构

### 3.1 CI 配置

```typescript
interface CIConfig {
  version: string;
  testSuite: string | string[];
  parallel: ParallelConfig;
  qualityGate: QualityGateConfig;
  report: ReportConfig;
  retry: RetryConfig;
  environment: EnvironmentConfig;
  notifications: NotificationConfig;
}

interface ParallelConfig {
  enabled: boolean;
  shards: number;
  strategy: ShardStrategy;
}

type ShardStrategy = 'round-robin' | 'timing-based' | 'custom';

interface QualityGateConfig {
  passRate: number;               // 百分比
  criticalTestsPassRate: number;
  maxNewFailures: number;
  maxFlakyTests: number;
  customRules?: QualityRule[];
}

interface ReportConfig {
  formats: ReportFormat[];
  uploadArtifacts: boolean;
  commentOnPR: boolean;
  badgeUpdate: boolean;
}

type ReportFormat = 'junit' | 'json' | 'html' | 'markdown';
```

### 3.2 执行结果

```typescript
interface CIExecutionResult {
  id: string;
  status: ExecutionStatus;
  startTime: number;
  endTime: number;
  duration: number;
  summary: ExecutionSummary;
  shards: ShardResult[];
  qualityGateResult: QualityGateResult;
  artifacts: Artifact[];
}

interface ExecutionSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  passRate: number;
}

interface ShardResult {
  shardId: number;
  status: ExecutionStatus;
  tests: TestResult[];
  duration: number;
}

interface QualityGateResult {
  passed: boolean;
  rules: RuleResult[];
  message: string;
}

interface RuleResult {
  rule: string;
  expected: any;
  actual: any;
  passed: boolean;
}
```

### 3.3 报告格式

```typescript
// JUnit XML 格式
interface JUnitReport {
  testsuites: TestSuite[];
}

interface TestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  time: number;
  testcases: TestCase[];
}

interface TestCase {
  name: string;
  classname: string;
  time: number;
  failure?: {
    message: string;
    type: string;
    content: string;
  };
}
```

---

## 4. 核心流程

### 4.1 CI 执行流程

```
CI 触发
      │
      ▼
┌─────────────────────────┐
│ 1. 加载配置             │
│    - 解析 CI 配置       │
│    - 合并环境变量       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 准备测试             │
│    - 拉取测试用例       │
│    - 分片分配           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 并行执行             │
│    - 启动各分片         │
│    - 监控执行状态       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 收集结果             │
│    - 合并分片结果       │
│    - 统计汇总           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 5. 质量门禁             │
│    - 评估规则           │
│    - 生成决策           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 6. 生成报告             │
│    - 多格式输出         │
│    - 上传制品           │
│    - PR 评论            │
└───────────┬─────────────┘
            │
            ▼
   返回执行状态
```

### 4.2 分片策略

```
测试用例列表
      │
      ▼
┌─────────────────────────┐
│ 1. 获取历史执行时间     │
│    - 查询执行记录       │
│    - 估算未知用例       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 计算分片             │
│    - 按时间均衡分配     │
│    - 或按数量均匀分配   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 分配到节点           │
│    - Shard 1: [用例A,B] │
│    - Shard 2: [用例C,D] │
│    - ...                │
└───────────┬─────────────┘
            │
            ▼
   输出分片计划
```

### 4.3 质量门禁流程

```
执行结果
      │
      ▼
┌─────────────────────────┐
│ 1. 加载门禁规则         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 逐条评估             │
│    - 通过率检查         │
│    - 关键测试检查       │
│    - 新增失败检查       │
│    - Flaky 检查         │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │全部通过？│
       └────┬────┘
       是   │   否
       │    │    │
       ▼    │    ▼
┌─────────┐ │  ┌─────────┐
│ 允许部署│ │  │阻止部署 │
└─────────┘ │  └─────────┘
```

---

## 5. 平台适配器

### 5.1 GitHub Actions

```yaml
# .github/workflows/test.yml
name: AI Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v3

      - uses: midscene/test-action@v1
        with:
          test-suite: regression
          shard: ${{ matrix.shard }}
          total-shards: 4
          quality-gate: |
            pass-rate: 95%
            critical-tests: 100%
          report-format: junit,html

      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: reports/
```

### 5.2 GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test

test:
  stage: test
  image: midscene/runner:latest
  parallel: 4
  script:
    - midscene test --suite regression
        --shard ${CI_NODE_INDEX}/${CI_NODE_TOTAL}
        --report junit,html
  artifacts:
    reports:
      junit: reports/junit.xml
    paths:
      - reports/
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
```

### 5.3 Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent any

    stages {
        stage('Test') {
            parallel {
                stage('Shard 1') {
                    steps {
                        sh 'midscene test --shard 1/4'
                    }
                }
                stage('Shard 2') {
                    steps {
                        sh 'midscene test --shard 2/4'
                    }
                }
                // ...
            }
        }

        stage('Quality Gate') {
            steps {
                script {
                    def result = sh(
                        script: 'midscene quality-gate --config .midscene.yml',
                        returnStatus: true
                    )
                    if (result != 0) {
                        error 'Quality gate failed'
                    }
                }
            }
        }
    }

    post {
        always {
            junit 'reports/junit.xml'
            archiveArtifacts artifacts: 'reports/**'
        }
    }
}
```

---

## 6. API 设计

### 6.1 CLI 接口

```bash
# 执行测试
midscene test \
  --suite <suite-name> \
  --shard <current>/<total> \
  --parallel <count> \
  --report <formats> \
  --env <environment>

# 质量门禁
midscene quality-gate \
  --config <config-file> \
  --results <results-dir>

# 报告生成
midscene report \
  --input <results-dir> \
  --format <formats> \
  --output <output-dir>
```

### 6.2 API 接口

```typescript
interface ICIExecutor {
  execute(config: CIConfig): Promise<CIExecutionResult>;

  getShardPlan(
    tests: string[],
    totalShards: number
  ): Promise<ShardPlan>;

  evaluateQualityGate(
    results: CIExecutionResult,
    rules: QualityGateConfig
  ): QualityGateResult;

  generateReport(
    results: CIExecutionResult,
    format: ReportFormat
  ): Promise<string>;
}
```

---

## 7. 集成方案

### 7.1 GitHub Actions 集成

```typescript
// GitHub Action 入口
import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  const config: CIConfig = {
    testSuite: core.getInput('test-suite'),
    parallel: {
      enabled: true,
      shards: parseInt(core.getInput('total-shards')),
      strategy: 'timing-based',
    },
    // ...
  };

  const result = await ciExecutor.execute(config);

  // 设置输出
  core.setOutput('pass-rate', result.summary.passRate);
  core.setOutput('status', result.status);

  // PR 评论
  if (github.context.eventName === 'pull_request') {
    await postPRComment(result);
  }

  // 质量门禁
  if (!result.qualityGateResult.passed) {
    core.setFailed(result.qualityGateResult.message);
  }
}
```

### 7.2 通用 CLI 集成

```typescript
// CLI 命令
program
  .command('test')
  .option('--suite <name>', 'Test suite name')
  .option('--shard <spec>', 'Shard specification (e.g., 1/4)')
  .option('--report <formats>', 'Report formats')
  .action(async (options) => {
    const config = loadConfig(options);
    const result = await ciExecutor.execute(config);

    // 输出报告
    for (const format of config.report.formats) {
      const report = await generateReport(result, format);
      await writeReport(report, format);
    }

    // 退出码
    process.exit(result.qualityGateResult.passed ? 0 : 1);
  });
```

---

## 8. 报告格式

### 8.1 JUnit XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="AI Tests" tests="100" failures="2" time="120.5">
  <testsuite name="Login Tests" tests="20" failures="1" time="25.3">
    <testcase name="should login with valid credentials"
              classname="LoginTests" time="2.1"/>
    <testcase name="should show error for invalid password"
              classname="LoginTests" time="1.8">
      <failure message="Expected error message not found"
               type="AssertionError">
        <![CDATA[
          Expected: "Invalid password"
          Actual: "Login failed"
        ]]>
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```

### 8.2 PR 评论

```markdown
## 🧪 AI Test Results

| Metric | Value |
|--------|-------|
| Total Tests | 100 |
| Passed | 98 ✅ |
| Failed | 2 ❌ |
| Pass Rate | 98% |
| Duration | 2m 30s |

### ❌ Failed Tests

1. **should show error for invalid password** - `LoginTests`
   - Error: Expected "Invalid password" but got "Login failed"

### 📊 Quality Gate: ✅ Passed

- [x] Pass rate ≥ 95% (98%)
- [x] Critical tests pass (100%)
- [x] No new failures

[View Full Report](https://...)
```

---

## 9. 优势总结

1. **原生集成**：主流平台开箱即用
2. **并行执行**：智能分片提高效率
3. **质量门禁**：自动化发布决策
4. **多格式报告**：CI 平台无缝展示
5. **灵活配置**：适应各种工作流
