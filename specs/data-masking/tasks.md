# 敏感数据脱敏 - 任务清单

## Phase 1: 检测引擎

- [ ] **检测引擎核心** (`services/detectorEngine.ts`)
  - 规则匹配
  - 上下文检查
  - 重叠合并

- [ ] **内置规则库** (`rules/builtInRules.ts`)
  - 凭证类规则
  - PII 规则
  - 金融信息规则

- [ ] **规则管理器** (`services/ruleManager.ts`)
  - 规则加载
  - 优先级排序
  - 范围过滤

## Phase 2: 文本脱敏

- [ ] **脱敏引擎** (`services/maskerEngine.ts`)
  - 文本脱敏
  - 脱敏方法实现
  - 结果记录

- [ ] **脱敏方法** (`services/maskingMethods.ts`)
  - 完全遮盖
  - 部分保留
  - 哈希替换
  - 占位符

- [ ] **日志脱敏器** (`services/logMasker.ts`)
  - 日志拦截
  - 自动脱敏
  - 级别配置

## Phase 3: 截图脱敏

- [ ] **截图脱敏器** (`services/imageMasker.ts`)
  - 区域检测
  - 模糊处理
  - 遮盖处理

- [ ] **OCR 集成** (`services/ocrEngine.ts`)
  - Tesseract.js 封装
  - 文本识别
  - 敏感检测

- [ ] **区域检测** (`services/regionDetector.ts`)
  - 输入框检测
  - 敏感元素标记
  - 坐标计算

## Phase 4: 规则管理 UI

- [ ] **规则列表** (`components/RuleList.tsx`)
  - 规则展示
  - 启用/禁用
  - 优先级调整

- [ ] **规则编辑器** (`components/RuleEditor.tsx`)
  - 新建规则
  - 编辑规则
  - 正则测试

- [ ] **规则测试** (`components/RuleTester.tsx`)
  - 测试输入
  - 匹配预览
  - 脱敏预览

## Phase 5: 白名单管理

- [ ] **白名单管理器** (`services/whitelistManager.ts`)
  - 白名单存储
  - 匹配检查
  - CRUD 操作

- [ ] **白名单 UI** (`components/WhitelistManager.tsx`)
  - 白名单列表
  - 添加/删除
  - 导入/导出

## Phase 6: 集成

- [ ] **ExecutionEngine 集成**
  - 截图脱敏
  - 日志脱敏
  - 配置管理

- [ ] **报告集成**
  - 报告内容脱敏
  - 脱敏统计
  - 审计日志

- [ ] **YAML 脚本检查**
  - 硬编码检测
  - 警告提示
  - 自动替换建议

## Phase 7: 测试与文档

- [ ] **单元测试**
  - 检测引擎测试
  - 脱敏方法测试
  - 规则匹配测试

- [ ] **集成测试**
  - 端到端脱敏测试
  - 截图脱敏测试

- [ ] **文档**
  - 内置规则说明
  - 自定义规则指南
  - 最佳实践

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── masking/
│   ├── services/
│   │   ├── detectorEngine.ts    # 检测引擎
│   │   ├── maskerEngine.ts      # 脱敏引擎
│   │   ├── ruleManager.ts       # 规则管理
│   │   ├── imageMasker.ts       # 截图脱敏
│   │   ├── logMasker.ts         # 日志脱敏
│   │   ├── ocrEngine.ts         # OCR 引擎
│   │   ├── regionDetector.ts    # 区域检测
│   │   ├── maskingMethods.ts    # 脱敏方法
│   │   └── whitelistManager.ts  # 白名单管理
│   ├── rules/
│   │   └── builtInRules.ts      # 内置规则
│   ├── components/
│   │   ├── RuleList.tsx         # 规则列表
│   │   ├── RuleEditor.tsx       # 规则编辑
│   │   ├── RuleTester.tsx       # 规则测试
│   │   └── WhitelistManager.tsx # 白名单管理
│   └── types/
│       └── masking.ts           # 类型定义
```

## 验收标准

1. 敏感数据识别准确率 > 95%
2. 文本脱敏性能 < 10ms/KB
3. 截图脱敏性能 < 500ms/张
4. 内置规则覆盖常见敏感类型
5. 自定义规则功能完整
6. 集成到执行流程无感知
