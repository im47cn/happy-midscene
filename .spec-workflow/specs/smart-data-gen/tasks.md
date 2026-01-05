# 测试数据智能生成 - 任务清单

## 设计决策

**采用语义驱动生成策略**：通过 AI 识别字段语义，结合规则引擎生成符合业务要求的测试数据。

核心特点：
- 基于视觉识别的字段类型推断
- 内置丰富的数据生成器
- 自动边界值分析和生成
- 敏感数据脱敏处理

---

## Phase 1: 类型定义与基础设施 ✅

### 1.1 类型定义
- [x] **类型文件** (`types/dataGen.ts`)
  - `FieldDefinition` 接口
  - `FieldType` 和 `SemanticType` 类型
  - `FieldConstraints` 接口
  - `GenerationRule` 接口
  - `DataTemplate` 接口
  - `BoundaryTestCase` 接口
  - `MaskingRule` 接口

### 1.2 存储层
- [x] **数据存储** (`services/dataGen/storage.ts`)
  - 模板存储
  - 数据池存储
  - 生成规则存储

---

## Phase 2: 字段识别器 ✅

### 2.1 字段识别核心
- [x] **FieldRecognizer** (`services/dataGen/fieldRecognizer.ts`)
  - `recognizeFields(rawInfoList)` 批量识别
  - `recognizeFieldType(htmlType, text)` 类型识别
  - `recognizeSemanticType(text)` 语义识别
  - `extractConstraints(rawInfo)` 约束提取

### 2.2 语义解析
- [x] **SemanticParser** (`services/dataGen/semanticParser.ts`)
  - 22 种语义类型关键词映射（中英文）
  - 置信度评分机制
  - `parseSemanticType` / `parseSemanticTypeWithConfidence`

### 2.3 约束分析
- [x] **约束提取** (集成在 semanticParser.ts)
  - HTML 属性解析（required, minLength, maxLength, min, max, pattern）
  - 标签文本识别（*必填、required）

---

## Phase 3: 数据生成器 ✅

### 3.1 生成器核心
- [x] **DataGenerator** (`services/dataGen/dataGenerator.ts`)
  - `generate(field, options)` 单字段生成
  - `generateForForm(fields)` 表单生成
  - `generateWithVariation(field, variation)` 变体生成

### 3.2 生成器注册
- [x] **GeneratorRegistry** (`services/dataGen/generatorRegistry.ts`)
  - 生成器注册机制
  - 生成器查找逻辑
  - 自定义生成器支持

### 3.3 内置生成器
- [x] **内置生成器集** (`services/dataGen/generators.ts`)
  - 22 种生成器（手机号/邮箱/身份证/银行卡/地址/姓名/日期/金额等）

---

## Phase 4: 边界值引擎 ✅

### 4.1 边界值分析
- [x] **BoundaryEngine** (`services/dataGen/boundaryEngine.ts`)
  - `analyzeBoundaries(field)` 边界分析
  - `generateBoundaryValues(field)` 边界值生成
  - `generateInvalidValues(field)` 无效值生成

### 4.2 边界规则
- [x] **BoundaryRules** (集成在 boundaryEngine.ts)
  - 长度边界规则
  - 数值边界规则
  - 格式边界规则
  - 特殊值规则

---

## Phase 5: 数据脱敏 ✅

### 5.1 脱敏引擎
- [x] **DataMasker** (`services/dataGen/dataMasker.ts`)
  - `mask(value, semanticType)` 脱敏处理
  - `maskRecord(record)` 记录脱敏
  - `isSensitive(type)` 敏感性判断

### 5.2 脱敏规则
- [x] **MaskingRules** (集成在 dataMasker.ts)
  - 内置脱敏规则
  - 自定义规则支持
  - 规则优先级管理

---

## Phase 6: 模板管理 ✅

### 6.1 模板管理器
- [x] **TemplateManager** (`services/dataGen/templateManager.ts`)
  - `create(template)` 创建模板
  - `update(id, updates)` 更新模板
  - `delete(id)` 删除模板
  - `applyTemplate(id, variables)` 应用模板

### 6.2 变量替换
- [x] **VariableResolver** (`services/dataGen/variableResolver.ts`)
  - 变量解析
  - 表达式计算
  - 依赖处理

---

## Phase 7: 数据池 ✅

### 7.1 数据池管理
- [x] **DataPoolManager** (`services/dataGen/dataPoolManager.ts`)
  - `getPool(id)` 获取数据池
  - `pick(poolId, strategy)` 选择数据
  - `addPool(pool)` 添加数据池

### 7.2 内置数据池
- [x] **内置数据池** (`services/dataGen/pools/`)
  - `provinces.ts` 省份数据
  - `cities.ts` 城市数据
  - `names.ts` 姓名数据
  - `domains.ts` 域名数据

---

## Phase 8: 执行引擎集成 ✅

### 8.1 智能输入执行器
- [x] **SmartInputExecutor** (`services/dataGen/smartInputExecutor.ts`)
  - `parseStepText()` 解析步骤文本中的数据生成语法
  - `generateForStep()` 为步骤生成数据
  - `processStepText()` 替换语法标记为实际值
  - 执行记录管理（含脱敏）

### 8.2 数据生成语法
- [x] **语法支持** (集成在 smartInputExecutor.ts)
  - `[自动生成:类型]` / `[auto:type]` 自动生成
  - `[模板:名称.字段]` / `[template:name.field]` 模板引用
  - `[数据池:名称]` / `[pool:name]` 数据池选取
  - `[随机]` / `[random]` 智能随机

---

## Phase 9: UI 组件 ✅

### 9.1 数据生成面板
- [x] **DataGenPanel** (`components/dataGen/DataGenPanel.tsx`)
  - 单字段生成（选择类型、一键生成）
  - 预置表单快速生成（登录、注册、个人资料、支付）
  - 模板管理入口
  - 生成历史记录表格

### 9.2 模板编辑器
- [x] **模板功能** (集成在 DataGenPanel)
  - 系统模板展示
  - 模板应用生成

### 9.3 数据池管理
- [ ] **DataPoolEditor** (`components/DataPoolEditor.tsx`) - 可选增强
  - 数据池列表
  - 数据编辑
  - 导入导出

### 9.4 边界值预览
- [ ] **BoundaryPreview** (`components/BoundaryPreview.tsx`) - 可选增强
  - 边界值列表
  - 预期结果标记
  - 一键生成测试

---

## Phase 10: 测试 ✅

### 10.1 单元测试
- [x] `fieldRecognizer.test.ts` - 字段识别测试
- [x] `dataGenerator.test.ts` - 数据生成测试
- [x] `boundaryEngine.test.ts` - 边界值测试
- [x] `dataMasker.test.ts` - 数据脱敏测试
- [x] `templateManager.test.ts` - 模板管理测试

### 10.2 集成测试
- [x] 端到端数据生成流程测试
- [x] 执行引擎集成测试
- [x] 性能基准测试

---

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── types/
│   └── dataGen.ts                   # 类型定义
├── services/
│   ├── dataGen/
│   │   ├── index.ts                 # 模块导出
│   │   ├── fieldRecognizer.ts       # 字段识别
│   │   ├── semanticParser.ts        # 语义解析
│   │   ├── constraintAnalyzer.ts    # 约束分析
│   │   ├── dataGenerator.ts         # 数据生成
│   │   ├── generatorRegistry.ts     # 生成器注册
│   │   ├── boundaryEngine.ts        # 边界值引擎
│   │   ├── dataMasker.ts            # 数据脱敏
│   │   ├── templateManager.ts       # 模板管理
│   │   ├── variableResolver.ts      # 变量解析
│   │   ├── dataPoolManager.ts       # 数据池管理
│   │   ├── syntax.ts                # 语法扩展
│   │   ├── storage.ts               # 数据存储
│   │   ├── generators/              # 内置生成器
│   │   │   ├── mobilePhoneGenerator.ts
│   │   │   ├── emailGenerator.ts
│   │   │   ├── idCardGenerator.ts
│   │   │   └── ...
│   │   ├── pools/                   # 内置数据池
│   │   │   ├── provinces.ts
│   │   │   ├── cities.ts
│   │   │   └── ...
│   │   └── __tests__/
│   │       ├── fieldRecognizer.test.ts
│   │       ├── dataGenerator.test.ts
│   │       └── ...
│   └── smartInputExecutor.ts        # 智能输入执行器
└── components/
    ├── DataGenPanel.tsx             # 数据生成面板
    ├── TemplateEditor.tsx           # 模板编辑器
    ├── DataPoolEditor.tsx           # 数据池管理
    └── BoundaryPreview.tsx          # 边界值预览
```

---

## 依赖关系

```
types/dataGen.ts
       │
       ▼
services/dataGen/storage.ts
       │
       ▼
fieldRecognizer.ts ──▶ semanticParser.ts
       │                constraintAnalyzer.ts
       ▼
generatorRegistry.ts ◀── generators/*
       │
       ▼
dataGenerator.ts ◀── boundaryEngine.ts
       │              templateManager.ts
       │              dataPoolManager.ts
       ▼
dataMasker.ts
       │
       ▼
smartInputExecutor.ts
       │
       ▼
components/DataGenPanel.tsx
```

---

## 验收标准

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 字段类型识别准确率 | > 90% | ✅ 已验证 |
| 数据格式合规率 | > 99% | ✅ 已验证 |
| 边界值覆盖率 | 100% | ✅ 已验证 |
| 脱敏处理成功率 | 100% | ✅ 已验证 |

---

## 实现进度

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 | ✅ 完成 | 类型定义与基础设施 |
| Phase 2 | ✅ 完成 | 字段识别器 (语义解析 + 置信度) |
| Phase 3 | ✅ 完成 | 数据生成器 (22 个生成器) |
| Phase 4 | ✅ 完成 | 边界值引擎 |
| Phase 5 | ✅ 完成 | 数据脱敏 (7 种敏感类型) |
| Phase 6 | ✅ 完成 | 模板管理 (5 个预置模板) |
| Phase 7 | ✅ 完成 | 数据池 (10 个内置池) |
| Phase 8 | ✅ 完成 | 执行引擎集成 (智能输入执行器) |
| Phase 9 | ✅ 完成 | UI 组件 (DataGenPanel) |
| Phase 10 | ✅ 完成 | 测试 (168 tests) |

**核心功能完成度: 100%** ✅
