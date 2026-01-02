# 可视化测试设计器 - 任务清单

## Phase 1: 基础架构

- [ ] **React Flow 集成** (`components/FlowCanvas.tsx`)
  - 画布初始化
  - 缩放/平移
  - 事件处理

- [ ] **节点注册系统** (`services/nodeRegistry.ts`)
  - 节点定义接口
  - 注册表管理
  - 默认配置

- [ ] **状态管理** (`store/designerStore.ts`)
  - 流程状态
  - 选中状态
  - 历史记录 (撤销/重做)

## Phase 2: 节点实现

- [ ] **基础节点组件** (`nodes/BaseNode.tsx`)
  - 通用节点样式
  - 端口渲染
  - 选中/拖拽状态

- [ ] **动作节点** (`nodes/actions/`)
  - `ClickNode.tsx`
  - `InputNode.tsx`
  - `ScrollNode.tsx`
  - `WaitNode.tsx`
  - `NavigateNode.tsx`

- [ ] **验证节点** (`nodes/validation/`)
  - `AssertExistsNode.tsx`
  - `AssertTextNode.tsx`
  - `AiAssertNode.tsx`

- [ ] **控制节点** (`nodes/control/`)
  - `IfElseNode.tsx`
  - `LoopNode.tsx`
  - `ParallelNode.tsx`
  - `GroupNode.tsx`

- [ ] **数据节点** (`nodes/data/`)
  - `SetVariableNode.tsx`
  - `ExtractDataNode.tsx`

- [ ] **特殊节点** (`nodes/special/`)
  - `StartNode.tsx`
  - `EndNode.tsx`
  - `CommentNode.tsx`
  - `SubflowNode.tsx`

## Phase 3: 面板组件

- [ ] **节点面板** (`components/NodePanel.tsx`)
  - 分类展示
  - 拖拽支持
  - 搜索过滤

- [ ] **属性面板** (`components/PropertyPanel.tsx`)
  - 动态表单生成
  - JSON Schema 渲染
  - 变量选择器

- [ ] **工具栏** (`components/Toolbar.tsx`)
  - 文件操作
  - 撤销/重做
  - 缩放控制
  - 执行按钮

- [ ] **小地图** (`components/Minimap.tsx`)
  - 视口指示
  - 快速导航

## Phase 4: 核心功能

- [ ] **YAML 转换器** (`services/yamlConverter.ts`)
  - 流程转 YAML
  - YAML 导入
  - 格式验证

- [ ] **流程验证器** (`services/flowValidator.ts`)
  - 结构验证
  - 配置验证
  - 错误标记

- [ ] **元素选择器** (`components/ElementPicker.tsx`)
  - 页面元素选取
  - 描述生成
  - 截图预览

- [ ] **变量管理** (`components/VariableManager.tsx`)
  - 变量列表
  - 添加/编辑
  - 引用检查

## Phase 5: 高级功能

- [ ] **执行集成** (`services/designerExecutor.ts`)
  - 流程执行
  - 节点高亮
  - 结果反馈

- [ ] **模板系统** (`services/templateManager.ts`)
  - 预置模板
  - 保存为模板
  - 子流程复用

- [ ] **导入导出** (`services/fileManager.ts`)
  - 项目文件 (JSON)
  - YAML 导出
  - 批量导出

## Phase 6: 用户体验

- [ ] **快捷键** (`hooks/useKeyboardShortcuts.ts`)
  - Ctrl+C/V/X
  - Ctrl+Z/Y
  - Delete
  - 方向键移动

- [ ] **智能连线** (`services/edgeRouter.ts`)
  - 自动路由
  - 避免交叉
  - 曲线平滑

- [ ] **对齐辅助** (`services/alignmentGuides.ts`)
  - 网格对齐
  - 参考线
  - 自动分布

## Phase 7: 测试与文档

- [ ] **单元测试**
  - 节点组件测试
  - YAML 转换测试
  - 验证器测试

- [ ] **集成测试**
  - 完整流程测试
  - 执行测试

- [ ] **用户文档**
  - 使用指南
  - 节点说明
  - 快捷键列表

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── designer/
│   ├── components/
│   │   ├── FlowCanvas.tsx       # 画布
│   │   ├── NodePanel.tsx        # 节点面板
│   │   ├── PropertyPanel.tsx    # 属性面板
│   │   ├── Toolbar.tsx          # 工具栏
│   │   ├── Minimap.tsx          # 小地图
│   │   ├── ElementPicker.tsx    # 元素选择
│   │   └── VariableManager.tsx  # 变量管理
│   ├── nodes/
│   │   ├── BaseNode.tsx         # 基础节点
│   │   ├── actions/             # 动作节点
│   │   ├── validation/          # 验证节点
│   │   ├── control/             # 控制节点
│   │   ├── data/                # 数据节点
│   │   └── special/             # 特殊节点
│   ├── services/
│   │   ├── nodeRegistry.ts      # 节点注册
│   │   ├── yamlConverter.ts     # YAML 转换
│   │   ├── flowValidator.ts     # 流程验证
│   │   ├── designerExecutor.ts  # 执行集成
│   │   ├── templateManager.ts   # 模板管理
│   │   └── fileManager.ts       # 文件管理
│   ├── store/
│   │   └── designerStore.ts     # 状态管理
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts
│   └── types/
│       └── designer.ts          # 类型定义
```

## 验收标准

1. 支持 200+ 节点流程
2. 拖拽响应 < 16ms
3. 撤销/重做支持 50 步
4. YAML 转换双向兼容
5. 流程验证覆盖所有规则
6. 执行时节点高亮同步
