# 自然语言调试助手 - 任务清单

## Phase 1: 对话核心

- [ ] **对话管理器** (`services/conversationManager.ts`)
  - 消息状态管理
  - 多轮对话支持
  - 上下文维护

- [ ] **上下文构建器** (`services/contextBuilder.ts`)
  - 调试上下文采集
  - 动态上下文补充
  - 系统提示生成

- [ ] **响应解析器** (`services/responseParser.ts`)
  - 动作指令解析
  - 修复建议提取
  - 格式化处理

## Phase 2: 动作系统

- [ ] **动作执行器** (`services/actionExecutor.ts`)
  - 动作类型注册
  - 执行调度
  - 结果反馈

- [ ] **页面操作** (`actions/pageActions.ts`)
  - 点击/输入/滚动
  - 页面刷新
  - 等待

- [ ] **元素高亮** (`actions/highlightAction.ts`)
  - 元素定位
  - 高亮样式
  - 批量高亮

- [ ] **截图对比** (`actions/compareAction.ts`)
  - 截图采集
  - 差异计算
  - 变化标注

## Phase 3: 修复系统

- [ ] **修复建议生成** (`services/fixSuggestionGenerator.ts`)
  - 基于错误类型生成
  - 置信度计算
  - 代码生成

- [ ] **修复应用器** (`services/fixApplier.ts`)
  - 脚本修改
  - 重试执行
  - 结果验证

- [ ] **知识库** (`services/knowledgeBase.ts`)
  - 案例存储
  - 模式匹配
  - 学习积累

## Phase 4: LLM 集成

- [ ] **LLM 引擎** (`services/llmEngine.ts`)
  - Midscene AI 封装
  - 流式响应
  - 错误重试

- [ ] **提示模板** (`prompts/`)
  - 系统提示
  - 错误分析提示
  - 修复建议提示

- [ ] **指代消解** (`services/referenceResolver.ts`)
  - 代词识别
  - 上下文关联
  - 实体替换

## Phase 5: UI 组件

- [ ] **调试助手面板** (`components/DebugAssistant.tsx`)
  - 面板布局
  - 最小化/展开
  - 拖拽定位

- [ ] **消息气泡** (`components/MessageBubble.tsx`)
  - 用户消息
  - 助手消息
  - 加载状态

- [ ] **修复建议卡片** (`components/FixSuggestionCard.tsx`)
  - 建议展示
  - 代码预览
  - 应用按钮

- [ ] **快捷问题按钮** (`components/QuickQuestions.tsx`)
  - 常用问题
  - 一键提问
  - 动态推荐

## Phase 6: 集成与优化

- [ ] **ExecutionEngine 集成**
  - 失败自动触发
  - 上下文传递
  - 修复回调

- [ ] **性能优化**
  - 响应流式显示
  - 截图压缩
  - 缓存策略

- [ ] **测试与文档**
  - 对话测试
  - 动作测试
  - 用户指南

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── services/
│   ├── conversationManager.ts   # 对话管理
│   ├── contextBuilder.ts        # 上下文构建
│   ├── responseParser.ts        # 响应解析
│   ├── actionExecutor.ts        # 动作执行
│   ├── fixSuggestionGenerator.ts # 修复建议
│   ├── fixApplier.ts            # 修复应用
│   ├── knowledgeBase.ts         # 知识库
│   ├── llmEngine.ts             # LLM 引擎
│   └── referenceResolver.ts     # 指代消解
├── actions/
│   ├── pageActions.ts           # 页面操作
│   ├── highlightAction.ts       # 元素高亮
│   └── compareAction.ts         # 截图对比
├── prompts/
│   ├── system.ts                # 系统提示
│   ├── errorAnalysis.ts         # 错误分析
│   └── fixSuggestion.ts         # 修复建议
├── components/
│   ├── DebugAssistant.tsx       # 调试面板
│   ├── MessageBubble.tsx        # 消息气泡
│   ├── FixSuggestionCard.tsx    # 修复卡片
│   └── QuickQuestions.tsx       # 快捷问题
└── types/
    └── debugAssistant.ts        # 类型定义
```

## 验收标准

1. 普通查询响应 < 5s
2. 页面分析响应 < 10s
3. 问题原因分析准确率 > 70%
4. 修复建议有效率 > 60%
5. 支持 10+ 轮连续对话
6. 知识库自动学习生效
