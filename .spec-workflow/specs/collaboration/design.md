# 协作功能 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**实时协作，流程规范**
- 支持实时多人协作编辑
- 规范化的评审和审批流程
- 知识沉淀和复用

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| 用例存储 | 添加协作元数据 |
| 用例编辑器 | 集成实时协作 |
| 历史记录 | 扩展版本控制 |
| 用户系统 | 添加团队和权限 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                   Collaboration Platform                     │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  WorkspaceManager│     │  PermissionEngine│              │
│  │   (工作区管理)    │────▶│   (权限引擎)     │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │ CollaborationHub │     │  ReviewSystem    │              │
│  │   (协作中心)      │◀───▶│   (评审系统)     │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │ VersionControl   │     │  KnowledgeBase   │              │
│  │   (版本控制)      │     │   (知识库)       │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │  Sync Engine  │  ← 实时同步引擎
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **WorkspaceManager** | 管理共享工作区 |
| **PermissionEngine** | 权限控制和验证 |
| **CollaborationHub** | 实时协作核心 |
| **ReviewSystem** | 评审流程管理 |
| **VersionControl** | 版本历史管理 |
| **KnowledgeBase** | 知识库管理 |

---

## 3. 核心数据结构

### 3.1 工作区

```typescript
interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  visibility: 'private' | 'team' | 'public';
  members: WorkspaceMember[];
  settings: WorkspaceSettings;
  createdAt: number;
  updatedAt: number;
}

interface WorkspaceMember {
  userId: string;
  role: MemberRole;
  joinedAt: number;
  invitedBy: string;
}

type MemberRole = 'viewer' | 'editor' | 'admin' | 'owner';

interface WorkspaceSettings {
  requireReview: boolean;
  minReviewers: number;
  autoMerge: boolean;
  branchProtection: boolean;
}
```

### 3.2 评审

```typescript
interface Review {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: ReviewStatus;
  author: string;
  reviewers: Reviewer[];
  changes: Change[];
  comments: Comment[];
  createdAt: number;
  updatedAt: number;
  mergedAt?: number;
}

type ReviewStatus =
  | 'draft'
  | 'pending'
  | 'changes_requested'
  | 'approved'
  | 'merged'
  | 'closed';

interface Reviewer {
  userId: string;
  status: 'pending' | 'approved' | 'changes_requested';
  reviewedAt?: number;
}

interface Change {
  fileId: string;
  fileName: string;
  changeType: 'added' | 'modified' | 'deleted';
  diff: string;
}
```

### 3.3 评论

```typescript
interface Comment {
  id: string;
  reviewId?: string;
  fileId: string;
  lineNumber?: number;
  author: string;
  content: string;
  mentions: string[];
  parentId?: string;
  resolved: boolean;
  resolvedBy?: string;
  createdAt: number;
  updatedAt: number;
}
```

### 3.4 版本

```typescript
interface Version {
  id: string;
  fileId: string;
  version: string;
  content: string;
  author: string;
  message: string;
  parentVersion?: string;
  createdAt: number;
}

interface VersionDiff {
  versionA: string;
  versionB: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

interface DiffHunk {
  startLineA: number;
  startLineB: number;
  lines: DiffLine[];
}
```

### 3.5 实时协作

```typescript
interface CollaborationSession {
  id: string;
  fileId: string;
  participants: Participant[];
  state: EditorState;
  lastActivity: number;
}

interface Participant {
  userId: string;
  cursor: CursorPosition;
  selection: SelectionRange;
  color: string;
  lastSeen: number;
}

interface EditorOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  timestamp: number;
}
```

---

## 4. 核心流程

### 4.1 评审流程

```
创建评审
      │
      ▼
┌─────────────────────────┐
│ 1. 准备变更             │
│    - 选择修改的用例     │
│    - 填写评审标题和描述 │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 分配评审人           │
│    - 自动建议           │
│    - 手动添加           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 评审人审阅           │
│    - 查看变更           │
│    - 添加评论           │
│    - 给出评审意见       │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │评审结果 │
       └────┬────┘
     批准   │   请求修改
       │    │    │
       ▼    │    ▼
┌─────────┐ │  返回修改
│合并变更 │ │
└─────────┘ │
```

### 4.2 实时协作流程

```
用户加入编辑
      │
      ▼
┌─────────────────────────┐
│ 1. 建立 WebSocket 连接  │
│    - 认证               │
│    - 加入会话           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 同步当前状态         │
│    - 获取文档内容       │
│    - 获取其他用户位置   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 持续同步             │
│    - 发送本地操作       │
│    - 接收远程操作       │
│    - OT/CRDT 冲突解决   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 光标和选区同步       │
│    - 广播光标位置       │
│    - 显示其他用户光标   │
└─────────────────────────┘
```

### 4.3 权限检查流程

```
用户请求操作
      │
      ▼
┌─────────────────────────┐
│ 1. 验证用户身份         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 获取用户角色         │
│    - 工作区角色         │
│    - 资源级别权限       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 检查操作权限         │
│    - 匹配权限规则       │
│    - 检查自定义策略     │
└───────────┬─────────────┘
            │
       ┌────┴────┐
       │有权限？ │
       └────┬────┘
       是   │   否
       │    │    │
       ▼    │    ▼
  允许操作  │  拒绝并返回错误
```

---

## 5. 实时协作技术

### 5.1 操作转换 (OT)

```typescript
class OperationalTransform {
  transform(
    localOp: Operation,
    remoteOp: Operation
  ): [Operation, Operation] {
    // 根据操作类型转换
    if (localOp.type === 'insert' && remoteOp.type === 'insert') {
      return this.transformInsertInsert(localOp, remoteOp);
    }
    // ... 其他情况
  }

  apply(document: string, operation: Operation): string {
    switch (operation.type) {
      case 'insert':
        return this.insertAt(document, operation.position, operation.content);
      case 'delete':
        return this.deleteAt(document, operation.position, operation.length);
      case 'retain':
        return document;
    }
  }
}
```

### 5.2 WebSocket 通信

```typescript
class CollaborationClient {
  private ws: WebSocket;
  private ot: OperationalTransform;

  connect(sessionId: string): void {
    this.ws = new WebSocket(`wss://collab.example.com/${sessionId}`);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
  }

  sendOperation(operation: Operation): void {
    this.ws.send(JSON.stringify({
      type: 'operation',
      operation,
    }));
  }

  private handleMessage(message: Message): void {
    switch (message.type) {
      case 'operation':
        const transformed = this.ot.transform(
          this.pendingOp,
          message.operation
        );
        this.applyRemote(transformed);
        break;
      case 'cursor':
        this.updateRemoteCursor(message.userId, message.cursor);
        break;
    }
  }
}
```

---

## 6. API 设计

### 6.1 WorkspaceManager

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
}
```

### 6.2 ReviewSystem

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

### 6.3 VersionControl

```typescript
interface IVersionControl {
  createVersion(fileId: string, content: string, message: string): Promise<Version>;
  getVersion(versionId: string): Promise<Version>;
  getHistory(fileId: string): Promise<Version[]>;
  diff(versionA: string, versionB: string): Promise<VersionDiff>;
  revert(fileId: string, versionId: string): Promise<void>;
}
```

### 6.4 CollaborationHub

```typescript
interface ICollaborationHub {
  joinSession(fileId: string): Promise<CollaborationSession>;
  leaveSession(sessionId: string): Promise<void>;
  sendOperation(sessionId: string, operation: EditorOperation): Promise<void>;
  updateCursor(sessionId: string, cursor: CursorPosition): Promise<void>;
  getParticipants(sessionId: string): Promise<Participant[]>;
}
```

---

## 7. 权限模型

### 7.1 权限矩阵

| 操作 | 查看者 | 编辑者 | 管理员 | 所有者 |
|------|--------|--------|--------|--------|
| 查看用例 | ✓ | ✓ | ✓ | ✓ |
| 编辑用例 | ✗ | ✓ | ✓ | ✓ |
| 删除用例 | ✗ | ✗ | ✓ | ✓ |
| 执行用例 | ✓ | ✓ | ✓ | ✓ |
| 管理成员 | ✗ | ✗ | ✓ | ✓ |
| 工作区设置 | ✗ | ✗ | ✓ | ✓ |
| 删除工作区 | ✗ | ✗ | ✗ | ✓ |
| 转移所有权 | ✗ | ✗ | ✗ | ✓ |

### 7.2 权限检查

```typescript
class PermissionEngine {
  async check(
    userId: string,
    resource: Resource,
    action: Action
  ): Promise<boolean> {
    const member = await this.getMember(userId, resource.workspaceId);
    if (!member) return false;

    const permissions = this.rolePermissions[member.role];
    return permissions.includes(action);
  }

  private rolePermissions: Record<MemberRole, Action[]> = {
    viewer: ['view', 'execute'],
    editor: ['view', 'execute', 'edit', 'comment', 'review'],
    admin: ['view', 'execute', 'edit', 'delete', 'manage_members', 'settings'],
    owner: ['*'],
  };
}
```

---

## 8. 知识库

### 8.1 知识结构

```typescript
interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  contributors: string[];
  views: number;
  upvotes: number;
  createdAt: number;
  updatedAt: number;
}

interface KnowledgeCategory {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  articleCount: number;
}
```

### 8.2 搜索功能

```typescript
interface IKnowledgeSearch {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  searchByTag(tag: string): Promise<KnowledgeArticle[]>;
  getRelated(articleId: string): Promise<KnowledgeArticle[]>;
  getSuggestions(query: string): Promise<string[]>;
}
```

---

## 9. 优势总结

1. **实时协作**：多人同时编辑无冲突
2. **规范流程**：标准化的评审和审批
3. **权限细化**：灵活的访问控制
4. **知识沉淀**：团队经验持续积累
5. **版本追踪**：完整的变更历史
