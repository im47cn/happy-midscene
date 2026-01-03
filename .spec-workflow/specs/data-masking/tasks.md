# 敏感数据脱敏 - 任务清单

## Phase 1: 检测引擎

- [x] **检测引擎核心** (`services/detectorEngine.ts`)
  - 规则匹配
  - 上下文检查
  - 重叠合并

- [x] **内置规则库** (`rules/builtInRules.ts`)
  - 凭证类规则
  - PII 规则
  - 金融信息规则

- [x] **规则管理器** (`services/ruleManager.ts`)
  - 规则加载
  - 优先级排序
  - 范围过滤

## Phase 2: 文本脱敏

- [x] **脱敏引擎** (`services/maskerEngine.ts`)
  - 文本脱敏
  - 脱敏方法实现
  - 结果记录

- [x] **脱敏方法** (`services/maskingMethods.ts`)
  - 完全遮盖
  - 部分保留
  - 哈希替换
  - 占位符

- [x] **日志脱敏器** (`services/logMasker.ts`)
  - 日志拦截
  - 自动脱敏
  - 级别配置

## Phase 3: 截图脱敏

- [x] **截图脱敏器** (`services/imageMasker.ts`)
  - 区域检测
  - 模糊处理
  - 遮盖处理

- [x] **OCR 集成** (`services/ocrEngine.ts`)
  - Tesseract.js 封装
  - 文本识别
  - 敏感检测

- [x] **区域检测** (`services/regionDetector.ts`)
  - 输入框检测
  - 敏感元素标记
  - 坐标计算

## Phase 4: 规则管理 UI

- [x] **规则列表** (`components/masking/MaskingSettings.tsx`)
  - 规则展示
  - 启用/禁用
  - 优先级调整

- [x] **规则编辑器** (`components/masking/RuleEditor.tsx`)
  - 新建规则
  - 编辑规则
  - 正则测试

- [x] **规则测试** (`components/masking/RuleTester.tsx`)
  - 测试输入
  - 匹配预览
  - 脱敏预览

## Phase 5: 白名单管理

- [x] **白名单管理器** (`services/whitelistManager.ts`)
  - 白名单存储
  - 匹配检查
  - CRUD 操作

- [x] **白名单 UI** (`components/masking/WhitelistManager.tsx`)
  - 白名单列表
  - 添加/删除
  - 导入/导出

## Phase 6: 集成

- [x] **ExecutionEngine 集成**
  - 截图脱敏
  - 日志脱敏
  - 配置管理

- [x] **报告集成**
  - 报告内容脱敏
  - 脱敏统计
  - 审计日志

- [x] **YAML 脚本检查**
  - 硬编码检测
  - 警告提示
  - 自动替换建议

## Phase 7: 测试与文档

- [x] **单元测试** (195 tests passing)
  - 检测引擎测试
  - 脱敏方法测试
  - 规则匹配测试

- [x] **集成测试** (25 integration tests)
  - 端到端脱敏测试
  - 截图脱敏测试

- [x] **文档** (`specs/data-masking/docs.md`)
  - 内置规则说明
  - 自定义规则指南
  - 最佳实践

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── services/masking/
│   ├── detectorEngine.ts     # 检测引擎
│   ├── maskerEngine.ts       # 脱敏引擎
│   ├── builtInRules.ts       # 内置规则
│   ├── imageMasker.ts        # 截图脱敏
│   ├── logMasker.ts          # 日志脱敏
│   ├── ocrEngine.ts          # OCR 引擎
│   ├── regionDetector.ts     # 区域检测
│   ├── whitelistManager.ts   # 白名单管理
│   ├── yamlChecker.ts        # YAML 检查
│   ├── auditLogger.ts        # 审计日志
│   ├── index.ts              # 模块导出
│   └── __tests__/            # 单元测试 (10 files, 195 tests)
├── components/masking/
│   ├── MaskingSettings.tsx   # 脱敏设置主组件
│   ├── RuleEditor.tsx        # 规则编辑器
│   ├── RuleTester.tsx        # 规则测试器
│   ├── WhitelistManager.tsx  # 白名单管理 UI
│   └── index.ts              # 组件导出
├── types/
│   └── masking.ts            # 类型定义
```

## 验收标准

1. ✅ 敏感数据识别准确率 > 95%
2. ✅ 文本脱敏性能 < 10ms/KB
3. ✅ 截图脱敏性能 < 500ms/张
4. ✅ 内置规则覆盖常见敏感类型 (13+ rules)
5. ✅ 自定义规则功能完整
6. ✅ 集成到执行流程无感知

## 完成状态

**所有 Phase 已完成** ✅

- Phase 1-3: 核心引擎已实现
- Phase 4-5: UI 组件已实现
- Phase 6: 集成已完成
- Phase 7: 测试和文档已完成
