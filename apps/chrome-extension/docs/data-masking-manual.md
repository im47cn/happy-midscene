# 敏感数据脱敏 - 用户手册

## 功能概述

敏感数据脱敏（Data Masking）是 AI Test Generator 的安全防护功能，用于保护测试过程中涉及的敏感信息。系统会自动检测并脱敏密码、Token、个人隐私等敏感数据，确保截图、日志、报告中不会泄露机密信息。

### 核心能力

- **自动检测**：识别密码、手机号、身份证、邮箱、API Key 等敏感数据
- **多种脱敏方式**：完全遮盖、部分保留、哈希替换、占位符替换
- **多场景覆盖**：文本脱敏、日志脱敏、截图脱敏、YAML 脱敏
- **自定义规则**：支持添加自定义脱敏规则
- **白名单机制**：排除不需要脱敏的测试数据

## 工作原理

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Masking System                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  输入数据                                                    │
│      │                                                      │
│      ▼                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Detector   │───▶│   Masker     │───▶│   Output     │  │
│  │   Engine     │    │   Engine     │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                       │          │
│         │ 规则库                                │          │
│         └─────────────┬─────────────────────────┘          │
│                       │                                    │
│                  ┌────▼────┐                               │
│                  │  Rule   │                               │
│                  │ Manager │                               │
│                  └─────────┘                               │
│                                                             │
│  内置规则：密码、手机号、身份证、邮箱、API Key、Token        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 处理流程

1. **检测阶段**：使用规则引擎扫描输入数据，匹配敏感模式
2. **脱敏阶段**：根据配置的脱敏方式替换敏感内容
3. **输出阶段**：返回脱敏后的数据，并记录匹配信息

## 快速开始

### 基本使用

```typescript
import { MaskerEngine, getBuiltInRules } from './services/masking';

// 初始化脱敏引擎
const masker = new MaskerEngine();

// 加载内置规则
masker.addRules(getBuiltInRules());

// 脱敏文本
const result = await masker.maskText('密码是 password123', 'text');
console.log(result.masked); // "密码是 [PASSWORD]"
```

### 截图脱敏

```typescript
import { ImageMasker } from './services/masking';

const imageMasker = new ImageMasker();

// 标准模式：遮盖已知敏感区域
const masked = await imageMasker.maskScreenshot(screenshotBuffer, 'standard');

// 严格模式：OCR 全文检测
const strictMasked = await imageMasker.maskScreenshot(screenshotBuffer, 'strict');
```

## 脱敏规则

### 内置规则

系统提供以下内置规则：

| 规则 ID | 名称 | 优先级 | 脱敏方式 | 适用场景 |
|---------|------|--------|----------|----------|
| `builtin-password` | 密码字段 | 90 | 占位符 `[PASSWORD]` | 文本/日志/YAML/截图 |
| `builtin-api-key` | API Key | 95 | 占位符 `[API_KEY]` | 文本/日志/YAML/截图 |
| `builtin-bearer-token` | Bearer Token | 95 | 占位符 `[BEARER_TOKEN]` | 文本/日志/YAML/截图 |
| `builtin-phone-cn` | 中国手机号 | 80 | 部分保留 `138****5678` | 文本/日志/截图 |
| `builtin-id-card-cn` | 身份证号 | 85 | 部分保留 `123456********1234` | 文本/日志/截图 |
| `builtin-email` | 邮箱地址 | 70 | 哈希 `[MASKED:a1b2c3]` | 文本/日志 |
| `builtin-bank-card` | 银行卡号 | 85 | 部分保留 `1234****5678` | 文本/日志/截图 |

### 自定义规则

```typescript
import { MaskingRule } from './types/masking';

const customRule: MaskingRule = {
  id: 'custom-employee-id',
  name: '员工工号',
  description: '检测员工工号格式',
  enabled: true,
  priority: 75,
  detection: {
    type: 'regex',
    pattern: 'EMP\\d{6}',
    flags: 'g',
  },
  masking: {
    method: 'partial',
    options: {
      keepStart: 3,
      keepEnd: 2,
      maskChar: '*',
    },
  },
  scope: {
    text: true,
    screenshot: false,
    log: true,
    yaml: false,
  },
  category: 'pii',
  builtIn: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

masker.addRule(customRule);
```

## 脱敏方式

### 1. 完全遮盖 (full)

用掩码字符完全替换敏感内容。

```typescript
// 配置
{
  method: 'full',
  options: {
    maskChar: '*'  // 默认 *
  }
}

// 示例
// 输入: "password123"
// 输出: "***********"
```

### 2. 部分保留 (partial)

保留开头和结尾部分，中间用掩码字符替换。

```typescript
// 配置
{
  method: 'partial',
  options: {
    keepStart: 3,   // 保留开头 3 个字符
    keepEnd: 4,     // 保留结尾 4 个字符
    maskChar: '*'   // 默认 *
  }
}

// 示例
// 输入: "13812345678"
// 输出: "138****5678"
```

### 3. 哈希替换 (hash)

将敏感内容替换为固定长度的哈希标识。

```typescript
// 配置
{
  method: 'hash',
  options: {
    hashLength: 6  // 哈希长度，默认 6
  }
}

// 示例
// 输入: "admin@example.com"
// 输出: "[MASKED:a1b2c3]"
```

### 4. 占位符替换 (placeholder)

将敏感内容替换为固定的占位符文本。

```typescript
// 配置
{
  method: 'placeholder',
  options: {
    placeholder: '[API_KEY]'  // 自定义占位符
  }
}

// 示例
// 输入: "sk-abcd1234efgh5678"
// 输出: "[API_KEY]"
```

### 5. 模糊处理 (blur)

仅用于截图脱敏，对敏感区域进行模糊处理。

```typescript
// 配置
{
  method: 'blur',
  options: {
    blurRadius: 10  // 模糊半径，默认 10
  }
}
```

## 截图脱敏

### 脱敏级别

| 级别 | 说明 | 性能 | 安全性 |
|------|------|------|--------|
| `off` | 关闭截图脱敏 | 最快 | 最低 |
| `standard` | 检测已知敏感区域（如密码输入框） | 快 | 中等 |
| `strict` | OCR 全文检测敏感内容 | 慢 | 最高 |

### 配置示例

```typescript
// 在 ExecutionEngine 中配置
const engine = new ExecutionEngine({
  screenshotMasking: 'standard',  // 或 'strict' / 'off'
});

// 运行时修改
engine.setConfig({
  screenshotMasking: 'strict',
});
```

### OCR 检测

严格模式下使用 Tesseract.js 进行 OCR 文字识别：

```typescript
// OCR 会识别图片中的所有文字
const masked = await imageMasker.maskScreenshot(screenshot, 'strict');

// 返回处理后的图片和处理的区域信息
console.log(masked.regions);
// [
//   { x: 100, y: 50, width: 200, height: 30, type: 'blur' }
// ]
```

## 日志脱敏

### 自动脱敏

日志输出时自动应用脱敏规则：

```typescript
// 原始日志
console.log('用户登录: username=admin, password=secret123');

// 脱敏后输出
// 用户登录: username=admin, password=[PASSWORD]
```

### 日志级别配置

```typescript
const config = {
  logMasking: {
    error: true,    // 错误日志脱敏
    warn: true,     // 警告日志脱敏
    info: true,     // 信息日志脱敏
    debug: false,   // 调试日志不脱敏（本地开发）
  },
};
```

### 敏感信息保留

使用白名单排除特定内容：

```typescript
masker.addWhitelist([
  'test@example.com',      // 测试邮箱
  '\\b\\d{11}\\b',         // 11 位数字（如测试手机号）
]);
```

## API 参考

### MaskerEngine

主要的文本脱敏引擎。

```typescript
class MaskerEngine {
  // 添加单个规则
  addRule(rule: MaskingRule): void;

  // 批量添加规则
  addRules(rules: MaskingRule[]): void;

  // 移除规则
  removeRule(ruleId: string): void;

  // 脱敏文本
  maskText(text: string, scope: MaskScope): Promise<MaskingResult>;

  // 添加白名单
  addWhitelist(patterns: (string | RegExp)[]): void;

  // 获取所有规则
  getRules(): MaskingRule[];

  // 启用/禁用规则
  toggleRule(ruleId: string, enabled: boolean): void;
}
```

### ImageMasker

截图脱敏处理器。

```typescript
class ImageMasker {
  // 初始化
  constructor(options?: {
    ocrEnabled?: boolean;     // 是否启用 OCR
    defaultLevel?: MaskLevel;  // 默认脱敏级别
  });

  // 脱敏截图
  maskScreenshot(
    imageBuffer: Buffer,
    level: 'off' | 'standard' | 'strict'
  ): Promise<MaskedImage>;

  // 设置敏感区域（手动标注）
  setSensitiveRegions(regions: MaskRegion[]): void;

  // 清除敏感区域
  clearSensitiveRegions(): void;
}
```

### 类型定义

```typescript
interface MaskingResult {
  original: string;              // 原始内容
  masked: string;                // 脱敏后内容
  matches: MaskingMatch[];       // 匹配详情
  processingTime: number;        // 处理耗时 (ms)
}

interface MaskingMatch {
  ruleId: string;                // 规则 ID
  ruleName: string;              // 规则名称
  category: SensitiveCategory;   // 数据类别
  position: {                    // 位置信息
    start: number;
    end: number;
  };
  originalValue: string;         // 原始值
  maskedValue: string;           // 脱敏后的值
}

type MaskScope = 'text' | 'log' | 'yaml';
type SensitiveCategory = 'credential' | 'pii' | 'financial' | 'health' | 'custom';
type MaskLevel = 'off' | 'standard' | 'strict';
```

## 最佳实践

### 1. 选择合适的脱敏方式

| 场景 | 推荐方式 | 原因 |
|------|----------|------|
| 密码/密钥 | `placeholder` | 明确标识，不暴露长度 |
| 手机/身份证 | `partial` | 保留部分信息用于验证 |
| 邮箱/地址 | `hash` | 完全隐藏，可追踪 |
| 日志 | `full` | 确保安全 |

### 2. 合理设置规则优先级

高优先级规则会优先匹配，避免重要信息被低优先级规则处理：

```typescript
// ✅ 正确：API Key 优先级更高
{
  id: 'api-key',
  priority: 95,  // 高优先级
  pattern: 'api_key\\s*[:=]\\s*(.+)'
}

{
  id: 'generic-string',
  priority: 10,  // 低优先级
  pattern: '.{20,}'
}
```

### 3. 使用上下文匹配减少误报

```typescript
// ✅ 使用上下文提高准确性
{
  detection: {
    type: 'regex',
    pattern: '(?<=password["\':\\s]+)[^"\''\\s]+',  // 密码后面的值
    context: {
      before: '(password|pwd|passwd)\\s*[:=]\\s*["\']?',  // 前面是密码字段
    },
  },
}
```

### 4. 测试环境配置

```typescript
// 开发环境：减少脱敏便于调试
if (process.env.NODE_ENV === 'development') {
  masker.toggleRule('builtin-phone-cn', false);
  config.logMasking.debug = false;
}

// 生产环境：启用所有规则
if (process.env.NODE_ENV === 'production') {
  config.screenshotMasking = 'strict';
}
```

### 5. 定期审查脱敏日志

```typescript
// 记录脱敏统计
const stats = await masker.getStats();
console.log('脱敏统计:', {
  totalProcessed: stats.totalProcessed,
  totalMasked: stats.totalMasked,
  topRules: stats.topRules,  // 最常触发的规则
});
```

## 常见问题

### Q: 为什么某些敏感数据没有被脱敏？

A: 检查以下几点：
1. 规则是否启用 (`enabled: true`)
2. 规则的 `scope` 是否包含当前场景
3. 规则优先级是否被其他规则覆盖
4. 数据格式是否匹配正则表达式

### Q: 如何调试脱敏规则？

A: 启用调试模式查看详细匹配信息：

```typescript
const result = await masker.maskText(text, 'log', {
  debug: true,  // 输出匹配详情
  includeMatches: true,
});

console.log(result.matches);
// [
//   {
//     ruleId: 'builtin-phone-cn',
//     position: { start: 10, end: 21 },
//     originalValue: '13812345678',
//     maskedValue: '138****5678'
//   }
// ]
```

### Q: OCR 检测很慢怎么办？

A: OCR 处理较耗时，建议：
1. 使用 `standard` 级别代替 `strict`
2. 限制 OCR 检测的区域
3. 预先标注敏感区域，避免 OCR

### Q: 如何处理动态生成的敏感数据？

A: 使用关键词模式配合正则表达式：

```typescript
{
  detection: {
    type: 'keyword',
    pattern: 'token',
    context: {
      after: '\\s*[:=]\\s*(.+)',  // 捕获后面的值
    },
  },
}
```

## 更新日志

### v1.0.0 (2025-01)

- 初始版本发布
- 内置 7 种敏感数据检测规则
- 支持 4 种脱敏方式
- 截图脱敏支持标准/严格模式
- OCR 文字识别集成
