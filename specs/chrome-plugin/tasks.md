# AI 驱动 UI 自动化测试插件 - 任务清单

## 已完成任务 ✅

### Phase 1: 核心服务层

- [x] **GitLabClient 服务** (`services/gitlabClient.ts`)
  - Token 加密存储 (chrome.storage.local)
  - API 连接测试
  - 项目搜索
  - 分支管理 (获取/创建)
  - 文件提交

- [x] **MarkdownParser 服务** (`services/markdownParser.ts`)
  - Markdown 解析 (标题 → 用例名，列表 → 步骤)
  - 参数提取 (数字、引号字符串、邮箱)
  - 验证功能

- [x] **ExecutionEngine 服务** (`services/executionEngine.ts`)
  - Midscene.js 集成
  - 步骤执行控制 (暂停/继续/停止)
  - 失败重试机制
  - YAML 生成

### Phase 2: UI 组件层

- [x] **MarkdownInput** 组件
  - 文本输入区
  - 文件上传
  - 示例加载
  - 解析触发

- [x] **TestCasePreview** 组件
  - 用例卡片展示
  - 步骤列表 (带状态图标)
  - 参数识别显示
  - 步骤编辑/删除

- [x] **ExecutionView** 组件
  - 进度条显示
  - 实时步骤状态
  - 暂停/继续/停止控制
  - 失败重试弹窗

- [x] **CommitView** 组件
  - YAML 预览/编辑
  - 复制/下载功能
  - GitLab 项目/分支选择
  - 提交表单

- [x] **GitLabConfig** 组件
  - 配置表单
  - 连接测试
  - 状态显示

### Phase 3: 状态管理

- [x] **Zustand Store** (`store.ts`)
  - 输入状态
  - 执行状态
  - GitLab 配置状态
  - UI 状态

### Phase 4: 集成

- [x] **Popup 集成**
  - 新增 "AI Test Generator" 模式
  - 菜单项添加
  - 模式切换逻辑

- [x] **样式** (`styles.less`)
  - 响应式布局
  - 动画效果
  - 与现有风格一致

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── index.tsx                 # 主入口组件
├── store.ts                  # Zustand 状态管理
├── types.ts                  # 类型定义
├── styles.less               # 样式文件
├── services/
│   ├── index.ts
│   ├── gitlabClient.ts       # GitLab API 客户端
│   ├── markdownParser.ts     # Markdown 解析器
│   └── executionEngine.ts    # 执行引擎
└── components/
    ├── index.ts
    ├── MarkdownInput.tsx     # 需求输入
    ├── TestCasePreview.tsx   # 用例预览
    ├── ExecutionView.tsx     # 执行视图
    ├── CommitView.tsx        # 提交视图
    └── GitLabConfig.tsx      # GitLab 配置
```

## 待优化/后续迭代 🔄

### 功能增强
- [ ] H5 移动端模式支持
- [x] 快捷键操作
- [ ] 批量用例执行
- [ ] 执行历史记录
- [ ] 元素框选修复功能

### 体验优化
- [ ] 执行过程中的元素高亮
- [ ] 更详细的错误信息
- [ ] 执行截图保存
- [ ] 多语言支持

### 技术债务
- [ ] 单元测试覆盖
- [ ] E2E 测试
- [ ] 错误边界处理
- [ ] 性能优化

## 使用方式

1. 在 Chrome 扩展中打开侧边栏
2. 点击左上角菜单，选择 "AI Test Generator"
3. 配置 GitLab 连接 (首次使用)
4. 粘贴或上传 Markdown 格式的测试需求
5. 预览解析结果，点击"开始生成脚本"
6. 观察执行过程，必要时进行人工干预
7. 编辑生成的 YAML，提交到 GitLab
