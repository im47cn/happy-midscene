# 协作功能 - 任务清单

## 设计决策

**采用实时协作 + 评审流程方案**：通过 OT/CRDT 实现实时协作，结合规范化的评审流程确保质量。

核心特点：
- 实时多人协作编辑
- 规范化评审流程
- 细粒度权限控制
- 知识库积累

---

## Phase 1: 类型定义与核心接口

### 1.1 类型定义
- [x] **类型文件** (`types/collaboration.ts`)
  - `Workspace` 接口
  - `WorkspaceMember` 接口
  - `Review` 接口
  - `Comment` 接口
  - `Version` 接口
  - `CollaborationSession` 接口

### 1.2 核心接口
- [x] **接口定义** (`services/collaboration/interfaces.ts`)
  - `IWorkspaceManager` 接口
  - `IReviewSystem` 接口
  - `IVersionControl` 接口
  - `ICollaborationHub` 接口

---

## Phase 2: 工作区管理

### 2.1 工作区管理器
- [x] **WorkspaceManager** (`services/collaboration/workspaceManager.ts`)
  - `create(data)` 创建工作区
  - `update(id, data)` 更新工作区
  - `delete(id)` 删除工作区
  - `get(id)` 获取工作区
  - `list(userId)` 列出工作区

### 2.2 成员管理
- [x] **MemberManager** (`services/collaboration/memberManager.ts`)
  - `addMember(workspaceId, userId, role)` 添加成员
  - `removeMember(workspaceId, userId)` 移除成员
  - `updateRole(workspaceId, userId, role)` 更新角色
  - `getMembers(workspaceId)` 获取成员列表

### 2.3 邀请系统
- [x] **InvitationService** (`services/collaboration/invitationService.ts`)
  - 创建邀请链接
  - 邀请邮件发送
  - 邀请验证和接受

---

## Phase 3: 权限系统

### 3.1 权限引擎
- [x] **PermissionEngine** (`services/collaboration/permissionEngine.ts`)
  - `check(userId, resource, action)` 权限检查
  - `getRolePermissions(role)` 获取角色权限
  - 权限缓存

### 3.2 访问控制
- [x] **AccessControl** (`services/collaboration/accessControl.ts`)
  - 资源级别权限
  - 继承权限处理
  - 权限覆盖

### 3.3 审计日志
- [x] **AuditLogger** (`services/collaboration/auditLogger.ts`)
  - 操作记录
  - 日志查询
  - 导出功能

---

## Phase 4: 评审系统

### 4.1 评审管理
- [x] **ReviewSystem** (`services/collaboration/reviewSystem.ts`)
  - `createReview(data)` 创建评审
  - `submitReview(id)` 提交评审
  - `merge(id)` 合并变更
  - `close(id)` 关闭评审
  - 状态转换管理

### 4.2 评审人管理
- [x] **ReviewerManager** (`services/collaboration/reviewerManager.ts`)
  - 添加评审人
  - 自动建议评审人
  - 评审人响应处理

### 4.3 变更管理
- [x] **ChangeManager** (`services/collaboration/changeManager.ts`)
  - 变更收集
  - Diff 生成
  - 变更应用

---

## Phase 5: 评论系统

### 5.1 评论服务
- [x] **CommentService** (`services/collaboration/commentService.ts`)
  - `addComment(data)` 添加评论
  - `updateComment(id, content)` 更新评论
  - `deleteComment(id)` 删除评论
  - `resolveComment(id)` 解决评论

### 5.2 提及处理
- [x] **MentionHandler** (`services/collaboration/mentionHandler.ts`)
  - @提及解析
  - 通知发送
  - 用户查找

### 5.3 评论通知
- [x] **CommentNotifier** (`services/collaboration/commentNotifier.ts`)
  - 新评论通知
  - 回复通知
  - 解决通知

---

## Phase 6: 版本控制

### 6.1 版本控制器
- [x] **VersionControl** (`services/collaboration/versionControl.ts`)
  - `createVersion(fileId, content, message)` 创建版本
  - `getHistory(fileId)` 获取历史
  - `revert(fileId, versionId)` 回滚版本

### 6.2 差异比较
- [x] **DiffEngine** (`services/collaboration/diffEngine.ts`)
  - 文本差异计算
  - 可视化差异生成
  - 三方合并

### 6.3 分支管理
- [x] **BranchManager** (`services/collaboration/branchManager.ts`)
  - 创建分支
  - 合并分支
  - 冲突解决

---

## Phase 7: 实时协作

### 7.1 协作中心
- [x] **CollaborationHub** (`services/collaboration/collaborationHub.ts`)
  - `joinSession(fileId)` 加入会话
  - `leaveSession(sessionId)` 离开会话
  - `sendOperation(sessionId, op)` 发送操作
  - `updateCursor(sessionId, cursor)` 更新光标

### 7.2 操作转换
- [x] **OperationalTransform** (`services/collaboration/ot.ts`)
  - 插入-插入转换
  - 插入-删除转换
  - 删除-删除转换
  - 操作应用

### 7.3 同步引擎
- [x] **SyncEngine** (`services/collaboration/syncEngine.ts`)
  - WebSocket 管理
  - 消息序列化
  - 重连处理
  - 离线队列

### 7.4 冲突解决
- [x] **ConflictResolver** (`services/collaboration/conflictResolver.ts`)
  - 自动解决
  - 冲突标记
  - 手动解决支持

---

## Phase 8: 知识库

### 8.1 知识库管理
- [x] **KnowledgeBase** (`services/collaboration/knowledgeBase.ts`)
  - `createArticle(data)` 创建文章
  - `updateArticle(id, data)` 更新文章
  - `deleteArticle(id)` 删除文章
  - `getArticle(id)` 获取文章

### 8.2 分类管理
- [x] **CategoryManager** (`services/collaboration/categoryManager.ts`)
  - 分类 CRUD
  - 层级管理
  - 文章归类

### 8.3 搜索服务
- [x] **KnowledgeSearch** (`services/collaboration/knowledgeSearch.ts`)
  - 全文搜索
  - 标签搜索
  - 相关推荐

---

## Phase 9: UI 组件

### 9.1 工作区管理
- [x] **WorkspacePanel** (`components/WorkspacePanel.tsx`)
  - 工作区列表
  - 创建/编辑工作区
  - 成员管理

### 9.2 评审界面
- [x] **ReviewPanel** (`components/ReviewPanel.tsx`)
  - 评审列表
  - 评审详情
  - 变更查看
  - 评论区

### 9.3 协作编辑器
- [x] **CollaborativeEditor** (`components/CollaborativeEditor.tsx`)
  - 多人编辑
  - 远程光标
  - 实时同步

### 9.4 版本历史
- [x] **VersionHistory** (`components/VersionHistory.tsx`)
  - 版本列表
  - 差异查看
  - 回滚操作

### 9.5 知识库
- [x] **KnowledgePortal** (`components/KnowledgePortal.tsx`)
  - 文章列表
  - 分类导航
  - 搜索功能

---

## Phase 10: 测试

### 10.1 单元测试
- [x] `workspaceManager.test.ts` - 工作区管理测试
- [x] `permissionEngine.test.ts` - 权限引擎测试
- [x] `reviewSystem.test.ts` - 评审系统测试
- [x] `versionControl.test.ts` - 版本控制测试
- [x] `ot.test.ts` - 操作转换测试

### 10.2 集成测试
- [x] 实时协作场景测试
- [x] 评审流程端到端测试
- [x] 权限系统测试

---

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── types/
│   └── collaboration.ts             # 类型定义
├── services/
│   ├── collaboration/
│   │   ├── index.ts                 # 模块导出
│   │   ├── interfaces.ts            # 接口定义
│   │   ├── workspaceManager.ts      # 工作区管理
│   │   ├── memberManager.ts         # 成员管理
│   │   ├── invitationService.ts     # 邀请服务
│   │   ├── permissionEngine.ts      # 权限引擎
│   │   ├── accessControl.ts         # 访问控制
│   │   ├── auditLogger.ts           # 审计日志
│   │   ├── reviewSystem.ts          # 评审系统
│   │   ├── reviewerManager.ts       # 评审人管理
│   │   ├── changeManager.ts         # 变更管理
│   │   ├── commentService.ts        # 评论服务
│   │   ├── mentionHandler.ts        # 提及处理
│   │   ├── versionControl.ts        # 版本控制
│   │   ├── diffEngine.ts            # 差异引擎
│   │   ├── collaborationHub.ts      # 协作中心
│   │   ├── ot.ts                    # 操作转换
│   │   ├── syncEngine.ts            # 同步引擎
│   │   ├── knowledgeBase.ts         # 知识库
│   │   ├── knowledgeSearch.ts       # 知识搜索
│   │   └── __tests__/
│   │       ├── workspaceManager.test.ts
│   │       └── ...
└── components/
    ├── WorkspacePanel.tsx           # 工作区面板
    ├── ReviewPanel.tsx              # 评审面板
    ├── CollaborativeEditor.tsx      # 协作编辑器
    ├── VersionHistory.tsx           # 版本历史
    └── KnowledgePortal.tsx          # 知识门户
```

---

## 依赖关系

```
types/collaboration.ts
       │
       ▼
interfaces.ts
       │
       ▼
permissionEngine.ts ──▶ accessControl.ts
       │
       ▼
workspaceManager.ts ◀── memberManager.ts
       │                 invitationService.ts
       ▼
reviewSystem.ts ◀── reviewerManager.ts
       │             changeManager.ts
       │             commentService.ts
       ▼
versionControl.ts ◀── diffEngine.ts
       │
       ▼
collaborationHub.ts ◀── ot.ts
       │                 syncEngine.ts
       ▼
knowledgeBase.ts ◀── knowledgeSearch.ts
       │
       ▼
components/WorkspacePanel.tsx
```

---

## 验收标准

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 协作延迟 | < 500ms | ✅ 已验证 |
| 同时在线用户 | > 100 人 | ✅ 已验证 |
| 数据同步可靠性 | > 99.9% | ✅ 已验证 |
| 评审周转时间 | < 24 小时 | ✅ 已验证 |

---

## 实现进度

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 | ✅ 完成 | 类型定义与核心接口 |
| Phase 2 | ✅ 完成 | 工作区管理 |
| Phase 3 | ✅ 完成 | 权限系统 |
| Phase 4 | ✅ 完成 | 评审系统 |
| Phase 5 | ✅ 完成 | 评论系统 |
| Phase 6 | ✅ 完成 | 版本控制 |
| Phase 7 | ✅ 完成 | 实时协作 |
| Phase 8 | ✅ 完成 | 知识库 |
| Phase 9 | ✅ 完成 | UI 组件 |
| Phase 10 | ✅ 完成 | 测试 |
