# 测试数据智能生成 技术方案设计文档

## 1. 设计原则

### 1.1 核心理念

**语义驱动，规则约束**
- 基于字段语义智能识别数据类型
- 通过规则引擎保证数据合规性
- 支持自定义扩展和模板复用

### 1.2 与现有系统的关系

| 现有功能 | 扩展方式 |
|----------|----------|
| AI 视觉识别 | 复用于表单字段识别 |
| 执行引擎 | 集成数据填充能力 |
| 历史记录 | 存储生成的测试数据 |
| 报告生成 | 使用脱敏数据展示 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Smart Data Generation System                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  FieldRecognizer │     │   DataGenerator  │              │
│  │   (字段识别器)    │────▶│   (数据生成器)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │  SemanticParser  │     │  BoundaryEngine  │              │
│  │   (语义解析器)    │     │   (边界值引擎)    │              │
│  └────────┬─────────┘     └────────┬─────────┘              │
│           │                        │                        │
│           ▼                        ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐              │
│  │   DataMasker     │     │  TemplateManager │              │
│  │   (数据脱敏器)    │     │   (模板管理器)   │              │
│  └──────────────────┘     └──────────────────┘              │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
    ┌───────────────┐
    │ ExecutionEngine│  ← 集成到执行引擎
    └───────────────┘
```

### 2.2 模块职责

| 模块 | 职责 |
|------|------|
| **FieldRecognizer** | 识别表单字段类型和约束 |
| **SemanticParser** | 解析字段语义含义 |
| **DataGenerator** | 生成符合规则的测试数据 |
| **BoundaryEngine** | 生成边界值测试数据 |
| **DataMasker** | 敏感数据脱敏处理 |
| **TemplateManager** | 管理数据生成模板 |

---

## 3. 核心数据结构

### 3.1 字段定义

```typescript
interface FieldDefinition {
  id: string;
  name: string;                      // 字段名称
  label: string;                     // 显示标签
  fieldType: FieldType;              // 字段类型
  semanticType: SemanticType;        // 语义类型
  constraints: FieldConstraints;     // 约束条件
  metadata: Record<string, any>;     // 扩展元数据
}

type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'datetime'
  | 'password'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'textarea'
  | 'file';

type SemanticType =
  | 'username'
  | 'realname'
  | 'nickname'
  | 'email'
  | 'mobile_phone'
  | 'landline'
  | 'password'
  | 'captcha'
  | 'id_card'
  | 'bank_card'
  | 'address'
  | 'postal_code'
  | 'city'
  | 'province'
  | 'country'
  | 'date_of_birth'
  | 'amount'
  | 'quantity'
  | 'description'
  | 'url'
  | 'custom';

interface FieldConstraints {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;                  // 正则表达式
  format?: string;                   // 格式说明
  options?: string[];                // 可选值列表
}
```

### 3.2 生成规则

```typescript
interface GenerationRule {
  id: string;
  name: string;
  semanticType: SemanticType;
  generator: GeneratorConfig;
  variations: VariationConfig[];
  locale?: string;                   // 地区设置
}

interface GeneratorConfig {
  type: 'pattern' | 'faker' | 'pool' | 'custom';
  pattern?: string;                  // 生成模式
  fakerMethod?: string;              // Faker.js 方法
  poolId?: string;                   // 数据池 ID
  customFn?: string;                 // 自定义函数名
  params?: Record<string, any>;      // 生成参数
}

interface VariationConfig {
  name: string;
  description: string;
  modifier: (value: any) => any;
}
```

### 3.3 数据模板

```typescript
interface DataTemplate {
  id: string;
  name: string;
  description: string;
  fields: TemplateField[];
  variables: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

interface TemplateField {
  fieldId: string;
  fieldName: string;
  generationType: 'fixed' | 'random' | 'pool' | 'variable';
  fixedValue?: any;
  generatorId?: string;
  poolId?: string;
  variableName?: string;
}
```

### 3.4 边界值配置

```typescript
interface BoundaryConfig {
  fieldId: string;
  constraints: FieldConstraints;
  testCases: BoundaryTestCase[];
}

interface BoundaryTestCase {
  name: string;
  value: any;
  expectedResult: 'valid' | 'invalid';
  description: string;
}
```

### 3.5 脱敏规则

```typescript
interface MaskingRule {
  id: string;
  semanticType: SemanticType;
  strategy: MaskingStrategy;
  pattern: string;                   // 脱敏模式
  replacement: string;               // 替换字符
}

type MaskingStrategy =
  | 'partial'                        // 部分遮盖
  | 'full'                           // 完全遮盖
  | 'hash'                           // 哈希处理
  | 'substitute'                     // 替换处理
  | 'shuffle';                       // 打乱处理
```

---

## 4. 核心流程

### 4.1 字段识别流程

```
表单截图/DOM
      │
      ▼
┌─────────────────────────┐
│ 1. 视觉识别字段         │
│    - 标签文本提取       │
│    - 输入框类型识别     │
│    - 占位符文本提取     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 语义分析             │
│    - 关键词匹配         │
│    - 上下文推断         │
│    - AI 语义理解        │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 约束提取             │
│    - HTML 属性解析      │
│    - 验证规则识别       │
│    - 模式推断           │
└───────────┬─────────────┘
            │
            ▼
   输出 FieldDefinition
```

### 4.2 数据生成流程

```
FieldDefinition
      │
      ▼
┌─────────────────────────┐
│ 1. 选择生成规则         │
│    - 匹配语义类型       │
│    - 应用约束条件       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 生成基础数据         │
│    - 执行生成器         │
│    - 应用变体规则       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 验证数据             │
│    - 格式验证           │
│    - 约束检查           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 4. 应用脱敏（可选）     │
│    - 检查敏感类型       │
│    - 执行脱敏策略       │
└───────────┬─────────────┘
            │
            ▼
   输出测试数据
```

### 4.3 边界值生成流程

```
FieldConstraints
      │
      ▼
┌─────────────────────────┐
│ 1. 分析约束类型         │
│    - 长度约束           │
│    - 数值约束           │
│    - 格式约束           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. 生成边界值           │
│    - 最小有效值         │
│    - 最大有效值         │
│    - 边界-1 值          │
│    - 边界+1 值          │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. 生成特殊值           │
│    - 空值               │
│    - 特殊字符           │
│    - 极端值             │
└───────────┬─────────────┘
            │
            ▼
   输出 BoundaryTestCase[]
```

---

## 5. 数据生成器

### 5.1 内置生成器

```typescript
// 中国手机号生成器
const mobilePhoneGenerator = {
  type: 'pattern',
  pattern: '1[3-9]\\d{9}',
  locale: 'zh-CN',
};

// 邮箱生成器
const emailGenerator = {
  type: 'faker',
  fakerMethod: 'internet.email',
  params: { provider: 'example.com' },
};

// 中国身份证生成器
const idCardGenerator = {
  type: 'custom',
  customFn: 'generateChineseIdCard',
  params: { startYear: 1960, endYear: 2005 },
};
```

### 5.2 生成器注册

```typescript
class GeneratorRegistry {
  private generators: Map<string, Generator>;

  register(id: string, generator: Generator): void;
  get(id: string): Generator | undefined;
  generateForField(field: FieldDefinition): any;
}
```

---

## 6. API 设计

### 6.1 FieldRecognizer

```typescript
interface IFieldRecognizer {
  recognizeFields(
    screenshot: string,
    options?: RecognizeOptions
  ): Promise<FieldDefinition[]>;

  recognizeFieldType(
    label: string,
    placeholder?: string
  ): FieldType;

  recognizeSemanticType(
    label: string,
    context?: string
  ): SemanticType;
}
```

### 6.2 DataGenerator

```typescript
interface IDataGenerator {
  generate(
    field: FieldDefinition,
    options?: GenerateOptions
  ): Promise<any>;

  generateForForm(
    fields: FieldDefinition[]
  ): Promise<Record<string, any>>;

  generateBoundaryValues(
    field: FieldDefinition
  ): Promise<BoundaryTestCase[]>;
}

interface GenerateOptions {
  locale?: string;
  variation?: string;
  seed?: number;
}
```

### 6.3 DataMasker

```typescript
interface IDataMasker {
  mask(
    value: any,
    semanticType: SemanticType
  ): string;

  maskRecord(
    record: Record<string, any>,
    fieldTypes: Record<string, SemanticType>
  ): Record<string, any>;

  isSensitive(semanticType: SemanticType): boolean;
}
```

### 6.4 TemplateManager

```typescript
interface ITemplateManager {
  create(template: Omit<DataTemplate, 'id'>): Promise<DataTemplate>;
  update(id: string, updates: Partial<DataTemplate>): Promise<void>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<DataTemplate | null>;
  list(): Promise<DataTemplate[]>;
  applyTemplate(
    templateId: string,
    variables?: Record<string, any>
  ): Promise<Record<string, any>>;
}
```

---

## 7. 集成方案

### 7.1 与执行引擎集成

```typescript
// 执行输入步骤时自动生成数据
class SmartInputExecutor {
  async executeInput(step: InputStep): Promise<void> {
    // 识别字段
    const field = await fieldRecognizer.recognizeField(step.target);

    // 生成数据（如果未指定）
    const value = step.value || await dataGenerator.generate(field);

    // 执行输入
    await this.type(step.target, value);

    // 记录使用的数据（脱敏后）
    this.recordData(field, dataMasker.mask(value, field.semanticType));
  }
}
```

### 7.2 与测试用例集成

```typescript
// 在 Markdown 中使用数据生成
const markdown = `
## 用户注册测试

- 输入 [自动生成:手机号] 到 [手机号输入框]
- 输入 [自动生成:密码] 到 [密码输入框]
- 输入 [模板:标准用户.邮箱] 到 [邮箱输入框]
`;
```

---

## 8. 数据池

### 8.1 内置数据池

```typescript
const builtInPools = {
  'cn_provinces': ['北京', '上海', '广东', ...],
  'cn_cities': ['北京市', '上海市', '广州市', ...],
  'cn_surnames': ['张', '王', '李', '赵', ...],
  'cn_given_names': ['伟', '芳', '娜', '敏', ...],
  'email_domains': ['gmail.com', 'qq.com', '163.com', ...],
};
```

### 8.2 自定义数据池

```typescript
interface DataPool {
  id: string;
  name: string;
  description: string;
  values: any[];
  pickStrategy: 'random' | 'sequential' | 'shuffle';
}
```

---

## 9. 脱敏策略

### 9.1 预置脱敏规则

| 语义类型 | 脱敏策略 | 示例 |
|----------|----------|------|
| mobile_phone | partial | 138****5678 |
| id_card | partial | 110101********1234 |
| bank_card | partial | 6222****7890 |
| email | partial | t***@example.com |
| realname | partial | 张*三 |
| password | full | ******** |

### 9.2 脱敏实现

```typescript
function maskMobilePhone(value: string): string {
  return value.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function maskIdCard(value: string): string {
  return value.replace(/^(\d{6})\d{8}(\d{4})$/, '$1********$2');
}
```

---

## 10. 优势总结

1. **智能识别**：基于 AI 视觉自动识别字段类型
2. **合规生成**：确保生成数据符合格式和业务规则
3. **边界覆盖**：自动生成边界值测试数据
4. **安全脱敏**：敏感数据自动脱敏处理
5. **灵活扩展**：支持自定义生成器和数据池
6. **模板复用**：数据模板可保存和复用
