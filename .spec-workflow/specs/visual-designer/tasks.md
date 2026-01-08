# 可视化测试设计器 - 任务清单

## Phase 1: 基础架构

- [x] **React Flow 集成** (`components/FlowCanvas.tsx`) ✅ 已完成
  - 画布初始化
  - 缩放/平移
  - 事件处理

- [x] **节点注册系统** (`services/nodeRegistry.ts`) ✅ 已完成
  - 节点定义接口
  - 注册表管理
  - 默认配置

- [x] **状态管理** (`store/designerStore.ts`) ✅ 已完成
  - 流程状态
  - 选中状态
  - 历史记录 (撤销/重做)

## Phase 2: 节点实现

- [x] **基础节点组件** (`nodes/BaseNode.tsx`) ✅ 已完成
  - 通用节点样式
  - 端口渲染
  - 选中/拖拽状态

- [x] **动作节点** (`nodes/actions.tsx`) ✅ 已完成
  - Click, Input, Scroll, Wait, Navigate, Hover, Drag

- [x] **验证节点** (`nodes/validation.tsx`) ✅ 已完成
  - AssertExists, AssertText, AssertState, AiAssert

- [x] **控制节点** (`nodes/control.tsx`) ✅ 已完成
  - IfElse, Loop, Parallel, Group

- [x] **数据节点** (`nodes/data.tsx`) ✅ 已完成
  - SetVariable, ExtractData, ExternalData

- [x] **特殊节点** (`nodes/special.tsx`) ✅ 已完成
  - Start, End, Comment, Subflow

## Phase 3: 面板组件

- [x] **节点面板** (`components/NodePanel.tsx`) ✅ 已完成
  - 分类展示
  - 拖拽支持
  - 搜索过滤

- [x] **属性面板** (`components/PropertyPanel.tsx`) ✅ 已完成
  - 动态表单生成
  - JSON Schema 渲染
  - 变量选择器

- [x] **工具栏** (`components/Toolbar.tsx`) ✅ 已完成
  - 文件操作
  - 撤销/重做
  - 缩放控制
  - 执行按钮

- [x] **小地图** (`components/Minimap.tsx`) ✅ 已完成
  - 视口指示
  - 快速导航

## Phase 4: 核心功能

- [x] **YAML 转换器** (`services/yamlConverter.ts`) ✅ 已完成
  - 流程转 YAML
  - YAML 导入
  - 格式验证

- [x] **流程验证器** (`services/flowValidator.ts`) ✅ 已完成
  - 结构验证
  - 配置验证
  - 错误标记

- [x] **元素选择器** (`components/ElementPicker.tsx`) ✅ 已完成
  - 页面元素选取
  - 描述生成
  - 截图预览
  - 已集成到 PropertyPanel (30/30 tests passing)

- [x] **变量管理** (`components/VariableManager.tsx`) ✅ 已完成
  - 变量列表
  - 添加/编辑
  - 引用检查
  - 已集成到 VisualDesigner (13/13 tests passing)

## Phase 5: 高级功能

- [x] **执行集成** (`services/designerExecutor.ts`) ✅ 已完成
  - 流程执行
  - 节点高亮
  - 结果反馈
  - (41/41 tests passing)

- [x] **模板系统** (`services/templateManager.ts`) ✅ 已完成
  - 预置模板
  - 保存为模板
  - 子流程复用
  - (45/45 tests passing)

- [x] **导入导出** (`services/fileManager.ts`) ✅ 已完成
  - 项目文件 (JSON)
  - YAML 导出
  - 批量导出

## Phase 6: 用户体验

- [x] **快捷键** (`hooks/useKeyboardShortcuts.ts`) ✅ 已完成
  - Ctrl+C/V/X
  - Ctrl+Z/Y
  - Delete
  - 方向键移动
  - (56/56 tests passing)

- [x] **智能连线** (`services/edgeRouter.ts`) ✅ 已完成
  - 自动路由
  - 避免交叉
  - 曲线平滑
  - (37/37 tests passing)

- [x] **对齐辅助** (`services/alignmentGuides.ts`) ✅ 已完成
  - 网格对齐
  - 参考线
  - 自动分布
  - (56/56 tests passing)

## Phase 7: 测试与文档

- [x] **服务单元测试** ✅ 已完成 (350+ tests)
  - [x] YAML 转换测试 (`yamlConverter.test.ts`) - 52 tests
  - [x] 验证器测试 (`flowValidator.test.ts`) - 51 tests
  - [x] 节点注册测试 (`nodeRegistry.test.ts`) - 58 tests
  - [x] 文件管理测试 (`fileManager.test.ts`) - 57 tests
  - [x] 执行引擎测试 (`designerExecutor.test.ts`) - 41 tests
  - [x] 模板管理测试 (`templateManager.test.ts`) - 45 tests
  - [x] 智能连线测试 (`edgeRouter.test.ts`) - 37 tests
  - [x] 对齐辅助测试 (`alignmentGuides.test.ts`) - 56 tests

- [x] **节点组件测试** ✅ 已完成 (263 tests)
  - [x] BaseNode 组件测试 - 59 tests
  - [x] 动作节点组件测试 - 48 tests
  - [x] 控制节点组件测试 - 47 tests
  - [x] 验证节点组件测试 - 40 tests
  - [x] 数据节点组件测试 - 35 tests
  - [x] 特殊节点组件测试 - 34 tests

- [x] **集成测试** ✅ 已完成 (17 tests)
  - [x] 完整流程创建测试
  - [x] YAML 往返转换测试
  - [x] 控制流结构测试 (ifElse, loop, parallel)
  - [x] 循环类型测试 (count, while)
  - [x] 验证错误场景测试
  - [x] 所有 22 种节点类型集成测试

- [x] **用户文档** ✅ 已完成
  - [x] 使用指南 (`docs/01-usage-guide.md`)
  - [x] 节点说明 (`docs/02-node-reference.md`)
  - [x] 快捷键列表 (`docs/03-keyboard-shortcuts.md`)

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
│   ├── types/
│   │   └── designer.ts          # 类型定义
│   ├── docs/
│   │   ├── 01-usage-guide.md    # 使用指南
│   │   ├── 02-node-reference.md # 节点说明
│   │   └── 03-keyboard-shortcuts.md # 快捷键列表
│   └── __tests__/
│       └── integration.test.ts  # 集成测试
```

## 验收标准

1. 支持 200+ 节点流程
2. 拖拽响应 < 16ms
3. 撤销/重做支持 50 步
4. YAML 转换双向兼容
5. 流程验证覆盖所有规则
6. 执行时节点高亮同步
