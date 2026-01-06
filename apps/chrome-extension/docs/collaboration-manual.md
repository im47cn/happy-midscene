# 团队协作功能 - 用户手册

## 功能概述

团队协作功能是 AI Test Generator 的企业级能力，支持团队成员共享测试用例、协同编辑、评审变更、沉淀知识。通过统一的协作平台，提升团队测试质量和效率。

### 核心能力

- **工作区管理**：创建共享工作空间，邀请团队成员
- **实时协作**：多人同时编辑测试用例，光标位置同步
- **评审流程**：规范化的代码评审和审批流程
- **版本控制**：完整的变更历史和版本比较
- **知识库**：团队最佳实践和经验沉淀
- **权限控制**：细粒度的访问权限管理

## 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│                  Collaboration Platform                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Workspace  │  │    Review    │  │   Version    │      │
│  │   Manager    │──│    System    │──│   Control    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│         └────────┬────────┴────────┬────────┘              │
│                  │                 │                      │
│           ┌──────▼─────┐    ┌─────▼──────┐                │
│           │Permission  │    │ Collabor-  │                │
│           │  Engine    │    │ ation Hub  │                │
│           └────────────┘    └──────┬─────┘                │
│                                     │                      │
│                              ┌──────▼─────┐               │
│                              │ Sync Engine│ ← WebSocket    │
│                              └────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

1. **用户操作** → 通过 UI 或 API 发起操作
2. **权限检查** → PermissionEngine 验证用户权限
3. **业务处理** → 相应模块处理业务逻辑
4. **实时同步** → Sync Engine 通过 WebSocket 同步给其他用户
5. **数据持久化** → 变更保存到存储

## 快速开始

### 创建工作区

```typescript
import { WorkspaceManager } from './services/collaboration';

const workspaceManager = new WorkspaceManager();

// 创建新工作区
const workspace = await workspaceManager.create({
  name: '电商项目测试',
  description: '电商平台的测试用例集合',
  visibility: 'team',  // private, team, public
  settings: {
    requireReview: true,
    minReviewers: 1,
    autoMerge: false,
  },
});
```

### 邀请成员

```typescript
// 添加成员到工作区
await workspaceManager.addMember(
  workspace.id,
  'user-123',
  'editor'  // viewer, editor, admin
);

// 生成分享链接
const inviteLink = await workspaceManager.createInviteLink(workspace.id, {
  expiresIn: 7 * 24 * 60 * 60 * 1000,  // 7 天
  maxUses: 10,
});
```

### 实时协作编辑

```typescript
import { CollaborationHub } from './services/collaboration';

const hub = new CollaborationHub();

// 加入协作会话
const session = await hub.joinSession(fileId);

// 发送编辑操作
await hub.sendOperation(session.id, {
  type: 'insert',
  position: 10,
  content: '新测试步骤',
  userId: 'user-123',
  timestamp: Date.now(),
});

// 更新光标位置
await hub.updateCursor(session.id, { line: 5, column: 10 });
```

## 工作区管理

### 工作区类型

| 类型 | 可见性 | 访问方式 |
|------|--------|----------|
| `private` | 私有 | 仅受邀成员 |
| `team` | 团队 | 组织内所有成员 |
| `public` | 公开 | 所有人可查看 |

### 成员角色

```typescript
type MemberRole = 'viewer' | 'editor' | 'admin' | 'owner';
```

| 角色 | 查看 | 编辑 | 删除 | 管理成员 | 设置 |
|------|------|------|------|----------|------|
| `viewer` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `editor` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `owner` | ✓ | ✓ | ✓ | ✓ | ✓ |

### 工作区设置

```typescript
interface WorkspaceSettings {
  // 是否要求评审
  requireReview: boolean;

  // 最少评审人数
  minReviewers: number;

  // 是否自动合并（所有评审通过后）
  autoMerge: boolean;

  // 是否启用分支保护
  branchProtection: boolean;
}
```

## 评审流程

### 评审状态

```
draft → pending → changes_requested → approved → merged
                ↓
              closed
```

| 状态 | 说明 | 可执行操作 |
|------|------|------------|
| `draft` | 草稿 | 编辑、提交评审 |
| `pending` | 等待评审 | 添加评论、评审 |
| `changes_requested` | 请求修改 | 修改、重新提交 |
| `approved` | 已批准 | 合并 |
| `merged` | 已合并 | 查看 |
| `closed` | 已关闭 | 重新打开 |

### 创建评审

```typescript
import { ReviewSystem } from './services/collaboration';

const reviewSystem = new ReviewSystem();

// 创建评审请求
const review = await reviewSystem.createReview({
  workspaceId: 'workspace-123',
  title: '添加购物车测试用例',
  description: '覆盖购物车添加、删除、结算等场景',
  author: 'user-123',
  changes: [
    {
      fileId: 'file-456',
      fileName: 'shopping-cart.test.md',
      changeType: 'modified',
      diff: '...',  // Git diff 格式
    },
  ],
  reviewers: [
    { userId: 'user-456', status: 'pending' },
    { userId: 'user-789', status: 'pending' },
  ],
});
```

### 评审操作

```typescript
// 提交评审结果
await reviewSystem.submitReviewResult(review.id, {
  userId: 'user-456',
  status: 'approved',  // approved, changes_requested
  comment: '测试用例覆盖完整，可以通过',
});

// 添加评论
await reviewSystem.addComment(review.id, {
  fileId: 'file-456',
  lineNumber: 15,
  content: '建议添加边界测试',
  author: 'user-456',
});

// 合并变更
await reviewSystem.merge(review.id);
```

## 实时协作

### 操作类型

```typescript
interface EditorOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;    // insert 时使用
  length?: number;     // delete 时使用
  userId: string;
  timestamp: number;
}
```

### 光标同步

```typescript
interface CursorPosition {
  line: number;
  column: number;
}

interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

// 广播光标位置
await hub.updateCursor(sessionId, {
  line: 10,
  column: 5,
  selection: {
    start: { line: 10, column: 5 },
    end: { line: 12, column: 0 },
  },
});
```

### 参与者信息

```typescript
interface Participant {
  userId: string;
  username: string;
  cursor: CursorPosition;
  selection: SelectionRange;
  color: string;        // 显示光标颜色
  lastSeen: number;
}

// 获取当前参与者
const participants = await hub.getParticipants(sessionId);
```

## 版本控制

### 创建版本

```typescript
import { VersionControl } from './services/collaboration';

const versionControl = new VersionControl();

// 创建新版本
const version = await versionControl.createVersion(
  'file-123',
  '更新后的测试内容',
  'v1.2.0: 添加边界测试场景'
);
```

### 版本比较

```typescript
// 比较两个版本
const diff = await versionControl.diff('v1.0.0', 'v1.1.0');

console.log(diff);
// {
//   versionA: 'v1.0.0',
//   versionB: 'v1.1.0',
//   additions: 15,
//   deletions: 3,
//   hunks: [
//     {
//       startLineA: 10,
//       startLineB: 10,
//       lines: [
//         { type: 'context', content: '  步骤1' },
//         { type: 'added', content: '+ 步骤2' },
//         { type: 'deleted', content: '- 旧步骤' },
//       ]
//     }
//   ]
// }
```

### 版本回滚

```typescript
// 回滚到指定版本
await versionControl.revert('file-123', 'v1.0.0');
```

## 知识库

### 创建文章

```typescript
import { KnowledgeBase } from './services/collaboration';

const knowledgeBase = new KnowledgeBase();

// 创建知识文章
const article = await knowledgeBase.createArticle({
  title: '如何编写可靠的 UI 测试',
  content: '...',
  category: 'best-practices',
  tags: ['ui-test', 'best-practice', 'midscene'],
});
```

### 搜索知识

```typescript
import { KnowledgeSearch } from './services/collaboration';

const search = new KnowledgeSearch();

// 全文搜索
const results = await search.search('元素定位', {
  category: 'best-practices',
  limit: 10,
});

// 按标签搜索
const articles = await search.searchByTag('midscene');

// 获取相关文章
const related = await search.getRelated('article-123');
```

## 权限控制

### 权限检查

```typescript
import { PermissionEngine } from './services/collaboration';

const permission = new PermissionEngine();

// 检查用户权限
const canEdit = await permission.check(
  'user-123',
  { workspaceId: 'workspace-456', fileId: 'file-789' },
  'edit'  // view, edit, delete, manage_members, etc.
);

if (!canEdit) {
  throw new Error('无权限执行此操作');
}
```

### 资源级别权限

```typescript
// 设置特定文件的权限
await permission.setResourcePermission({
  resource: { fileId: 'file-123' },
  permissions: {
    'user-456': ['view', 'edit'],
    'user-789': ['view'],
  },
});
```

## API 参考

### WorkspaceManager

```typescript
interface IWorkspaceManager {
  create(data: CreateWorkspaceData): Promise<Workspace>;
  update(id: string, data: UpdateWorkspaceData): Promise<void>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<Workspace>;
  list(userId: string): Promise<Workspace[]>;
  addMember(workspaceId: string, userId: string, role: MemberRole): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  updateMemberRole(workspaceId: string, userId: string, role: MemberRole): Promise<void>;
  createInviteLink(workspaceId: string, options: InviteOptions): Promise<string>;
}
```

### ReviewSystem

```typescript
interface IReviewSystem {
  createReview(data: CreateReviewData): Promise<Review>;
  submitReview(id: string): Promise<void>;
  addReviewer(reviewId: string, userId: string): Promise<void>;
  submitReviewResult(reviewId: string, result: ReviewResult): Promise<void>;
  merge(reviewId: string): Promise<void>;
  close(reviewId: string): Promise<void>;
  addComment(reviewId: string, comment: CreateCommentData): Promise<Comment>;
  resolveComment(commentId: string): Promise<void>;
}
```

### CollaborationHub

```typescript
interface ICollaborationHub {
  joinSession(fileId: string): Promise<CollaborationSession>;
  leaveSession(sessionId: string): Promise<void>;
  sendOperation(sessionId: string, operation: EditorOperation): Promise<void>;
  updateCursor(sessionId: string, cursor: CursorPosition): Promise<void>;
  getParticipants(sessionId: string): Promise<Participant[]>;
}
```

### VersionControl

```typescript
interface IVersionControl {
  createVersion(fileId: string, content: string, message: string): Promise<Version>;
  getVersion(versionId: string): Promise<Version>;
  getHistory(fileId: string): Promise<Version[]>;
  diff(versionA: string, versionB: string): Promise<VersionDiff>;
  revert(fileId: string, versionId: string): Promise<void>;
}
```

## 最佳实践

### 1. 工作区组织

按项目或模块划分工作区：

```
电商项目/
├── 用户模块/
│   ├── 登录测试
│   └── 注册测试
├── 商品模块/
│   ├── 搜索测试
│   └── 详情测试
└── 订单模块/
    ├── 购物车测试
    └── 结算测试
```

### 2. 评审流程规范

1. **提交前自查**：确保测试用例可执行
2. **明确评审重点**：在描述中说明需要关注的地方
3. **及时响应**：24 小时内响应评审意见
4. **使用模板**：统一评审检查清单

### 3. 版本命名规范

```typescript
// 语义化版本
major.minor.patch

// major: 不兼容的修改
// minor: 新增功能
// patch: 问题修复

// 示例
v1.0.0 → v1.1.0 (新增测试场景)
v1.1.0 → v1.1.1 (修复定位问题)
v1.1.1 → v2.0.0 (重构步骤结构)
```

### 4. 评论礼仪

- **描述清晰**：说明问题所在和期望
- **提供建议**：不只是指出问题，给出改进方向
- **使用 @提及**：需要特定人员关注时使用
- **及时解决**：问题解决后标记评论为已解决

### 5. 知识沉淀

定期总结和分享：

1. **每周最佳实践**：分享优秀的测试用例
2. **常见问题**：记录问题和解决方案
3. **工具技巧**：分享使用技巧和快捷方式
4. **案例分析**：深入的案例研究

## 常见问题

### Q: 如何处理编辑冲突？

A: 系统使用操作转换（OT）自动解决冲突。当两人同时编辑时，系统会自动合并操作。如果无法自动合并，会提示用户手动解决。

### Q: 评审被拒绝后怎么办？

A:
1. 查看评审意见和评论
2. 修改测试用例
3. 重新提交评审
4. 通知原评审人重新评审

### Q: 如何导出工作区数据？

A: 使用工作区导出功能：

```typescript
const exported = await workspaceManager.export(workspace.id, {
  includeHistory: true,
  format: 'json',  // or 'yaml'
});
```

### Q: 离线时如何编辑？

A: 系统支持离线编辑，操作会缓存到本地。恢复连接后自动同步。注意：多人同时编辑同一文件时，离线编辑可能导致冲突。

## 更新日志

### v1.0.0 (2025-01)

- 初始版本发布
- 工作区管理
- 实时协作编辑（OT 算法）
- 评审流程系统
- 版本控制和比较
- 知识库功能
- 权限控制引擎
