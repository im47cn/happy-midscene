# 智能断言生成 - 任务清单

## Phase 1: 上下文分析 ✅

- [x] **上下文采集器** (`services/assertion/contextCollector.ts`)
  - 操作信息记录
  - 前后截图采集 (接口预留)
  - URL 变化追踪
  - 单元测试

- [x] **页面变化检测** (`services/assertion/changeDetector.ts`)
  - DOM 快照对比
  - 新元素识别
  - 状态变化检测
  - 置信度评估

- [x] **意图推断器** (`services/assertion/intentInferrer.ts`)
  - AI 意图分析
  - 操作分类
  - 语义提取
  - 高价值意图识别
  - 单元测试 (11 tests passing)

## Phase 2: 断言生成引擎 ✅

- [x] **断言生成器** (`services/assertion/assertionGenerator.ts`)
  - 策略管理
  - 推荐排序
  - 去重逻辑
  - 模板集成
  - 单元测试 (10 tests passing)

- [x] **生成策略实现** (`services/assertion/strategies/index.ts`)
  - `SuccessMessageStrategy` - 成功提示策略
  - `NavigationStrategy` - 导航验证策略
  - `StateChangeStrategy` - 状态变化策略
  - `DataValidationStrategy` - 数据验证策略
  - `ErrorPreventionStrategy` - 错误预防策略
  - `ElementVisibilityStrategy` - 元素可见性策略
  - 单元测试 (19 tests passing)

- [x] **断言验证器** (`services/assertion/assertionValidator.ts`)
  - 即时验证执行
  - 多种断言类型支持
  - 批量验证

## Phase 3: 模板系统 ✅

- [x] **模板管理器** (`services/assertion/templateManager.ts`)
  - 模板 CRUD
  - 模板匹配
  - 使用统计
  - 系统预置模板
  - 导入/导出
  - 单元测试 (15 tests passing)

## Phase 4: UI 组件 ✅

- [x] **断言推荐卡片** (`components/assertion/AssertionCard.tsx`)
  - 推荐信息展示
  - 验证状态显示
  - 操作按钮
  - YAML 预览

- [x] **推荐列表** (`components/assertion/AssertionRecommendations.tsx`)
  - 列表渲染
  - 键盘导航 (↑↓/Enter/Esc/E/S)
  - 自动验证
  - 验证统计

- [x] **断言编辑器** (`components/assertion/AssertionEditor.tsx`)
  - 参数修改
  - 类型选择
  - YAML 预览
  - 创建/编辑模式

## Phase 5: 集成 ✅

- [x] **类型定义** (`types/assertion.ts`)
  - ActionContext
  - AssertionRecommendation
  - AssertionTemplate
  - SmartAssertionConfig
  - 常量定义

- [x] **服务导出** (`services/assertion/index.ts`)
  - 统一导出入口
  - 策略导出

- [x] **测试**
  - 单元测试 (63 tests passing)
  - 策略测试
  - 模板管理测试
  - 生成器测试

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── services/
│   └── assertion/
│       ├── index.ts                # 导出
│       ├── contextCollector.ts     # 上下文采集
│       ├── changeDetector.ts       # 变化检测
│       ├── intentInferrer.ts       # 意图推断
│       ├── assertionGenerator.ts   # 断言生成器
│       ├── assertionValidator.ts   # 断言验证
│       ├── templateManager.ts      # 模板管理
│       ├── strategies/
│       │   └── index.ts            # 生成策略
│       └── __tests__/              # 测试文件
│           ├── contextCollector.test.ts
│           ├── intentInferrer.test.ts
│           ├── assertionGenerator.test.ts
│           ├── templateManager.test.ts
│           └── strategies.test.ts
├── components/
│   └── assertion/
│       ├── index.ts                # 导出
│       ├── AssertionCard.tsx       # 推荐卡片
│       ├── AssertionRecommendations.tsx  # 推荐列表
│       └── AssertionEditor.tsx     # 断言编辑
└── types/
    └── assertion.ts                # 类型定义
```

## 验收标准

1. ✅ 推荐生成时间 < 3s (同步分析)
2. ✅ 覆盖 14 种断言类型
3. ✅ 支持 6 种生成策略
4. ✅ 支持模板保存和复用
5. ✅ 支持键盘快捷键操作

## 完成进度

| Phase | 状态 | 进度 |
|-------|------|------|
| Phase 1: 上下文分析 | ✅ 完成 | 100% |
| Phase 2: 断言生成引擎 | ✅ 完成 | 100% |
| Phase 3: 模板系统 | ✅ 完成 | 100% |
| Phase 4: UI 组件 | ✅ 完成 | 100% |
| Phase 5: 集成 | ✅ 完成 | 100% |

**总体完成度: 100%** ✅

## 支持的断言类型

| 类型 | 描述 |
|------|------|
| element_exists | 元素存在 |
| element_visible | 元素可见 |
| text_contains | 文本包含 |
| text_equals | 文本等于 |
| attribute_equals | 属性等于 |
| state_check | 状态检查 |
| url_contains | URL 包含 |
| url_equals | URL 等于 |
| count_equals | 数量等于 |
| value_equals | 值等于 |
| enabled | 已启用 |
| disabled | 已禁用 |
| checked | 已选中 |
| unchecked | 未选中 |

## 支持的生成策略

| 策略 | 优先级 | 描述 |
|------|--------|------|
| SuccessMessageStrategy | 100 | 成功/确认消息检测 |
| NavigationStrategy | 95 | URL 变化验证 |
| StateChangeStrategy | 80 | 元素状态变化 |
| DataValidationStrategy | 75 | 数据相关验证 |
| ElementVisibilityStrategy | 70 | 新元素出现 |
| ErrorPreventionStrategy | 60 | 错误消息检测 |
