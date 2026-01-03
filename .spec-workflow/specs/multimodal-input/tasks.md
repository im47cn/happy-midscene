# 多模态输入 - 任务清单

## 设计决策

**采用统一输入管理 + AI 意图解析方案**：支持多种输入方式，通过 AI 理解用户意图并生成标准测试用例。

核心特点：
- 支持语音、手势、录制等多种输入
- AI 智能意图理解
- 统一输出 Markdown 格式
- 模板快速生成

---

## Phase 1: 类型定义与基础设施

### 1.1 类型定义
- [ ] **类型文件** (`types/multimodal.ts`)
  - `MultimodalInput` 接口
  - `InputType` 类型
  - `TestIntent` 接口
  - `GestureEvent` 接口
  - `Annotation` 接口
  - `Template` 接口

### 1.2 输入管理器
- [ ] **InputManager** (`services/multimodal/inputManager.ts`)
  - 输入源注册
  - 输入事件分发
  - 状态管理

---

## Phase 2: 语音输入

### 2.1 语音处理器
- [ ] **VoiceProcessor** (`services/multimodal/voiceProcessor.ts`)
  - `startRecording()` 开始录音
  - `stopRecording()` 停止录音
  - `getTranscript()` 获取转写文本
  - 流式识别支持

### 2.2 语音识别集成
- [ ] **SpeechRecognition** (`services/multimodal/speechRecognition.ts`)
  - Web Speech API 封装
  - 多语言支持
  - 错误处理

### 2.3 语音 UI
- [ ] **VoiceInputButton** (`components/VoiceInputButton.tsx`)
  - 录音状态指示
  - 实时转写显示
  - 音量可视化

---

## Phase 3: 意图解析

### 3.1 意图解析器
- [ ] **IntentParser** (`services/multimodal/intentParser.ts`)
  - `parse(input)` 解析意图
  - `clarify(intent, question)` 澄清意图
  - `validate(intent)` 验证意图
  - AI 模型集成

### 3.2 实体提取
- [ ] **EntityExtractor** (`services/multimodal/entityExtractor.ts`)
  - 元素实体提取
  - 动作实体提取
  - 值实体提取

### 3.3 动作识别
- [ ] **ActionRecognizer** (`services/multimodal/actionRecognizer.ts`)
  - 动作类型识别
  - 动作序列构建
  - 断言生成

---

## Phase 4: 手势录制

### 4.1 手势录制器
- [ ] **GestureRecorder** (`services/multimodal/gestureRecorder.ts`)
  - `start()` 开始录制
  - `pause()` 暂停录制
  - `resume()` 继续录制
  - `stop()` 停止录制
  - 事件监听和捕获

### 4.2 事件处理
- [ ] **EventProcessor** (`services/multimodal/eventProcessor.ts`)
  - 点击事件处理
  - 输入事件处理
  - 滚动事件处理
  - 事件去重和合并

### 4.3 元素识别
- [ ] **ElementRecognizer** (`services/multimodal/elementRecognizer.ts`)
  - AI 视觉定位
  - 语义描述生成
  - 截图保存

### 4.4 录制 UI
- [ ] **GestureRecordPanel** (`components/GestureRecordPanel.tsx`)
  - 录制控制按钮
  - 事件列表预览
  - 编辑和删除操作

---

## Phase 5: 屏幕录制分析

### 5.1 视频分析器
- [ ] **ScreenAnalyzer** (`services/multimodal/screenAnalyzer.ts`)
  - `analyze(video)` 分析视频
  - `extractKeyFrames()` 提取关键帧
  - `detectOperations()` 检测操作

### 5.2 关键帧提取
- [ ] **KeyFrameExtractor** (`services/multimodal/keyFrameExtractor.ts`)
  - 场景变化检测
  - 帧差异分析
  - 关键帧选择

### 5.3 操作检测
- [ ] **OperationDetector** (`services/multimodal/operationDetector.ts`)
  - 鼠标轨迹分析
  - 点击位置检测
  - 输入内容 OCR

### 5.4 分析 UI
- [ ] **ScreenRecordAnalyzer** (`components/ScreenRecordAnalyzer.tsx`)
  - 视频预览
  - 操作时间线
  - 操作编辑

---

## Phase 6: 截图标注

### 6.1 图像标注器
- [ ] **ImageAnnotator** (`services/multimodal/imageAnnotator.ts`)
  - `addAnnotation(region, type)` 添加标注
  - `removeAnnotation(id)` 删除标注
  - `exportAnnotations()` 导出标注

### 6.2 标注处理
- [ ] **AnnotationProcessor** (`services/multimodal/annotationProcessor.ts`)
  - 标注转测试步骤
  - 区域到元素描述
  - 标注验证

### 6.3 标注 UI
- [ ] **AnnotationCanvas** (`components/AnnotationCanvas.tsx`)
  - 图片展示
  - 标注绘制工具
  - 标注属性编辑

---

## Phase 7: 测试生成

### 7.1 测试生成器
- [ ] **TestGenerator** (`services/multimodal/testGenerator.ts`)
  - `generate(intent)` 从意图生成
  - `generateFromGestures(gestures)` 从手势生成
  - `generateFromTemplate(id, params)` 从模板生成
  - `toMarkdown(testCase)` 转 Markdown

### 7.2 步骤构建器
- [ ] **StepBuilder** (`services/multimodal/stepBuilder.ts`)
  - 步骤创建
  - 步骤排序
  - 等待步骤插入
  - 断言步骤添加

### 7.3 Markdown 格式化
- [ ] **MarkdownFormatter** (`services/multimodal/markdownFormatter.ts`)
  - 测试用例格式化
  - 场景分组
  - 注释生成

---

## Phase 8: 模板系统

### 8.1 模板管理器
- [ ] **TemplateManager** (`services/multimodal/templateManager.ts`)
  - `getTemplate(id)` 获取模板
  - `listTemplates()` 列出模板
  - `createTemplate(template)` 创建模板
  - `applyTemplate(id, params)` 应用模板

### 8.2 内置模板
- [ ] **内置模板** (`services/multimodal/templates/`)
  - `loginTemplate.ts` 登录模板
  - `formTemplate.ts` 表单模板
  - `listTemplate.ts` 列表模板
  - `searchTemplate.ts` 搜索模板

### 8.3 模板 UI
- [ ] **TemplateSelector** (`components/TemplateSelector.tsx`)
  - 模板列表
  - 模板预览
  - 参数填写表单

---

## Phase 9: 编辑器集成

### 9.1 编辑器扩展
- [ ] **MultimodalEditorToolbar** (`components/MultimodalEditorToolbar.tsx`)
  - 语音输入按钮
  - 手势录制按钮
  - 屏幕录制按钮
  - 截图标注按钮
  - 模板选择按钮

### 9.2 输入预览
- [ ] **InputPreview** (`components/InputPreview.tsx`)
  - 实时预览生成的测试
  - 编辑和调整
  - 确认插入

---

## Phase 10: 测试

### 10.1 单元测试
- [ ] `voiceProcessor.test.ts` - 语音处理测试
- [ ] `intentParser.test.ts` - 意图解析测试
- [ ] `gestureRecorder.test.ts` - 手势录制测试
- [ ] `testGenerator.test.ts` - 测试生成测试
- [ ] `templateManager.test.ts` - 模板管理测试

### 10.2 集成测试
- [ ] 语音到测试端到端测试
- [ ] 手势录制到测试测试
- [ ] 模板应用测试

---

## 文件结构

```
apps/chrome-extension/src/extension/ai-test-generator/
├── types/
│   └── multimodal.ts                # 类型定义
├── services/
│   ├── multimodal/
│   │   ├── index.ts                 # 模块导出
│   │   ├── inputManager.ts          # 输入管理
│   │   ├── voiceProcessor.ts        # 语音处理
│   │   ├── speechRecognition.ts     # 语音识别
│   │   ├── intentParser.ts          # 意图解析
│   │   ├── entityExtractor.ts       # 实体提取
│   │   ├── actionRecognizer.ts      # 动作识别
│   │   ├── gestureRecorder.ts       # 手势录制
│   │   ├── eventProcessor.ts        # 事件处理
│   │   ├── elementRecognizer.ts     # 元素识别
│   │   ├── screenAnalyzer.ts        # 屏幕分析
│   │   ├── keyFrameExtractor.ts     # 关键帧提取
│   │   ├── operationDetector.ts     # 操作检测
│   │   ├── imageAnnotator.ts        # 图像标注
│   │   ├── annotationProcessor.ts   # 标注处理
│   │   ├── testGenerator.ts         # 测试生成
│   │   ├── stepBuilder.ts           # 步骤构建
│   │   ├── markdownFormatter.ts     # Markdown 格式化
│   │   ├── templateManager.ts       # 模板管理
│   │   ├── templates/               # 内置模板
│   │   │   ├── loginTemplate.ts
│   │   │   ├── formTemplate.ts
│   │   │   └── ...
│   │   └── __tests__/
│   │       ├── voiceProcessor.test.ts
│   │       └── ...
└── components/
    ├── VoiceInputButton.tsx         # 语音输入按钮
    ├── GestureRecordPanel.tsx       # 手势录制面板
    ├── ScreenRecordAnalyzer.tsx     # 屏幕录制分析
    ├── AnnotationCanvas.tsx         # 标注画布
    ├── TemplateSelector.tsx         # 模板选择器
    ├── MultimodalEditorToolbar.tsx  # 编辑器工具栏
    └── InputPreview.tsx             # 输入预览
```

---

## 依赖关系

```
types/multimodal.ts
       │
       ▼
inputManager.ts
       │
       ├─────────────────────────────────────┐
       ▼                                     ▼
voiceProcessor.ts              gestureRecorder.ts
       │                               │
       ▼                               ▼
speechRecognition.ts           eventProcessor.ts
       │                               │
       └─────────┬─────────────────────┘
                 ▼
         intentParser.ts ◀── entityExtractor.ts
                 │            actionRecognizer.ts
                 ▼
         testGenerator.ts ◀── stepBuilder.ts
                 │              markdownFormatter.ts
                 │              templateManager.ts
                 ▼
    components/MultimodalEditorToolbar.tsx
```

---

## 验收标准

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 语音识别准确率 | > 95% | 待开发 |
| 意图识别准确率 | > 85% | 待开发 |
| 操作识别准确率 | > 90% | 待开发 |
| 录制延迟 | < 100ms | 待开发 |

---

## 实现进度

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 1 | 待开始 | 类型定义与基础设施 |
| Phase 2 | 待开始 | 语音输入 |
| Phase 3 | 待开始 | 意图解析 |
| Phase 4 | 待开始 | 手势录制 |
| Phase 5 | 待开始 | 屏幕录制分析 |
| Phase 6 | 待开始 | 截图标注 |
| Phase 7 | 待开始 | 测试生成 |
| Phase 8 | 待开始 | 模板系统 |
| Phase 9 | 待开始 | 编辑器集成 |
| Phase 10 | 待开始 | 测试 |
