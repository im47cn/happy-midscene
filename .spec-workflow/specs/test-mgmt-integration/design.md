# 测试管理平台对接 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**统一抽象，平台适配**
- 定义统一的数据模型抽象
- 通过适配器支持多平台
- 支持灵活的字段映射

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| 用例存储 | 添加外部 ID 关联 |
| 执行引擎 | 添加结果同步钩子 |
| 报告生成 | 支持平台格式导出 |
| 历史记录 | 关联平台执行记录 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                Test Management Integration Layer             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │   SyncEngine     │     │  MappingEngine   │              │
│  │   (同步引擎)      │────▶│   (映射引擎)     │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│  ┌────────┴─────────────────────────┴───────┐               │
│  │            Platform Adapters             │               │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │               │
│  │  │ Jira │  │TestRail│ │Zephyr│  │Azure │ │               │
│  │  └──────┘  └──────┘  └──────┘  └──────┘ │               │
│  └──────────────────────────────────────────┘               │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  DefectManager   │     │ RequirementTracker│             │
│  │   (缺陷管理)      │     │   (需求追踪)     │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **SyncEngine** | 管理数据同步流程 |
| **MappingEngine** | 处理字段映射转换 |
| **PlatformAdapters** | 各平台 API 适配 |
| **DefectManager** | 缺陷创建和关联 |
| **RequirementTracker** | 需求覆盖追踪 |

---

## 3. 核心数据结构

### 3.1 统一用例模型

```typescript
interface UnifiedTestCase {
  id: string;
  externalId?: string;           // 平台用例 ID
  externalUrl?: string;          // 平台链接
  name: string;
  description: string;
  preconditions: string[];
  steps: TestStep[];
  expectedResults: string[];
  priority: Priority;
  status: CaseStatus;
  tags: string[];
  requirements: string[];        // 关联需求
  metadata: Record<string, any>;
  syncInfo: SyncInfo;
}

interface TestStep {
  order: number;
  action: string;
  expectedResult: string;
  data?: string;
}

interface SyncInfo {
  lastSyncAt: number;
  syncDirection: 'import' | 'export' | 'bidirectional';
  version: number;
  conflictStatus?: ConflictStatus;
}

type Priority = 'critical' | 'high' | 'medium' | 'low';
type CaseStatus = 'draft' | 'ready' | 'approved' | 'deprecated';
```

### 3.2 执行结果模型

```typescript
interface UnifiedExecutionResult {
  id: string;
  externalId?: string;
  testCaseId: string;
  testPlanId?: string;
  status: ExecutionStatus;
  duration: number;
  executedAt: number;
  executedBy: string;
  environment: string;
  steps: StepResult[];
  attachments: Attachment[];
  defects: string[];
  comments: string;
}

interface StepResult {
  stepOrder: number;
  status: 'passed' | 'failed' | 'skipped';
  actualResult?: string;
  screenshot?: string;
  error?: string;
}

interface Attachment {
  type: 'screenshot' | 'log' | 'video';
  name: string;
  url: string;
  mimeType: string;
}
```

### 3.3 字段映射配置

```typescript
interface FieldMapping {
  platform: PlatformType;
  mappings: FieldMap[];
  customFields: CustomFieldMap[];
}

interface FieldMap {
  localField: string;
  platformField: string;
  transform?: Transform;
  direction: 'import' | 'export' | 'both';
}

interface CustomFieldMap {
  localKey: string;
  platformKey: string;
  type: 'string' | 'number' | 'array' | 'object';
}

interface Transform {
  type: 'direct' | 'lookup' | 'format' | 'custom';
  config: Record<string, any>;
}
```

### 3.4 同步任务

```typescript
interface SyncTask {
  id: string;
  type: SyncType;
  direction: 'import' | 'export';
  status: TaskStatus;
  items: SyncItem[];
  progress: number;
  startedAt: number;
  completedAt?: number;
  errors: SyncError[];
}

type SyncType = 'cases' | 'results' | 'plans' | 'defects';

interface SyncItem {
  localId: string;
  externalId?: string;
  status: 'pending' | 'syncing' | 'success' | 'failed';
  error?: string;
}
```

---

## 4. 核心流程

### 4.1 用例导入流程

```
平台用例
      │
      ▼
┌─────────────────────────┐
│ 1. 获取用例列表         │
│    - 分页获取           │
│    - 过滤条件           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 字段映射转换         │
│    - 基础字段映射       │
│    - 自定义字段处理     │
│    - 步骤结构转换       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 冲突检测             │
│    - 检查本地是否存在   │
│    - 版本比较           │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │有冲突？ │
       └────┬────┘
       否   │   是
       │    │    │
       ▼    │    ▼
 直接保存   │  冲突解决
            │
            ▼
┌─────────────────────────┐
│ 4. 保存到本地           │
│    - 创建/更新用例      │
│    - 更新同步信息       │
└───────────┬─────────────┘
            │
            ▼
   更新同步状态
```

### 4.2 结果推送流程

```
执行完成
      │
      ▼
┌─────────────────────────┐
│ 1. 构建结果数据         │
│    - 收集执行信息       │
│    - 处理附件           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 字段转换             │
│    - 状态映射           │
│    - 步骤结果映射       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 上传附件             │
│    - 截图上传           │
│    - 日志上传           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 推送结果             │
│    - 创建执行记录       │
│    - 关联附件           │
│    - 更新计划状态       │
└───────────┬─────────────┘
            │
            ▼
   记录同步结果
```

### 4.3 缺陷创建流程

```
测试失败
      │
      ▼
┌─────────────────────────┐
│ 1. 检查缺陷策略         │
│    - 自动创建？         │
│    - 关联已有？         │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │自动创建？│
       └────┬────┘
       是   │   否
       │    │    │
       ▼    │    ▼
┌─────────┐ │  手动处理
│构建缺陷 │ │
│信息     │ │
└────┬────┘ │
     │      │
     ▼      │
┌─────────────────────────┐
│ 2. 创建缺陷             │
│    - 标题和描述         │
│    - 附加失败信息       │
│    - 关联用例           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 关联执行记录         │
│    - 链接缺陷           │
│    - 更新状态           │
└───────────┬─────────────┘
            │
            ▼
   返回缺陷信息
```

---

## 5. 平台适配器

### 5.1 适配器接口

```typescript
interface IPlatformAdapter {
  // 连接管理
  connect(config: PlatformConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // 用例操作
  getCases(filter: CaseFilter): Promise<PlatformCase[]>;
  getCase(id: string): Promise<PlatformCase>;
  createCase(data: CreateCaseData): Promise<string>;
  updateCase(id: string, data: UpdateCaseData): Promise<void>;

  // 执行操作
  createExecution(data: CreateExecutionData): Promise<string>;
  updateExecution(id: string, data: UpdateExecutionData): Promise<void>;
  uploadAttachment(executionId: string, file: File): Promise<string>;

  // 计划操作
  getPlans(projectId: string): Promise<TestPlan[]>;
  getPlanCases(planId: string): Promise<PlanCase[]>;
  updatePlanStatus(planId: string, status: PlanStatus): Promise<void>;

  // 缺陷操作
  createDefect(data: CreateDefectData): Promise<string>;
  linkDefect(executionId: string, defectId: string): Promise<void>;
}
```

### 5.2 Jira + Xray 适配器

```typescript
class JiraXrayAdapter implements IPlatformAdapter {
  private jiraClient: JiraClient;
  private xrayClient: XrayClient;

  async getCases(filter: CaseFilter): Promise<PlatformCase[]> {
    const jql = this.buildJQL(filter);
    const issues = await this.jiraClient.searchIssues(jql);
    return issues.map(this.convertToCase);
  }

  async createExecution(data: CreateExecutionData): Promise<string> {
    const testExecution = await this.xrayClient.createTestExecution({
      projectKey: data.projectKey,
      summary: data.name,
      testPlanKey: data.planId,
    });

    return testExecution.key;
  }

  // ... 其他方法实现
}
```

### 5.3 TestRail 适配器

```typescript
class TestRailAdapter implements IPlatformAdapter {
  private api: TestRailAPI;

  async getCases(filter: CaseFilter): Promise<PlatformCase[]> {
    const cases = await this.api.getCases(filter.projectId, {
      suite_id: filter.suiteId,
      section_id: filter.sectionId,
    });
    return cases.map(this.convertToCase);
  }

  async createExecution(data: CreateExecutionData): Promise<string> {
    const run = await this.api.addRun(data.projectId, {
      suite_id: data.suiteId,
      name: data.name,
      include_all: false,
      case_ids: data.caseIds,
    });

    return String(run.id);
  }

  // ... 其他方法实现
}
```

---

## 6. API 设计

### 6.1 SyncEngine

```typescript
interface ISyncEngine {
  importCases(
    platform: PlatformType,
    filter: CaseFilter
  ): Promise<SyncTask>;

  exportCases(
    platform: PlatformType,
    caseIds: string[]
  ): Promise<SyncTask>;

  syncResults(
    platform: PlatformType,
    executionIds: string[]
  ): Promise<SyncTask>;

  getTaskStatus(taskId: string): Promise<SyncTask>;

  cancelTask(taskId: string): Promise<void>;
}
```

### 6.2 MappingEngine

```typescript
interface IMappingEngine {
  configure(config: FieldMapping): Promise<void>;

  mapToUnified(
    platformData: any,
    platform: PlatformType
  ): UnifiedTestCase;

  mapToPlatform(
    unifiedData: UnifiedTestCase,
    platform: PlatformType
  ): any;

  validateMapping(
    config: FieldMapping
  ): ValidationResult;
}
```

### 6.3 DefectManager

```typescript
interface IDefectManager {
  createDefect(
    platform: PlatformType,
    data: DefectData
  ): Promise<string>;

  linkToExecution(
    platform: PlatformType,
    executionId: string,
    defectId: string
  ): Promise<void>;

  getLinkedDefects(
    executionId: string
  ): Promise<Defect[]>;

  syncDefectStatus(
    defectId: string
  ): Promise<DefectStatus>;
}
```

---

## 7. 集成方案

### 7.1 与执行引擎集成

```typescript
// 执行完成后自动同步
executionEngine.on('executionComplete', async (result) => {
  if (syncConfig.autoSync) {
    await syncEngine.syncResults(
      syncConfig.platform,
      [result.id]
    );
  }

  if (result.status === 'failed' && syncConfig.autoCreateDefect) {
    await defectManager.createDefect(
      syncConfig.platform,
      {
        title: `测试失败: ${result.caseName}`,
        description: buildDefectDescription(result),
        attachments: result.attachments,
      }
    );
  }
});
```

### 7.2 配置文件

```yaml
# .midscene-sync.yml
platform: testrail
connection:
  url: https://example.testrail.io
  username: ${TESTRAIL_USER}
  apiKey: ${TESTRAIL_KEY}

sync:
  autoSync: true
  syncInterval: 300  # 秒

fieldMapping:
  name: title
  description: custom_description
  steps: custom_steps

defect:
  autoCreate: true
  projectId: 1
  template: bug
```

---

## 8. 优势总结

1. **多平台支持**：主流测试管理平台开箱即用
2. **双向同步**：数据无缝流转
3. **灵活映射**：适配不同平台数据结构
4. **自动化**：执行结果和缺陷自动同步
5. **可追踪**：完整的需求覆盖追踪
