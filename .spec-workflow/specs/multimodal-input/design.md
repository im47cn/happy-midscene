# 多模态输入 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**降低门槛，智能理解**
- 支持多种自然输入方式
- AI 智能理解用户意图
- 无缝转换为标准测试用例

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| Markdown 解析器 | 作为统一输出格式 |
| AI 视觉识别 | 复用于元素识别 |
| 用例编辑器 | 集成多模态输入 |
| 执行引擎 | 无需修改 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Multimodal Input System                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  InputManager    │     │  IntentParser    │              │
│  │   (输入管理器)    │────▶│   (意图解析器)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│  ┌────────┴─────────────────────────┴───────┐               │
│  │            Input Processors              │               │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │               │
│  │  │Voice │  │Gesture│  │Screen│  │Image │ │               │
│  │  └──────┘  └──────┘  └──────┘  └──────┘ │               │
│  └──────────────────────────────────────────┘               │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  TestGenerator   │     │ TemplateManager  │              │
│  │   (测试生成器)    │◀───▶│   (模板管理器)   │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │ MarkdownOutput│  ← 统一输出格式
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **InputManager** | 统一管理多种输入源 |
| **IntentParser** | 解析用户输入的测试意图 |
| **VoiceProcessor** | 处理语音输入 |
| **GestureRecorder** | 录制用户手势操作 |
| **ScreenAnalyzer** | 分析屏幕录制视频 |
| **ImageAnnotator** | 处理截图标注 |
| **TestGenerator** | 生成测试用例 |
| **TemplateManager** | 管理快速模板 |

---

## 3. 核心数据结构

### 3.1 输入数据

```typescript
interface MultimodalInput {
  id: string;
  type: InputType;
  timestamp: number;
  data: InputData;
  metadata: InputMetadata;
}

type InputType =
  | 'voice'
  | 'gesture'
  | 'screen_recording'
  | 'screenshot'
  | 'natural_language'
  | 'template';

interface InputData {
  // 语音输入
  voice?: {
    audioBlob: Blob;
    transcript?: string;
    language: string;
    duration: number;
  };

  // 手势录制
  gesture?: {
    events: GestureEvent[];
    screenshots: Screenshot[];
    duration: number;
  };

  // 屏幕录制
  screenRecording?: {
    videoBlob: Blob;
    duration: number;
    resolution: Resolution;
  };

  // 截图标注
  screenshot?: {
    imageData: string;
    annotations: Annotation[];
  };

  // 自然语言
  naturalLanguage?: {
    text: string;
    language: string;
  };
}

interface InputMetadata {
  source: string;
  deviceInfo: DeviceInfo;
  context: InputContext;
}
```

### 3.2 意图表示

```typescript
interface TestIntent {
  id: string;
  type: IntentType;
  confidence: number;
  entities: Entity[];
  actions: IntentAction[];
  assertions: IntentAssertion[];
}

type IntentType =
  | 'navigation'
  | 'form_fill'
  | 'click_action'
  | 'verification'
  | 'data_extraction'
  | 'flow_test';

interface Entity {
  type: EntityType;
  value: string;
  confidence: number;
  position?: TextPosition;
}

type EntityType =
  | 'element'
  | 'text_value'
  | 'url'
  | 'action_verb'
  | 'assertion_type';

interface IntentAction {
  type: ActionType;
  target: string;
  value?: string;
  order: number;
}

interface IntentAssertion {
  type: AssertionType;
  target: string;
  expected: string;
}
```

### 3.3 手势事件

```typescript
interface GestureEvent {
  type: GestureType;
  timestamp: number;
  target: ElementInfo;
  coordinates: Coordinates;
  value?: string;
  screenshot?: string;
}

type GestureType =
  | 'click'
  | 'double_click'
  | 'right_click'
  | 'input'
  | 'scroll'
  | 'drag'
  | 'hover';

interface ElementInfo {
  description: string;       // AI 生成的语义描述
  selector?: string;         // 技术选择器（可选）
  boundingBox: BoundingBox;
  screenshot: string;        // 元素截图
}
```

### 3.4 截图标注

```typescript
interface Annotation {
  id: string;
  type: AnnotationType;
  region: Region;
  action: AnnotationAction;
  description: string;
}

type AnnotationType =
  | 'click'
  | 'input'
  | 'assert'
  | 'scroll'
  | 'wait';

interface AnnotationAction {
  type: string;
  params: Record<string, any>;
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

---

## 4. 核心流程

### 4.1 语音输入流程

```
语音开始录制
      │
      ▼
┌─────────────────────────┐
│ 1. 实时语音转写         │
│    - 流式识别           │
│    - 实时显示文本       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 语音结束处理         │
│    - 完整文本           │
│    - 语言检测           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 意图解析             │
│    - NLP 分析           │
│    - 实体提取           │
│    - 动作识别           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 测试生成             │
│    - 步骤构建           │
│    - Markdown 格式化    │
└───────────┬─────────────┘
            │
            ▼
   输出测试用例
```

### 4.2 手势录制流程

```
开始录制
      │
      ▼
┌─────────────────────────┐
│ 1. 事件监听             │
│    - 点击事件           │
│    - 输入事件           │
│    - 滚动事件           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 元素识别             │
│    - AI 视觉定位        │
│    - 语义描述生成       │
│    - 截图保存           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 事件去重             │
│    - 合并重复点击       │
│    - 合并连续输入       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 步骤生成             │
│    - 转换为测试步骤     │
│    - 添加等待和断言     │
└───────────┬─────────────┘
            │
            ▼
   结束录制，输出用例
```

### 4.3 屏幕录制分析流程

```
视频输入
      │
      ▼
┌─────────────────────────┐
│ 1. 关键帧提取           │
│    - 场景变化检测       │
│    - 帧差异分析         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 操作识别             │
│    - 鼠标轨迹分析       │
│    - 点击位置检测       │
│    - 输入内容识别       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 元素匹配             │
│    - AI 视觉定位        │
│    - 语义描述           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 时间线构建           │
│    - 操作序列           │
│    - 时间戳对齐         │
└───────────┬─────────────┘
            │
            ▼
   输出操作列表
```

---

## 5. 语音识别

### 5.1 语音识别集成

```typescript
class VoiceProcessor {
  private recognition: SpeechRecognition;

  async startRecording(): Promise<void> {
    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'zh-CN';

    this.recognition.onresult = (event) => {
      const transcript = this.processResult(event);
      this.emit('transcript', transcript);
    };

    this.recognition.start();
  }

  async stopRecording(): Promise<VoiceInput> {
    this.recognition.stop();
    return this.finalizeInput();
  }
}
```

### 5.2 意图解析

```typescript
class IntentParser {
  async parse(text: string): Promise<TestIntent> {
    // 使用 AI 模型解析意图
    const response = await this.aiModel.parse({
      prompt: `
        分析以下测试描述，提取测试意图：
        "${text}"

        输出格式：
        {
          "actions": [
            {"type": "navigate", "target": "URL/页面"},
            {"type": "click", "target": "元素描述"},
            {"type": "input", "target": "元素描述", "value": "值"},
            {"type": "assert", "target": "元素描述", "expected": "期望值"}
          ]
        }
      `,
    });

    return this.buildIntent(response);
  }
}
```

---

## 6. API 设计

### 6.1 InputManager

```typescript
interface IInputManager {
  startVoiceInput(): Promise<void>;
  stopVoiceInput(): Promise<VoiceInput>;

  startGestureRecording(): Promise<void>;
  pauseGestureRecording(): Promise<void>;
  stopGestureRecording(): Promise<GestureRecording>;

  analyzeScreenRecording(video: Blob): Promise<OperationList>;

  processAnnotations(
    screenshot: string,
    annotations: Annotation[]
  ): Promise<TestCase>;

  parseNaturalLanguage(text: string): Promise<TestCase>;
}
```

### 6.2 IntentParser

```typescript
interface IIntentParser {
  parse(input: MultimodalInput): Promise<TestIntent>;

  clarify(intent: TestIntent, question: string): Promise<TestIntent>;

  validate(intent: TestIntent): ValidationResult;
}
```

### 6.3 TestGenerator

```typescript
interface ITestGenerator {
  generate(intent: TestIntent): Promise<TestCase>;

  generateFromGestures(gestures: GestureEvent[]): Promise<TestCase>;

  generateFromTemplate(
    templateId: string,
    params: Record<string, any>
  ): Promise<TestCase>;

  toMarkdown(testCase: TestCase): string;
}
```

---

## 7. 集成方案

### 7.1 与用例编辑器集成

```typescript
// 在编辑器中添加多模态输入按钮
const EditorWithMultimodal = () => {
  const [isRecording, setIsRecording] = useState(false);

  const handleVoiceInput = async () => {
    setIsRecording(true);
    await inputManager.startVoiceInput();
  };

  const handleVoiceComplete = async () => {
    const voiceInput = await inputManager.stopVoiceInput();
    const testCase = await testGenerator.generate(
      await intentParser.parse(voiceInput)
    );
    appendToEditor(testCase);
    setIsRecording(false);
  };

  return (
    <Editor>
      <Toolbar>
        <VoiceButton
          recording={isRecording}
          onStart={handleVoiceInput}
          onStop={handleVoiceComplete}
        />
        <GestureRecordButton />
        <ScreenRecordButton />
        <AnnotateButton />
      </Toolbar>
    </Editor>
  );
};
```

### 7.2 与现有解析器集成

```typescript
// 多模态输入最终输出 Markdown，复用现有解析器
class MultimodalTestCreator {
  async createFromInput(input: MultimodalInput): Promise<TestCase> {
    // 解析意图
    const intent = await this.intentParser.parse(input);

    // 生成测试用例
    const testCase = await this.testGenerator.generate(intent);

    // 转换为 Markdown
    const markdown = this.testGenerator.toMarkdown(testCase);

    // 使用现有解析器验证
    return this.markdownParser.parse(markdown);
  }
}
```

---

## 8. 模板系统

### 8.1 内置模板

```typescript
const builtInTemplates: Template[] = [
  {
    id: 'login',
    name: '登录测试',
    description: '测试用户登录功能',
    fields: [
      { name: 'username', label: '用户名', type: 'text' },
      { name: 'password', label: '密码', type: 'password' },
      { name: 'successUrl', label: '成功跳转页面', type: 'url' },
    ],
    template: `
## 登录测试

### 正常登录
- 输入 "{{username}}" 到 [用户名输入框]
- 输入 "{{password}}" 到 [密码输入框]
- 点击 [登录按钮]
- 验证跳转到 "{{successUrl}}"

### 错误密码登录
- 输入 "{{username}}" 到 [用户名输入框]
- 输入 "wrong_password" 到 [密码输入框]
- 点击 [登录按钮]
- 验证显示 [错误提示]
    `,
  },
  // ... 更多模板
];
```

---

## 9. 优势总结

1. **低门槛**：非技术人员可轻松创建测试
2. **多方式**：支持语音、手势、录制等多种输入
3. **智能理解**：AI 自动理解测试意图
4. **无缝集成**：输出标准 Markdown 格式
5. **模板加速**：常用场景快速生成
